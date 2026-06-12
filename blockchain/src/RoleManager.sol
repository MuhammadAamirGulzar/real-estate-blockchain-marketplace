// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";

/**
 * @title RoleManager
 * @dev Hierarchical role management with Admin > Sub-Admin > User/Verifier structure.
 *      Assumes one fixed wallet per user for simplicity and security.
 */
contract RoleManager is
    Initializable,
    AccessControlEnumerableUpgradeable,
    UUPSUpgradeable
{
    // === Role Hierarchy ===
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SUB_ADMIN_ROLE = keccak256("SUB_ADMIN_ROLE");
    bytes32 public constant USER_ROLE = keccak256("USER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant SUBADMIN_ROLE = keccak256("SUBADMIN_ROLE");

    // === State Variables ===
    address private _admin;
    address private _pendingAdmin;

    // Fixed wallet mapping for each user
    mapping(string => address) public userIdToWallet; // userId → wallet
    mapping(address => string) public walletToUserId; // wallet → userId

    // === Events ===
    event AdminProposed(address indexed oldAdmin, address indexed proposedAdmin);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event RoleGrantedByAdmin(bytes32 indexed role, address indexed account, address indexed grantor);
    event RoleRevokedByAdmin(bytes32 indexed role, address indexed account, address indexed revoker);
    event WalletMapped(string indexed userId, address indexed wallet);
    event RoleManagerInitialized(address indexed admin);

    // === Errors ===
    error AdminCannotRenounce();
    error NotAuthorized(address caller, string required);
    error InvalidAddress();
    error InvalidUserId();
    error WalletAlreadyMapped(address wallet);
    error CannotModifyAdminRoles();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // === Initializer ===
    function initialize(address admin_) public initializer {
        if (admin_ == address(0)) revert InvalidAddress();

        __AccessControlEnumerable_init();
        __UUPSUpgradeable_init();

        _admin = admin_;

        // Grant roles to initial admin
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);
        _grantRole(SUB_ADMIN_ROLE, admin_);
        _grantRole(UPGRADER_ROLE, admin_);

        // Set role hierarchy
        _setRoleAdmin(SUB_ADMIN_ROLE, ADMIN_ROLE);
        _setRoleAdmin(USER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(VERIFIER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(UPGRADER_ROLE, ADMIN_ROLE);

        emit RoleManagerInitialized(admin_);
    }

    // === Admin Management ===
    function admin() public view returns (address) {
        return _admin;
    }

    function pendingAdmin() public view returns (address) {
        return _pendingAdmin;
    }

    function proposeAdmin(address proposed) external onlyAdmin {
        if (proposed == address(0)) revert InvalidAddress();
        require(proposed != _admin, "RoleManager: already admin");
        _pendingAdmin = proposed;
        emit AdminProposed(_admin, proposed);
    }

    function acceptAdmin() external {
        address proposed = _pendingAdmin;
        require(proposed != address(0), "RoleManager: no pending admin");
        require(msg.sender == proposed, "RoleManager: caller not pending admin");

        address old = _admin;
        _admin = proposed;
        _pendingAdmin = address(0);

        // Grant all admin roles to new admin
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(SUB_ADMIN_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);

        // Revoke all admin roles from old admin
        _revokeRole(UPGRADER_ROLE, old);
        _revokeRole(SUB_ADMIN_ROLE, old);
        _revokeRole(ADMIN_ROLE, old);
        _revokeRole(DEFAULT_ADMIN_ROLE, old);

        emit AdminTransferred(old, _admin);
    }

    function cancelPendingAdmin() external onlyAdmin {
        _pendingAdmin = address(0);
    }

    // === Role Management ===
    function grantRoleByAdmin(bytes32 role, address account) public {  // Changed from external to public
        if (account == address(0)) revert InvalidAddress();

        if (hasRole(ADMIN_ROLE, msg.sender)) {
            _grantRole(role, account);
        } else if (hasRole(SUB_ADMIN_ROLE, msg.sender)) {
            if (role == ADMIN_ROLE || role == SUB_ADMIN_ROLE || role == UPGRADER_ROLE) {
                revert CannotModifyAdminRoles();
            }
            _grantRole(role, account);
        } else {
            revert NotAuthorized(msg.sender, "ADMIN or SUB_ADMIN");
        }

        emit RoleGrantedByAdmin(role, account, msg.sender);
    }

    function revokeRoleByAdmin(bytes32 role, address account) public {  // Changed from external to public
        if (account == address(0)) revert InvalidAddress();

        if (hasRole(ADMIN_ROLE, msg.sender)) {
            _revokeRole(role, account);
        } else if (hasRole(SUB_ADMIN_ROLE, msg.sender)) {
            if (role == ADMIN_ROLE || role == SUB_ADMIN_ROLE || role == UPGRADER_ROLE) {
                revert CannotModifyAdminRoles();
            }
            _revokeRole(role, account);
        } else {
            revert NotAuthorized(msg.sender, "ADMIN or SUB_ADMIN");
        }

        emit RoleRevokedByAdmin(role, account, msg.sender);
    }

    function grantRoles(address account, bytes32[] calldata roles) external {
        for (uint256 i = 0; i < roles.length; i++) {
            grantRoleByAdmin(roles[i], account);  // ✅ Now works because function is public
        }
    }

    function revokeRoles(address account, bytes32[] calldata roles) external {
        for (uint256 i = 0; i < roles.length; i++) {
            revokeRoleByAdmin(roles[i], account);  // ✅ Now works because function is public
        }
    }

    // === Fixed Wallet Mapping ===
    function mapWallet(string calldata userId, address wallet) external onlyAdminOrSubAdmin {
        if (wallet == address(0)) revert InvalidAddress();
        if (bytes(userId).length == 0) revert InvalidUserId();
        if (userIdToWallet[userId] != address(0)) revert WalletAlreadyMapped(userIdToWallet[userId]);

        userIdToWallet[userId] = wallet;
        walletToUserId[wallet] = userId;

        emit WalletMapped(userId, wallet);
    }

    function getWalletByUserId(string calldata userId) external view returns (address) {
        return userIdToWallet[userId];
    }

    function getUserIdByWallet(address wallet) external view returns (string memory) {
        return walletToUserId[wallet];
    }

    // === Role Check Helpers ===
    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }

    function isSubAdmin(address account) external view returns (bool) {
        return hasRole(SUB_ADMIN_ROLE, account);
    }

    function isUser(address account) external view returns (bool) {
        return hasRole(USER_ROLE, account);
    }

    function isVerifier(address account) external view returns (bool) {
        return hasRole(VERIFIER_ROLE, account);
    }

    function listRoleMembers(bytes32 role) external view returns (address[] memory members) {
        uint256 count = getRoleMemberCount(role);
        members = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            members[i] = getRoleMember(role, i);
        }
    }

    // === Security ===
    function renounceRole(bytes32 role, address account)
        public
        virtual
        override(AccessControlUpgradeable, IAccessControl)
    {
        if ((role == ADMIN_ROLE || role == DEFAULT_ADMIN_ROLE) && account == _admin) {
            revert AdminCannotRenounce();
        }
        super.renounceRole(role, account);
    }

    // === Upgradeability ===
    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}

    function version() external pure returns (string memory) {
        return "3.0.0";
    }

    // === Modifiers ===
    modifier onlyAdmin() {
        if (!hasRole(ADMIN_ROLE, msg.sender)) {
            revert NotAuthorized(msg.sender, "ADMIN");
        }
        _;
    }

    modifier onlyAdminOrSubAdmin() {
        if (!hasRole(ADMIN_ROLE, msg.sender) && !hasRole(SUB_ADMIN_ROLE, msg.sender)) {
            revert NotAuthorized(msg.sender, "ADMIN or SUB_ADMIN");
        }
        _;
    }
}
