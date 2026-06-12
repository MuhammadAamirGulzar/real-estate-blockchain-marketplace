import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRevenueHistory } from "@/hooks/useRevenue";
import { ExternalLink, Loader2 } from "lucide-react";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const truncateHash = (hash) =>
  hash ? `${hash.substring(0, 8)}...${hash.slice(-6)}` : "—";

/**
 * Table component showing the logged-in investor's revenue claim history.
 */
const RevenueHistory = () => {
  const { data: history, isLoading, isError } = useRevenueHistory();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground text-sm">
          Loading history…
        </span>
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive text-center py-8">
        Failed to load revenue history.
      </p>
    );
  }

  if (!history?.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No revenue claims yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Property</TableHead>
          <TableHead className="text-right">Amount (ETH)</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Transaction</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {history.map((claim) => (
          <TableRow key={claim.id}>
            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
              {formatDate(claim.claimedAt || claim.createdAt)}
            </TableCell>

            <TableCell>
              <p className="text-sm font-medium leading-tight">
                {claim.propertyTitle || `Property #${claim.propertyId}`}
              </p>
            </TableCell>

            <TableCell className="text-right font-mono text-sm font-semibold text-emerald-600">
              +{parseFloat(claim.amountEth || 0).toFixed(6)}
            </TableCell>

            <TableCell>
              <Badge
                variant={claim.status === "completed" ? "default" : "secondary"}
                className="text-xs"
              >
                {claim.status || "completed"}
              </Badge>
            </TableCell>

            <TableCell>
              {claim.transactionHash ? (
                <a
                  href={`https://etherscan.io/tx/${claim.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline text-xs"
                >
                  {truncateHash(claim.transactionHash)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default RevenueHistory;
