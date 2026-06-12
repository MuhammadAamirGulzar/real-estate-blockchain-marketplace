// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/InvestmentManager.sol";
import "../src/PropertyNFT.sol";
import "../src/RWAToken.sol";
import "../src/FractionalPropertyToken.sol";
import "../src/KYCRegistry.sol";
import "../src/RoleManager.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract InvestmentManagerTest is Test {
    InvestmentManager public investmentManager;
    PropertyNFT public propertyNFT;
    RWAToken public platformToken;
    FractionalPropertyToken public fractionalToken;
    KYCRegistry public kycRegistry;
    RoleManager public roleManager;
    
    address public admin;
    address public treasury;
    address public investor1;
    address public investor2;
    address public assetRegistry;
    
    uint256 public constant NFT_TOKEN_ID = 1;
    uint256 public constant PRICE_PER_TOKEN = 1 * 1e18;
    uint256 public constant MIN_INVESTMENT = 100 * 1e18;
    uint256 public constant FRACTIONAL_SUPPLY = 1_000_000 * 1e18;
    
    // FIX: Add event declarations to use modern, specific event checking
    event InvestmentPoolCreated(
        uint256 indexed nftTokenId,
        address fractionalToken,
        uint256 totalTokens,
        uint256 pricePerToken
    );
    event Invested(
        uint256 indexed investmentId,
        address indexed investor,
        uint256 indexed nftTokenId,
        uint256 platformTokenPaid,
        uint256 fractionalTokensReceived
    );
    event InvestmentPoolClosed(uint256 indexed nftTokenId);
    
    function setUp() public {
        admin = makeAddr("admin");
        treasury = makeAddr("treasury");
        investor1 = makeAddr("investor1");
        investor2 = makeAddr("investor2");
        assetRegistry = makeAddr("assetRegistry");
        
        RoleManager roleManagerImpl = new RoleManager();
        bytes memory roleManagerInit = abi.encodeWithSelector(RoleManager.initialize.selector, admin);
        ERC1967Proxy roleManagerProxy = new ERC1967Proxy(address(roleManagerImpl), roleManagerInit);
        roleManager = RoleManager(address(roleManagerProxy));
        
        KYCRegistry kycImpl = new KYCRegistry();
        bytes memory kycInit = abi.encodeWithSelector(KYCRegistry.initialize.selector, address(roleManager));
        ERC1967Proxy kycProxy = new ERC1967Proxy(address(kycImpl), kycInit);
        kycRegistry = KYCRegistry(address(kycProxy));
        
        vm.startPrank(admin);
        roleManager.grantRoleByAdmin(roleManager.SUB_ADMIN_ROLE(), address(kycRegistry));
        vm.stopPrank();
        
        PropertyNFT propertyNFTImpl = new PropertyNFT();
        bytes memory nftInit = abi.encodeWithSelector(PropertyNFT.initialize.selector, admin, assetRegistry);
        ERC1967Proxy nftProxy = new ERC1967Proxy(address(propertyNFTImpl), nftInit);
        propertyNFT = PropertyNFT(address(nftProxy));
        
        RWAToken rwaImpl = new RWAToken();
        bytes memory rwaInit = abi.encodeWithSelector(RWAToken.initialize.selector, admin, treasury, 1_000_000_000 * 1e18, 10_000_000_000 * 1e18);
        ERC1967Proxy rwaProxy = new ERC1967Proxy(address(rwaImpl), rwaInit);
        platformToken = RWAToken(address(rwaProxy));
        
        vm.prank(admin);
        fractionalToken = new FractionalPropertyToken("Test Property", "TPT", 1, NFT_TOKEN_ID, admin, treasury, FRACTIONAL_SUPPLY);
        
        vm.prank(admin);
        propertyNFT.mintProperty(treasury, NFT_TOKEN_ID, "ipfs://metadata", address(fractionalToken), FRACTIONAL_SUPPLY, 500_000 * 1e6);
        
        InvestmentManager investmentManagerImpl = new InvestmentManager();
        bytes memory invInit = abi.encodeWithSelector(InvestmentManager.initialize.selector, admin, address(propertyNFT), address(platformToken), address(kycRegistry), treasury);
        ERC1967Proxy invProxy = new ERC1967Proxy(address(investmentManagerImpl), invInit);
        investmentManager = InvestmentManager(address(invProxy));
        
        vm.prank(investor1);
        kycRegistry.submitKYC("QmTest1");
        vm.prank(admin);
        kycRegistry.approveKYC(investor1);
        
        vm.prank(investor2);
        kycRegistry.submitKYC("QmTest2");
        vm.prank(admin);
        kycRegistry.approveKYC(investor2);
        
        vm.startPrank(treasury);
        platformToken.transfer(investor1, 1_000_000 * 1e18);
        platformToken.transfer(investor2, 10_000 * 1e18);
        fractionalToken.approve(address(investmentManager), FRACTIONAL_SUPPLY);
        vm.stopPrank();

        vm.prank(admin);
        fractionalToken.enableTrading();
    }
    
    // ==================== INITIALIZATION TESTS ====================
    
    function test_Initialize() public view {
        assertEq(address(investmentManager.propertyNFT()), address(propertyNFT));
        assertEq(address(investmentManager.platformToken()), address(platformToken));
        assertEq(address(investmentManager.kycRegistry()), address(kycRegistry));
        assertEq(investmentManager.treasury(), treasury);
        assertTrue(investmentManager.hasRole(investmentManager.DEFAULT_ADMIN_ROLE(), admin));
    }
    
    function test_RevertWhen_InitializeWithZeroAddress() public {
        InvestmentManager impl = new InvestmentManager();
        bytes memory initData = abi.encodeWithSelector(InvestmentManager.initialize.selector, admin, address(0), address(platformToken), address(kycRegistry), treasury);
        vm.expectRevert(InvestmentManager.InvestmentManager__InvalidAddress.selector);
        new ERC1967Proxy(address(impl), initData);
    }
    
    // ==================== POOL CREATION TESTS ====================
    
    function test_CreateInvestmentPool() public {
        vm.prank(admin);

        // Use modern, specific event checking
        vm.expectEmit(address(investmentManager));
        emit InvestmentPoolCreated(
            NFT_TOKEN_ID,
            address(fractionalToken),
            FRACTIONAL_SUPPLY,
            PRICE_PER_TOKEN
        );
        
        investmentManager.createInvestmentPool(
            NFT_TOKEN_ID,
            PRICE_PER_TOKEN,
            MIN_INVESTMENT
        );
        
        InvestmentManager.PropertyInvestmentPool memory pool = investmentManager.getInvestmentPool(NFT_TOKEN_ID);
        assertTrue(pool.isOpen);
    }
    
    function test_RevertWhen_UnauthorizedCreatePool() public {
        vm.prank(investor1);
        vm.expectRevert();
        investmentManager.createInvestmentPool(NFT_TOKEN_ID, PRICE_PER_TOKEN, MIN_INVESTMENT);
    }
    
    function test_RevertWhen_CreatePoolForNonExistentNFT() public {
        vm.prank(admin);
        vm.expectRevert();
        investmentManager.createInvestmentPool(999, PRICE_PER_TOKEN, MIN_INVESTMENT);
    }
    
    function test_RevertWhen_CreatePoolTwice() public {
        vm.prank(admin);
        investmentManager.createInvestmentPool(NFT_TOKEN_ID, PRICE_PER_TOKEN, MIN_INVESTMENT);
        vm.prank(admin);
        vm.expectRevert(InvestmentManager.InvestmentManager__PoolAlreadyExists.selector);
        investmentManager.createInvestmentPool(NFT_TOKEN_ID, PRICE_PER_TOKEN, MIN_INVESTMENT);
    }
    
    // ==================== INVESTMENT TESTS ====================
    
    function test_Invest() public {
        vm.prank(admin);
        investmentManager.createInvestmentPool(NFT_TOKEN_ID, PRICE_PER_TOKEN, MIN_INVESTMENT);
        
        uint256 investmentAmount = 1000 * 1e18;
        
        vm.startPrank(investor1);
        platformToken.approve(address(investmentManager), investmentAmount);
        
        // Use modern, specific event checking
        uint256 expectedInvestmentId = 1; // It's the first investment
        uint256 expectedFractionalTokens = (investmentAmount * 1e18) / PRICE_PER_TOKEN;
        vm.expectEmit(address(investmentManager));
        emit Invested(
            expectedInvestmentId,
            investor1,
            NFT_TOKEN_ID,
            investmentAmount,
            expectedFractionalTokens
        );
        
        investmentManager.invest(NFT_TOKEN_ID, investmentAmount);
        vm.stopPrank();
        
        assertEq(fractionalToken.balanceOf(investor1), expectedFractionalTokens);
    }
    
    function test_RevertWhen_InvestWithoutKYC() public {
        address nonKYCUser = makeAddr("nonKYCUser");
        vm.prank(admin);
        investmentManager.createInvestmentPool(NFT_TOKEN_ID, PRICE_PER_TOKEN, MIN_INVESTMENT);
        vm.prank(treasury);
        platformToken.transfer(nonKYCUser, 1000 * 1e18);
        
        vm.startPrank(nonKYCUser);
        platformToken.approve(address(investmentManager), 1000 * 1e18);
        vm.expectRevert(InvestmentManager.InvestmentManager__NotKYCApproved.selector);
        investmentManager.invest(NFT_TOKEN_ID, 1000 * 1e18);
        vm.stopPrank();
    }
    
    function test_RevertWhen_InvestBelowMinimum() public {
        vm.prank(admin);
        investmentManager.createInvestmentPool(NFT_TOKEN_ID, PRICE_PER_TOKEN, MIN_INVESTMENT);
        uint256 belowMin = MIN_INVESTMENT - 1;
        
        // FIX: Use startPrank to maintain context
        vm.startPrank(investor1);
        platformToken.approve(address(investmentManager), belowMin);
        vm.expectRevert(InvestmentManager.InvestmentManager__InsufficientAmount.selector);
        investmentManager.invest(NFT_TOKEN_ID, belowMin);
        vm.stopPrank();
    }
    
    function test_RevertWhen_InvestInClosedPool() public {
        vm.prank(admin);
        investmentManager.createInvestmentPool(NFT_TOKEN_ID, PRICE_PER_TOKEN, MIN_INVESTMENT);
        
        // FIX: Add vm.prank(admin) before closeInvestmentPool
        vm.prank(admin);
        investmentManager.closeInvestmentPool(NFT_TOKEN_ID);
        
        vm.startPrank(investor1);
        platformToken.approve(address(investmentManager), 1000 * 1e18);
        vm.expectRevert(InvestmentManager.InvestmentManager__PoolNotOpen.selector);
        investmentManager.invest(NFT_TOKEN_ID, 1000 * 1e18);
        vm.stopPrank();
    }
    
    function test_RevertWhen_InsufficientTokensInPool() public {
        vm.prank(admin);
        investmentManager.createInvestmentPool(NFT_TOKEN_ID, PRICE_PER_TOKEN, MIN_INVESTMENT);
        
        uint256 excessAmount = ((FRACTIONAL_SUPPLY * PRICE_PER_TOKEN) / 1e18) + 1;
        
        vm.prank(treasury);
        platformToken.transfer(investor1, excessAmount);
        
        // FIX: Use startPrank
        vm.startPrank(investor1);
        platformToken.approve(address(investmentManager), excessAmount);
        vm.expectRevert(InvestmentManager.InvestmentManager__InsufficientFractionalTokens.selector);
        investmentManager.invest(NFT_TOKEN_ID, excessAmount);
        vm.stopPrank();
    }
    
    function test_MultipleInvestments() public {
        vm.prank(admin);
        investmentManager.createInvestmentPool(NFT_TOKEN_ID, PRICE_PER_TOKEN, MIN_INVESTMENT);
        
        uint256 investment1 = 1000 * 1e18;
        uint256 investment2 = 2000 * 1e18;
        
        // FIX: Use startPrank/stopPrank for each investor
        vm.startPrank(investor1);
        platformToken.approve(address(investmentManager), investment1);
        investmentManager.invest(NFT_TOKEN_ID, investment1);
        vm.stopPrank();
        
        vm.startPrank(investor2);
        platformToken.approve(address(investmentManager), investment2);
        investmentManager.invest(NFT_TOKEN_ID, investment2);
        vm.stopPrank();
        
        assertEq(fractionalToken.balanceOf(investor1), (investment1 * 1e18) / PRICE_PER_TOKEN);
        assertEq(fractionalToken.balanceOf(investor2), (investment2 * 1e18) / PRICE_PER_TOKEN);
    }
    
    // ==================== POOL CLOSURE TESTS ====================
    
    function test_CloseInvestmentPool() public {
        vm.prank(admin);
        investmentManager.createInvestmentPool(NFT_TOKEN_ID, PRICE_PER_TOKEN, MIN_INVESTMENT);
        
        vm.prank(admin);
        
        // Use modern, specific event checking
        vm.expectEmit(address(investmentManager));
        emit InvestmentPoolClosed(NFT_TOKEN_ID);

        investmentManager.closeInvestmentPool(NFT_TOKEN_ID);
        
        InvestmentManager.PropertyInvestmentPool memory pool = investmentManager.getInvestmentPool(NFT_TOKEN_ID);
        assertFalse(pool.isOpen);
    }
    
    function test_RevertWhen_UnauthorizedClosePool() public {
        vm.prank(admin);
        investmentManager.createInvestmentPool(NFT_TOKEN_ID, PRICE_PER_TOKEN, MIN_INVESTMENT);
        vm.prank(investor1);
        vm.expectRevert();
        investmentManager.closeInvestmentPool(NFT_TOKEN_ID);
    }
    
    // ==================== VIEW FUNCTION TESTS ====================
    
    function test_GetInvestorInvestments() public {
        vm.prank(admin);
        investmentManager.createInvestmentPool(NFT_TOKEN_ID, PRICE_PER_TOKEN, MIN_INVESTMENT);
        
        // FIX: Use startPrank
        vm.startPrank(investor1);
        platformToken.approve(address(investmentManager), 1000 * 1e18);
        investmentManager.invest(NFT_TOKEN_ID, 1000 * 1e18);
        vm.stopPrank();
        
        InvestmentManager.Investment[] memory investments = investmentManager.getInvestorInvestments(investor1);
        assertEq(investments.length, 1);
    }
    
    function test_GetInvestmentPool() public {
        vm.prank(admin);
        investmentManager.createInvestmentPool(NFT_TOKEN_ID, PRICE_PER_TOKEN, MIN_INVESTMENT);
        InvestmentManager.PropertyInvestmentPool memory pool = investmentManager.getInvestmentPool(NFT_TOKEN_ID);
        assertEq(pool.nftTokenId, NFT_TOKEN_ID);
    }
    
    // ==================== EDGE CASE TESTS ====================
    
    function test_InvestEntirePool() public {
        vm.prank(admin);
        investmentManager.createInvestmentPool(NFT_TOKEN_ID, PRICE_PER_TOKEN, MIN_INVESTMENT);
        
        uint256 fullAmount = (FRACTIONAL_SUPPLY * PRICE_PER_TOKEN) / 1e18;
        
        // FIX: Use startPrank
        vm.startPrank(investor1);
        platformToken.approve(address(investmentManager), fullAmount);
        investmentManager.invest(NFT_TOKEN_ID, fullAmount);
        vm.stopPrank();
        
        InvestmentManager.PropertyInvestmentPool memory pool = investmentManager.getInvestmentPool(NFT_TOKEN_ID);
        assertEq(pool.availableFractionalTokens, 0);
    }
    
    // ==================== FUZZ TESTS ====================
    
    function testFuzz_Invest(uint256 amount) public {
        vm.assume(amount >= MIN_INVESTMENT);
        vm.assume(amount <= 1_000_000 * 1e18);
        
        vm.prank(admin);
        investmentManager.createInvestmentPool(NFT_TOKEN_ID, PRICE_PER_TOKEN, MIN_INVESTMENT);
        
        // FIX: Use startPrank for fuzz test
        vm.startPrank(investor1);
        platformToken.approve(address(investmentManager), amount);
        investmentManager.invest(NFT_TOKEN_ID, amount);
        vm.stopPrank();
        
        uint256 expectedTokens = (amount * 1e18) / PRICE_PER_TOKEN;
        assertEq(fractionalToken.balanceOf(investor1), expectedTokens);
    }
}