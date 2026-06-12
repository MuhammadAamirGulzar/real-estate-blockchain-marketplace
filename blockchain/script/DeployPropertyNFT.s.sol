// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/PropertyNFT.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployPropertyNFT is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Load dependency address from environment variables
        address assetRegistryAddress = vm.envAddress("ASSET_REGISTRY_ADDRESS");
        
        console.log("=== PropertyNFT Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Using AssetRegistry at:", assetRegistryAddress);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy the implementation (logic) contract.
        PropertyNFT implementation = new PropertyNFT();
        console.log("1. Deployed Logic Contract (Implementation):", address(implementation));
        
        // 2. Prepare the initialization data to set the admin and link the AssetRegistry.
        bytes memory initData = abi.encodeWithSelector(
            PropertyNFT.initialize.selector,
            deployer, // admin
            assetRegistryAddress
        );
        
        // 3. Deploy the proxy. This is the main contract address.
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        address proxyAddress = address(proxy);
        console.log("2. Deployed Proxy Contract (Main Address):", proxyAddress);
        
        // 4. Optional: Grant MINTER_ROLE to backend server signer if provided
        PropertyNFT propertyNFT = PropertyNFT(proxyAddress);
        address serverSigner = vm.envOr("SERVER_SIGNER_ADDRESS", address(0));
        
        if (serverSigner != address(0)) {
            console.log("\n3. Granting MINTER_ROLE to Server Signer...");
            console.log("   Server Signer Address:", serverSigner);
            
            bytes32 MINTER_ROLE = propertyNFT.MINTER_ROLE();
            bool alreadyHasMinter = propertyNFT.hasRole(MINTER_ROLE, serverSigner);
            
            if (!alreadyHasMinter) {
                propertyNFT.grantRole(MINTER_ROLE, serverSigner);
                console.log("   [OK] MINTER_ROLE granted to server signer");
            } else {
                console.log("   [OK] Server signer already has MINTER_ROLE");
            }
        } else {
            console.log("\n3. SERVER_SIGNER_ADDRESS not set in .env");
            console.log("   Backend server will need MINTER_ROLE to mint property NFTs");
            console.log("   Run GrantMinterRole.s.sol later to grant this role");
        }
        
        vm.stopBroadcast();
        
        // --- Verification ---
        console.log("\n--- Verification (checking through Proxy) ---");
        require(propertyNFT.assetRegistry() == assetRegistryAddress, "AssetRegistry not set correctly");
        console.log("AssetRegistry address:", propertyNFT.assetRegistry());
        
        console.log("\nRole Verification:");
        console.log("  Deployer has DEFAULT_ADMIN_ROLE:", propertyNFT.hasRole(propertyNFT.DEFAULT_ADMIN_ROLE(), deployer));
        console.log("  Deployer has MINTER_ROLE:", propertyNFT.hasRole(propertyNFT.MINTER_ROLE(), deployer));
        
        if (serverSigner != address(0)) {
            console.log("  Server Signer has MINTER_ROLE:", propertyNFT.hasRole(propertyNFT.MINTER_ROLE(), serverSigner));
        }
        
        // --- Final Instructions ---
        console.log("\n========================= ACTION REQUIRED =========================");
        console.log(" PropertyNFT Deployed Successfully!");
        console.log("\n   The PROXY address is the main, interactive contract address.");
        
        console.log("\n--- For Next Foundry Deployment (DeployInvestmentManager) ---");
        console.log("   Set this environment variable before running the next script:");
        console.log("\n   PROPERTY_NFT_ADDRESS=", proxyAddress);
        
        console.log("\n--- For Backend Application (.env file) ---");
        console.log("   Add this line to your backend project's .env file:");
        console.log("\n   NEXT_PUBLIC_PROPERTY_NFT_ADDRESS=", proxyAddress);
        
        if (serverSigner == address(0)) {
            console.log("\n--- SERVER_SIGNER_ADDRESS Not Configured ---");
            console.log("   Your backend will need MINTER_ROLE to create property NFTs");
            console.log("   Add SERVER_SIGNER_ADDRESS to .env and run:");
            console.log("   forge script script/GrantMinterRole.s.sol --rpc-url $RPC_URL --broadcast");
        }
        console.log("===================================================================");
    }
}