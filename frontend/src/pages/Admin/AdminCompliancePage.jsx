import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminCompliancePage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Compliance Management
        </h1>
        <p className="text-muted-foreground">
          Monitor compliance and regulatory requirements
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Compliance management features coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}