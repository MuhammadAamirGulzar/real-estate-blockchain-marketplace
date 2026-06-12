import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { db } from "../db/connection.js";
import { kycSubmissions, properties, users } from "../db/schema.js";
import { web3Service } from "./web3Service.js";

/**
 * Blockchain Event Listener Service
 * Listens to smart contract events and syncs state to database
 * Ensures blockchain is the source of truth
 */
class BlockchainEventListener {
  constructor() {
    this.provider = null;
    this.contracts = {};
    this.listeners = new Map();
    this.processedEvents = new Set(); // Prevent duplicate processing
    this.isListening = false;
    this.lastProcessedBlock = {};
  }

  /**
   * Initialize event listener with web3 service
   */
  async initialize() {
    try {
      console.log("🎧 Initializing Blockchain Event Listener...");

      await web3Service.ensureInitialized();

      this.provider = web3Service.provider;
      this.contracts = web3Service.contracts;

      console.log("✅ Event Listener initialized");
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize Event Listener:", error);
      throw error;
    }
  }

  /**
   * Start listening to all contract events
   * @param {number} fromBlock - Block number to start listening from (default: latest)
   */
  async startListening(fromBlock = "latest") {
    if (this.isListening) {
      console.warn("⚠️ Event listener already running");
      return;
    }

    try {
      await this.initialize();

      console.log("🎧 Starting event listeners...");
      console.log(`📍 Listening from block: ${fromBlock}`);

      // Listen to KYC events
      await this.listenToKYCEvents(fromBlock);

      // Listen to Property/Asset events
      await this.listenToAssetRegistryEvents(fromBlock);

      // Listen to Role management events
      await this.listenToRoleManagerEvents(fromBlock);

      // Listen to PropertyNFT events (tokenization)
      await this.listenToPropertyNFTEvents(fromBlock);

      this.isListening = true;
      console.log("✅ All event listeners active");

      // Optionally replay past events
      if (fromBlock !== "latest") {
        await this.replayPastEvents(fromBlock);
      }
    } catch (error) {
      console.error("❌ Failed to start event listeners:", error);
      throw error;
    }
  }

  /**
   * Stop all event listeners
   */
  async stopListening() {
    if (!this.isListening) {
      console.warn("⚠️ Event listener not running");
      return;
    }

    console.log("🛑 Stopping event listeners...");

    // Remove all listeners
    for (const [eventKey, filter] of this.listeners.entries()) {
      try {
        const [contractName, eventName] = eventKey.split(":");
        if (this.contracts[contractName]) {
          this.contracts[contractName].off(filter);
          console.log(`🛑 Stopped listening to ${contractName}.${eventName}`);
        }
      } catch (error) {
        console.error(`Error removing listener ${eventKey}:`, error);
      }
    }

    this.listeners.clear();
    this.isListening = false;
    console.log("✅ All event listeners stopped");
  }

  /**
   * Listen to KYCRegistry events
   */
  async listenToKYCEvents(fromBlock) {
    const kycContract = this.contracts.KYCRegistry;
    if (!kycContract) {
      console.warn("⚠️ KYCRegistry contract not loaded, skipping KYC events");
      return;
    }

    console.log("🎧 Setting up KYC event listeners...");

    // KYCSubmitted event
    const kycSubmittedFilter = kycContract.filters.KYCSubmitted();
    kycContract.on(kycSubmittedFilter, async (user, documentHash, event) => {
      await this.handleKYCSubmitted(user, documentHash, event);
    });
    this.listeners.set("KYCRegistry:KYCSubmitted", kycSubmittedFilter);

    // KYCApproved event
    const kycApprovedFilter = kycContract.filters.KYCApproved();
    kycContract.on(kycApprovedFilter, async (user, approver, event) => {
      await this.handleKYCApproved(user, approver, event);
    });
    this.listeners.set("KYCRegistry:KYCApproved", kycApprovedFilter);

    // KYCRejected event
    const kycRejectedFilter = kycContract.filters.KYCRejected();
    kycContract.on(kycRejectedFilter, async (user, reason, event) => {
      await this.handleKYCRejected(user, reason, event);
    });
    this.listeners.set("KYCRegistry:KYCRejected", kycRejectedFilter);

    console.log("✅ KYC event listeners active");
  }

  /**
   * Listen to AssetRegistry events
   */
  async listenToAssetRegistryEvents(fromBlock) {
    const assetContract = this.contracts.AssetRegistry;
    if (!assetContract) {
      console.warn(
        "⚠️ AssetRegistry contract not loaded, skipping Asset events",
      );
      return;
    }

    console.log("🎧 Setting up AssetRegistry event listeners...");

    // PropertyListed event
    const propertyListedFilter = assetContract.filters.PropertyListed();
    assetContract.on(
      propertyListedFilter,
      async (propertyId, lister, metadataHash, event) => {
        await this.handlePropertyListed(
          propertyId,
          lister,
          metadataHash,
          event,
        );
      },
    );
    this.listeners.set("AssetRegistry:PropertyListed", propertyListedFilter);

    // VerifierAssigned event
    const verifierAssignedFilter = assetContract.filters.VerifierAssigned();
    assetContract.on(
      verifierAssignedFilter,
      async (propertyId, verifier, event) => {
        await this.handleVerifierAssigned(propertyId, verifier, event);
      },
    );
    this.listeners.set(
      "AssetRegistry:VerifierAssigned",
      verifierAssignedFilter,
    );

    // PropertyVerified event
    const propertyVerifiedFilter = assetContract.filters.PropertyVerified();
    assetContract.on(
      propertyVerifiedFilter,
      async (propertyId, verifier, event) => {
        await this.handlePropertyVerified(propertyId, verifier, event);
      },
    );
    this.listeners.set(
      "AssetRegistry:PropertyVerified",
      propertyVerifiedFilter,
    );

    // PropertyRejected event (if exists)
    try {
      const propertyRejectedFilter = assetContract.filters.PropertyRejected();
      assetContract.on(
        propertyRejectedFilter,
        async (propertyId, reason, event) => {
          await this.handlePropertyRejected(propertyId, reason, event);
        },
      );
      this.listeners.set(
        "AssetRegistry:PropertyRejected",
        propertyRejectedFilter,
      );
    } catch (e) {
      console.log("ℹ️ PropertyRejected event not available in contract");
    }

    console.log("✅ AssetRegistry event listeners active");
  }

  /**
   * Listen to RoleManager events
   */
  async listenToRoleManagerEvents(fromBlock) {
    const roleContract = this.contracts.RoleManager;
    if (!roleContract) {
      console.warn("⚠️ RoleManager contract not loaded, skipping Role events");
      return;
    }

    console.log("🎧 Setting up RoleManager event listeners...");

    // RoleGrantedByAdmin event
    const roleGrantedFilter = roleContract.filters.RoleGrantedByAdmin();
    roleContract.on(
      roleGrantedFilter,
      async (role, account, grantor, event) => {
        await this.handleRoleGranted(role, account, grantor, event);
      },
    );
    this.listeners.set("RoleManager:RoleGrantedByAdmin", roleGrantedFilter);

    // RoleRevokedByAdmin event
    const roleRevokedFilter = roleContract.filters.RoleRevokedByAdmin();
    roleContract.on(
      roleRevokedFilter,
      async (role, account, revoker, event) => {
        await this.handleRoleRevoked(role, account, revoker, event);
      },
    );
    this.listeners.set("RoleManager:RoleRevokedByAdmin", roleRevokedFilter);

    console.log("✅ RoleManager event listeners active");
  }

  /**
   * Listen to PropertyNFT events (tokenization)
   */
  async listenToPropertyNFTEvents(fromBlock) {
    const nftContract = this.contracts.PropertyNFT;
    if (!nftContract) {
      console.warn("⚠️ PropertyNFT contract not loaded, skipping NFT events");
      return;
    }

    console.log("🎧 Setting up PropertyNFT event listeners...");

    // PropertyMinted event
    try {
      const propertyMintedFilter = nftContract.filters.PropertyMinted();
      nftContract.on(
        propertyMintedFilter,
        async (tokenId, propertyId, owner, metadataURI, event) => {
          await this.handlePropertyMinted(
            tokenId,
            propertyId,
            owner,
            metadataURI,
            event,
          );
        },
      );
      this.listeners.set("PropertyNFT:PropertyMinted", propertyMintedFilter);
    } catch (e) {
      console.log(
        "ℹ️ PropertyMinted event not available, falling back to Transfer event",
      );

      // Fallback to Transfer event
      const transferFilter = nftContract.filters.Transfer();
      nftContract.on(transferFilter, async (from, to, tokenId, event) => {
        if (from === ethers.ZeroAddress) {
          // Minting event
          await this.handlePropertyNFTTransfer(from, to, tokenId, event);
        }
      });
      this.listeners.set("PropertyNFT:Transfer", transferFilter);
    }

    console.log("✅ PropertyNFT event listeners active");
  }

  /**
   * Event Handlers
   */

  async handleKYCSubmitted(user, documentHash, event) {
    const eventId = `KYCSubmitted:${event.transactionHash}:${event.index}`;
    if (this.processedEvents.has(eventId)) return;

    try {
      console.log(`📥 KYCSubmitted event: ${user}`);

      // Find user by wallet address
      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.walletAddress, user.toLowerCase()))
        .limit(1);

      if (dbUser) {
        // Update or create KYC submission
        await db
          .update(kycSubmissions)
          .set({
            status: "pending",
            submissionTransactionHash: event.transactionHash,
            updatedAt: new Date(),
          })
          .where(eq(kycSubmissions.userId, dbUser.id));

        console.log(`✅ Synced KYCSubmitted for user ${dbUser.email}`);
      }

      this.processedEvents.add(eventId);
    } catch (error) {
      console.error("❌ Error handling KYCSubmitted:", error);
    }
  }

  async handleKYCApproved(user, approver, event) {
    const eventId = `KYCApproved:${event.transactionHash}:${event.index}`;
    if (this.processedEvents.has(eventId)) return;

    try {
      console.log(`📥 KYCApproved event: ${user}`);

      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.walletAddress, user.toLowerCase()))
        .limit(1);

      if (dbUser) {
        await db
          .update(kycSubmissions)
          .set({
            status: "approved",
            approvalTransactionHash: event.transactionHash,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(kycSubmissions.userId, dbUser.id));

        await db
          .update(users)
          .set({ kycStatus: "approved" })
          .where(eq(users.id, dbUser.id));

        console.log(`✅ Synced KYCApproved for user ${dbUser.email}`);
      }

      this.processedEvents.add(eventId);
    } catch (error) {
      console.error("❌ Error handling KYCApproved:", error);
    }
  }

  async handleKYCRejected(user, reason, event) {
    const eventId = `KYCRejected:${event.transactionHash}:${event.index}`;
    if (this.processedEvents.has(eventId)) return;

    try {
      console.log(`📥 KYCRejected event: ${user}`);

      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.walletAddress, user.toLowerCase()))
        .limit(1);

      if (dbUser) {
        await db
          .update(kycSubmissions)
          .set({
            status: "rejected",
            rejectionReason: reason,
            rejectionTransactionHash: event.transactionHash,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(kycSubmissions.userId, dbUser.id));

        await db
          .update(users)
          .set({ kycStatus: "rejected" })
          .where(eq(users.id, dbUser.id));

        console.log(`✅ Synced KYCRejected for user ${dbUser.email}`);
      }

      this.processedEvents.add(eventId);
    } catch (error) {
      console.error("❌ Error handling KYCRejected:", error);
    }
  }

  async handlePropertyListed(propertyId, lister, metadataHash, event) {
    const eventId = `PropertyListed:${event.transactionHash}:${event.index}`;
    if (this.processedEvents.has(eventId)) return;

    try {
      console.log(`📥 PropertyListed event: property ${propertyId}`);

      // Find property by transaction hash or metadata
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.listingTransactionHash, event.transactionHash))
        .limit(1);

      if (property) {
        // Update with blockchain property ID
        await db
          .update(properties)
          .set({
            assetRegistryId: BigInt(propertyId.toString()),
            updatedAt: new Date(),
          })
          .where(eq(properties.id, property.id));

        console.log(
          `✅ Synced PropertyListed: DB ID ${property.id} → Blockchain ID ${propertyId}`,
        );
      }

      this.processedEvents.add(eventId);
    } catch (error) {
      console.error("❌ Error handling PropertyListed:", error);
    }
  }

  async handleVerifierAssigned(propertyId, verifier, event) {
    const eventId = `VerifierAssigned:${event.transactionHash}:${event.index}`;
    if (this.processedEvents.has(eventId)) return;

    try {
      console.log(
        `📥 VerifierAssigned event: property ${propertyId}, verifier ${verifier}`,
      );

      // Find property by assetRegistryId
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.assetRegistryId, BigInt(propertyId.toString())))
        .limit(1);

      if (property) {
        // Find verifier by wallet
        const [verifierUser] = await db
          .select()
          .from(users)
          .where(eq(users.walletAddress, verifier.toLowerCase()))
          .limit(1);

        if (verifierUser) {
          await db
            .update(properties)
            .set({
              assignedVerifierId: verifierUser.id,
              status: "verification_pending",
              verifierAssignmentTransactionHash: event.transactionHash,
              updatedAt: new Date(),
            })
            .where(eq(properties.id, property.id));

          console.log(`✅ Synced VerifierAssigned for property ${property.id}`);
        }
      }

      this.processedEvents.add(eventId);
    } catch (error) {
      console.error("❌ Error handling VerifierAssigned:", error);
    }
  }

  async handlePropertyVerified(propertyId, verifier, event) {
    const eventId = `PropertyVerified:${event.transactionHash}:${event.index}`;
    if (this.processedEvents.has(eventId)) return;

    try {
      console.log(`📥 PropertyVerified event: property ${propertyId}`);

      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.assetRegistryId, BigInt(propertyId.toString())))
        .limit(1);

      if (property) {
        const [verifierUser] = await db
          .select()
          .from(users)
          .where(eq(users.walletAddress, verifier.toLowerCase()))
          .limit(1);

        await db
          .update(properties)
          .set({
            status: "verified",
            verifiedBy: verifierUser?.id,
            verifiedAt: new Date(),
            verificationTransactionHash: event.transactionHash,
            updatedAt: new Date(),
          })
          .where(eq(properties.id, property.id));

        console.log(`✅ Synced PropertyVerified for property ${property.id}`);
      }

      this.processedEvents.add(eventId);
    } catch (error) {
      console.error("❌ Error handling PropertyVerified:", error);
    }
  }

  async handlePropertyRejected(propertyId, reason, event) {
    const eventId = `PropertyRejected:${event.transactionHash}:${event.index}`;
    if (this.processedEvents.has(eventId)) return;

    try {
      console.log(`📥 PropertyRejected event: property ${propertyId}`);

      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.assetRegistryId, BigInt(propertyId.toString())))
        .limit(1);

      if (property) {
        await db
          .update(properties)
          .set({
            status: "rejected",
            verificationTransactionHash: event.transactionHash,
            updatedAt: new Date(),
          })
          .where(eq(properties.id, property.id));

        console.log(`✅ Synced PropertyRejected for property ${property.id}`);
      }

      this.processedEvents.add(eventId);
    } catch (error) {
      console.error("❌ Error handling PropertyRejected:", error);
    }
  }

  async handleRoleGranted(role, account, grantor, event) {
    const eventId = `RoleGranted:${event.transactionHash}:${event.index}`;
    if (this.processedEvents.has(eventId)) return;

    try {
      console.log(`📥 RoleGrantedByAdmin event: ${account} → ${role}`);

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.walletAddress, account.toLowerCase()))
        .limit(1);

      if (user) {
        // Map blockchain role to database role
        const roleMapping = {
          [ethers.id("ADMIN_ROLE")]: "admin",
          [ethers.id("SUB_ADMIN_ROLE")]: "admin",
          [ethers.id("VERIFIER_ROLE")]: "verifier",
          [ethers.id("USER_ROLE")]: "user",
        };

        const dbRole = roleMapping[role] || user.role;

        await db
          .update(users)
          .set({
            role: dbRole,
            roleGrantTransactionHash: event.transactionHash,
          })
          .where(eq(users.id, user.id));

        console.log(`✅ Synced RoleGranted for user ${user.email} → ${dbRole}`);
      }

      this.processedEvents.add(eventId);
    } catch (error) {
      console.error("❌ Error handling RoleGranted:", error);
    }
  }

  async handleRoleRevoked(role, account, revoker, event) {
    const eventId = `RoleRevoked:${event.transactionHash}:${event.index}`;
    if (this.processedEvents.has(eventId)) return;

    try {
      console.log(`📥 RoleRevokedByAdmin event: ${account} → ${role}`);

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.walletAddress, account.toLowerCase()))
        .limit(1);

      if (user) {
        await db
          .update(users)
          .set({
            role: "user", // Default to user when role revoked
            roleRevokeTransactionHash: event.transactionHash,
          })
          .where(eq(users.id, user.id));

        console.log(`✅ Synced RoleRevoked for user ${user.email}`);
      }

      this.processedEvents.add(eventId);
    } catch (error) {
      console.error("❌ Error handling RoleRevoked:", error);
    }
  }

  async handlePropertyMinted(tokenId, propertyId, owner, metadataURI, event) {
    const eventId = `PropertyMinted:${event.transactionHash}:${event.index}`;
    if (this.processedEvents.has(eventId)) return;

    try {
      console.log(
        `📥 PropertyMinted event: NFT ${tokenId} for property ${propertyId}`,
      );

      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.assetRegistryId, BigInt(propertyId.toString())))
        .limit(1);

      if (property) {
        await db
          .update(properties)
          .set({
            nftTokenId: Number(tokenId),
            status: "tokenized",
            tokenizationTransactionHash: event.transactionHash,
            updatedAt: new Date(),
          })
          .where(eq(properties.id, property.id));

        console.log(
          `✅ Synced PropertyMinted: Token ${tokenId} for property ${property.id}`,
        );
      }

      this.processedEvents.add(eventId);
    } catch (error) {
      console.error("❌ Error handling PropertyMinted:", error);
    }
  }

  async handlePropertyNFTTransfer(from, to, tokenId, event) {
    if (from !== ethers.ZeroAddress) return; // Only handle minting

    const eventId = `NFTMint:${event.transactionHash}:${event.index}`;
    if (this.processedEvents.has(eventId)) return;

    try {
      console.log(`📥 NFT Minted (Transfer from zero): Token ${tokenId}`);

      // Try to find property by nftTokenId or transaction hash
      const [property] = await db
        .select()
        .from(properties)
        .where(
          eq(properties.tokenizationTransactionHash, event.transactionHash),
        )
        .limit(1);

      if (property) {
        await db
          .update(properties)
          .set({
            nftTokenId: Number(tokenId),
            status: "tokenized",
            updatedAt: new Date(),
          })
          .where(eq(properties.id, property.id));

        console.log(
          `✅ Synced NFT Minting: Token ${tokenId} for property ${property.id}`,
        );
      }

      this.processedEvents.add(eventId);
    } catch (error) {
      console.error("❌ Error handling NFT Transfer:", error);
    }
  }

  /**
   * Replay past events from a specific block
   */
  async replayPastEvents(fromBlock) {
    console.log(`📜 Replaying past events from block ${fromBlock}...`);

    const currentBlock = await this.provider.getBlockNumber();
    console.log(`Current block: ${currentBlock}`);

    // Replay events in batches to avoid overload
    const batchSize = 1000;
    for (
      let start = Number(fromBlock);
      start < currentBlock;
      start += batchSize
    ) {
      const end = Math.min(start + batchSize - 1, currentBlock);
      console.log(`📜 Processing blocks ${start} to ${end}...`);

      try {
        // Query past events for each contract
        await this.replayContractEvents("KYCRegistry", start, end);
        await this.replayContractEvents("AssetRegistry", start, end);
        await this.replayContractEvents("RoleManager", start, end);
        await this.replayContractEvents("PropertyNFT", start, end);
      } catch (error) {
        console.error(
          `❌ Error replaying events for blocks ${start}-${end}:`,
          error,
        );
      }
    }

    console.log("✅ Past events replay complete");
  }

  async replayContractEvents(contractName, fromBlock, toBlock) {
    const contract = this.contracts[contractName];
    if (!contract) return;

    try {
      const events = await contract.queryFilter("*", fromBlock, toBlock);
      console.log(
        `Found ${events.length} events in ${contractName} (blocks ${fromBlock}-${toBlock})`,
      );

      for (const event of events) {
        // Process each event based on event name
        const eventName = event.eventName || event.fragment?.name;
        if (!eventName) continue;

        // Create event wrapper matching live event format
        const wrappedEvent = {
          log: {
            transactionHash: event.transactionHash,
            logIndex: event.logIndex,
            blockNumber: event.blockNumber,
          },
          args: event.args,
        };

        // Route to appropriate handler
        switch (eventName) {
          case "KYCSubmitted":
            await this.handleKYCSubmitted(
              event.args[0],
              event.args[1],
              wrappedEvent,
            );
            break;
          case "KYCApproved":
            await this.handleKYCApproved(
              event.args[0],
              event.args[1],
              wrappedEvent,
            );
            break;
          case "KYCRejected":
            await this.handleKYCRejected(
              event.args[0],
              event.args[1],
              wrappedEvent,
            );
            break;
          case "PropertyListed":
            await this.handlePropertyListed(
              event.args[0],
              event.args[1],
              event.args[2],
              wrappedEvent,
            );
            break;
          case "VerifierAssigned":
            await this.handleVerifierAssigned(
              event.args[0],
              event.args[1],
              wrappedEvent,
            );
            break;
          case "PropertyVerified":
            await this.handlePropertyVerified(
              event.args[0],
              event.args[1],
              wrappedEvent,
            );
            break;
          case "PropertyRejected":
            await this.handlePropertyRejected(
              event.args[0],
              event.args[1],
              wrappedEvent,
            );
            break;
          case "RoleGrantedByAdmin":
            await this.handleRoleGranted(
              event.args[0],
              event.args[1],
              event.args[2],
              wrappedEvent,
            );
            break;
          case "RoleRevokedByAdmin":
            await this.handleRoleRevoked(
              event.args[0],
              event.args[1],
              event.args[2],
              wrappedEvent,
            );
            break;
          case "PropertyMinted":
            await this.handlePropertyMinted(
              event.args[0],
              event.args[1],
              event.args[2],
              event.args[3],
              wrappedEvent,
            );
            break;
          case "Transfer":
            if (event.args[0] === ethers.ZeroAddress) {
              await this.handlePropertyNFTTransfer(
                event.args[0],
                event.args[1],
                event.args[2],
                wrappedEvent,
              );
            }
            break;
        }
      }
    } catch (error) {
      console.error(`Error replaying ${contractName} events:`, error);
    }
  }
}

// Export singleton instance
export const blockchainEventListener = new BlockchainEventListener();

// Auto-start on import (optional - can be disabled)
const AUTO_START = process.env.BLOCKCHAIN_EVENT_LISTENER_AUTO_START === "true";
const START_FROM_BLOCK = process.env.EVENT_LISTENER_FROM_BLOCK || "latest";

if (AUTO_START) {
  blockchainEventListener.startListening(START_FROM_BLOCK).catch((error) => {
    console.error("Failed to auto-start event listener:", error);
  });
}
