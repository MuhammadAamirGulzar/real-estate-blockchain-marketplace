// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/InvestmentManager.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployInvestmentManager is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        address propertyNFTAddress = vm.envAddress("PROPERTY_NFT_ADDRESS");
        address RWATokenAddress = vm.envAddress("RWA_TOKEN_ADDRESS");
        address kycRegistryAddress = vm.envAddress("KYC_REGISTRY_ADDRESS");
        
        console.log("=== InvestmentManager Deployment ===");
        console.log("Deployer:", deployer);
        console.log("PropertyNFT:", propertyNFTAddress);
        console.log("RWAToken:", RWATokenAddress);
        console.log("KYCRegistry:", kycRegistryAddress);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy implementation
        InvestmentManager implementation = new InvestmentManager();
        console.log("\n1. Implementation deployed:", address(implementation));
        
        // 2. Deploy proxy
        bytes memory initData = abi.encodeWithSelector(
            InvestmentManager.initialize.selector,
            deployer,             // admin
            propertyNFTAddress,
            RWATokenAddress,
            kycRegistryAddress,
            deployer              // treasury
        );
        
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        console.log("2. Proxy deployed:", address(proxy));
        
        InvestmentManager investmentManager = InvestmentManager(address(proxy));
        
        // 3. Verification
        console.log("\n=== Verification ===");
        console.log("Version:", investmentManager.version());
        console.log("Treasury:", investmentManager.treasury());
        
        vm.stopBroadcast();
        
        console.log("\n=== Add to .env ===");
        console.log("INVESTMENT_MANAGER_ADDRESS=", address(proxy));
    }
}