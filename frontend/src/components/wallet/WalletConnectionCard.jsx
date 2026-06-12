import React, { useState } from 'react';
import { Wallet, Shield, CheckCircle, AlertCircle, Loader2, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { authService } from '@/services/auth.service';

const WalletConnectionCard = () => {
  const { user, updateUserData } = useAuth();
  const { account, isConnected, connectWallet, disconnectWallet, signMessage, balance } = useWallet();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState('');

  const handleConnectWallet = async () => {
    setIsConnecting(true);
    setError('');
    
    try {
      // Connect MetaMask
      const walletAddress = await connectWallet();
      
      // Get nonce from backend
      const nonceResponse = await authService.getNonce(walletAddress);
      
      // Sign message
      const signature = await signMessage(nonceResponse.message);
      
      // Connect wallet to account
      await authService.connectWallet(walletAddress, signature, nonceResponse.message);
      
      // Update user data
      await updateUserData();
      
    } catch (error) {
      console.error('Wallet connection failed:', error);
      setError(error.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWallet = async () => {
    setIsDisconnecting(true);
    setError('');
    
    try {
      // Disconnect from backend
      await authService.disconnectWallet();
      
      // Disconnect MetaMask
      disconnectWallet();
      
      // Update user data
      await updateUserData();
      
    } catch (error) {
      console.error('Wallet disconnection failed:', error);
      setError(error.message || 'Failed to disconnect wallet');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const copyAddress = () => {
    if (account) {
      navigator.clipboard.writeText(account);
    }
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatBalance = (balance) => {
    return parseFloat(balance).toFixed(4);
  };

  if (!user?.isWalletConnected && !isConnected) {
    return (
      <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <CardHeader className="pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                Connect Your Wallet
              </CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Connect your wallet to access Web3 features
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Wallet Required for Blockchain Actions
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  You'll need to connect your wallet to perform KYC, property submissions, and investments.
                </p>
              </div>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}
          
          <Button 
            onClick={handleConnectWallet}
            disabled={isConnecting}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                Wallet Connected
              </CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Ready for blockchain interactions
              </p>
            </div>
          </div>
          <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            Connected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Address</p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyAddress}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(`https://etherscan.io/address/${account}`, '_blank')}
                  className="h-6 w-6 p-0"
                >
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <p className="text-lg font-mono text-slate-900 dark:text-white">
              {formatAddress(account)}
            </p>
          </div>
          
          <div className="bg-white dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Balance</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {formatBalance(balance)} ETH
            </p>
          </div>
        </div>

        {user?.role !== 'user' && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {user?.role === 'admin' ? 'Admin' : user?.role === 'subadmin' ? 'Subadmin' : 'Verifier'} Privileges
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Your wallet is authorized for {user?.role} actions. All blockchain operations will require signature verification.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            You can disconnect your wallet anytime
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnectWallet}
            disabled={isDisconnecting}
            className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
          >
            {isDisconnecting ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Disconnecting...
              </>
            ) : (
              'Disconnect'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WalletConnectionCard;