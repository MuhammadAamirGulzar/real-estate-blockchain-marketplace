// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/PaymentEscrow.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";

contract UpgradePaymentEscrow is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("PAYMENT_ESCROW_ADDRESS");
        
        console.log("=== PaymentEscrow Upgrade ===");
        console.log("Proxy Address:", proxyAddress);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy new implementation
        PaymentEscrow newImplementation = new PaymentEscrow();
        console.log("New Implementation:", address(newImplementation));
        
        // 2. Upgrade proxy
        PaymentEscrow proxy = PaymentEscrow(proxyAddress);
        proxy.upgradeToAndCall(address(newImplementation), "");
        
        console.log("Upgrade complete!");
        console.log("New Version:", proxy.version());
        
        vm.stopBroadcast();
    }
}
