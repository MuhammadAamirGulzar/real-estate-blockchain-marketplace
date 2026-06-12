import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminInvestorsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Investor Management
        </h1>
        <p className="text-muted-foreground">
          Manage platform investors and their accounts
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Investors</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Investor management features coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}