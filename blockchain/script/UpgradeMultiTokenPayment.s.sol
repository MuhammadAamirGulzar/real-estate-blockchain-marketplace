// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MultiTokenPayment.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";

contract UpgradeMultiTokenPayment is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("MULTI_TOKEN_PAYMENT_ADDRESS");
        
        console.log("=== MultiTokenPayment Upgrade ===");
        console.log("Proxy Address:", proxyAddress);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy new implementation
        MultiTokenPayment newImplementation = new MultiTokenPayment();
        console.log("New Implementation:", address(newImplementation));
        
        // 2. Upgrade proxy
        MultiTokenPayment proxy = MultiTokenPayment(proxyAddress);
        proxy.upgradeToAndCall(address(newImplementation), "");
        
        console.log("Upgrade complete!");
        console.log("New Version:", proxy.version());
        
        vm.stopBroadcast();
    }
}
