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
import { Textarea } from "@/components/ui/textarea";
import {
  useAdminDistributions,
  useAdminRevenueProperties,
  useDepositRevenue,
} from "@/hooks/useRevenue";
import { ArrowLeft, Building2, Coins, Loader2, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

const AdminRevenueDepositPage = () => {
  const navigate = useNavigate();

  const { data: properties, isLoading: propsLoading } =
    useAdminRevenueProperties();
  const { data: distributions, isLoading: distLoading } =
    useAdminDistributions();
  const { mutate: depositRevenue, isPending: depositing } = useDepositRevenue();

  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [depositData, setDepositData] = useState({ amountEth: "", notes: "" });

  const openDeposit = (prop) => {
    setSelectedProperty(prop);
    setDepositData({ amountEth: "", notes: "" });
    setShowDepositDialog(true);
  };

  const handleDeposit = () => {
    if (!depositData.amountEth || isNaN(depositData.amountEth)) return;
    depositRevenue(
      {
        propertyId: selectedProperty.id,
        amountEth: depositData.amountEth,
        notes: depositData.notes,
      },
      {
        onSuccess: () => setShowDepositDialog(false),
      },
    );
  };

  // Summary stats
  const totalDeposited = (distributions || []).reduce(
    (sum, d) => sum + parseFloat(d.totalRevenue || 0),
    0,
  );
  const totalProperties = (properties || []).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Revenue Management</h1>
              <p className="text-sm text-muted-foreground">
                Deposit and track revenue distributions to token holders
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tokenized Properties
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {propsLoading ? "—" : totalProperties}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Eligible for revenue distribution
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Distributions
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {distLoading ? "—" : (distributions || []).length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Revenue events recorded
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Deposited
              </CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {distLoading ? "—" : totalDeposited.toFixed(4)}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  ETH
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Across all properties
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tokenized Properties Table */}
        <Card>
          <CardHeader>
            <CardTitle>Tokenized Properties</CardTitle>
            <CardDescription>
              Select a property to deposit rental or revenue income for token
              holders to claim
            </CardDescription>
          </CardHeader>
          <CardContent>
            {propsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground text-sm">
                  Loading properties…
                </span>
              </div>
            ) : (properties || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No tokenized properties found.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Asset ID</TableHead>
                    <TableHead className="text-right">
                      Total Deposited (ETH)
                    </TableHead>
                    <TableHead className="text-right">
                      Total Claimed (ETH)
                    </TableHead>
                    <TableHead>Revenue Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(properties || []).map((prop) => {
                    const info = prop.revenueInfo || {};
                    return (
                      <TableRow key={prop.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{prop.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {prop.location}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {prop.assetRegistryId?.toString() || "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {info.totalRevenue
                            ? parseFloat(info.totalRevenue).toFixed(4)
                            : "0.0000"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {info.totalClaimed
                            ? parseFloat(info.totalClaimed).toFixed(4)
                            : "0.0000"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={info.isActive ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {info.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => openDeposit(prop)}
                            className="gap-1.5"
                          >
                            <Coins className="h-3.5 w-3.5" />
                            Deposit
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Distribution History */}
        <Card>
          <CardHeader>
            <CardTitle>Distribution History</CardTitle>
            <CardDescription>
              All recorded revenue deposits across all properties
            </CardDescription>
          </CardHeader>
          <CardContent>
            {distLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (distributions || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No distributions recorded yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead className="text-right">Amount (ETH)</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(distributions || []).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(d.distributionDate || d.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {d.propertyTitle || `Property #${d.propertyId}`}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-emerald-600 font-semibold">
                        +{parseFloat(d.totalRevenue || 0).toFixed(6)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {d.notes || d.distributionMessage || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            d.status === "completed" ? "default" : "secondary"
                          }
                          className="text-xs"
                        >
                          {d.status || "completed"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deposit Dialog */}
      <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Deposit Revenue</DialogTitle>
            <DialogDescription>
              Deposit ETH as rental/yield revenue for{" "}
              <strong>{selectedProperty?.title}</strong> token holders to claim.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (ETH)</Label>
              <Input
                id="amount"
                type="number"
                step="0.001"
                min="0"
                placeholder="e.g. 0.5"
                value={depositData.amountEth}
                onChange={(e) =>
                  setDepositData((prev) => ({
                    ...prev,
                    amountEth: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="e.g. Q2 2024 rental income"
                rows={3}
                value={depositData.notes}
                onChange={(e) =>
                  setDepositData((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDepositDialog(false)}
              disabled={depositing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeposit}
              disabled={depositing || !depositData.amountEth}
            >
              {depositing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Depositing…
                </>
              ) : (
                "Confirm Deposit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRevenueDepositPage;
