import api from './api.js';
import { ethers } from 'ethers';

class WalletService {
  /**
   * Request a nonce for wallet signature
   */
  async requestNonce(walletAddress) {
    try {
      const response = await api.post('/user/wallet/request-nonce', {
        walletAddress,
      });
      return response.data;
    } catch (error) {
      console.error('Error requesting nonce:', error);
      throw new Error(error.response?.data?.message || 'Failed to request nonce');
    }
  }

  /**
   * Complete wallet connection with signature verification
   */
  async completeWalletConnection(provider) {
    try {
      if (!provider) {
        throw new Error('Provider is required');
      }

      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();

      // Step 1: Request nonce
      const { nonce, message } = await this.requestNonce(walletAddress);

      // Step 2: Sign message
      let signature;
      try {
        signature = await signer.signMessage(message);
      } catch (error) {
        throw new Error('User rejected signature request');
      }

      // Step 3: Send signature to backend
      const response = await api.post('/user/wallet/connect', {
        walletAddress,
        signature,
        message,
      });

      return response.data;
    } catch (error) {
      console.error('Error connecting wallet:', error);
      throw new Error(error.response?.data?.message || error.message || 'Failed to connect wallet');
    }
  }

  /**
   * Disconnect wallet from backend
   */
  async disconnectWallet() {
    try {
      const response = await api.post('/user/wallet/disconnect');
      return response.data;
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      throw new Error(error.response?.data?.message || 'Failed to disconnect wallet');
    }
  }

  /**
   * Get wallet connection status
   */
  async getWalletStatus() {
    try {
      const response = await api.get('/user/wallet/status');
      return response.data;
    } catch (error) {
      console.error('Error getting wallet status:', error);
      throw new Error(error.response?.data?.message || 'Failed to get wallet status');
    }
  }

  /**
   * Sync role from blockchain to database
   */
  async syncRoleFromBlockchain() {
    try {
      const response = await api.post('/user/wallet/sync-role');
      return response.data;
    } catch (error) {
      console.error('Error syncing role:', error);
      throw new Error(error.response?.data?.message || 'Failed to sync role');
    }
  }

  /**
   * Verify wallet connection matches stored address
   */
  async verifyWalletConnection(walletAddress) {
    try {
      const status = await this.getWalletStatus();
      
      if (!status.success) {
        return { verified: false, message: 'No wallet connected' };
      }

      const storedAddress = status.walletAddress?.toLowerCase();
      const currentAddress = walletAddress?.toLowerCase();

      if (storedAddress !== currentAddress) {
        return {
          verified: false,
          message: 'Wallet address mismatch. Please reconnect.',
          storedAddress,
          currentAddress,
        };
      }

      return {
        verified: true,
        message: 'Wallet verified',
        walletAddress: storedAddress,
        role: status.role,
      };
    } catch (error) {
      console.error('Error verifying wallet:', error);
      return {
        verified: false,
        message: error.message || 'Failed to verify wallet',
      };
    }
  }

  /**
   * Sign a message for blockchain action authorization
   */
  async signAction(provider, action, details = {}) {
    try {
      if (!provider) {
        throw new Error('Provider is required');
      }

      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();
      
      const message = `Authorize action: ${action}\nDetails: ${JSON.stringify(details)}\nTimestamp: ${Date.now()}`;
      
      const signature = await signer.signMessage(message);

      return {
        walletAddress,
        signature,
        message,
        action,
        details,
      };
    } catch (error) {
      console.error('Error signing action:', error);
      throw new Error(error.message || 'Failed to sign action');
    }
  }
}

const walletService = new WalletService();
export default walletService;
