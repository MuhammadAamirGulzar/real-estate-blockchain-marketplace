// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/KYCRegistry.sol";
import "../src/RoleManager.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployKYCRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Load RoleManager address from the environment variable set in the previous step
        address roleManagerAddress = vm.envAddress("ROLE_MANAGER_ADDRESS");
        
        console.log("=== KYCRegistry Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Using RoleManager at:", roleManagerAddress);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy the implementation (logic) contract.
        KYCRegistry implementation = new KYCRegistry();
        console.log("1. Deployed Logic Contract (Implementation):", address(implementation));
        
        // 2. Prepare the initialization data to link to the RoleManager.
        bytes memory initData = abi.encodeWithSelector(
            KYCRegistry.initialize.selector,
            roleManagerAddress
        );
        
        // 3. Deploy the proxy. This is the main contract address.
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        address proxyAddress = address(proxy);
        console.log("2. Deployed Proxy Contract (Main Address):", proxyAddress);
        
        // 4. Post-Deployment Setup: Grant the new KYCRegistry contract the SUB_ADMIN_ROLE
        // This is required so that KYCRegistry can grant USER_ROLE to applicants.
        RoleManager roleManager = RoleManager(roleManagerAddress);
        roleManager.grantRoleByAdmin(roleManager.SUB_ADMIN_ROLE(), proxyAddress);
        console.log("\n3. Granted SUB_ADMIN_ROLE to KYCRegistry contract.");
        
        vm.stopBroadcast();
        
        // --- Verification ---
        KYCRegistry kycRegistry = KYCRegistry(proxyAddress);
        console.log("\n--- Verification (checking through Proxy) ---");
        require(address(kycRegistry.roleManager()) == roleManagerAddress, "RoleManager not set correctly");
        console.log("RoleManager address set correctly:", address(kycRegistry.roleManager()));
        console.log("KYCRegistry has SUB_ADMIN_ROLE:", roleManager.hasRole(roleManager.SUB_ADMIN_ROLE(), proxyAddress));
        
        // --- Final Instructions ---
        console.log("\n========================= ACTION REQUIRED =========================");
        console.log(" KYCRegistry Deployed and Configured Successfully!");
        console.log("\n   The PROXY address is the main, interactive contract address.");
        
        console.log("\n--- For Next Foundry Deployment (DeployAssetRegistry) ---");
        console.log("   Set this environment variable before running the next script:");
        console.log("\n   KYC_REGISTRY_ADDRESS=", proxyAddress);
        
        console.log("\n--- For Backend Application (.env file) ---");
        console.log("   Add this line to your backend project's .env file:");
        console.log("\n   NEXT_PUBLIC_KYC_REGISTRY_ADDRESS=", proxyAddress);
        console.log("===================================================================");
    }
}