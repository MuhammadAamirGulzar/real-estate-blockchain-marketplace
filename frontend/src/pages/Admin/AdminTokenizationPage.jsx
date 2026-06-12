import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import api from "@/services/api";
import { ethers } from "ethers";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Coins,
  Loader2,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const AdminTokenizationPage = () => {
  const navigate = useNavigate();

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tokenizingPropertyId, setTokenizingPropertyId] = useState(null);
  const [activatingPropertyId, setActivatingPropertyId] = useState(null);
  const [showTokenizeDialog, setShowTokenizeDialog] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);

  const readyCount = properties.filter((p) => p.canBeTokenized).length;
  const tokenizedCount = properties.filter(
    (p) => p.nftTokenId && p.fractionalTokenAddress,
  ).length;
  const activeCount = properties.filter((p) => p.status === "active").length;
  const pendingCount = readyCount; // alias for clarity in UI

  // Tokenization form data
  const [tokenizationData, setTokenizationData] = useState({
    fractionalTokenName: "",
    fractionalTokenSymbol: "",
    totalFractionalSupply: "",
    propertyValuation: "",
    metadataURI: "",
    treasuryAddress: "",
  });

  useEffect(() => {
    fetchPropertiesForTokenization();
  }, []);

  const fetchPropertiesForTokenization = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/properties/tokenization");
      const data = response.data;
      if (data.success) {
        setProperties(data.properties || []);
      } else {
        toast.error(data.message || "Failed to fetch properties");
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to load properties for tokenization",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTokenizeDialog = (property) => {
    setSelectedProperty(property);
    // Pre-fill form with suggested values
    setTokenizationData({
      fractionalTokenName: `${property.title} Token`,
      fractionalTokenSymbol: property.title
        .split(" ")
        .map((word) => word[0])
        .join("")
        .toUpperCase()
        .substring(0, 5),
      totalFractionalSupply: "1000000",
      propertyValuation: property.propertyValue || "",
      metadataURI: property.metadataUrl || "",
      treasuryAddress: "",
    });
    setShowTokenizeDialog(true);
  };

  const handleTokenizeProperty = async () => {
    if (!selectedProperty) return;

    try {
      setTokenizingPropertyId(selectedProperty.id);

      // Validate form
      if (
        !tokenizationData.fractionalTokenName ||
        !tokenizationData.fractionalTokenSymbol ||
        !tokenizationData.totalFractionalSupply ||
        !tokenizationData.propertyValuation
      ) {
        toast.error("Please fill in all required fields");
        return;
      }

      // Connect to MetaMask and get signature
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();

      // Create message for signature
      const message = `Tokenize Property ${selectedProperty.id}\nName: ${tokenizationData.fractionalTokenName}\nSymbol: ${tokenizationData.fractionalTokenSymbol}\nSupply: ${tokenizationData.totalFractionalSupply}\nValuation: ${tokenizationData.propertyValuation}\nTimestamp: ${Date.now()}`;
      const signature = await signer.signMessage(message);

      // Send tokenization request
      const response = await api.post(
        `/admin/properties/${selectedProperty.id}/tokenize`,
        {
          ...tokenizationData,
          signature,
          message,
        },
      );

      const data = response.data;

      if (data.success) {
        toast.success(
          `Property successfully tokenized! NFT Token ID: ${data.data.nftTokenId}`,
        );

        // Close dialog and refresh
        setShowTokenizeDialog(false);
        fetchPropertiesForTokenization();
      } else {
        toast.error(data.message || "Failed to tokenize property");
      }
    } catch (error) {
      console.error("Error tokenizing property:", error);
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "An error occurred during tokenization",
      );
    } finally {
      setTokenizingPropertyId(null);
    }
  };

  const handleActivateProperty = async (property) => {
    if (!property.nftTokenId) {
      toast.error("Property has no NFT Token ID — tokenize first");
      return;
    }
    try {
      setActivatingPropertyId(property.id);

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();

      const message = `Activate Property ${property.id}\nNFT Token ID: ${property.nftTokenId}\nTimestamp: ${Date.now()}`;
      const signature = await signer.signMessage(message);

      const response = await api.post(
        `/admin/properties/${property.nftTokenId}/activate`,
        { signature, message },
      );

      const data = response.data;
      if (data.success) {
        toast.success("Property activated! Investors can now purchase tokens.");
        fetchPropertiesForTokenization();
      } else {
        toast.error(data.message || "Failed to activate property");
      }
    } catch (error) {
      console.error("Error activating property:", error);
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "An error occurred during activation",
      );
    } finally {
      setActivatingPropertyId(null);
    }
  };

  const formatAddress = (address) => {
    if (!address) return "N/A";
    return `${address.substring(0, 6)}...${address.substring(
      address.length - 4,
    )}`;
  };

  const getStatusBadge = (property) => {
    if (property.status === "active") {
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700">
          <Zap className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    } else if (property.nftTokenId && property.fractionalTokenAddress) {
      return (
        <Badge className="bg-green-500 hover:bg-green-600">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Tokenized
        </Badge>
      );
    } else if (property.status === "verified" && property.canBeTokenized) {
      return (
        <Badge className="bg-blue-500 hover:bg-blue-600">
          Ready for Tokenization
        </Badge>
      );
    } else {
      return <Badge variant="outline">{property.status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </div>
        <h1 className="text-3xl font-bold mb-2">Property Tokenization</h1>
        <p className="text-muted-foreground">
          Mint PropertyNFTs and deploy FractionalPropertyTokens for verified
          properties
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Verified Properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{readyCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Ready for tokenization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tokenized
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{tokenizedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              NFTs + Fractional Tokens
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Tokenization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting action
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active (Open for Investment)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">
              {activeCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Investors can purchase tokens
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Properties Table */}
      <Card>
        <CardHeader>
          <CardTitle>Verified Properties</CardTitle>
          <CardDescription>
            Select properties to tokenize and create fractional ownership tokens
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                No Verified Properties
              </h3>
              <p className="text-muted-foreground">
                Properties must be verified before tokenization
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Valuation</TableHead>
                  <TableHead>Asset ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{property.title}</div>
                        <div className="text-sm text-muted-foreground">
                          Listed by: {property.lister?.email || "Unknown"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{property.location || "N/A"}</TableCell>
                    <TableCell>
                      $
                      {parseFloat(property.propertyValue || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {property.assetRegistryId || "N/A"}
                      </code>
                    </TableCell>
                    <TableCell>{getStatusBadge(property)}</TableCell>
                    <TableCell>
                      {property.canBeTokenized ? (
                        <Button
                          size="sm"
                          onClick={() => handleOpenTokenizeDialog(property)}
                          disabled={tokenizingPropertyId === property.id}
                        >
                          {tokenizingPropertyId === property.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Tokenizing...
                            </>
                          ) : (
                            <>
                              <Coins className="w-4 h-4 mr-2" />
                              Tokenize
                            </>
                          )}
                        </Button>
                      ) : property.nftTokenId &&
                        property.status !== "active" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300"
                          onClick={() => handleActivateProperty(property)}
                          disabled={activatingPropertyId === property.id}
                        >
                          {activatingPropertyId === property.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Activating...
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4 mr-2" />
                              Activate
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled>
                          <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" />
                          Active
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Tokenization Dialog */}
      <Dialog open={showTokenizeDialog} onOpenChange={setShowTokenizeDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Tokenize Property</DialogTitle>
            <DialogDescription>
              Create PropertyNFT and deploy FractionalPropertyToken for{" "}
              <strong>{selectedProperty?.title}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 flex-1 overflow-y-auto pr-2">
            {/* Property Info */}
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Property ID:</span>
                <span className="text-sm">{selectedProperty?.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Asset Registry ID:</span>
                <code className="text-xs bg-background px-2 py-1 rounded">
                  {selectedProperty?.assetRegistryId || "N/A"}
                </code>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Current Valuation:</span>
                <span className="text-sm">
                  $
                  {parseFloat(
                    selectedProperty?.propertyValue || 0,
                  ).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Fractional Token Name */}
            <div className="space-y-2">
              <Label htmlFor="tokenName">Fractional Token Name *</Label>
              <Input
                id="tokenName"
                placeholder="e.g., Luxury Villa Token"
                value={tokenizationData.fractionalTokenName}
                onChange={(e) =>
                  setTokenizationData({
                    ...tokenizationData,
                    fractionalTokenName: e.target.value,
                  })
                }
              />
            </div>

            {/* Fractional Token Symbol */}
            <div className="space-y-2">
              <Label htmlFor="tokenSymbol">Fractional Token Symbol *</Label>
              <Input
                id="tokenSymbol"
                placeholder="e.g., LVT"
                maxLength={10}
                value={tokenizationData.fractionalTokenSymbol}
                onChange={(e) =>
                  setTokenizationData({
                    ...tokenizationData,
                    fractionalTokenSymbol: e.target.value.toUpperCase(),
                  })
                }
              />
            </div>

            {/* Total Fractional Supply */}
            <div className="space-y-2">
              <Label htmlFor="totalSupply">Total Fractional Supply *</Label>
              <Input
                id="totalSupply"
                type="number"
                placeholder="e.g., 1000000"
                value={tokenizationData.totalFractionalSupply}
                onChange={(e) =>
                  setTokenizationData({
                    ...tokenizationData,
                    totalFractionalSupply: e.target.value,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Number of fractional tokens to mint (max supply will be 2x this
                value)
              </p>
            </div>

            {/* Property Valuation */}
            <div className="space-y-2">
              <Label htmlFor="valuation">Property Valuation (USD) *</Label>
              <Input
                id="valuation"
                type="number"
                placeholder="e.g., 500000"
                value={tokenizationData.propertyValuation}
                onChange={(e) =>
                  setTokenizationData({
                    ...tokenizationData,
                    propertyValuation: e.target.value,
                  })
                }
              />
            </div>

            {/* Metadata URI */}
            <div className="space-y-2">
              <Label htmlFor="metadataURI">Metadata URI (IPFS)</Label>
              <Input
                id="metadataURI"
                placeholder="ipfs://..."
                value={tokenizationData.metadataURI}
                onChange={(e) =>
                  setTokenizationData({
                    ...tokenizationData,
                    metadataURI: e.target.value,
                  })
                }
              />
            </div>

            {/* Treasury Address */}
            <div className="space-y-2">
              <Label htmlFor="treasuryAddress">
                Treasury Address (Optional)
              </Label>
              <Input
                id="treasuryAddress"
                placeholder="0x... (defaults to admin wallet)"
                value={tokenizationData.treasuryAddress}
                onChange={(e) =>
                  setTokenizationData({
                    ...tokenizationData,
                    treasuryAddress: e.target.value,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Address to receive the initial fractional token supply
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTokenizeDialog(false)}
              disabled={tokenizingPropertyId === selectedProperty?.id}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTokenizeProperty}
              disabled={tokenizingPropertyId === selectedProperty?.id}
            >
              {tokenizingPropertyId === selectedProperty?.id ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Tokenizing...
                </>
              ) : (
                <>
                  <Coins className="w-4 h-4 mr-2" />
                  Tokenize Property
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTokenizationPage;
