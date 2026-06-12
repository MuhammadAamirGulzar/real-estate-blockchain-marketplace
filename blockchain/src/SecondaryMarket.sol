// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20; // CHANGED FROM ^0.8.30

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IRWAToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IKYCRegistry {
    function isKYCApproved(address investor) external view returns (bool);
}

interface IAssetRegistry {
    function propertyCounter() external view returns (uint256);
    function properties(uint256 propertyId) external view returns (
        uint256 id,
        address owner,
        string memory metadataHash,
        uint8 status,
        address assignedVerifier,
        uint256 listedAt,
        uint256 verifiedAt,
        string memory rejectionReason
    );
    function assetExists(uint256 assetId) external view returns (bool);
    function isAssetTokenized(uint256 assetId) external view returns (bool);
    function getAssetOwner(uint256 assetId) external view returns (address);
}

interface IPropertyNFT {
    function propertyExists(uint256 assetRegistryId) external view returns (bool);
}

/// @title Secondary Market - Upgradeable
/// @notice Facilitates peer-to-peer trading of tokenized RWA assets
/// @dev Uses UUPS proxy pattern for upgradeability
contract SecondaryMarket is 
    Initializable,
    AccessControlUpgradeable, 
    ReentrancyGuardUpgradeable, 
    PausableUpgradeable,
    UUPSUpgradeable 
{
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    
    enum OrderType { SELL, BUY }
    enum OrderStatus { ACTIVE, CANCELLED, COMPLETED, EXPIRED }
    
    struct Order {
        uint256 orderId;
        address trader;
        uint256 assetId;
        uint256 tokenAmount;
        uint256 pricePerToken;
        OrderType orderType;
        OrderStatus status;
        uint256 createdAt;
        uint256 expiresAt;
        uint256 filledAmount;
        bool isActive;
    }
    
    struct Trade {
        uint256 orderId;
        address buyer;
        address seller;
        uint256 assetId;
        uint256 amount;
        uint256 pricePerToken;
        uint256 totalPrice;
        uint256 fee;
        uint256 timestamp;
    }
    
    // Storage
    mapping(uint256 => Order) public orders;
    mapping(uint256 => Trade[]) public orderTrades;
    mapping(address => uint256[]) public userOrders;
    mapping(uint256 => uint256[]) public assetOrders; // assetId => orderIds
    uint256 public nextOrderId;
    uint256 public nextTradeId;
    
    // External contracts
    IRWAToken public rwaToken;
    IKYCRegistry public kycRegistry;
    IAssetRegistry public assetRegistry;
    
    // Trading settings
    uint256 public tradingFee; // Basis points (e.g., 25 = 0.25%)
    address public feeCollector;
    uint256 public minOrderAmount;
    uint256 public maxOrderDuration;
    bool public kycRequired;
    IPropertyNFT public propertyNFT;
    
    /// @dev Storage gap for future upgrades
    uint256[49] private __gap;
    
    // Events
    event OrderCreated(
        uint256 indexed orderId,
        address indexed trader,
        uint256 indexed assetId,
        uint256 tokenAmount,
        uint256 pricePerToken,
        OrderType orderType
    );
    event OrderExecuted(
        uint256 indexed orderId,
        uint256 indexed tradeId,
        address indexed buyer,
        address seller,
        uint256 assetId,
        uint256 amount,
        uint256 pricePerToken,
        uint256 totalPrice
    );
    event OrderCancelled(uint256 indexed orderId, address indexed trader);
    event OrderExpired(uint256 indexed orderId);
    event TradingFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event SettingsUpdated(uint256 minOrderAmount, uint256 maxOrderDuration, bool kycRequired);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the contract
    /// @param admin Admin address
    /// @param rwaTokenAddress RWA token contract address
    /// @param kycRegistryAddress KYC registry contract address
    /// @param assetRegistryAddress Asset registry contract address
    /// @param feeCollectorAddress Fee collector address
    function initialize(
        address admin,
        address rwaTokenAddress,
        address kycRegistryAddress,
        address assetRegistryAddress,
        address feeCollectorAddress
    ) public initializer {
        require(admin != address(0), "Market: admin is zero");
        require(rwaTokenAddress != address(0), "Market: token is zero");
        require(kycRegistryAddress != address(0), "Market: kyc is zero");
        require(assetRegistryAddress != address(0), "Market: registry is zero");
        require(feeCollectorAddress != address(0), "Market: collector is zero");
        
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(COMPLIANCE_ROLE, admin);
        
        rwaToken = IRWAToken(rwaTokenAddress);
        kycRegistry = IKYCRegistry(kycRegistryAddress);
        assetRegistry = IAssetRegistry(assetRegistryAddress);
        propertyNFT = IPropertyNFT(address(0));
        feeCollector = feeCollectorAddress;
        
        tradingFee = 25; // 0.25%
        minOrderAmount = 1e15; // 0.001 tokens
        maxOrderDuration = 30 days;
        kycRequired = true;
        nextOrderId = 1;
        nextTradeId = 1;
    }

    // ----------------------
    // Upgrade authorization
    // ----------------------

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ----------------------
    // Order Management
    // ----------------------

    /// @notice Create a sell order
    /// @param assetId Asset identifier
    /// @param tokenAmount Amount of tokens to sell
    /// @param pricePerToken Price per token in wei
    /// @param duration Order duration in seconds
    function createSellOrder(
        uint256 assetId,
        uint256 tokenAmount,
        uint256 pricePerToken,
        uint256 duration
    ) external whenNotPaused nonReentrant returns (uint256) {
        return _createOrder(assetId, tokenAmount, pricePerToken, duration, OrderType.SELL);
    }

    /// @notice Create a buy order
    /// @param assetId Asset identifier
    /// @param tokenAmount Amount of tokens to buy
    /// @param pricePerToken Price per token in wei
    /// @param duration Order duration in seconds
    function createBuyOrder(
        uint256 assetId,
        uint256 tokenAmount,
        uint256 pricePerToken,
        uint256 duration
    ) external payable whenNotPaused nonReentrant returns (uint256) {
        // SCALE: (amount * price) / 1e18
        uint256 totalValue = (tokenAmount * pricePerToken) / 1e18;
        uint256 fee = (totalValue * tradingFee) / 10000;
        require(msg.value >= totalValue + fee, "Market: insufficient payment");
        
        return _createOrder(assetId, tokenAmount, pricePerToken, duration, OrderType.BUY);
    }

    /// @notice Execute a sell order (buy tokens)
    /// @param orderId Order identifier
    /// @param amount Amount of tokens to buy
    function executeSellOrder(
        uint256 orderId,
        uint256 amount
    ) external payable whenNotPaused nonReentrant {
        Order storage order = orders[orderId];
        require(order.isActive, "Market: order not active");
        require(order.orderType == OrderType.SELL, "Market: not a sell order");
        require(amount > 0 && amount <= order.tokenAmount - order.filledAmount, "Market: invalid amount");
        require(block.timestamp <= order.expiresAt, "Market: order expired");

        if (kycRequired) {
            require(kycRegistry.isKYCApproved(msg.sender), "Market: buyer not KYC approved");
        }

        // SCALE: (amount * price) / 1e18
        uint256 totalPrice = (amount * order.pricePerToken) / 1e18;
        uint256 fee = (totalPrice * tradingFee) / 10000;
        require(msg.value >= totalPrice + fee, "Market: insufficient payment");

        require(rwaToken.transfer(msg.sender, amount), "Market: token transfer failed");

        (bool sellerSuccess, ) = order.trader.call{value: totalPrice}("");
        require(sellerSuccess, "Market: seller payment failed");

        if (fee > 0) {
            (bool feeSuccess, ) = feeCollector.call{value: fee}("");
            require(feeSuccess, "Market: fee transfer failed");
        }

        uint256 excess = msg.value - totalPrice - fee;
        if (excess > 0) {
            (bool refundSuccess, ) = msg.sender.call{value: excess}("");
            require(refundSuccess, "Market: refund failed");
        }

        _completeTrade(orderId, msg.sender, order.trader, amount, order.pricePerToken, totalPrice, fee);
    }

    /// @notice Execute a buy order (sell tokens)
    /// @param orderId Order identifier
    /// @param amount Amount of tokens to sell
    function executeBuyOrder(
        uint256 orderId,
        uint256 amount
    ) external whenNotPaused nonReentrant {
        Order storage order = orders[orderId];
        require(order.isActive, "Market: order not active");
        require(order.orderType == OrderType.BUY, "Market: not a buy order");
        require(amount > 0 && amount <= order.tokenAmount - order.filledAmount, "Market: invalid amount");
        require(block.timestamp <= order.expiresAt, "Market: order expired");

        if (kycRequired) {
            require(kycRegistry.isKYCApproved(msg.sender), "Market: seller not KYC approved");
        }

        require(rwaToken.balanceOf(msg.sender) >= amount, "Market: insufficient tokens");
        require(rwaToken.transferFrom(msg.sender, order.trader, amount), "Market: token transfer failed");

        // SCALE: (amount * price) / 1e18
        uint256 totalPrice = (amount * order.pricePerToken) / 1e18;
        uint256 fee = (totalPrice * tradingFee) / 10000;
        uint256 sellerPayment = totalPrice - fee;

        (bool sellerSuccess, ) = msg.sender.call{value: sellerPayment}("");
        require(sellerSuccess, "Market: seller payment failed");

        if (fee > 0) {
            (bool feeSuccess, ) = feeCollector.call{value: fee}("");
            require(feeSuccess, "Market: fee transfer failed");
        }

        _completeTrade(orderId, order.trader, msg.sender, amount, order.pricePerToken, totalPrice, fee);
    }

    /// @notice Cancel an order
    /// @param orderId Order identifier
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.isActive, "Market: order not active");
        require(msg.sender == order.trader, "Market: not order owner");

        order.isActive = false;
        order.status = OrderStatus.CANCELLED;

        if (order.orderType == OrderType.SELL) {
            uint256 remainingAmount = order.tokenAmount - order.filledAmount;
            if (remainingAmount > 0) {
                require(rwaToken.transfer(order.trader, remainingAmount), "Market: token return failed");
            }
        } else {
            uint256 remainingAmount = order.tokenAmount - order.filledAmount;
            // SCALE: (amount * price) / 1e18
            uint256 remainingValue = (remainingAmount * order.pricePerToken) / 1e18;
            uint256 remainingFee = (remainingValue * tradingFee) / 10000;
            uint256 totalRefund = remainingValue + remainingFee;
            
            if (totalRefund > 0) {
                (bool success, ) = order.trader.call{value: totalRefund}("");
                require(success, "Market: refund failed");
            }
        }

        emit OrderCancelled(orderId, order.trader);
    }

    /// @notice Expire an order (admin function)
    /// @param orderId Order identifier
    function expireOrder(uint256 orderId) external onlyRole(OPERATOR_ROLE) {
        Order storage order = orders[orderId];
        require(order.isActive, "Market: order not active");
        require(block.timestamp > order.expiresAt, "Market: order not expired");

        order.isActive = false;
        order.status = OrderStatus.EXPIRED;

        if (order.orderType == OrderType.SELL) {
            // Return tokens to seller
            uint256 remainingAmount = order.tokenAmount - order.filledAmount;
            if (remainingAmount > 0) {
                require(rwaToken.transfer(order.trader, remainingAmount), "Market: token return failed");
            }
        } else {
            // Return ETH to buyer
            uint256 remainingAmount = order.tokenAmount - order.filledAmount;
            uint256 remainingValue = remainingAmount * order.pricePerToken;
            uint256 remainingFee = (remainingValue * tradingFee) / 10000;
            uint256 totalRefund = remainingValue + remainingFee;
            
            if (totalRefund > 0) {
                (bool success, ) = order.trader.call{value: totalRefund}("");
                require(success, "Market: refund failed");
            }
        }

        emit OrderExpired(orderId);
    }

    // ----------------------
    // Internal Functions
    // ----------------------

    function _createOrder(
        uint256 assetId,
        uint256 tokenAmount,
        uint256 pricePerToken,
        uint256 duration,
        OrderType orderType
    ) internal returns (uint256) {
        require(_assetExists(assetId), "Market: asset does not exist");
        require(_isAssetTokenized(assetId), "Market: asset not tokenized");
        require(tokenAmount >= minOrderAmount, "Market: amount below minimum");
        require(pricePerToken > 0, "Market: invalid price");
        require(duration > 0 && duration <= maxOrderDuration, "Market: invalid duration");

        // KYC check
        if (kycRequired) {
            require(kycRegistry.isKYCApproved(msg.sender), "Market: trader not KYC approved");
        }

        if (orderType == OrderType.SELL) {
            // For sell orders, transfer tokens to contract
            require(rwaToken.balanceOf(msg.sender) >= tokenAmount, "Market: insufficient tokens");
            require(rwaToken.transferFrom(msg.sender, address(this), tokenAmount), "Market: token transfer failed");
        }

        uint256 orderId = nextOrderId++;
        
        orders[orderId] = Order({
            orderId: orderId,
            trader: msg.sender,
            assetId: assetId,
            tokenAmount: tokenAmount,
            pricePerToken: pricePerToken,
            orderType: orderType,
            status: OrderStatus.ACTIVE,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + duration,
            filledAmount: 0,
            isActive: true
        });

        userOrders[msg.sender].push(orderId);
        assetOrders[assetId].push(orderId);

        emit OrderCreated(orderId, msg.sender, assetId, tokenAmount, pricePerToken, orderType);
        
        return orderId;
    }

    function _completeTrade(
        uint256 orderId,
        address buyer,
        address seller,
        uint256 amount,
        uint256 pricePerToken,
        uint256 totalPrice,
        uint256 fee
    ) internal {
        Order storage order = orders[orderId];
        order.filledAmount += amount;

        // Check if order is fully filled
        if (order.filledAmount >= order.tokenAmount) {
            order.isActive = false;
            order.status = OrderStatus.COMPLETED;
        }

        // Record trade
        uint256 tradeId = nextTradeId++;
        Trade memory trade = Trade({
            orderId: orderId,
            buyer: buyer,
            seller: seller,
            assetId: order.assetId,
            amount: amount,
            pricePerToken: pricePerToken,
            totalPrice: totalPrice,
            fee: fee,
            timestamp: block.timestamp
        });

        orderTrades[orderId].push(trade);

        emit OrderExecuted(orderId, tradeId, buyer, seller, order.assetId, amount, pricePerToken, totalPrice);
    }

    function _assetExists(uint256 assetId) internal view returns (bool) {
        if (assetId == 0) {
            return false;
        }

        // Preferred path for current AssetRegistry implementation
        try assetRegistry.propertyCounter() returns (uint256 count) {
            if (assetId <= count) {
                try assetRegistry.properties(assetId) returns (
                    uint256,
                    address owner,
                    string memory,
                    uint8,
                    address,
                    uint256,
                    uint256,
                    string memory
                ) {
                    return owner != address(0);
                } catch {
                    return true;
                }
            }
            return false;
        } catch {
            // Backward compatibility with older registry interface
            try assetRegistry.assetExists(assetId) returns (bool exists) {
                return exists;
            } catch {
                return false;
            }
        }
    }

    function _isAssetTokenized(uint256 assetId) internal view returns (bool) {
        if (address(propertyNFT) != address(0)) {
            try propertyNFT.propertyExists(assetId) returns (bool tokenized) {
                return tokenized;
            } catch {}
        }

        // Backward compatibility with older registry interface
        try assetRegistry.isAssetTokenized(assetId) returns (bool tokenizedLegacy) {
            return tokenizedLegacy;
        } catch {
            // If no tokenization API exists, assume configured propertyNFT should be used.
            return false;
        }
    }

    // ----------------------
    // Admin Functions
    // ----------------------

    function setTradingFee(uint256 newFee) external onlyRole(OPERATOR_ROLE) {
        require(newFee <= 1000, "Market: fee too high"); // Max 10%
        uint256 oldFee = tradingFee;
        tradingFee = newFee;
        emit TradingFeeUpdated(oldFee, newFee);
    }

    function setFeeCollector(address newCollector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newCollector != address(0), "Market: collector is zero");
        address oldCollector = feeCollector;
        feeCollector = newCollector;
        emit FeeCollectorUpdated(oldCollector, newCollector);
    }

    function setSettings(
        uint256 newMinOrderAmount,
        uint256 newMaxOrderDuration,
        bool newKycRequired
    ) external onlyRole(COMPLIANCE_ROLE) {
        minOrderAmount = newMinOrderAmount;
        maxOrderDuration = newMaxOrderDuration;
        kycRequired = newKycRequired;
        emit SettingsUpdated(newMinOrderAmount, newMaxOrderDuration, newKycRequired);
    }

    function setContracts(
        address newRWAToken,
        address newKYCRegistry,
        address newAssetRegistry
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newRWAToken != address(0)) rwaToken = IRWAToken(newRWAToken);
        if (newKYCRegistry != address(0)) kycRegistry = IKYCRegistry(newKYCRegistry);
        if (newAssetRegistry != address(0)) assetRegistry = IAssetRegistry(newAssetRegistry);
    }

    function setPropertyNFT(address newPropertyNFT) external onlyRole(DEFAULT_ADMIN_ROLE) {
        propertyNFT = IPropertyNFT(newPropertyNFT);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ----------------------
    // View Functions
    // ----------------------

    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    function getUserOrders(address user) external view returns (uint256[] memory) {
        return userOrders[user];
    }

    function getAssetOrders(uint256 assetId) external view returns (uint256[] memory) {
        return assetOrders[assetId];
    }

    function getOrderTrades(uint256 orderId) external view returns (Trade[] memory) {
        return orderTrades[orderId];
    }

    function getActiveOrders(uint256 assetId) external view returns (uint256[] memory) {
        uint256[] memory assetOrderList = assetOrders[assetId];
        uint256[] memory activeOrders = new uint256[](assetOrderList.length);
        uint256 count = 0;

        for (uint256 i = 0; i < assetOrderList.length; i++) {
            if (orders[assetOrderList[i]].isActive && block.timestamp <= orders[assetOrderList[i]].expiresAt) {
                activeOrders[count] = assetOrderList[i];
                count++;
            }
        }

        // Resize array
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeOrders[i];
        }

        return result;
    }

    function isOrderActive(uint256 orderId) external view returns (bool) {
        Order memory order = orders[orderId];
        return order.isActive && block.timestamp <= order.expiresAt;
    }

    function version() external pure returns (string memory) {
        return "2.1.0";
    }

    // ----------------------
    // Receive Function
    // ----------------------

    receive() external payable {
        revert("Market: direct payments not allowed");
    }
}