// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/PriceOracle.sol";
import "../src/PaymentEscrow.sol";
import "../src/MultiTokenPayment.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DeployPaymentSystem
 * @notice Deployment script for multi-currency payment system contracts
 * @dev Deploys PriceOracle, PaymentEscrow, and MultiTokenPayment with UUPS proxies
 */
contract DeployPaymentSystem is Script {
    // Deployment addresses will be logged
    address public priceOracleProxy;
    address public paymentEscrowProxy;
    address public multiTokenPaymentProxy;

    function run() external {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address rwaToken = vm.envAddress("RWA_TOKEN_ADDRESS");
        address investmentManager = vm.envAddress("INVESTMENT_MANAGER_ADDRESS");

        console.log("=== Deploying Multi-Currency Payment System ===");
        console.log("Admin:", admin);
        console.log("Treasury:", treasury);
        console.log("RWA Token:", rwaToken);
        console.log("Investment Manager:", investmentManager);

        vm.startBroadcast(deployerPrivateKey);

        // ============================================
        // 1. Deploy PriceOracle
        // ============================================
        console.log("\n1. Deploying PriceOracle...");
        
        PriceOracle priceOracleImplementation = new PriceOracle();
        console.log("PriceOracle Implementation:", address(priceOracleImplementation));

        bytes memory priceOracleInitData = abi.encodeWithSelector(
            PriceOracle.initialize.selector,
            admin
        );

        ERC1967Proxy priceOracleProxyContract = new ERC1967Proxy(
            address(priceOracleImplementation),
            priceOracleInitData
        );
        priceOracleProxy = address(priceOracleProxyContract);
        console.log("PriceOracle Proxy:", priceOracleProxy);

        // ============================================
        // 2. Deploy PaymentEscrow
        // ============================================
        console.log("\n2. Deploying PaymentEscrow...");
        
        PaymentEscrow escrowImplementation = new PaymentEscrow();
        console.log("PaymentEscrow Implementation:", address(escrowImplementation));

        bytes memory escrowInitData = abi.encodeWithSelector(
            PaymentEscrow.initialize.selector,
            admin,
            treasury
        );

        ERC1967Proxy escrowProxyContract = new ERC1967Proxy(
            address(escrowImplementation),
            escrowInitData
        );
        paymentEscrowProxy = address(escrowProxyContract);
        console.log("PaymentEscrow Proxy:", paymentEscrowProxy);

        // ============================================
        // 3. Deploy MultiTokenPayment
        // ============================================
        console.log("\n3. Deploying MultiTokenPayment...");
        
        MultiTokenPayment multiTokenImplementation = new MultiTokenPayment();
        console.log("MultiTokenPayment Implementation:", address(multiTokenImplementation));

        bytes memory multiTokenInitData = abi.encodeWithSelector(
            MultiTokenPayment.initialize.selector,
            admin,
            priceOracleProxy,
            investmentManager,
            treasury,
            rwaToken
        );

        ERC1967Proxy multiTokenProxyContract = new ERC1967Proxy(
            address(multiTokenImplementation),
            multiTokenInitData
        );
        multiTokenPaymentProxy = address(multiTokenProxyContract);
        console.log("MultiTokenPayment Proxy:", multiTokenPaymentProxy);

        // ============================================
        // 4. Configure Supported Tokens
        // ============================================
        console.log("\n4. Configuring supported payment tokens...");
        
        MultiTokenPayment multiToken = MultiTokenPayment(payable(multiTokenPaymentProxy));
        
        // Add ETH (address(0))
        console.log("Adding ETH support...");
        multiToken.addSupportedToken(
            address(0),
            "ETH",
            18,
            "ETH/USD"
        );

        // Add USDC
        address usdc = vm.envOr("USDC_ADDRESS", address(0));
        if (usdc != address(0)) {
            console.log("Adding USDC support...");
            multiToken.addSupportedToken(
                usdc,
                "USDC",
                6,
                "USDC/USD"
            );
        }

        // Add USDT
        address usdt = vm.envOr("USDT_ADDRESS", address(0));
        if (usdt != address(0)) {
            console.log("Adding USDT support...");
            multiToken.addSupportedToken(
                usdt,
                "USDT",
                6,
                "USDT/USD"
            );
        }

        // Add RWAP
        console.log("Adding RWAP support...");
        multiToken.addSupportedToken(
            rwaToken,
            "RWAP",
            18,
            "RWAP/USD"
        );

        // ============================================
        // 5. Configure Chainlink Price Feeds (Testnet)
        // ============================================
        console.log("\n5. Configuring Chainlink price feeds...");
        
        PriceOracle oracle = PriceOracle(priceOracleProxy);
        
        // Sepolia testnet Chainlink feeds
        uint256 chainId = block.chainid;
        if (chainId == 11155111) { // Sepolia
            console.log("Configuring Sepolia testnet feeds...");
            
            // ETH/USD
            oracle.setPriceFeed(
                "ETH/USD",
                0x694AA1769357215DE4FAC081bf1f309aDC325306,
                3600
            );
            
            // USDC/USD
            oracle.setPriceFeed(
                "USDC/USD",
                0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E,
                86400
            );
        }

        // ============================================
        // 6. Set Initial Exchange Rates (Manual)
        // ============================================
        console.log("\n6. Setting initial exchange rates...");
        
        // USD to other fiat currencies (18 decimals)
        oracle.updateExchangeRate("USD", "PKR", 277890000000000000000, "manual"); // 277.89 PKR
        oracle.updateExchangeRate("USD", "AED", 3670000000000000000, "manual");   // 3.67 AED
        oracle.updateExchangeRate("USD", "EUR", 920000000000000000, "manual");    // 0.92 EUR
        oracle.updateExchangeRate("USD", "GBP", 790000000000000000, "manual");    // 0.79 GBP

        vm.stopBroadcast();

        // ============================================
        // 7. Save Deployment Addresses
        // ============================================
        console.log("\n=== Deployment Complete ===");
        console.log("\nProxy Addresses (use these in backend config):");
        console.log("PRICE_ORACLE_ADDRESS=", priceOracleProxy);
        console.log("PAYMENT_ESCROW_ADDRESS=", paymentEscrowProxy);
        console.log("MULTI_TOKEN_PAYMENT_ADDRESS=", multiTokenPaymentProxy);
        
        console.log("\nAdd these to backend/services/web3/addresses.json");
        
        // Write to file for config-manager.js to pick up
        string memory json = string(abi.encodePacked(
            '{\n',
            '  "PriceOracle": "', vm.toString(priceOracleProxy), '",\n',
            '  "PaymentEscrow": "', vm.toString(paymentEscrowProxy), '",\n',
            '  "MultiTokenPayment": "', vm.toString(multiTokenPaymentProxy), '"\n',
            '}'
        ));
        
        // vm.writeFile("deployment-payment-system.json", json);
        // console.log("\nAddresses saved to deployment-payment-system.json");
    }
}
