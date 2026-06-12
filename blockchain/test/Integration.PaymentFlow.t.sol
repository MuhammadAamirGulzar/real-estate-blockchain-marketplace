// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/PriceOracle.sol";
import "../src/PaymentEscrow.sol";
import "../src/MultiTokenPayment.sol";
import "../src/InvestmentManager.sol";
import "../src/RoleManager.sol";
import "../src/KYCRegistry.sol";
import "../src/AssetRegistry.sol";
import "../src/PropertyNFT.sol";
import "../src/RWAToken.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@chainlink/contracts/v0.8/tests/MockV3Aggregator.sol";

/**
 * @title MockERC20Token
 * @notice Simple ERC20 token for testing
 */
contract MockERC20Token is ERC20 {
    uint8 private _decimals;
    
    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
        _mint(msg.sender, 10000000 * 10**decimals_);
    }
    
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title Integration_PaymentFlowTest
 * @notice End-to-end integration tests for the complete payment flow
 * @dev Tests the full workflow: User Investment → Payment → Escrow → Verification → Token Distribution
 */
contract Integration_PaymentFlowTest is Test {
    // Core contracts
    RoleManager public roleManager;
    KYCRegistry public kycRegistry;
    AssetRegistry public assetRegistry;
    PropertyNFT public propertyNFT;
    RWAToken public rwaToken;
    InvestmentManager public investmentManager;
    
    // Payment system contracts
    PriceOracle public priceOracle;
    PaymentEscrow public paymentEscrow;
    MultiTokenPayment public multiTokenPayment;
    
    // Mock tokens and oracles
    MockERC20Token public usdc;
    MockERC20Token public usdt;
    MockV3Aggregator public ethUSDFeed;
    MockV3Aggregator public rwapUSDFeed;
    MockV3Aggregator public usdcUSDFeed;
    
    // Test actors
    address public admin;
    address public subAdmin;
    address public verifier;
    address public propertyOwner;
    address public investor;
    address public treasury;
    
    // Test data
    uint256 public propertyId;
    uint256 constant PROPERTY_VALUATION = 500000e18; // $500,000
    uint256 constant INVESTMENT_AMOUNT = 10000e18;   // $10,000 worth
    
    function setUp() public {
        // Create test addresses
        admin = makeAddr("admin");
        subAdmin = makeAddr("subAdmin");
        verifier = makeAddr("verifier");
        propertyOwner = makeAddr("propertyOwner");
        investor = makeAddr("investor");
        treasury = makeAddr("treasury");
        
        // Fund actors
        vm.deal(investor, 100 ether);
        vm.deal(treasury, 10 ether);
        
        // Deploy mock price feeds
        ethUSDFeed = new MockV3Aggregator(8, 2000e8);     // $2000/ETH
        rwapUSDFeed = new MockV3Aggregator(8, 1e8);       // $1/RWAP
        usdcUSDFeed = new MockV3Aggregator(8, 1e8);       // $1/USDC
        
        // Deploy mock tokens
        usdc = new MockERC20Token("USD Coin", "USDC", 6);
        usdt = new MockERC20Token("Tether USD", "USDT", 6);
        
        // Deploy RoleManager
        RoleManager roleManagerImpl = new RoleManager();
        bytes memory roleManagerInit = abi.encodeWithSelector(RoleManager.initialize.selector, admin);
        ERC1967Proxy roleManagerProxy = new ERC1967Proxy(address(roleManagerImpl), roleManagerInit);
        roleManager = RoleManager(address(roleManagerProxy));
        
        // Verify admin has all required roles after initialization
        require(roleManager.hasRole(roleManager.DEFAULT_ADMIN_ROLE(), admin), "Admin missing DEFAULT_ADMIN_ROLE");
        require(roleManager.hasRole(roleManager.ADMIN_ROLE(), admin), "Admin missing ADMIN_ROLE");
        require(roleManager.hasRole(roleManager.SUB_ADMIN_ROLE(), admin), "Admin missing SUB_ADMIN_ROLE");
        
        // Grant roles to sub-admin and verifier
        vm.startPrank(admin);
        roleManager.grantRole(roleManager.SUB_ADMIN_ROLE(), subAdmin);
        roleManager.grantRole(roleManager.VERIFIER_ROLE(), verifier);
        vm.stopPrank();
        
        // Deploy KYCRegistry
        KYCRegistry kycImpl = new KYCRegistry();
        bytes memory kycInit = abi.encodeWithSelector(KYCRegistry.initialize.selector, address(roleManager));
        ERC1967Proxy kycProxy = new ERC1967Proxy(address(kycImpl), kycInit);
        kycRegistry = KYCRegistry(address(kycProxy));
        
        // Grant KYCRegistry the ability to grant USER_ROLE via grantRoleByAdmin
        // KYCRegistry.approveKYC() calls roleManager.grantRoleByAdmin(USER_ROLE, user)
        // grantRoleByAdmin requires caller to have SUB_ADMIN_ROLE
        vm.prank(admin);
        roleManager.grantRole(roleManager.SUB_ADMIN_ROLE(), address(kycRegistry));
        
        require(
            roleManager.hasRole(roleManager.SUB_ADMIN_ROLE(), address(kycRegistry)),
            "KYCRegistry missing SUB_ADMIN_ROLE"
        );
        
        // Deploy AssetRegistry
        AssetRegistry assetRegistryImpl = new AssetRegistry();
        bytes memory assetRegistryInit = abi.encodeWithSelector(
            AssetRegistry.initialize.selector,
            address(roleManager),
            address(kycRegistry)
        );
        ERC1967Proxy assetRegistryProxy = new ERC1967Proxy(address(assetRegistryImpl), assetRegistryInit);
        assetRegistry = AssetRegistry(address(assetRegistryProxy));
        
        // Deploy PropertyNFT
        PropertyNFT propertyNFTImpl = new PropertyNFT();
        bytes memory propertyNFTInit = abi.encodeWithSelector(
            PropertyNFT.initialize.selector,
            admin,
            address(assetRegistry)
        );
        ERC1967Proxy propertyNFTProxy = new ERC1967Proxy(address(propertyNFTImpl), propertyNFTInit);
        propertyNFT = PropertyNFT(address(propertyNFTProxy));
        
        // Deploy RWAToken
        RWAToken rwaTokenImpl = new RWAToken();
        bytes memory rwaTokenInit = abi.encodeWithSelector(
            RWAToken.initialize.selector,
            admin,
            treasury,
            10000000e18,  // initialSupply: 10M tokens
            100000000e18  // maxSupply: 100M tokens
        );
        ERC1967Proxy rwaTokenProxy = new ERC1967Proxy(address(rwaTokenImpl), rwaTokenInit);
        rwaToken = RWAToken(address(rwaTokenProxy));
        
        // Deploy InvestmentManager
        InvestmentManager investmentManagerImpl = new InvestmentManager();
        bytes memory investmentManagerInit = abi.encodeWithSelector(
            InvestmentManager.initialize.selector,
            admin,
            address(propertyNFT),
            address(rwaToken),
            address(kycRegistry),
            treasury
        );
        ERC1967Proxy investmentManagerProxy = new ERC1967Proxy(address(investmentManagerImpl), investmentManagerInit);
        investmentManager = InvestmentManager(address(investmentManagerProxy));
        
        // Deploy PriceOracle
        PriceOracle priceOracleImpl = new PriceOracle();
        bytes memory priceOracleInit = abi.encodeWithSelector(PriceOracle.initialize.selector, admin);
        ERC1967Proxy priceOracleProxy = new ERC1967Proxy(address(priceOracleImpl), priceOracleInit);
        priceOracle = PriceOracle(address(priceOracleProxy));
        
        // Deploy PaymentEscrow
        PaymentEscrow paymentEscrowImpl = new PaymentEscrow();
        bytes memory paymentEscrowInit = abi.encodeWithSelector(
            PaymentEscrow.initialize.selector,
            admin,
            treasury
        );
        ERC1967Proxy paymentEscrowProxy = new ERC1967Proxy(address(paymentEscrowImpl), paymentEscrowInit);
        paymentEscrow = PaymentEscrow(payable(address(paymentEscrowProxy)));
        
        // Deploy MultiTokenPayment
        MultiTokenPayment multiTokenPaymentImpl = new MultiTokenPayment();
        bytes memory multiTokenPaymentInit = abi.encodeWithSelector(
            MultiTokenPayment.initialize.selector,
            admin,
            address(priceOracle),
            address(investmentManager),
            treasury,
            address(rwaToken)
        );
        ERC1967Proxy multiTokenPaymentProxy = new ERC1967Proxy(address(multiTokenPaymentImpl), multiTokenPaymentInit);
        multiTokenPayment = MultiTokenPayment(payable(address(multiTokenPaymentProxy)));
        
        // Setup price feeds in PriceOracle
        vm.startPrank(admin);
        priceOracle.setPriceFeed("ETH/USD", address(ethUSDFeed), 3600);
        priceOracle.setPriceFeed("RWAP/USD", address(rwapUSDFeed), 3600);
        priceOracle.setPriceFeed("USDC/USD", address(usdcUSDFeed), 3600);
        vm.stopPrank();
        
        // Setup supported tokens in MultiTokenPayment
        vm.startPrank(admin);
        multiTokenPayment.addSupportedToken(address(0), "ETH", 18, "ETH/USD");
        multiTokenPayment.addSupportedToken(address(usdc), "USDC", 6, "USDC/USD");
        multiTokenPayment.addSupportedToken(address(rwaToken), "RWAP", 18, "RWAP/USD");
        vm.stopPrank();
        
        // Fund test tokens to investor
        usdc.mint(investor, 1000000e6);
        // Transfer RWAP tokens from treasury (which received initial supply) to investor
        vm.prank(treasury);
        rwaToken.transfer(investor, 1000000e18);
        
        // Setup property and approve KYC
        setupPropertyAndKYC();
    }
    
    function setupPropertyAndKYC() internal {
        // Property owner KYC
        vm.prank(propertyOwner);
        kycRegistry.submitKYC("QmPropertyOwner");
        vm.prank(admin);
        kycRegistry.approveKYC(propertyOwner);
        
        // Investor KYC
        vm.prank(investor);
        kycRegistry.submitKYC("QmInvestor");
        vm.prank(admin);
        kycRegistry.approveKYC(investor);
        
        // List property in AssetRegistry
        vm.prank(propertyOwner);
        uint256 assetRegistryId = assetRegistry.listProperty("QmPropertyMetadata");
        
        // Assign verifier
        vm.prank(admin);
        assetRegistry.assignVerifier(assetRegistryId, verifier);
        
        // Verify property
        vm.prank(verifier);
        assetRegistry.verifyProperty(assetRegistryId);
        
        // Mint PropertyNFT after verification
        vm.prank(admin);
        propertyId = propertyNFT.mintProperty(
            propertyOwner,
            assetRegistryId,
            "ipfs://QmPropertyNFT",
            address(rwaToken),
            1000000e18,
            PROPERTY_VALUATION
        );
        
        // Update property price in oracle
        vm.prank(admin);
        priceOracle.updatePropertyPrice(propertyId, PROPERTY_VALUATION, "admin");
    }
    
    // ==================== INTEGRATION TEST SCENARIOS ====================
    
    /**
     * @notice Test complete ETH payment flow
     */
    function test_Integration_ETHPaymentFlow() public {
        uint256 ethAmount = 5 ether;
        uint256 expectedRWAP = 10000e18;
        
        vm.prank(investor);
        uint256 paymentId = multiTokenPayment.processETHPayment{value: ethAmount}(propertyId);
        
        MultiTokenPayment.PaymentRecord memory payment = multiTokenPayment.getPayment(paymentId);
        assertEq(payment.payer, investor);
        assertEq(payment.paymentAmount, ethAmount);
        assertEq(payment.rwaEquivalent, expectedRWAP);
        assertEq(payment.propertyNftId, propertyId);
        assertEq(treasury.balance, 10 ether + ethAmount);
    }
    
    /**
     * @notice Test USDC payment with decimal normalization
     */
    function test_Integration_USDCPaymentFlow() public {
        uint256 usdcAmount = 10000e6;
        uint256 expectedRWAP = 10000e18;
        
        vm.startPrank(investor);
        usdc.approve(address(multiTokenPayment), usdcAmount);
        uint256 paymentId = multiTokenPayment.processTokenPayment(address(usdc), usdcAmount, propertyId);
        vm.stopPrank();
        
        MultiTokenPayment.PaymentRecord memory payment = multiTokenPayment.getPayment(paymentId);
        assertEq(payment.rwaEquivalent, expectedRWAP);
        assertEq(payment.paymentMethod, "USDC");
        assertEq(usdc.balanceOf(treasury), usdcAmount);
    }
    
    /**
     * @notice Test escrow flow with verification
     */
    function test_Integration_EscrowFlowWithVerification() public {
        uint256 escrowAmount = 10000e18;
        uint256 investmentId = 1;
        
        vm.startPrank(investor);
        rwaToken.approve(address(paymentEscrow), escrowAmount);
        uint256 escrowId = paymentEscrow.createEscrow(
            address(investmentManager),
            address(rwaToken),
            escrowAmount,
            investmentId,
            "bank_transfer"
        );
        vm.stopPrank();
        
        PaymentEscrow.Escrow memory escrow = paymentEscrow.getEscrow(escrowId);
        assertEq(escrow.depositor, investor);
        assertEq(escrow.amount, escrowAmount);
        assertEq(uint(escrow.status), uint(PaymentEscrow.EscrowStatus.Active));
        
        vm.prank(admin);
        paymentEscrow.completeEscrow(escrowId);
        
        escrow = paymentEscrow.getEscrow(escrowId);
        assertEq(uint(escrow.status), uint(PaymentEscrow.EscrowStatus.Completed));
        assertEq(rwaToken.balanceOf(address(investmentManager)), escrowAmount);
    }
    
    /**
     * @notice Test escrow expiry and auto-refund
     */
    function test_Integration_EscrowExpiryFlow() public {
        uint256 escrowAmount = 5000e18;
        uint256 investmentId = 2;
        
        vm.startPrank(investor);
        rwaToken.approve(address(paymentEscrow), escrowAmount);
        uint256 escrowId = paymentEscrow.createEscrow(
            address(investmentManager),
            address(rwaToken),
            escrowAmount,
            investmentId,
            "bank_transfer"
        );
        vm.stopPrank();
        
        uint256 investorBalanceBefore = rwaToken.balanceOf(investor);
        
        vm.warp(block.timestamp + 7 days + 1);
        
        address randomUser = makeAddr("random");
        vm.prank(randomUser);
        paymentEscrow.claimExpiredEscrow(escrowId);
        
        assertEq(rwaToken.balanceOf(investor), investorBalanceBefore + escrowAmount);
        
        PaymentEscrow.Escrow memory escrow = paymentEscrow.getEscrow(escrowId);
        assertEq(uint(escrow.status), uint(PaymentEscrow.EscrowStatus.Expired));
    }
    
    /**
     * @notice Test price anomaly detection
     */
    function test_Integration_PriceAnomalyDetection() public {
        uint256 initialPrice = PROPERTY_VALUATION;
        uint256 newPrice = (initialPrice * 140) / 100;
        
        vm.expectEmit(address(priceOracle));
        emit PriceOracle.PriceAnomalyDetected(propertyId, newPrice, initialPrice, 40e16);
        
        vm.prank(admin);
        priceOracle.updatePropertyPrice(propertyId, newPrice, "api");
        
        (uint256 price, , ) = priceOracle.getLatestPropertyPrice(propertyId);
        assertEq(price, newPrice);
    }
    
    /**
     * @notice Test admin manual price override
     */
    function test_Integration_ManualPriceOverride() public {
        uint256 overridePrice = 450000e18;
        string memory reason = "Fraud detected - inflated valuation";
        
        vm.prank(admin);
        priceOracle.manualPriceOverride(propertyId, overridePrice, reason);
        
        (uint256 price, , string memory source) = priceOracle.getLatestPropertyPrice(propertyId);
        assertEq(price, overridePrice);
        assertEq(source, "admin_override");
    }
    
    /**
     * @notice Test currency conversion
     */
    function test_Integration_CurrencyConversion() public {
        uint256 pkrRate = 277_890000000000000000;
        
        vm.prank(admin);
        priceOracle.updateExchangeRate("USD", "PKR", pkrRate, "api");
        
        uint256 usdAmount = 1000e18;
        uint256 pkrAmount = priceOracle.convertCurrency(usdAmount, "USD", "PKR");
        
        assertEq(pkrAmount, 277890e18);
    }
    
    /**
     * @notice Test multiple payments from same user
     */
    function test_Integration_MultiplePaymentsFlow() public {
        vm.startPrank(investor);
        
        multiTokenPayment.processETHPayment{value: 2 ether}(propertyId);
        
        usdc.approve(address(multiTokenPayment), 5000e6);
        multiTokenPayment.processTokenPayment(address(usdc), 5000e6, propertyId);
        
        rwaToken.approve(address(multiTokenPayment), 3000e18);
        multiTokenPayment.processRWAPPayment(3000e18, propertyId);
        
        vm.stopPrank();
        
        uint256[] memory userPayments = multiTokenPayment.getUserPayments(investor);
        assertEq(userPayments.length, 3);
        assertEq(multiTokenPayment.paymentCounter(), 3);
    }
    
    /**
     * @notice Test stale oracle price detection
     */
    function test_Integration_StaleOraclePriceReverts() public {
        vm.warp(block.timestamp + 3601);
        
        vm.prank(investor);
        vm.expectRevert(PriceOracle.PriceOracle__StalePrice.selector);
        multiTokenPayment.processETHPayment{value: 1 ether}(propertyId);
    }
    
    /**
     * @notice Test end-to-end flow
     */
    function test_Integration_CompleteEndToEndFlow() public {
        vm.prank(investor);
        uint256 paymentId = multiTokenPayment.processETHPayment{value: 5 ether}(propertyId);
        
        MultiTokenPayment.PaymentRecord memory payment = multiTokenPayment.getPayment(paymentId);
        assertTrue(payment.paymentId > 0);
        assertEq(payment.propertyNftId, propertyId);
        assertEq(treasury.balance, 10 ether + 5 ether);
        assertTrue(payment.investmentId > 0);
    }
}
