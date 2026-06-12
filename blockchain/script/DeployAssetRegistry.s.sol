// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AssetRegistry.sol";
import "../src/RoleManager.sol";
import "../src/KYCRegistry.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployAssetRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Load dependency addresses from environment variables
        address roleManagerAddress = vm.envAddress("ROLE_MANAGER_ADDRESS");
        address kycRegistryAddress = vm.envAddress("KYC_REGISTRY_ADDRESS");
        
        console.log("=== AssetRegistry Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Using RoleManager at:", roleManagerAddress);
        console.log("Using KYCRegistry at:", kycRegistryAddress);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy the implementation (logic) contract.
        AssetRegistry implementation = new AssetRegistry();
        console.log("1. Deployed Logic Contract (Implementation):", address(implementation));
        
        // 2. Prepare the initialization data to link dependencies.
        bytes memory initData = abi.encodeWithSelector(
            AssetRegistry.initialize.selector,
            roleManagerAddress,
            kycRegistryAddress
        );
        
        // 3. Deploy the proxy. This is the main contract address.
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        address proxyAddress = address(proxy);
        console.log("2. Deployed Proxy Contract (Main Address):", proxyAddress);
        
        vm.stopBroadcast();
        
        // --- Verification ---
        AssetRegistry assetRegistry = AssetRegistry(proxyAddress);
        console.log("\n--- Verification (checking through Proxy) ---");
        require(address(assetRegistry.roleManager()) == roleManagerAddress, "RoleManager not set correctly");
        require(address(assetRegistry.kycRegistry()) == kycRegistryAddress, "KYCRegistry not set correctly");
        console.log("RoleManager address set correctly:", address(assetRegistry.roleManager()));
        console.log("KYCRegistry address set correctly:", address(assetRegistry.kycRegistry()));
        
        // --- Final Instructions ---
        console.log("\n========================= ACTION REQUIRED =========================");
        console.log(" AssetRegistry Deployed Successfully!");
        console.log("\n   The PROXY address is the main, interactive contract address.");
        
        console.log("\n--- For Next Foundry Deployment (DeployPropertyNFT) ---");
        console.log("   Set this environment variable before running the next script:");
        console.log("\n   ASSET_REGISTRY_ADDRESS=", proxyAddress);
        
        console.log("\n--- For Backend Application (.env file) ---");
        console.log("   Add this line to your backend project's .env file:");
        console.log("\n   NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS=", proxyAddress);
        console.log("===================================================================");
    }
}