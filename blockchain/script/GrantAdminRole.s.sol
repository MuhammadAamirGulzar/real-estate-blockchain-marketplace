// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/RoleManager.sol";

contract GrantAdminRole is Script {
    function run() external {
        address roleManagerAddress = vm.envAddress("ROLE_MANAGER_ADDRESS");
        address adminWallet = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
        
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        RoleManager roleManager = RoleManager(roleManagerAddress);
        bytes32 ADMIN_ROLE = keccak256("ADMIN_ROLE");
        
        if (!roleManager.hasRole(ADMIN_ROLE, adminWallet)) {
            roleManager.grantRole(ADMIN_ROLE, adminWallet);
            console.log("Admin role granted to:", adminWallet);
        } else {
            console.log("Admin already has role:", adminWallet);
        }
        
        vm.stopBroadcast();
    }
}
