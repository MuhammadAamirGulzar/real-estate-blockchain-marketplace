// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/**
 * @title RWAToken
 * @author RWAchain Team
 * @notice Upgradeable ERC20 token used as payment currency for property investments
 * @dev Users purchase/receive this token to invest in tokenized properties
 */
contract RWAToken is
    Initializable,
    ERC20Upgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    // === ROLES ===
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // === STATE VARIABLES ===
    uint256 public maxSupply;              // Maximum token supply
    address public treasury;               // Platform treasury

    // === EVENTS ===
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event MaxSupplyUpdated(uint256 newMaxSupply);
    event TreasuryUpdated(address indexed newTreasury);

    // === ERRORS ===
    error RWAToken__InvalidAddress();
    error RWAToken__ExceedsMaxSupply();
    error RWAToken__InsufficientBalance();
    error RWAToken__InvalidAmount();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the RWAToken contract
     * @param admin Admin address
     * @param _treasury Treasury address
     * @param initialSupply Initial token supply
     * @param _maxSupply Maximum token supply
     */
    function initialize(
        address admin,
        address _treasury,
        uint256 initialSupply,
        uint256 _maxSupply
    ) public initializer {
        if (admin == address(0) || _treasury == address(0)) {
            revert RWAToken__InvalidAddress();
        }
        if (initialSupply > _maxSupply) {
            revert RWAToken__ExceedsMaxSupply();
        }

        __ERC20_init("RWA Platform Token", "RWAP");
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(BURNER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);

        treasury = _treasury;
        maxSupply = _maxSupply;

        // Mint initial supply to treasury
        _mint(_treasury, initialSupply);
        emit TokensMinted(_treasury, initialSupply);
    }

    // === MINTING ===
    function mint(address to, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
        nonReentrant
    {
        if (to == address(0)) revert RWAToken__InvalidAddress();
        if (amount == 0) revert RWAToken__InvalidAmount();
        if (totalSupply() + amount > maxSupply) revert RWAToken__ExceedsMaxSupply();

        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    // === BURNING ===
    function burn(address from, uint256 amount)
        external
        onlyRole(BURNER_ROLE)
        nonReentrant
    {
        if (amount == 0) revert RWAToken__InvalidAmount();
        if (balanceOf(from) < amount) revert RWAToken__InsufficientBalance();

        _burn(from, amount);
        emit TokensBurned(from, amount);
    }

    // === PAUSE LOGIC ===
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function paused() public view override returns (bool) {
        return PausableUpgradeable.paused();
    }

    // === UPDATE MAX SUPPLY ===
    function updateMaxSupply(uint256 newMaxSupply)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (newMaxSupply < totalSupply()) revert RWAToken__ExceedsMaxSupply();
        maxSupply = newMaxSupply;
        emit MaxSupplyUpdated(newMaxSupply);
    }

    // === UPDATE TREASURY ===
    function updateTreasury(address newTreasury)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (newTreasury == address(0)) revert RWAToken__InvalidAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    // === UPGRADE AUTHORIZATION ===
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}

    // === TOKEN TRANSFER HOOK (Use _update instead of _beforeTokenTransfer) ===
    function _update(address from, address to, uint256 amount)
        internal
        override
        whenNotPaused
    {
        super._update(from, to, amount);
    }

    // === VERSION ===
    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    // === BATCH TRANSFER ===
    function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) external {
        if (recipients.length != amounts.length) revert RWAToken__InvalidAmount();
        for (uint256 i = 0; i < recipients.length; i++) {
            transfer(recipients[i], amounts[i]);
        }
    }
}
