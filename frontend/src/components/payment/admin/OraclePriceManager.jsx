import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Activity,
  AlertTriangle,
  Edit,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { CURRENCY_CONFIG } from "../CurrencySelector";

/**
 * Admin: Oracle Price Manager Component
 * Dashboard for managing property valuations and detecting price anomalies
 */

const OraclePriceManager = ({ className = "" }) => {
  const [properties, setProperties] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideData, setOverrideData] = useState({
    newPrice: "",
    currency: "USD",
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchAnomalies = async () => {
    try {
      const token =
        localStorage.getItem("authToken") || localStorage.getItem("token");
      const response = await fetch("/api/oracle/anomalies?threshold=20", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (response.ok) {
        setAnomalies(data.anomalies || []);
      }
    } catch (error) {
      console.error("Error fetching anomalies:", error);
    }
  };

  const fetchProperties = async () => {
    setLoading(true);
    try {
      // Fetch properties from your existing API
      const token =
        localStorage.getItem("authToken") || localStorage.getItem("token");
      const response = await fetch("/api/properties?limit=50", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (response.ok) {
        setProperties(data.properties || data || []);
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
    fetchAnomalies();
  }, []);

  const handleSyncPrices = async () => {
    if (properties.length === 0) return;

    setLoading(true);
    try {
      const token =
        localStorage.getItem("authToken") || localStorage.getItem("token");
      const propertyIds = properties.map((p) => p.id);

      const response = await fetch("/api/oracle/sync-prices", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ propertyIds }),
      });

      const data = await response.json();
      if (response.ok) {
        fetchProperties();
        fetchAnomalies();
      } else {
        alert(data.error || "Sync failed");
      }
    } catch (error) {
      console.error("Sync error:", error);
      alert("Sync failed");
    } finally {
      setLoading(false);
    }
  };

  const handleManualOverride = async () => {
    if (!selectedProperty || !overrideData.newPrice || !overrideData.reason) {
      alert("Please fill all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const token =
        localStorage.getItem("authToken") || localStorage.getItem("token");
      const response = await fetch(
        `/api/oracle/manual-override/${selectedProperty.id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(overrideData),
        },
      );

      const data = await response.json();
      if (response.ok) {
        setShowOverrideDialog(false);
        setSelectedProperty(null);
        setOverrideData({ newPrice: "", currency: "USD", reason: "" });
        fetchProperties();
        fetchAnomalies();
      } else {
        alert(data.error || "Override failed");
      }
    } catch (error) {
      console.error("Override error:", error);
      alert("Override failed");
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (price, currency) => {
    const config = CURRENCY_CONFIG[currency];
    return `${config?.symbol || ""}${parseFloat(price).toLocaleString(
      undefined,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    )}`;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Anomalies Alert */}
      {anomalies.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{anomalies.length} price anomalies detected!</strong> These
            properties have price changes exceeding 20%. Review and apply manual
            overrides if necessary.
          </AlertDescription>
        </Alert>
      )}

      {/* Price Anomalies Card */}
      {anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Price Anomalies
            </CardTitle>
            <CardDescription>
              Properties with suspicious price changes (±20%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Previous Price</TableHead>
                  <TableHead>Current Price</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalies.map((property) => {
                  const changePercent = property.changePercentage || 0;
                  return (
                    <TableRow key={property.id}>
                      <TableCell className="font-medium">
                        {property.name || property.title}
                      </TableCell>
                      <TableCell>
                        {formatPrice(property.previousPrice, property.currency)}
                      </TableCell>
                      <TableCell>
                        {formatPrice(property.currentPrice, property.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            changePercent > 0 ? "default" : "destructive"
                          }
                        >
                          <TrendingUp className="w-3 h-3 mr-1" />
                          {changePercent > 0 ? "+" : ""}
                          {changePercent.toFixed(2)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(property.lastUpdated).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedProperty(property);
                            setOverrideData({
                              newPrice: property.currentPrice,
                              currency: property.currency,
                              reason: "",
                            });
                            setShowOverrideDialog(true);
                          }}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Override
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All Properties Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Property Valuations
              </CardTitle>
              <CardDescription>
                Manage oracle prices and manual overrides
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={handleSyncPrices}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync from Blockchain
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No properties found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Current Price</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Oracle Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell className="font-medium">
                      {property.name || property.title}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatPrice(
                        property.currentMarketPrice || property.value,
                        property.baseCurrency || "USD",
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {property.priceSource || "manual"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {property.lastPriceUpdate
                        ? new Date(
                            property.lastPriceUpdate,
                          ).toLocaleDateString()
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          property.oracleEnabled ? "default" : "secondary"
                        }
                      >
                        {property.oracleEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedProperty(property);
                          setOverrideData({
                            newPrice:
                              property.currentMarketPrice ||
                              property.value ||
                              "",
                            currency: property.baseCurrency || "USD",
                            reason: "",
                          });
                          setShowOverrideDialog(true);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Manual Override Dialog */}
      <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Price Override</DialogTitle>
            <DialogDescription>
              Override oracle price for fraud prevention or manual appraisal
            </DialogDescription>
          </DialogHeader>

          {selectedProperty && (
            <div className="space-y-4">
              <div>
                <Label>Property</Label>
                <div className="font-semibold">
                  {selectedProperty.name || selectedProperty.title}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="new-price">New Price *</Label>
                  <Input
                    id="new-price"
                    type="number"
                    step="0.01"
                    value={overrideData.newPrice}
                    onChange={(e) =>
                      setOverrideData((prev) => ({
                        ...prev,
                        newPrice: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="currency">Currency *</Label>
                  <Select
                    value={overrideData.currency}
                    onValueChange={(value) =>
                      setOverrideData((prev) => ({ ...prev, currency: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="PKR">PKR</SelectItem>
                      <SelectItem value="AED">AED</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="reason">Reason for Override *</Label>
                <Textarea
                  id="reason"
                  placeholder="e.g., Property appraisal, Market correction, Fraud prevention..."
                  value={overrideData.reason}
                  onChange={(e) =>
                    setOverrideData((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  rows={4}
                />
              </div>

              <Alert>
                <AlertDescription className="text-xs">
                  <strong>Note:</strong> Manual overrides will be recorded in
                  the property valuation history with your admin ID and
                  timestamp for audit purposes.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowOverrideDialog(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleManualOverride} disabled={submitting}>
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Apply Override"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OraclePriceManager;
