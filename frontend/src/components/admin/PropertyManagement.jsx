import PropertyWorkflowProgress from "@/components/common/PropertyWorkflowProgress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PROPERTY_STATUSES,
  getStatusBadgeClasses,
  getStatusLabel,
} from "@/constants/propertyStatuses";
import { useWallet } from "@/contexts/WalletContext";
import api from "@/services/api";
import {
  Building2,
  Calendar,
  Coins,
  DollarSign,
  ExternalLink,
  Eye,
  FileText,
  MapPin,
  Search,
  User,
  UserCheck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const PropertyManagement = ({
  statusFilter: initialStatusFilter = "all",
  onUpdate,
}) => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [verifiers, setVerifiers] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(null);
  const [assigningVerifier, setAssigningVerifier] = useState(false);
  const [selectedVerifierId, setSelectedVerifierId] = useState("");
  const [assignmentNotes, setAssignmentNotes] = useState("");

  const { signer, account } = useWallet();

  // Update statusFilter when prop changes
  useEffect(() => {
    setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  useEffect(() => {
    fetchProperties();
    fetchVerifiers();
  }, [statusFilter]);

  const fetchProperties = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);

      const response = await api.get(`/admin/properties?${params}`);
      if (response.data.success) {
        setProperties(response.data.properties);
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
      toast.error("Failed to fetch properties");
    } finally {
      setLoading(false);
    }
  };

  const fetchVerifiers = async () => {
    try {
      const response = await api.get("/admin/verifiers");
      if (response.data.success) {
        setVerifiers(response.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching verifiers:", error);
    }
  };

  // Pattern B: Frontend signs authorization message, backend executes blockchain transaction
  // This matches the platform architecture used by all other admin functions
  const handleAssignVerifier = async (property) => {
    if (!selectedVerifierId) {
      toast.error("Please select a verifier");
      return;
    }

    if (!signer || !account) {
      toast.error("Please connect your wallet");
      return;
    }

    const loadingToast = toast.loading("Assigning verifier...");
    setAssigningVerifier(true);

    try {
      // Generate authorization message for backend verification
      const message = `Action: assign_verifier\nTarget ID: ${property.id}\nTimestamp: ${Date.now()}`;

      console.log("🔏 Requesting signature for verifier assignment");
      const signature = await signer.signMessage(message);

      console.log("🔄 Sending assignment request to backend", {
        propertyId: property.id,
        verifierId: selectedVerifierId,
      });

      toast.loading("Executing transaction...", { id: loadingToast });

      // Backend executes blockchain transaction and updates database atomically
      const response = await api.post(
        `/admin/property/${property.id}/assign-verifier`,
        {
          verifierId: selectedVerifierId,
          signature,
          walletAddress: account,
          message,
        },
      );

      if (response.data.success) {
        toast.success("Verifier assigned successfully!", { id: loadingToast });
        setShowAssignModal(null);
        setSelectedVerifierId("");
        setAssignmentNotes("");
        fetchProperties(); // Refresh list
        if (onUpdate) onUpdate(); // Notify parent to update stats
      }
    } catch (error) {
      console.error("Error assigning verifier:", error);
      if (error.code === "ACTION_REJECTED" || error.code === 4001) {
        toast.error("Signature rejected", { id: loadingToast });
      } else {
        const errorMessage =
          error.response?.data?.message ||
          error.message ||
          "Failed to assign verifier";
        toast.error(errorMessage, { id: loadingToast });
      }
    } finally {
      setAssigningVerifier(false);
    }
  };

  const filteredProperties = properties.filter((property) => {
    const matchesSearch =
      property.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.lister?.email?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const getStatusBadge = (status) => {
    const classes = getStatusBadgeClasses(status);
    const label = getStatusLabel(status);

    return <Badge className={classes}>{label}</Badge>;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span>Property Management</span>
          </CardTitle>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {filteredProperties.length} properties
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search properties..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value={PROPERTY_STATUSES.PENDING_ASSIGNMENT}>
                Pending Assignment
              </SelectItem>
              <SelectItem value={PROPERTY_STATUSES.VERIFICATION_PENDING}>
                Under Verification
              </SelectItem>
              <SelectItem value={PROPERTY_STATUSES.VERIFIED}>
                Verified
              </SelectItem>
              <SelectItem value={PROPERTY_STATUSES.REJECTED}>
                Rejected
              </SelectItem>
              <SelectItem value={PROPERTY_STATUSES.TOKENIZED}>
                Tokenized
              </SelectItem>
              <SelectItem value={PROPERTY_STATUSES.ACTIVE}>Active</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Properties Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProperties.map((property) => (
            <Card
              key={property.id}
              className="border-0 shadow-md hover:shadow-lg transition-shadow"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                      {property.title}
                    </h3>
                    <div className="flex items-center text-sm text-slate-600 dark:text-slate-400 mb-2">
                      <MapPin className="w-3 h-3 mr-1" />
                      {property.location}
                    </div>
                  </div>
                  {getStatusBadge(property.status)}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Property Value
                    </span>
                    <div className="flex items-center text-lg font-semibold text-slate-900 dark:text-white">
                      <DollarSign className="w-4 h-4 mr-1" />
                      {formatCurrency(property.propertyValue)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Listed By
                    </span>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {property.lister?.firstName && property.lister?.lastName
                        ? `${property.lister.firstName} ${property.lister.lastName}`
                        : property.listerEmail || "Unknown"}
                    </div>
                  </div>

                  {property.assignedVerifier && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        Verifier
                      </span>
                      <div className="text-sm font-medium text-purple-600 dark:text-purple-400">
                        {property.assignedVerifier.firstName}{" "}
                        {property.assignedVerifier.lastName}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Created
                    </span>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {new Date(property.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {property.hasSubmissionSignature && (
                    <div className="flex items-center justify-center py-2">
                      <Badge variant="outline" className="text-xs">
                        Digitally Signed
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSelectedProperty(property)}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    View Details
                  </Button>

                  {(property.status === PROPERTY_STATUSES.PENDING_ASSIGNMENT ||
                    property.status ===
                      PROPERTY_STATUSES.AWAITING_BLOCKCHAIN) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowAssignModal(property)}
                    >
                      <UserCheck className="w-3 h-3 mr-1" />
                      Assign Verifier
                    </Button>
                  )}

                  {property.status === PROPERTY_STATUSES.VERIFIED && (
                    <Button
                      size="sm"
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      onClick={() => navigate("/admin/tokenization")}
                    >
                      <Coins className="w-3 h-3 mr-1" />
                      Tokenize
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredProperties.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No properties found
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Try adjusting your search or filter criteria.
            </p>
          </div>
        )}

        {/* Enhanced Property Details Modal */}
        {selectedProperty && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <Card className="w-full max-w-4xl my-8">
              <CardHeader className="flex items-center justify-between flex-row border-b">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  {selectedProperty.title}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProperty(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-6 max-h-[calc(90vh-8rem)] overflow-y-auto p-6">
                {/* Workflow Progress */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                    Workflow Progress
                  </h4>
                  <PropertyWorkflowProgress property={selectedProperty} />
                </div>

                {/* Property Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Location
                      </h4>
                      <p className="text-slate-900 dark:text-white flex items-center">
                        <MapPin className="w-4 h-4 mr-2 text-blue-600" />
                        {selectedProperty.location}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Property Value
                      </h4>
                      <p className="text-slate-900 dark:text-white text-lg font-semibold flex items-center">
                        <DollarSign className="w-5 h-5 mr-1 text-green-600" />
                        {formatCurrency(selectedProperty.propertyValue)}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Property Type
                      </h4>
                      <p className="text-slate-700 dark:text-slate-300">
                        {selectedProperty.propertyType || "N/A"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Owner
                      </h4>
                      <p className="text-slate-900 dark:text-white flex items-center">
                        <User className="w-4 h-4 mr-2 text-purple-600" />
                        {selectedProperty.lister?.firstName &&
                        selectedProperty.lister?.lastName
                          ? `${selectedProperty.lister.firstName} ${selectedProperty.lister.lastName}`
                          : selectedProperty.listerEmail || "Unknown"}
                      </p>
                      {selectedProperty.lister?.email && (
                        <p className="text-xs text-slate-500 ml-6">
                          {selectedProperty.lister.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Status
                      </h4>
                      <div>{getStatusBadge(selectedProperty.status)}</div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Created
                      </h4>
                      <p className="text-slate-700 dark:text-slate-300 flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-slate-500" />
                        {new Date(selectedProperty.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                    Description
                  </h4>
                  <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                    {selectedProperty.description || "No description provided"}
                  </p>
                </div>

                {/* Verifier Information */}
                {selectedProperty.assignedVerifier && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-200 mb-2">
                      Assigned Verifier
                    </h4>
                    <p className="text-purple-700 dark:text-purple-300">
                      {selectedProperty.assignedVerifier.firstName}{" "}
                      {selectedProperty.assignedVerifier.lastName}
                    </p>
                    {selectedProperty.assignedAt && (
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                        Assigned on{" "}
                        {new Date(
                          selectedProperty.assignedAt,
                        ).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Documents */}
                {selectedProperty.documents &&
                  selectedProperty.documents.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
                        Documents
                      </h4>
                      <div className="space-y-2">
                        {selectedProperty.documents.map((doc, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-600" />
                              <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">
                                  {doc.fileName || "Document"}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {doc.documentType || "supporting_document"}
                                </p>
                              </div>
                            </div>
                            {doc.ipfsUrl && (
                              <a
                                href={doc.ipfsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                              >
                                <span className="text-xs">View</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Blockchain Information */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
                    Blockchain Information
                  </h4>
                  <div className="space-y-2">
                    {selectedProperty.listingTransactionHash && (
                      <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          Listing TX
                        </span>
                        <span className="text-xs font-mono text-slate-900 dark:text-white">
                          {selectedProperty.listingTransactionHash.substring(
                            0,
                            10,
                          )}
                          ...
                        </span>
                      </div>
                    )}
                    {selectedProperty.assetRegistryId && (
                      <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          Asset Registry ID
                        </span>
                        <span className="text-xs font-mono text-slate-900 dark:text-white">
                          {selectedProperty.assetRegistryId.toString()}
                        </span>
                      </div>
                    )}
                    {selectedProperty.verificationTransactionHash && (
                      <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          Verification TX
                        </span>
                        <span className="text-xs font-mono text-slate-900 dark:text-white">
                          {selectedProperty.verificationTransactionHash.substring(
                            0,
                            10,
                          )}
                          ...
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={() => setSelectedProperty(null)}
                >
                  Close
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Verifier Assignment Modal */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl">
              <CardHeader className="flex items-center justify-between flex-row border-b">
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-purple-600" />
                  Assign Verifier
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAssignModal(null);
                    setSelectedVerifierId("");
                    setAssignmentNotes("");
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                {/* Property Summary */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Property
                  </h4>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {showAssignModal.title}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {showAssignModal.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {formatCurrency(showAssignModal.propertyValue)}
                    </span>
                  </div>
                </div>

                {/* Select Verifier */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Select Verifier *
                  </label>
                  <Select
                    value={selectedVerifierId}
                    onValueChange={setSelectedVerifierId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a verifier..." />
                    </SelectTrigger>
                    <SelectContent>
                      {verifiers.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No verifiers available
                        </SelectItem>
                      ) : (
                        verifiers.map((verifier) => (
                          <SelectItem
                            key={verifier.id}
                            value={verifier.id.toString()}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span>
                                {verifier.firstName} {verifier.lastName}
                              </span>
                              <span className="text-xs text-slate-500 ml-2">
                                {verifier.email}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  {/* Selected Verifier Details */}
                  {selectedVerifierId &&
                    verifiers.find(
                      (v) => v.id === parseInt(selectedVerifierId),
                    ) && (
                      <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        {(() => {
                          const verifier = verifiers.find(
                            (v) => v.id === parseInt(selectedVerifierId),
                          );
                          return (
                            <>
                              <p className="text-sm font-medium text-purple-900 dark:text-purple-200">
                                {verifier.firstName} {verifier.lastName}
                              </p>
                              <p className="text-xs text-purple-700 dark:text-purple-300">
                                {verifier.email}
                              </p>
                              {verifier.walletAddress && (
                                <p className="text-xs text-purple-600 dark:text-purple-400 font-mono mt-1">
                                  {verifier.walletAddress}
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                </div>

                {/* Assignment Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Assignment Notes (Optional)
                  </label>
                  <textarea
                    value={assignmentNotes}
                    onChange={(e) => setAssignmentNotes(e.target.value)}
                    placeholder="Add any special instructions or notes for the verifier..."
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
                    rows={3}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowAssignModal(null);
                      setSelectedVerifierId("");
                      setAssignmentNotes("");
                    }}
                    disabled={assigningVerifier}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                    onClick={() => handleAssignVerifier(showAssignModal)}
                    disabled={!selectedVerifierId || assigningVerifier}
                  >
                    {assigningVerifier ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Assign Verifier
                      </>
                    )}
                  </Button>
                </div>

                {/* Info Notice */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    💡 Your wallet will prompt you to sign the transaction for
                    assigning this verifier on the blockchain.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Coming Soon Section */}
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
                <Coins className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                  Advanced Property Features
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Coming soon to enhance property management
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-800/50 rounded-lg p-3">
                <p className="font-medium text-slate-900 dark:text-white text-sm">
                  Automated Tokenization
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Smart contract integration for seamless property tokenization
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800/50 rounded-lg p-3">
                <p className="font-medium text-slate-900 dark:text-white text-sm">
                  Revenue Distribution
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Automatic dividend payments to token holders
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};

export default PropertyManagement;
