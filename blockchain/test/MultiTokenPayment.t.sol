// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MultiTokenPayment.sol";
import "../src/PriceOracle.sol";
import "../src/InvestmentManager.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@chainlink/contracts/v0.8/tests/MockV3Aggregator.sol";

/**
 * @title MockERC20
 * @notice Mock ERC20 token for testing
 */
contract MockERC20 is ERC20 {
    uint8 private _decimals;
    
    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
        _mint(msg.sender, 1000000 * 10**decimals_);
    }
    
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title MockInvestmentManager
 * @notice Minimal mock for InvestmentManager to test MultiTokenPayment
 */
contract MockInvestmentManager {
    uint256 public investmentCounter;
    
    event InvestmentCreated(uint256 investmentId, address investor, uint256 propertyId, uint256 amount);
    
    function invest(uint256 propertyId, uint256 amount) external returns (uint256) {
        investmentCounter++;
        emit InvestmentCreated(investmentCounter, msg.sender, propertyId, amount);
        return investmentCounter;
    }
}

/**
 * @title MultiTokenPaymentTest
 * @notice Comprehensive test suite for MultiTokenPayment contract
 * @dev Tests multi-token payments, price conversions, decimal normalization, and oracle integration
 */
contract MultiTokenPaymentTest is Test {
    MultiTokenPayment public multiTokenPayment;
    PriceOracle public priceOracle;
    MockInvestmentManager public investmentManager;
    
    MockERC20 public rwap;           // 18 decimals
    MockERC20 public usdc;           // 6 decimals
    MockERC20 public usdt;           // 6 decimals
    MockV3Aggregator public ethUSDFeed;
    MockV3Aggregator public rwapUSDFeed;
    MockV3Aggregator public usdcUSDFeed;
    MockV3Aggregator public usdtUSDFeed;
    
    address public admin;
    address public paymentManager;
    address public user;
    address public treasury;
    address public unauthorized;
    
    // Constants
    uint8 constant ETH_DECIMALS = 18;
    uint8 constant USDC_DECIMALS = 6;
    uint8 constant USDT_DECIMALS = 6;
    uint8 constant RWAP_DECIMALS = 18;
    
    int256 constant ETH_PRICE = 2000e8;    // $2000 (8 decimals)
    int256 constant RWAP_PRICE = 1e8;      // $1 (8 decimals)
    int256 constant USDC_PRICE = 1e8;      // $1 (8 decimals)
    int256 constant USDT_PRICE = 1e8;      // $1 (8 decimals)
    
    uint256 constant PROPERTY_ID = 1;
    uint256 constant HEARTBEAT = 3600;
    
    // Events
    event TokenAdded(address indexed tokenAddress, string symbol, string priceFeed);
    event TokenUpdated(address indexed tokenAddress, bool isActive);
    event PaymentProcessed(
        uint256 indexed paymentId,
        address indexed payer,
        address paymentToken,
        uint256 paymentAmount,
        uint256 rwaEquivalent,
        uint256 propertyNftId
    );
    event PriceOracleUpdated(address indexed newOracle);
    event InvestmentManagerUpdated(address indexed newManager);
    event TreasuryUpdated(address indexed newTreasury);
    
    function setUp() public {
        // Create test addresses
        admin = makeAddr("admin");
        paymentManager = makeAddr("paymentManager");
        user = makeAddr("user");
        treasury = makeAddr("treasury");
        unauthorized = makeAddr("unauthorized");
        
        // Deploy mock tokens
        rwap = new MockERC20("RWA Token", "RWAP", RWAP_DECIMALS);
        usdc = new MockERC20("USD Coin", "USDC", USDC_DECIMALS);
        usdt = new MockERC20("Tether USD", "USDT", USDT_DECIMALS);
        
        // Deploy mock Chainlink price feeds
        ethUSDFeed = new MockV3Aggregator(8, ETH_PRICE);
        rwapUSDFeed = new MockV3Aggregator(8, RWAP_PRICE);
        usdcUSDFeed = new MockV3Aggregator(8, USDC_PRICE);
        usdtUSDFeed = new MockV3Aggregator(8, USDT_PRICE);
        
        // Deploy PriceOracle
        PriceOracle priceOracleImpl = new PriceOracle();
        bytes memory priceOracleInit = abi.encodeWithSelector(
            PriceOracle.initialize.selector,
            admin
        );
        ERC1967Proxy priceOracleProxy = new ERC1967Proxy(address(priceOracleImpl), priceOracleInit);
        priceOracle = PriceOracle(address(priceOracleProxy));
        
        // Deploy MockInvestmentManager
        investmentManager = new MockInvestmentManager();
        
        // Deploy MultiTokenPayment
        MultiTokenPayment multiTokenPaymentImpl = new MultiTokenPayment();
        bytes memory multiTokenPaymentInit = abi.encodeWithSelector(
            MultiTokenPayment.initialize.selector,
            admin,
            address(priceOracle),
            address(investmentManager),
            treasury,
            address(rwap)
        );
        ERC1967Proxy multiTokenPaymentProxy = new ERC1967Proxy(
            address(multiTokenPaymentImpl),
            multiTokenPaymentInit
        );
        multiTokenPayment = MultiTokenPayment(payable(address(multiTokenPaymentProxy)));
        
        // Grant roles
        vm.startPrank(admin);
        multiTokenPayment.grantRole(multiTokenPayment.PAYMENT_MANAGER_ROLE(), paymentManager);
        
        // Setup price feeds in oracle
        priceOracle.setPriceFeed("ETH/USD", address(ethUSDFeed), HEARTBEAT);
        priceOracle.setPriceFeed("RWAP/USD", address(rwapUSDFeed), HEARTBEAT);
        priceOracle.setPriceFeed("USDC/USD", address(usdcUSDFeed), HEARTBEAT);
        priceOracle.setPriceFeed("USDT/USD", address(usdtUSDFeed), HEARTBEAT);

        // FIX: Add RWAP as a supported token (required for price calculations)
        multiTokenPayment.addSupportedToken(address(rwap), "RWAP", RWAP_DECIMALS, "RWAP/USD");

        vm.stopPrank();
        
        // Fund user
        rwap.mint(user, 1000000e18);
        usdc.mint(user, 1000000e6);
        usdt.mint(user, 1000000e6);
        vm.deal(user, 100 ether);
    }
    
    // ==================== INITIALIZATION TESTS ====================
    
    function test_Initialize() public view {
        assertEq(address(multiTokenPayment.priceOracle()), address(priceOracle));
        assertEq(address(multiTokenPayment.investmentManager()), address(investmentManager));
        assertEq(multiTokenPayment.treasury(), treasury);
        assertEq(multiTokenPayment.rwaTokenAddress(), address(rwap));
        assertEq(multiTokenPayment.paymentCounter(), 0);
        assertTrue(multiTokenPayment.hasRole(multiTokenPayment.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(multiTokenPayment.hasRole(multiTokenPayment.PAYMENT_MANAGER_ROLE(), admin));
    }
    
    function test_RevertWhen_InitializeWithZeroAddress() public {
        MultiTokenPayment impl = new MultiTokenPayment();
        
        bytes memory initData = abi.encodeWithSelector(
            MultiTokenPayment.initialize.selector,
            address(0),
            address(priceOracle),
            address(investmentManager),
            treasury,
            address(rwap)
        );
        
        vm.expectRevert(MultiTokenPayment.MultiTokenPayment__InvalidAddress.selector);
        new ERC1967Proxy(address(impl), initData);
    }
    
    // ==================== TOKEN MANAGEMENT TESTS ====================
    
    function test_AddSupportedToken() public {
        vm.prank(paymentManager);
        vm.expectEmit(address(multiTokenPayment));
        emit TokenAdded(address(usdc), "USDC", "USDC/USD");
        
        multiTokenPayment.addSupportedToken(address(usdc), "USDC", USDC_DECIMALS, "USDC/USD");
        
        // Verify token added
        (address tokenAddr, string memory symbol, bool isActive, uint8 decimals, string memory priceFeed) = 
            multiTokenPayment.supportedTokens(address(usdc));
        
        assertEq(tokenAddr, address(usdc));
        assertEq(symbol, "USDC");
        assertTrue(isActive);
        assertEq(decimals, USDC_DECIMALS);
        assertEq(priceFeed, "USDC/USD");
        
        // Verify in token list
        address[] memory tokens = multiTokenPayment.getSupportedTokens();
        assertEq(tokens.length, 2); // RWAP from setUp + USDC = 2
        assertEq(tokens[0], address(rwap)); // RWAP was added first
        assertEq(tokens[1], address(usdc)); // USDC is second
    }
    
    function test_AddMultipleSupportedTokens() public {
        vm.startPrank(paymentManager);
        
        multiTokenPayment.addSupportedToken(address(0), "ETH", ETH_DECIMALS, "ETH/USD");
        multiTokenPayment.addSupportedToken(address(usdc), "USDC", USDC_DECIMALS, "USDC/USD");
        multiTokenPayment.addSupportedToken(address(usdt), "USDT", USDT_DECIMALS, "USDT/USD");
        multiTokenPayment.addSupportedToken(address(rwap), "RWAP", RWAP_DECIMALS, "RWAP/USD");
        
        vm.stopPrank();
        
        address[] memory tokens = multiTokenPayment.getSupportedTokens();
        assertEq(tokens.length, 4);
    }
    
    function test_ToggleToken() public {
        // Add token first
        vm.prank(paymentManager);
        multiTokenPayment.addSupportedToken(address(usdc), "USDC", USDC_DECIMALS, "USDC/USD");
        
        // Toggle off
        vm.prank(paymentManager);
        vm.expectEmit(address(multiTokenPayment));
        emit TokenUpdated(address(usdc), false);
        
        multiTokenPayment.toggleToken(address(usdc), false);
        assertFalse(multiTokenPayment.isTokenSupported(address(usdc)));
        
        // Toggle back on
        vm.prank(paymentManager);
        multiTokenPayment.toggleToken(address(usdc), true);
        assertTrue(multiTokenPayment.isTokenSupported(address(usdc)));
    }
    
    function test_RevertWhen_ToggleUnsupportedToken() public {
        vm.prank(paymentManager);
        vm.expectRevert(MultiTokenPayment.MultiTokenPayment__TokenNotSupported.selector);
        multiTokenPayment.toggleToken(address(999), false);
    }
    
    function test_RevertWhen_AddSupportedTokenUnauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        multiTokenPayment.addSupportedToken(address(usdc), "USDC", USDC_DECIMALS, "USDC/USD");
    }
    
    // ==================== ETH PAYMENT TESTS ====================
    
    function test_ProcessETHPayment() public {
        // Setup ETH token
        vm.prank(paymentManager);
        multiTokenPayment.addSupportedToken(address(0), "ETH", ETH_DECIMALS, "ETH/USD");
        
        uint256 ethAmount = 1 ether;
        // ETH price: $2000, RWAP price: $1
        // Expected RWAP: 1 ETH * $2000 / $1 = 2000 RWAP
        uint256 expectedRWAP = 2000e18;
        
        uint256 treasuryBalanceBefore = treasury.balance;
        
        vm.prank(user);
        vm.expectEmit(address(multiTokenPayment));
        emit PaymentProcessed(1, user, address(0), ethAmount, expectedRWAP, PROPERTY_ID);
        
        uint256 paymentId = multiTokenPayment.processETHPayment{value: ethAmount}(PROPERTY_ID);
        
        // Verify payment created
        assertEq(paymentId, 1);
        assertEq(multiTokenPayment.paymentCounter(), 1);
        
        // Verify payment record
        MultiTokenPayment.PaymentRecord memory payment = multiTokenPayment.getPayment(paymentId);
        assertEq(payment.payer, user);
        assertEq(payment.paymentToken, address(0));
        assertEq(payment.paymentAmount, ethAmount);
        assertEq(payment.rwaEquivalent, expectedRWAP);
        assertEq(payment.propertyNftId, PROPERTY_ID);
        
        // Verify ETH transferred to treasury
        assertEq(treasury.balance, treasuryBalanceBefore + ethAmount);
    }
    
    function test_RevertWhen_ProcessETHPaymentWithZeroValue() public {
        vm.prank(paymentManager);
        multiTokenPayment.addSupportedToken(address(0), "ETH", ETH_DECIMALS, "ETH/USD");
        
        vm.prank(user);
        vm.expectRevert(MultiTokenPayment.MultiTokenPayment__InvalidAmount.selector);
        multiTokenPayment.processETHPayment{value: 0}(PROPERTY_ID);
    }
    
    function test_RevertWhen_ProcessETHPaymentNotSupported() public {
        // Don't add ETH as supported token
        
        vm.prank(user);
        vm.expectRevert(MultiTokenPayment.MultiTokenPayment__TokenNotSupported.selector);
        multiTokenPayment.processETHPayment{value: 1 ether}(PROPERTY_ID);
    }
    
    // ==================== TOKEN PAYMENT TESTS ====================
    
    function test_ProcessTokenPayment() public {
        // Setup USDC token
        vm.prank(paymentManager);
        multiTokenPayment.addSupportedToken(address(usdc), "USDC", USDC_DECIMALS, "USDC/USD");
        
        uint256 usdcAmount = 1000e6; // 1000 USDC
        // USDC price: $1, RWAP price: $1
        // Expected RWAP: 1000 USDC * $1 / $1 = 1000 RWAP
        uint256 expectedRWAP = 1000e18;
        
        vm.startPrank(user);
        usdc.approve(address(multiTokenPayment), usdcAmount);
        
        vm.expectEmit(address(multiTokenPayment));
        emit PaymentProcessed(1, user, address(usdc), usdcAmount, expectedRWAP, PROPERTY_ID);
        
        uint256 paymentId = multiTokenPayment.processTokenPayment(
            address(usdc),
            usdcAmount,
            PROPERTY_ID
        );
        
        vm.stopPrank();
        
        // Verify payment created
        assertEq(paymentId, 1);
        
        // Verify payment record
        MultiTokenPayment.PaymentRecord memory payment = multiTokenPayment.getPayment(paymentId);
        assertEq(payment.paymentAmount, usdcAmount);
        assertEq(payment.rwaEquivalent, expectedRWAP);
        assertEq(payment.paymentMethod, "USDC");
        
        // Verify USDC transferred to treasury
        assertEq(usdc.balanceOf(treasury), usdcAmount);
    }
    
    function test_ProcessTokenPaymentWithDifferentDecimals() public {
        // Setup USDT (6 decimals)
        vm.prank(paymentManager);
        multiTokenPayment.addSupportedToken(address(usdt), "USDT", USDT_DECIMALS, "USDT/USD");
        
        uint256 usdtAmount = 500e6; // 500 USDT (6 decimals)
        uint256 expectedRWAP = 500e18; // 500 RWAP (18 decimals)
        
        vm.startPrank(user);
        usdt.approve(address(multiTokenPayment), usdtAmount);
        
        uint256 paymentId = multiTokenPayment.processTokenPayment(
            address(usdt),
            usdtAmount,
            PROPERTY_ID
        );
        
        vm.stopPrank();
        
        // Verify decimal normalization worked
        MultiTokenPayment.PaymentRecord memory payment = multiTokenPayment.getPayment(paymentId);
        assertEq(payment.rwaEquivalent, expectedRWAP);
    }
    
    function test_RevertWhen_ProcessTokenPaymentWithZeroAmount() public {
        vm.prank(paymentManager);
        multiTokenPayment.addSupportedToken(address(usdc), "USDC", USDC_DECIMALS, "USDC/USD");
        
        vm.prank(user);
        vm.expectRevert(MultiTokenPayment.MultiTokenPayment__InvalidAmount.selector);
        multiTokenPayment.processTokenPayment(address(usdc), 0, PROPERTY_ID);
    }
    
    function test_RevertWhen_ProcessTokenPaymentNotSupported() public {
        vm.prank(user);
        vm.expectRevert(MultiTokenPayment.MultiTokenPayment__TokenNotSupported.selector);
        multiTokenPayment.processTokenPayment(address(usdc), 1000e6, PROPERTY_ID);
    }
    
    function test_RevertWhen_ProcessTokenPaymentWithoutApproval() public {
        vm.prank(paymentManager);
        multiTokenPayment.addSupportedToken(address(usdc), "USDC", USDC_DECIMALS, "USDC/USD");
        
        vm.prank(user);
        vm.expectRevert();
        multiTokenPayment.processTokenPayment(address(usdc), 1000e6, PROPERTY_ID);
    }
    
    // ==================== RWAP PAYMENT TESTS ====================
    
    function test_ProcessRWAPPayment() public {
        uint256 rwapAmount = 1000e18;
        
        vm.startPrank(user);
        rwap.approve(address(multiTokenPayment), rwapAmount);
        
        vm.expectEmit(address(multiTokenPayment));
        emit PaymentProcessed(1, user, address(rwap), rwapAmount, rwapAmount, PROPERTY_ID);
        
        uint256 paymentId = multiTokenPayment.processRWAPPayment(rwapAmount, PROPERTY_ID);
        
        vm.stopPrank();
        
        // Verify payment record
        MultiTokenPayment.PaymentRecord memory payment = multiTokenPayment.getPayment(paymentId);
        assertEq(payment.paymentAmount, rwapAmount);
        assertEq(payment.rwaEquivalent, rwapAmount); // No conversion for RWAP
        assertEq(payment.paymentMethod, "RWAP");
    }
    
    function test_RevertWhen_ProcessRWAPPaymentWithZeroAmount() public {
        vm.prank(user);
        vm.expectRevert(MultiTokenPayment.MultiTokenPayment__InvalidAmount.selector);
        multiTokenPayment.processRWAPPayment(0, PROPERTY_ID);
    }
    
    // ==================== PRICE CALCULATION TESTS ====================
    
    function test_CalculatePaymentEquivalent() public {
        // Setup tokens
        vm.startPrank(paymentManager);
        multiTokenPayment.addSupportedToken(address(0), "ETH", ETH_DECIMALS, "ETH/USD");
        multiTokenPayment.addSupportedToken(address(rwap), "RWAP", RWAP_DECIMALS, "RWAP/USD");
        vm.stopPrank();
        
        // ETH: $2000, RWAP: $1
        // 1 ETH should equal 2000 RWAP
        uint256 rwaEquivalent = multiTokenPayment.calculatePaymentEquivalent(address(0), 1 ether);
        assertEq(rwaEquivalent, 2000e18);
    }
    
    function test_CalculatePaymentEquivalentWithDifferentPrices() public {
        // Update ETH price to $3000
        ethUSDFeed.updateAnswer(3000e8);
        
        vm.startPrank(paymentManager);
        multiTokenPayment.addSupportedToken(address(0), "ETH", ETH_DECIMALS, "ETH/USD");
        multiTokenPayment.addSupportedToken(address(rwap), "RWAP", RWAP_DECIMALS, "RWAP/USD");
        vm.stopPrank();
        
        // 1 ETH should now equal 3000 RWAP
        uint256 rwaEquivalent = multiTokenPayment.calculatePaymentEquivalent(address(0), 1 ether);
        assertEq(rwaEquivalent, 3000e18);
    }
    
    function test_CalculatePaymentEquivalentWithDecimalNormalization() public {
        vm.startPrank(paymentManager);
        multiTokenPayment.addSupportedToken(address(usdc), "USDC", USDC_DECIMALS, "USDC/USD");
        multiTokenPayment.addSupportedToken(address(rwap), "RWAP", RWAP_DECIMALS, "RWAP/USD");
        vm.stopPrank();
        
        // 1000 USDC (6 decimals) = 1000 RWAP (18 decimals)
        uint256 rwaEquivalent = multiTokenPayment.calculatePaymentEquivalent(address(usdc), 1000e6);
        assertEq(rwaEquivalent, 1000e18);
    }
    
    // ==================== VIEW FUNCTION TESTS ====================
    
    function test_GetPayment() public {
        // Create a payment first
        vm.prank(paymentManager);
        multiTokenPayment.addSupportedToken(address(0), "ETH", ETH_DECIMALS, "ETH/USD");
        
        vm.prank(user);
        uint256 paymentId = multiTokenPayment.processETHPayment{value: 1 ether}(PROPERTY_ID);
        
        // Get payment
        MultiTokenPayment.PaymentRecord memory payment = multiTokenPayment.getPayment(paymentId);
        assertEq(payment.paymentId, paymentId);
        assertEq(payment.payer, user);
    }
    
    function test_GetUserPayments() public {
        vm.prank(paymentManager);
        multiTokenPayment.addSupportedToken(address(0), "ETH", ETH_DECIMALS, "ETH/USD");
        
        // Create multiple payments
        vm.startPrank(user);
        multiTokenPayment.processETHPayment{value: 1 ether}(PROPERTY_ID);
        multiTokenPayment.processETHPayment{value: 2 ether}(PROPERTY_ID);
        vm.stopPrank();
        
        uint256[] memory userPaymentsList = multiTokenPayment.getUserPayments(user);
        assertEq(userPaymentsList.length, 2);
        assertEq(userPaymentsList[0], 1);
        assertEq(userPaymentsList[1], 2);
    }
    
    function test_IsTokenSupported() public {
        assertFalse(multiTokenPayment.isTokenSupported(address(usdc)));
        
        vm.prank(paymentManager);
        multiTokenPayment.addSupportedToken(address(usdc), "USDC", USDC_DECIMALS, "USDC/USD");
        
        assertTrue(multiTokenPayment.isTokenSupported(address(usdc)));
    }
    
    // ==================== ADMIN FUNCTION TESTS ====================
    
    function test_SetPriceOracle() public {
        address newOracle = makeAddr("newOracle");
        
        // Deploy new oracle
        PriceOracle newOracleImpl = new PriceOracle();
        bytes memory initData = abi.encodeWithSelector(PriceOracle.initialize.selector, admin);
        ERC1967Proxy newOracleProxy = new ERC1967Proxy(address(newOracleImpl), initData);
        
        vm.prank(admin);
        vm.expectEmit(address(multiTokenPayment));
        emit PriceOracleUpdated(address(newOracleProxy));
        
        multiTokenPayment.setPriceOracle(address(newOracleProxy));
        
        assertEq(address(multiTokenPayment.priceOracle()), address(newOracleProxy));
    }
    
    function test_RevertWhen_SetPriceOracleToZero() public {
        vm.prank(admin);
        vm.expectRevert(MultiTokenPayment.MultiTokenPayment__InvalidAddress.selector);
        multiTokenPayment.setPriceOracle(address(0));
    }
    
    function test_SetInvestmentManager() public {
        MockInvestmentManager newManager = new MockInvestmentManager();
        
        vm.prank(admin);
        vm.expectEmit(address(multiTokenPayment));
        emit InvestmentManagerUpdated(address(newManager));
        
        multiTokenPayment.setInvestmentManager(address(newManager));
        
        assertEq(address(multiTokenPayment.investmentManager()), address(newManager));
    }
    
    function test_SetTreasury() public {
        address newTreasury = makeAddr("newTreasury");
        
        vm.prank(admin);
        vm.expectEmit(address(multiTokenPayment));
        emit TreasuryUpdated(newTreasury);
        
        multiTokenPayment.setTreasury(newTreasury);
        
        assertEq(multiTokenPayment.treasury(), newTreasury);
    }
    
    function test_RevertWhen_SetTreasuryToZero() public {
        vm.prank(admin);
        vm.expectRevert(MultiTokenPayment.MultiTokenPayment__InvalidAddress.selector);
        multiTokenPayment.setTreasury(address(0));
    }
    
    // ==================== PAUSABLE TESTS ====================
    
    function test_Pause() public {
        vm.prank(admin);
        multiTokenPayment.pause();
        assertTrue(multiTokenPayment.paused());
    }
    
    function test_Unpause() public {
        vm.startPrank(admin);
        multiTokenPayment.pause();
        multiTokenPayment.unpause();
        vm.stopPrank();
        
        assertFalse(multiTokenPayment.paused());
    }
    
    function test_RevertWhen_ProcessPaymentWhilePaused() public {
        vm.prank(paymentManager);
        multiTokenPayment.addSupportedToken(address(0), "ETH", ETH_DECIMALS, "ETH/USD");
        
        vm.prank(admin);
        multiTokenPayment.pause();
        
        vm.prank(user);
        vm.expectRevert();
        multiTokenPayment.processETHPayment{value: 1 ether}(PROPERTY_ID);
    }
    
    // ==================== ACCESS CONTROL TESTS ====================
    
    function test_RoleAssignments() public view {
        assertTrue(multiTokenPayment.hasRole(multiTokenPayment.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(multiTokenPayment.hasRole(multiTokenPayment.PAYMENT_MANAGER_ROLE(), paymentManager));
        assertFalse(multiTokenPayment.hasRole(multiTokenPayment.PAYMENT_MANAGER_ROLE(), unauthorized));
    }
    
    // ==================== INTEGRATION TESTS ====================
    
    function test_MultiplePaymentsWithDifferentTokens() public {
        // Setup all tokens
        vm.startPrank(paymentManager);
        multiTokenPayment.addSupportedToken(address(0), "ETH", ETH_DECIMALS, "ETH/USD");
        multiTokenPayment.addSupportedToken(address(usdc), "USDC", USDC_DECIMALS, "USDC/USD");
        multiTokenPayment.addSupportedToken(address(rwap), "RWAP", RWAP_DECIMALS, "RWAP/USD");
        vm.stopPrank();
        
        vm.startPrank(user);
        
        // ETH payment
        multiTokenPayment.processETHPayment{value: 1 ether}(PROPERTY_ID);
        
        // USDC payment
        usdc.approve(address(multiTokenPayment), 1000e6);
        multiTokenPayment.processTokenPayment(address(usdc), 1000e6, PROPERTY_ID);
        
        // RWAP payment
        rwap.approve(address(multiTokenPayment), 500e18);
        multiTokenPayment.processRWAPPayment(500e18, PROPERTY_ID);
        
        vm.stopPrank();
        
        // Verify all payments recorded
        uint256[] memory userPaymentsList = multiTokenPayment.getUserPayments(user);
        assertEq(userPaymentsList.length, 3);
        assertEq(multiTokenPayment.paymentCounter(), 3);
    }
    
    // ==================== FUZZ TESTS ====================
    
    function testFuzz_ProcessETHPayment(uint256 amount) public {
        vm.assume(amount > 0 && amount < 10 ether);
        
        vm.prank(paymentManager);
        multiTokenPayment.addSupportedToken(address(0), "ETH", ETH_DECIMALS, "ETH/USD");
        
        vm.deal(user, amount);
        
        vm.prank(user);
        uint256 paymentId = multiTokenPayment.processETHPayment{value: amount}(PROPERTY_ID);
        
        MultiTokenPayment.PaymentRecord memory payment = multiTokenPayment.getPayment(paymentId);
        assertEq(payment.paymentAmount, amount);
    }
    
    function testFuzz_CalculatePaymentEquivalent(uint256 ethPrice, uint256 rwapPrice) public {
        vm.assume(ethPrice > 0 && ethPrice < type(uint64).max);
        vm.assume(rwapPrice > 0 && rwapPrice < type(uint64).max);
        
        // Update prices
        ethUSDFeed.updateAnswer(int256(ethPrice));
        rwapUSDFeed.updateAnswer(int256(rwapPrice));
        
        vm.startPrank(paymentManager);
        multiTokenPayment.addSupportedToken(address(0), "ETH", ETH_DECIMALS, "ETH/USD");
        multiTokenPayment.addSupportedToken(address(rwap), "RWAP", RWAP_DECIMALS, "RWAP/USD");
        vm.stopPrank();
        
        uint256 ethAmount = 1 ether;
        uint256 rwaEquivalent = multiTokenPayment.calculatePaymentEquivalent(address(0), ethAmount);
        
        // Verify calculation: (ethAmount * ethPrice) / rwapPrice
        // Prices are normalized from 8 to 18 decimals in getChainlinkPrice()
        // So: (ethAmount * (ethPrice * 1e10)) / (rwapPrice * 1e10)
        // Simplifies to: (ethAmount * ethPrice) / rwapPrice
        uint256 expected = (ethAmount * ethPrice) / rwapPrice;
        assertEq(rwaEquivalent, expected);
    }
}
