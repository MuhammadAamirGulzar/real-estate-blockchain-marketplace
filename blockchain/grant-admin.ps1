$RoleManagerAddress = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512"
$AdminWallet = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

Write-Host "Granting ADMIN_ROLE on blockchain..." -ForegroundColor Cyan
Write-Host "RoleManager: $RoleManagerAddress" -ForegroundColor Gray
Write-Host "Admin Wallet: $AdminWallet" -ForegroundColor Gray

forge script script/GrantAdminRole.s.sol:GrantAdminRole --rpc-url http://localhost:8545 --broadcast --legacy

Write-Host ""
Write-Host "Admin role granted successfully!" -ForegroundColor Green
