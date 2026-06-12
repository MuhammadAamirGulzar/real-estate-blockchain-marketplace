import dotenv from "dotenv";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { web3Service } from "./web3Service.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load FractionalPropertyToken ABI
const fractionalTokenABI = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "web3", "abi", "FractionalPropertyToken.json"),
    "utf8",
  ),
);

class FractionalTokenService {
  /**
   * Deploy a new FractionalPropertyToken contract
   * @param {Object} params - Deployment parameters
   * @returns {Object} Deployed contract info
   */
  async deployFractionalToken({
    propertyId,
    nftTokenId,
    name,
    symbol,
    initialSupply,
    treasury,
  }) {
    try {
      console.log(
        `🚀 Deploying FractionalPropertyToken for property ${propertyId}...`,
      );

      // Use the shared web3Service signer so nonce tracking stays in sync
      // with transactionManager (both use the same deployer key)
      const signer = web3Service.signer;
      const signerAddress = await signer.getAddress();
      const effectiveTreasury = treasury || signerAddress;

      const FractionalTokenFactory = new ethers.ContractFactory(
        fractionalTokenABI.abi,
        fractionalTokenABI.bytecode,
        signer,
      );

      const fractionalToken = await FractionalTokenFactory.deploy(
        name,
        symbol,
        propertyId,
        nftTokenId,
        signerAddress, // admin
        effectiveTreasury,
        ethers.parseEther(initialSupply.toString()),
      );

      await fractionalToken.waitForDeployment();
      const contractAddress = await fractionalToken.getAddress();

      console.log(`✅ FractionalPropertyToken deployed at: ${contractAddress}`);

      return {
        contractAddress,
        transactionHash: fractionalToken.deploymentTransaction().hash,
        name,
        symbol,
        totalSupply: initialSupply,
      };
    } catch (error) {
      console.error("❌ Failed to deploy FractionalPropertyToken:", error);
      throw error;
    }
  }

  /**
   * Mint fractional tokens to an investor
   * @param {string} tokenAddress - FractionalPropertyToken contract address
   * @param {string} to - Recipient address
   * @param {string} amount - Amount in ether units
   */
  async mintTokens(tokenAddress, to, amount) {
    try {
      const fractionalToken = new ethers.Contract(
        tokenAddress,
        fractionalTokenABI.abi,
        web3Service.signer,
      );

      const tx = await fractionalToken.mint(
        to,
        ethers.parseEther(amount.toString()),
      );
      const receipt = await tx.wait();

      console.log(`✅ Minted ${amount} tokens to ${to}`);
      return receipt;
    } catch (error) {
      console.error("❌ Failed to mint fractional tokens:", error);
      throw error;
    }
  }

  /**
   * Enable trading for fractional tokens
   * @param {string} tokenAddress - FractionalPropertyToken contract address
   */
  async enableTrading(tokenAddress) {
    try {
      const fractionalToken = new ethers.Contract(
        tokenAddress,
        fractionalTokenABI.abi,
        web3Service.signer,
      );

      const tx = await fractionalToken.enableTrading();
      const receipt = await tx.wait();

      console.log(`✅ Trading enabled for ${tokenAddress}`);
      return receipt;
    } catch (error) {
      console.error("❌ Failed to enable trading:", error);
      throw error;
    }
  }

  /**
   * Get fractional token balance
   * @param {string} tokenAddress - FractionalPropertyToken contract address
   * @param {string} account - User address
   */
  async getBalance(tokenAddress, account) {
    try {
      const fractionalToken = new ethers.Contract(
        tokenAddress,
        fractionalTokenABI.abi,
        provider,
      );

      const balance = await fractionalToken.balanceOf(account);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error("❌ Failed to get balance:", error);
      throw error;
    }
  }

  /**
   * Get fractional token info
   * @param {string} tokenAddress - FractionalPropertyToken contract address
   */
  async getTokenInfo(tokenAddress) {
    try {
      const fractionalToken = new ethers.Contract(
        tokenAddress,
        fractionalTokenABI.abi,
        provider,
      );

      const [
        name,
        symbol,
        totalSupply,
        maxSupply,
        assetRegistryId,
        nftTokenId,
        tradingEnabled,
      ] = await Promise.all([
        fractionalToken.name(),
        fractionalToken.symbol(),
        fractionalToken.totalSupply(),
        fractionalToken.maxSupply(),
        fractionalToken.assetRegistryId(),
        fractionalToken.nftTokenId(),
        fractionalToken.tradingEnabled(),
      ]);

      return {
        name,
        symbol,
        totalSupply: ethers.formatEther(totalSupply),
        maxSupply: ethers.formatEther(maxSupply),
        assetRegistryId: assetRegistryId.toString(),
        nftTokenId: nftTokenId.toString(),
        tradingEnabled,
        contractAddress: tokenAddress,
      };
    } catch (error) {
      console.error("❌ Failed to get token info:", error);
      throw error;
    }
  }
}

export default new FractionalTokenService();
