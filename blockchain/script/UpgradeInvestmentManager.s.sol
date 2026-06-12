// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/InvestmentManager.sol";

contract UpgradeInvestmentManager is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("INVESTMENT_MANAGER_ADDRESS");
        
        console.log("=== InvestmentManager Upgrade ===");
        console.log("Proxy Address:", proxyAddress);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy new implementation
        InvestmentManager newImplementation = new InvestmentManager();
        console.log("New Implementation:", address(newImplementation));
        
        // 2. Upgrade proxy
        InvestmentManager proxy = InvestmentManager(proxyAddress);
        proxy.upgradeToAndCall(address(newImplementation), "");
        
        console.log("Upgrade complete!");
        console.log("New Version:", proxy.version());
        
        vm.stopBroadcast();
    }
}