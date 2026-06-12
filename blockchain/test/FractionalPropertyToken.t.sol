// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/FractionalPropertyToken.sol";

contract FractionalPropertyTokenTest is Test {
    FractionalPropertyToken public token;
    
    address public admin;
    address public treasury;
    address public investor1;
    address public investor2;
    address public unauthorized;
    address public user;
    
    uint256 public constant ASSET_ID = 1;
    uint256 public constant NFT_TOKEN_ID = 1;
    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 1e18;
    
    event TradingEnabled();
    event TradingDisabled();
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    
    function setUp() public {
        admin = makeAddr("admin");
        treasury = makeAddr("treasury");
        investor1 = makeAddr("investor1");
        investor2 = makeAddr("investor2");
        unauthorized = makeAddr("unauthorized");
        user = makeAddr("user");
        
        vm.prank(admin);
        token = new FractionalPropertyToken(
            "Test Property Token",
            "TPT",
            ASSET_ID,
            NFT_TOKEN_ID,
            admin,
            treasury,
            INITIAL_SUPPLY
        );
    }
    
    // ==================== INITIALIZATION TESTS ====================
    
    function test_Initialize() public {
        assertEq(token.name(), "Test Property Token");
        assertEq(token.symbol(), "TPT");
        assertEq(token.assetRegistryId(), ASSET_ID);
        assertEq(token.nftTokenId(), NFT_TOKEN_ID);
        assertEq(token.maxSupply(), INITIAL_SUPPLY * 2); // Fixed: maxSupply is INITIAL_SUPPLY * 2
        assertEq(token.balanceOf(treasury), INITIAL_SUPPLY);
        assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(token.hasRole(token.MINTER_ROLE(), admin));
        assertFalse(token.tradingEnabled());
    }
    
    function test_RevertWhen_InitializeWithZeroAdmin() public {
        vm.expectRevert(FractionalPropertyToken.FractionalPropertyToken__InvalidAddress.selector);
        new FractionalPropertyToken(
            "Test",
            "TST",
            1,
            1,
            address(0),
            treasury,
            1e18
        );
    }
    
    function test_RevertWhen_InitializeWithZeroTreasury() public {
        vm.expectRevert(FractionalPropertyToken.FractionalPropertyToken__InvalidAddress.selector);
        new FractionalPropertyToken(
            "Test",
            "TST",
            1,
            1,
            admin,
            address(0),
            1e18
        );
    }
    
    function test_RevertWhen_InitializeWithZeroSupply() public {
        vm.expectRevert();
        new FractionalPropertyToken(
            "Test",
            "TST",
            1,
            1,
            admin,
            treasury,
            0
        );
    }
    
    // ==================== MINTING TESTS ====================
    
    function test_MintTokens() public {
        vm.prank(admin);
        token.mint(investor1, 1000 * 1e18);
        assertEq(token.balanceOf(investor1), 1000 * 1e18);
    }
    
    function test_RevertWhen_MintExceedsMaxSupply() public {
        uint256 excessAmount = INITIAL_SUPPLY + 1;
        
        vm.prank(admin);
        vm.expectRevert(FractionalPropertyToken.FractionalPropertyToken__ExceedsMaxSupply.selector);
        token.mint(investor1, excessAmount);
    }
    
    function test_RevertWhen_UnauthorizedMint() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        token.mint(investor1, 1000 * 1e18);
    }
    
    function test_RevertWhen_MintToZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(FractionalPropertyToken.FractionalPropertyToken__InvalidAddress.selector);
        token.mint(address(0), 1000 * 1e18);
    }
    
    function test_RevertWhen_MintZeroAmount() public {
        vm.prank(admin);
        vm.expectRevert();
        token.mint(investor1, 0);
    }
    
    // ==================== BURNING TESTS ====================
    
    function test_BurnTokens() public {
        uint256 burnAmount = 100 * 1e18;
        
        vm.prank(admin);
        token.mint(investor1, 1000 * 1e18);
        
        vm.prank(investor1);
        vm.expectEmit(true, false, false, true);
        emit TokensBurned(investor1, burnAmount);
        token.burn(investor1,burnAmount);
        
        assertEq(token.balanceOf(investor1), 900 * 1e18);
    }
    
    function test_RevertWhen_BurnZeroAmount() public {
        vm.prank(investor1);
        vm.expectRevert();
        token.burn(investor1, 0);
    }
    
    function test_RevertWhen_BurnMoreThanBalance() public {
        vm.prank(admin);
        token.mint(investor1, 100 * 1e18);
        
        vm.prank(investor1);
        vm.expectRevert();
        token.burn(investor1, 200 * 1e18);
    }
    
    // ==================== TRADING CONTROL TESTS ====================
    
    function test_EnableTrading() public {
        vm.prank(admin);
        vm.expectEmit(false, false, false, false);
        emit TradingEnabled();
        token.enableTrading();
        
        assertTrue(token.tradingEnabled());
    }
    
    function test_DisableTrading() public {
        vm.prank(admin);
        token.enableTrading();
        
        vm.prank(admin);
        vm.expectEmit(false, false, false, false);
        emit TradingDisabled();
        token.disableTrading();
        
        assertFalse(token.tradingEnabled());
    }
    
    function test_RevertWhen_UnauthorizedEnableTrading() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        token.enableTrading();
    }
    
    function test_TransferWhenTradingDisabled() public {
        vm.prank(admin);
        token.mint(admin, 1000 * 1e18); // Fixed: Mint to admin so admin has balance to transfer
        
        // Trading disabled by default, but minter/admin can still transfer
        vm.prank(admin);
        token.transfer(investor2, 100 * 1e18);
        
        assertEq(token.balanceOf(investor2), 100 * 1e18);
    }
    
    function test_RevertWhen_NonMinterTransfersWithTradingDisabled() public {
        vm.prank(admin);
        token.mint(investor1, 1000 * 1e18);
        
        vm.prank(investor1);
        vm.expectRevert(FractionalPropertyToken.FractionalPropertyToken__TradingDisabled.selector);
        token.transfer(investor2, 100 * 1e18);
    }
    
    function test_TransferWhenTradingEnabled() public {
        vm.prank(admin);
        token.mint(investor1, 1000 * 1e18);
        
        vm.prank(admin);
        token.enableTrading();
        
        vm.prank(investor1);
        token.transfer(investor2, 100 * 1e18);
        
        assertEq(token.balanceOf(investor2), 100 * 1e18);
        assertEq(token.balanceOf(investor1), 900 * 1e18);
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
        token.mint(investor1, 1000 * 1e18);
        
        vm.prank(admin);
        token.pause();
        
        vm.prank(admin);
        vm.expectRevert();
        token.transfer(investor2, 100 * 1e18);
    }
    
    function test_RevertWhen_UnauthorizedPause() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        token.pause();
    }
    
    // ==================== APPROVAL TESTS ====================
    
    function test_ApproveAndTransferFrom() public {
        vm.prank(admin);
        token.mint(investor1, 1000 * 1e18);
        
        vm.prank(admin);
        token.enableTrading();
        
        vm.prank(investor1);
        token.approve(investor2, 500 * 1e18);
        
        vm.prank(investor2);
        token.transferFrom(investor1, investor2, 200 * 1e18);
        
        assertEq(token.balanceOf(investor2), 200 * 1e18);
        assertEq(token.allowance(investor1, investor2), 300 * 1e18);
    }
    
    // ==================== ROLE MANAGEMENT TESTS ====================
    
    function test_GrantMinterRole() public {
        vm.startPrank(admin);
        token.grantRole(token.MINTER_ROLE(), investor1);
        vm.stopPrank();
        assertTrue(token.hasRole(token.MINTER_ROLE(), investor1));
    }
    
    function test_RevokeMinterRole() public {
        vm.startPrank(admin);
        token.grantRole(token.MINTER_ROLE(), investor1);
        
        token.revokeRole(token.MINTER_ROLE(), investor1);
        vm.stopPrank();
        assertFalse(token.hasRole(token.MINTER_ROLE(), investor1));
    }
    
    // ==================== VIEW FUNCTION TESTS ====================
    
    function test_GetTokenInfo() public {
        (
            string memory name,
            string memory symbol,
            uint256 totalSupply,
            uint256 maxSupply,
            uint256 assetId,
            uint256 nftId,
            bool trading
        ) = token.getTokenInfo();
        
        assertEq(name, "Test Property Token");
        assertEq(symbol, "TPT");
        assertEq(totalSupply, INITIAL_SUPPLY);
        assertEq(maxSupply, INITIAL_SUPPLY * 2);
        assertEq(assetId, ASSET_ID);
        assertEq(nftId, NFT_TOKEN_ID);
        assertFalse(trading);
    }
    
    // ==================== EDGE CASE TESTS ====================
    
    function test_MintUpToMaxSupply() public {
        // Treasury already has INITIAL_SUPPLY, mint INITIAL_SUPPLY more to reach maxSupply
        vm.prank(admin);
        token.mint(investor1, INITIAL_SUPPLY); // This should succeed
        
        // Now minting 1 more should revert (exceeds maxSupply)
        vm.prank(admin);
        vm.expectRevert(FractionalPropertyToken.FractionalPropertyToken__ExceedsMaxSupply.selector);
        token.mint(investor1, 1);
    }
    
    function test_BurnReducesTotalSupply() public {
        uint256 initialTotal = token.totalSupply();
        uint256 burnAmount = 100 * 1e18;
        
        vm.prank(treasury);
        token.burn(treasury,burnAmount);
        
        assertEq(token.totalSupply(), initialTotal - burnAmount);
    }
    
    // ==================== FUZZ TESTS ====================
    
    function testFuzz_MintTokens(address recipient, uint256 amount) public {
        vm.assume(recipient != address(0));
        vm.assume(amount > 0 && amount <= INITIAL_SUPPLY);
        vm.prank(admin);
        token.mint(recipient, amount);
        assertEq(token.balanceOf(recipient), amount);
    }
    
    function testFuzz_Transfer(uint256 amount) public {
        vm.assume(amount > 0 && amount <= INITIAL_SUPPLY);
        
        vm.prank(admin);
        token.enableTrading();
        
        vm.prank(treasury);
        token.transfer(investor1, amount);
        
        assertEq(token.balanceOf(investor1), amount);
    }
    
    function testFuzz_Approve(address spender, uint256 amount) public {
        vm.assume(spender != address(0));
        vm.assume(amount <= type(uint256).max);
        
        vm.prank(treasury);
        token.approve(spender, amount);
        
        assertEq(token.allowance(treasury, spender), amount);
    }
}