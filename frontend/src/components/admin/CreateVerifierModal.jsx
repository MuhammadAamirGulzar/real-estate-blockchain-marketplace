import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useWallet } from "../../contexts/WalletContext";
import api from "../../services/api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

const CreateVerifierModal = ({ open, onClose, onSuccess }) => {
  const { signer, isConnected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    walletAddress: "",
    specialization: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isConnected || !signer) {
      toast.error("Please connect your wallet first");
      return;
    }

    // Validate wallet address format
    if (!formData.walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      toast.error("Invalid wallet address format");
      return;
    }

    setLoading(true);
    console.log("Creating verifier with data:", {
      ...formData,
      password: "***hidden***",
    });

    try {
      const message = `Action: create_verifier\nEmail: ${
        formData.email
      }\nTimestamp: ${Date.now()}`;

      console.log("Requesting signature for message:", message);
      const signature = await signer.signMessage(message);
      console.log("Signature obtained:", signature.substring(0, 20) + "...");

      console.log("Sending POST request to /admin/create-verifier");
      const response = await api.post("/admin/create-verifier", {
        ...formData,
        signature,
        message,
      });

      console.log("Response received:", response.data);

      if (response.data.success) {
        toast.success("Verifier created successfully");
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          password: "",
          walletAddress: "",
          specialization: "",
        });
        onSuccess();
      } else {
        console.error("Failed to create verifier:", response.data);
        toast.error(response.data.message || "Failed to create verifier");
      }
    } catch (error) {
      console.error("Error creating verifier:", error);
      console.error("Error response:", error.response?.data);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Error creating verifier";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        className="bg-card text-card-foreground border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            Create Verifier
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    firstName: e.target.value,
                  }))
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, lastName: e.target.value }))
                }
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, password: e.target.value }))
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="walletAddress">Wallet Address</Label>
            <Input
              id="walletAddress"
              placeholder="0x..."
              value={formData.walletAddress}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  walletAddress: e.target.value,
                }))
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="specialization">Specialization</Label>
            <select
              id="specialization"
              value={formData.specialization}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  specialization: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select Specialization</option>
              <option value="Residential Properties">
                Residential Properties
              </option>
              <option value="Commercial Real Estate">
                Commercial Real Estate
              </option>
              <option value="Property Valuation">Property Valuation</option>
              <option value="Industrial Properties">
                Industrial Properties
              </option>
              <option value="Land Development">Land Development</option>
            </select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-green-600 to-teal-600"
            >
              {loading ? "Creating..." : "Create Verifier"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateVerifierModal;
