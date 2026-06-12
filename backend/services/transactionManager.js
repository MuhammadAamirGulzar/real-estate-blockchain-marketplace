/**
 * Transaction Manager Service
 *
 * Handles blockchain transaction execution with:
 * - Atomic DB + blockchain operations
 * - Gas management and estimation
 * - Nonce management
 * - Retry logic for failed transactions
 * - Transaction status tracking
 * - Rollback on failures
 *
 * Usage:
 * const result = await transactionManager.execute({
 *   contract: 'KYCRegistry',
 *   function: 'approveKYC',
 *   args: [userWallet],
 *   dbOperation: async (dbTx) => {
 *     return await db.update(kycSubmissions).set({ status: 'approved' });
 *   },
 *   relatedEntity: { type: 'kyc', id: kycId }
 * });
 */

import { and, eq } from "drizzle-orm";
import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { getNetworkConfig } from "../config/networks.js";
import { db } from "../db/connection.js";
import { blockchainTransactions, transactionWorkflows } from "../db/schema.js";

class TransactionManager {
  constructor(web3Service) {
    this.web3Service = web3Service;
    this.network = getNetworkConfig();
    this.pendingNonces = new Map(); // Track pending nonces per address
    this.transactionQueue = []; // Queue for serialized transactions
    this.processing = false;
  }

  /**
   * Execute a blockchain transaction with DB synchronization
   * @param {Object} options - Transaction options
   * @param {string} options.contract - Contract name
   * @param {string} options.function - Function name
   * @param {Array} options.args - Function arguments
   * @param {Function} options.dbOperation - Async function for DB operations (receives db transaction)
   * @param {Object} options.relatedEntity - { type: string, id: number }
   * @param {string} options.from - Override sender address (optional)
   * @param {boolean} options.waitForConfirmation - Wait for N confirmations (default: true)
   * @param {number} options.retries - Number of retries on failure (default: 2)
   * @returns {Promise<Object>} { receipt, dbResult, transactionId }
   */
  async execute(options) {
    const {
      contract: contractName,
      function: functionName,
      args = [],
      dbOperation,
      relatedEntity,
      from,
      waitForConfirmation = true,
      retries = 2,
    } = options;

    let attempt = 0;
    let lastError;
    let resolvedAddress = null; // declared outside try so catch block can access it

    while (attempt < retries) {
      try {
        attempt++;
        console.log(
          `\n🔗 Transaction attempt ${attempt}/${retries}: ${contractName}.${functionName}()`,
        );

        // Step 1: Get contract instance
        const contract = this.web3Service.getContract(contractName);
        if (!contract) {
          throw new Error(`Contract "${contractName}" not initialized`);
        }

        // Step 2: Validate function exists
        if (typeof contract[functionName] !== "function") {
          throw new Error(
            `Function "${functionName}" not found on contract "${contractName}"`,
          );
        }

        // Step 3: Estimate gas
        const gasEstimate = await this._estimateGas(
          contract,
          functionName,
          args,
          from,
        );
        console.log(`   ⛽ Gas estimate: ${gasEstimate.toString()}`);

        // Step 4: Get gas price
        const gasPrice = await this._getGasPrice();
        console.log(
          `   💰 Gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`,
        );

        // Step 5: Check gas price limits
        if (this.network.maxGasPrice) {
          const maxGasPriceWei = ethers.parseUnits(
            this.network.maxGasPrice,
            "gwei",
          );
          if (gasPrice > maxGasPriceWei) {
            throw new Error(
              `Gas price ${ethers.formatUnits(gasPrice, "gwei")} gwei exceeds limit ${this.network.maxGasPrice} gwei`,
            );
          }
        }

        // Step 6: Get nonce
        const signer = from
          ? this.web3Service.getSignerForAddress(from)
          : this.web3Service.signer;
        resolvedAddress = await signer.getAddress();
        const nonce = await this._getNextNonce(resolvedAddress);

        // Step 7: Prepare transaction options
        const txOptions = {
          gasLimit: gasEstimate,
          gasPrice: gasPrice,
          nonce: nonce,
        };

        // Step 8: Create DB transaction record (pending status)
        const txValues = {
          contractName,
          functionName,
          from: resolvedAddress,
          to: contract.target || contract.address,
          status: "pending",
        };

        // Only add relatedEntity fields if BOTH type AND id exist AND id is a valid integer
        // This prevents partial relationships that cause DB errors
        // For new user creation, relatedEntity.id may be null - that's OK, we'll update later
        if (
          relatedEntity?.type &&
          relatedEntity?.id !== null &&
          relatedEntity?.id !== undefined &&
          typeof relatedEntity.id === "number" &&
          Number.isInteger(relatedEntity.id)
        ) {
          txValues.relatedEntityType = relatedEntity.type;
          txValues.relatedEntityId = relatedEntity.id;
        } else if (relatedEntity?.type && !relatedEntity?.id) {
          // Only store type without id for operations that create new entities
          txValues.relatedEntityType = relatedEntity.type;
          console.log(
            `   ℹ️  Transaction for new ${relatedEntity.type} (id will be set after creation)`,
          );
        }

        const [txRecord] = await db
          .insert(blockchainTransactions)
          .values(txValues)
          .returning();

        console.log(`   📝 Created transaction record: ID ${txRecord.id}`);

        // Step 9: Send transaction
        console.log(`   📤 Sending transaction...`);
        const tx = await contract[functionName](...args, txOptions);

        console.log(`   ✓ Transaction sent: ${tx.hash}`);

        // Update record with hash
        await db
          .update(blockchainTransactions)
          .set({ transactionHash: tx.hash })
          .where(eq(blockchainTransactions.id, txRecord.id));

        // Step 10: Wait for transaction receipt
        let receipt;
        if (waitForConfirmation) {
          console.log(
            `   ⏳ Waiting for ${this.network.confirmations} confirmation(s)...`,
          );
          receipt = await tx.wait(this.network.confirmations);
          console.log(
            `   ✓ Transaction confirmed in block ${receipt.blockNumber}`,
          );
        } else {
          receipt = await tx.wait(1); // At least 1 confirmation
          console.log(`   ✓ Transaction mined in block ${receipt.blockNumber}`);
        }

        // Step 11: Check transaction status
        if (receipt.status === 0) {
          throw new Error(`Transaction reverted: ${tx.hash}`);
        }

        // Step 12: Execute DB operation (within transaction for atomicity)
        let dbResult = null;
        if (dbOperation) {
          console.log(`   💾 Executing DB operation...`);
          dbResult = await dbOperation(receipt);
          console.log(`   ✓ DB operation completed`);
        }

        // Step 13: Update transaction record (confirmed)
        await db
          .update(blockchainTransactions)
          .set({
            status: "confirmed",
            confirmations: this.network.confirmations,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            confirmedAt: new Date(),
          })
          .where(eq(blockchainTransactions.id, txRecord.id));

        // Step 14: Keep nonce cache as-is after success.
        // _getNextNonce already advanced it to the next value.

        console.log(`   ✅ Transaction completed successfully\n`);

        // Serialize BigInt values in receipt before returning
        const serializedReceipt = {
          ...receipt,
          blockNumber: receipt.blockNumber?.toString(),
          gasUsed: receipt.gasUsed?.toString(),
          cumulativeGasUsed: receipt.cumulativeGasUsed?.toString(),
          effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
        };

        return {
          receipt: serializedReceipt,
          dbResult,
          transactionId: txRecord.id,
          transactionHash: tx.hash,
        };
      } catch (error) {
        lastError = error;
        console.error(
          `   ❌ Transaction attempt ${attempt} failed: ${error.message}`,
        );
        // Log full database error details for debugging
        if (error.code || error.detail || error.constraint) {
          console.error(`   🔍 DB Error Details:`, {
            code: error.code,
            detail: error.detail,
            constraint: error.constraint,
            table: error.table,
            column: error.column,
          });
        }

        // Reset / release nonce on error so next attempt uses the correct value
        if (resolvedAddress) {
          const isNonceError =
            error.code === "NONCE_EXPIRED" ||
            error.message?.toLowerCase().includes("nonce too low") ||
            error.message
              ?.toLowerCase()
              .includes("nonce has already been used") ||
            error.info?.error?.message?.toLowerCase().includes("nonce too low");
          if (isNonceError) {
            // Wipe the stale cached entry — next attempt re-fetches from chain
            this.pendingNonces.delete(resolvedAddress);
            console.log(
              `   🔄 Nonce cache cleared — will re-fetch from chain on next attempt`,
            );
          } else {
            this._releaseNonce(resolvedAddress);
          }
        } else if (from) {
          this._releaseNonce(from);
        }

        // Determine if error is retryable
        const isRetryable = this._isRetryableError(error);

        if (!isRetryable || attempt >= retries) {
          console.error(`   ⛔ Giving up after ${attempt} attempts\n`);
          throw new Error(
            `Transaction failed after ${attempt} attempts: ${error.message}`,
          );
        }

        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`   ⏳ Retrying in ${delay}ms...`);
        await this._sleep(delay);
      }
    }

    throw new Error(
      `Transaction failed after ${retries} retries: ${lastError?.message}`,
    );
  }

  /**
   * Execute multiple blockchain transactions as a coordinated workflow
   * Each transaction is tracked separately but grouped by workflow ID
   * If any step fails, the entire workflow is marked as failed
   *
   * @param {Object} options - Workflow options
   * @param {string} options.workflowType - Type of workflow (tokenization, investment, etc.)
   * @param {Array} options.steps - Array of transaction steps
   * @param {Object} options.relatedEntity - { type: string, id: number }
   * @param {number} options.initiatedByUserId - User who initiated the workflow
   * @param {Function} options.onStepComplete - Optional callback after each step
   * @param {Function} options.onWorkflowComplete - Optional callback after all steps
   * @returns {Promise<Object>} { workflowId, results, allSuccessful }
   */
  async executeMultiTransaction(options) {
    const {
      workflowType,
      steps = [],
      relatedEntity,
      initiatedByUserId,
      onStepComplete,
      onWorkflowComplete,
    } = options;

    if (!workflowType) {
      throw new Error(
        "workflowType is required for multi-transaction workflow",
      );
    }

    if (!Array.isArray(steps) || steps.length === 0) {
      throw new Error("At least one transaction step is required");
    }

    // Generate workflow ID
    const workflowId = uuidv4();
    const results = [];
    let currentStep = 1;

    console.log(
      `\n🔄 Starting multi-transaction workflow: ${workflowType} (${workflowId})`,
    );
    console.log(`   📋 Total steps: ${steps.length}\n`);

    // Create workflow record
    const [workflowRecord] = await db
      .insert(transactionWorkflows)
      .values({
        workflowId,
        workflowType,
        status: "in_progress",
        totalSteps: steps.length,
        completedSteps: 0,
        currentStep: 1,
        initiatedByUserId,
        relatedEntityType: relatedEntity?.type || null,
        relatedEntityId: relatedEntity?.id || null,
      })
      .returning();

    try {
      // Execute each step sequentially
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        currentStep = i + 1;

        console.log(
          `\n📍 Step ${currentStep}/${steps.length}: ${step.description || step.function}`,
        );

        // Update workflow current step
        await db
          .update(transactionWorkflows)
          .set({ currentStep })
          .where(eq(transactionWorkflows.workflowId, workflowId));

        // Execute the transaction with workflow context
        const stepOptions = {
          ...step,
          relatedEntity: step.relatedEntity || relatedEntity,
        };

        // Execute transaction and track in workflow
        const result = await this.execute(stepOptions);

        // Update transaction record with workflow context
        await db
          .update(blockchainTransactions)
          .set({
            workflowId,
            workflowType,
            stepNumber: currentStep,
            stepDescription:
              step.description || `${step.contract}.${step.function}`,
          })
          .where(eq(blockchainTransactions.id, result.transactionId));

        results.push({
          step: currentStep,
          description: step.description,
          transactionId: result.transactionId,
          transactionHash: result.transactionHash,
          dbResult: result.dbResult,
          success: true,
        });

        // Update workflow progress
        await db
          .update(transactionWorkflows)
          .set({
            completedSteps: currentStep,
            updatedAt: new Date(),
          })
          .where(eq(transactionWorkflows.workflowId, workflowId));

        console.log(`   ✅ Step ${currentStep} completed successfully`);

        // Call step completion callback if provided
        if (onStepComplete) {
          await onStepComplete(result, currentStep, steps.length);
        }
      }

      // All steps completed successfully
      await db
        .update(transactionWorkflows)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(transactionWorkflows.workflowId, workflowId));

      console.log(
        `\n✅ Workflow ${workflowId} completed successfully (${steps.length}/${steps.length} steps)\n`,
      );

      // Call workflow completion callback if provided
      if (onWorkflowComplete) {
        await onWorkflowComplete(results, workflowId);
      }

      return {
        workflowId,
        workflowType,
        results,
        allSuccessful: true,
        completedSteps: steps.length,
        totalSteps: steps.length,
      };
    } catch (error) {
      // Mark workflow as failed
      await db
        .update(transactionWorkflows)
        .set({
          status: "failed",
          errorMessage: error.message,
          updatedAt: new Date(),
        })
        .where(eq(transactionWorkflows.workflowId, workflowId));

      console.error(
        `\n❌ Workflow ${workflowId} failed at step ${currentStep}/${steps.length}`,
      );
      console.error(`   Error: ${error.message}\n`);

      return {
        workflowId,
        workflowType,
        results,
        allSuccessful: false,
        completedSteps: currentStep - 1,
        totalSteps: steps.length,
        failedStep: currentStep,
        error: error.message,
      };
    }
  }

  /**
   * Get workflow status and all associated transactions
   * @param {string} workflowId - Workflow identifier
   * @returns {Promise<Object>} Workflow details with transactions
   */
  async getWorkflowStatus(workflowId) {
    const [workflow] = await db
      .select()
      .from(transactionWorkflows)
      .where(eq(transactionWorkflows.workflowId, workflowId))
      .limit(1);

    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const transactions = await db
      .select()
      .from(blockchainTransactions)
      .where(eq(blockchainTransactions.workflowId, workflowId))
      .orderBy(blockchainTransactions.stepNumber);

    return {
      workflow,
      transactions,
      completionPercentage: Math.round(
        (workflow.completedSteps / workflow.totalSteps) * 100,
      ),
    };
  }

  /**
   * Get all failed workflows
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of failed workflows
   */
  async getFailedWorkflows(filters = {}) {
    let query = db
      .select()
      .from(transactionWorkflows)
      .where(eq(transactionWorkflows.status, "failed"));

    if (filters.workflowType) {
      query = query.where(
        and(
          eq(transactionWorkflows.status, "failed"),
          eq(transactionWorkflows.workflowType, filters.workflowType),
        ),
      );
    }

    const workflows = await query;

    // Get associated transactions for each workflow
    const workflowsWithTransactions = await Promise.all(
      workflows.map(async (workflow) => {
        const transactions = await db
          .select()
          .from(blockchainTransactions)
          .where(eq(blockchainTransactions.workflowId, workflow.workflowId))
          .orderBy(blockchainTransactions.stepNumber);

        return {
          ...workflow,
          transactions,
        };
      }),
    );

    return workflowsWithTransactions;
  }

  /**
   * Retry a failed workflow from the last successful step
   * @param {string} workflowId - Workflow to retry
   * @param {Array} remainingSteps - Steps to retry (must be provided as original steps are not stored)
   * @returns {Promise<Object>} Retry result
   */
  async retryWorkflow(workflowId, remainingSteps) {
    const workflow = await this.getWorkflowStatus(workflowId);

    if (workflow.workflow.status !== "failed") {
      throw new Error(
        `Cannot retry workflow with status: ${workflow.workflow.status}`,
      );
    }

    console.log(
      `\n🔄 Retrying workflow ${workflowId} from step ${workflow.workflow.completedSteps + 1}\n`,
    );

    // Update retry count and status
    await db
      .update(transactionWorkflows)
      .set({
        status: "retrying",
        retryCount: workflow.workflow.retryCount + 1,
        lastRetryAt: new Date(),
        errorMessage: null,
      })
      .where(eq(transactionWorkflows.workflowId, workflowId));

    // Continue from where it failed
    try {
      const results = [];
      let currentStep = workflow.workflow.completedSteps + 1;

      for (let i = 0; i < remainingSteps.length; i++) {
        const step = remainingSteps[i];

        console.log(
          `\n📍 Step ${currentStep}/${workflow.workflow.totalSteps}: ${step.description || step.function}`,
        );

        const result = await this.execute(step);

        // Update transaction record with workflow context
        await db
          .update(blockchainTransactions)
          .set({
            workflowId,
            workflowType: workflow.workflow.workflowType,
            stepNumber: currentStep,
            stepDescription:
              step.description || `${step.contract}.${step.function}`,
          })
          .where(eq(blockchainTransactions.id, result.transactionId));

        results.push({
          step: currentStep,
          transactionId: result.transactionId,
          transactionHash: result.transactionHash,
          success: true,
        });

        // Update progress
        await db
          .update(transactionWorkflows)
          .set({
            completedSteps: currentStep,
            currentStep: currentStep,
            updatedAt: new Date(),
          })
          .where(eq(transactionWorkflows.workflowId, workflowId));

        currentStep++;
      }

      // Mark as completed
      await db
        .update(transactionWorkflows)
        .set({
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(transactionWorkflows.workflowId, workflowId));

      console.log(`\n✅ Workflow retry completed successfully\n`);

      return {
        workflowId,
        results,
        success: true,
      };
    } catch (error) {
      // Mark as failed again
      await db
        .update(transactionWorkflows)
        .set({
          status: "failed",
          errorMessage: error.message,
          updatedAt: new Date(),
        })
        .where(eq(transactionWorkflows.workflowId, workflowId));

      console.error(`\n❌ Workflow retry failed: ${error.message}\n`);

      return {
        workflowId,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Estimate gas for transaction
   */
  async _estimateGas(contract, functionName, args, from) {
    try {
      const estimate = await contract[functionName].estimateGas(
        ...args,
        from ? { from } : {},
      );
      // Add safety buffer
      const buffer = BigInt(
        Math.floor(Number(estimate) * this.network.gasMultiplier),
      );
      return estimate + buffer;
    } catch (error) {
      console.warn(
        `   ⚠️ Gas estimation failed, using default: ${error.message}`,
      );
      return BigInt(500000); // Default fallback
    }
  }

  /**
   * Get current gas price with network-specific adjustments
   */
  async _getGasPrice() {
    try {
      const feeData = await this.web3Service.provider.getFeeData();

      // Use EIP-1559 if available
      if (feeData.maxFeePerGas) {
        return feeData.maxFeePerGas;
      }

      // Fallback to legacy gas price
      return feeData.gasPrice || ethers.parseUnits("20", "gwei");
    } catch (error) {
      console.warn(
        `   ⚠️ Could not fetch gas price, using default: ${error.message}`,
      );
      return ethers.parseUnits("20", "gwei");
    }
  }

  /**
   * Get next nonce for address (with pending transaction tracking)
   */
  async _getNextNonce(address) {
    // Check if we have pending nonces
    if (this.pendingNonces.has(address)) {
      const nonce = this.pendingNonces.get(address);
      this.pendingNonces.set(address, nonce + 1);
      return nonce;
    }

    // Get nonce from network
    const nonce = await this.web3Service.provider.getTransactionCount(
      address,
      "pending",
    );
    this.pendingNonces.set(address, nonce + 1);
    return nonce;
  }

  /**
   * Release nonce after transaction completion
   */
  _releaseNonce(address) {
    // On failed transactions, invalidate cached nonce and re-fetch from chain.
    this.pendingNonces.delete(address);
  }

  /**
   * Determine if error is retryable
   */
  _isRetryableError(error) {
    const retryableErrors = [
      "nonce too low",
      "replacement transaction underpriced",
      "transaction underpriced",
      "insufficient funds for gas",
      "timeout",
      "network error",
      "server error",
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some((msg) => errorMessage.includes(msg));
  }

  /**
   * Sleep helper
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get transaction status from DB
   */
  async getTransactionStatus(transactionId) {
    const [txRecord] = await db
      .select()
      .from(blockchainTransactions)
      .where(eq(blockchainTransactions.id, transactionId))
      .limit(1);

    return txRecord;
  }

  /**
   * Retry failed transaction
   */
  async retryTransaction(transactionId) {
    const txRecord = await this.getTransactionStatus(transactionId);

    if (!txRecord) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (txRecord.status !== "failed") {
      throw new Error(
        `Cannot retry transaction with status: ${txRecord.status}`,
      );
    }

    // Reconstruct and retry
    // (Implementation depends on storing args in DB)
    throw new Error("Transaction retry not yet implemented");
  }
}

export default TransactionManager;
