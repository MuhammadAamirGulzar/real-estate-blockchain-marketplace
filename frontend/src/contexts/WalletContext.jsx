import { ethers } from "ethers";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import api from "../services/api";

export const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState("0");
  const [isWalletLocked, setIsWalletLocked] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Stable handler refs to avoid effect re-runs
  const accountsChangedRef = useRef(null);
  const chainChangedRef = useRef(null);
  const mountedRef = useRef(true);
  const connectRequestRef = useRef(false);

  const getBackendStatus = useCallback(async () => {
    if (!localStorage.getItem("authToken")) return null;
    try {
      const res = await api.get("/user/wallet/status");
      return res?.data || null;
    } catch (error) {
      console.warn(
        "Backend status check failed:",
        error?.response?.status || error.message,
      );
      return null;
    }
  }, []);

  // Safe state updates - only update if component is mounted
  const safeSetState = useCallback((setter) => {
    if (mountedRef.current) {
      setter();
    }
  }, []);

  // Fetch balance safely
  const fetchBalance = useCallback(
    async (providerInstance, address) => {
      try {
        const bal = await providerInstance.getBalance(address);
        safeSetState(() => setBalance(ethers.formatEther(bal)));
        return ethers.formatEther(bal);
      } catch (error) {
        console.error("Failed to fetch balance:", error);
        safeSetState(() => setBalance("0"));
        return "0";
      }
    },
    [safeSetState],
  );

  const refreshBalance = useCallback(async () => {
    if (!provider || !account) {
      safeSetState(() => setBalance("0"));
      return "0";
    }
    return fetchBalance(provider, account);
  }, [provider, account, fetchBalance, safeSetState]);

  const signMessage = useCallback(
    async (message) => {
      if (!signer) {
        throw new Error(
          "Wallet signer is not available. Please reconnect MetaMask.",
        );
      }

      if (!message || typeof message !== "string") {
        throw new Error("A message string is required for signing.");
      }

      return signer.signMessage(message);
    },
    [signer],
  );

  const switchToMainnet = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed.");
    }

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1" }],
      });
      return { success: true };
    } catch (error) {
      if (error?.code === 4001) {
        toast.info("Network switch request was rejected in MetaMask.");
      }
      throw error;
    }
  }, []);

  const networkName = useMemo(() => {
    const normalized = String(chainId || "").toLowerCase();

    switch (normalized) {
      case "1":
      case "0x1":
        return "Ethereum Mainnet";
      case "11155111":
      case "0xaa36a7":
        return "Sepolia";
      case "31337":
      case "0x7a69":
        return "Localhost";
      default:
        return chainId ? `Chain ${chainId}` : "Unknown Network";
    }
  }, [chainId]);

  // Check if wallet is locked (already connected to account)
  const checkWalletLockStatus = useCallback(async () => {
    const token = localStorage.getItem("authToken");
    if (!token) return;

    try {
      const status = await getBackendStatus();
      if (status?.isConnected && status?.walletAddress) {
        safeSetState(() => {
          setIsWalletLocked(true);
          setAccount(status.walletAddress.toLowerCase());
          setBackendConnected(true);
          setUserRole(status.role || "user");
        });
      }
    } catch (error) {
      console.warn("Failed to check wallet lock status:", error);
    }
  }, [getBackendStatus, safeSetState]);

  // Run initial connection check once
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function init() {
      try {
        console.log("🔄 Initializing wallet connection...");

        // 1. Check authentication
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        const token = localStorage.getItem("authToken");

        if (!token || !storedUser?.walletAddress) {
          console.log("ℹ️ No authenticated user or wallet address found");
          safeSetState(() => {
            setIsConnected(false);
            setBackendConnected(false);
            setAccount(null);
            setSigner(null);
            setProvider(null);
            setBalance("0");
            setIsWalletLocked(false);
          });
          return;
        }

        // 2. Get wallet status from backend
        await checkWalletLockStatus();
        if (cancelled) return;

        // 3. Set DB wallet as connected (even if MetaMask not available)
        const dbWallet = storedUser.walletAddress.toLowerCase();
        console.log("✅ DB wallet found:", dbWallet);

        safeSetState(() => {
          setAccount(dbWallet);
          setIsConnected(true);
          setBackendConnected(true);
          setUserRole(storedUser.role || "user");
        });

        // 4. Try to sync with MetaMask provider (for signing capabilities)
        if (window.ethereum) {
          try {
            const p = new ethers.BrowserProvider(window.ethereum);
            if (cancelled) return;

            safeSetState(() => setProvider(p));

            const accounts = await p.listAccounts();
            if (cancelled) return;

            if (accounts.length > 0) {
              const s = await p.getSigner();
              const addr = (await s.getAddress()).toLowerCase();

              // Only set signer if it matches the DB wallet
              if (addr === dbWallet) {
                console.log("✅ MetaMask account matches DB wallet");
                safeSetState(() => setSigner(s));

                const network = await p.getNetwork();
                safeSetState(() => setChainId(network.chainId.toString()));

                await fetchBalance(p, addr);
              } else {
                console.warn(
                  "⚠️ MetaMask account mismatch:",
                  addr,
                  "!=",
                  dbWallet,
                );
                toast.warning(
                  `Please switch MetaMask to ${dbWallet.slice(0, 6)}...${dbWallet.slice(-4)}`,
                );
              }
            } else {
              console.log("ℹ️ No MetaMask accounts connected");
            }
          } catch (ethError) {
            console.error("❌ MetaMask sync error:", ethError);
            // Don't fail completely, user is still connected via DB
          }
        } else {
          console.warn("⚠️ MetaMask not detected");
        }
      } catch (error) {
        console.error("❌ Wallet init error:", error);
      }
    }

    init();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [checkWalletLockStatus, fetchBalance, safeSetState]);

  // Define stable handlers and store them in refs (no state dependencies)
  useEffect(() => {
    accountsChangedRef.current = async (accounts) => {
      try {
        console.log("🔄 Accounts changed:", accounts);

        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        const dbWallet = storedUser?.walletAddress?.toLowerCase();

        if (!dbWallet) {
          // No DB wallet linked -> clear state
          console.log("ℹ️ No DB wallet, clearing state");
          safeSetState(() => {
            setIsConnected(false);
            setBackendConnected(false);
            setAccount(null);
            setSigner(null);
            setProvider(null);
            setBalance("0");
          });
          return;
        }

        if (!accounts || accounts.length === 0) {
          // MetaMask disconnected -> keep DB state but remove signer
          console.log("⚠️ MetaMask disconnected, keeping DB state");
          safeSetState(() => {
            setSigner(null);
            setBalance("0");
          });
          toast.info("MetaMask disconnected. Reconnect to sign transactions.");
          return;
        }

        const addr = accounts[0].toLowerCase();

        if (addr !== dbWallet) {
          console.warn("❌ Wallet mismatch:", addr, "!=", dbWallet);
          toast.error(
            `Wallet mismatch! Please switch to ${dbWallet.slice(0, 6)}...${dbWallet.slice(-4)}`,
          );
          safeSetState(() => setSigner(null));
          return;
        }

        // Wallet matches DB -> Update signer/provider
        console.log("✅ Wallet matches, updating signer");
        safeSetState(() => {
          setAccount(addr);
          setIsConnected(true);
          setBackendConnected(true);
        });

        if (window.ethereum) {
          const p = new ethers.BrowserProvider(window.ethereum);
          safeSetState(() => setProvider(p));

          const s = await p.getSigner();
          safeSetState(() => setSigner(s));

          await fetchBalance(p, addr);

          const net = await p.getNetwork();
          safeSetState(() => setChainId(net.chainId.toString()));
        }
      } catch (err) {
        console.error("❌ accountsChanged handler error:", err);
        toast.error("Failed to update wallet connection");
      }
    };

    chainChangedRef.current = async (hexChainId) => {
      try {
        console.log("🔄 Chain changed:", hexChainId);
        const dec = Number.parseInt(hexChainId, 16).toString();
        safeSetState(() => setChainId(dec));

        // Reload the page to reset all contracts
        window.location.reload();
      } catch (err) {
        console.error("❌ chainChanged handler error:", err);
        toast.error("Chain change error. Please refresh the page.");
      }
    };
  }, [fetchBalance, safeSetState]);

  // Register listeners once
  useEffect(() => {
    if (!window.ethereum?.on) {
      console.warn("⚠️ MetaMask event listeners not available");
      return;
    }

    const onAccounts = (...args) => accountsChangedRef.current?.(...args);
    const onChain = (...args) => chainChangedRef.current?.(...args);

    console.log("📡 Registering MetaMask event listeners");
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);

    return () => {
      console.log("🔌 Removing MetaMask event listeners");
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener("accountsChanged", onAccounts);
        window.ethereum.removeListener("chainChanged", onChain);
      }
    };
  }, []);

  const connectWallet = useCallback(
    async (connectToBackend = true) => {
      console.log(
        `\n🔗 connectWallet called (connectToBackend: ${connectToBackend})`,
      );

      // Check if already locked
      if (isWalletLocked && backendConnected && account && signer) {
        console.log("✅ Wallet already connected and locked");
        toast.info("Your wallet is already linked to this account");
        return { success: true, address: account };
      }

      // Prevent duplicate requests immediately, before React state updates settle.
      if (connectRequestRef.current || isConnecting) {
        console.warn("⚠️ Connection already in progress");
        return { success: false, error: "Connection already in progress" };
      }

      connectRequestRef.current = true;
      setIsConnecting(true);

      try {
        // Check for MetaMask
        if (!window.ethereum) {
          const error = "No wallet provider found. Please install MetaMask.";
          console.error("❌", error);
          toast.error(error);
          throw new Error(error);
        }

        // Verify authentication
        const token = localStorage.getItem("authToken");
        if (connectToBackend && !token) {
          const error = "You must be signed in to link your wallet";
          console.error("❌", error);
          toast.error(error);
          throw new Error(error);
        }

        // Verify session is valid
        if (connectToBackend && token) {
          try {
            const meResp = await api.get("/auth/me");
            if (!meResp?.data?.user) {
              throw new Error("Session expired");
            }
            console.log("✅ Auth verified:", meResp.data.user.email);
          } catch (authErr) {
            console.error("❌ Auth check failed:", authErr);
            toast.error("Session expired. Please log in again.");
            localStorage.removeItem("authToken");
            localStorage.removeItem("user");
            setTimeout(() => {
              window.location.href = "/login";
            }, 1000);
            return { success: false, error: "Session expired" };
          }
        }

        // Request accounts from MetaMask
        console.log("📤 Requesting MetaMask accounts...");
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });

        if (!accounts || accounts.length === 0) {
          throw new Error("No accounts returned from MetaMask");
        }

        const p = new ethers.BrowserProvider(window.ethereum);
        const s = await p.getSigner();
        const addr = (await s.getAddress()).toLowerCase();
        console.log("✅ Got account from MetaMask:", addr);

        // If connecting to backend
        if (connectToBackend && token) {
          // Check for existing linked wallet
          let linkedDb = null;
          try {
            const statusResp = await api.get("/user/wallet/status");
            linkedDb = statusResp?.data?.walletAddress?.toLowerCase() || null;
            const isLinked = Boolean(statusResp?.data?.isConnected && linkedDb);

            if (isLinked && linkedDb !== addr) {
              const error = `This account is locked to ${linkedDb.slice(0, 6)}...${linkedDb.slice(-4)}. Contact admin to change wallet.`;
              console.error("❌", error);
              toast.error(error);
              throw new Error("Wallet is locked");
            }
          } catch (statusErr) {
            if (statusErr?.response?.status !== 404) {
              console.warn(
                "⚠️ Status check error:",
                statusErr?.response?.status,
              );
            }
          }

          // Request nonce and sign message
          console.log("📤 Requesting nonce...");
          const nonceResp = await api.post("/user/wallet/request-nonce", {
            walletAddress: addr,
          });
          const message = nonceResp?.data?.message;

          if (!message) {
            throw new Error("Failed to get verification message");
          }

          console.log("✍️ Requesting signature...");
          toast.loading("Please sign the message in MetaMask...", {
            id: "wallet-connect",
          });
          const sig = await s.signMessage(message);
          console.log("✅ Message signed");

          // Connect wallet to backend
          console.log("📤 Connecting wallet to backend...");
          const connectResp = await api.post("/user/wallet/connect", {
            walletAddress: addr,
            signature: sig,
            message,
          });

          if (connectResp?.data?.success) {
            const linkedResp = connectResp.data.walletAddress?.toLowerCase();

            console.log("✅ Wallet connected successfully");
            safeSetState(() => {
              setProvider(p);
              setSigner(s);
              setAccount(addr);
              setIsConnected(true);
              setBackendConnected(true);
              setUserRole(connectResp.data.role || "user");
              setIsWalletLocked(true);
            });

            // Update localStorage
            if (connectResp.data.user) {
              const existingUser = JSON.parse(
                localStorage.getItem("user") || "{}",
              );
              const updatedUser = { ...existingUser, ...connectResp.data.user };
              localStorage.setItem("user", JSON.stringify(updatedUser));
            }

            // Fetch balance and chain ID
            const network = await p.getNetwork();
            safeSetState(() => setChainId(network.chainId.toString()));
            await fetchBalance(p, addr);

            toast.success("Wallet connected and locked to your account!", {
              id: "wallet-connect",
            });
            return {
              success: true,
              address: addr,
              role: connectResp.data.role,
            };
          } else {
            const error =
              connectResp?.data?.message || "Failed to connect wallet";
            console.error("❌", error);
            toast.error(error, { id: "wallet-connect" });
            return { success: false, error };
          }
        }

        // If not connecting to backend but wallet connected locally
        console.log("✅ Local wallet connection successful");
        safeSetState(() => {
          setProvider(p);
          setSigner(s);
          setAccount(addr);
        });

        return { success: true, address: addr };
      } catch (err) {
        console.error("❌ connectWallet error:", err);

        let errorMessage = "Failed to connect wallet";

        if (err?.response?.status === 409) {
          errorMessage = "This wallet is already linked to another account";
        } else if (err?.response?.status === 401) {
          errorMessage = "Authentication failed. Please log in again.";
        } else if (
          err?.code === -32002 ||
          err?.info?.error?.code === -32002 ||
          err?.message?.includes("already pending")
        ) {
          errorMessage =
            "MetaMask already has a pending connection request. Open MetaMask and approve or reject it, then try again.";
        } else if (
          err?.code === 4001 ||
          err?.message?.includes("User rejected")
        ) {
          errorMessage = "Wallet connection was rejected";
        } else if (err?.message?.includes("No wallet provider")) {
          errorMessage = err.message;
        } else if (err?.message?.includes("signed in")) {
          errorMessage = err.message;
        } else if (err?.message?.includes("locked")) {
          errorMessage = err.message;
        } else {
          errorMessage =
            err?.response?.data?.message || err?.message || errorMessage;
        }

        toast.error(errorMessage, { id: "wallet-connect" });
        return { success: false, error: errorMessage };
      } finally {
        connectRequestRef.current = false;
        setIsConnecting(false);
      }
    },
    [
      isConnecting,
      isWalletLocked,
      backendConnected,
      account,
      signer,
      fetchBalance,
      safeSetState,
    ],
  );

  const disconnectWallet = useCallback(async () => {
    console.log("🔌 Disconnecting wallet (frontend only)");
    safeSetState(() => {
      setBackendConnected(false);
      setIsConnected(false);
      setAccount(null);
      setSigner(null);
      setProvider(null);
      setUserRole(null);
      setBalance("0");
    });
    toast.info("Wallet disconnected");
  }, [safeSetState]);

  const value = {
    provider,
    signer,
    account,
    address: account,
    walletAddress: account,
    isConnected,
    backendConnected,
    userRole,
    chainId,
    networkName,
    balance,
    isMetaMaskInstalled:
      typeof window !== "undefined" && Boolean(window.ethereum),
    isWalletLocked,
    isConnecting,
    connectWallet,
    disconnectWallet,
    signMessage,
    switchToMainnet,
    refreshBalance,
    checkWalletLockStatus,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
