// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/SecondaryMarket.sol";

// Minimal interface to access upgradeToAndCall() on the proxy
interface IUUPSProxy {
    function upgradeToAndCall(address newImplementation, bytes memory data) external payable;
}

contract UpgradeSecondaryMarket is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("SECONDARY_MARKET_PROXY");
        address propertyNFT = vm.envOr("PROPERTY_NFT_ADDRESS", address(0));
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy new implementation
        SecondaryMarket newImplementation = new SecondaryMarket();
        console.log("New SecondaryMarket Implementation deployed at:", address(newImplementation));
        
        // Use the interface to call upgradeToAndCall() on the proxy
        IUUPSProxy proxy = IUUPSProxy(proxyAddress);
        proxy.upgradeToAndCall(address(newImplementation), "");
        console.log("SecondaryMarket upgraded successfully");
        
        // Verify upgrade
        SecondaryMarket upgraded = SecondaryMarket(payable(proxyAddress));
        if (propertyNFT != address(0)) {
            upgraded.setPropertyNFT(propertyNFT);
            console.log("Property NFT set to:", propertyNFT);
        }
        console.log("Current version:", upgraded.version());
        console.log("Trading fee:", upgraded.tradingFee());
        
        vm.stopBroadcast();
    }
}
