// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@chainlink/contracts/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/**
 * @title PriceOracle
 * @author RWAchain Team
 * @notice Oracle for managing property valuations and currency exchange rates
 * @dev Integrates Chainlink price feeds with manual admin override capability for fraud prevention
 */
contract PriceOracle is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    // === ROLES ===
    bytes32 public constant ORACLE_MANAGER_ROLE = keccak256("ORACLE_MANAGER_ROLE");
    bytes32 public constant PRICE_UPDATER_ROLE = keccak256("PRICE_UPDATER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // === STRUCTS ===
    struct PriceFeed {
        address chainlinkFeed;      // Chainlink aggregator address
        uint8 decimals;             // Price decimals
        uint256 heartbeat;          // Max seconds before price is stale
        bool isActive;              // Feed enabled status
    }

    struct PropertyPrice {
        uint256 price;              // Property price in USD (18 decimals)
        uint256 lastUpdate;         // Last update timestamp
        string source;              // "chainlink" | "manual" | "api"
        address updatedBy;          // Address that updated the price
        bool isActive;              // Current active price
    }

    struct CurrencyRate {
        uint256 rate;               // Exchange rate (18 decimals)
        uint256 lastUpdate;         // Last update timestamp
        string source;              // Rate source
        bool isActive;              // Active status
    }

    // === STATE VARIABLES ===
    // Currency => Chainlink price feed info
    mapping(string => PriceFeed) public priceFeeds;
    
    // Property ID => Price history
    mapping(uint256 => PropertyPrice[]) public propertyPrices;
    
    // Base currency => Quote currency => Rate
    mapping(string => mapping(string => CurrencyRate)) public exchangeRates;
    
    // Manual override threshold (percentage, 18 decimals) - alerts if price deviates more than this
    uint256 public priceDeviationThreshold;
    
    // Supported currencies list
    string[] public supportedCurrencies;

    // === EVENTS ===
    event PriceFeedSet(string indexed currency, address indexed feedAddress, uint8 decimals);
    event PropertyPriceUpdated(
        uint256 indexed propertyId,
        uint256 newPrice,
        uint256 oldPrice,
        string source,
        address indexed updatedBy
    );
    event ExchangeRateUpdated(
        string indexed baseCurrency,
        string indexed quoteCurrency,
        uint256 rate,
        string source
    );
    event ManualPriceOverride(
        uint256 indexed propertyId,
        uint256 price,
        string reason,
        address indexed admin
    );
    event PriceDeviationThresholdUpdated(uint256 newThreshold);
    event PriceAnomalyDetected(
        uint256 indexed propertyId,
        uint256 newPrice,
        uint256 oldPrice,
        uint256 deviationPercent
    );

    // === ERRORS ===
    error PriceOracle__InvalidAddress();
    error PriceOracle__InvalidPrice();
    error PriceOracle__StalePrice();
    error PriceOracle__FeedNotConfigured();
    error PriceOracle__InvalidCurrency();
    error PriceOracle__PriceDeviationTooHigh();
    error PriceOracle__NoHistoricalPrice();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the PriceOracle contract
     * @param admin Admin address
     */
    function initialize(address admin) public initializer {
        if (admin == address(0)) revert PriceOracle__InvalidAddress();

        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_MANAGER_ROLE, admin);
        _grantRole(PRICE_UPDATER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);

        priceDeviationThreshold = 20e16; // 20% default threshold (18 decimals)
    }

    // === CHAINLINK PRICE FEED MANAGEMENT ===

    /**
     * @notice Set Chainlink price feed for a currency pair
     * @param currency Currency code (e.g., "ETH/USD", "EUR/USD")
     * @param feedAddress Chainlink aggregator address
     * @param heartbeat Max seconds before price is considered stale
     */
    function setPriceFeed(
        string memory currency,
        address feedAddress,
        uint256 heartbeat
    ) external onlyRole(ORACLE_MANAGER_ROLE) {
        if (feedAddress == address(0)) revert PriceOracle__InvalidAddress();

        AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);
        uint8 decimals = feed.decimals();

        priceFeeds[currency] = PriceFeed({
            chainlinkFeed: feedAddress,
            decimals: decimals,
            heartbeat: heartbeat,
            isActive: true
        });

        // Add to supported currencies if not already present
        bool exists = false;
        for (uint i = 0; i < supportedCurrencies.length; i++) {
            if (keccak256(bytes(supportedCurrencies[i])) == keccak256(bytes(currency))) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            supportedCurrencies.push(currency);
        }

        emit PriceFeedSet(currency, feedAddress, decimals);
    }

    /**
     * @notice Get latest price from Chainlink feed
     * @param currency Currency pair (e.g., "ETH/USD")
     * @return price Latest price (normalized to 18 decimals)
     * @return timestamp Price update timestamp
     */
    function getChainlinkPrice(string memory currency)
        public
        view
        returns (uint256 price, uint256 timestamp)
    {
        PriceFeed memory feed = priceFeeds[currency];
        if (!feed.isActive || feed.chainlinkFeed == address(0)) {
            revert PriceOracle__FeedNotConfigured();
        }

        AggregatorV3Interface priceFeed = AggregatorV3Interface(feed.chainlinkFeed);
        (
            /* uint80 roundID */,
            int256 answer,
            /* uint256 startedAt */,
            uint256 updatedAt,
            /* uint80 answeredInRound */
        ) = priceFeed.latestRoundData();

        if (answer <= 0) revert PriceOracle__InvalidPrice();
        if (block.timestamp - updatedAt > feed.heartbeat) revert PriceOracle__StalePrice();

        // Normalize to 18 decimals
        price = uint256(answer) * (10 ** (18 - feed.decimals));
        timestamp = updatedAt;
    }

    // === PROPERTY PRICE MANAGEMENT ===

    /**
     * @notice Update property price (admin or oracle service)
     * @param propertyId Property ID
     * @param newPrice New price in USD (18 decimals)
     * @param source Price source ("chainlink", "manual", "api")
     */
    function updatePropertyPrice(
        uint256 propertyId,
        uint256 newPrice,
        string memory source
    ) external onlyRole(PRICE_UPDATER_ROLE) nonReentrant {
        if (newPrice == 0) revert PriceOracle__InvalidPrice();

        uint256 oldPrice = 0;
        if (propertyPrices[propertyId].length > 0) {
            // Get last active price
            for (uint i = propertyPrices[propertyId].length; i > 0; i--) {
                if (propertyPrices[propertyId][i - 1].isActive) {
                    oldPrice = propertyPrices[propertyId][i - 1].price;
                    propertyPrices[propertyId][i - 1].isActive = false; // Deactivate old price
                    break;
                }
            }

            // Check for price anomaly
            if (oldPrice > 0) {
                uint256 deviationPercent = _calculateDeviation(oldPrice, newPrice);
                if (deviationPercent > priceDeviationThreshold) {
                    emit PriceAnomalyDetected(propertyId, newPrice, oldPrice, deviationPercent);
                }
            }
        }

        // Add new price entry
        propertyPrices[propertyId].push(
            PropertyPrice({
                price: newPrice,
                lastUpdate: block.timestamp,
                source: source,
                updatedBy: msg.sender,
                isActive: true
            })
        );

        emit PropertyPriceUpdated(propertyId, newPrice, oldPrice, source, msg.sender);
    }

    /**
     * @notice Admin manual price override (for fraud prevention)
     * @param propertyId Property ID
     * @param overridePrice Override price in USD  
     * @param reason Reason for override
     */
    function manualPriceOverride(
        uint256 propertyId,
        uint256 overridePrice,
        string memory reason
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (overridePrice == 0) revert PriceOracle__InvalidPrice();

        // Deactivate previous prices
        for (uint i = 0; i < propertyPrices[propertyId].length; i++) {
            propertyPrices[propertyId][i].isActive = false;
        }

        // Set manual override
        propertyPrices[propertyId].push(
            PropertyPrice({
                price: overridePrice,
                lastUpdate: block.timestamp,
                source: "admin_override",
                updatedBy: msg.sender,
                isActive: true
            })
        );

        emit ManualPriceOverride(propertyId, overridePrice, reason, msg.sender);
    }

    /**
     * @notice Get latest active property price
     * @param propertyId Property ID
     * @return price Current price
     * @return timestamp Last update timestamp
     * @return source Price source
     */
    function getLatestPropertyPrice(uint256 propertyId)
        external
        view
        returns (uint256 price, uint256 timestamp, string memory source)
    {
        if (propertyPrices[propertyId].length == 0) revert PriceOracle__NoHistoricalPrice();

        // Find latest active price
        for (uint i = propertyPrices[propertyId].length; i > 0; i--) {
            PropertyPrice memory priceData = propertyPrices[propertyId][i - 1];
            if (priceData.isActive) {
                return (priceData.price, priceData.lastUpdate, priceData.source);
            }
        }

        revert PriceOracle__NoHistoricalPrice();
    }

    /**
     * @notice Get property price history
     * @param propertyId Property ID
     * @return Array of historical prices
     */
    function getPropertyPriceHistory(uint256 propertyId)
        external
        view
        returns (PropertyPrice[] memory)
    {
        return propertyPrices[propertyId];
    }

    // === CURRENCY EXCHANGE RATES ===

    /**
     * @notice Update currency exchange rate
     * @param baseCurrency Base currency (e.g., "USD")
     * @param quoteCurrency Quote currency (e.g., "PKR", "EUR")
     * @param rate Exchange rate (18 decimals)
     * @param source Rate source
     */
    function updateExchangeRate(
        string memory baseCurrency,
        string memory quoteCurrency,
        uint256 rate,
        string memory source
    ) external onlyRole(PRICE_UPDATER_ROLE) {
        if (rate == 0) revert PriceOracle__InvalidPrice();

        exchangeRates[baseCurrency][quoteCurrency] = CurrencyRate({
            rate: rate,
            lastUpdate: block.timestamp,
            source: source,
            isActive: true
        });

        emit ExchangeRateUpdated(baseCurrency, quoteCurrency, rate, source);
    }

    /**
     * @notice Get exchange rate between two currencies
     * @param baseCurrency Base currency
     * @param quoteCurrency Quote currency
     * @return rate Exchange rate (18 decimals)
     */
    function getExchangeRate(string memory baseCurrency, string memory quoteCurrency)
        external
        view
        returns (uint256 rate)
    {
        CurrencyRate memory rateData = exchangeRates[baseCurrency][quoteCurrency];
        if (!rateData.isActive || rateData.rate == 0) revert PriceOracle__InvalidCurrency();
        return rateData.rate;
    }

    /**
     * @notice Convert amount from one currency to another
     * @param amount Amount in base currency
     * @param baseCurrency Base currency
     * @param quoteCurrency Quote currency
     * @return convertedAmount Amount in quote currency
     */
    function convertCurrency(
        uint256 amount,
        string memory baseCurrency,
        string memory quoteCurrency
    ) external view returns (uint256 convertedAmount) {
        CurrencyRate memory rateData = exchangeRates[baseCurrency][quoteCurrency];
        if (!rateData.isActive || rateData.rate == 0) revert PriceOracle__InvalidCurrency();
        
        convertedAmount = (amount * rateData.rate) / 1e18;
    }

    // === ADMIN FUNCTIONS ===

    /**
     * @notice Set price deviation threshold for anomaly detection
     * @param newThreshold New threshold percentage (18 decimals, e.g., 20e16 = 20%)
     */
    function setPriceDeviationThreshold(uint256 newThreshold)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        priceDeviationThreshold = newThreshold;
        emit PriceDeviationThresholdUpdated(newThreshold);
    }

    /**
     * @notice Toggle price feed active status
     * @param currency Currency pair
     * @param isActive New active status
     */
    function togglePriceFeed(string memory currency, bool isActive)
        external
        onlyRole(ORACLE_MANAGER_ROLE)
    {
        priceFeeds[currency].isActive = isActive;
    }

    /**
     * @notice Get all supported currencies
     * @return Array of currency codes
     */
    function getSupportedCurrencies() external view returns (string[] memory) {
        return supportedCurrencies;
    }

    // === INTERNAL FUNCTIONS ===

    /**
     * @notice Calculate percentage deviation between two prices
     * @param oldPrice Previous price
     * @param newPrice New price
     * @return deviationPercent Deviation percentage (18 decimals)
     */
    function _calculateDeviation(uint256 oldPrice, uint256 newPrice)
        internal
        pure
        returns (uint256 deviationPercent)
    {
        if (oldPrice == 0) return 0;
        
        uint256 difference = newPrice > oldPrice ? newPrice - oldPrice : oldPrice - newPrice;
        deviationPercent = (difference * 1e18) / oldPrice;
    }

    // === PAUSABLE ===

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // === UUPS UPGRADE ===

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}
}
