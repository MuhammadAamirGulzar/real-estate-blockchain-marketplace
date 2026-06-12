import {
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle,
  Coins,
  CreditCard,
  Shield,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import api from "../../services/api";

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await api.get("/admin/dashboard-stats");
        setStats(res.data);
      } catch (err) {
        console.error("Failed to fetch dashboard stats:", err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    {
      title: "Total Users",
      value: loading ? "..." : (stats?.totalUsers ?? 0),
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Total Properties",
      value: loading ? "..." : (stats?.totalProperties ?? 0),
      icon: Building2,
      color: "text-secondary",
      bg: "bg-secondary/10",
    },
    {
      title: "Pending KYC",
      value: loading ? "..." : (stats?.pendingKYC ?? 0),
      icon: Shield,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      title: "Active Verifiers",
      value: loading ? "..." : (stats?.activeVerifiers ?? 0),
      icon: UserCheck,
      color: "text-success",
      bg: "bg-success/10",
    },
  ];

  const quickLinks = [
    {
      label: "KYC Review",
      path: "/admin/kyc-review",
      icon: Shield,
      description: `${stats?.pendingKYC ?? 0} pending`,
    },
    {
      label: "Tokenization",
      path: "/admin/tokenization",
      icon: Coins,
      description: "Manage token minting",
    },
    {
      label: "Investment Pools",
      path: "/admin/investment-pools",
      icon: Briefcase,
      description: "Manage investment pools",
    },
    {
      label: "Payment Verification",
      path: "/admin/payment-verification",
      icon: CreditCard,
      description: "Verify payments",
    },
    {
      label: "Revenue Management",
      path: "/admin/revenue",
      icon: BarChart3,
      description: "Distribute revenue",
    },
    {
      label: "Asset Registry",
      path: "/admin/assets",
      icon: TrendingUp,
      description: "On-chain asset registry",
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-1">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Platform overview and management
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="card-interactive">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center`}
                  >
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-3xl font-bold mt-1">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Navigation</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Button
                  key={link.path}
                  variant="outline"
                  className="h-auto flex-col items-start p-4 gap-1 text-left"
                  onClick={() => navigate(link.path)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">{link.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {link.description}
                  </span>
                </Button>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Loading...
              </p>
            ) : stats?.recentActivity?.length > 0 ? (
              <div className="space-y-3">
                {stats.recentActivity.slice(0, 6).map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/40"
                  >
                    <div className="mt-0.5">
                      {activity.type === "kyc_approved" ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <Building2 className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.description}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {activity.timestamp
                        ? new Date(activity.timestamp).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" },
                          )
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No recent activity
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
