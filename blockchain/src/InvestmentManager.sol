// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./PropertyNFT.sol";
import "./RWAToken.sol";
import "./KYCRegistry.sol";

/**
 * @title InvestmentManager
 * @author RWAchain Team
 * @notice Manages property investments using RWAToken
 * @dev Handles investment flow: platform token payment → fractional token distribution
 */
contract InvestmentManager is 
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    // === ROLES ===
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // === STRUCTS ===
    struct Investment {
        uint256 investmentId;
        address investor;
        uint256 nftTokenId;            // PropertyNFT token ID
        uint256 platformTokenPaid;     // RWAToken amount
        uint256 fractionalTokensReceived; // Fractional tokens received
        uint256 timestamp;
        bool isActive;
    }

    struct PropertyInvestmentPool {
        uint256 nftTokenId;
        address fractionalTokenContract;
        uint256 totalFractionalTokens;
        uint256 availableFractionalTokens;
        uint256 pricePerToken;         // RWAToken per fractional token
        uint256 minInvestment;         // Minimum RWAP tokens
        bool isOpen;
    }

    // === STATE VARIABLES ===
    PropertyNFT public propertyNFT;
    RWAToken public platformToken;
    KYCRegistry public kycRegistry;

    mapping(uint256 => Investment) public investments;
    mapping(uint256 => PropertyInvestmentPool) public investmentPools; // nftTokenId => pool
    mapping(address => uint256[]) public investorInvestments;

    uint256 private _nextInvestmentId;
    address public treasury;

    // === EVENTS ===
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
    event TreasuryUpdated(address indexed newTreasury);

    // === ERRORS ===
    error InvestmentManager__InvalidAddress();
    error InvestmentManager__NotKYCApproved();
    error InvestmentManager__PoolNotOpen();
    error InvestmentManager__InsufficientAmount();
    error InvestmentManager__InsufficientFractionalTokens();
    error InvestmentManager__TransferFailed();
    error InvestmentManager__PoolAlreadyExists();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize InvestmentManager
     * @param admin Admin address
     * @param _propertyNFT PropertyNFT contract address
     * @param _platformToken RWAToken contract address
     * @param _kycRegistry KYCRegistry contract address
     * @param _treasury Treasury address
     */
    function initialize(
        address admin,
        address _propertyNFT,
        address _platformToken,
        address _kycRegistry,
        address _treasury
    ) public initializer {
        if (
            admin == address(0) ||
            _propertyNFT == address(0) ||
            _platformToken == address(0) ||
            _kycRegistry == address(0) ||
            _treasury == address(0)
        ) {
            revert InvestmentManager__InvalidAddress();
        }

        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);

        propertyNFT = PropertyNFT(_propertyNFT);
        platformToken = RWAToken(_platformToken);
        kycRegistry = KYCRegistry(_kycRegistry);
        treasury = _treasury;

        _nextInvestmentId = 1;
    }

    /**
     * @notice Create an investment pool for a property NFT
     * @param nftTokenId PropertyNFT token ID
     * @param pricePerToken Price per fractional token in RWAP
     * @param minInvestment Minimum RWAP investment amount
     */
    function createInvestmentPool(
        uint256 nftTokenId,
        uint256 pricePerToken,
        uint256 minInvestment
    ) external onlyRole(ADMIN_ROLE) {
        PropertyNFT.PropertyInfo memory propInfo = propertyNFT.getPropertyInfo(nftTokenId);
        
        if (investmentPools[nftTokenId].isOpen) {
            revert InvestmentManager__PoolAlreadyExists();
        }

        uint256 totalTokens = IERC20(propInfo.fractionalTokenContract).balanceOf(treasury);

        investmentPools[nftTokenId] = PropertyInvestmentPool({
            nftTokenId: nftTokenId,
            fractionalTokenContract: propInfo.fractionalTokenContract,
            totalFractionalTokens: totalTokens,
            availableFractionalTokens: totalTokens,
            pricePerToken: pricePerToken,
            minInvestment: minInvestment,
            isOpen: true
        });

        emit InvestmentPoolCreated(
            nftTokenId,
            propInfo.fractionalTokenContract,
            totalTokens,
            pricePerToken
        );
    }

    /**
     * @notice Invest in a property using RWAToken
     * @param nftTokenId PropertyNFT token ID
     * @param platformTokenAmount Amount of RWAP tokens to invest
     */
    function invest(uint256 nftTokenId, uint256 platformTokenAmount) 
        external 
        nonReentrant 
    {
        // 1. Check KYC
        if (!kycRegistry.isKYCApproved(msg.sender)) {
            revert InvestmentManager__NotKYCApproved();
        }

        // 2. Check pool
        PropertyInvestmentPool storage pool = investmentPools[nftTokenId];
        if (!pool.isOpen) {
            revert InvestmentManager__PoolNotOpen();
        }
        if (platformTokenAmount < pool.minInvestment) {
            revert InvestmentManager__InsufficientAmount();
        }

        // 3. Calculate fractional tokens
        uint256 fractionalTokens = (platformTokenAmount * 1e18) / pool.pricePerToken;
        
        if (fractionalTokens > pool.availableFractionalTokens) {
            revert InvestmentManager__InsufficientFractionalTokens();
        }

        // 4. Transfer RWAP tokens from investor to treasury
        bool success = platformToken.transferFrom(msg.sender, treasury, platformTokenAmount);
        if (!success) {
            revert InvestmentManager__TransferFailed();
        }

        // 5. Transfer fractional tokens from treasury to investor
        IERC20 fractionalToken = IERC20(pool.fractionalTokenContract);
        success = fractionalToken.transferFrom(treasury, msg.sender, fractionalTokens);
        if (!success) {
            revert InvestmentManager__TransferFailed();
        }

        // 6. Update pool
        pool.availableFractionalTokens -= fractionalTokens;

        // 7. Record investment
        uint256 investmentId = _nextInvestmentId++;
        investments[investmentId] = Investment({
            investmentId: investmentId,
            investor: msg.sender,
            nftTokenId: nftTokenId,
            platformTokenPaid: platformTokenAmount,
            fractionalTokensReceived: fractionalTokens,
            timestamp: block.timestamp,
            isActive: true
        });

        investorInvestments[msg.sender].push(investmentId);

        emit Invested(
            investmentId,
            msg.sender,
            nftTokenId,
            platformTokenAmount,
            fractionalTokens
        );
    }

    /**
     * @notice Close an investment pool
     * @param nftTokenId PropertyNFT token ID
     */
    function closeInvestmentPool(uint256 nftTokenId) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        investmentPools[nftTokenId].isOpen = false;
        emit InvestmentPoolClosed(nftTokenId);
    }

    /**
     * @notice Get investor's investment history
     * @param investor Investor address
     * @return Investment[] Array of investments
     */
    function getInvestorInvestments(address investor) 
        external 
        view 
        returns (Investment[] memory) 
    {
        uint256[] memory ids = investorInvestments[investor];
        Investment[] memory result = new Investment[](ids.length);
        
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = investments[ids[i]];
        }
        
        return result;
    }

    /**
     * @notice Get the investment pool for a given NFT token ID
     * @param nftTokenId PropertyNFT token ID
     * @return pool The PropertyInvestmentPool struct for the given NFT token ID
     */
    function getInvestmentPool(uint256 nftTokenId)
        external
        view
        returns (PropertyInvestmentPool memory pool)
    {
        pool = investmentPools[nftTokenId];
    }

    /**
     * @notice Update treasury address
     * @param newTreasury New treasury address
     */
    function updateTreasury(address newTreasury) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (newTreasury == address(0)) {
            revert InvestmentManager__InvalidAddress();
        }

        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyRole(UPGRADER_ROLE) 
    {}

    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}