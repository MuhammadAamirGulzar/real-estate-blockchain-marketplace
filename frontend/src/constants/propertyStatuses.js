/**
 * Property Status Constants
 * Defines all possible property lifecycle statuses
 */

export const PROPERTY_STATUSES = {
  AWAITING_BLOCKCHAIN: "awaiting_blockchain",
  PENDING_ASSIGNMENT: "pending_assignment",
  VERIFICATION_PENDING: "verification_pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
  TOKENIZED: "tokenized",
  ACTIVE: "active",
};

/**
 * Status display labels for UI
 */
export const STATUS_LABELS = {
  [PROPERTY_STATUSES.AWAITING_BLOCKCHAIN]: "Awaiting Blockchain",
  [PROPERTY_STATUSES.PENDING_ASSIGNMENT]: "Awaiting Verifier Assignment",
  [PROPERTY_STATUSES.VERIFICATION_PENDING]: "Under Verification",
  [PROPERTY_STATUSES.VERIFIED]: "Verified",
  [PROPERTY_STATUSES.REJECTED]: "Rejected",
  [PROPERTY_STATUSES.TOKENIZED]: "Tokenized",
  [PROPERTY_STATUSES.ACTIVE]: "Active",
};

/**
 * Status color codes for badges
 * Uses Tailwind CSS color classes
 */
export const STATUS_COLORS = {
  [PROPERTY_STATUSES.AWAITING_BLOCKCHAIN]: {
    bg: "bg-gray-100",
    text: "text-gray-800",
    border: "border-gray-300",
  },
  [PROPERTY_STATUSES.PENDING_ASSIGNMENT]: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    border: "border-yellow-300",
  },
  [PROPERTY_STATUSES.VERIFICATION_PENDING]: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-300",
  },
  [PROPERTY_STATUSES.VERIFIED]: {
    bg: "bg-green-100",
    text: "text-green-800",
    border: "border-green-300",
  },
  [PROPERTY_STATUSES.REJECTED]: {
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-300",
  },
  [PROPERTY_STATUSES.TOKENIZED]: {
    bg: "bg-purple-100",
    text: "text-purple-800",
    border: "border-purple-300",
  },
  [PROPERTY_STATUSES.ACTIVE]: {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-300",
  },
};

/**
 * Status descriptions for tooltips/help text
 */
export const STATUS_DESCRIPTIONS = {
  [PROPERTY_STATUSES.AWAITING_BLOCKCHAIN]:
    "Property is being registered on blockchain",
  [PROPERTY_STATUSES.PENDING_ASSIGNMENT]:
    "Property submitted, awaiting admin to assign a verifier",
  [PROPERTY_STATUSES.VERIFICATION_PENDING]:
    "Verifier has been assigned and is reviewing the property",
  [PROPERTY_STATUSES.VERIFIED]:
    "Property has been verified and is ready for tokenization",
  [PROPERTY_STATUSES.REJECTED]: "Property was rejected during verification",
  [PROPERTY_STATUSES.TOKENIZED]:
    "Property has been tokenized as an NFT with fractional tokens",
  [PROPERTY_STATUSES.ACTIVE]: "Property is active and open for investment",
};

/**
 * Get status badge classes
 * @param {string} status - Property status
 * @returns {string} Tailwind CSS classes for badge
 */
export const getStatusBadgeClasses = (status) => {
  const colors =
    STATUS_COLORS[status] ||
    STATUS_COLORS[PROPERTY_STATUSES.PENDING_ASSIGNMENT];
  return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`;
};

/**
 * Get status label
 * @param {string} status - Property status
 * @returns {string} Human-readable status label
 */
export const getStatusLabel = (status) => {
  return STATUS_LABELS[status] || status;
};

/**
 * Get status description
 * @param {string} status - Property status
 * @returns {string} Status description
 */
export const getStatusDescription = (status) => {
  return STATUS_DESCRIPTIONS[status] || "";
};

/**
 * Workflow step configuration
 * Used for progress indicators
 */
export const WORKFLOW_STEPS = [
  {
    id: 1,
    name: "Submitted",
    status: PROPERTY_STATUSES.PENDING_ASSIGNMENT,
    icon: "📝",
  },
  {
    id: 2,
    name: "Verifier Assigned",
    status: PROPERTY_STATUSES.VERIFICATION_PENDING,
    icon: "👤",
  },
  {
    id: 3,
    name: "Verified",
    status: PROPERTY_STATUSES.VERIFIED,
    icon: "✅",
  },
  {
    id: 4,
    name: "Tokenized",
    status: PROPERTY_STATUSES.TOKENIZED,
    icon: "🪙",
  },
  {
    id: 5,
    name: "Active",
    status: PROPERTY_STATUSES.ACTIVE,
    icon: "🚀",
  },
];
