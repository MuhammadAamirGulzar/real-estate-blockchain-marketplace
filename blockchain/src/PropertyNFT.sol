// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/**
 * @title PropertyNFT
 * @author RWAchain Team
 * @notice Upgradeable ERC-721 contract representing real estate properties as NFTs
 * @dev Each property is a unique NFT with IPFS metadata and linked fractional token contract
 */
contract PropertyNFT is Initializable, UUPSUpgradeable, AccessControlUpgradeable, ERC721Upgradeable, ERC721URIStorageUpgradeable, ReentrancyGuardUpgradeable {
    // === ROLES ===
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // === STRUCTS ===
    struct PropertyInfo {
        uint256 assetRegistryId;        // Links to AssetRegistry contract
        address fractionalTokenContract; // ERC20 fractional token address
        uint256 totalFractionalSupply;   // Total fractional tokens
        uint256 propertyValue;           // Property valuation (in wei)
        bool isActive;                   // Investment status
        uint256 createdAt;               // Timestamp
        address creator;                 // Who minted this NFT
    }

    // === STATE VARIABLES ===
    mapping(uint256 => PropertyInfo) public properties;
    mapping(uint256 => uint256) public assetRegistryToTokenId; // assetRegistryId => tokenId
    
    uint256 private _nextTokenId;
    // FIX: Change the visibility of this state variable to `public`.
    // This will automatically create the public `assetRegistry()` getter function.
    address public assetRegistry;

    // === EVENTS ===
    event PropertyMinted(
        uint256 indexed tokenId,
        uint256 indexed assetRegistryId,
        string metadataURI,
        address fractionalToken,
        uint256 fractionalSupply,
        address creator
    );
    event PropertyActivated(uint256 indexed tokenId);
    event PropertyDeactivated(uint256 indexed tokenId);
    event MetadataUpdated(uint256 indexed tokenId, string newURI);
    event FractionalTokenUpdated(uint256 indexed tokenId, address newToken);

    // === ERRORS ===
    error PropertyNFT__InvalidAddress();
    error PropertyNFT__TokenDoesNotExist();
    error PropertyNFT__PropertyAlreadyExists();
    error PropertyNFT__NotAuthorized();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the PropertyNFT contract
     * @param admin Address of the admin
     * @param assetRegistryAddress Address of AssetRegistry contract // FIX 1: Corrected parameter name in comment
     */
    function initialize(
        address admin,
        address assetRegistryAddress
    ) public initializer {
        if (admin == address(0) || assetRegistryAddress == address(0)) {
            revert PropertyNFT__InvalidAddress();
        }
        
        __ERC721_init("RWA Property NFT", "RWAPROP");
        __ERC721URIStorage_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);    // Fix: Grant ADMIN_ROLE
        _grantRole(UPGRADER_ROLE, admin); // Fix: Grant UPGRADER_ROLE
        
        // This now sets the public state variable
        assetRegistry = assetRegistryAddress;
        _nextTokenId = 1;
    }

    /**
     * @notice Mint a new property NFT
     * @param to Recipient address (typically admin treasury)
     * @param assetRegistryId Property ID from AssetRegistry
     * @param metadataURI IPFS URI (ipfs://...)
     * @param fractionalToken Address of fractional ERC20 token
     * @param fractionalSupply Total fractional token supply
     * @param propertyValue Property valuation in wei
     * @return tokenId The minted token ID
     */
    function mintProperty(
        address to,
        uint256 assetRegistryId,
        string memory metadataURI,
        address fractionalToken,
        uint256 fractionalSupply,
        uint256 propertyValue
    ) external onlyRole(MINTER_ROLE) nonReentrant returns (uint256) {
        if (to == address(0) || fractionalToken == address(0)) {
            revert PropertyNFT__InvalidAddress();
        }

        // Check if property already has an NFT
        if (assetRegistryToTokenId[assetRegistryId] != 0) {
            revert PropertyNFT__PropertyAlreadyExists();
        }

        uint256 tokenId = _nextTokenId++;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);

        properties[tokenId] = PropertyInfo({
            assetRegistryId: assetRegistryId,
            fractionalTokenContract: fractionalToken,
            totalFractionalSupply: fractionalSupply,
            propertyValue: propertyValue,
            isActive: true,
            createdAt: block.timestamp,
            creator: msg.sender
        });

        assetRegistryToTokenId[assetRegistryId] = tokenId;

        emit PropertyMinted(
            tokenId,
            assetRegistryId,
            metadataURI,
            fractionalToken,
            fractionalSupply,
            msg.sender
        );

        return tokenId;
    }

    /**
     * @notice Activate or deactivate a property for investment
     * @param tokenId NFT token ID
     * @param active New active status
     */
    function setPropertyActive(uint256 tokenId, bool active) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (_ownerOf(tokenId) == address(0)) {
            revert PropertyNFT__TokenDoesNotExist();
        }

        properties[tokenId].isActive = active;

        if (active) {
            emit PropertyActivated(tokenId);
        } else {
            emit PropertyDeactivated(tokenId);
        }
    }

    /**
     * @notice Update property metadata URI
     * @param tokenId NFT token ID
     * @param newURI New IPFS metadata URI
     */
    function updateMetadataURI(uint256 tokenId, string memory newURI) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (_ownerOf(tokenId) == address(0)) {
            revert PropertyNFT__TokenDoesNotExist();
        }

        _setTokenURI(tokenId, newURI);
        emit MetadataUpdated(tokenId, newURI);
    }

    /**
     * @notice Update fractional token contract address
     * @param tokenId NFT token ID
     * @param newToken New fractional token address
     */
    function updateFractionalToken(uint256 tokenId, address newToken) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (_ownerOf(tokenId) == address(0)) {
            revert PropertyNFT__TokenDoesNotExist();
        }
        if (newToken == address(0)) {
            revert PropertyNFT__InvalidAddress();
        }

        properties[tokenId].fractionalTokenContract = newToken;
        emit FractionalTokenUpdated(tokenId, newToken);
    }

    /**
     * @notice Get property information
     * @param tokenId NFT token ID
     * @return PropertyInfo struct
     */
    function getPropertyInfo(uint256 tokenId) 
        external 
        view 
        returns (PropertyInfo memory) 
    {
        if (_ownerOf(tokenId) == address(0)) {
            revert PropertyNFT__TokenDoesNotExist();
        }
        return properties[tokenId];
    }

    /**
     * @notice Get token ID by asset registry ID
     * @param assetRegistryId Asset registry property ID
     * @return tokenId NFT token ID (0 if not minted)
     */
    function getTokenIdByAssetId(uint256 assetRegistryId) 
        external 
        view 
        returns (uint256) 
    {
        return assetRegistryToTokenId[assetRegistryId];
    }

    /**
     * @notice Check if a property NFT exists for an asset
     * @param assetRegistryId Asset registry property ID
     * @return exists True if NFT exists
     */
    function propertyExists(uint256 assetRegistryId) 
        external 
        view 
        returns (bool) 
    {
        return assetRegistryToTokenId[assetRegistryId] != 0;
    }

    // === OVERRIDES ===

    function tokenURI(uint256 tokenId) 
        public 
        view 
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable) 
        returns (string memory) 
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyRole(UPGRADER_ROLE) 
    {}

    /**
     * @notice Get contract version
     * @return version Version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}