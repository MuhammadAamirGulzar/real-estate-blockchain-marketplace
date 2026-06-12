// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PaymentEscrow
 * @author RWAchain Team
 * @notice Escrow contract for holding tokens during bank transfer verification
 * @dev Holds crypto payments while fiat bank transfers are being manually verified by admins
 */
contract PaymentEscrow is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    // === ROLES ===
    bytes32 public constant ESCROW_MANAGER_ROLE = keccak256("ESCROW_MANAGER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // === ENUMS ===
    enum EscrowStatus {
        Active,         // Escrow created, funds locked
        Completed,      // Funds released to beneficiary
        Cancelled,      // Funds returned to depositor
        Expired         // Timeout reached, eligible for refund
    }

    // === STRUCTS ===
    struct Escrow {
        uint256 escrowId;
        address depositor;          // User who deposited funds
        address beneficiary;        // Where funds go when completed (usually investment contract)
        address tokenAddress;       // Token being held (address(0) for native ETH)
        uint256 amount;             // Amount held in escrow
        uint256 investmentId;       // Related investment ID (off-chain)
        EscrowStatus status;        // Current escrow status
        uint256 createdAt;          // Creation timestamp
        uint256 expiresAt;          // Expiration timestamp
        string paymentMethod;       // "bank_transfer", "wire", etc.
        address completedBy;        // Admin who completed/cancelled
        uint256 completedAt;        // Completion timestamp
    }

    // === STATE VARIABLES ===
    uint256 public escrowCounter;
    uint256 public escrowTimeout;           // Default timeout in seconds (7 days)
    address public treasury;                // Platform treasury for fees

    // Escrow ID => Escrow data
    mapping(uint256 => Escrow) public escrows;
    
    // User address => Escrow IDs
    mapping(address => uint256[]) public userEscrows;
    
    // Investment ID => Escrow ID
    mapping(uint256 => uint256) public investmentEscrows;

    // === EVENTS ===
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

    // === ERRORS ===
    error PaymentEscrow__InvalidAddress();
    error PaymentEscrow__InvalidAmount();
    error PaymentEscrow__EscrowNotFound();
    error PaymentEscrow__EscrowNotActive();
    error PaymentEscrow__EscrowNotExpired();
    error PaymentEscrow__UnauthorizedDepositor();
    error PaymentEscrow__TransferFailed();
    error PaymentEscrow__InvalidStatus();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the PaymentEscrow contract
     * @param admin Admin address
     * @param _treasury Treasury address
     */
    function initialize(address admin, address _treasury) public initializer {
        if (admin == address(0) || _treasury == address(0)) {
            revert PaymentEscrow__InvalidAddress();
        }

        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ESCROW_MANAGER_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);

        treasury = _treasury;
        escrowTimeout = 7 days;
        escrowCounter = 0;
    }

    // === ESCROW CREATION ===

    /**
     * @notice Create escrow for ERC20 token payment
     * @param beneficiary Address to receive funds after verification
     * @param tokenAddress ERC20 token address
     * @param amount Amount to escrow
     * @param investmentId Related investment ID (off-chain reference)
     * @param paymentMethod Payment method description
     * @return escrowId Created escrow ID
     */
    function createEscrow(
        address beneficiary,
        address tokenAddress,
        uint256 amount,
        uint256 investmentId,
        string memory paymentMethod
    ) external nonReentrant whenNotPaused returns (uint256 escrowId) {
        if (beneficiary == address(0) || tokenAddress == address(0)) {
            revert PaymentEscrow__InvalidAddress();
        }
        if (amount == 0) revert PaymentEscrow__InvalidAmount();

        // Transfer tokens from user to escrow
        IERC20 token = IERC20(tokenAddress);
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 balanceAfter = token.balanceOf(address(this));
        
        // Verify actual received amount (handles fee-on-transfer tokens)
        uint256 actualAmount = balanceAfter - balanceBefore;
        if (actualAmount == 0) revert PaymentEscrow__InvalidAmount();

        escrowId = ++escrowCounter;
        uint256 expiresAt = block.timestamp + escrowTimeout;

        escrows[escrowId] = Escrow({
            escrowId: escrowId,
            depositor: msg.sender,
            beneficiary: beneficiary,
            tokenAddress: tokenAddress,
            amount: actualAmount,
            investmentId: investmentId,
            status: EscrowStatus.Active,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            paymentMethod: paymentMethod,
            completedBy: address(0),
            completedAt: 0
        });

        userEscrows[msg.sender].push(escrowId);
        investmentEscrows[investmentId] = escrowId;

        emit EscrowCreated(
            escrowId,
            msg.sender,
            beneficiary,
            tokenAddress,
            actualAmount,
            investmentId,
            expiresAt
        );
    }

    /**
     * @notice Create escrow for native ETH payment
     * @param beneficiary Address to receive funds after verification
     * @param investmentId Related investment ID
     * @param paymentMethod Payment method description
     * @return escrowId Created escrow ID
     */
    function createEscrowETH(
        address beneficiary,
        uint256 investmentId,
        string memory paymentMethod
    ) external payable nonReentrant whenNotPaused returns (uint256 escrowId) {
        if (beneficiary == address(0)) revert PaymentEscrow__InvalidAddress();
        if (msg.value == 0) revert PaymentEscrow__InvalidAmount();

        escrowId = ++escrowCounter;
        uint256 expiresAt = block.timestamp + escrowTimeout;

        escrows[escrowId] = Escrow({
            escrowId: escrowId,
            depositor: msg.sender,
            beneficiary: beneficiary,
            tokenAddress: address(0), // ETH
            amount: msg.value,
            investmentId: investmentId,
            status: EscrowStatus.Active,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            paymentMethod: paymentMethod,
            completedBy: address(0),
            completedAt: 0
        });

        userEscrows[msg.sender].push(escrowId);
        investmentEscrows[investmentId] = escrowId;

        emit EscrowCreated(
            escrowId,
            msg.sender,
            beneficiary,
            address(0),
            msg.value,
            investmentId,
            expiresAt
        );
    }

    // === ESCROW COMPLETION (Admin verified bank transfer) ===

    /**
     * @notice Complete escrow and release funds to beneficiary
     * @dev Called by admin after verifying bank transfer payment
     * @param escrowId Escrow ID to complete
     */
    function completeEscrow(uint256 escrowId)
        external
        onlyRole(VERIFIER_ROLE)
        nonReentrant
        whenNotPaused
    {
        Escrow storage escrow = escrows[escrowId];
        
        if (escrow.escrowId == 0) revert PaymentEscrow__EscrowNotFound();
        if (escrow.status != EscrowStatus.Active) revert PaymentEscrow__EscrowNotActive();

        escrow.status = EscrowStatus.Completed;
        escrow.completedBy = msg.sender;
        escrow.completedAt = block.timestamp;

        // Release funds to beneficiary
        if (escrow.tokenAddress == address(0)) {
            // Native ETH
            (bool success, ) = escrow.beneficiary.call{value: escrow.amount}("");
            if (!success) revert PaymentEscrow__TransferFailed();
        } else {
            // ERC20 token
            IERC20(escrow.tokenAddress).safeTransfer(escrow.beneficiary, escrow.amount);
        }

        emit EscrowCompleted(escrowId, msg.sender, escrow.amount);
    }

    // === ESCROW CANCELLATION ===

    /**
     * @notice Cancel escrow and refund depositor
     * @dev Called by admin if bank transfer is rejected or disputed
     * @param escrowId Escrow ID to cancel
     */
    function cancelEscrow(uint256 escrowId)
        external
        onlyRole(ESCROW_MANAGER_ROLE)
        nonReentrant
        whenNotPaused
    {
        Escrow storage escrow = escrows[escrowId];
        
        if (escrow.escrowId == 0) revert PaymentEscrow__EscrowNotFound();
        if (escrow.status != EscrowStatus.Active) revert PaymentEscrow__EscrowNotActive();

        escrow.status = EscrowStatus.Cancelled;
        escrow.completedBy = msg.sender;
        escrow.completedAt = block.timestamp;

        // Refund depositor
        if (escrow.tokenAddress == address(0)) {
            // Native ETH
            (bool success, ) = escrow.depositor.call{value: escrow.amount}("");
            if (!success) revert PaymentEscrow__TransferFailed();
        } else {
            // ERC20 token
            IERC20(escrow.tokenAddress).safeTransfer(escrow.depositor, escrow.amount);
        }

        emit EscrowCancelled(escrowId, msg.sender, escrow.amount);
    }

    /**
     * @notice Claim refund for expired escrow
     * @dev Anyone can call this after timeout, but funds only go to original depositor
     * @param escrowId Escrow ID to refund
     */
    function claimExpiredEscrow(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        
        if (escrow.escrowId == 0) revert PaymentEscrow__EscrowNotFound();
        if (escrow.status != EscrowStatus.Active) revert PaymentEscrow__EscrowNotActive();
        if (block.timestamp < escrow.expiresAt) revert PaymentEscrow__EscrowNotExpired();

        escrow.status = EscrowStatus.Expired;
        escrow.completedAt = block.timestamp;

        // Refund depositor
        if (escrow.tokenAddress == address(0)) {
            // Native ETH
            (bool success, ) = escrow.depositor.call{value: escrow.amount}("");
            if (!success) revert PaymentEscrow__TransferFailed();
        } else {
            // ERC20 token
            IERC20(escrow.tokenAddress).safeTransfer(escrow.depositor, escrow.amount);
        }

        emit EscrowExpired(escrowId);
    }

    // === VIEW FUNCTIONS ===

    /**
     * @notice Get escrow details
     * @param escrowId Escrow ID
     * @return Escrow struct
     */
    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        if (escrows[escrowId].escrowId == 0) revert PaymentEscrow__EscrowNotFound();
        return escrows[escrowId];
    }

    /**
     * @notice Get escrow by investment ID
     * @param investmentId Investment ID
     * @return Escrow struct
     */
    function getEscrowByInvestment(uint256 investmentId)
        external
        view
        returns (Escrow memory)
    {
        uint256 escrowId = investmentEscrows[investmentId];
        if (escrowId == 0) revert PaymentEscrow__EscrowNotFound();
        return escrows[escrowId];
    }

    /**
     * @notice Get all escrows for a user
     * @param user User address
     * @return Array of escrow IDs
     */
    function getUserEscrows(address user) external view returns (uint256[] memory) {
        return userEscrows[user];
    }

    /**
     * @notice Check if escrow is expired
     * @param escrowId Escrow ID
     * @return True if expired
     */
    function isExpired(uint256 escrowId) external view returns (bool) {
        Escrow memory escrow = escrows[escrowId];
        return block.timestamp >= escrow.expiresAt && escrow.status == EscrowStatus.Active;
    }

    /**
     * @notice Get escrow status
     * @param escrowId Escrow ID
     * @return status Current status
     */
    function getEscrowStatus(uint256 escrowId) external view returns (EscrowStatus) {
        if (escrows[escrowId].escrowId == 0) revert PaymentEscrow__EscrowNotFound();
        return escrows[escrowId].status;
    }

    // === ADMIN FUNCTIONS ===

    /**
     * @notice Update escrow timeout duration
     * @param newTimeout New timeout in seconds
     */
    function setEscrowTimeout(uint256 newTimeout)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        escrowTimeout = newTimeout;
        emit EscrowTimeoutUpdated(newTimeout);
    }

    /**
     * @notice Update treasury address
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert PaymentEscrow__InvalidAddress();
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
