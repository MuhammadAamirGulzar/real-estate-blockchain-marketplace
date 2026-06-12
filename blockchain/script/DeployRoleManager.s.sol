// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/RoleManager.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployRoleManager is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("=== RoleManager Deployment ===");
        console.log("Deployer:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy the implementation (logic) contract.
        // This address is ONLY for the proxy to point to. Do NOT use it directly.
        RoleManager implementation = new RoleManager();
        console.log("1. Deployed Logic Contract (Implementation):", address(implementation));
        
        // 2. Prepare the initialization data to set the initial admin.
        bytes memory initData = abi.encodeWithSelector(
            RoleManager.initialize.selector,
            deployer
        );
        
        // 3. Deploy the proxy and link it to the implementation.
        // This is the main, interactive address for your RoleManager contract.
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        address proxyAddress = address(proxy);
        console.log("2. Deployed Proxy Contract (Main Address):", proxyAddress);
        
        // Verification through the proxy to ensure it's working
        RoleManager roleManager = RoleManager(proxyAddress);
        console.log("\n--- Verification (checking through Proxy) ---");
        console.log("Admin role granted to deployer:", roleManager.hasRole(roleManager.ADMIN_ROLE(), deployer));
        
        vm.stopBroadcast();
        
        // --- Final Instructions ---
        console.log("\n========================= ACTION REQUIRED =========================");
        console.log("RoleManager Deployed Successfully!");
        console.log("\n The PROXY address is the main, interactive contract address.");
        console.log("IGNORE the 'Logic Contract' address above for all interactions.");
        
        console.log("\n--- For Next Foundry Deployment (DeployKYCRegistry) ---");
        console.log("Set this environment variable before running the next script:");
        console.log("\n ROLE_MANAGER_ADDRESS=", proxyAddress);
        
        console.log("\n--- For Backend Application (.env file) ---");
        console.log("Add this line to your backend project's .env file:");
        console.log("\n NEXT_PUBLIC_ROLE_MANAGER_ADDRESS=", proxyAddress);
        console.log("===================================================================");
    }
}
