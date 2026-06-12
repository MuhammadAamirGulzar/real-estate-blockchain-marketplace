"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Loader2,
  Wallet,
} from "lucide-react";
import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const METAMASK_INSTALL_URL = "https://metamask.io/download/";
const ETHERSCAN_BASE_URL = "https://etherscan.io/address/";
const MAINNET_CHAIN_ID = "0x1";

const formatAddress = (address) => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const WalletInfoCard = ({ label, value, icon: Icon, badge }) => (
  <div className="flex items-center justify-between p-3 transition-all duration-200 border rounded-md bg-muted border-border hover:bg-muted/80">
    <div className="flex-1">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{value}</p>
    </div>
    {Icon && <Icon className="flex-shrink-0 w-5 h-5 ml-3 text-secondary" />}
    {badge && <div className="ml-3">{badge}</div>}
  </div>
);

const MetaMaskInfo = () => (
  <div className="flex items-center gap-3 p-4 transition-all duration-200 border rounded-lg border-border bg-background/50">
    <img
      src="https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/metamask-fox.svg"
      alt="MetaMask"
      className="flex-shrink-0 w-8 h-8"
      loading="lazy"
    />
    <div className="flex-1 min-w-0">
      <h3 className="font-medium text-foreground">MetaMask</h3>
      <p className="text-sm truncate text-muted-foreground">
        Connect using your browser wallet
      </p>
    </div>
    <CheckCircle className="flex-shrink-0 w-5 h-5 text-secondary" />
  </div>
);

const ConnectedWalletDialog = ({
  isOpen,
  onOpenChange,
  walletAddress,
  chainId,
  networkName,
  onDisconnect,
  onSwitchToMainnet,
}) => {
  const isMainnet = chainId === MAINNET_CHAIN_ID;

  const handleOpenEtherscan = useCallback(() => {
    window.open(
      `${ETHERSCAN_BASE_URL}${walletAddress}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [walletAddress]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            <span>Wallet Connected</span>
          </DialogTitle>
          <DialogDescription>
            Your MetaMask wallet is securely connected to your account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <WalletInfoCard
            label="Wallet Address"
            value={walletAddress}
            icon={CheckCircle}
          />

          <WalletInfoCard
            label="Network"
            value={networkName}
            badge={
              <Badge variant={isMainnet ? "default" : "secondary"}>
                {isMainnet ? "Mainnet" : "Testnet"}
              </Badge>
            }
          />

          {!isMainnet && (
            <Alert className="border-accent/50 bg-accent/5">
              <AlertCircle className="w-4 h-4 text-accent" />
              <AlertDescription className="ml-2 text-accent-foreground">
                <span className="text-sm">
                  You&apos;re connected to a testnet. Consider switching to
                  Ethereum Mainnet for production use.
                </span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={onSwitchToMainnet}
                  className="h-auto p-0 ml-2 font-medium text-primary"
                >
                  Switch to Mainnet →
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenEtherscan}
              className="flex-1 transition-all duration-200"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">View on Etherscan</span>
              <span className="sm:hidden">Etherscan</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onDisconnect}
              className="flex-1 transition-all duration-200"
            >
              Disconnect
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const DisconnectedWalletDialog = ({
  isOpen,
  onOpenChange,
  isConnecting,
  isMetaMaskInstalled,
  onConnect,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            <span>Connect Your Wallet</span>
          </DialogTitle>
          <DialogDescription>
            Securely connect your MetaMask wallet to access platform features
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isMetaMaskInstalled ? (
            <Alert className="border-destructive/50 bg-destructive/5">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <AlertDescription className="ml-2 text-destructive">
                <span className="text-sm">MetaMask is not installed.</span>
                <a
                  href={METAMASK_INSTALL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 ml-2 font-medium transition-all text-primary hover:underline"
                >
                  Install MetaMask
                  <ExternalLink className="w-3 h-3" />
                </a>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <MetaMaskInfo />

              <Button
                onClick={onConnect}
                disabled={isConnecting}
                className="w-full transition-all duration-200"
                size="lg"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4 mr-2" />
                    <span>Connect MetaMask</span>
                  </>
                )}
              </Button>

              <p className="text-xs leading-relaxed text-center text-muted-foreground">
                By connecting your wallet, you agree to our{" "}
                <Link
                  to="/terms-of-service"
                  className="text-primary hover:underline"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  to="/privacy-policy"
                  className="text-primary hover:underline"
                >
                  Privacy Policy
                </Link>
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const ConnectWallet = React.memo(function ConnectWallet({
  className = "",
  variant = "outline",
  size = "sm",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const {
    walletAddress,
    isConnecting,
    isMetaMaskInstalled,
    chainId,
    networkName,
    isConnected,
    connectWallet,
    disconnectWallet,
    switchToMainnet,
  } = useWallet();
  const { user, updateUserData } = useAuth();

  const isWalletConnected = isConnected && user?.walletAddress;

  const handleConnect = useCallback(async () => {
    const result = await connectWallet();
    if (result?.success) {
      await updateUserData();
      setIsOpen(false);
    }
  }, [connectWallet, updateUserData]);

  const handleDisconnect = useCallback(() => {
    disconnectWallet();
    setIsOpen(false);
  }, [disconnectWallet]);

  const handleSwitchToMainnet = useCallback(() => {
    switchToMainnet();
  }, [switchToMainnet]);

  const formattedAddress = useMemo(
    () => formatAddress(walletAddress),
    [walletAddress],
  );

  if (isWalletConnected) {
    return (
      <>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              variant={variant}
              size={size}
              className={`inline-flex items-center gap-2 transition-all duration-200 ${className}`}
            >
              <CheckCircle className="flex-shrink-0 w-4 h-4 text-secondary" />
              <span className="hidden sm:inline">{formattedAddress}</span>
              <span className="sm:hidden">Wallet</span>
            </Button>
          </DialogTrigger>
        </Dialog>

        <ConnectedWalletDialog
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          walletAddress={walletAddress}
          chainId={chainId}
          networkName={networkName}
          onDisconnect={handleDisconnect}
          onSwitchToMainnet={handleSwitchToMainnet}
        />
      </>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant={variant}
            size={size}
            disabled={isConnecting}
            className={`inline-flex items-center gap-2 transition-all duration-200 ${className}`}
          >
            {isConnecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wallet className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </span>
            <span className="sm:hidden">Wallet</span>
          </Button>
        </DialogTrigger>
      </Dialog>

      <DisconnectedWalletDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        isConnecting={isConnecting}
        isMetaMaskInstalled={isMetaMaskInstalled}
        onConnect={handleConnect}
      />
    </>
  );
});

ConnectWallet.displayName = "ConnectWallet";
