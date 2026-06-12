// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/KYCRegistry.sol";
import "../src/RoleManager.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract KYCRegistryTest is Test {
    KYCRegistry public kycRegistry;
    RoleManager public roleManager;
    
    address public admin;
    address public subAdmin;
    address public user1;
    address public user2;
    address public verifierApplicant;
    
    event KYCSubmitted(address indexed user, string documentHash, uint256 timestamp);
    event KYCApproved(address indexed user, address indexed reviewer, uint256 timestamp);
    event KYCRejected(address indexed user, address indexed reviewer, string reason, uint256 timestamp);
    event VerifierApplicationSubmitted(address indexed applicant, string qualifications, uint256 timestamp);
    event VerifierApplicationApproved(address indexed applicant, address indexed reviewer, uint256 timestamp);
    
    function setUp() public {
        admin = makeAddr("admin");
        subAdmin = makeAddr("subAdmin");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        verifierApplicant = makeAddr("verifierApplicant");
        
        // Deploy RoleManager
        RoleManager roleManagerImpl = new RoleManager();
        bytes memory roleManagerInit = abi.encodeWithSelector(
            RoleManager.initialize.selector,
            admin
        );
        ERC1967Proxy roleManagerProxy = new ERC1967Proxy(address(roleManagerImpl), roleManagerInit);
        roleManager = RoleManager(address(roleManagerProxy));
        
        // Deploy KYCRegistry
        KYCRegistry kycImpl = new KYCRegistry();
        bytes memory kycInit = abi.encodeWithSelector(
            KYCRegistry.initialize.selector,
            address(roleManager)
        );
        ERC1967Proxy kycProxy = new ERC1967Proxy(address(kycImpl), kycInit);
        kycRegistry = KYCRegistry(address(kycProxy));
        
        // Grant SUB_ADMIN_ROLE to subAdmin
        vm.startPrank(admin);
        roleManager.grantRoleByAdmin(roleManager.SUB_ADMIN_ROLE(), subAdmin);
        // Grant the KYCRegistry contract the ability to manage roles
        roleManager.grantRoleByAdmin(roleManager.SUB_ADMIN_ROLE(), address(kycRegistry));
        vm.stopPrank();
    }
    
    // ==================== INITIALIZATION TESTS ====================
    
    function test_Initialize() public {
        assertEq(address(kycRegistry.roleManager()), address(roleManager));
        assertEq(kycRegistry.version(), "3.0.0");
    }
    
    function test_RevertWhen_InitializeWithZeroAddress() public {
        KYCRegistry impl = new KYCRegistry();
        
        bytes memory initData = abi.encodeWithSelector(
            KYCRegistry.initialize.selector,
            address(0)
        );
        
        vm.expectRevert(KYCRegistry.InvalidAddress.selector);
        new ERC1967Proxy(address(impl), initData);
    }
    
    // ==================== KYC SUBMISSION TESTS ====================
    
    function test_SubmitKYC() public {
        string memory docHash = "QmTest123";
        
        vm.prank(user1);
        vm.expectEmit(true, false, false, true);
        emit KYCSubmitted(user1, docHash, block.timestamp);
        kycRegistry.submitKYC(docHash);
        
        (
            address user,
            string memory documentHash,
            KYCRegistry.KYCStatus status,
            uint256 submittedAt,
            ,
            ,
            
        ) = kycRegistry.kycRequests(user1);
        
        assertEq(user, user1);
        assertEq(documentHash, docHash);
        assertTrue(status == KYCRegistry.KYCStatus.Pending);
        assertGt(submittedAt, 0);
    }
    
    function test_RevertWhen_SubmitKYCTwice() public {
        vm.startPrank(user1);
        kycRegistry.submitKYC("QmTest123");
        
        vm.expectRevert(KYCRegistry.KYCAlreadySubmitted.selector);
        kycRegistry.submitKYC("QmTest456");
        vm.stopPrank();
    }
    
    function test_PendingKYCListUpdated() public {
        vm.prank(user1);
        kycRegistry.submitKYC("QmTest123");
        
        address[] memory pending = kycRegistry.getPendingKYC();
        assertEq(pending.length, 1);
        assertEq(pending[0], user1);
    }
    
    // ==================== KYC APPROVAL TESTS ====================
    
    function test_ApproveKYC() public {
        vm.prank(user1);
        kycRegistry.submitKYC("QmTest123");

        vm.startPrank(admin);
        vm.expectEmit(true, true, false, true);
        emit KYCApproved(user1, admin, block.timestamp);
        kycRegistry.approveKYC(user1);
        vm.stopPrank();

        assertTrue(kycRegistry.isKYCApproved(user1));
        assertTrue(roleManager.hasRole(roleManager.USER_ROLE(), user1));
    }
    
    function test_SubAdminCanApproveKYC() public {
        vm.prank(user1);
        kycRegistry.submitKYC("QmTest123");

        vm.startPrank(subAdmin);
        kycRegistry.approveKYC(user1);
        vm.stopPrank();

        assertTrue(kycRegistry.isKYCApproved(user1));
    }
    
    function test_RevertWhen_UnauthorizedApproveKYC() public {
        vm.prank(user1);
        kycRegistry.submitKYC("QmTest123");
        
        vm.prank(user2);
        vm.expectRevert();
        kycRegistry.approveKYC(user1);
    }
    
    function test_ApprovalRemovesFromPendingList() public {
        vm.prank(user1);
        kycRegistry.submitKYC("QmTest123");

        vm.startPrank(admin);
        kycRegistry.approveKYC(user1);
        vm.stopPrank();

        address[] memory pending = kycRegistry.getPendingKYC();
        assertEq(pending.length, 0);
    }
    
    function test_BatchApproveKYC() public {
        vm.prank(user1);
        kycRegistry.submitKYC("QmTest1");

        vm.prank(user2);
        kycRegistry.submitKYC("QmTest2");

        address[] memory users = new address[](2);
        users[0] = user1;
        users[1] = user2;

        vm.startPrank(admin);
        kycRegistry.batchApproveKYC(users);
        vm.stopPrank();

        assertTrue(kycRegistry.isKYCApproved(user1));
        assertTrue(kycRegistry.isKYCApproved(user2));
    }
    
    // ==================== KYC REJECTION TESTS ====================
    
    function test_RejectKYC() public {
        vm.prank(user1);
        kycRegistry.submitKYC("QmTest123");
        
        string memory reason = "Invalid documents";
        
        vm.prank(admin);
        vm.expectEmit(true, true, false, true);
        emit KYCRejected(user1, admin, reason, block.timestamp);
        kycRegistry.rejectKYC(user1, reason);
        
        assertFalse(kycRegistry.isKYCApproved(user1));
        
        (,,, , , , string memory rejectionReason) = kycRegistry.kycRequests(user1);
        assertEq(rejectionReason, reason);
    }
    
    function test_RejectionRemovesFromPendingList() public {
        vm.prank(user1);
        kycRegistry.submitKYC("QmTest123");
        
        vm.prank(admin);
        kycRegistry.rejectKYC(user1, "Invalid");
        
        address[] memory pending = kycRegistry.getPendingKYC();
        assertEq(pending.length, 0);
    }
    
    // ==================== VERIFIER APPLICATION TESTS ====================
    
    function test_ApplyForVerifier() public {
        // First approve KYC
        vm.prank(verifierApplicant);
        kycRegistry.submitKYC("QmTest123");

        vm.startPrank(admin);
        kycRegistry.approveKYC(verifierApplicant);
        vm.stopPrank();

        // Then apply for verifier
        string memory qualifications = "QmQualifications";

        vm.prank(verifierApplicant);
        vm.expectEmit(true, false, false, true);
        emit VerifierApplicationSubmitted(verifierApplicant, qualifications, block.timestamp);
        kycRegistry.applyForVerifier(qualifications);

        (address applicant, , bool isPending, ) = kycRegistry.verifierApplications(verifierApplicant);
        assertEq(applicant, verifierApplicant);
        assertTrue(isPending);
    }
    
    function test_RevertWhen_ApplyForVerifierWithoutKYC() public {
        vm.prank(verifierApplicant);
        vm.expectRevert(KYCRegistry.KYCRequired.selector);
        kycRegistry.applyForVerifier("QmQualifications");
    }
    
    function test_RevertWhen_ApplyForVerifierTwice() public {
        vm.prank(verifierApplicant);
        kycRegistry.submitKYC("QmTest123");

        vm.startPrank(admin);
        kycRegistry.approveKYC(verifierApplicant);
        vm.stopPrank();

        vm.startPrank(verifierApplicant);
        kycRegistry.applyForVerifier("QmQualifications");

        vm.expectRevert(KYCRegistry.VerifierApplicationExists.selector);
        kycRegistry.applyForVerifier("QmQualifications2");
        vm.stopPrank();
    }
    
    function test_ApproveVerifierApplication() public {
        // Setup: KYC approved + application submitted
        vm.prank(verifierApplicant);
        kycRegistry.submitKYC("QmTest123");

        vm.startPrank(admin);
        kycRegistry.approveKYC(verifierApplicant);
        vm.stopPrank();

        vm.prank(verifierApplicant);
        kycRegistry.applyForVerifier("QmQualifications");

        // Approve application
        vm.startPrank(admin);
        vm.expectEmit(true, true, false, true);
        emit VerifierApplicationApproved(verifierApplicant, admin, block.timestamp);
        kycRegistry.approveVerifierApplication(verifierApplicant);
        vm.stopPrank();

        assertTrue(roleManager.hasRole(roleManager.VERIFIER_ROLE(), verifierApplicant));
    }
    
    function test_RejectVerifierApplication() public {
        vm.prank(verifierApplicant);
        kycRegistry.submitKYC("QmTest123");

        vm.startPrank(admin);
        kycRegistry.approveKYC(verifierApplicant);
        vm.stopPrank();

        vm.prank(verifierApplicant);
        kycRegistry.applyForVerifier("QmQualifications");

        vm.startPrank(admin);
        kycRegistry.rejectVerifierApplication(verifierApplicant);
        vm.stopPrank();

        assertFalse(roleManager.hasRole(roleManager.VERIFIER_ROLE(), verifierApplicant));
    }
    
    function test_GrantVerifierRoleDirectly() public {
        vm.startPrank(user1);
        kycRegistry.submitKYC("QmTest123");

        vm.startPrank(admin);
        kycRegistry.approveKYC(user1);
        kycRegistry.grantVerifierRole(user1);
        vm.stopPrank();

        assertTrue(roleManager.hasRole(roleManager.VERIFIER_ROLE(), user1));
    }
    
    // ==================== VIEW FUNCTION TESTS ====================
    
    function test_GetKYCStatus() public {
        assertEq(uint256(kycRegistry.getKYCStatus(user1)), uint256(KYCRegistry.KYCStatus.None));

        vm.prank(user1);
        kycRegistry.submitKYC("QmTest123");

        assertEq(uint256(kycRegistry.getKYCStatus(user1)), uint256(KYCRegistry.KYCStatus.Pending));

        vm.startPrank(admin);
        kycRegistry.approveKYC(user1);
        vm.stopPrank();

        assertEq(uint256(kycRegistry.getKYCStatus(user1)), uint256(KYCRegistry.KYCStatus.Approved));
    }
    
    function test_GetPendingVerifierApplications() public {
        vm.prank(verifierApplicant);
        kycRegistry.submitKYC("QmTest123");

        vm.startPrank(admin);
        kycRegistry.approveKYC(verifierApplicant);
        vm.stopPrank();

        vm.prank(verifierApplicant);
        kycRegistry.applyForVerifier("QmQualifications");

        address[] memory pending = kycRegistry.getPendingVerifierApplications();
        assertEq(pending.length, 1);
        assertEq(pending[0], verifierApplicant);
    }
    
    // ==================== EDGE CASE TESTS ====================
    
    function test_MultiplePendingKYCRemoval() public {
        // Submit multiple KYC requests
        vm.prank(user1);
        kycRegistry.submitKYC("QmTest1");

        vm.prank(user2);
        kycRegistry.submitKYC("QmTest2");

        address user3 = makeAddr("user3");
        vm.prank(user3);
        kycRegistry.submitKYC("QmTest3");

        // Approve middle one
        vm.startPrank(admin);
        kycRegistry.approveKYC(user2);
        vm.stopPrank();

        address[] memory pending = kycRegistry.getPendingKYC();
        assertEq(pending.length, 2);
        assertTrue(pending[0] == user1 || pending[0] == user3);
    }
    
    // ==================== FUZZ TESTS ====================
    
    function testFuzz_SubmitKYCWithRandomDocHash(string memory docHash) public {
        vm.assume(bytes(docHash).length > 0);
        vm.assume(bytes(docHash).length < 200);
        
        vm.prank(user1);
        kycRegistry.submitKYC(docHash);
        
        (, string memory storedHash, , , , , ) = kycRegistry.kycRequests(user1);
        assertEq(storedHash, docHash);
    }
    
    function testFuzz_ApproveKYCForRandomUser(address randomUser) public {
        vm.assume(randomUser != address(0));
        vm.assume(randomUser != admin);

        vm.prank(randomUser);
        kycRegistry.submitKYC("QmTest");

        vm.startPrank(admin);
        kycRegistry.approveKYC(randomUser);
        vm.stopPrank();

        assertTrue(kycRegistry.isKYCApproved(randomUser));
    }
}