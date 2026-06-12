import PropTypes from "prop-types";
import {
  PROPERTY_STATUSES,
  WORKFLOW_STEPS,
} from "../../constants/propertyStatuses";

/**
 * PropertyWorkflowProgress Component
 * Displays a visual stepper showing the property lifecycle progress
 */
const PropertyWorkflowProgress = ({ property }) => {
  const currentStatus =
    property?.status || PROPERTY_STATUSES.PENDING_ASSIGNMENT;

  /**
   * Determine step state based on property status
   */
  const getStepState = (stepStatus) => {
    const statusOrder = [
      PROPERTY_STATUSES.PENDING_ASSIGNMENT,
      PROPERTY_STATUSES.VERIFICATION_PENDING,
      PROPERTY_STATUSES.VERIFIED,
      PROPERTY_STATUSES.TOKENIZED,
      PROPERTY_STATUSES.ACTIVE,
    ];

    const currentIndex = statusOrder.indexOf(currentStatus);
    const stepIndex = statusOrder.indexOf(stepStatus);

    if (property?.status === PROPERTY_STATUSES.REJECTED) {
      // Show rejection state
      if (stepIndex === 1) return "rejected"; // Show rejection at verification step
      if (stepIndex > 1) return "pending";
      return "completed";
    }

    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "current";
    return "pending";
  };

  /**
   * Get date for each workflow step
   */
  const getStepDate = (stepStatus) => {
    switch (stepStatus) {
      case PROPERTY_STATUSES.PENDING_ASSIGNMENT:
        return property?.createdAt
          ? new Date(property.createdAt).toLocaleDateString()
          : null;
      case PROPERTY_STATUSES.VERIFICATION_PENDING:
        return property?.assignedAt
          ? new Date(property.assignedAt).toLocaleDateString()
          : null;
      case PROPERTY_STATUSES.VERIFIED:
        return property?.verifiedAt
          ? new Date(property.verifiedAt).toLocaleDateString()
          : null;
      case PROPERTY_STATUSES.TOKENIZED:
        return property?.tokenizationTransactionHash ? "Tokenized" : null;
      case PROPERTY_STATUSES.ACTIVE:
        return property?.status === PROPERTY_STATUSES.ACTIVE ? "Active" : null;
      default:
        return null;
    }
  };

  /**
   * Get additional info for each step
   */
  const getStepInfo = (stepStatus) => {
    switch (stepStatus) {
      case PROPERTY_STATUSES.VERIFICATION_PENDING:
        if (property?.assignedVerifier) {
          return `${property.assignedVerifier.firstName} ${property.assignedVerifier.lastName}`;
        }
        return null;
      case PROPERTY_STATUSES.TOKENIZED:
        if (property?.nftTokenId) {
          return `NFT #${property.nftTokenId}`;
        }
        return null;
      default:
        return null;
    }
  };

  return (
    <div className="py-6">
      <nav aria-label="Progress">
        <ol className="space-y-4 md:flex md:space-x-8 md:space-y-0">
          {WORKFLOW_STEPS.map((step, stepIdx) => {
            const state = getStepState(step.status);
            const date = getStepDate(step.status);
            const info = getStepInfo(step.status);

            return (
              <li key={step.id} className="md:flex-1">
                <div
                  className={`group flex flex-col border-l-4 py-2 pl-4 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4 ${
                    state === "completed"
                      ? "border-emerald-600 hover:border-emerald-800"
                      : state === "current"
                        ? "border-blue-600"
                        : state === "rejected"
                          ? "border-red-600"
                          : "border-gray-200"
                  }`}
                >
                  <span
                    className={`text-sm font-medium ${
                      state === "completed"
                        ? "text-emerald-600"
                        : state === "current"
                          ? "text-blue-600"
                          : state === "rejected"
                            ? "text-red-600"
                            : "text-gray-500"
                    }`}
                  >
                    Step {step.id}
                  </span>
                  <span className="mt-1 flex items-center text-sm font-semibold">
                    <span className="mr-2 text-xl">{step.icon}</span>
                    <span
                      className={
                        state === "completed"
                          ? "text-gray-900"
                          : state === "current"
                            ? "text-blue-600"
                            : state === "rejected"
                              ? "text-red-600"
                              : "text-gray-500"
                      }
                    >
                      {step.name}
                    </span>
                  </span>

                  {/* Date */}
                  {date && (
                    <span className="mt-1 text-xs text-gray-500">{date}</span>
                  )}

                  {/* Additional Info */}
                  {info && (
                    <span className="mt-1 text-xs text-blue-600">{info}</span>
                  )}

                  {/* Status indicator */}
                  {state === "completed" && (
                    <span className="mt-2 flex items-center text-xs text-emerald-600">
                      <svg
                        className="mr-1 h-4 w-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Complete
                    </span>
                  )}

                  {state === "current" && (
                    <span className="mt-2 flex items-center text-xs text-blue-600">
                      <svg
                        className="mr-1 h-4 w-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      In Progress
                    </span>
                  )}

                  {state === "rejected" && (
                    <span className="mt-2 flex items-center text-xs text-red-600">
                      <svg
                        className="mr-1 h-4 w-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Rejected
                    </span>
                  )}

                  {state === "pending" && stepIdx > 0 && (
                    <span className="mt-2 text-xs text-muted-foreground">
                      Pending
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Rejection Notice */}
      {property?.status === PROPERTY_STATUSES.REJECTED &&
        property?.rejectionReason && (
          <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-destructive"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-destructive">
                  Property Rejected
                </h3>
                <div className="mt-2 text-sm text-destructive/90">
                  <p>{property.rejectionReason}</p>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

PropertyWorkflowProgress.propTypes = {
  property: PropTypes.shape({
    status: PropTypes.string,
    createdAt: PropTypes.string,
    assignedAt: PropTypes.string,
    verifiedAt: PropTypes.string,
    tokenizationTransactionHash: PropTypes.string,
    nftTokenId: PropTypes.number,
    rejectionReason: PropTypes.string,
    assignedVerifier: PropTypes.shape({
      firstName: PropTypes.string,
      lastName: PropTypes.string,
    }),
  }),
};

export default PropertyWorkflowProgress;
