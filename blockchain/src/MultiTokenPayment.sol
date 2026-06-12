// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./PriceOracle.sol";
import "./InvestmentManager.sol";

/**
 * @title MultiTokenPayment
 * @author RWAchain Team
 * @notice Accepts payments in multiple tokens (RWAP, ETH, USDC, USDT) for property investments
 * @dev Converts payment tokens to RWAP equivalent and processes investment via InvestmentManager
 */
contract MultiTokenPayment is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    // === ROLES ===
    bytes32 public constant PAYMENT_MANAGER_ROLE = keccak256("PAYMENT_MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // === STRUCTS ===
    struct SupportedToken {
        address tokenAddress;       // Token contract address (address(0) for ETH)
        string symbol;              // Token symbol (ETH, USDC, USDT, RWAP)
        bool isActive;              // Token enabled for payments
        uint8 decimals;             // Token decimals
        string priceFeed;           // Oracle price feed identifier (e.g., "ETH/USD")
    }

    struct PaymentRecord {
        uint256 paymentId;
        address payer;
        address paymentToken;
        uint256 paymentAmount;
        uint256 rwaEquivalent;      // Amount in RWAP tokens
        uint256 propertyNftId;
        uint256 investmentId;       // Investment ID from InvestmentManager
        uint256 timestamp;
        string paymentMethod;       // eth, usdc, usdt, rwap
    }

    // === STATE VARIABLES ===
    PriceOracle public priceOracle;
    InvestmentManager public investmentManager;
    address public treasury;
    address public rwaTokenAddress;

    uint256 public paymentCounter;
    
    // Token address => Token info
    mapping(address => SupportedToken) public supportedTokens;
    
    // List of all supported token addresses
    address[] public tokenAddresses;
    
    // Payment ID => Payment record
    mapping(uint256 => PaymentRecord) public payments;
    
    // User => Payment IDs
    mapping(address => uint256[]) public userPayments;

    // === EVENTS ===
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

    // === ERRORS ===
    error MultiTokenPayment__InvalidAddress();
    error MultiTokenPayment__InvalidAmount();
    error MultiTokenPayment__TokenNotSupported();
    error MultiTokenPayment__TransferFailed();
    error MultiTokenPayment__InsufficientPayment();
    error MultiTokenPayment__InvestmentFailed();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the MultiTokenPayment contract
     * @param admin Admin address
     * @param _priceOracle PriceOracle contract address
     * @param _investmentManager InvestmentManager contract address
     * @param _treasury Treasury address
     * @param _rwaToken RWAP token address
     */
    function initialize(
        address admin,
        address _priceOracle,
        address _investmentManager,
        address _treasury,
        address _rwaToken
    ) public initializer {
        if (
            admin == address(0) ||
            _priceOracle == address(0) ||
            _investmentManager == address(0) ||
            _treasury == address(0) ||
            _rwaToken == address(0)
        ) {
            revert MultiTokenPayment__InvalidAddress();
        }

        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAYMENT_MANAGER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);

        priceOracle = PriceOracle(_priceOracle);
        investmentManager = InvestmentManager(_investmentManager);
        treasury = _treasury;
        rwaTokenAddress = _rwaToken;
        paymentCounter = 0;
    }

    // === TOKEN MANAGEMENT ===

    /**
     * @notice Add supported payment token
     * @param tokenAddress Token contract address (address(0) for ETH)
     * @param symbol Token symbol
     * @param decimals Token decimals
     * @param priceFeed Oracle price feed identifier
     */
    function addSupportedToken(
        address tokenAddress,
        string memory symbol,
        uint8 decimals,
        string memory priceFeed
    ) external onlyRole(PAYMENT_MANAGER_ROLE) {
        supportedTokens[tokenAddress] = SupportedToken({
            tokenAddress: tokenAddress,
            symbol: symbol,
            isActive: true,
            decimals: decimals,
            priceFeed: priceFeed
        });

        // Add to array if not already present
        bool exists = false;
        for (uint i = 0; i < tokenAddresses.length; i++) {
            if (tokenAddresses[i] == tokenAddress) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            tokenAddresses.push(tokenAddress);
        }

        emit TokenAdded(tokenAddress, symbol, priceFeed);
    }

    /**
     * @notice Toggle token active status
     * @param tokenAddress Token address
     * @param isActive New active status
     */
    function toggleToken(address tokenAddress, bool isActive)
        external
        onlyRole(PAYMENT_MANAGER_ROLE)
    {
        if (supportedTokens[tokenAddress].tokenAddress == address(0)) {
            revert MultiTokenPayment__TokenNotSupported();
        }
        supportedTokens[tokenAddress].isActive = isActive;
        emit TokenUpdated(tokenAddress, isActive);
    }

    // === PAYMENT PROCESSING ===

    /**
     * @notice Process payment in ERC20 token
     * @param tokenAddress Payment token address
     * @param amount Payment amount
     * @param propertyNftId Property NFT ID to invest in
     * @return paymentId Generated payment ID
     */
    function processTokenPayment(
        address tokenAddress,
        uint256 amount,
        uint256 propertyNftId
    ) external nonReentrant whenNotPaused returns (uint256 paymentId) {
        SupportedToken memory token = supportedTokens[tokenAddress];
        if (!token.isActive || tokenAddress == address(0)) {
            revert MultiTokenPayment__TokenNotSupported();
        }
        if (amount == 0) revert MultiTokenPayment__InvalidAmount();

        // Transfer payment token from user to treasury
        IERC20(tokenAddress).safeTransferFrom(msg.sender, treasury, amount);

        // Calculate RWAP equivalent
        uint256 rwaEquivalent = _calculateRWAPEquivalent(tokenAddress, amount);
        if (rwaEquivalent == 0) revert MultiTokenPayment__InsufficientPayment();

        // Create investment via InvestmentManager
        // Note: Assumes treasury has approved InvestmentManager to spend RWAP tokens
        uint256 investmentId = _processInvestment(msg.sender, propertyNftId, rwaEquivalent);

        // Record payment
        paymentId = ++paymentCounter;
        payments[paymentId] = PaymentRecord({
            paymentId: paymentId,
            payer: msg.sender,
            paymentToken: tokenAddress,
            paymentAmount: amount,
            rwaEquivalent: rwaEquivalent,
            propertyNftId: propertyNftId,
            investmentId: investmentId,
            timestamp: block.timestamp,
            paymentMethod: token.symbol
        });

        userPayments[msg.sender].push(paymentId);

        emit PaymentProcessed(
            paymentId,
            msg.sender,
            tokenAddress,
            amount,
            rwaEquivalent,
            propertyNftId
        );
    }

    /**
     * @notice Process payment in native ETH
     * @param propertyNftId Property NFT ID to invest in
     * @return paymentId Generated payment ID
     */
    function processETHPayment(uint256 propertyNftId)
        external
        payable
        nonReentrant
        whenNotPaused
        returns (uint256 paymentId)
    {
        SupportedToken memory ethToken = supportedTokens[address(0)];
        if (!ethToken.isActive) revert MultiTokenPayment__TokenNotSupported();
        if (msg.value == 0) revert MultiTokenPayment__InvalidAmount();

        // Transfer ETH to treasury
        (bool success, ) = treasury.call{value: msg.value}("");
        if (!success) revert MultiTokenPayment__TransferFailed();

        // Calculate RWAP equivalent
        uint256 rwaEquivalent = _calculateRWAPEquivalent(address(0), msg.value);
        if (rwaEquivalent == 0) revert MultiTokenPayment__InsufficientPayment();

        // Create investment via InvestmentManager
        uint256 investmentId = _processInvestment(msg.sender, propertyNftId, rwaEquivalent);

        // Record payment
        paymentId = ++paymentCounter;
        payments[paymentId] = PaymentRecord({
            paymentId: paymentId,
            payer: msg.sender,
            paymentToken: address(0),
            paymentAmount: msg.value,
            rwaEquivalent: rwaEquivalent,
            propertyNftId: propertyNftId,
            investmentId: investmentId,
            timestamp: block.timestamp,
            paymentMethod: "ETH"
        });

        userPayments[msg.sender].push(paymentId);

        emit PaymentProcessed(
            paymentId,
            msg.sender,
            address(0),
            msg.value,
            rwaEquivalent,
            propertyNftId
        );
    }

    /**
     * @notice Process direct RWAP payment (no conversion needed)
     * @param amount RWAP amount
     * @param propertyNftId Property NFT ID to invest in
     * @return paymentId Generated payment ID
     */
    function processRWAPPayment(uint256 amount, uint256 propertyNftId)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 paymentId)
    {
        if (amount == 0) revert MultiTokenPayment__InvalidAmount();

        // Direct RWAP payment - no conversion needed
        uint256 investmentId = _processInvestment(msg.sender, propertyNftId, amount);

        // Record payment
        paymentId = ++paymentCounter;
        payments[paymentId] = PaymentRecord({
            paymentId: paymentId,
            payer: msg.sender,
            paymentToken: rwaTokenAddress,
            paymentAmount: amount,
            rwaEquivalent: amount,
            propertyNftId: propertyNftId,
            investmentId: investmentId,
            timestamp: block.timestamp,
            paymentMethod: "RWAP"
        });

        userPayments[msg.sender].push(paymentId);

        emit PaymentProcessed(
            paymentId,
            msg.sender,
            rwaTokenAddress,
            amount,
            amount,
            propertyNftId
        );
    }

    // === INTERNAL FUNCTIONS ===

    /**
     * @notice Calculate RWAP token equivalent for payment
     * @param tokenAddress Payment token address
     * @param amount Payment amount
     * @return rwaAmount Equivalent RWAP amount
     */
    function _calculateRWAPEquivalent(address tokenAddress, uint256 amount)
        internal
        view
        returns (uint256 rwaAmount)
    {
        SupportedToken memory token = supportedTokens[tokenAddress];
        
        // Get token price in USD from oracle
        (uint256 tokenPriceUSD, ) = priceOracle.getChainlinkPrice(token.priceFeed);
        
        // Get RWAP price in USD from oracle
        SupportedToken memory rwaToken = supportedTokens[rwaTokenAddress];
        (uint256 rwapPriceUSD, ) = priceOracle.getChainlinkPrice(rwaToken.priceFeed);

        // Calculate: (amount * tokenPrice) / rwapPrice
        // Normalize decimals: convert to 18 decimals for calculation
        uint256 normalizedAmount = amount;
        if (token.decimals < 18) {
            normalizedAmount = amount * (10 ** (18 - token.decimals));
        } else if (token.decimals > 18) {
            normalizedAmount = amount / (10 ** (token.decimals - 18));
        }

        rwaAmount = (normalizedAmount * tokenPriceUSD) / rwapPriceUSD;
    }

    /**
     * @notice Process investment through InvestmentManager
     * @param propertyNftId Property NFT ID
     * @param rwaAmount RWAP amount
     * @return investmentId Created investment ID
     */
    function _processInvestment(
        address,
        uint256 propertyNftId,
        uint256 rwaAmount
    ) internal returns (uint256 investmentId) {
        // Call InvestmentManager.invest()
        // Note: This assumes InvestmentManager has been modified to return investment ID
        // and this contract has appropriate approval/role to create investments
        try investmentManager.invest(propertyNftId, rwaAmount) {
            // Investment successful
            // In practice, you'd get the investment ID from the contract
            // For now, using a placeholder
            investmentId = block.timestamp; // Placeholder - should be from InvestmentManager
        } catch {
            revert MultiTokenPayment__InvestmentFailed();
        }
    }

    // === VIEW FUNCTIONS ===

    /**
     * @notice Get payment details
     * @param paymentId Payment ID
     * @return Payment record
     */
    function getPayment(uint256 paymentId) external view returns (PaymentRecord memory) {
        return payments[paymentId];
    }

    /**
     * @notice Get user's payment history
     * @param user User address
     * @return Array of payment IDs
     */
    function getUserPayments(address user) external view returns (uint256[] memory) {
        return userPayments[user];
    }

    /**
     * @notice Get all supported tokens
     * @return Array of token addresses
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return tokenAddresses;
    }

    /**
     * @notice Check if token is supported
     * @param tokenAddress Token address
     * @return True if supported and active
     */
    function isTokenSupported(address tokenAddress) external view returns (bool) {
        return supportedTokens[tokenAddress].isActive;
    }

    /**
     * @notice Calculate payment equivalent in RWAP (view function for frontend)
     * @param tokenAddress Payment token address
     * @param amount Payment amount
     * @return rwaEquivalent RWAP equivalent amount
     */
    function calculatePaymentEquivalent(address tokenAddress, uint256 amount)
        external
        view
        returns (uint256 rwaEquivalent)
    {
        return _calculateRWAPEquivalent(tokenAddress, amount);
    }

    // === ADMIN FUNCTIONS ===

    /**
     * @notice Update PriceOracle contract address
     * @param newOracle New oracle address
     */
    function setPriceOracle(address newOracle)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (newOracle == address(0)) revert MultiTokenPayment__InvalidAddress();
        priceOracle = PriceOracle(newOracle);
        emit PriceOracleUpdated(newOracle);
    }

    /**
     * @notice Update InvestmentManager contract address
     * @param newManager New manager address
     */
    function setInvestmentManager(address newManager)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (newManager == address(0)) revert MultiTokenPayment__InvalidAddress();
        investmentManager = InvestmentManager(newManager);
        emit InvestmentManagerUpdated(newManager);
    }

    /**
     * @notice Update treasury address
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (newTreasury == address(0)) revert MultiTokenPayment__InvalidAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
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

    // === RECEIVE ETH ===

    receive() external payable {
        // Allow contract to receive ETH
    }
}
