import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  Shield,
  XCircle,
} from "lucide-react";
import { useCallback, useMemo } from "react";

// Constants
const KYC_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXPIRED: "expired",
};

const STATUS_CONFIG = {
  [KYC_STATUS.PENDING]: {
    icon: Clock,
    label: "Under Review",
    color: "accent",
    description:
      "Your KYC application is being reviewed by our verification team.",
  },
  [KYC_STATUS.APPROVED]: {
    icon: CheckCircle,
    label: "Verified",
    color: "secondary",
    description: "Your identity has been verified successfully.",
  },
  [KYC_STATUS.REJECTED]: {
    icon: XCircle,
    label: "Rejected",
    color: "destructive",
    description: "Your KYC application was rejected.",
  },
  [KYC_STATUS.EXPIRED]: {
    icon: AlertCircle,
    label: "Expired",
    color: "accent",
    description: "Your KYC verification has expired. Please resubmit.",
  },
};

const SUPPORTED_COUNTRIES = [
  "United States",
  "Canada",
  "United Kingdom",
  "Australia",
  "Germany",
  "France",
  "Japan",
  "Singapore",
  "Pakistan",
  "United Arab Emirates",
];

const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

const PAKISTAN_PROVINCES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Gilgit-Baltistan",
  "Azad Kashmir",
  "Islamabad",
];

const UAE_EMIRATES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
];

/**
 * Status Badge Component
 * Displays KYC status with appropriate styling
 */
const StatusBadge = ({ status }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG[KYC_STATUS.PENDING];
  const Icon = config.icon;

  const colorClasses = {
    accent: "bg-accent/10 text-accent border-accent/30",
    secondary: "bg-secondary/10 text-secondary border-secondary/30",
    destructive: "bg-destructive/10 text-destructive border-destructive/30",
  };

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
        colorClasses[config.color]
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="text-sm font-semibold">{config.label}</span>
    </div>
  );
};

/**
 * Status Timeline Component
 * Shows KYC submission and review timeline
 */
const StatusTimeline = ({ submittedAt, reviewedAt, status }) => (
  <div className="space-y-2 text-sm">
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-primary" />
        <div className="w-0.5 h-6 bg-border" />
      </div>
      <div className="py-1">
        <p className="font-medium text-foreground">Submitted</p>
        <p className="text-muted-foreground">
          {new Date(submittedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>

    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`w-3 h-3 rounded-full ${
            status !== KYC_STATUS.PENDING ? "bg-secondary" : "bg-muted"
          }`}
        />
      </div>
      <div className="py-1">
        <p className="font-medium text-foreground">Review Status</p>
        {status === KYC_STATUS.PENDING ? (
          <p className="text-muted-foreground">Under review...</p>
        ) : (
          <p className="text-muted-foreground">
            {new Date(reviewedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        )}
      </div>
    </div>
  </div>
);

/**
 * Information Display Section Component
 * Shows submitted KYC information in read-only format
 */
const InformationDisplaySection = ({ data }) => (
  <div className="space-y-4">
    <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
      Submitted Information
    </h3>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
          First Name
        </p>
        <p className="text-sm font-medium text-foreground">{data.firstName}</p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
          Last Name
        </p>
        <p className="text-sm font-medium text-foreground">{data.lastName}</p>
      </div>
    </div>

    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
        Email Address
      </p>
      <p className="text-sm font-medium text-foreground">{data.email}</p>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
          Date of Birth
        </p>
        <p className="text-sm font-medium text-foreground">
          {new Date(data.dateOfBirth).toLocaleDateString("en-US")}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
          Nationality
        </p>
        <p className="text-sm font-medium text-foreground">
          {data.nationality}
        </p>
      </div>
    </div>

    <div className="border-t border-border pt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
        Address Information
      </p>
      <div className="space-y-2 text-sm">
        <p className="font-medium text-foreground">{data.address}</p>
        <p className="text-foreground">
          {data.city}, {data.state || data.province} {data.zipCode}
        </p>
        <p className="text-foreground">{data.country}</p>
      </div>
    </div>

    {data.documentType && (
      <div className="border-t border-border pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
          Document Submitted
        </p>
        <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md border border-border">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-foreground">{data.documentType}</span>
        </div>
      </div>
    )}
  </div>
);

/**
 * Rejection Notice Component
 * Displays rejection details with reason
 */
const RejectionNotice = ({ reason, onResubmit }) => (
  <Alert className="border-destructive/30 bg-destructive/5">
    <XCircle className="h-4 w-4 text-destructive" />
    <AlertDescription className="text-destructive ml-2">
      <p className="font-semibold mb-2">Application Rejected</p>
      <p className="text-sm mb-4">{reason}</p>
      <Button
        onClick={onResubmit}
        size="sm"
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        Resubmit Application
      </Button>
    </AlertDescription>
  </Alert>
);

/**
 * Pending Notice Component
 * Shows information while KYC is under review
 */
const PendingNotice = () => (
  <Alert className="border-accent/30 bg-accent/5">
    <Clock className="h-4 w-4 text-accent" />
    <AlertDescription className="text-accent-foreground ml-2">
      <p className="font-semibold mb-1">Review in Progress</p>
      <p className="text-sm">
        Your application is being verified. This typically takes 1-3 business
        days. We'll notify you via email once the process is complete.
      </p>
    </AlertDescription>
  </Alert>
);

/**
 * Approved Notice Component
 * Shows success message and available features
 */
const ApprovedNotice = ({ kycData }) => (
  <div className="space-y-4">
    <Alert className="border-secondary/30 bg-secondary/5">
      <CheckCircle className="h-4 w-4 text-secondary" />
      <AlertDescription className="text-secondary ml-2">
        <p className="font-semibold mb-1">Verification Complete</p>
        <p className="text-sm">
          You can now invest in tokenized real estate assets on our platform.
        </p>
      </AlertDescription>
    </Alert>

    {kycData?.listerVerification?.status === "approved" && (
      <Alert className="border-primary/30 bg-primary/5">
        <Shield className="h-4 w-4 text-primary" />
        <AlertDescription className="text-foreground ml-2">
          <p className="font-semibold mb-1">Lister Verified</p>
          <p className="text-sm">
            You can now list and manage real estate properties on the platform.
          </p>
        </AlertDescription>
      </Alert>
    )}
  </div>
);

/**
 * Expired Notice Component
 * Shows KYC expiration with resubmission option
 */
const ExpiredNotice = ({ onResubmit }) => (
  <Alert className="border-accent/30 bg-accent/5">
    <AlertCircle className="h-4 w-4 text-accent" />
    <AlertDescription className="text-accent-foreground ml-2">
      <p className="font-semibold mb-2">Verification Expired</p>
      <p className="text-sm mb-4">
        Your KYC verification has expired. Please resubmit your application to
        continue using the platform.
      </p>
      <Button
        onClick={onResubmit}
        size="sm"
        className="bg-accent text-accent-foreground hover:bg-accent/90"
      >
        Resubmit Application
      </Button>
    </AlertDescription>
  </Alert>
);

/**
 * KYCStatusCard Component
 * Displays KYC verification status, timeline, and submitted information.
 * Shows different states: pending, approved, rejected, or expired.
 *
 * @param {string} status - KYC status (pending, approved, rejected, expired)
 * @param {Object} kycData - Complete KYC data including personal, address, and document info
 * @param {Function} onResubmit - Callback for resubmitting KYC application
 * @param {boolean} isLoading - Loading state indicator
 */
export function KYCStatusCard({
  status = KYC_STATUS.PENDING,
  kycData,
  onResubmit,
  isLoading = false,
}) {
  const config = useMemo(
    () => STATUS_CONFIG[status] || STATUS_CONFIG[KYC_STATUS.PENDING],
    [status]
  );
  const Icon = config.icon;

  const handleResubmit = useCallback(() => {
    onResubmit?.();
  }, [onResubmit]);

  if (isLoading) {
    return (
      <Card className="p-6 border-border bg-card">
        <div className="flex items-center justify-center gap-3 py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-foreground font-medium">Loading KYC status...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-border bg-card space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              KYC Verification
            </h2>
            <p className="text-sm text-muted-foreground">
              Identity verification status
            </p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Status Description */}
      <div className="p-4 bg-muted/30 rounded-lg border border-border">
        <p className="text-sm text-foreground">{config.description}</p>
      </div>

      {/* Timeline */}
      {kycData?.submittedAt && (
        <div className="p-4 bg-card border border-border rounded-lg">
          <StatusTimeline
            submittedAt={kycData.submittedAt}
            reviewedAt={kycData.reviewedAt}
            status={status}
          />
        </div>
      )}

      {/* Status-Specific Content */}
      {status === KYC_STATUS.PENDING && <PendingNotice />}

      {status === KYC_STATUS.APPROVED && <ApprovedNotice kycData={kycData} />}

      {status === KYC_STATUS.REJECTED && (
        <RejectionNotice
          reason={
            kycData?.rejectionReason ||
            "Your application did not meet our verification requirements."
          }
          onResubmit={handleResubmit}
        />
      )}

      {status === KYC_STATUS.EXPIRED && (
        <ExpiredNotice onResubmit={handleResubmit} />
      )}

      {/* Information Display */}
      {kycData && (
        <div className="border-t border-border pt-6">
          <InformationDisplaySection data={kycData} />
        </div>
      )}

      {/* Action Buttons */}
      <div className="border-t border-border pt-6 flex flex-col sm:flex-row gap-3">
        {status === KYC_STATUS.REJECTED || status === KYC_STATUS.EXPIRED ? (
          <Button
            onClick={handleResubmit}
            className="sm:flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Resubmit Application
          </Button>
        ) : status === KYC_STATUS.APPROVED ? (
          <Button
            disabled
            className="sm:flex-1 bg-secondary text-secondary-foreground"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Verified
          </Button>
        ) : null}

        <Button
          variant="outline"
          className="sm:flex-1 border-border text-foreground hover:bg-muted"
        >
          <FileText className="mr-2 h-4 w-4" />
          Download Receipt
        </Button>
      </div>
    </Card>
  );
}

export default KYCStatusCard;
