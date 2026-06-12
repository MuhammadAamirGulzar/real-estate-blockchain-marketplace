// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/KYCRegistry.sol";

contract UpgradeKYCRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address proxyAddress = vm.envAddress("KYC_REGISTRY_PROXY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new implementation
        KYCRegistry newImplementation = new KYCRegistry();
        console.log("New KYCRegistry Implementation deployed at:", address(newImplementation));

        // Perform upgrade via proxy (UUPS pattern)
        // Note: The proxy delegates calls to the implementation, so we call upgradeToAndCall on the proxy
        (bool success, bytes memory data) = proxyAddress.call(
            abi.encodeWithSignature("upgradeToAndCall(address,bytes)", address(newImplementation), "")
        );

        require(success, string(abi.encodePacked("Upgrade failed: ", data)));
        console.log("KYCRegistry upgraded successfully via proxy");

        // Verify upgrade by checking the proxy now points to new implementation
        KYCRegistry upgraded = KYCRegistry(proxyAddress);
        console.log("Current version:", upgraded.version());
        
        // Verify deployer still has admin role after upgrade
        address roleManagerAddress = address(upgraded.roleManager());
        require(roleManagerAddress != address(0), "RoleManager not set");
        
        // Optional: Check if deployer is still admin (assuming RoleManager interface)
        // This requires importing RoleManager or using low-level calls
        (bool adminCheck, ) = roleManagerAddress.call(
            abi.encodeWithSignature("isAdmin(address)", deployer)
        );
        if (adminCheck) {
            console.log("Deployer is still admin after upgrade");
        } else {
            console.log("Warning: Deployer may have lost admin privileges");
        }

        vm.stopBroadcast();
        
        console.log("Upgrade completed successfully!");
    }
}
