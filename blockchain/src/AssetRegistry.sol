// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./RoleManager.sol";
import "./KYCRegistry.sol";

/**
 * @title AssetRegistry
 * @dev Property listing and verifier assignment with improved checks and audit events
 */
contract AssetRegistry is Initializable, UUPSUpgradeable {

    RoleManager public roleManager;
    KYCRegistry public kycRegistry;

    enum PropertyStatus { Pending, Verified, Rejected, Listed }

    struct Property {
        uint256 id;
        address owner;
        string metadataHash; // IPFS hash
        PropertyStatus status;
        address assignedVerifier;
        uint256 listedAt;
        uint256 verifiedAt;
        string rejectionReason;
    }

    struct PropertyFinancials {
        uint256 purchasePrice; // USD (6 decimals)
        uint256 valuation; // USD (6 decimals)
        uint256 expectedROI; // Percentage (2 decimals, e.g., 850 = 8.50%)
        uint256 rentalIncomeMonthly; // USD (6 decimals)
        uint256 valuationDate;
        address appraiser;
        string valuationDocHash; // IPFS
    }

    struct PropertyLegal {
        string titleDeedHash; // IPFS
        string ownershipProofHash; // IPFS
        string jurisdiction;
        bool hasEncumbrances;
        string legalDocsHash; // IPFS (array of documents)
    }

    uint256 public propertyCounter;
    mapping(uint256 => Property) public properties;
    mapping(address => uint256[]) public ownerProperties;
    mapping(address => uint256[]) public verifierAssignments;

    // Prevent duplicate listings per user
    mapping(address => mapping(string => bool)) private _userPropertyExists;

    mapping(uint256 => PropertyFinancials) public propertyFinancials;
    mapping(uint256 => PropertyLegal) public propertyLegal;

    // === Events ===
    event PropertyListed(uint256 indexed propertyId, address indexed owner, string metadataHash, uint256 timestamp);
    event VerifierAssigned(uint256 indexed propertyId, address indexed verifier, address indexed assignedBy, uint256 timestamp);
    event PropertyVerified(uint256 indexed propertyId, address indexed verifier, PropertyStatus previousStatus, uint256 timestamp);
    event PropertyRejected(uint256 indexed propertyId, address indexed verifier, PropertyStatus previousStatus, string reason, uint256 timestamp);
    event AssetRegistryInitialized(address indexed roleManager, address indexed kycRegistry);
    event PropertyFinancialsSet(uint256 indexed propertyId, uint256 valuation, uint256 expectedROI);
    event PropertyLegalSet(uint256 indexed propertyId, string titleDeedHash);

    // === Errors ===
    error NotAuthorized(address caller);
    error InvalidAddress();
    error KYCRequired();
    error PropertyNotFound();
    error NotAssignedVerifier();
    error DuplicateProperty();
    error VerifierAlreadyAssigned();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address roleManager_, address kycRegistry_) public initializer {
        if (roleManager_ == address(0) || kycRegistry_ == address(0)) revert InvalidAddress();

        __UUPSUpgradeable_init();
        roleManager = RoleManager(roleManager_);
        kycRegistry = KYCRegistry(kycRegistry_);

        emit AssetRegistryInitialized(roleManager_, kycRegistry_);
    }

    // === Property Management ===

    function listProperty(string calldata metadataHash) external onlyKYCApproved returns (uint256) {
        if (_userPropertyExists[msg.sender][metadataHash]) revert DuplicateProperty();

        propertyCounter++;
        uint256 propertyId = propertyCounter;

        properties[propertyId] = Property({
            id: propertyId,
            owner: msg.sender,
            metadataHash: metadataHash,
            status: PropertyStatus.Pending,
            assignedVerifier: address(0),
            listedAt: block.timestamp,
            verifiedAt: 0,
            rejectionReason: ""
        });

        ownerProperties[msg.sender].push(propertyId);
        _userPropertyExists[msg.sender][metadataHash] = true;

        emit PropertyListed(propertyId, msg.sender, metadataHash, block.timestamp);
        return propertyId;
    }

    function assignVerifier(uint256 propertyId, address verifier) external onlyAdminOrSubAdmin {
        if (verifier == address(0)) revert InvalidAddress();
        if (propertyId == 0 || propertyId > propertyCounter) revert PropertyNotFound();

        Property storage property = properties[propertyId];
        if (property.assignedVerifier != address(0)) revert VerifierAlreadyAssigned();
        if (property.status != PropertyStatus.Pending) revert NotAssignedVerifier();

        require(roleManager.hasRole(roleManager.VERIFIER_ROLE(), verifier), "Not a verifier");

        property.assignedVerifier = verifier;
        verifierAssignments[verifier].push(propertyId);

        emit VerifierAssigned(propertyId, verifier, msg.sender, block.timestamp);
    }

    function verifyProperty(uint256 propertyId) external {
        if (propertyId == 0 || propertyId > propertyCounter) revert PropertyNotFound();
        Property storage property = properties[propertyId];

        if (property.assignedVerifier != msg.sender) revert NotAssignedVerifier();
        require(property.status == PropertyStatus.Pending, "Property not pending");

        PropertyStatus previous = property.status;
        property.status = PropertyStatus.Verified;
        property.verifiedAt = block.timestamp;

        emit PropertyVerified(propertyId, msg.sender, previous, block.timestamp);
    }

    function rejectProperty(uint256 propertyId, string calldata reason) external {
        if (propertyId == 0 || propertyId > propertyCounter) revert PropertyNotFound();
        Property storage property = properties[propertyId];

        if (property.assignedVerifier != msg.sender) revert NotAssignedVerifier();
        require(property.status == PropertyStatus.Pending, "Property not pending");

        PropertyStatus previous = property.status;
        property.status = PropertyStatus.Rejected;
        property.rejectionReason = reason;

        emit PropertyRejected(propertyId, msg.sender, previous, reason, block.timestamp);
    }

    function setPropertyFinancials(
        uint256 propertyId,
        uint256 purchasePrice,
        uint256 valuation,
        uint256 expectedROI,
        uint256 rentalIncomeMonthly,
        address appraiser,
        string calldata valuationDocHash
    ) external onlyAdminOrSubAdmin {
        require(propertyId > 0 && propertyId <= propertyCounter, "Invalid property");
        
        propertyFinancials[propertyId] = PropertyFinancials({
            purchasePrice: purchasePrice,
            valuation: valuation,
            expectedROI: expectedROI,
            rentalIncomeMonthly: rentalIncomeMonthly,
            valuationDate: block.timestamp,
            appraiser: appraiser,
            valuationDocHash: valuationDocHash
        });
        
        emit PropertyFinancialsSet(propertyId, valuation, expectedROI);
    }

    function setPropertyLegal(
        uint256 propertyId,
        string calldata titleDeedHash,
        string calldata ownershipProofHash,
        string calldata jurisdiction,
        bool hasEncumbrances,
        string calldata legalDocsHash
    ) external onlyAdminOrSubAdmin {
        require(propertyId > 0 && propertyId <= propertyCounter, "Invalid property");
        
        propertyLegal[propertyId] = PropertyLegal({
            titleDeedHash: titleDeedHash,
            ownershipProofHash: ownershipProofHash,
            jurisdiction: jurisdiction,
            hasEncumbrances: hasEncumbrances,
            legalDocsHash: legalDocsHash
        });
        
        emit PropertyLegalSet(propertyId, titleDeedHash);
    }

    // === Views ===

    function getProperty(uint256 propertyId) external view returns (Property memory) {
        if (propertyId == 0 || propertyId > propertyCounter) revert PropertyNotFound();
        return properties[propertyId];
    }

    function getOwnerProperties(address owner) external view returns (uint256[] memory) {
        return ownerProperties[owner]; // Pagination recommended in frontend
    }

    function getVerifierAssignments(address verifier) external view returns (uint256[] memory) {
        return verifierAssignments[verifier]; // Pagination recommended in frontend
    }

    function getPropertyFinancials(uint256 propertyId) 
        external 
        view 
        returns (PropertyFinancials memory) 
    {
        return propertyFinancials[propertyId];
    }

    function getPropertyLegal(uint256 propertyId) 
        external 
        view 
        returns (PropertyLegal memory) 
    {
        return propertyLegal[propertyId];
    }

    // === Upgradeability ===

    function _authorizeUpgrade(address) internal view override {
        if (!roleManager.hasRole(roleManager.UPGRADER_ROLE(), msg.sender)) revert NotAuthorized(msg.sender);
    }

    function version() external pure returns (string memory) {
        return "2.1.0";
    }

    // === Modifiers ===

    modifier onlyAdminOrSubAdmin() {
        if (!roleManager.hasRole(roleManager.ADMIN_ROLE(), msg.sender) &&
            !roleManager.hasRole(roleManager.SUB_ADMIN_ROLE(), msg.sender)) revert NotAuthorized(msg.sender);
        _;
    }

    modifier onlyKYCApproved() {
        if (!kycRegistry.isKYCApproved(msg.sender)) revert KYCRequired();
        _;
    }
}
