// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/SecondaryMarket.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeploySecondaryMarket is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address rwaToken = vm.envAddress("RWA_TOKEN_ADDRESS");
        address kycRegistry = vm.envAddress("KYC_REGISTRY_ADDRESS");
        address assetRegistry = vm.envAddress("ASSET_REGISTRY_ADDRESS");
        address propertyNFT = vm.envOr("PROPERTY_NFT_ADDRESS", address(0));
        address feeCollector = vm.envAddress("FEE_COLLECTOR_ADDRESS");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy implementation
        SecondaryMarket implementation = new SecondaryMarket();
        console.log("SecondaryMarket Implementation deployed at:", address(implementation));
        
        // Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(
            SecondaryMarket.initialize.selector,
            admin,
            rwaToken,
            kycRegistry,
            assetRegistry,
            feeCollector
        );
        
        // Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        console.log("SecondaryMarket Proxy deployed at:", address(proxy));
        console.log("Admin set to:", admin);
        console.log("RWA Token:", rwaToken);
        console.log("KYC Registry:", kycRegistry);
        console.log("Asset Registry:", assetRegistry);
        console.log("Fee Collector:", feeCollector);
        
        // Verify deployment
        SecondaryMarket market = SecondaryMarket(payable(address(proxy)));
        if (propertyNFT != address(0)) {
            market.setPropertyNFT(propertyNFT);
            console.log("Property NFT set to:", propertyNFT);
        }
        console.log("Admin verified:", market.hasRole(market.DEFAULT_ADMIN_ROLE(), admin));
        console.log("Trading Fee:", market.tradingFee());
        console.log("Version:", market.version());
        
        vm.stopBroadcast();
    }
}