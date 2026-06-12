// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/RWAToken.sol";

interface IUUPSProxy {
    function upgradeTo(address newImplementation) external;
}

contract UpgradeRWAToken is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("RWA_TOKEN_PROXY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new implementation
        RWAToken newImplementation = new RWAToken();
        console.log("New RWAToken Implementation deployed at:", address(newImplementation));

        // Cast proxy to our minimal interface
        IUUPSProxy proxy = IUUPSProxy(proxyAddress);

        // Upgrade to new implementation
        proxy.upgradeTo(address(newImplementation));
        console.log("RWAToken upgraded successfully");

        // Verify upgrade
        RWAToken token = RWAToken(proxyAddress);
        console.log("Current version:", token.version());
        console.log("Token name:", token.name());

        vm.stopBroadcast();
    }
}
