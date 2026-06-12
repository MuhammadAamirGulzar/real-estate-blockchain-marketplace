// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./RoleManager.sol";

/**
 * @title KYCRegistry
 * @dev Manages KYC verification and verifier applications with optimized pending lists
 */
contract KYCRegistry is Initializable, UUPSUpgradeable {

    // === State Variables ===
    RoleManager public roleManager;

    enum KYCStatus { None, Pending, Approved, Rejected }

    struct KYCRequest {
        address user;
        string documentHash; // IPFS hash
        KYCStatus status;
        uint256 submittedAt;
        uint256 reviewedAt;
        address reviewer;
        string rejectionReason;
    }

    mapping(address => KYCRequest) public kycRequests;
    address[] public pendingKYC;
    mapping(address => uint256) private pendingKYCIndex; // O(1) removal

    struct VerifierApplication {
        address applicant;
        string qualifications; // IPFS hash
        bool isPending;
        uint256 appliedAt;
    }

    mapping(address => VerifierApplication) public verifierApplications;
    address[] public pendingVerifierApplications;
    mapping(address => uint256) private pendingVerifierIndex; // O(1) removal

    // === Events ===
    event KYCSubmitted(address indexed user, string documentHash, uint256 timestamp);
    event KYCApproved(address indexed user, address indexed reviewer, uint256 timestamp);
    event KYCRejected(address indexed user, address indexed reviewer, string reason, uint256 timestamp);
    event VerifierApplicationSubmitted(address indexed applicant, string qualifications, uint256 timestamp);
    event VerifierApplicationApproved(address indexed applicant, address indexed reviewer, uint256 timestamp);
    event VerifierApplicationRejected(address indexed applicant, address indexed reviewer, uint256 timestamp);
    event KYCRegistryInitialized(address indexed roleManager);

    // === Errors ===
    error NotAuthorized(address caller);
    error InvalidAddress();
    error KYCAlreadySubmitted();
    error KYCNotApproved();
    error KYCRequired();
    error VerifierApplicationExists();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // === Initializer ===
    function initialize(address roleManager_) public initializer {
        if (roleManager_ == address(0)) revert InvalidAddress();
        __UUPSUpgradeable_init();
        roleManager = RoleManager(roleManager_);
        emit KYCRegistryInitialized(roleManager_);
    }

    // === KYC Management ===
    function submitKYC(string calldata documentHash) external {
        KYCRequest storage existing = kycRequests[msg.sender];
        if (existing.status == KYCStatus.Pending || existing.status == KYCStatus.Approved) {
            revert KYCAlreadySubmitted();
        }

        kycRequests[msg.sender] = KYCRequest({
            user: msg.sender,
            documentHash: documentHash,
            status: KYCStatus.Pending,
            submittedAt: block.timestamp,
            reviewedAt: 0,
            reviewer: address(0),
            rejectionReason: ""
        });

        pendingKYCIndex[msg.sender] = pendingKYC.length + 1;
        pendingKYC.push(msg.sender);

        emit KYCSubmitted(msg.sender, documentHash, block.timestamp);
    }

    function approveKYC(address user) public onlyAdminOrSubAdmin {
        if (user == address(0)) revert InvalidAddress();
        KYCRequest storage request = kycRequests[user];
        require(request.status == KYCStatus.Pending, "KYC not pending");

        request.status = KYCStatus.Approved;
        request.reviewedAt = block.timestamp;
        request.reviewer = msg.sender;

        // Grant USER_ROLE via RoleManager
        roleManager.grantRoleByAdmin(roleManager.USER_ROLE(), user);

        _removePendingKYC(user);

        emit KYCApproved(user, msg.sender, block.timestamp);
    }

    function rejectKYC(address user, string calldata reason) external onlyAdminOrSubAdmin {
        if (user == address(0)) revert InvalidAddress();
        KYCRequest storage request = kycRequests[user];
        require(request.status == KYCStatus.Pending, "KYC not pending");

        request.status = KYCStatus.Rejected;
        request.reviewedAt = block.timestamp;
        request.reviewer = msg.sender;
        request.rejectionReason = reason;

        _removePendingKYC(user);

        emit KYCRejected(user, msg.sender, reason, block.timestamp);
    }

    function batchApproveKYC(address[] calldata users) external onlyAdminOrSubAdmin {
        for (uint256 i = 0; i < users.length; i++) {
            if (kycRequests[users[i]].status == KYCStatus.Pending) {
                approveKYC(users[i]);
            }
        }
    }

    // === Verifier Applications ===
    function applyForVerifier(string calldata qualifications) external onlyKYCApproved {
        if (verifierApplications[msg.sender].isPending) revert VerifierApplicationExists();

        verifierApplications[msg.sender] = VerifierApplication({
            applicant: msg.sender,
            qualifications: qualifications,
            isPending: true,
            appliedAt: block.timestamp
        });

        pendingVerifierIndex[msg.sender] = pendingVerifierApplications.length + 1;
        pendingVerifierApplications.push(msg.sender);

        emit VerifierApplicationSubmitted(msg.sender, qualifications, block.timestamp);
    }

    function approveVerifierApplication(address applicant) external onlyAdminOrSubAdmin {
        if (applicant == address(0)) revert InvalidAddress();
        VerifierApplication storage app = verifierApplications[applicant];
        require(app.isPending, "No pending application");

        app.isPending = false;
        roleManager.grantRoleByAdmin(roleManager.VERIFIER_ROLE(), applicant);
        _removePendingVerifierApplication(applicant);

        emit VerifierApplicationApproved(applicant, msg.sender, block.timestamp);
    }

    function rejectVerifierApplication(address applicant) external onlyAdminOrSubAdmin {
        if (applicant == address(0)) revert InvalidAddress();
        VerifierApplication storage app = verifierApplications[applicant];
        require(app.isPending, "No pending application");

        app.isPending = false;
        _removePendingVerifierApplication(applicant);

        emit VerifierApplicationRejected(applicant, msg.sender, block.timestamp);
    }

    function grantVerifierRole(address user) external onlyAdminOrSubAdmin{
        if (user == address(0)) revert InvalidAddress();
        if (kycRequests[user].status != KYCStatus.Approved) revert KYCRequired();
        roleManager.grantRoleByAdmin(roleManager.VERIFIER_ROLE(), user);
    }

    // === View Functions ===
    function isKYCApproved(address user) external view returns (bool) {
        return kycRequests[user].status == KYCStatus.Approved;
    }

    function getKYCStatus(address user) external view returns (KYCStatus) {
        return kycRequests[user].status;
    }

    function getPendingKYC() external view returns (address[] memory) {
        return pendingKYC;
    }

    function getPendingVerifierApplications() external view returns (address[] memory) {
        return pendingVerifierApplications;
    }

    // === Internal Helpers (O(1) removal) ===
    function _removePendingKYC(address user) private {
        uint256 index = pendingKYCIndex[user];
        if (index == 0) return;

        uint256 arrayIndex = index - 1;
        uint256 lastIndex = pendingKYC.length - 1;

        if (arrayIndex != lastIndex) {
            address lastUser = pendingKYC[lastIndex];
            pendingKYC[arrayIndex] = lastUser;
            pendingKYCIndex[lastUser] = arrayIndex + 1;
        }

        pendingKYC.pop();
        delete pendingKYCIndex[user];
    }

    function _removePendingVerifierApplication(address applicant) private {
        uint256 index = pendingVerifierIndex[applicant];
        if (index == 0) return;

        uint256 arrayIndex = index - 1;
        uint256 lastIndex = pendingVerifierApplications.length - 1;

        if (arrayIndex != lastIndex) {
            address lastApplicant = pendingVerifierApplications[lastIndex];
            pendingVerifierApplications[arrayIndex] = lastApplicant;
            pendingVerifierIndex[lastApplicant] = arrayIndex + 1;
        }

        pendingVerifierApplications.pop();
        delete pendingVerifierIndex[applicant];
    }

    // === Upgradeability ===
    function _authorizeUpgrade(address) internal view override {
        if (!roleManager.hasRole(roleManager.UPGRADER_ROLE(), msg.sender)) revert NotAuthorized(msg.sender);
    }

    function version() external pure returns (string memory) {
        return "3.0.0";
    }

    // === Modifiers ===
    modifier onlyAdminOrSubAdmin() {
        if (!roleManager.hasRole(roleManager.ADMIN_ROLE(), msg.sender) &&
            !roleManager.hasRole(roleManager.SUB_ADMIN_ROLE(), msg.sender)) {
            revert NotAuthorized(msg.sender);
        }
        _;
    }

    modifier onlyKYCApproved() {
        if (kycRequests[msg.sender].status != KYCStatus.Approved) revert KYCRequired();
        _;
    }
}
