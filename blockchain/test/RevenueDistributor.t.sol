// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/RevenueDistributor.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

interface IUUPSUpgradeableProxy {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    function upgradeTo(address newImplementation) external; // optional
}

error EnforcedPause();

// Mock contracts for testing
contract MockRWAToken {
    mapping(address => mapping(uint256 => uint256)) public userAssetBalance;
    mapping(uint256 => uint256) public assetTotalSupply;
    mapping(uint256 => bool) public assetExists;
    
    function setUserAssetBalance(address user, uint256 assetId, uint256 balance) external {
        userAssetBalance[user][assetId] = balance;
    }
    
    function setAssetTotalSupply(uint256 assetId, uint256 supply) external {
        assetTotalSupply[assetId] = supply;
    }
    
    function setAssetExists(uint256 assetId, bool exists) external {
        assetExists[assetId] = exists;
    }
    
    function getUserAssetBalance(address user, uint256 assetId) external view returns (uint256) {
        return userAssetBalance[user][assetId];
    }
    
    function getAssetTotalSupply(uint256 assetId) external view returns (uint256) {
        return assetTotalSupply[assetId];
    }
    
    function balanceOf(address account) external view returns (uint256) {
        return 0; // Not used in asset-specific distribution
    }
    
    function totalSupply() external view returns (uint256) {
        return 0; // Not used in asset-specific distribution
    }
}

contract MockAssetRegistry {
    mapping(uint256 => bool) public assetExists;
    mapping(uint256 => address) public assetOwner;
    mapping(uint256 => bool) public assetTokenized;
    
    function setAsset(uint256 assetId, bool exists, address owner, bool tokenized) external {
        assetExists[assetId] = exists;
        assetOwner[assetId] = owner;
        assetTokenized[assetId] = tokenized;
    }
    
    function getAssetOwner(uint256 assetId) external view returns (address) {
        return assetOwner[assetId];
    }
    
    function isAssetTokenized(uint256 assetId) external view returns (bool) {
        return assetTokenized[assetId];
    }
}

contract RevenueDistributorTest is Test {
    RevenueDistributor public revenueDistributor;
    RevenueDistributor public implementation;
    ERC1967Proxy public proxy;
    MockRWAToken public rwaToken;
    MockAssetRegistry public assetRegistry;
    
    address public admin = makeAddr("admin");
    address public assetOwner = makeAddr("assetOwner");
    address public investor1 = makeAddr("investor1");
    address public investor2 = makeAddr("investor2");
    address public feeCollector = makeAddr("feeCollector");
    
    uint256 public constant ASSET_ID = 1;
    uint256 public constant TOTAL_SUPPLY = 1000e18;

    event RevenueDeposited(uint256 indexed assetId, address indexed depositor, uint256 amount);
    event RevenueClaimed(uint256 indexed assetId, address indexed investor, uint256 amount);

    function setUp() public {
        // Deploy mock contracts
        rwaToken = new MockRWAToken();
        assetRegistry = new MockAssetRegistry();
        
        // Set up mock data
        assetRegistry.setAsset(ASSET_ID, true, assetOwner, true);
        rwaToken.setAssetExists(ASSET_ID, true);
        rwaToken.setAssetTotalSupply(ASSET_ID, TOTAL_SUPPLY);
        rwaToken.setUserAssetBalance(investor1, ASSET_ID, 300e18); // 30%
        rwaToken.setUserAssetBalance(investor2, ASSET_ID, 200e18); // 20%
        
        // Deploy implementation
        implementation = new RevenueDistributor();
        
        // Deploy proxy and initialize
        bytes memory initData = abi.encodeWithSelector(
            RevenueDistributor.initialize.selector,
            admin,
            address(rwaToken),
            address(assetRegistry)
        );
        proxy = new ERC1967Proxy(address(implementation), initData);
        revenueDistributor = RevenueDistributor(payable(address(proxy)));

        // Set fee collector
        vm.prank(admin);
        revenueDistributor.setFeeCollector(feeCollector);

        // Give test accounts some ETH
        vm.deal(assetOwner, 100 ether);
        vm.deal(admin, 100 ether);
    }

    function test_Initialize() public view {
        assertTrue(revenueDistributor.hasRole(revenueDistributor.DEFAULT_ADMIN_ROLE(), admin));
        assertEq(revenueDistributor.minimumDistribution(), 1e15);
        assertEq(revenueDistributor.distributionFee(), 250); // 2.5%
        assertEq(revenueDistributor.version(), "2.0.0");
    }

    function test_DepositRevenue() public {
        uint256 depositAmount = 10 ether;
        uint256 expectedFee = (depositAmount * 250) / 10000; // 2.5%
        uint256 expectedNet = depositAmount - expectedFee;
        
        vm.startPrank(assetOwner);
        
        vm.expectEmit(true, true, false, true);
        emit RevenueDeposited(ASSET_ID, assetOwner, expectedNet);
        
        revenueDistributor.depositRevenue{value: depositAmount}(ASSET_ID);

        RevenueDistributor.AssetRevenue memory revenue = revenueDistributor.getAssetRevenueInfo(ASSET_ID);
        assertEq(revenue.totalDeposited, expectedNet);
        assertTrue(revenue.isActive);
        assertEq(revenue.totalClaimed, 0);
        
        vm.stopPrank();
    }

    function test_ClaimRevenue() public {
        // First deposit revenue
        uint256 depositAmount = 10 ether;
        vm.prank(assetOwner);
        revenueDistributor.depositRevenue{value: depositAmount}(ASSET_ID);
        
        // Calculate expected claim for investor1 (30% of net revenue)
        uint256 fee = (depositAmount * 250) / 10000;
        uint256 netRevenue = depositAmount - fee;
        uint256 expectedClaim = (netRevenue * 300e18) / TOTAL_SUPPLY; // 30%
        
        uint256 balanceBefore = investor1.balance;
        
        vm.startPrank(investor1);
        
        vm.expectEmit(true, true, false, true);
        emit RevenueClaimed(ASSET_ID, investor1, expectedClaim);
        
        revenueDistributor.claimRevenue(ASSET_ID);
        
        uint256 balanceAfter = investor1.balance;
        assertEq(balanceAfter - balanceBefore, expectedClaim);
        assertEq(revenueDistributor.claimedRevenue(ASSET_ID, investor1), expectedClaim);

        vm.stopPrank();
    }

    function test_BatchClaimRevenue() public {
        // Setup multiple assets
        uint256 assetId2 = 2;
        assetRegistry.setAsset(assetId2, true, assetOwner, true);
        rwaToken.setAssetExists(assetId2, true);
        rwaToken.setAssetTotalSupply(assetId2, TOTAL_SUPPLY);
        rwaToken.setUserAssetBalance(investor1, assetId2, 400e18); // 40%
        
        // Deposit revenue for both assets
        vm.startPrank(assetOwner);
        revenueDistributor.depositRevenue{value: 5 ether}(ASSET_ID);
        revenueDistributor.depositRevenue{value: 3 ether}(assetId2);
        vm.stopPrank();
        
        // Batch claim
        uint256[] memory assetIds = new uint256[](2);
        assetIds[0] = ASSET_ID;
        assetIds[1] = assetId2;
        
        uint256 balanceBefore = investor1.balance;
        
        vm.prank(investor1);
        revenueDistributor.batchClaimRevenue(assetIds);
        
        uint256 balanceAfter = investor1.balance;
        assertTrue(balanceAfter > balanceBefore);
    }

    function test_GetClaimableRevenue() public {
        uint256 depositAmount = 10 ether;
        vm.prank(assetOwner);
        revenueDistributor.depositRevenue{value: depositAmount}(ASSET_ID);
        
        uint256 fee = (depositAmount * 250) / 10000;
        uint256 netRevenue = depositAmount - fee;
        uint256 expectedClaimable = (netRevenue * 300e18) / TOTAL_SUPPLY; // 30%
        
        uint256 claimable = revenueDistributor.getClaimableRevenue(ASSET_ID, investor1);
        assertEq(claimable, expectedClaimable);
    }

    function test_MultipleDepositsAndClaims() public {
        // First deposit
        vm.prank(assetOwner);
        revenueDistributor.depositRevenue{value: 5 ether}(ASSET_ID);
        
        // First claim
        vm.prank(investor1);
        revenueDistributor.claimRevenue(ASSET_ID);
        
        uint256 claimedAfterFirst = revenueDistributor.claimedRevenue(ASSET_ID, investor1);
        
        // Second deposit
        vm.prank(assetOwner);
        revenueDistributor.depositRevenue{value: 3 ether}(ASSET_ID);
        
        // Check new claimable amount
        uint256 newClaimable = revenueDistributor.getClaimableRevenue(ASSET_ID, investor1);
        assertTrue(newClaimable > 0);
        
        // Second claim
        vm.prank(investor1);
        revenueDistributor.claimRevenue(ASSET_ID);

        uint256 totalClaimed = revenueDistributor.claimedRevenue(ASSET_ID, investor1);
        assertTrue(totalClaimed > claimedAfterFirst);
    }

    function test_SetDistributionFee() public {
        vm.startPrank(admin);
        revenueDistributor.setDistributionFee(500); // 5%
        assertEq(revenueDistributor.distributionFee(), 500);
        vm.stopPrank();
    }

    function test_ActivateDeactivateAssetRevenue() public {
        vm.startPrank(admin);
        
        revenueDistributor.deactivateAssetRevenue(ASSET_ID);
        RevenueDistributor.AssetRevenue memory revenue = revenueDistributor.getAssetRevenueInfo(ASSET_ID);
        assertFalse(revenue.isActive);

        revenueDistributor.activateAssetRevenue(ASSET_ID);
        revenue = revenueDistributor.getAssetRevenueInfo(ASSET_ID);
        assertTrue(revenue.isActive);
        
        vm.stopPrank();
    }

    function test_EmergencyWithdraw() public {
        // Deposit revenue
        vm.prank(assetOwner);
        revenueDistributor.depositRevenue{value: 10 ether}(ASSET_ID);
        
        uint256 balanceBefore = admin.balance;
        
        vm.startPrank(admin);
        revenueDistributor.emergencyWithdraw(ASSET_ID, admin);
        
        uint256 balanceAfter = admin.balance;
        assertTrue(balanceAfter > balanceBefore);
        
        // Asset should be deactivated
        RevenueDistributor.AssetRevenue memory revenue = revenueDistributor.getAssetRevenueInfo(ASSET_ID);
        assertFalse(revenue.isActive);
        
        vm.stopPrank();
    }

    function test_RevertDepositBelowMinimum() public {
        vm.startPrank(assetOwner);
        vm.expectRevert("Revenue: below minimum");
        revenueDistributor.depositRevenue{value: 1e14}(ASSET_ID); // Below 1e15 minimum
        vm.stopPrank();
    }

    function test_RevertClaimNoRevenue() public {
        // Ensure asset is active to reach the "no claimable revenue" branch
        vm.prank(admin);
        revenueDistributor.activateAssetRevenue(ASSET_ID);

        // Optional: ensure user has a balance if required by your logic
        // mockToken.userAssetBalance[user1][ASSET_ID] = SOME_BALANCE;

        vm.startPrank(investor1); // was user1
        vm.expectRevert(bytes("Revenue: no claimable revenue"));
        revenueDistributor.claimRevenue(ASSET_ID);
        vm.stopPrank();
    }

    function test_RevertDepositUnauthorized() public {
        // Ensure asset active so we hit the auth check
        vm.prank(admin);
        revenueDistributor.activateAssetRevenue(ASSET_ID);

        address unauthorized = makeAddr("unauthorized");
        vm.deal(unauthorized, 2 ether);

        // Set prank first, then expectRevert, then call
        vm.startPrank(unauthorized);
        vm.expectRevert(bytes("RevenueDistributor: unauthorized depositor"));
        revenueDistributor.depositRevenue{value: 1 ether}(ASSET_ID);
        vm.stopPrank();
    }

    function test_RevertDepositNonTokenizedAsset() public {
        uint256 nonTokenizedAsset = 99;
        assetRegistry.setAsset(nonTokenizedAsset, true, assetOwner, false); // Not tokenized
        
        vm.startPrank(assetOwner);
        vm.expectRevert("Revenue: asset not tokenized");
        revenueDistributor.depositRevenue{value: 1 ether}(nonTokenizedAsset);
        vm.stopPrank();
    }

    function test_OnlyAdminCanUpgrade() public {
        RevenueDistributor newImplementation = new RevenueDistributor();

        vm.startPrank(investor1);
        vm.expectRevert();
        IUUPSUpgradeableProxy(address(revenueDistributor)).upgradeToAndCall(address(newImplementation), "");
        vm.stopPrank();

        vm.startPrank(admin);
        IUUPSUpgradeableProxy(address(revenueDistributor)).upgradeToAndCall(address(newImplementation), "");
        vm.stopPrank();
    }

    function test_UpgradePreservesState() public {
        // Deposit revenue before upgrade
        vm.prank(assetOwner);
        revenueDistributor.depositRevenue{value: 5 ether}(ASSET_ID);

        uint256 revenueBeforeUpgrade = revenueDistributor.getAssetRevenueInfo(ASSET_ID).totalDeposited;

        // Deploy new implementation and upgrade
        RevenueDistributor newImplementation = new RevenueDistributor();

        vm.startPrank(admin);
        IUUPSUpgradeableProxy(address(revenueDistributor)).upgradeToAndCall(address(newImplementation), "");
        vm.stopPrank();

        // Verify state is preserved
        uint256 revenueAfterUpgrade = revenueDistributor.getAssetRevenueInfo(ASSET_ID).totalDeposited;
        assertEq(revenueBeforeUpgrade, revenueAfterUpgrade);
    }

    function test_PauseUnpause() public {
        vm.startPrank(admin);
        revenueDistributor.pause();
        assertTrue(revenueDistributor.paused());

        // Should revert when paused
        vm.stopPrank();
        vm.startPrank(assetOwner);
        vm.expectRevert(EnforcedPause.selector);
        revenueDistributor.depositRevenue{value: 1 ether}(ASSET_ID);
        vm.stopPrank();
        
        // Unpause
        vm.startPrank(admin);
        revenueDistributor.unpause();
        assertFalse(revenueDistributor.paused());
        vm.stopPrank();
    }
}