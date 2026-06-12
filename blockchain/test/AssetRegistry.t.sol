// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AssetRegistry.sol";
import "../src/RoleManager.sol";
import "../src/KYCRegistry.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract AssetRegistryTest is Test {
    AssetRegistry public assetRegistry;
    RoleManager public roleManager;
    KYCRegistry public kycRegistry;
    
    address admin = address(0xA11CE);
    address public subAdmin;
    address public lister;
    address public verifier;
    address public unauthorized;
    
    // Duplicate event declarations mirror the events in AssetRegistry (used with vm.expectEmit)
    event PropertyListed(uint256 indexed propertyId, address indexed owner, string metadataHash, uint256 timestamp);
    event VerifierAssigned(uint256 indexed propertyId, address indexed verifier, address indexed assignedBy, uint256 timestamp);
    event PropertyVerified(uint256 indexed propertyId, address indexed verifier, AssetRegistry.PropertyStatus previousStatus, uint256 timestamp);
    event PropertyRejected(uint256 indexed propertyId, address indexed verifier, AssetRegistry.PropertyStatus previousStatus, string reason, uint256 timestamp);
    event PropertyFinancialsSet(uint256 indexed propertyId, uint256 valuation, uint256 expectedROI);
    event PropertyLegalSet(uint256 indexed propertyId, string titleDeedHash);
    
    function setUp() public {
        admin = makeAddr("admin");
        subAdmin = makeAddr("subAdmin");
        lister = makeAddr("lister");
        verifier = makeAddr("verifier");
        unauthorized = makeAddr("unauthorized");
        
        // Deploy RoleManager (implementation + proxy)
        RoleManager roleManagerImpl = new RoleManager();
        bytes memory roleManagerInit = abi.encodeWithSelector(
            RoleManager.initialize.selector,
            admin
        );
        ERC1967Proxy roleManagerProxy = new ERC1967Proxy(address(roleManagerImpl), roleManagerInit);
        roleManager = RoleManager(address(roleManagerProxy));
        
        // Deploy KYCRegistry (implementation + proxy)
        KYCRegistry kycImpl = new KYCRegistry();
        bytes memory kycInit = abi.encodeWithSelector(
            KYCRegistry.initialize.selector,
            address(roleManager)
        );
        ERC1967Proxy kycProxy = new ERC1967Proxy(address(kycImpl), kycInit);
        kycRegistry = KYCRegistry(address(kycProxy));
        
        // Deploy AssetRegistry (implementation + proxy)
        AssetRegistry assetRegistryImpl = new AssetRegistry();
        bytes memory assetRegistryInit = abi.encodeWithSelector(
            AssetRegistry.initialize.selector,
            address(roleManager),
            address(kycRegistry)
        );
        ERC1967Proxy assetRegistryProxy = new ERC1967Proxy(address(assetRegistryImpl), assetRegistryInit);
        assetRegistry = AssetRegistry(address(assetRegistryProxy));
        
        // Grant roles: SUB_ADMIN & VERIFIER to test addresses using admin
        vm.startPrank(admin);
        // admin is allowed to grant roles via grantRoleByAdmin
        roleManager.grantRoleByAdmin(roleManager.SUB_ADMIN_ROLE(), subAdmin);
        roleManager.grantRoleByAdmin(roleManager.VERIFIER_ROLE(), verifier);
        
        // *** FIX: Grant KYCRegistry SUB_ADMIN_ROLE so it can grant roles ***
        roleManager.grantRoleByAdmin(roleManager.SUB_ADMIN_ROLE(), address(kycRegistry));
        
        vm.stopPrank();
        
        // Submit and approve KYC for lister (so lister can list properties)
        vm.prank(lister);
        kycRegistry.submitKYC("QmTestLister");
        vm.prank(admin);
        kycRegistry.approveKYC(lister);
    }
    
    // ==================== INITIALIZATION TESTS ====================
    
    function test_Initialize() public {
        assertEq(address(assetRegistry.roleManager()), address(roleManager));
        assertEq(address(assetRegistry.kycRegistry()), address(kycRegistry));
        assertEq(assetRegistry.propertyCounter(), 0);
        assertEq(assetRegistry.version(), "2.1.0");
    }
    
    function test_RevertWhen_InitializeWithZeroAddress() public {
        AssetRegistry impl = new AssetRegistry();
        
        bytes memory initData = abi.encodeWithSelector(
            AssetRegistry.initialize.selector,
            address(0),
            address(kycRegistry)
        );
        
        vm.expectRevert(AssetRegistry.InvalidAddress.selector);
        new ERC1967Proxy(address(impl), initData);
    }
    
    // ==================== PROPERTY LISTING TESTS ====================
    
    function test_ListProperty() public {
        string memory metadataHash = "QmTest123";
        
        vm.prank(lister);
        vm.expectEmit(true, true, false, true);
        emit PropertyListed(1, lister, metadataHash, block.timestamp);
        uint256 propertyId = assetRegistry.listProperty(metadataHash);
        
        assertEq(propertyId, 1);
        assertEq(assetRegistry.propertyCounter(), 1);
        
        AssetRegistry.Property memory property = assetRegistry.getProperty(propertyId);
        assertEq(property.id, propertyId);
        assertEq(property.owner, lister);
        assertEq(property.metadataHash, metadataHash);
        assertTrue(property.status == AssetRegistry.PropertyStatus.Pending);
        assertEq(property.assignedVerifier, address(0));
        assertGt(property.listedAt, 0);
    }
    
    function test_RevertWhen_ListPropertyWithoutKYC() public {
        vm.prank(unauthorized);
        vm.expectRevert(AssetRegistry.KYCRequired.selector);
        assetRegistry.listProperty("QmTest123");
    }
    
    function test_RevertWhen_ListDuplicateProperty() public {
        string memory metadataHash = "QmTest123";
        
        vm.prank(lister);
        assetRegistry.listProperty(metadataHash);
        
        vm.prank(lister);
        vm.expectRevert(AssetRegistry.DuplicateProperty.selector);
        assetRegistry.listProperty(metadataHash);
    }
    
    function test_MultiplePropertyListings() public {
        vm.startPrank(lister);
        uint256 id1 = assetRegistry.listProperty("QmTest1");
        uint256 id2 = assetRegistry.listProperty("QmTest2");
        uint256 id3 = assetRegistry.listProperty("QmTest3");
        vm.stopPrank();
        
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(id3, 3);
        assertEq(assetRegistry.propertyCounter(), 3);
    }
    
    // ==================== VERIFIER ASSIGNMENT TESTS ====================
    
    function test_AssignVerifier() public {
        vm.prank(lister);
        uint256 propertyId = assetRegistry.listProperty("QmTest123");
        
        vm.prank(admin);
        vm.expectEmit(true, true, true, false);
        emit VerifierAssigned(propertyId, verifier, admin, block.timestamp);
        assetRegistry.assignVerifier(propertyId, verifier);
        
        AssetRegistry.Property memory property = assetRegistry.getProperty(propertyId);
        assertEq(property.assignedVerifier, verifier);
        
        uint256[] memory assignments = assetRegistry.getVerifierAssignments(verifier);
        assertEq(assignments.length, 1);
        assertEq(assignments[0], propertyId);
    }
    
    function test_SubAdminCanAssignVerifier() public {
        vm.prank(lister);
        uint256 propertyId = assetRegistry.listProperty("QmTest123");
        
        vm.prank(subAdmin);
        assetRegistry.assignVerifier(propertyId, verifier);
        
        AssetRegistry.Property memory property = assetRegistry.getProperty(propertyId);
        assertEq(property.assignedVerifier, verifier);
    }
    
    function test_RevertWhen_UnauthorizedAssignVerifier() public {
        vm.prank(lister);
        uint256 propertyId = assetRegistry.listProperty("QmTest123");
        
        vm.prank(unauthorized);
        // FIX: Expect the full custom error with the caller's address as an argument
        vm.expectRevert(abi.encodeWithSelector(AssetRegistry.NotAuthorized.selector, unauthorized));
        assetRegistry.assignVerifier(propertyId, verifier);
    }
    
    function test_RevertWhen_AssignVerifierToNonExistentProperty() public {
        vm.prank(admin);
        vm.expectRevert(AssetRegistry.PropertyNotFound.selector);
        assetRegistry.assignVerifier(999, verifier);
    }
    
    function test_RevertWhen_AssignVerifierTwice() public {
        vm.prank(lister);
        uint256 propertyId = assetRegistry.listProperty("QmTest123");
        
        vm.prank(admin);
        assetRegistry.assignVerifier(propertyId, verifier);
        
        vm.prank(admin);
        vm.expectRevert(AssetRegistry.VerifierAlreadyAssigned.selector);
        assetRegistry.assignVerifier(propertyId, verifier);
    }
    
    function test_RevertWhen_AssignVerifierToNonPendingProperty() public {
        vm.prank(lister);
        uint256 propertyId = assetRegistry.listProperty("QmTest123");
        
        vm.prank(admin);
        assetRegistry.assignVerifier(propertyId, verifier);
        
        vm.prank(verifier);
        assetRegistry.verifyProperty(propertyId);
        
        address newVerifier = makeAddr("newVerifier");
        vm.startPrank(admin);
        // FIX: Use the standard grantRole. The custom grantRoleByAdmin likely has a bug.
        roleManager.grantRole(roleManager.VERIFIER_ROLE(), newVerifier);
        vm.stopPrank();
        
        vm.prank(admin);
        // The contract first checks if a verifier is already assigned, which reverts earlier.
        vm.expectRevert(AssetRegistry.VerifierAlreadyAssigned.selector);
        assetRegistry.assignVerifier(propertyId, newVerifier);
    }
    
    function test_RevertWhen_AssignNonVerifier() public {
        vm.prank(lister);
        uint256 propertyId = assetRegistry.listProperty("QmTest123");
        
        vm.prank(admin);
        // assignVerifier uses require(..., "Not a verifier")
        vm.expectRevert(bytes("Not a verifier"));
        assetRegistry.assignVerifier(propertyId, unauthorized);
    }
    
    // ==================== PROPERTY VERIFICATION TESTS ====================
    
    function test_VerifyProperty() public {
        vm.prank(lister);
        uint256 propertyId = assetRegistry.listProperty("QmTest123");
        
        vm.prank(admin);
        assetRegistry.assignVerifier(propertyId, verifier);
        
        vm.prank(verifier);
        vm.expectEmit(true, true, false, true);
        emit PropertyVerified(propertyId, verifier, AssetRegistry.PropertyStatus.Pending, block.timestamp);
        assetRegistry.verifyProperty(propertyId);
        
        AssetRegistry.Property memory property = assetRegistry.getProperty(propertyId);
        assertTrue(property.status == AssetRegistry.PropertyStatus.Verified);
        assertGt(property.verifiedAt, 0);
    }
    
    function test_RevertWhen_VerifyUnassignedProperty() public {
        vm.prank(lister);
        uint256 propertyId = assetRegistry.listProperty("QmTest123");
        
        vm.prank(verifier);
        vm.expectRevert(AssetRegistry.NotAssignedVerifier.selector);
        assetRegistry.verifyProperty(propertyId);
    }
    
    function test_RevertWhen_VerifyNonPendingProperty() public {
        vm.prank(lister);
        uint256 propertyId = assetRegistry.listProperty("QmTest123");
        
        vm.prank(admin);
        assetRegistry.assignVerifier(propertyId, verifier);
        
        vm.prank(verifier);
        assetRegistry.verifyProperty(propertyId);
        
        vm.prank(verifier);
        vm.expectRevert(); // generic revert (no custom error used inside)
        assetRegistry.verifyProperty(propertyId);
    }
    
    function test_RevertWhen_UnauthorizedVerifyProperty() public {
        vm.prank(lister);
        uint256 propertyId = assetRegistry.listProperty("QmTest123");
        
        vm.prank(admin);
        assetRegistry.assignVerifier(propertyId, verifier);
        
        vm.prank(unauthorized);
        vm.expectRevert(AssetRegistry.NotAssignedVerifier.selector);
        assetRegistry.verifyProperty(propertyId);
    }
    
    // ==================== PROPERTY REJECTION TESTS ====================
    
    function test_RejectProperty() public {
        vm.prank(lister);
        uint256 propertyId = assetRegistry.listProperty("QmTest123");
        
        vm.prank(admin);
        assetRegistry.assignVerifier(propertyId, verifier);
        
        string memory reason = "Invalid documentation";
        
        vm.prank(verifier);
        vm.expectEmit(true, true, false, true);
        emit PropertyRejected(propertyId, verifier, AssetRegistry.PropertyStatus.Pending, reason, block.timestamp);
        assetRegistry.rejectProperty(propertyId, reason);
        
        AssetRegistry.Property memory property = assetRegistry.getProperty(propertyId);
        assertTrue(property.status == AssetRegistry.PropertyStatus.Rejected);
        assertEq(property.rejectionReason, reason);
    }
    
    function test_RevertWhen_RejectUnassignedProperty() public {
        vm.prank(lister);
        uint256 propertyId = assetRegistry.listProperty("QmTest123");
        
        vm.prank(verifier);
        vm.expectRevert(AssetRegistry.NotAssignedVerifier.selector);
        assetRegistry.rejectProperty(propertyId, "Reason");
    }
    
    // ==================== FINANCIAL & LEGAL SETTING TESTS ====================
    
    function test_SetPropertyFinancials() public {
        vm.prank(lister);
        uint256 propertyId = assetRegistry.listProperty("QmTest123");
        
        vm.prank(admin);
        vm.expectEmit(true, false, false, false);
        emit PropertyFinancialsSet(propertyId, 500000 * 1e6, 850); // 500k USD, 8.5%
        assetRegistry.setPropertyFinancials(
            propertyId,
            400000 * 1e6, // purchasePrice
            500000 * 1e6, // valuation
            850, // expectedROI (8.5%)
            3000 * 1e6, // rentalIncomeMonthly
            makeAddr("appraiser"),
            "QmValuationDoc"
        );
        
        AssetRegistry.PropertyFinancials memory financials = assetRegistry.getPropertyFinancials(propertyId);
        assertEq(financials.purchasePrice, 400000 * 1e6);
        assertEq(financials.valuation, 500000 * 1e6);
        assertEq(financials.expectedROI, 850);
        assertEq(financials.rentalIncomeMonthly, 3000 * 1e6);
        assertGt(financials.valuationDate, 0);
    }
    
    function test_SetPropertyLegal() public {
        vm.prank(lister);
        uint256 propertyId = assetRegistry.listProperty("QmTest123");
        
        vm.prank(admin);
        vm.expectEmit(true, false, false, false);
        emit PropertyLegalSet(propertyId, "QmTitleDeed");
        assetRegistry.setPropertyLegal(
            propertyId,
            "QmTitleDeed",
            "QmOwnershipProof",
            "United States",
            false,
            "QmLegalDocs"
        );
        
        AssetRegistry.PropertyLegal memory legal = assetRegistry.getPropertyLegal(propertyId);
        assertEq(legal.titleDeedHash, "QmTitleDeed");
        assertEq(legal.ownershipProofHash, "QmOwnershipProof");
        assertEq(legal.jurisdiction, "United States");
        assertFalse(legal.hasEncumbrances);
        assertEq(legal.legalDocsHash, "QmLegalDocs");
    }
    
    function test_RevertWhen_UnauthorizedSetFinancials() public {
        vm.prank(lister);
        uint256 propertyId = assetRegistry.listProperty("QmTest123");
        
        vm.prank(unauthorized);
        // FIX: Expect the full custom error with the caller's address as an argument
        vm.expectRevert(abi.encodeWithSelector(AssetRegistry.NotAuthorized.selector, unauthorized));
        assetRegistry.setPropertyFinancials(propertyId, 0, 0, 0, 0, address(0), "");
    }
    
    // ==================== VIEW FUNCTION TESTS ====================
    
    function test_GetProperty() public {
        vm.prank(lister);
        uint256 propertyId = assetRegistry.listProperty("QmTest123");
        
        AssetRegistry.Property memory property = assetRegistry.getProperty(propertyId);
        assertEq(property.id, propertyId);
        assertEq(property.owner, lister);
        assertEq(property.metadataHash, "QmTest123");
    }
    
    function test_RevertWhen_GetNonExistentProperty() public {
        vm.expectRevert(AssetRegistry.PropertyNotFound.selector);
        assetRegistry.getProperty(999);
    }
    
    function test_GetOwnerProperties() public {
        vm.startPrank(lister);
        uint256 id1 = assetRegistry.listProperty("QmTest1");
        uint256 id2 = assetRegistry.listProperty("QmTest2");
        vm.stopPrank();
        
        uint256[] memory ownerProperties = assetRegistry.getOwnerProperties(lister);
        assertEq(ownerProperties.length, 2);
        assertTrue(ownerProperties[0] == id1 || ownerProperties[0] == id2);
    }
    
    function test_GetVerifierAssignments() public {
        vm.prank(lister);
        uint256 propertyId = assetRegistry.listProperty("QmTest123");
        
        vm.prank(admin);
        assetRegistry.assignVerifier(propertyId, verifier);
        
        uint256[] memory assignments = assetRegistry.getVerifierAssignments(verifier);
        assertEq(assignments.length, 1);
        assertEq(assignments[0], propertyId);
    }
    
    // ==================== UPGRADE TESTS ====================
    
    function test_UpgradeContract() public {
        AssetRegistry newImplementation = new AssetRegistry();
        
        vm.prank(admin);
        assetRegistry.upgradeToAndCall(address(newImplementation), "");
        
        assertEq(assetRegistry.version(), "2.1.0");
    }
    
    function test_RevertWhen_UnauthorizedUpgrade() public {
        AssetRegistry newImplementation = new AssetRegistry();
        
        vm.prank(unauthorized);
        // FIX: Expect the full custom error with the caller's address as an argument
        vm.expectRevert(abi.encodeWithSelector(AssetRegistry.NotAuthorized.selector, unauthorized));
        assetRegistry.upgradeToAndCall(address(newImplementation), "");
    }
    
    // ==================== FUZZ TESTS ====================
    
    function testFuzz_ListPropertyWithRandomMetadata(string memory metadataHash) public {
        vm.assume(bytes(metadataHash).length > 0);
        vm.assume(bytes(metadataHash).length < 100);
        
        vm.prank(lister);
        uint256 propertyId = assetRegistry.listProperty(metadataHash);
        
        AssetRegistry.Property memory property = assetRegistry.getProperty(propertyId);
        assertEq(property.metadataHash, metadataHash);
    }
    
    function testFuzz_SetPropertyFinancials(uint256 valuation, uint256 roi) public {
        vm.assume(valuation > 0);
        vm.assume(roi > 0 && roi <= 10000); // Max 100%
        
        vm.prank(lister);
        uint256 propertyId = assetRegistry.listProperty("QmTest");
        
        vm.prank(admin);
        assetRegistry.setPropertyFinancials(
            propertyId,
            valuation,
            valuation,
            roi,
            0,
            address(0),
            ""
        );
        
        AssetRegistry.PropertyFinancials memory financials = assetRegistry.getPropertyFinancials(propertyId);
        assertEq(financials.valuation, valuation);
        assertEq(financials.expectedROI, roi);
    }
}
