import { ethers } from "ethers";

// Import real ABIs from compiled contracts
import AssetRegistryABI from "@/contracts/abi/AssetRegistry.json";
import FractionalPropertyTokenABI from "@/contracts/abi/FractionalPropertyToken.json";
import InvestmentManagerABI from "@/contracts/abi/InvestmentManager.json";
import KYCRegistryABI from "@/contracts/abi/KYCRegistry.json";
import PropertyNFTABI from "@/contracts/abi/PropertyNFT.json";
import RevenueDistributorABI from "@/contracts/abi/RevenueDistributor.json";
import RoleManagerABI from "@/contracts/abi/RoleManager.json";
import RWATokenABI from "@/contracts/abi/RWAToken.json";
import SecondaryMarketABI from "@/contracts/abi/SecondaryMarket.json";

// Contract addresses - loaded from environment variables
export const CONTRACT_ADDRESSES = {
  ROLE_MANAGER: import.meta.env.VITE_ROLE_MANAGER_ADDRESS || "",
  KYC_REGISTRY: import.meta.env.VITE_KYC_REGISTRY_ADDRESS || "",
  PROPERTY_NFT: import.meta.env.VITE_PROPERTY_NFT_ADDRESS || "",
  ASSET_REGISTRY: import.meta.env.VITE_ASSET_REGISTRY_ADDRESS || "",
  INVESTMENT_MANAGER: import.meta.env.VITE_INVESTMENT_MANAGER_ADDRESS || "",
  SECONDARY_MARKET: import.meta.env.VITE_SECONDARY_MARKET_ADDRESS || "",
  RWA_TOKEN: import.meta.env.VITE_RWA_TOKEN_ADDRESS || "",
  FRACTIONAL_TOKEN: import.meta.env.VITE_FRACTIONAL_TOKEN_ADDRESS || "",
  REVENUE_DISTRIBUTOR: import.meta.env.VITE_REVENUE_DISTRIBUTOR_ADDRESS || "",
};

// Contract ABIs - extracted from imported JSON files
export const CONTRACT_ABIS = {
  ROLE_MANAGER: RoleManagerABI.abi,
  KYC_REGISTRY: KYCRegistryABI.abi,
  PROPERTY_NFT: PropertyNFTABI.abi,
  ASSET_REGISTRY: AssetRegistryABI.abi,
  INVESTMENT_MANAGER: InvestmentManagerABI.abi,
  SECONDARY_MARKET: SecondaryMarketABI.abi,
  RWA_TOKEN: RWATokenABI.abi,
  FRACTIONAL_TOKEN: FractionalPropertyTokenABI.abi,
  REVENUE_DISTRIBUTOR: RevenueDistributorABI.abi,
};

// Role constants matching smart contract enum values
export const ROLES = {
  ADMIN: 0,
  SUBADMIN: 1,
  VERIFIER: 2,
  USER: 3,
};

// Role string mapping for backend-blockchain conversion
export const ROLE_STRINGS = {
  admin: 0,
  subadmin: 1,
  verifier: 2,
  user: 3,
};

export const ROLE_NUMBERS = {
  0: "admin",
  1: "subadmin",
  2: "verifier",
  3: "user",
};

/**
 * Validate that all required contract addresses are configured
 * @throws {Error} If any critical contract address is missing
 */
export const validateContractAddresses = () => {
  const requiredContracts = [
    "ROLE_MANAGER",
    "KYC_REGISTRY",
    "PROPERTY_NFT",
    "ASSET_REGISTRY",
  ];
  const missing = [];

  for (const contractName of requiredContracts) {
    if (
      !CONTRACT_ADDRESSES[contractName] ||
      CONTRACT_ADDRESSES[contractName] === ""
    ) {
      missing.push(contractName);
    }
  }

  if (missing.length > 0) {
    const isDev = import.meta.env.MODE === "development";
    const message = `Missing contract addresses: ${missing.join(", ")}. Please configure in .env file.`;

    if (isDev) {
      console.warn(`⚠️ ${message}`);
    } else {
      throw new Error(message);
    }
  }
};

/**
 * Convert backend role string to blockchain role number
 * @param {string} roleString - Role name (e.g., 'admin', 'verifier')
 * @returns {number} Role number (0-3)
 */
export const roleStringToNumber = (roleString) => {
  const normalized = roleString?.toLowerCase();
  return ROLE_STRINGS[normalized] ?? 3; // Default to USER
};

/**
 * Convert blockchain role number to backend role string
 * @param {number} roleNumber - Role number (0-3)
 * @returns {string} Role name (e.g., 'admin', 'verifier')
 */
export const roleNumberToString = (roleNumber) => {
  return ROLE_NUMBERS[roleNumber] ?? "user"; // Default to 'user'
};

/**
 * Get a contract instance with provider/signer
 * @param {string} contractName - Name from CONTRACT_ADDRESSES keys
 * @param {ethers.Provider|ethers.Signer} providerOrSigner - Ethers provider or signer
 * @returns {ethers.Contract} Contract instance ready for interaction
 * @throws {Error} If contract not found or address missing
 */
export const getContract = (contractName, providerOrSigner) => {
  const address = CONTRACT_ADDRESSES[contractName];
  const abi = CONTRACT_ABIS[contractName];

  if (!abi) {
    throw new Error(`Contract ABI for ${contractName} not found`);
  }

  if (!address || address === "") {
    throw new Error(
      `Contract address for ${contractName} not configured. Check your .env file.`,
    );
  }

  return new ethers.Contract(address, abi, providerOrSigner);
};

/**
 * Get all contract instances at once
 * @param {ethers.Provider|ethers.Signer} providerOrSigner
 * @returns {Object} Object with all contract instances
 */
export const getAllContracts = (providerOrSigner) => {
  const contracts = {};

  for (const [name, address] of Object.entries(CONTRACT_ADDRESSES)) {
    if (address && address !== "") {
      try {
        contracts[name] = getContract(name, providerOrSigner);
      } catch (error) {
        console.warn(`Failed to initialize ${name}:`, error.message);
      }
    }
  }

  return contracts;
};

// Validate on module load (only warns in development)
validateContractAddresses();

export default {
  CONTRACT_ADDRESSES,
  CONTRACT_ABIS,
  ROLES,
  ROLE_STRINGS,
  ROLE_NUMBERS,
  getContract,
  getAllContracts,
  validateContractAddresses,
  roleStringToNumber,
  roleNumberToString,
};
