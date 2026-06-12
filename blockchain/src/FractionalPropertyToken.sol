// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title FractionalPropertyToken
 * @dev ERC20 token representing fractional ownership of a property NFT
 */
contract FractionalPropertyToken is ERC20, ERC20Burnable, ERC20Pausable, AccessControl {
    
    // === ROLES ===
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    // === STATE VARIABLES ===
    uint256 public immutable assetRegistryId;
    uint256 public immutable nftTokenId;
    uint256 public maxSupply;
    bool public tradingEnabled;
    
    // === EVENTS ===
    event TradingEnabled();
    event TradingDisabled();
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    
    // === ERRORS ===
    error FractionalPropertyToken__InvalidAddress();
    error FractionalPropertyToken__ExceedsMaxSupply();
    error FractionalPropertyToken__TradingDisabled();
    error FractionalPropertyToken__InvalidAmount();
    
    /**
     * @dev Constructor
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param assetId_ Asset registry ID
     * @param nftId_ Property NFT token ID
     * @param admin_ Admin address
     * @param treasury_ Treasury address (receives initial supply)
     * @param initialSupply_ Initial token supply minted to treasury
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 assetId_,
        uint256 nftId_,
        address admin_,
        address treasury_,
        uint256 initialSupply_
    ) ERC20(name_, symbol_) {
        if (admin_ == address(0) || treasury_ == address(0)) {
            revert FractionalPropertyToken__InvalidAddress();
        }
        if (initialSupply_ == 0) {
            revert FractionalPropertyToken__InvalidAmount();
        }
        
        assetRegistryId = assetId_;
        nftTokenId = nftId_;
        maxSupply = initialSupply_ * 2; // Allow minting up to 2x initial supply
        tradingEnabled = false;
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(MINTER_ROLE, admin_);
        _grantRole(PAUSER_ROLE, admin_);
        
        _mint(treasury_, initialSupply_);
    }
    
    // === MINTING ===
    
    /**
     * @dev Mint tokens to an address
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (to == address(0)) revert FractionalPropertyToken__InvalidAddress();
        if (amount == 0) revert FractionalPropertyToken__InvalidAmount();
        if (totalSupply() + amount > maxSupply) {
            revert FractionalPropertyToken__ExceedsMaxSupply();
        }
        
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
    
    // === BURNING ===
    
    /**
     * @dev Burn tokens from an address
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) public {
        if (amount == 0) revert FractionalPropertyToken__InvalidAmount();
        
        // If caller is not the owner, check allowance
        if (from != msg.sender) {
            _spendAllowance(from, msg.sender, amount);
        }
        
        _burn(from, amount);
        emit TokensBurned(from, amount);
    }
    
    // === TRADING CONTROL ===
    
    /**
     * @dev Enable trading for all users
     */
    function enableTrading() external onlyRole(DEFAULT_ADMIN_ROLE) {
        tradingEnabled = true;
        emit TradingEnabled();
    }
    
    /**
     * @dev Disable trading (only minters can transfer)
     */
    function disableTrading() external onlyRole(DEFAULT_ADMIN_ROLE) {
        tradingEnabled = false;
        emit TradingDisabled();
    }
    
    // === PAUSE ===
    
    /**
     * @dev Pause all token transfers
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause token transfers
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    // === VIEW FUNCTIONS ===
    
    /**
     * @dev Get comprehensive token information
     */
    function getTokenInfo() external view returns (
        string memory,
        string memory,
        uint256,
        uint256,
        uint256,
        uint256,
        bool
    ) {
        return (
            name(),
            symbol(),
            totalSupply(),
            maxSupply,
            assetRegistryId,
            nftTokenId,
            tradingEnabled
        );
    }
    
    // === INTERNAL OVERRIDES ===
    
    /**
     * @dev Hook that is called before any token transfer
     * Enforces trading restrictions and pause state
     */
    function _update(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Pausable)
    {
        // Allow minting (from == address(0)) and burning (to == address(0))
        if (from != address(0) && to != address(0)) {
            // Check if trading is enabled or sender has MINTER_ROLE
            if (!tradingEnabled && !hasRole(MINTER_ROLE, from)) {
                revert FractionalPropertyToken__TradingDisabled();
            }
        }
        
        super._update(from, to, amount);
    }
}