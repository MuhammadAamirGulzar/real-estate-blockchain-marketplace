import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUploadBox } from "@/components/ui/FileUploadBox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle,
  FileText,
  User,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const steps = [
  { id: 1, name: "Personal Details", icon: User },
  { id: 2, name: "Documents", icon: FileText },
  { id: 3, name: "Selfie Verification", icon: Camera },
  { id: 4, name: "Review & Submit", icon: CheckCircle },
];

export default function KYCFlow({ onComplete, initialData = {} }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [kycData, setKycData] = useState({
    personalDetails: {
      firstName: initialData?.personalDetails?.firstName || "",
      lastName: initialData?.personalDetails?.lastName || "",
      dateOfBirth: "",
      nationality: "",
      phoneNumber: "",
      address: "",
      city: "",
      postalCode: "",
      country: "",
    },
    documents: {
      idDocument: null,
      proofOfAddress: null,
    },
    selfieData: {
      selfieImage: null,
    },
  });

  const updatePersonalDetails = (field, value) => {
    setKycData((prev) => ({
      ...prev,
      personalDetails: { ...prev.personalDetails, [field]: value },
    }));
  };

  const updateDocument = (field, file) => {
    setKycData((prev) => ({
      ...prev,
      documents: { ...prev.documents, [field]: file },
    }));
  };

  const updateSelfie = (file) => {
    setKycData((prev) => ({
      ...prev,
      selfieData: { selfieImage: file },
    }));
  };

  const validateStep = (step) => {
    switch (step) {
      case 1: {
        const {
          firstName,
          lastName,
          dateOfBirth,
          nationality,
          phoneNumber,
          address,
          city,
          country,
        } = kycData.personalDetails;
        if (
          !firstName ||
          !lastName ||
          !dateOfBirth ||
          !nationality ||
          !phoneNumber ||
          !address ||
          !city ||
          !country
        ) {
          toast.error("Please fill in all required personal details");
          return false;
        }
        return true;
      }
      case 2: {
        if (
          !kycData.documents.idDocument ||
          !kycData.documents.proofOfAddress
        ) {
          toast.error("Please upload both required documents");
          return false;
        }
        return true;
      }
      case 3: {
        if (!kycData.selfieData.selfieImage) {
          toast.error("Please upload a selfie for verification");
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    console.log("🔘 KYC Submit button clicked");
    console.log("Current step:", currentStep);
    console.log("Current KYC Data:", {
      personalDetails: kycData.personalDetails,
      documents: {
        idDocument: kycData.documents.idDocument ? "Present" : "Missing",
        proofOfAddress: kycData.documents.proofOfAddress
          ? "Present"
          : "Missing",
      },
      selfie: kycData.selfieData.selfieImage ? "Present" : "Missing",
    });

    const step3Valid = validateStep(3);
    console.log("Step 3 validation result:", step3Valid);

    if (!step3Valid) {
      console.error("❌ Validation failed - cannot submit");
      toast.error("Please ensure all required information is provided");
      return;
    }

    console.log("✅ Validation passed, proceeding with submission");
    setIsSubmitting(true);

    try {
      // Create FormData object
      const formData = new FormData();

      // Append personal details
      Object.entries(kycData.personalDetails).forEach(([key, value]) => {
        formData.append(key, value);
      });

      // Append documents
      if (kycData.documents.idDocument) {
        formData.append("idDocument", kycData.documents.idDocument);
      }
      if (kycData.documents.proofOfAddress) {
        formData.append("proofOfAddress", kycData.documents.proofOfAddress);
      }

      // Append selfie
      if (kycData.selfieData.selfieImage) {
        formData.append("selfieImage", kycData.selfieData.selfieImage);
      }

      console.log("📤 Submitting KYC data...");
      await onComplete(formData);
      console.log("✅ KYC submission successful");
    } catch (error) {
      console.error("❌ KYC submission error:", error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to submit KYC application",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const captureSelfie = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "user"; // Use front camera on mobile
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) {
        updateSelfie(file);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-8">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                  currentStep >= step.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <step.icon className="w-6 h-6" />
              </div>
              <span
                className={`text-xs mt-2 ${
                  currentStep >= step.id
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {step.name}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-1 flex-1 mx-2 transition-all duration-200 ${
                  currentStep > step.id ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Personal Details */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Personal Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={kycData.personalDetails.firstName}
                  onChange={(e) =>
                    updatePersonalDetails("firstName", e.target.value)
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={kycData.personalDetails.lastName}
                  onChange={(e) =>
                    updatePersonalDetails("lastName", e.target.value)
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={kycData.personalDetails.dateOfBirth}
                  onChange={(e) =>
                    updatePersonalDetails("dateOfBirth", e.target.value)
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="nationality">Nationality *</Label>
                <Input
                  id="nationality"
                  placeholder="e.g., American, British"
                  value={kycData.personalDetails.nationality}
                  onChange={(e) =>
                    updatePersonalDetails("nationality", e.target.value)
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="phoneNumber">Phone Number *</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={kycData.personalDetails.phoneNumber}
                  onChange={(e) =>
                    updatePersonalDetails("phoneNumber", e.target.value)
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="postalCode">Postal Code *</Label>
                <Input
                  id="postalCode"
                  value={kycData.personalDetails.postalCode}
                  onChange={(e) =>
                    updatePersonalDetails("postalCode", e.target.value)
                  }
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Street Address *</Label>
              <Input
                id="address"
                value={kycData.personalDetails.address}
                onChange={(e) =>
                  updatePersonalDetails("address", e.target.value)
                }
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={kycData.personalDetails.city}
                  onChange={(e) =>
                    updatePersonalDetails("city", e.target.value)
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="country">Country *</Label>
                <Input
                  id="country"
                  value={kycData.personalDetails.country}
                  onChange={(e) =>
                    updatePersonalDetails("country", e.target.value)
                  }
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Documents */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Identity Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FileUploadBox
              label="Government-Issued ID"
              description="Upload passport, driver's license, or national ID card (JPG, PNG, or PDF - Max 10MB)"
              accept=".jpg,.jpeg,.png,.pdf"
              file={kycData.documents.idDocument}
              onChange={(file) => updateDocument("idDocument", file)}
              onRemove={() => updateDocument("idDocument", null)}
              required
            />

            <FileUploadBox
              label="Proof of Address"
              description="Upload utility bill, bank statement, or government document dated within last 3 months (JPG, PNG, or PDF - Max 10MB)"
              accept=".jpg,.jpeg,.png,.pdf"
              file={kycData.documents.proofOfAddress}
              onChange={(file) => updateDocument("proofOfAddress", file)}
              onRemove={() => updateDocument("proofOfAddress", null)}
              required
            />

            <div className="p-4 border rounded-lg bg-muted/50 border-border">
              <h4 className="mb-2 text-sm font-medium">
                Document Requirements:
              </h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• Documents must be clear and all text must be readable</li>
                <li>• All four corners of the document must be visible</li>
                <li>• Documents must be in color</li>
                <li>• No black and white copies or screenshots</li>
                <li>• Documents must be valid and not expired</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Selfie */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Selfie Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Take a selfie to verify your identity. Make sure your face is
                clearly visible and matches your ID document.
              </p>
            </div>

            <FileUploadBox
              label="Selfie Photo"
              description="Upload a clear photo of yourself or use camera to take a photo (JPG or PNG - Max 10MB)"
              accept="image/*"
              file={kycData.selfieData.selfieImage}
              onChange={(file) => updateSelfie(file)}
              onRemove={() => updateSelfie(null)}
              required
            />

            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={captureSelfie}
                className="w-full md:w-auto"
              >
                <Camera className="w-4 h-4 mr-2" />
                Take Photo with Camera
              </Button>
            </div>

            <div className="p-4 border rounded-lg bg-muted/50 border-border">
              <h4 className="mb-2 text-sm font-medium">Selfie Requirements:</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• Your face must be clearly visible and well-lit</li>
                <li>• Remove sunglasses, hats, or face coverings</li>
                <li>• Look directly at the camera</li>
                <li>• Ensure background is plain and uncluttered</li>
                <li>• Photo must match the ID document you uploaded</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review */}
      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Review & Submit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Personal Details</h3>
                <div className="p-4 space-y-2 text-sm rounded-lg bg-muted/50">
                  <p>
                    <span className="text-muted-foreground">Name:</span>{" "}
                    {kycData.personalDetails.firstName}{" "}
                    {kycData.personalDetails.lastName}
                  </p>
                  <p>
                    <span className="text-muted-foreground">
                      Date of Birth:
                    </span>{" "}
                    {kycData.personalDetails.dateOfBirth}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Phone:</span>{" "}
                    {kycData.personalDetails.phoneNumber}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Address:</span>{" "}
                    {kycData.personalDetails.address},{" "}
                    {kycData.personalDetails.city},{" "}
                    {kycData.personalDetails.country}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  Uploaded Documents
                </h3>
                <div className="p-4 space-y-2 text-sm rounded-lg bg-muted/50">
                  <p className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    Government ID: {kycData.documents.idDocument?.name}
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    Proof of Address: {kycData.documents.proofOfAddress?.name}
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    Selfie Photo: {kycData.selfieData.selfieImage?.name}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg bg-primary/10 border-primary/20">
              <p className="text-sm text-foreground">
                By submitting this application, you confirm that all information
                provided is accurate and you consent to identity verification.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1 || isSubmitting}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {currentStep < 4 ? (
          <Button onClick={handleNext}>
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={(e) => {
              console.log("🖱️ Submit button clicked!", {
                currentStep,
                isSubmitting,
                disabled: isSubmitting,
              });
              handleSubmit();
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit KYC Application"}
          </Button>
        )}
      </div>
    </div>
  );
}
