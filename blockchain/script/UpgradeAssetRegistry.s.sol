// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AssetRegistry.sol";

interface IUUPSUpgradeableProxy {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}

contract UpgradeAssetRegistryScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("ASSET_REGISTRY_PROXY");

        vm.startBroadcast(deployerPrivateKey);

        AssetRegistry newImplementation = new AssetRegistry();
        IUUPSUpgradeableProxy(proxyAddress).upgradeToAndCall(address(newImplementation), "");

        vm.stopBroadcast();
    }
}
