// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/RWAToken.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract RWATokenTest is Test {
    RWAToken public token;
    
    address public admin;
    address public minter;
    address public burner;
    address public user1;
    address public user2;
    address public unauthorized;
    
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 1e18; // 1B
    uint256 public constant MAX_SUPPLY = 10_000_000_000 * 1e18; // 10B
    
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    
    function setUp() public {
        admin = makeAddr("admin");
        minter = makeAddr("minter");
        burner = makeAddr("burner");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        unauthorized = makeAddr("unauthorized");
        
        RWAToken implementation = new RWAToken();
        bytes memory data = abi.encodeWithSelector(
            RWAToken.initialize.selector,
            admin,
            admin,
            INITIAL_SUPPLY,
            MAX_SUPPLY
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), data);
        token = RWAToken(address(proxy));
        
        // Grant roles
        vm.startPrank(admin);
        token.grantRole(token.MINTER_ROLE(), minter);
        token.grantRole(token.BURNER_ROLE(), burner);
        vm.stopPrank();
    }
    
    // ==================== INITIALIZATION TESTS ====================
    
    function test_Initialize() public {
        assertEq(token.name(), "RWA Platform Token");
        assertEq(token.symbol(), "RWAP");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), INITIAL_SUPPLY);
        assertEq(token.maxSupply(), MAX_SUPPLY);
        assertEq(token.balanceOf(admin), INITIAL_SUPPLY);
        assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(token.hasRole(token.MINTER_ROLE(), admin));
        assertTrue(token.hasRole(token.BURNER_ROLE(), admin));
    }
    
    function test_RevertWhen_InitializeWithZeroAdmin() public {
        RWAToken implementation = new RWAToken();
        bytes memory data = abi.encodeWithSelector(
            RWAToken.initialize.selector,
            address(0),
            admin,
            INITIAL_SUPPLY,
            MAX_SUPPLY
        );
        vm.expectRevert(RWAToken.RWAToken__InvalidAddress.selector);
        new ERC1967Proxy(address(implementation), data);
    }
    
    function test_RevertWhen_InitializeWithZeroTreasury() public {
        RWAToken implementation = new RWAToken();
        bytes memory data = abi.encodeWithSelector(
            RWAToken.initialize.selector,
            admin,
            address(0),
            INITIAL_SUPPLY,
            MAX_SUPPLY
        );
        vm.expectRevert(RWAToken.RWAToken__InvalidAddress.selector);
        new ERC1967Proxy(address(implementation), data);
    }
    
    function test_RevertWhen_InitialSupplyExceedsMax() public {
        RWAToken implementation = new RWAToken();
        bytes memory data = abi.encodeWithSelector(
            RWAToken.initialize.selector,
            admin,
            admin,
            MAX_SUPPLY + 1,
            MAX_SUPPLY
        );
        vm.expectRevert(RWAToken.RWAToken__ExceedsMaxSupply.selector);
        new ERC1967Proxy(address(implementation), data);
    }
    
    // ==================== MINTING TESTS ====================
    
    function test_MintByMinter() public {
        uint256 mintAmount = 1_000_000 * 1e18;
        
        vm.prank(minter);
        vm.expectEmit(true, false, false, true);
        emit TokensMinted(user1, mintAmount);
        token.mint(user1, mintAmount);
        
        assertEq(token.balanceOf(user1), mintAmount);
        assertEq(token.totalSupply(), INITIAL_SUPPLY + mintAmount);
    }
    
    function test_AdminCanMint() public {
        uint256 mintAmount = 1_000_000 * 1e18;
        
        vm.prank(admin);
        token.mint(user1, mintAmount);
        
        assertEq(token.balanceOf(user1), mintAmount);
    }
    
    function test_RevertWhen_UnauthorizedMint() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        token.mint(user1, 1_000_000 * 1e18);
    }
    
    function test_RevertWhen_MintExceedsMaxSupply() public {
        uint256 excessAmount = MAX_SUPPLY - INITIAL_SUPPLY + 1;
        
        vm.prank(minter);
        vm.expectRevert(RWAToken.RWAToken__ExceedsMaxSupply.selector);
        token.mint(user1, excessAmount);
    }
    
    function test_RevertWhen_MintToZeroAddress() public {
        vm.prank(minter);
        vm.expectRevert(RWAToken.RWAToken__InvalidAddress.selector);
        token.mint(address(0), 1_000_000 * 1e18);
    }
    
    function test_RevertWhen_MintZeroAmount() public {
        vm.prank(minter);
        vm.expectRevert(RWAToken.RWAToken__InvalidAmount.selector);
        token.mint(user1, 0);
    }
    
    // ==================== BURNING TESTS ====================
    
    function test_BurnByBurner() public {
        uint256 burnAmount = 100_000 * 1e18;
        
        vm.prank(admin);
        token.transfer(burner, burnAmount);
        
        vm.prank(burner);
        vm.expectEmit(true, false, false, true);
        emit TokensBurned(burner, burnAmount);
        token.burn(burner, burnAmount);
        
        assertEq(token.balanceOf(burner), 0);
        assertEq(token.totalSupply(), INITIAL_SUPPLY - burnAmount);
    }
    
    function test_BurnFromByBurner() public {
        // burnFrom is not present in RWAToken contract, so this test is removed.
    }
    
    function test_RevertWhen_UnauthorizedBurn() public {
        vm.prank(admin);
        token.transfer(unauthorized, 1000 * 1e18);
        
        vm.prank(unauthorized);
        vm.expectRevert();
        token.burn(unauthorized, 100 * 1e18);
    }
    
    function test_RevertWhen_BurnZeroAmount() public {
        vm.prank(burner);
        vm.expectRevert(RWAToken.RWAToken__InvalidAmount.selector);
        token.burn(burner, 0);
    }
    
    function test_RevertWhen_BurnMoreThanBalance() public {
        vm.prank(admin);
        token.transfer(burner, 100 * 1e18);
        
        vm.prank(burner);
        vm.expectRevert(RWAToken.RWAToken__InsufficientBalance.selector);
        token.burn(burner,200 * 1e18);
    }
    
    // ==================== TRANSFER TESTS ====================
    
    function test_Transfer() public {
        uint256 transferAmount = 1000 * 1e18;
        
        vm.prank(admin);
        token.transfer(user1, transferAmount);
        
        assertEq(token.balanceOf(user1), transferAmount);
        assertEq(token.balanceOf(admin), INITIAL_SUPPLY - transferAmount);
    }
    
    function test_TransferFrom() public {
        uint256 transferAmount = 1000 * 1e18;
        
        vm.prank(admin);
        token.approve(user1, transferAmount);
        
        vm.prank(user1);
        token.transferFrom(admin, user2, transferAmount);
        
        assertEq(token.balanceOf(user2), transferAmount);
        assertEq(token.allowance(admin, user1), 0);
    }
    
    function test_RevertWhen_TransferToZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSignature("ERC20InvalidReceiver(address)", address(0)));
        token.transfer(address(0), 1000 * 1e18);
    }
    
    // ==================== PAUSE TESTS ====================
    
    function test_Pause() public {
        vm.prank(admin);
        token.pause();
        
        assertTrue(token.paused());
    }
    
    function test_Unpause() public {
        vm.prank(admin);
        token.pause();
        
        vm.prank(admin);
        token.unpause();
        
        assertFalse(token.paused());
    }
    
    function test_RevertWhen_TransferWhilePaused() public {
        vm.prank(admin);
        token.pause();
        
        vm.prank(admin);
        vm.expectRevert();
        token.transfer(user1, 1000 * 1e18);
    }
    
    function test_RevertWhen_UnauthorizedPause() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        token.pause();
    }
    
    // ==================== APPROVAL TESTS ====================
    
    function test_Approve() public {
        uint256 approvalAmount = 1000 * 1e18;
        
        vm.prank(admin);
        token.approve(user1, approvalAmount);
        
        assertEq(token.allowance(admin, user1), approvalAmount);
    }
    
    function test_ApproveOverwrite() public {
        uint256 initialAllowance = 1000 * 1e18;
        uint256 newAllowance = 1500 * 1e18;
        
        vm.prank(admin);
        token.approve(user1, initialAllowance);
        
        vm.prank(admin);
        token.approve(user1, newAllowance);
        
        assertEq(token.allowance(admin, user1), newAllowance);
    }
    
    // ==================== ROLE MANAGEMENT TESTS ====================
    
    function test_GrantMinterRole() public {
        vm.startPrank(admin);
        token.grantRole(token.MINTER_ROLE(), user1);
        assertTrue(token.hasRole(token.MINTER_ROLE(), user1));
    }
    
    function test_RevokeMinterRole() public {
        vm.startPrank(admin);
        token.revokeRole(token.MINTER_ROLE(), minter);
        assertFalse(token.hasRole(token.MINTER_ROLE(), minter));
    }
    
    function test_RenounceRole() public {
        vm.startPrank(minter);
        token.renounceRole(token.MINTER_ROLE(), minter);
        assertFalse(token.hasRole(token.MINTER_ROLE(), minter));
    }
    
    // ==================== BATCH OPERATIONS ====================
    
    function test_BatchTransfer() public {
        address[] memory recipients = new address[](3);
        recipients[0] = user1;
        recipients[1] = user2;
        recipients[2] = makeAddr("user3");
        
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 100 * 1e18;
        amounts[1] = 200 * 1e18;
        amounts[2] = 300 * 1e18;
        
        vm.prank(admin);
        token.batchTransfer(recipients, amounts);
        
        assertEq(token.balanceOf(user1), 100 * 1e18);
        assertEq(token.balanceOf(user2), 200 * 1e18);
        assertEq(token.balanceOf(recipients[2]), 300 * 1e18);
    }
    
    function test_RevertWhen_BatchTransferLengthMismatch() public {
        address[] memory recipients = new address[](2);
        uint256[] memory amounts = new uint256[](3);
        
        vm.prank(admin);
        vm.expectRevert(RWAToken.RWAToken__InvalidAmount.selector);
        token.batchTransfer(recipients, amounts);
    }
    
    // ==================== EDGE CASES ====================
    
    function test_MintUpToMaxSupply() public {
        uint256 remainingSupply = MAX_SUPPLY - INITIAL_SUPPLY;
        
        vm.prank(minter);
        token.mint(user1, remainingSupply);
        
        assertEq(token.totalSupply(), MAX_SUPPLY);
    }
    
    function test_BurnAllSupply() public {
        vm.prank(admin);
        token.burn(admin, INITIAL_SUPPLY);
        
        assertEq(token.totalSupply(), 0);
    }
    
    // ==================== FUZZ TESTS ====================
    
    function testFuzz_Mint(address recipient, uint256 amount) public {
        vm.assume(recipient != address(0));
        vm.assume(amount > 0);
        vm.assume(amount <= MAX_SUPPLY - INITIAL_SUPPLY);
        
        vm.prank(minter);
        token.mint(recipient, amount);
        
        assertEq(token.balanceOf(recipient), amount);
    }
    
    function testFuzz_Transfer(address recipient, uint256 amount) public {
        vm.assume(recipient != address(0));
        vm.assume(amount > 0);
        vm.assume(amount <= INITIAL_SUPPLY);
        
        vm.prank(admin);
        token.transfer(recipient, amount);
        
        assertEq(token.balanceOf(recipient), amount);
    }
    
    function testFuzz_Approve(address spender, uint256 amount) public {
        vm.assume(spender != address(0));
        
        vm.prank(admin);
        token.approve(spender, amount);
        
        assertEq(token.allowance(admin, spender), amount);
    }
}