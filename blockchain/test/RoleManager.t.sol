// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/RoleManager.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract RoleManagerTest is Test {
    RoleManager public roleManager;
    
    address public admin;
    address public subAdmin;
    address public user;
    address public verifier;
    address public unauthorized;
    
    // Role constants
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SUB_ADMIN_ROLE = keccak256("SUB_ADMIN_ROLE");
    bytes32 public constant USER_ROLE = keccak256("USER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    event AdminProposed(address indexed oldAdmin, address indexed proposedAdmin);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event RoleGrantedByAdmin(bytes32 indexed role, address indexed account, address indexed grantor);
    event RoleRevokedByAdmin(bytes32 indexed role, address indexed account, address indexed revoker);
    event WalletMapped(string indexed userId, address indexed wallet);
    
    function setUp() public {
        admin = makeAddr("admin");
        subAdmin = makeAddr("subAdmin");
        user = makeAddr("user");
        verifier = makeAddr("verifier");
        unauthorized = makeAddr("unauthorized");
        
        // Deploy implementation
        RoleManager implementation = new RoleManager();
        
        // Deploy proxy
        bytes memory initData = abi.encodeWithSelector(
            RoleManager.initialize.selector,
            admin
        );
        
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        roleManager = RoleManager(address(proxy));
    }
    
    // ==================== INITIALIZATION TESTS ====================
    
    function test_Initialize() public {
        assertEq(roleManager.admin(), admin);
        assertTrue(roleManager.hasRole(ADMIN_ROLE, admin));
        assertTrue(roleManager.hasRole(SUB_ADMIN_ROLE, admin));
        assertTrue(roleManager.hasRole(UPGRADER_ROLE, admin));
        assertEq(roleManager.version(), "3.0.0");
    }
    
    function test_RevertWhen_InitializeWithZeroAddress() public {
        RoleManager implementation = new RoleManager();
        
        bytes memory initData = abi.encodeWithSelector(
            RoleManager.initialize.selector,
            address(0)
        );
        
        vm.expectRevert(RoleManager.InvalidAddress.selector);
        new ERC1967Proxy(address(implementation), initData);
    }
    
    function test_RevertWhen_InitializeTwice() public {
        vm.expectRevert();
        roleManager.initialize(admin);
    }
    
    // ==================== ADMIN MANAGEMENT TESTS ====================
    
    function test_ProposeAdmin() public {
        address newAdmin = makeAddr("newAdmin");
        
        vm.prank(admin);
        vm.expectEmit(true, true, false, false);
        emit AdminProposed(admin, newAdmin);
        roleManager.proposeAdmin(newAdmin);
        
        assertEq(roleManager.pendingAdmin(), newAdmin);
    }
    
    function test_RevertWhen_UnauthorizedProposeAdmin() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        roleManager.proposeAdmin(makeAddr("newAdmin"));
    }
    
    function test_AcceptAdmin() public {
        address newAdmin = makeAddr("newAdmin");
        
        vm.prank(admin);
        roleManager.proposeAdmin(newAdmin);
        
        vm.prank(newAdmin);
        vm.expectEmit(true, true, false, false);
        emit AdminTransferred(admin, newAdmin);
        roleManager.acceptAdmin();
        
        assertEq(roleManager.admin(), newAdmin);
        assertTrue(roleManager.hasRole(ADMIN_ROLE, newAdmin));
        assertFalse(roleManager.hasRole(ADMIN_ROLE, admin));
    }
    
    function test_RevertWhen_NonPendingAcceptAdmin() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        roleManager.acceptAdmin();
    }
    
    function test_CancelPendingAdmin() public {
        address newAdmin = makeAddr("newAdmin");
        
        vm.prank(admin);
        roleManager.proposeAdmin(newAdmin);
        
        vm.prank(admin);
        roleManager.cancelPendingAdmin();
        
        assertEq(roleManager.pendingAdmin(), address(0));
    }
    
    // ==================== ROLE GRANTING TESTS ====================
    
    function test_AdminGrantsUserRole() public {
        vm.prank(admin);
        vm.expectEmit(true, true, true, false);
        emit RoleGrantedByAdmin(USER_ROLE, user, admin);
        roleManager.grantRoleByAdmin(USER_ROLE, user);
        
        assertTrue(roleManager.hasRole(USER_ROLE, user));
    }
    
    function test_AdminGrantsSubAdminRole() public {
        vm.prank(admin);
        roleManager.grantRoleByAdmin(SUB_ADMIN_ROLE, subAdmin);
        
        assertTrue(roleManager.hasRole(SUB_ADMIN_ROLE, subAdmin));
    }
    
    function test_SubAdminGrantsUserRole() public {
        // First grant SUB_ADMIN_ROLE
        vm.prank(admin);
        roleManager.grantRoleByAdmin(SUB_ADMIN_ROLE, subAdmin);
        
        // SubAdmin grants USER_ROLE
        vm.prank(subAdmin);
        roleManager.grantRoleByAdmin(USER_ROLE, user);
        
        assertTrue(roleManager.hasRole(USER_ROLE, user));
    }
    
    function test_RevertWhen_SubAdminGrantsAdminRole() public {
        vm.prank(admin);
        roleManager.grantRoleByAdmin(SUB_ADMIN_ROLE, subAdmin);
        
        vm.prank(subAdmin);
        vm.expectRevert(RoleManager.CannotModifyAdminRoles.selector);
        roleManager.grantRoleByAdmin(ADMIN_ROLE, user);
    }
    
    function test_RevertWhen_UnauthorizedGrantsRole() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        roleManager.grantRoleByAdmin(USER_ROLE, user);
    }
    
    function test_GrantMultipleRoles() public {
        bytes32[] memory roles = new bytes32[](2);
        roles[0] = USER_ROLE;
        roles[1] = VERIFIER_ROLE;

        vm.prank(admin);
        roleManager.grantRoles(user, roles);

        assertTrue(roleManager.hasRole(USER_ROLE, user));
        assertTrue(roleManager.hasRole(VERIFIER_ROLE, user));
    }
    
    // ==================== ROLE REVOCATION TESTS ====================
    
    function test_AdminRevokesUserRole() public {
        vm.prank(admin);
        roleManager.grantRoleByAdmin(USER_ROLE, user);
        
        vm.prank(admin);
        vm.expectEmit(true, true, true, false);
        emit RoleRevokedByAdmin(USER_ROLE, user, admin);
        roleManager.revokeRoleByAdmin(USER_ROLE, user);
        
        assertFalse(roleManager.hasRole(USER_ROLE, user));
    }
    
    function test_RevertWhen_SubAdminRevokesAdminRole() public {
        vm.prank(admin);
        roleManager.grantRoleByAdmin(SUB_ADMIN_ROLE, subAdmin);
        
        vm.prank(subAdmin);
        vm.expectRevert(RoleManager.CannotModifyAdminRoles.selector);
        roleManager.revokeRoleByAdmin(ADMIN_ROLE, admin);
    }
    
    function test_RevokeMultipleRoles() public {
        bytes32[] memory roles = new bytes32[](2);
        roles[0] = USER_ROLE;
        roles[1] = VERIFIER_ROLE;

        vm.prank(admin);
        roleManager.grantRoles(user, roles);

        vm.prank(admin);
        roleManager.revokeRoles(user, roles);

        assertFalse(roleManager.hasRole(USER_ROLE, user));
        assertFalse(roleManager.hasRole(VERIFIER_ROLE, user));
    }
    
    // ==================== WALLET MAPPING TESTS ====================
    
    function test_MapWallet() public {
        string memory userId = "user123";
        
        vm.prank(admin);
        vm.expectEmit(true, true, false, false);
        emit WalletMapped(userId, user);
        roleManager.mapWallet(userId, user);
        
        assertEq(roleManager.getWalletByUserId(userId), user);
        assertEq(roleManager.getUserIdByWallet(user), userId);
    }
    
    function test_RevertWhen_MapWalletTwice() public {
        string memory userId = "user123";
        
        vm.prank(admin);
        roleManager.mapWallet(userId, user);
        
        vm.prank(admin);
        vm.expectRevert();
        roleManager.mapWallet(userId, user);
    }
    
    function test_RevertWhen_MapWalletZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(RoleManager.InvalidAddress.selector);
        roleManager.mapWallet("user123", address(0));
    }
    
    function test_RevertWhen_UnauthorizedMapWallet() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        roleManager.mapWallet("user123", user);
    }
    
    // ==================== ROLE CHECK TESTS ====================
    
    function test_IsAdmin() public {
        assertTrue(roleManager.isAdmin(admin));
        assertFalse(roleManager.isAdmin(user));
    }
    
    function test_IsSubAdmin() public {
        vm.prank(admin);
        roleManager.grantRoleByAdmin(SUB_ADMIN_ROLE, subAdmin);
        
        assertTrue(roleManager.isSubAdmin(subAdmin));
        assertFalse(roleManager.isSubAdmin(user));
    }
    
    function test_IsUser() public {
        vm.prank(admin);
        roleManager.grantRoleByAdmin(USER_ROLE, user);
        
        assertTrue(roleManager.isUser(user));
        assertFalse(roleManager.isUser(admin));
    }
    
    function test_IsVerifier() public {
        vm.prank(admin);
        roleManager.grantRoleByAdmin(VERIFIER_ROLE, verifier);
        
        assertTrue(roleManager.isVerifier(verifier));
        assertFalse(roleManager.isVerifier(user));
    }
    
    function test_ListRoleMembers() public {
        vm.startPrank(admin);
        roleManager.grantRoleByAdmin(USER_ROLE, user);
        roleManager.grantRoleByAdmin(USER_ROLE, makeAddr("user2"));
        vm.stopPrank();
        
        address[] memory members = roleManager.listRoleMembers(USER_ROLE);
        assertEq(members.length, 2);
    }
    
    // ==================== SECURITY TESTS ====================
    
    function test_RevertWhen_AdminRenouncesRole() public {
        vm.prank(admin);
        vm.expectRevert(RoleManager.AdminCannotRenounce.selector);
        roleManager.renounceRole(ADMIN_ROLE, admin);
    }
    
    function test_UserCanRenounceRole() public {
        vm.prank(admin);
        roleManager.grantRoleByAdmin(USER_ROLE, user);
        
        vm.prank(user);
        roleManager.renounceRole(USER_ROLE, user);
        
        assertFalse(roleManager.hasRole(USER_ROLE, user));
    }
    
    // ==================== UPGRADE TESTS ====================
    
    function test_UpgradeContract() public {
        RoleManager newImplementation = new RoleManager();
        
        vm.prank(admin);
        roleManager.upgradeToAndCall(address(newImplementation), "");
        
        assertEq(roleManager.version(), "3.0.0");
    }
    
    function test_RevertWhen_UnauthorizedUpgrade() public {
        RoleManager newImplementation = new RoleManager();
        
        vm.prank(unauthorized);
        vm.expectRevert();
        roleManager.upgradeToAndCall(address(newImplementation), "");
    }
    
    // ==================== FUZZ TESTS ====================
    
    function testFuzz_GrantRoleToRandomAddress(address randomUser) public {
        vm.assume(randomUser != address(0));
        vm.assume(randomUser != admin);
        
        vm.prank(admin);
        roleManager.grantRoleByAdmin(USER_ROLE, randomUser);
        
        assertTrue(roleManager.hasRole(USER_ROLE, randomUser));
    }
    
    function testFuzz_MapWalletWithRandomUserId(string memory userId) public {
        vm.assume(bytes(userId).length > 0);
        vm.assume(bytes(userId).length < 100);
        
        vm.prank(admin);
        roleManager.mapWallet(userId, user);
        
        assertEq(roleManager.getWalletByUserId(userId), user);
    }
}