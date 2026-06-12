// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/RevenueDistributor.sol";

interface IUUPSProxy {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}

contract UpgradeRevenueDistributor is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address proxyAddr = vm.envAddress("REVENUE_DISTRIBUTOR_PROXY");

        vm.startBroadcast(pk);

        RevenueDistributor newImpl = new RevenueDistributor();
        IUUPSProxy(proxyAddr).upgradeToAndCall(address(newImpl), "");

        RevenueDistributor distributor = RevenueDistributor(payable(proxyAddr));
        console.log("Current version:", distributor.version());
        console.log("Distribution fee:", distributor.distributionFee());

        vm.stopBroadcast();
    }
}
