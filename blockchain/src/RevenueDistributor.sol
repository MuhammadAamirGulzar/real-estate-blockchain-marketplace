// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20; // CHANGED FROM ^0.8.30

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

interface IRWAToken {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function getUserAssetBalance(address user, uint256 assetId) external view returns (uint256);
    function getAssetTotalSupply(uint256 assetId) external view returns (uint256);
    function assetExists(uint256 assetId) external view returns (bool);
}

interface IAssetRegistry {
    function assetExists(uint256 assetId) external view returns (bool);
    function getAssetOwner(uint256 assetId) external view returns (address);
    function isAssetTokenized(uint256 assetId) external view returns (bool);
}

/// @title Revenue Distribution - Upgradeable
/// @notice Distributes revenue/profits to RWA token holders based on their asset-specific holdings
/// @dev Uses UUPS proxy pattern for upgradeability
contract RevenueDistributor is 
    Initializable,
    AccessControlUpgradeable, 
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable 
{
    // Roles
    bytes32 public constant REVENUE_MANAGER_ROLE = keccak256("REVENUE_MANAGER_ROLE");
    bytes32 public constant ASSET_OWNER_ROLE = keccak256("ASSET_OWNER_ROLE");

    // External contracts
    IRWAToken public rwaToken;
    IAssetRegistry public assetRegistry;

    // Revenue tracking per asset
    struct AssetRevenue {
        uint256 totalDeposited;
        uint256 totalClaimed;
        uint256 lastDistributionTime;
        bool isActive;
    }

    mapping(uint256 => AssetRevenue) public assetRevenues;
    
    // Track revenue claimed by each investor for each asset
    mapping(uint256 => mapping(address => uint256)) public claimedRevenue;
    
    // Track total revenue deposited by asset owner
    mapping(uint256 => mapping(address => uint256)) public ownerDeposits;

    // Settings
    uint256 public minimumDistribution;
    uint256 public distributionFee; // Fee in basis points (e.g., 100 = 1%)
    address public feeCollector;

    /// @dev Storage gap for future upgrades
    uint256[50] private __gap;

    // Events
    event RevenueDeposited(uint256 indexed assetId, address indexed depositor, uint256 amount);
    event RevenueClaimed(uint256 indexed assetId, address indexed investor, uint256 amount);
    event AssetRevenueActivated(uint256 indexed assetId);
    event AssetRevenueDeactivated(uint256 indexed assetId);
    event DistributionFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event MinimumDistributionUpdated(uint256 oldMinimum, uint256 newMinimum);
    event EmergencyWithdrawal(uint256 indexed assetId, address indexed recipient, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the contract
    /// @param admin Admin address
    /// @param rwaTokenAddress RWA token contract address
    /// @param assetRegistryAddress Asset registry contract address
    function initialize(
        address admin,
        address rwaTokenAddress,
        address assetRegistryAddress
    ) public initializer {
        require(admin != address(0), "Revenue: admin is zero");
        require(rwaTokenAddress != address(0), "Revenue: token is zero");
        require(assetRegistryAddress != address(0), "Revenue: registry is zero");

        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REVENUE_MANAGER_ROLE, admin);

        rwaToken = IRWAToken(rwaTokenAddress);
        assetRegistry = IAssetRegistry(assetRegistryAddress);
        
        minimumDistribution = 1e15; // 0.001 ETH minimum
        distributionFee = 250; // 2.5% fee
        feeCollector = admin;
    }

    // ----------------------
    // Upgrade authorization
    // ----------------------

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ----------------------
    // Revenue Management
    // ----------------------

    /// @notice Deposit revenue for a specific asset (only asset owner or revenue manager)
    /// @param assetId Asset identifier
    function depositRevenue(uint256 assetId) external payable whenNotPaused nonReentrant {
        require(msg.value > 0, "Revenue: amount must be > 0");
        require(msg.value >= minimumDistribution, "Revenue: below minimum");
        require(assetRegistry.assetExists(assetId), "Revenue: asset does not exist");
        require(assetRegistry.isAssetTokenized(assetId), "Revenue: asset not tokenized");

        // Enforce only asset owner can deposit
        address owner = assetRegistry.getAssetOwner(assetId);
        require(msg.sender == owner, "RevenueDistributor: unauthorized depositor");

        // Calculate fee
        uint256 fee = (msg.value * distributionFee) / 10000;
        uint256 netRevenue = msg.value - fee;

        // Update revenue tracking
        AssetRevenue storage revenue = assetRevenues[assetId];
        revenue.totalDeposited += netRevenue;
        revenue.lastDistributionTime = block.timestamp;
        revenue.isActive = true;

        ownerDeposits[assetId][owner] += netRevenue;

        // Transfer fee to collector
        if (fee > 0 && feeCollector != address(0)) {
            (bool feeSuccess, ) = feeCollector.call{value: fee}("");
            require(feeSuccess, "Revenue: fee transfer failed");
        }

        emit RevenueDeposited(assetId, msg.sender, netRevenue);
    }

    /// @notice Claim available revenue for an asset
    /// @param assetId Asset identifier
    function claimRevenue(uint256 assetId) external whenNotPaused nonReentrant {
        require(assetRegistry.assetExists(assetId), "Revenue: asset does not exist");
        require(assetRevenues[assetId].isActive, "Revenue: asset not active");

        uint256 claimableAmount = getClaimableRevenue(assetId, msg.sender);
        require(claimableAmount > 0, "Revenue: no claimable revenue");

        // Update claimed amount
        claimedRevenue[assetId][msg.sender] += claimableAmount;
        assetRevenues[assetId].totalClaimed += claimableAmount;

        // Transfer revenue
        (bool success, ) = msg.sender.call{value: claimableAmount}("");
        require(success, "Revenue: transfer failed");

        emit RevenueClaimed(assetId, msg.sender, claimableAmount);
    }

    /// @notice Batch claim revenue for multiple assets
    /// @param assetIds Array of asset identifiers
    function batchClaimRevenue(uint256[] calldata assetIds) external whenNotPaused nonReentrant {
        uint256 totalClaim = 0;
        
        for (uint256 i = 0; i < assetIds.length; i++) {
            uint256 assetId = assetIds[i];
            
            if (!assetRegistry.assetExists(assetId) || !assetRevenues[assetId].isActive) {
                continue;
            }

            uint256 claimableAmount = getClaimableRevenue(assetId, msg.sender);
            if (claimableAmount > 0) {
                claimedRevenue[assetId][msg.sender] += claimableAmount;
                assetRevenues[assetId].totalClaimed += claimableAmount;
                totalClaim += claimableAmount;

                emit RevenueClaimed(assetId, msg.sender, claimableAmount);
            }
        }

        require(totalClaim > 0, "Revenue: no claimable revenue");

        // Transfer total revenue
        (bool success, ) = msg.sender.call{value: totalClaim}("");
        require(success, "Revenue: transfer failed");
    }

    // ----------------------
    // Asset Management
    // ----------------------

    /// @notice Activate revenue distribution for an asset
    /// @param assetId Asset identifier
    function activateAssetRevenue(uint256 assetId) external onlyRole(REVENUE_MANAGER_ROLE) {
        require(assetRegistry.assetExists(assetId), "Revenue: asset does not exist");
        require(assetRegistry.isAssetTokenized(assetId), "Revenue: asset not tokenized");
        
        assetRevenues[assetId].isActive = true;
        emit AssetRevenueActivated(assetId);
    }

    /// @notice Deactivate revenue distribution for an asset
    /// @param assetId Asset identifier
    function deactivateAssetRevenue(uint256 assetId) external onlyRole(REVENUE_MANAGER_ROLE) {
        assetRevenues[assetId].isActive = false;
        emit AssetRevenueDeactivated(assetId);
    }

    // ----------------------
    // Admin Functions
    // ----------------------

    function setRWAToken(address newRWAToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRWAToken != address(0), "Revenue: token is zero");
        rwaToken = IRWAToken(newRWAToken);
    }

    function setAssetRegistry(address newAssetRegistry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newAssetRegistry != address(0), "Revenue: registry is zero");
        assetRegistry = IAssetRegistry(newAssetRegistry);
    }

    function setDistributionFee(uint256 newFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newFee <= 1000, "Revenue: fee too high"); // Max 10%
        uint256 oldFee = distributionFee;
        distributionFee = newFee;
        emit DistributionFeeUpdated(oldFee, newFee);
    }

    function setFeeCollector(address newCollector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newCollector != address(0), "Revenue: collector is zero");
        address oldCollector = feeCollector;
        feeCollector = newCollector;
        emit FeeCollectorUpdated(oldCollector, newCollector);
    }

    function setMinimumDistribution(uint256 newMinimum) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldMinimum = minimumDistribution;
        minimumDistribution = newMinimum;
        emit MinimumDistributionUpdated(oldMinimum, newMinimum);
    }

    function emergencyWithdraw(uint256 assetId, address recipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(recipient != address(0), "Revenue: recipient is zero");
        
        AssetRevenue storage revenue = assetRevenues[assetId];
        uint256 availableBalance = revenue.totalDeposited - revenue.totalClaimed;
        require(availableBalance > 0, "Revenue: no balance to withdraw");

        revenue.totalClaimed = revenue.totalDeposited;
        revenue.isActive = false;

        (bool success, ) = recipient.call{value: availableBalance}("");
        require(success, "Revenue: withdrawal failed");

        emit EmergencyWithdrawal(assetId, recipient, availableBalance);
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

    /// @notice Get claimable revenue for an investor for a specific asset
    /// @param assetId Asset identifier
    /// @param investor Investor address
    /// @return Claimable revenue amount
    function getClaimableRevenue(uint256 assetId, address investor) public view returns (uint256) {
        if (!assetRevenues[assetId].isActive) return 0;

        uint256 investorBalance = rwaToken.getUserAssetBalance(investor, assetId);
        if (investorBalance == 0) return 0;

        uint256 totalAssetSupply = rwaToken.getAssetTotalSupply(assetId);
        if (totalAssetSupply == 0) return 0;

        uint256 totalRevenue = assetRevenues[assetId].totalDeposited;
        uint256 investorShare = (totalRevenue * investorBalance) / totalAssetSupply;
        uint256 alreadyClaimed = claimedRevenue[assetId][investor];

        return investorShare > alreadyClaimed ? investorShare - alreadyClaimed : 0;
    }

    /// @notice Get total claimable revenue across all assets for an investor
    /// @param investor Investor address
    /// @param assetIds Array of asset IDs to check
    /// @return Total claimable revenue
    function getTotalClaimableRevenue(address investor, uint256[] calldata assetIds) external view returns (uint256) {
        uint256 totalClaimable = 0;
        
        for (uint256 i = 0; i < assetIds.length; i++) {
            totalClaimable += getClaimableRevenue(assetIds[i], investor);
        }
        
        return totalClaimable;
    }

    /// @notice Get asset revenue information
    /// @param assetId Asset identifier
    /// @return Asset revenue details
    function getAssetRevenueInfo(uint256 assetId) external view returns (AssetRevenue memory) {
        return assetRevenues[assetId];
    }

    /// @notice Get unclaimed revenue pool for an asset
    /// @param assetId Asset identifier
    /// @return Unclaimed revenue amount
    function getUnclaimedRevenue(uint256 assetId) external view returns (uint256) {
        AssetRevenue memory revenue = assetRevenues[assetId];
        return revenue.totalDeposited - revenue.totalClaimed;
    }

    /// @notice Check if contract can receive ETH
    receive() external payable {
        revert("Revenue: direct payments not allowed");
    }

    // ----------------------
    // Version
    // ----------------------

    function version() external pure returns (string memory) {
        return "2.0.0";
    }
}
