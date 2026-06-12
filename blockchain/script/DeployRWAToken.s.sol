// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/RWAToken.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployRWAToken is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        uint256 initialSupply = 1_000_000_000 * 1e18; // 1 billion tokens
        uint256 maxSupply = 10_000_000_000 * 1e18;    // 10 billion max
        
        // For local deployment, we set the deployer as both admin and treasury.
        // On a real network, the treasury would likely be a separate multi-sig wallet.
        address treasury = deployer;
        
        console.log("=== RWAToken Deployment ===");
        console.log("Deployer / Admin:", deployer);
        console.log("Treasury:", treasury);
        console.log("Initial Supply to be minted to Treasury:", initialSupply / 1e18);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy the implementation (logic) contract.
        RWAToken implementation = new RWAToken();
        console.log("1. Deployed Logic Contract (Implementation):", address(implementation));
        
        // 2. Prepare the initialization data.
        bytes memory initData = abi.encodeWithSelector(
            RWAToken.initialize.selector,
            deployer,      // admin
            treasury,      // treasury
            initialSupply,
            maxSupply
        );
        
        // 3. Deploy the proxy. This is the main contract address.
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        address proxyAddress = address(proxy);
        console.log("2. Deployed Proxy Contract (Main Address):", proxyAddress);
        
        vm.stopBroadcast();
        
        // --- Verification ---
        RWAToken platformToken = RWAToken(proxyAddress);
        console.log("\n--- Verification (checking through Proxy) ---");
        require(platformToken.balanceOf(treasury) == initialSupply, "Initial supply not minted to treasury");
        console.log("Name:", platformToken.name());
        console.log("Symbol:", platformToken.symbol());
        console.log("Total Supply:", platformToken.totalSupply());
        console.log("Treasury Balance:", platformToken.balanceOf(treasury));
        
        // --- Final Instructions ---
        console.log("\n========================= ACTION REQUIRED =========================");
        console.log(" RWAToken Deployed Successfully!");
        console.log("\n   The PROXY address is the main, interactive contract address.");
        
        console.log("\n--- For Next Foundry Deployment (DeployInvestmentManager) ---");
        console.log("   Set this environment variable before running the next script:");
        console.log("\n   RWA_TOKEN_ADDRESS=", proxyAddress);
        
        console.log("\n--- For Backend Application (.env file) ---");
        console.log("   Add this line to your backend project's .env file:");
        console.log("\n   NEXT_PUBLIC_RWA_TOKEN_ADDRESS=", proxyAddress);
        console.log("===================================================================");
    }
}