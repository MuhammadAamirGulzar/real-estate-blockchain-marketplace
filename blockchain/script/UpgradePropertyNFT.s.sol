// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/PropertyNFT.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";

contract UpgradePropertyNFT is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("PROPERTY_NFT_ADDRESS");
        
        console.log("=== PropertyNFT Upgrade ===");
        console.log("Proxy Address:", proxyAddress);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy new implementation
        PropertyNFT newImplementation = new PropertyNFT();
        console.log("New Implementation:", address(newImplementation));
        
        // 2. Upgrade proxy
        PropertyNFT proxy = PropertyNFT(proxyAddress);
        proxy.upgradeToAndCall(address(newImplementation), "");
        
        console.log("Upgrade complete!");
        console.log("New Version:", proxy.version());
        
        vm.stopBroadcast();
    }
}