// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PaymentEscrow.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @notice Mock ERC20 token for testing
 */
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1000000 * 10**18);
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title MockFeeOnTransferToken
 * @notice Mock token that charges fee on transfer for testing fee-on-transfer handling
 */
contract MockFeeOnTransferToken is ERC20 {
    uint256 public feePercent = 1; // 1% fee
    
    constructor() ERC20("FeeToken", "FEE") {
        _mint(msg.sender, 1000000 * 10**18);
    }
    
    function transfer(address to, uint256 amount) public override returns (bool) {
        uint256 fee = (amount * feePercent) / 100;
        uint256 amountAfterFee = amount - fee;
        _transfer(_msgSender(), to, amountAfterFee);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        uint256 fee = (amount * feePercent) / 100;
        uint256 amountAfterFee = amount - fee;
        _spendAllowance(from, _msgSender(), amount);
        _transfer(from, to, amountAfterFee);
        return true;
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title PaymentEscrowTest
 * @notice Comprehensive test suite for PaymentEscrow contract
 * @dev Tests ETH/ERC20 escrow, timeouts, fee-on-transfer tokens, and access control
 */
contract PaymentEscrowTest is Test {
    PaymentEscrow public escrow;
    MockERC20 public usdc;
    MockERC20 public usdt;
    MockFeeOnTransferToken public feeToken;
    
    address public admin;
    address public verifier;
    address public escrowManager;
    address public depositor;
    address public beneficiary;
    address public treasury;
    address public unauthorized;
    
    // Constants
    uint256 constant DEFAULT_TIMEOUT = 7 days;
    uint256 constant ESCROW_AMOUNT = 1000e18;
    uint256 constant INVESTMENT_ID_1 = 1;
    uint256 constant INVESTMENT_ID_2 = 2;
    
    // Events (mirror contract events)
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed depositor,
        address indexed beneficiary,
        address tokenAddress,
        uint256 amount,
        uint256 investmentId,
        uint256 expiresAt
    );
    event EscrowCompleted(
        uint256 indexed escrowId,
        address indexed completedBy,
        uint256 amount
    );
    event EscrowCancelled(
        uint256 indexed escrowId,
        address indexed cancelledBy,
        uint256 refundAmount
    );
    event EscrowExpired(uint256 indexed escrowId);
    event EscrowTimeoutUpdated(uint256 newTimeout);
    event TreasuryUpdated(address indexed newTreasury);
    
    function setUp() public {
        // Create test addresses
        admin = makeAddr("admin");
        verifier = makeAddr("verifier");
        escrowManager = makeAddr("escrowManager");
        depositor = makeAddr("depositor");
        beneficiary = makeAddr("beneficiary");
        treasury = makeAddr("treasury");
        unauthorized = makeAddr("unauthorized");
        
        // Deploy mock tokens
        usdc = new MockERC20("USD Coin", "USDC");
        usdt = new MockERC20("Tether USD", "USDT");
        feeToken = new MockFeeOnTransferToken();
        
        // Deploy PaymentEscrow (implementation + proxy)
        PaymentEscrow escrowImpl = new PaymentEscrow();
        bytes memory escrowInit = abi.encodeWithSelector(
            PaymentEscrow.initialize.selector,
            admin,
            treasury
        );
        ERC1967Proxy escrowProxy = new ERC1967Proxy(address(escrowImpl), escrowInit);
        escrow = PaymentEscrow(payable(address(escrowProxy)));
        
        // Grant roles
        vm.startPrank(admin);
        escrow.grantRole(escrow.VERIFIER_ROLE(), verifier);
        escrow.grantRole(escrow.ESCROW_MANAGER_ROLE(), escrowManager);
        vm.stopPrank();
        
        // Fund depositor with tokens and ETH
        usdc.mint(depositor, 10000e18);
        usdt.mint(depositor, 10000e18);
        feeToken.mint(depositor, 10000e18);
        vm.deal(depositor, 100 ether);
    }
    
    // ==================== INITIALIZATION TESTS ====================
    
    function test_Initialize() public view {
        assertEq(escrow.treasury(), treasury);
        assertEq(escrow.escrowTimeout(), DEFAULT_TIMEOUT);
        assertEq(escrow.escrowCounter(), 0);
        assertTrue(escrow.hasRole(escrow.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(escrow.hasRole(escrow.VERIFIER_ROLE(), admin));
        assertTrue(escrow.hasRole(escrow.ESCROW_MANAGER_ROLE(), admin));
        assertTrue(escrow.hasRole(escrow.UPGRADER_ROLE(), admin));
    }
    
    function test_RevertWhen_InitializeWithZeroAdmin() public {
        PaymentEscrow impl = new PaymentEscrow();
        
        bytes memory initData = abi.encodeWithSelector(
            PaymentEscrow.initialize.selector,
            address(0),
            treasury
        );
        
        vm.expectRevert(PaymentEscrow.PaymentEscrow__InvalidAddress.selector);
        new ERC1967Proxy(address(impl), initData);
    }
    
    function test_RevertWhen_InitializeWithZeroTreasury() public {
        PaymentEscrow impl = new PaymentEscrow();
        
        bytes memory initData = abi.encodeWithSelector(
            PaymentEscrow.initialize.selector,
            admin,
            address(0)
        );
        
        vm.expectRevert(PaymentEscrow.PaymentEscrow__InvalidAddress.selector);
        new ERC1967Proxy(address(impl), initData);
    }
    
    // ==================== ERC20 ESCROW CREATION TESTS ====================
    
    function test_CreateEscrow() public {
        // Approve escrow contract
        vm.prank(depositor);
        usdc.approve(address(escrow), ESCROW_AMOUNT);
        
        // Create escrow
        vm.prank(depositor);
        vm.expectEmit(address(escrow));
        emit EscrowCreated(
            1,
            depositor,
            beneficiary,
            address(usdc),
            ESCROW_AMOUNT,
            INVESTMENT_ID_1,
            block.timestamp + DEFAULT_TIMEOUT
        );
        
        uint256 escrowId = escrow.createEscrow(
            beneficiary,
            address(usdc),
            ESCROW_AMOUNT,
            INVESTMENT_ID_1,
            "bank_transfer"
        );
        
        // Verify escrow created
        assertEq(escrowId, 1);
        assertEq(escrow.escrowCounter(), 1);
        
        // Verify escrow data
        PaymentEscrow.Escrow memory escrowData = escrow.getEscrow(escrowId);
        assertEq(escrowData.depositor, depositor);
        assertEq(escrowData.beneficiary, beneficiary);
        assertEq(escrowData.tokenAddress, address(usdc));
        assertEq(escrowData.amount, ESCROW_AMOUNT);
        assertEq(escrowData.investmentId, INVESTMENT_ID_1);
        assertEq(uint(escrowData.status), uint(PaymentEscrow.EscrowStatus.Active));
        assertEq(escrowData.expiresAt, block.timestamp + DEFAULT_TIMEOUT);
        
        // Verify tokens transferred
        assertEq(usdc.balanceOf(address(escrow)), ESCROW_AMOUNT);
    }
    
    function test_CreateMultipleEscrows() public {
        vm.startPrank(depositor);
        usdc.approve(address(escrow), type(uint256).max);
        
        // Create first escrow
        uint256 escrowId1 = escrow.createEscrow(
            beneficiary,
            address(usdc),
            1000e18,
            INVESTMENT_ID_1,
            "bank_transfer"
        );
        
        // Create second escrow
        uint256 escrowId2 = escrow.createEscrow(
            beneficiary,
            address(usdc),
            2000e18,
            INVESTMENT_ID_2,
            "wire"
        );
        
        vm.stopPrank();
        
        assertEq(escrowId1, 1);
        assertEq(escrowId2, 2);
        assertEq(escrow.escrowCounter(), 2);
        
        // Verify user escrows
        uint256[] memory userEscrowsList = escrow.getUserEscrows(depositor);
        assertEq(userEscrowsList.length, 2);
        assertEq(userEscrowsList[0], 1);
        assertEq(userEscrowsList[1], 2);
    }
    
    function test_CreateEscrowWithFeeOnTransferToken() public {
        // Fee token charges 1% fee
        uint256 amount = 1000e18;
        uint256 expectedAmount = 990e18; // 99% after 1% fee
        
        vm.startPrank(depositor);
        feeToken.approve(address(escrow), amount);
        
        uint256 escrowId = escrow.createEscrow(
            beneficiary,
            address(feeToken),
            amount,
            INVESTMENT_ID_1,
            "bank_transfer"
        );
        
        vm.stopPrank();
        
        // Verify escrow stores actual received amount (after fee)
        PaymentEscrow.Escrow memory escrowData = escrow.getEscrow(escrowId);
        assertEq(escrowData.amount, expectedAmount);
    }
    
    function test_RevertWhen_CreateEscrowWithZeroAmount() public {
        vm.prank(depositor);
        usdc.approve(address(escrow), ESCROW_AMOUNT);
        
        vm.prank(depositor);
        vm.expectRevert(PaymentEscrow.PaymentEscrow__InvalidAmount.selector);
        escrow.createEscrow(beneficiary, address(usdc), 0, INVESTMENT_ID_1, "bank_transfer");
    }
    
    function test_RevertWhen_CreateEscrowWithZeroBeneficiary() public {
        vm.prank(depositor);
        usdc.approve(address(escrow), ESCROW_AMOUNT);
        
        vm.prank(depositor);
        vm.expectRevert(PaymentEscrow.PaymentEscrow__InvalidAddress.selector);
        escrow.createEscrow(address(0), address(usdc), ESCROW_AMOUNT, INVESTMENT_ID_1, "bank_transfer");
    }
    
    function test_RevertWhen_CreateEscrowWithZeroToken() public {
        vm.prank(depositor);
        vm.expectRevert(PaymentEscrow.PaymentEscrow__InvalidAddress.selector);
        escrow.createEscrow(beneficiary, address(0), ESCROW_AMOUNT, INVESTMENT_ID_1, "bank_transfer");
    }
    
    function test_RevertWhen_CreateEscrowWithoutApproval() public {
        vm.prank(depositor);
        vm.expectRevert();
        escrow.createEscrow(beneficiary, address(usdc), ESCROW_AMOUNT, INVESTMENT_ID_1, "bank_transfer");
    }
    
    // ==================== ETH ESCROW CREATION TESTS ====================
    
    function test_CreateEscrowETH() public {
        uint256 ethAmount = 5 ether;
        
        vm.prank(depositor);
        vm.expectEmit(address(escrow));
        emit EscrowCreated(
            1,
            depositor,
            beneficiary,
            address(0),
            ethAmount,
            INVESTMENT_ID_1,
            block.timestamp + DEFAULT_TIMEOUT
        );
        
        uint256 escrowId = escrow.createEscrowETH{value: ethAmount}(
            beneficiary,
            INVESTMENT_ID_1,
            "bank_transfer"
        );
        
        // Verify escrow created
        assertEq(escrowId, 1);
        
        // Verify escrow data
        PaymentEscrow.Escrow memory escrowData = escrow.getEscrow(escrowId);
        assertEq(escrowData.depositor, depositor);
        assertEq(escrowData.beneficiary, beneficiary);
        assertEq(escrowData.tokenAddress, address(0)); // ETH
        assertEq(escrowData.amount, ethAmount);
        assertEq(uint(escrowData.status), uint(PaymentEscrow.EscrowStatus.Active));
        
        // Verify ETH balance
        assertEq(address(escrow).balance, ethAmount);
    }
    
    function test_RevertWhen_CreateEscrowETHWithZeroValue() public {
        vm.prank(depositor);
        vm.expectRevert(PaymentEscrow.PaymentEscrow__InvalidAmount.selector);
        escrow.createEscrowETH{value: 0}(beneficiary, INVESTMENT_ID_1, "bank_transfer");
    }
    
    function test_RevertWhen_CreateEscrowETHWithZeroBeneficiary() public {
        vm.prank(depositor);
        vm.expectRevert(PaymentEscrow.PaymentEscrow__InvalidAddress.selector);
        escrow.createEscrowETH{value: 1 ether}(address(0), INVESTMENT_ID_1, "bank_transfer");
    }
    
    // ==================== ESCROW COMPLETION TESTS ====================
    
    function test_CompleteEscrow() public {
        // Create escrow
        vm.startPrank(depositor);
        usdc.approve(address(escrow), ESCROW_AMOUNT);
        uint256 escrowId = escrow.createEscrow(
            beneficiary,
            address(usdc),
            ESCROW_AMOUNT,
            INVESTMENT_ID_1,
            "bank_transfer"
        );
        vm.stopPrank();
        
        // Complete escrow
        vm.prank(verifier);
        vm.expectEmit(address(escrow));
        emit EscrowCompleted(escrowId, verifier, ESCROW_AMOUNT);
        
        escrow.completeEscrow(escrowId);
        
        // Verify status
        PaymentEscrow.Escrow memory escrowData = escrow.getEscrow(escrowId);
        assertEq(uint(escrowData.status), uint(PaymentEscrow.EscrowStatus.Completed));
        assertEq(escrowData.completedBy, verifier);
        assertEq(escrowData.completedAt, block.timestamp);
        
        // Verify funds transferred to beneficiary
        assertEq(usdc.balanceOf(beneficiary), ESCROW_AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }
    
    function test_CompleteEscrowETH() public {
        uint256 ethAmount = 5 ether;
        
        // Create ETH escrow
        vm.prank(depositor);
        uint256 escrowId = escrow.createEscrowETH{value: ethAmount}(
            beneficiary,
            INVESTMENT_ID_1,
            "bank_transfer"
        );
        
        // Complete escrow
        uint256 beneficiaryBalanceBefore = beneficiary.balance;
        
        vm.prank(verifier);
        escrow.completeEscrow(escrowId);
        
        // Verify ETH transferred
        assertEq(beneficiary.balance, beneficiaryBalanceBefore + ethAmount);
        assertEq(address(escrow).balance, 0);
    }
    
    function test_RevertWhen_CompleteEscrowTwice() public {
        // Create and complete escrow
        vm.startPrank(depositor);
        usdc.approve(address(escrow), ESCROW_AMOUNT);
        uint256 escrowId = escrow.createEscrow(
            beneficiary,
            address(usdc),
            ESCROW_AMOUNT,
            INVESTMENT_ID_1,
            "bank_transfer"
        );
        vm.stopPrank();
        
        vm.prank(verifier);
        escrow.completeEscrow(escrowId);
        
        // Try to complete again
        vm.prank(verifier);
        vm.expectRevert(PaymentEscrow.PaymentEscrow__EscrowNotActive.selector);
        escrow.completeEscrow(escrowId);
    }
    
    function test_RevertWhen_CompleteEscrowUnauthorized() public {
        // Create escrow
        vm.startPrank(depositor);
        usdc.approve(address(escrow), ESCROW_AMOUNT);
        uint256 escrowId = escrow.createEscrow(
            beneficiary,
            address(usdc),
            ESCROW_AMOUNT,
            INVESTMENT_ID_1,
            "bank_transfer"
        );
        vm.stopPrank();
        
        // Try to complete as unauthorized user
        vm.prank(unauthorized);
        vm.expectRevert();
        escrow.completeEscrow(escrowId);
    }
    
    function test_RevertWhen_CompleteNonExistentEscrow() public {
        vm.prank(verifier);
        vm.expectRevert(PaymentEscrow.PaymentEscrow__EscrowNotFound.selector);
        escrow.completeEscrow(999);
    }
    
    // ==================== ESCROW CANCELLATION TESTS ====================
    
    function test_CancelEscrow() public {
        // Create escrow
        vm.startPrank(depositor);
        usdc.approve(address(escrow), ESCROW_AMOUNT);
        uint256 escrowId = escrow.createEscrow(
            beneficiary,
            address(usdc),
            ESCROW_AMOUNT,
            INVESTMENT_ID_1,
            "bank_transfer"
        );
        vm.stopPrank();
        
        uint256 depositorBalanceBefore = usdc.balanceOf(depositor);
        
        // Cancel escrow
        vm.prank(escrowManager);
        vm.expectEmit(address(escrow));
        emit EscrowCancelled(escrowId, escrowManager, ESCROW_AMOUNT);
        
        escrow.cancelEscrow(escrowId);
        
        // Verify status
        PaymentEscrow.Escrow memory escrowData = escrow.getEscrow(escrowId);
        assertEq(uint(escrowData.status), uint(PaymentEscrow.EscrowStatus.Cancelled));
        
        // Verify refund
        assertEq(usdc.balanceOf(depositor), depositorBalanceBefore + ESCROW_AMOUNT);
    }
    
    function test_CancelEscrowETH() public {
        uint256 ethAmount = 5 ether;
        
        // Create ETH escrow
        vm.prank(depositor);
        uint256 escrowId = escrow.createEscrowETH{value: ethAmount}(
            beneficiary,
            INVESTMENT_ID_1,
            "bank_transfer"
        );
        
        uint256 depositorBalanceBefore = depositor.balance;
        
        // Cancel escrow
        vm.prank(escrowManager);
        escrow.cancelEscrow(escrowId);
        
        // Verify refund
        assertEq(depositor.balance, depositorBalanceBefore + ethAmount);
    }
    
    function test_RevertWhen_CancelEscrowUnauthorized() public {
        // Create escrow
        vm.startPrank(depositor);
        usdc.approve(address(escrow), ESCROW_AMOUNT);
        uint256 escrowId = escrow.createEscrow(
            beneficiary,
            address(usdc),
            ESCROW_AMOUNT,
            INVESTMENT_ID_1,
            "bank_transfer"
        );
        vm.stopPrank();
        
        // Try to cancel as unauthorized user
        vm.prank(unauthorized);
        vm.expectRevert();
        escrow.cancelEscrow(escrowId);
    }
    
    // ==================== ESCROW EXPIRY TESTS ====================
    
    function test_ClaimExpiredEscrow() public {
        // Create escrow
        vm.startPrank(depositor);
        usdc.approve(address(escrow), ESCROW_AMOUNT);
        uint256 escrowId = escrow.createEscrow(
            beneficiary,
            address(usdc),
            ESCROW_AMOUNT,
            INVESTMENT_ID_1,
            "bank_transfer"
        );
        vm.stopPrank();
        
        // Warp time past expiry (7 days + 1 second)
        vm.warp(block.timestamp + DEFAULT_TIMEOUT + 1);
        
        // Check escrow is expired
        assertTrue(escrow.isExpired(escrowId));
        
        uint256 depositorBalanceBefore = usdc.balanceOf(depositor);
        
        // Claim expired escrow (anyone can call)
        vm.prank(unauthorized);
        vm.expectEmit(address(escrow));
        emit EscrowExpired(escrowId);
        
        escrow.claimExpiredEscrow(escrowId);
        
        // Verify status
        PaymentEscrow.Escrow memory escrowData = escrow.getEscrow(escrowId);
        assertEq(uint(escrowData.status), uint(PaymentEscrow.EscrowStatus.Expired));
        
        // Verify refund went to depositor (not caller)
        assertEq(usdc.balanceOf(depositor), depositorBalanceBefore + ESCROW_AMOUNT);
        assertEq(usdc.balanceOf(unauthorized), 0);
    }
    
    function test_ClaimExpiredEscrowETH() public {
        uint256 ethAmount = 5 ether;
        
        // Create ETH escrow
        vm.prank(depositor);
        uint256 escrowId = escrow.createEscrowETH{value: ethAmount}(
            beneficiary,
            INVESTMENT_ID_1,
            "bank_transfer"
        );
        
        // Warp past expiry
        vm.warp(block.timestamp + DEFAULT_TIMEOUT + 1);
        
        uint256 depositorBalanceBefore = depositor.balance;
        
        // Claim expired
        vm.prank(unauthorized);
        escrow.claimExpiredEscrow(escrowId);
        
        // Verify refund
        assertEq(depositor.balance, depositorBalanceBefore + ethAmount);
    }
    
    function test_RevertWhen_ClaimExpiredEscrowBeforeTimeout() public {
        // Create escrow
        vm.startPrank(depositor);
        usdc.approve(address(escrow), ESCROW_AMOUNT);
        uint256 escrowId = escrow.createEscrow(
            beneficiary,
            address(usdc),
            ESCROW_AMOUNT,
            INVESTMENT_ID_1,
            "bank_transfer"
        );
        vm.stopPrank();
        
        // Try to claim before expiry
        vm.expectRevert(PaymentEscrow.PaymentEscrow__EscrowNotExpired.selector);
        escrow.claimExpiredEscrow(escrowId);
    }
    
    function test_RevertWhen_ClaimAlreadyCompletedEscrow() public {
        // Create and complete escrow
        vm.startPrank(depositor);
        usdc.approve(address(escrow), ESCROW_AMOUNT);
        uint256 escrowId = escrow.createEscrow(
            beneficiary,
            address(usdc),
            ESCROW_AMOUNT,
            INVESTMENT_ID_1,
            "bank_transfer"
        );
        vm.stopPrank();
        
        vm.prank(verifier);
        escrow.completeEscrow(escrowId);
        
        // Warp past expiry
        vm.warp(block.timestamp + DEFAULT_TIMEOUT + 1);
        
        // Try to claim
        vm.expectRevert(PaymentEscrow.PaymentEscrow__EscrowNotActive.selector);
        escrow.claimExpiredEscrow(escrowId);
    }
    
    // ==================== VIEW FUNCTION TESTS ====================
    
    function test_GetEscrowByInvestment() public {
        // Create escrow
        vm.startPrank(depositor);
        usdc.approve(address(escrow), ESCROW_AMOUNT);
        uint256 escrowId = escrow.createEscrow(
            beneficiary,
            address(usdc),
            ESCROW_AMOUNT,
            INVESTMENT_ID_1,
            "bank_transfer"
        );
        vm.stopPrank();
        
        // Get by investment ID
        PaymentEscrow.Escrow memory escrowData = escrow.getEscrowByInvestment(INVESTMENT_ID_1);
        assertEq(escrowData.escrowId, escrowId);
        assertEq(escrowData.investmentId, INVESTMENT_ID_1);
    }
    
    function test_GetUserEscrows() public {
        vm.startPrank(depositor);
        usdc.approve(address(escrow), type(uint256).max);
        
        // Create multiple escrows
        escrow.createEscrow(beneficiary, address(usdc), 1000e18, INVESTMENT_ID_1, "bank");
        escrow.createEscrow(beneficiary, address(usdc), 2000e18, INVESTMENT_ID_2, "wire");
        
        vm.stopPrank();
        
        uint256[] memory userEscrowsList = escrow.getUserEscrows(depositor);
        assertEq(userEscrowsList.length, 2);
    }
    
    function test_GetEscrowStatus() public {
        // Create escrow
        vm.startPrank(depositor);
        usdc.approve(address(escrow), ESCROW_AMOUNT);
        uint256 escrowId = escrow.createEscrow(
            beneficiary,
            address(usdc),
            ESCROW_AMOUNT,
            INVESTMENT_ID_1,
            "bank_transfer"
        );
        vm.stopPrank();
        
        // Check initial status
        assertEq(uint(escrow.getEscrowStatus(escrowId)), uint(PaymentEscrow.EscrowStatus.Active));
        
        // Complete and check status
        vm.prank(verifier);
        escrow.completeEscrow(escrowId);
        
        assertEq(uint(escrow.getEscrowStatus(escrowId)), uint(PaymentEscrow.EscrowStatus.Completed));
    }
    
    function test_IsExpired() public {
        // Create escrow
        vm.startPrank(depositor);
        usdc.approve(address(escrow), ESCROW_AMOUNT);
        uint256 escrowId = escrow.createEscrow(
            beneficiary,
            address(usdc),
            ESCROW_AMOUNT,
            INVESTMENT_ID_1,
            "bank_transfer"
        );
        vm.stopPrank();
        
        // Initially not expired
        assertFalse(escrow.isExpired(escrowId));
        
        // Warp past expiry
        vm.warp(block.timestamp + DEFAULT_TIMEOUT + 1);
        
        // Now expired
        assertTrue(escrow.isExpired(escrowId));
    }
    
    // ==================== ADMIN FUNCTION TESTS ====================
    
    function test_SetEscrowTimeout() public {
        uint256 newTimeout = 14 days;
        
        vm.prank(admin);
        vm.expectEmit(address(escrow));
        emit EscrowTimeoutUpdated(newTimeout);
        
        escrow.setEscrowTimeout(newTimeout);
        
        assertEq(escrow.escrowTimeout(), newTimeout);
    }
    
    function test_RevertWhen_SetEscrowTimeoutUnauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        escrow.setEscrowTimeout(14 days);
    }
    
    function test_SetTreasury() public {
        address newTreasury = makeAddr("newTreasury");
        
        vm.prank(admin);
        vm.expectEmit(address(escrow));
        emit TreasuryUpdated(newTreasury);
        
        escrow.setTreasury(newTreasury);
        
        assertEq(escrow.treasury(), newTreasury);
    }
    
    function test_RevertWhen_SetTreasuryToZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(PaymentEscrow.PaymentEscrow__InvalidAddress.selector);
        escrow.setTreasury(address(0));
    }
    
    // ==================== PAUSABLE TESTS ====================
    
    function test_Pause() public {
        vm.prank(admin);
        escrow.pause();
        assertTrue(escrow.paused());
    }
    
    function test_Unpause() public {
        vm.startPrank(admin);
        escrow.pause();
        escrow.unpause();
        vm.stopPrank();
        
        assertFalse(escrow.paused());
    }
    
    function test_RevertWhen_CreateEscrowWhilePaused() public {
        vm.prank(admin);
        escrow.pause();
        
        vm.startPrank(depositor);
        usdc.approve(address(escrow), ESCROW_AMOUNT);
        vm.expectRevert();
        escrow.createEscrow(beneficiary, address(usdc), ESCROW_AMOUNT, INVESTMENT_ID_1, "bank");
        vm.stopPrank();
    }
    
    // ==================== ACCESS CONTROL TESTS ====================
    
    function test_RoleAssignments() public view {
        assertTrue(escrow.hasRole(escrow.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(escrow.hasRole(escrow.VERIFIER_ROLE(), verifier));
        assertTrue(escrow.hasRole(escrow.ESCROW_MANAGER_ROLE(), escrowManager));
        assertFalse(escrow.hasRole(escrow.VERIFIER_ROLE(), unauthorized));
    }
    
    // ==================== FUZZ TESTS ====================
    
    function testFuzz_CreateEscrowWithVariousAmounts(uint256 amount) public {
        vm.assume(amount > 0 && amount < type(uint128).max);
        
        // Mint tokens to depositor
        usdc.mint(depositor, amount);
        
        vm.startPrank(depositor);
        usdc.approve(address(escrow), amount);
        uint256 escrowId = escrow.createEscrow(
            beneficiary,
            address(usdc),
            amount,
            INVESTMENT_ID_1,
            "bank"
        );
        vm.stopPrank();
        
        PaymentEscrow.Escrow memory escrowData = escrow.getEscrow(escrowId);
        assertEq(escrowData.amount, amount);
    }
    
    function testFuzz_CreateEscrowETHWithVariousAmounts(uint256 amount) public {
        vm.assume(amount > 0 && amount < 100 ether);
        
        vm.deal(depositor, amount);
        
        vm.prank(depositor);
        uint256 escrowId = escrow.createEscrowETH{value: amount}(
            beneficiary,
            INVESTMENT_ID_1,
            "bank"
        );
        
        PaymentEscrow.Escrow memory escrowData = escrow.getEscrow(escrowId);
        assertEq(escrowData.amount, amount);
    }
}
