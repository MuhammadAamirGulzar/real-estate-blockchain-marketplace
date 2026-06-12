// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/RoleManager.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";

contract UpgradeRoleManager is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("ROLEMANAGER_ADDRESS");
        
        console.log("=== RoleManager Upgrade ===");
        console.log("Proxy Address:", proxyAddress);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy new implementation
        RoleManager newImplementation = new RoleManager();
        console.log("New Implementation:", address(newImplementation));
        
        // 2. Upgrade proxy
        RoleManager proxy = RoleManager(proxyAddress);
        proxy.upgradeToAndCall(address(newImplementation), "");
        
        console.log("Upgrade complete!");
        console.log("New Version:", proxy.version());
        
        vm.stopBroadcast();
    }
}