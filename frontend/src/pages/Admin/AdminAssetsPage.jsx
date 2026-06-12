import PropertyManagement from "@/components/admin/PropertyManagement";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PROPERTY_STATUSES } from "@/constants/propertyStatuses";
import api from "@/services/api";
import {
  Building2,
  CheckCircle2,
  Clock,
  Coins,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

export default function AdminAssetsPage() {
  const [stats, setStats] = useState({
    total: 0,
    pendingAssignment: 0,
    underVerification: 0,
    verified: 0,
    rejected: 0,
    tokenized: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get("/admin/properties");
      if (response.data.success) {
        const properties = response.data.properties;
        setStats({
          total: properties.length,
          pendingAssignment: properties.filter(
            (p) => p.status === PROPERTY_STATUSES.PENDING_ASSIGNMENT,
          ).length,
          underVerification: properties.filter(
            (p) => p.status === PROPERTY_STATUSES.VERIFICATION_PENDING,
          ).length,
          verified: properties.filter(
            (p) => p.status === PROPERTY_STATUSES.VERIFIED,
          ).length,
          rejected: properties.filter(
            (p) => p.status === PROPERTY_STATUSES.REJECTED,
          ).length,
          tokenized: properties.filter(
            (p) =>
              p.status === PROPERTY_STATUSES.TOKENIZED ||
              p.status === PROPERTY_STATUSES.ACTIVE,
          ).length,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, description }) => (
    <Card className="border-0 shadow-md">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {title}
            </p>
            <p className={`text-3xl font-bold ${color} mt-2`}>
              {loading ? "..." : value}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div
            className={`p-3 rounded-full ${color.replace("text", "bg").replace("600", "100")}`}
          >
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Building2 className="w-8 h-8 text-blue-600" />
          Asset Management
        </h1>
        <p className="text-muted-foreground">
          Manage property listings, assign verifiers, and track tokenization
          status
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total Properties"
          value={stats.total}
          icon={Building2}
          color="text-blue-600"
        />
        <StatCard
          title="Pending Assignment"
          value={stats.pendingAssignment}
          icon={Clock}
          color="text-yellow-600"
          description="Need verifier"
        />
        <StatCard
          title="Under Verification"
          value={stats.underVerification}
          icon={TrendingUp}
          color="text-blue-600"
          description="Being reviewed"
        />
        <StatCard
          title="Verified"
          value={stats.verified}
          icon={CheckCircle2}
          color="text-green-600"
          description="Ready to tokenize"
        />
        <StatCard
          title="Rejected"
          value={stats.rejected}
          icon={XCircle}
          color="text-red-600"
        />
        <StatCard
          title="Tokenized"
          value={stats.tokenized}
          icon={Coins}
          color="text-purple-600"
        />
      </div>

      {/* Tabbed Property Management */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="all">All Properties</TabsTrigger>
          <TabsTrigger value={PROPERTY_STATUSES.PENDING_ASSIGNMENT}>
            Pending Assignment
            {stats.pendingAssignment > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-yellow-500 text-white">
                {stats.pendingAssignment}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value={PROPERTY_STATUSES.VERIFICATION_PENDING}>
            Under Verification
          </TabsTrigger>
          <TabsTrigger value={PROPERTY_STATUSES.VERIFIED}>
            Verified
            {stats.verified > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-500 text-white">
                {stats.verified}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value={PROPERTY_STATUSES.REJECTED}>Rejected</TabsTrigger>
          <TabsTrigger value={PROPERTY_STATUSES.TOKENIZED}>
            Tokenized
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <PropertyManagement statusFilter="all" onUpdate={fetchStats} />
        </TabsContent>

        <TabsContent
          value={PROPERTY_STATUSES.PENDING_ASSIGNMENT}
          className="mt-6"
        >
          <PropertyManagement
            statusFilter={PROPERTY_STATUSES.PENDING_ASSIGNMENT}
            onUpdate={fetchStats}
          />
        </TabsContent>

        <TabsContent
          value={PROPERTY_STATUSES.VERIFICATION_PENDING}
          className="mt-6"
        >
          <PropertyManagement
            statusFilter={PROPERTY_STATUSES.VERIFICATION_PENDING}
            onUpdate={fetchStats}
          />
        </TabsContent>

        <TabsContent value={PROPERTY_STATUSES.VERIFIED} className="mt-6">
          <PropertyManagement
            statusFilter={PROPERTY_STATUSES.VERIFIED}
            onUpdate={fetchStats}
          />
        </TabsContent>

        <TabsContent value={PROPERTY_STATUSES.REJECTED} className="mt-6">
          <PropertyManagement
            statusFilter={PROPERTY_STATUSES.REJECTED}
            onUpdate={fetchStats}
          />
        </TabsContent>

        <TabsContent value={PROPERTY_STATUSES.TOKENIZED} className="mt-6">
          <PropertyManagement
            statusFilter={PROPERTY_STATUSES.TOKENIZED}
            onUpdate={fetchStats}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
