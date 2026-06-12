import { Button } from "@/components/ui/button";
import { config } from "@/config/environment";
import { useWallet } from "@/contexts/WalletContext";
import KYCRegistryABI from "@/contracts/abi/KYCRegistry.json";
import { ethers } from "ethers";
import { useState } from "react";
import { toast } from "sonner";

export default function SubmitKYCOnChain({ documentHash, onSuccess }) {
  const { signer } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!signer) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading("Submitting KYC on-chain...");

    try {
      const kycRegistry = new ethers.Contract(
        config.contracts.kycRegistry,
        KYCRegistryABI.abi || KYCRegistryABI,
        signer,
      );

      console.log("Submitting KYC with hash:", documentHash);
      const tx = await kycRegistry.submitKYC(documentHash);
      console.log("Transaction sent:", tx.hash);

      await tx.wait();
      toast.success("KYC submitted on-chain successfully!", {
        id: loadingToast,
      });
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("On-chain submission failed:", error);
      toast.error(`Submission failed: ${error.reason || error.message}`, {
        id: loadingToast,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-4 text-center">
      <p className="mb-2 text-sm text-muted-foreground">
        Final Step: Submit your verification to the blockchain
      </p>
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full sm:w-auto"
      >
        {isSubmitting ? "Submitting..." : "Submit On-Chain"}
      </Button>
    </div>
  );
}
