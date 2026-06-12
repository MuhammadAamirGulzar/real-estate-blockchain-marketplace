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
import {
  ArrowLeft,
  Building2,
  DollarSign,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const AdminInvestmentPoolsPage = () => {
  const navigate = useNavigate();

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creatingPool, setCreatingPool] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);

  // Pool creation form data
  const [poolData, setPoolData] = useState({
    pricePerToken: "",
    minInvestment: "",
  });

  useEffect(() => {
    fetchTokenizedProperties();
  }, []);

  const fetchTokenizedProperties = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/properties/tokenization");
      const data = response.data;
      if (data.success) {
        // Filter for tokenized properties only
        const tokenized = (data.properties || []).filter(
          (p) => p.nftTokenId && p.fractionalTokenAddress,
        );
        setProperties(tokenized);
      } else {
        toast.error(data.message || "Failed to fetch properties");
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
      toast.error(
        error.response?.data?.message || "Failed to load tokenized properties",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateDialog = (property) => {
    if (property?.investmentPoolCreated) {
      toast.info("Investment pool is already created for this property");
      return;
    }

    setSelectedProperty(property);
    // Pre-fill with suggested values
    const totalSupply = parseFloat(property.totalFractionalSupply || 0);
    const propertyValue = parseFloat(property.propertyValue || 0);
    const suggestedPrice =
      propertyValue > 0 && totalSupply > 0
        ? (propertyValue / totalSupply).toFixed(2)
        : "1000";
    setPoolData({
      pricePerToken: suggestedPrice,
      minInvestment: "100",
    });
    setShowCreateDialog(true);
  };

  const handleCreatePool = async () => {
    if (!selectedProperty) return;

    const { pricePerToken, minInvestment } = poolData;

    // Validation
    if (!pricePerToken || parseFloat(pricePerToken) <= 0) {
      toast.error("Please enter a valid price per token");
      return;
    }

    if (!minInvestment || parseFloat(minInvestment) <= 0) {
      toast.error("Please enter a valid minimum investment amount");
      return;
    }

    setCreatingPool(true);

    try {
      const response = await api.post(
        `/admin/properties/${selectedProperty.id}/create-pool`,
        {
          pricePerToken: parseFloat(pricePerToken),
          minInvestment: parseFloat(minInvestment),
        },
      );

      const data = response.data;
      if (!data?.success) {
        toast.error(data?.message || "Failed to create investment pool");
        return;
      }

      if (data?.data?.alreadyExists) {
        toast.info(
          "Pool already existed on-chain. Local status is now synced.",
        );
      } else {
        toast.success("Investment pool created successfully!");
      }

      setShowCreateDialog(false);
      fetchTokenizedProperties(); // Refresh list
    } catch (error) {
      console.error("Error creating investment pool:", error);
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to create investment pool",
      );
    } finally {
      setCreatingPool(false);
    }
  };

  const formatNumber = (value) => {
    if (!value && value !== 0) return "N/A";
    return Number(value).toLocaleString();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate("/admin/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-foreground">
            Investment Pool Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Create investment pools for tokenized properties
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tokenized Properties
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{properties.length}</div>
            <p className="text-xs text-muted-foreground">
              Available for investment pools
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Property Value
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              $
              {formatNumber(
                properties.reduce(
                  (sum, p) => sum + (parseFloat(p.propertyValue) || 0),
                  0,
                ),
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all properties
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Available Tokens
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(
                properties.reduce(
                  (sum, p) => sum + (parseFloat(p.totalFractionalSupply) || 0),
                  0,
                ),
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Total fractional tokens
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Properties Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tokenized Properties</CardTitle>
          <CardDescription>
            Create investment pools for properties to enable user investments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No tokenized properties found
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Tokenize properties first to create investment pools
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>NFT Token ID</TableHead>
                  <TableHead>Total Supply</TableHead>
                  <TableHead>Property Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{property.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {property.location}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">#{property.nftTokenId}</Badge>
                    </TableCell>
                    <TableCell>
                      {formatNumber(property.totalFractionalSupply)} tokens
                    </TableCell>
                    <TableCell>
                      ${formatNumber(property.propertyValue)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          property.investmentPoolCreated
                            ? "success"
                            : "secondary"
                        }
                      >
                        {property.investmentPoolCreated
                          ? "Pool Created"
                          : "Pending Pool"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {!property.investmentPoolCreated && (
                        <Button
                          size="sm"
                          onClick={() => handleOpenCreateDialog(property)}
                        >
                          Create Pool
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

      {/* Create Pool Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Investment Pool</DialogTitle>
            <DialogDescription>
              Set parameters for the investment pool for{" "}
              {selectedProperty?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Property Info */}
            <div className="p-4 bg-muted/40 rounded-lg border border-border/60">
              <p className="text-sm font-medium text-foreground">Property</p>
              <p className="text-lg font-semibold text-foreground">
                {selectedProperty?.title}
              </p>
              <p className="text-sm text-muted-foreground">
                NFT Token ID: #{selectedProperty?.nftTokenId}
              </p>
              <p className="text-sm text-muted-foreground">
                Total Supply:{" "}
                {formatNumber(selectedProperty?.totalFractionalSupply)} tokens
              </p>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="pricePerToken">Price Per Token (RWAP) *</Label>
                <Input
                  id="pricePerToken"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 1000.00"
                  value={poolData.pricePerToken}
                  onChange={(e) =>
                    setPoolData({ ...poolData, pricePerToken: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Price in RWAP tokens per fractional token
                </p>
              </div>

              <div>
                <Label htmlFor="minInvestment">
                  Minimum Investment (RWAP) *
                </Label>
                <Input
                  id="minInvestment"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 100.00"
                  value={poolData.minInvestment}
                  onChange={(e) =>
                    setPoolData({ ...poolData, minInvestment: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum RWAP tokens required to invest
                </p>
              </div>
            </div>

            {/* Calculation Preview */}
            {poolData.pricePerToken && (
              <div className="p-4 rounded-lg border border-primary/20 bg-primary/10">
                <p className="text-sm font-medium text-foreground mb-2">
                  Pool Preview
                </p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    Total Pool Value:{" "}
                    {formatNumber(
                      (parseFloat(
                        selectedProperty?.totalFractionalSupply || 0,
                      ) || 0) * parseFloat(poolData.pricePerToken || 0),
                    )}{" "}
                    RWAP
                  </p>
                  <p>
                    Min Investment: {formatNumber(poolData.minInvestment || 0)}{" "}
                    RWAP
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={creatingPool}
            >
              Cancel
            </Button>
            <Button onClick={handleCreatePool} disabled={creatingPool}>
              {creatingPool ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Pool...
                </>
              ) : (
                "Create Pool"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInvestmentPoolsPage;
