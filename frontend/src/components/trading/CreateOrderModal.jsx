import { Button } from "@/components/ui/button";
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
import { useCreateBuyOrder, useCreateSellOrder } from "@/hooks/useTrading";
import { Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * Modal for creating a new SELL or BUY order on the SecondaryMarket contract.
 *
 * Props:
 *   isOpen       - boolean
 *   onClose      - callback
 *   property     - { id, title, assetRegistryId }
 *   defaultType  - "SELL" | "BUY"  (default: "SELL")
 */
const CreateOrderModal = ({
  isOpen,
  onClose,
  property,
  defaultType = "SELL",
}) => {
  const [orderType, setOrderType] = useState(defaultType);
  const [form, setForm] = useState({
    tokenAmount: "",
    pricePerTokenEth: "",
    durationDays: "30",
  });

  const { mutate: createSellOrder, isPending: creatingSell } =
    useCreateSellOrder();
  const { mutate: createBuyOrder, isPending: creatingBuy } =
    useCreateBuyOrder();

  const isPending = creatingSell || creatingBuy;

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const totalEth =
    form.tokenAmount && form.pricePerTokenEth
      ? (
          parseFloat(form.tokenAmount) * parseFloat(form.pricePerTokenEth)
        ).toFixed(6)
      : null;

  const handleSubmit = () => {
    if (!form.tokenAmount || !form.pricePerTokenEth || !form.durationDays)
      return;
    if (!property?.assetRegistryId) return;

    const payload = {
      propertyId: property.id,
      assetId: property.assetRegistryId,
      tokenAmount: form.tokenAmount,
      pricePerTokenEth: form.pricePerTokenEth,
      durationDays: parseInt(form.durationDays),
    };

    const fn = orderType === "SELL" ? createSellOrder : createBuyOrder;
    fn(payload, {
      onSuccess: () => {
        onClose();
        setForm({ tokenAmount: "", pricePerTokenEth: "", durationDays: "30" });
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Create {orderType === "SELL" ? "Sell" : "Buy"} Order
          </DialogTitle>
          <DialogDescription>
            {property?.title} — Secondary Market
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Order Type */}
          <div className="space-y-2">
            <Label>Order Type</Label>
            <Select value={orderType} onValueChange={setOrderType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SELL">Sell Tokens</SelectItem>
                <SelectItem value="BUY">Buy Tokens (place bid)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Token Amount */}
          <div className="space-y-2">
            <Label htmlFor="tokenAmount">Token Amount</Label>
            <Input
              id="tokenAmount"
              type="number"
              step="0.000001"
              min="0"
              placeholder="e.g. 10"
              value={form.tokenAmount}
              onChange={set("tokenAmount")}
            />
            <p className="text-xs text-muted-foreground">
              Amount of fractional property tokens to{" "}
              {orderType === "SELL" ? "sell" : "buy"}
            </p>
          </div>

          {/* Price per Token */}
          <div className="space-y-2">
            <Label htmlFor="pricePerToken">Price per Token (ETH)</Label>
            <Input
              id="pricePerToken"
              type="number"
              step="0.0001"
              min="0"
              placeholder="e.g. 0.001"
              value={form.pricePerTokenEth}
              onChange={set("pricePerTokenEth")}
            />
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration">Order Duration (days)</Label>
            <Select
              value={form.durationDays}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, durationDays: v }))
              }
            >
              <SelectTrigger id="duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          {totalEth && (
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Value</span>
                <span className="font-semibold">{totalEth} ETH</span>
              </div>
              {orderType === "BUY" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    ETH sent (incl. 0.25% fee)
                  </span>
                  <span className="font-semibold">
                    {(parseFloat(totalEth) * 1.0025).toFixed(6)} ETH
                  </span>
                </div>
              )}
              {orderType === "SELL" && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠ You must first approve the SecondaryMarket contract to
                  transfer your tokens.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !form.tokenAmount || !form.pricePerTokenEth}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting…
              </>
            ) : orderType === "SELL" ? (
              "Create Sell Order"
            ) : (
              "Place Buy Order"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateOrderModal;
