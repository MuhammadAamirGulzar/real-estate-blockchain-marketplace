// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/RevenueDistributor.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployRevenueDistributor is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address rwaToken = vm.envAddress("RWA_TOKEN_ADDRESS");
        address assetRegistry = vm.envAddress("ASSET_REGISTRY_ADDRESS");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy implementation
        RevenueDistributor implementation = new RevenueDistributor();
        console.log("RevenueDistributor Implementation deployed at:", address(implementation));

        // Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(
            RevenueDistributor.initialize.selector,
            admin,
            rwaToken,
            assetRegistry
        );
        
        // Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        console.log("RevenueDistribution Proxy deployed at:", address(proxy));
        console.log("Admin set to:", admin);
        console.log("RWA Token:", rwaToken);
        console.log("Asset Registry:", assetRegistry);
        
        // Verify deployment
        RevenueDistributor revenueDistributor = RevenueDistributor(payable(address(proxy)));
        console.log("Admin verified:", revenueDistributor.hasRole(revenueDistributor.DEFAULT_ADMIN_ROLE(), admin));
        console.log("Minimum Distribution:", revenueDistributor.minimumDistribution());
        console.log("Distribution Fee:", revenueDistributor.distributionFee());
        console.log("Version:", revenueDistributor.version());

        vm.stopBroadcast();
    }
}