import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle, FileText, Loader2 } from "lucide-react";
import { useCallback, useMemo } from "react";

// Constants
const DOCUMENT_TYPES = {
  PASSPORT: "passport",
  DRIVERS_LICENSE: "drivers_license",
  NATIONAL_ID: "national_id",
  VISA: "visa",
};

const DOCUMENT_TYPE_LABELS = {
  passport: "Passport",
  drivers_license: "Driver's License",
  national_id: "National ID Card",
  visa: "Visa/Travel Document",
};

const SUPPORTED_FILE_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const DOCUMENT_REQUIREMENTS = {
  passport: "Valid passport with at least 6 months validity",
  drivers_license: "Valid government-issued driver license",
  national_id: "Valid national identification card",
  visa: "Valid visa or travel document",
};

/**
 * Form Field Component
 * Reusable form field with label, input, and error display
 */
const FormField = ({ label, error, children, required = false }) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium text-foreground">
      {label}
      {required && <span className="text-destructive ml-1">*</span>}
    </Label>
    {children}
    {error && (
      <div className="flex items-center gap-2 mt-1.5">
        <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
        <p className="text-xs text-destructive">{error}</p>
      </div>
    )}
  </div>
);

/**
 * Document Type Selector Component
 * Displays document type selection with descriptions
 */
const DocumentTypeSelector = ({ value, onChange, error }) => (
  <FormField label="Document Type" error={error} required>
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger className="border-border bg-input text-foreground">
        <SelectValue placeholder="Select a document type" />
      </SelectTrigger>
      <SelectContent className="border-border bg-card">
        {Object.entries(DOCUMENT_TYPES).map(([key, value]) => (
          <SelectItem key={value} value={value} className="text-foreground">
            {DOCUMENT_TYPE_LABELS[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {value && (
      <p className="text-xs text-muted-foreground mt-1.5">
        {DOCUMENT_REQUIREMENTS[value]}
      </p>
    )}
  </FormField>
);

/**
 * File Upload Component
 * Handles document file upload with validation
 */
const FileUploadField = ({ value, onChange, error, documentType }) => {
  const handleFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];

      if (!file) {
        return;
      }

      // Validate file type
      if (!SUPPORTED_FILE_TYPES.includes(file.type)) {
        onChange({ error: "Please upload a JPG, PNG, or PDF file" });
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        onChange({
          error: "File size must be less than 5MB",
        });
        return;
      }

      onChange({ file, error: null });
    },
    [onChange]
  );

  return (
    <FormField label="Upload Document" error={error} required>
      <div className="space-y-3">
        <label className="flex items-center justify-center gap-3 p-4 sm:p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
          <div className="flex flex-col items-center gap-1">
            <FileText className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {value?.file?.name || "Click to upload or drag and drop"}
            </span>
            <span className="text-xs text-muted-foreground">
              JPG, PNG or PDF (max 5MB)
            </span>
          </div>
          <input
            type="file"
            accept={SUPPORTED_FILE_TYPES.join(",")}
            onChange={handleFileChange}
            className="hidden"
            required
          />
        </label>

        {value?.file && !error && (
          <div className="flex items-center gap-2 p-3 bg-secondary/5 border border-secondary/20 rounded-md">
            <CheckCircle className="h-4 w-4 text-secondary flex-shrink-0" />
            <span className="text-xs text-foreground">
              {value.file.name} ready to upload
            </span>
          </div>
        )}
      </div>
    </FormField>
  );
};

/**
 * Information Section Component
 * Displays section header with description
 */
const FormSection = ({ title, description, children }) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      )}
    </div>
    <div className="space-y-4">{children}</div>
  </div>
);

/**
 * KycForm Component
 * Comprehensive KYC verification form with personal information and document upload.
 * Supports international government-issued identification documents.
 *
 * @param {Object} state - Form state containing formData and errors
 * @param {Object} dispatch - Dispatcher for state updates
 * @param {Object} mutation - React Query mutation object for form submission
 */
export const KycForm = ({ state, dispatch, mutation }) => {
  const { formData, errors } = state;

  // Memoize document type options
  const documentOptions = useMemo(
    () =>
      Object.entries(DOCUMENT_TYPES).map(([key, value]) => ({
        value,
        label: DOCUMENT_TYPE_LABELS[value],
      })),
    []
  );

  // Handle text input changes
  const handleInputChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      dispatch({
        type: "UPDATE_FIELD",
        payload: { [name]: value },
      });
    },
    [dispatch]
  );

  // Handle document type selection
  const handleDocumentTypeChange = useCallback(
    (value) => {
      dispatch({
        type: "UPDATE_FIELD",
        payload: { documentType: value },
      });
    },
    [dispatch]
  );

  // Handle file upload
  const handleFileChange = useCallback(
    (fileData) => {
      dispatch({
        type: "UPDATE_FIELD",
        payload: {
          documentFile: fileData.file || null,
          documentFileError: fileData.error || null,
        },
      });
    },
    [dispatch]
  );

  // Handle form submission
  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();

      // Validate required fields
      if (
        !formData.fullName ||
        !formData.dob ||
        !formData.documentType ||
        !formData.address ||
        !formData.documentId ||
        !formData.documentFile
      ) {
        dispatch({
          type: "SET_ERRORS",
          payload: {
            fullName: formData.fullName ? "" : "Full name is required",
            dob: formData.dob ? "" : "Date of birth is required",
            documentType: formData.documentType
              ? ""
              : "Document type is required",
            address: formData.address ? "" : "Address is required",
            documentId: formData.documentId ? "" : "Document ID is required",
            documentFile: formData.documentFile
              ? ""
              : "Document upload is required",
          },
        });
        return;
      }

      mutation.mutate(formData);
    },
    [formData, mutation, dispatch]
  );

  const isSubmitting = mutation.isPending;
  const hasError = mutation.isError;

  return (
    <div className="w-full space-y-6">
      {/* Error Alert */}
      {hasError && (
        <Alert className="border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive ml-2">
            {mutation.error?.message ||
              "Failed to submit KYC form. Please try again."}
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-border bg-card">
        <CardHeader className="space-y-2 border-b border-border">
          <CardTitle className="text-2xl text-foreground">
            KYC Verification
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Submit your information for identity verification. All data is
            encrypted and secure.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Personal Information Section */}
            <FormSection
              title="Personal Information"
              description="Please provide your full legal name and date of birth"
            >
              <FormField label="Full Name" error={errors.fullName} required>
                <Input
                  name="fullName"
                  value={formData.fullName || ""}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  className="border-border bg-input text-foreground placeholder:text-muted-foreground"
                  disabled={isSubmitting}
                  required
                />
              </FormField>

              <FormField label="Date of Birth" error={errors.dob} required>
                <Input
                  name="dob"
                  type="date"
                  value={formData.dob || ""}
                  onChange={handleInputChange}
                  className="border-border bg-input text-foreground"
                  disabled={isSubmitting}
                  required
                />
              </FormField>
            </FormSection>

            {/* Address Information Section */}
            <FormSection
              title="Address Information"
              description="Provide your current residential address"
            >
              <FormField label="Full Address" error={errors.address} required>
                <Input
                  name="address"
                  value={formData.address || ""}
                  onChange={handleInputChange}
                  placeholder="123 Main St, Anytown, State 12345, Country"
                  className="border-border bg-input text-foreground placeholder:text-muted-foreground"
                  disabled={isSubmitting}
                  required
                />
              </FormField>
            </FormSection>

            {/* Document Information Section */}
            <FormSection
              title="Document Information"
              description="Government-issued identification documents accepted worldwide"
            >
              <DocumentTypeSelector
                value={formData.documentType || ""}
                onChange={handleDocumentTypeChange}
                error={errors.documentType}
              />

              <FormField
                label="Document ID Number"
                error={errors.documentId}
                required
              >
                <Input
                  name="documentId"
                  value={formData.documentId || ""}
                  onChange={handleInputChange}
                  placeholder="ABC123456789"
                  className="border-border bg-input text-foreground placeholder:text-muted-foreground"
                  disabled={isSubmitting}
                  required
                />
              </FormField>
            </FormSection>

            {/* Document Upload Section */}
            <FormSection title="Document Verification">
              <FileUploadField
                value={
                  formData.documentFile ? { file: formData.documentFile } : null
                }
                onChange={handleFileChange}
                error={errors.documentFile || formData.documentFileError}
                documentType={formData.documentType}
              />
            </FormSection>

            {/* Information Notice */}
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-foreground leading-relaxed">
                ✓ Your information is encrypted and stored securely
              </p>
              <p className="text-xs text-foreground leading-relaxed mt-1">
                ✓ Verification typically completes within 24 hours
              </p>
              <p className="text-xs text-foreground leading-relaxed mt-1">
                ✓ We comply with international KYC/AML regulations
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 h-11 font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit for Review</span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default KycForm;
