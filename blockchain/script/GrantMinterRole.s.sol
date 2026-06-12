// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/PropertyNFT.sol";

/**
 * @title GrantMinterRole
 * @notice One-time script to grant MINTER_ROLE to the server signer
 * @dev Run this with the admin wallet that deployed PropertyNFT
 */
contract GrantMinterRole is Script {
    function run() external {
        // Load private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Load PropertyNFT address
        address propertyNFTAddress = vm.envAddress("PROPERTY_NFT_ADDRESS");
        
        // Server signer address (from DEPLOYER_PRIVATE_KEY in server .env)
        address serverSigner = vm.envAddress("SERVER_SIGNER_ADDRESS");
        
        console.log("=== Grant MINTER_ROLE to Server Signer ===");
        console.log("Admin (deployer):", deployer);
        console.log("PropertyNFT at:", propertyNFTAddress);
        console.log("Server signer:", serverSigner);
        
        PropertyNFT propertyNFT = PropertyNFT(propertyNFTAddress);
        
        // Check current admin status
        bool isAdmin = propertyNFT.hasRole(propertyNFT.DEFAULT_ADMIN_ROLE(), deployer);
        console.log("Deployer has DEFAULT_ADMIN_ROLE:", isAdmin);
        require(isAdmin, "Deployer is not admin");
        
        bytes32 MINTER_ROLE = propertyNFT.MINTER_ROLE();
        bool alreadyHasMinter = propertyNFT.hasRole(MINTER_ROLE, serverSigner);
        console.log("Server signer already has MINTER_ROLE:", alreadyHasMinter);
        
        if (alreadyHasMinter) {
            console.log("MINTER_ROLE already granted. Nothing to do.");
            return;
        }
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Grant MINTER_ROLE to server signer
        propertyNFT.grantRole(MINTER_ROLE, serverSigner);
        console.log("MINTER_ROLE granted to server signer");
        
        vm.stopBroadcast();
        
        // Verify
        bool hasRole = propertyNFT.hasRole(MINTER_ROLE, serverSigner);
        require(hasRole, "Role grant failed");
        console.log("Verification: Server signer now has MINTER_ROLE:", hasRole);
        
        console.log("\n=== SUCCESS ===");
        console.log("Server can now mint PropertyNFTs for tokenization.");
    }
}
