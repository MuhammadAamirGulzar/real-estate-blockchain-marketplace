import {
  Activity,
  AlertCircle,
  CheckCircle,
  Play,
  RefreshCw,
  Square,
} from "lucide-react";
import { useEffect, useState } from "react";
import api from "../services/api";

const ReconciliationDashboard = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [autoReconcileRunning, setAutoReconcileRunning] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Load initial status
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const response = await api.get("/reconciliation/status");
      if (response.data.success) {
        setStatus(response.data.data);
      }
    } catch (error) {
      console.error("Error loading reconciliation status:", error);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  };

  const runReconciliation = async (autoFix = false) => {
    setLoading(true);
    try {
      const response = await api.post("/reconciliation/run", { autoFix });
      if (response.data.success) {
        showMessage(
          "success",
          `Reconciliation started with autoFix=${autoFix}`,
        );

        // Poll for completion
        setTimeout(async () => {
          await loadStatus();
          setLoading(false);
        }, 3000);
      }
    } catch (error) {
      showMessage(
        "error",
        `Error: ${error.response?.data?.message || error.message}`,
      );
      setLoading(false);
    }
  };

  const generateReport = async (autoFix = false) => {
    setLoading(true);
    try {
      const response = await api.post("/reconciliation/report", { autoFix });
      if (response.data.success) {
        setReport(response.data.data);
        showMessage("success", "Reconciliation report generated");
      }
    } catch (error) {
      showMessage(
        "error",
        `Error: ${error.response?.data?.message || error.message}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const reconcileSpecific = async (type, autoFix = false) => {
    setLoading(true);
    try {
      const response = await api.post(`/reconciliation/${type}`, { autoFix });
      if (response.data.success) {
        showMessage(
          "success",
          `${type.toUpperCase()} reconciliation completed: ${response.data.mismatches} mismatches, ${response.data.fixed} fixed`,
        );
        await loadStatus();
      }
    } catch (error) {
      showMessage(
        "error",
        `Error: ${error.response?.data?.message || error.message}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const startAutoReconcile = async () => {
    setLoading(true);
    try {
      const response = await api.post("/reconciliation/start-auto", {
        intervalMinutes,
      });
      if (response.data.success) {
        setAutoReconcileRunning(true);
        showMessage(
          "success",
          `Auto-reconciliation started (every ${intervalMinutes} minutes)`,
        );
      }
    } catch (error) {
      showMessage(
        "error",
        `Error: ${error.response?.data?.message || error.message}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const stopAutoReconcile = async () => {
    setLoading(true);
    try {
      const response = await api.post("/reconciliation/stop-auto");
      if (response.data.success) {
        setAutoReconcileRunning(false);
        showMessage("success", "Auto-reconciliation stopped");
      }
    } catch (error) {
      showMessage(
        "error",
        `Error: ${error.response?.data?.message || error.message}`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 theme-transition">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">
            State Reconciliation Dashboard
          </h1>
          <p className="mt-2 text-muted-foreground">
            Compare database state with blockchain state and fix mismatches
          </p>
        </div>

        {/* Message Display */}
        {message.text && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
              message.type === "success"
                ? "bg-emerald-500/10 text-foreground border border-emerald-500/30"
                : "bg-destructive/10 text-foreground border border-destructive/30"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
            {message.text}
          </div>
        )}

        {/* Status Card */}
        {status && (
          <div className="bg-card rounded-lg shadow-sm border border-border p-6 mb-6 theme-transition">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">
                Last Reconciliation
              </h2>
              <button
                onClick={loadStatus}
                className="text-primary hover:text-primary/80 flex items-center gap-2"
                disabled={loading}
              >
                <RefreshCw
                  size={18}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Last Run</p>
                <p className="text-lg font-semibold">
                  {status.lastRun
                    ? new Date(status.lastRun).toLocaleString()
                    : "Never"}
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">KYC Mismatches</p>
                <p className="text-2xl font-bold text-orange-600">
                  {status.results.kycMismatches}
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">
                  Property Mismatches
                </p>
                <p className="text-2xl font-bold text-orange-600">
                  {status.results.propertyMismatches}
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Role Mismatches</p>
                <p className="text-2xl font-bold text-orange-600">
                  {status.results.roleMismatches}
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Fixed</p>
                <p className="text-2xl font-bold text-green-600">
                  {status.results.fixed}
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Errors</p>
                <p className="text-2xl font-bold text-red-600">
                  {status.results.errors}
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <p
                  className={`text-lg font-semibold ${status.isReconciling ? "text-primary" : "text-muted-foreground"}`}
                >
                  {status.isReconciling ? "Running..." : "Idle"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Manual Reconciliation */}
        <div className="bg-card rounded-lg shadow-sm border border-border p-6 mb-6 theme-transition">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Manual Reconciliation
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => generateReport(false)}
              disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Activity size={20} />
              Generate Report (No Fix)
            </button>

            <button
              onClick={() => runReconciliation(true)}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
              Run Full Reconciliation (Auto-Fix)
            </button>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold text-foreground mb-3">
              Targeted Reconciliation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => reconcileSpecific("kyc", true)}
                disabled={loading}
                className="px-4 py-2 bg-navy-500 text-white rounded hover:bg-navy-400 disabled:opacity-50"
              >
                Reconcile KYC Only
              </button>
              <button
                onClick={() => reconcileSpecific("properties", true)}
                disabled={loading}
                className="px-4 py-2 bg-navy-500 text-white rounded hover:bg-navy-400 disabled:opacity-50"
              >
                Reconcile Properties Only
              </button>
              <button
                onClick={() => reconcileSpecific("roles", true)}
                disabled={loading}
                className="px-4 py-2 bg-navy-500 text-white rounded hover:bg-navy-400 disabled:opacity-50"
              >
                Reconcile Roles Only
              </button>
            </div>
          </div>
        </div>

        {/* Automatic Reconciliation */}
        <div className="bg-card rounded-lg shadow-sm border border-border p-6 mb-6 theme-transition">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Automatic Reconciliation
          </h2>

          <div className="flex items-center gap-4 mb-4">
            <label className="text-foreground">Interval (minutes):</label>
            <input
              type="number"
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(parseInt(e.target.value))}
              min="5"
              max="1440"
              className="px-4 py-2 border rounded-lg w-32"
              disabled={autoReconcileRunning}
            />
          </div>

          <div className="flex gap-4">
            {!autoReconcileRunning ? (
              <button
                onClick={startAutoReconcile}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <Play size={20} />
                Start Auto-Reconciliation
              </button>
            ) : (
              <button
                onClick={stopAutoReconcile}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                <Square size={20} />
                Stop Auto-Reconciliation
              </button>
            )}
          </div>

          {autoReconcileRunning && (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-foreground">
                ✅ Auto-reconciliation is running every {intervalMinutes}{" "}
                minutes
              </p>
            </div>
          )}
        </div>

        {/* Report Display */}
        {report && (
          <div className="bg-card rounded-lg shadow-sm border border-border p-6 theme-transition">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Reconciliation Report
            </h2>

            <div className="space-y-4">
              <div className="border-b pb-2">
                <p className="text-sm text-muted-foreground">Timestamp</p>
                <p className="text-lg font-semibold">
                  {new Date(report.timestamp).toLocaleString()}
                </p>
              </div>

              <div className="border-b pb-2">
                <p className="text-sm text-muted-foreground">Total Mismatches</p>
                <p className="text-2xl font-bold text-orange-600">
                  {report.totalMismatches}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-2">KYC</p>
                  <p className="text-xl font-bold text-orange-600">
                    {report.details.kyc.mismatches} mismatches
                  </p>
                  {report.autoFixEnabled && (
                    <p className="mt-1 text-sm text-emerald-400">
                      ✓ {report.details.kyc.fixed} fixed
                    </p>
                  )}
                </div>

                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-2">Properties</p>
                  <p className="text-xl font-bold text-orange-600">
                    {report.details.properties.mismatches} mismatches
                  </p>
                  {report.autoFixEnabled && (
                    <p className="mt-1 text-sm text-emerald-400">
                      ✓ {report.details.properties.fixed} fixed
                    </p>
                  )}
                </div>

                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-2">Roles</p>
                  <p className="text-xl font-bold text-orange-600">
                    {report.details.roles.mismatches} mismatches
                  </p>
                  {report.autoFixEnabled && (
                    <p className="mt-1 text-sm text-emerald-400">
                      ✓ {report.details.roles.fixed} fixed
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">Recommendation</p>
                <p className="text-foreground">{report.recommendation}</p>
              </div>

              {report.details.errors > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                  <p className="font-semibold text-destructive">
                    ⚠️ {report.details.errors} errors occurred during
                    reconciliation
                  </p>
                  <p className="mt-1 text-sm text-destructive/90">
                    Check backend logs for details
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReconciliationDashboard;
