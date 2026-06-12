import Header from "@/components/layout/Header";
import CreateOrderModal from "@/components/trading/CreateOrderModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCancelOrder,
  useExecuteSellOrder,
  useMarketData,
  usePropertyOrders,
  useTradingHistory,
  useUserOrders,
} from "@/hooks/useTrading";
import { ethers } from "ethers";
import {
  ArrowLeftRight,
  BarChart3,
  Loader2,
  PlusCircle,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

// Helper: format Wei-scaled price as human-readable ETH
const fmtPriceWei = (weiStr) => {
  try {
    return parseFloat(ethers.formatEther(BigInt(weiStr))).toFixed(6);
  } catch {
    return "—";
  }
};

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

export default function TradingPage() {
  const { propertyId } = useParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [defaultOrderType, setDefaultOrderType] = useState("SELL");

  const { data: ordersData, isLoading: ordersLoading } =
    usePropertyOrders(propertyId);
  const { data: marketData } = useMarketData(propertyId);
  const { data: userOrders } = useUserOrders();
  const { data: history, isLoading: historyLoading } = useTradingHistory();
  const { mutate: executeSellOrder, isPending: executing } =
    useExecuteSellOrder();
  const { mutate: cancelOrder, isPending: cancelling } = useCancelOrder();

  const orders = ordersData?.orders || [];
  const propertyTitle = ordersData?.propertyTitle || `Property #${propertyId}`;
  const assetId = ordersData?.assetId;

  const sellOrders = orders.filter((o) => o.orderType === "SELL");
  const buyOrders = orders.filter((o) => o.orderType === "BUY");

  const property = {
    id: parseInt(propertyId),
    title: propertyTitle,
    assetRegistryId: assetId,
  };

  const openCreate = (type) => {
    setDefaultOrderType(type);
    setShowCreateModal(true);
  };

  const handleBuy = (order) => {
    executeSellOrder({
      propertyId: parseInt(propertyId),
      orderId: order.orderId,
      listingId: null, // DB listingId unknown from chain-only view
      amount: ethers.formatEther(BigInt(order.tokenAmount)),
      pricePerToken: order.pricePerToken,
    });
  };

  const handleCancel = (orderId) => {
    cancelOrder({ propertyId: parseInt(propertyId), orderId, listingId: null });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-8 animate-fade-in">
        {/* Page Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Secondary Market
            </h1>
            <p className="text-muted-foreground mt-1">
              {propertyTitle} — peer-to-peer token trading
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => openCreate("BUY")}
            >
              <PlusCircle className="h-4 w-4" />
              Place Bid
            </Button>
            <Button className="gap-2" onClick={() => openCreate("SELL")}>
              <ArrowLeftRight className="h-4 w-4" />
              List Tokens
            </Button>
          </div>
        </div>

        {/* Market Stats */}
        {marketData && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground mb-1">
                  Total Trades
                </p>
                <p className="text-2xl font-bold">{marketData.tradeCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground mb-1">
                  Total Volume
                </p>
                <p className="text-2xl font-bold">
                  {marketData.totalVolumeEth}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    ETH
                  </span>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground mb-1">Last Price</p>
                <p className="text-2xl font-bold">
                  {marketData.lastPriceEth
                    ? `${marketData.lastPriceEth} ETH`
                    : "—"}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Order Book */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sell Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-red-500" />
                Sell Orders
                <Badge variant="secondary" className="ml-auto">
                  {sellOrders.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : sellOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No sell orders
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Price (ETH)</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sellOrders.map((order) => (
                      <TableRow key={order.orderId}>
                        <TableCell className="font-mono text-sm font-semibold text-red-600">
                          {fmtPriceWei(order.pricePerToken)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {parseFloat(
                            ethers.formatEther(BigInt(order.remainingAmount)),
                          ).toFixed(4)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDate(order.expiresAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="xs"
                            className="text-xs h-7 px-2"
                            onClick={() => handleBuy(order)}
                            disabled={executing}
                          >
                            Buy
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Buy Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Buy Orders
                <Badge variant="secondary" className="ml-auto">
                  {buyOrders.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : buyOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No buy orders
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Price (ETH)</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {buyOrders.map((order) => (
                      <TableRow key={order.orderId}>
                        <TableCell className="font-mono text-sm font-semibold text-emerald-600">
                          {fmtPriceWei(order.pricePerToken)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {parseFloat(
                            ethers.formatEther(BigInt(order.remainingAmount)),
                          ).toFixed(4)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDate(order.expiresAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="xs"
                            variant="outline"
                            className="text-xs h-7 px-2"
                            onClick={() => handleCancel(order.orderId)}
                            disabled={cancelling}
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* My Active Orders */}
        {userOrders && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                My Active Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(userOrders.dbListings || []).filter(
                (l) => l.status === "active",
              ).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  You have no active orders
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="text-right">
                        Price / Token
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Listed</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(userOrders.dbListings || [])
                      .filter((l) => l.status === "active")
                      .map((listing) => {
                        // Extract orderId from listingMessage: "orderId:X;type:Y;..."
                        const msgParts = Object.fromEntries(
                          (listing.listingMessage || "")
                            .split(";")
                            .map((p) => p.split(":")),
                        );
                        return (
                          <TableRow key={listing.id}>
                            <TableCell className="text-sm font-medium">
                              {listing.propertyTitle ||
                                `Property #${listing.propertyId}`}
                            </TableCell>
                            <TableCell className="text-sm">
                              {parseFloat(listing.amount || 0).toFixed(4)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {fmtPriceWei(listing.pricePerToken)} ETH
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  listing.status === "active"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {listing.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {fmtDate(listing.listedAt)}
                            </TableCell>
                            <TableCell>
                              {listing.status === "active" &&
                                msgParts.orderId && (
                                  <Button
                                    size="xs"
                                    variant="destructive"
                                    className="text-xs h-7 px-2"
                                    onClick={() =>
                                      handleCancel(msgParts.orderId)
                                    }
                                    disabled={cancelling}
                                  >
                                    Cancel
                                  </Button>
                                )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Trade History */}
        <Card>
          <CardHeader>
            <CardTitle>My Trade History</CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (history || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No trades yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Total (ETH)</TableHead>
                    <TableHead>Tx Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(history || []).map((trade) => (
                    <TableRow key={trade.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(trade.tradedAt)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {trade.propertyTitle || `Property #${trade.propertyId}`}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {parseFloat(trade.amount || 0).toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-emerald-600 font-semibold">
                        {parseFloat(
                          ethers.formatEther(
                            BigInt(
                              Math.round(parseFloat(trade.totalPrice || 0)),
                            ),
                          ),
                        ).toFixed(6)}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {trade.transactionHash
                          ? `${trade.transactionHash.slice(0, 8)}…`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <CreateOrderModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          property={property}
          defaultType={defaultOrderType}
        />
      </main>
    </div>
  );
}
