// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/SecondaryMarket.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

interface IUUPSUpgradeableProxy {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    function upgradeTo(address newImplementation) external;
}

error EnforcedPause();

// Mock contracts for testing
contract MockRWAToken {
    mapping(address => mapping(uint256 => uint256)) public userAssetBalance;
    mapping(address => uint256) public balances;
    mapping(address => mapping(address => uint256)) public allowances;
    
    function setUserAssetBalance(address user, uint256 assetId, uint256 balance) external {
        userAssetBalance[user][assetId] = balance;
    }
    
    function setBalance(address user, uint256 balance) external {
        balances[user] = balance;
    }
    
    function getUserAssetBalance(address user, uint256 assetId) external view returns (uint256) {
        return userAssetBalance[user][assetId];
    }
    
    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        balances[to] += amount;
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balances[from] >= amount, "Insufficient balance");
        require(allowances[from][msg.sender] >= amount, "Insufficient allowance");
        
        balances[from] -= amount;
        balances[to] += amount;
        allowances[from][msg.sender] -= amount;
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowances[msg.sender][spender] = amount;
        return true;
    }
    
    function assetExists(uint256 assetId) external pure returns (bool) {
        return assetId > 0;
    }
}

contract MockKYCRegistry {
    mapping(address => bool) public kycApproved;
    
    function setKYCApproved(address user, bool approved) external {
        kycApproved[user] = approved;
    }
    
    function isKYCApproved(address user) external view returns (bool) {
        return kycApproved[user];
    }
}

contract MockAssetRegistry {
    mapping(uint256 => bool) public assetExists;
    mapping(uint256 => bool) public assetTokenized;
    mapping(uint256 => address) public assetOwner;
    
    function setAsset(uint256 assetId, bool exists, bool tokenized, address owner) external {
        assetExists[assetId] = exists;
        assetTokenized[assetId] = tokenized;
        assetOwner[assetId] = owner;
    }
    
    function isAssetTokenized(uint256 assetId) external view returns (bool) {
        return assetTokenized[assetId];
    }
    
    function getAssetOwner(uint256 assetId) external view returns (address) {
        return assetOwner[assetId];
    }
}

contract SecondaryMarketTest is Test {
    SecondaryMarket public market;
    SecondaryMarket public implementation;
    ERC1967Proxy public proxy;
    MockRWAToken public rwaToken;
    MockKYCRegistry public kycRegistry;
    MockAssetRegistry public assetRegistry;
    
    address public admin = makeAddr("admin");
    address public seller = makeAddr("seller");
    address public buyer = makeAddr("buyer");
    address public feeCollector = makeAddr("feeCollector");
    
    uint256 public constant ASSET_ID = 1;
    uint256 public constant TOKEN_AMOUNT = 100e18;
    uint256 public constant PRICE_PER_TOKEN = 1e18; // 1 ETH per token

    event OrderCreated(
        uint256 indexed orderId,
        address indexed trader,
        uint256 indexed assetId,
        uint256 tokenAmount,
        uint256 pricePerToken,
        SecondaryMarket.OrderType orderType
    );

    function setUp() public {
        // Deploy mock contracts
        rwaToken = new MockRWAToken();
        kycRegistry = new MockKYCRegistry();
        assetRegistry = new MockAssetRegistry();
        
        // Set up mock data
        kycRegistry.setKYCApproved(admin, true);
        kycRegistry.setKYCApproved(seller, true);
        kycRegistry.setKYCApproved(buyer, true);
        
        assetRegistry.setAsset(ASSET_ID, true, true, seller);
        
        rwaToken.setUserAssetBalance(seller, ASSET_ID, TOKEN_AMOUNT);
        rwaToken.setBalance(seller, TOKEN_AMOUNT);
        
        // Deploy implementation
        implementation = new SecondaryMarket();
        
        // Deploy proxy and initialize
        bytes memory initData = abi.encodeWithSelector(
            SecondaryMarket.initialize.selector,
            admin,
            address(rwaToken),
            address(kycRegistry),
            address(assetRegistry),
            feeCollector
        );
        proxy = new ERC1967Proxy(address(implementation), initData);
        market = SecondaryMarket(payable(address(proxy)));
        
        // Give test accounts ETH
        vm.deal(buyer, 1000 ether);
        vm.deal(seller, 1000 ether);
        vm.deal(admin, 1000 ether);
    }

    function test_Initialize() public view {
        assertTrue(market.hasRole(market.DEFAULT_ADMIN_ROLE(), admin));
        assertEq(market.tradingFee(), 25);
        assertEq(market.feeCollector(), feeCollector);
        assertEq(market.version(), "2.0.0");
    }

    function test_CreateSellOrder() public {
        // Approve market to spend tokens
        vm.prank(seller);
        rwaToken.approve(address(market), TOKEN_AMOUNT);
        
        vm.startPrank(seller);
        
        vm.expectEmit(true, true, true, true);
        emit OrderCreated(1, seller, ASSET_ID, TOKEN_AMOUNT, PRICE_PER_TOKEN, SecondaryMarket.OrderType.SELL);
        
        uint256 orderId = market.createSellOrder(ASSET_ID, TOKEN_AMOUNT, PRICE_PER_TOKEN, 7 days);
        
        assertEq(orderId, 1);
        
        SecondaryMarket.Order memory order = market.getOrder(orderId);
        assertEq(order.trader, seller);
        assertEq(order.assetId, ASSET_ID);
        assertEq(order.tokenAmount, TOKEN_AMOUNT);
        assertEq(order.pricePerToken, PRICE_PER_TOKEN);
        assertTrue(order.isActive);
        assertEq(uint8(order.orderType), uint8(SecondaryMarket.OrderType.SELL));
        
        vm.stopPrank();
    }

    function test_CreateBuyOrder() public {
        uint256 totalValue = (TOKEN_AMOUNT * PRICE_PER_TOKEN) / 1e18;
        uint256 fee = (totalValue * 25) / 10000; // 0.25%
        uint256 totalPayment = totalValue + fee;
        
        vm.startPrank(buyer);
        uint256 orderId = market.createBuyOrder{value: totalPayment}(
            ASSET_ID, 
            TOKEN_AMOUNT, 
            PRICE_PER_TOKEN, 
            7 days
        );
        assertEq(orderId, 1);
        SecondaryMarket.Order memory order = market.getOrder(orderId);
        assertEq(order.trader, buyer);
        assertEq(uint8(order.orderType), uint8(SecondaryMarket.OrderType.BUY));
        vm.stopPrank();
    }

    function test_ExecuteSellOrder() public {
        vm.prank(seller);
        rwaToken.approve(address(market), TOKEN_AMOUNT);
        vm.prank(seller);
        uint256 orderId = market.createSellOrder(ASSET_ID, TOKEN_AMOUNT, PRICE_PER_TOKEN, 7 days);
        
        uint256 buyAmount = 50e18;
        uint256 totalPrice = (buyAmount * PRICE_PER_TOKEN) / 1e18;
        uint256 fee = (totalPrice * 25) / 10000;
        uint256 totalPayment = totalPrice + fee;
        
        uint256 sellerBalanceBefore = seller.balance;
        uint256 feeCollectorBalanceBefore = feeCollector.balance;
        
        vm.startPrank(buyer);
        market.executeSellOrder{value: totalPayment}(orderId, buyAmount);
        uint256 sellerBalanceAfter = seller.balance;
        uint256 feeCollectorBalanceAfter = feeCollector.balance;
        assertEq(sellerBalanceAfter - sellerBalanceBefore, totalPrice);
        assertEq(feeCollectorBalanceAfter - feeCollectorBalanceBefore, fee);
        assertEq(rwaToken.balanceOf(buyer), buyAmount);
        vm.stopPrank();
    }

    function test_ExecuteBuyOrder() public {
        uint256 totalValue = (TOKEN_AMOUNT * PRICE_PER_TOKEN) / 1e18;
        uint256 fee = (totalValue * 25) / 10000;
        uint256 totalPayment = totalValue + fee;
        
        vm.prank(buyer);
        uint256 orderId = market.createBuyOrder{value: totalPayment}(
            ASSET_ID, 
            TOKEN_AMOUNT, 
            PRICE_PER_TOKEN, 
            7 days
        );
        
        vm.prank(seller);
        rwaToken.approve(address(market), TOKEN_AMOUNT);
        
        uint256 sellerBalanceBefore = seller.balance;
        vm.startPrank(seller);
        market.executeBuyOrder(orderId, TOKEN_AMOUNT);
        uint256 sellerBalanceAfter = seller.balance;
        uint256 sellerPayment = totalValue - fee;
        assertEq(sellerBalanceAfter - sellerBalanceBefore, sellerPayment);
        vm.stopPrank();
    }

    function test_CancelBuyOrder() public {
        uint256 totalValue = (TOKEN_AMOUNT * PRICE_PER_TOKEN) / 1e18;
        uint256 fee = (totalValue * 25) / 10000;
        uint256 totalPayment = totalValue + fee;

        vm.prank(buyer);
        uint256 orderId = market.createBuyOrder{value: totalPayment}(
            ASSET_ID, 
            TOKEN_AMOUNT, 
            PRICE_PER_TOKEN, 
            7 days
        );
        
        uint256 buyerBalanceBefore = buyer.balance;
        vm.prank(buyer);
        market.cancelOrder(orderId);
        uint256 buyerBalanceAfter = buyer.balance;

        SecondaryMarket.Order memory order = market.getOrder(orderId);
        assertFalse(order.isActive);
        assertEq(buyerBalanceAfter - buyerBalanceBefore, totalPayment);
    }

    function test_PauseUnpause() public {
        vm.startPrank(admin);
        market.pause();
        assertTrue(market.paused());
        vm.stopPrank();

        vm.startPrank(seller);
        rwaToken.approve(address(market), TOKEN_AMOUNT);
        vm.expectRevert(EnforcedPause.selector);
        market.createSellOrder(ASSET_ID, TOKEN_AMOUNT, PRICE_PER_TOKEN, 7 days);
        vm.stopPrank();

        vm.startPrank(admin);
        market.unpause();
        assertFalse(market.paused());
        vm.stopPrank();
    }

    function test_RevertExecuteOrderWithoutKYC() public {
        vm.prank(seller);
        rwaToken.approve(address(market), TOKEN_AMOUNT);
        vm.prank(seller);
        uint256 orderId = market.createSellOrder(ASSET_ID, TOKEN_AMOUNT, PRICE_PER_TOKEN, 7 days);

        kycRegistry.setKYCApproved(buyer, false);

        uint256 totalPayment = (TOKEN_AMOUNT * PRICE_PER_TOKEN) / 1e18;
        uint256 fee = (totalPayment * 25) / 10000;
        uint256 fullPayment = totalPayment + fee;

        vm.startPrank(buyer);
        vm.expectRevert(bytes("Market: buyer not KYC approved"));
        market.executeSellOrder{value: fullPayment}(orderId, TOKEN_AMOUNT);
        vm.stopPrank();
    }

    function test_OnlyAdminCanUpgrade() public {
        SecondaryMarket newImplementation = new SecondaryMarket();
        
        vm.startPrank(seller);
        vm.expectRevert();
        IUUPSUpgradeableProxy(address(market)).upgradeToAndCall(address(newImplementation), "");
        vm.stopPrank();
        
        vm.startPrank(admin);
        IUUPSUpgradeableProxy(address(market)).upgradeToAndCall(address(newImplementation), "");
        vm.stopPrank();
    }

    function test_UpgradePreservesState() public {
        vm.prank(seller);
        rwaToken.approve(address(market), TOKEN_AMOUNT);
        vm.prank(seller);
        uint256 orderId = market.createSellOrder(ASSET_ID, TOKEN_AMOUNT, PRICE_PER_TOKEN, 7 days);
        
        SecondaryMarket newImplementation = new SecondaryMarket();
        vm.startPrank(admin);
        IUUPSUpgradeableProxy(address(market)).upgradeToAndCall(address(newImplementation), "");

        SecondaryMarket.Order memory order = market.getOrder(orderId);
        assertEq(order.trader, seller);
        assertTrue(order.isActive);
        vm.stopPrank();
    }
}