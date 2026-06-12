import "dotenv/config";
import { ethers } from "ethers";
import {
  getAllContractConfigs,
  initializeContractConfig,
} from "../config/contracts.config.js";
import { getNetworkConfig, validateNetworkConfig } from "../config/networks.js";
import TransactionManager from "./transactionManager.js";
class Web3Service {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contracts = {};
    this.contractConfigs = {};
    this.networkConfig = null;
    this.transactionManager = null;
    this.initialized = false;
  }

  /**
   * Initialize Web3 Service with new configuration system
   */
  async initialize() {
    if (this.initialized) return;

    try {
      console.log("🔗 Initializing Web3 Service...");

      // 1. Load and validate network configuration
      this.networkConfig = getNetworkConfig();
      validateNetworkConfig(this.networkConfig);

      console.log(
        `📡 Network: ${this.networkConfig.name} (chainId: ${this.networkConfig.chainId})`,
      );
      console.log(`🔗 RPC URL: ${this.networkConfig.rpcUrl}`);

      // 2. Initialize contract configuration and validate addresses
      await initializeContractConfig();
      this.contractConfigs = getAllContractConfigs();

      console.log(
        `📝 Loaded ${Object.keys(this.contractConfigs).length} contract configurations`,
      );

      // 3. Connect to blockchain provider
      this.provider = new ethers.JsonRpcProvider(this.networkConfig.rpcUrl);

      // Verify connection
      const network = await this.provider.getNetwork();
      if (network.chainId !== BigInt(this.networkConfig.chainId)) {
        throw new Error(
          `Network mismatch: Expected chainId ${this.networkConfig.chainId}, got ${network.chainId}`,
        );
      }

      // 4. Setup signer
      const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error("DEPLOYER_PRIVATE_KEY not found in environment");
      }

      this.signer = new ethers.Wallet(privateKey, this.provider);
      console.log("📍 Signer address:", this.signer.address);

      // 5. Load all contract instances
      for (const [name, config] of Object.entries(this.contractConfigs)) {
        try {
          this.contracts[name] = new ethers.Contract(
            config.address,
            config.abi,
            this.signer,
          );
          console.log(`✅ Loaded ${name} at ${config.address}`);
        } catch (err) {
          console.error(`❌ Failed to load contract ${name}:`, err.message);
          throw new Error(`Failed to initialize contract ${name}`);
        }
      }

      // 6. Initialize transaction manager
      this.transactionManager = new TransactionManager(this);

      console.log("✅ Transaction Manager initialized");

      this.initialized = true;
      console.log("✅ Web3 Service initialized successfully");

      // 7. Display startup summary
      this.logStartupSummary();
    } catch (error) {
      console.error("❌ Failed to initialize Web3 Service:", error);
      throw error;
    }
  }

  /**
   * Log startup summary with key information
   */
  logStartupSummary() {
    console.log("\n" + "=".repeat(60));
    console.log("🚀 BLOCKCHAIN SERVICE READY");
    console.log("=".repeat(60));
    console.log(`Network: ${this.networkConfig.name}`);
    console.log(`Chain ID: ${this.networkConfig.chainId}`);
    console.log(`RPC: ${this.networkConfig.rpcUrl}`);
    console.log(`Signer: ${this.signer.address}`);
    console.log(`Contracts Loaded: ${Object.keys(this.contracts).length}`);
    console.log(`Gas Limit: ${this.networkConfig.gasLimit}`);
    console.log(`Required Confirmations: ${this.networkConfig.confirmations}`);
    console.log("=".repeat(60) + "\n");
  }

  // KYC Functions
  async isKycApproved(walletAddress) {
    await this.ensureInitialized();
    try {
      const approved =
        await this.contracts.KYCRegistry.isKYCApproved(walletAddress);
      return approved;
    } catch (error) {
      console.error("❌ Error checking KYC status:", error);
      return false;
    }
  }

  async approveKYC(walletAddress) {
    await this.ensureInitialized();
    try {
      console.log(`📝 Approving KYC for ${walletAddress}...`);
      const tx = await this.contracts.KYCRegistry.approveKYC(walletAddress);
      const receipt = await tx.wait();
      console.log(`✅ KYC approved. Tx: ${receipt.hash}`);
      return receipt;
    } catch (error) {
      console.error("❌ Error approving KYC:", error);
      throw error;
    }
  }

  async submitKYC(documentHash) {
    await this.ensureInitialized();
    try {
      console.log(`📝 Submitting KYC with documentHash ${documentHash}...`);
      const tx = await this.contracts.KYCRegistry.submitKYC(documentHash);
      const receipt = await tx.wait();
      console.log(`✅ KYC submitted. Tx: ${receipt.hash}`);
      return receipt;
    } catch (error) {
      console.error("❌ Error submitting KYC:", error);
      throw error;
    }
  }

  async getKYCStatus(walletAddress) {
    await this.ensureInitialized();
    try {
      const status =
        await this.contracts.KYCRegistry.getKYCStatus(walletAddress);
      return status;
    } catch (error) {
      console.error("❌ Error getting KYC status:", error);
      return null;
    }
  }

  async approveVerifierApplication(applicantWalletAddress) {
    await this.ensureInitialized();
    try {
      console.log(
        `📝 Approving verifier application for ${applicantWalletAddress}...`,
      );
      const tx = await this.contracts.KYCRegistry.approveVerifierApplication(
        applicantWalletAddress,
      );
      console.log(`⏳ Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ Verifier application approved. Tx: ${receipt.hash}`);
      return tx;
    } catch (error) {
      console.error("❌ Error approving verifier application:", error);
      throw error;
    }
  }

  async rejectVerifierApplication(applicantWalletAddress) {
    await this.ensureInitialized();
    try {
      console.log(
        `📝 Rejecting verifier application for ${applicantWalletAddress}...`,
      );
      const tx = await this.contracts.KYCRegistry.rejectVerifierApplication(
        applicantWalletAddress,
      );
      console.log(`⏳ Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ Verifier application rejected. Tx: ${receipt.hash}`);
      return tx;
    } catch (error) {
      console.error("❌ Error rejecting verifier application:", error);
      throw error;
    }
  }

  async revokeKYC(walletAddress) {
    await this.ensureInitialized();
    try {
      console.log(`📝 Revoking KYC for ${walletAddress}...`);
      const tx = await this.contracts.KYCRegistry.revokeKYC(walletAddress);
      const receipt = await tx.wait();
      console.log(`✅ KYC revoked. Tx: ${receipt.hash}`);
      return receipt;
    } catch (error) {
      console.error("❌ Error revoking KYC:", error);
      throw error;
    }
  }

  // Role Management Functions
  async hasRole(role, address) {
    await this.ensureInitialized();
    try {
      const hasRole = await this.contracts.RoleManager.hasRole(role, address);
      return hasRole;
    } catch (error) {
      console.error("❌ Error checking role:", error);
      return false;
    }
  }

  async grantRole(role, address) {
    await this.ensureInitialized();
    try {
      console.log(`📝 Granting role ${role} to ${address}...`);
      const tx = await this.contracts.RoleManager.grantRole(role, address);
      const receipt = await tx.wait();
      console.log(`✅ Role granted. Tx: ${receipt.hash}`);
      return receipt;
    } catch (error) {
      console.error("❌ Error granting role:", error);
      throw error;
    }
  }

  // Asset Registry Functions
  // Calls AssetRegistry.listProperty(metadataHash) — the only listing function in the ABI.
  // Returns { receipt, onChainId } where onChainId is the uint256 emitted by PropertyListed.
  async listPropertyOnChain(metadataURI) {
    await this.ensureInitialized();
    try {
      console.log(`📝 Listing property on-chain...`);
      const tx = await this.contracts.AssetRegistry.listProperty(metadataURI);
      const receipt = await tx.wait();

      // Extract on-chain property ID from the PropertyListed event
      let onChainId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = this.contracts.AssetRegistry.interface.parseLog(log);
          if (parsed && parsed.name === "PropertyListed") {
            onChainId = parsed.args.propertyId.toString();
            break;
          }
        } catch (_) {}
      }

      console.log(
        `✅ Property listed on-chain. ID: ${onChainId}, Tx: ${receipt.hash}`,
      );
      return { receipt, onChainId };
    } catch (error) {
      console.error("❌ Error listing property on-chain:", error);
      throw error;
    }
  }

  async getAssetValue(propertyId) {
    await this.ensureInitialized();
    try {
      const value =
        await this.contracts.AssetRegistry.getAssetValue(propertyId);
      return ethers.formatEther(value);
    } catch (error) {
      console.error("❌ Error getting asset value:", error);
      return "0";
    }
  }

  // Property NFT Functions
  async mintPropertyNFT(to, propertyId, metadataURI) {
    await this.ensureInitialized();
    try {
      console.log(`📝 Minting Property NFT for ${propertyId}...`);
      const tx = await this.contracts.PropertyNFT.mintProperty(
        to,
        propertyId,
        metadataURI,
      );
      const receipt = await tx.wait();

      // Extract token ID from event
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "Transfer",
      );
      const tokenId = event ? event.args[2] : null;

      console.log(
        `✅ Property NFT minted. Token ID: ${tokenId}, Tx: ${receipt.hash}`,
      );
      return { receipt, tokenId };
    } catch (error) {
      console.error("❌ Error minting Property NFT:", error);
      throw error;
    }
  }

  // Investment Functions
  async invest(propertyId, amount, investor) {
    await this.ensureInitialized();
    try {
      console.log(
        `📝 Processing investment of ${amount} for property ${propertyId}...`,
      );
      const amountInWei = ethers.parseEther(amount.toString());

      // If investor is different from signer, we need to handle this differently
      const tx = await this.contracts.InvestmentManager.invest(
        propertyId,
        amountInWei,
      );
      const receipt = await tx.wait();
      console.log(`✅ Investment processed. Tx: ${receipt.hash}`);
      return receipt;
    } catch (error) {
      console.error("❌ Error processing investment:", error);
      throw error;
    }
  }

  async getInvestorBalance(propertyId, investor) {
    await this.ensureInitialized();
    try {
      const balance = await this.contracts.RWAToken.balanceOf(
        investor,
        propertyId,
      );
      return ethers.formatEther(balance);
    } catch (error) {
      console.error("❌ Error getting investor balance:", error);
      return "0";
    }
  }

  // Helper function
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Get contract instance by name
   * @param {string} name - Contract name (e.g., 'RoleManager')
   * @returns {ethers.Contract} Contract instance
   */
  getContract(name) {
    if (!this.contracts[name]) {
      throw new Error(`Contract ${name} not loaded or does not exist`);
    }
    return this.contracts[name];
  }

  /**
   * Get contract address by name
   * @param {string} name - Contract name
   * @returns {string} Contract address
   */
  getContractAddress(name) {
    if (!this.contractConfigs[name]) {
      throw new Error(`Contract configuration for ${name} not found`);
    }
    return this.contractConfigs[name].address;
  }

  /**
   * Get all contract addresses
   * @returns {Object} Map of contract names to addresses
   */
  getAllAddresses() {
    const addresses = {};
    for (const [name, config] of Object.entries(this.contractConfigs)) {
      addresses[name] = config.address;
    }
    return addresses;
  }

  /**
   * Get current network configuration
   * @returns {Object} Network config
   */
  getNetworkConfig() {
    return this.networkConfig;
  }

  /**
   * Execute a transaction with the transaction manager
   * This wraps blockchain calls with database operations atomically
   * @param {Object} params - Transaction parameters
   * @returns {Object} Transaction result with receipt and db result
   */
  async executeTransaction(params) {
    await this.ensureInitialized();
    return await this.transactionManager.execute(params);
  }
}

// Export singleton instance
export const web3Service = new Web3Service();
