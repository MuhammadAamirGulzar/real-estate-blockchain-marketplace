import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import * as api from "@/services/api";
import { verificationService } from "@/services/verification.service";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle,
  ChevronRight,
  FileText,
  Home,
  Landmark,
  Loader2,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const PROPERTY_TYPES = [
  { value: "residential_apartment", label: "Residential Apartment" },
  { value: "villa", label: "Villa" },
  { value: "townhouse", label: "Townhouse" },
  { value: "studio", label: "Studio" },
  { value: "penthouse", label: "Penthouse" },
  { value: "commercial_office", label: "Commercial Office" },
  { value: "retail", label: "Retail Space" },
  { value: "industrial", label: "Industrial / Warehouse" },
  { value: "land", label: "Land / Plot" },
];

const AMENITY_OPTIONS = [
  "Swimming Pool",
  "Gym & Fitness",
  "24/7 Security",
  "Covered Parking",
  "Concierge Service",
  "Rooftop Terrace",
  "Smart Home System",
  "Pet Friendly",
  "Kids Play Area",
  "BBQ Area",
  "Business Lounge",
  "EV Charging Station",
];

const STEPS = [
  { n: 1, label: "Basic Info", icon: Building2 },
  { n: 2, label: "Specifications", icon: Home },
  { n: 3, label: "Financials", icon: Landmark },
  { n: 4, label: "Documents", icon: FileText },
  { n: 5, label: "Review", icon: CheckCircle },
];

const INITIAL = {
  title: "",
  propertyType: "",
  streetAddress: "",
  city: "",
  state: "",
  country: "",
  unitNumber: "",
  floorNumber: "",
  totalArea: "",
  bedrooms: "",
  bathrooms: "",
  yearBuilt: "",
  propertyCondition: "Good",
  amenities: [],
  propertyValue: "",
  monthlyRentalIncome: "",
  projectedRoi: "",
  titleDeedNumber: "",
  description: "",
  highlights: "",
};

export default function PropertySubmission() {
  const { user } = useAuth();
  const { account: walletAddress, signer } = useWallet();
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/user/dashboard");
  };

  const [step, setStep] = useState(1);
  const [data, setData] = useState(INITIAL);
  const [files, setFiles] = useState({
    photos: [],
    titleDeed: null,
    floorPlan: null,
    valuation: null,
    noc: null,
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (field, value) => {
    setData((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: "" }));
  };

  const toggleAmenity = (a) =>
    setData((p) => ({
      ...p,
      amenities: p.amenities.includes(a)
        ? p.amenities.filter((x) => x !== a)
        : [...p.amenities, a],
    }));

  const handleFileChange = (key, e) => {
    const f = e.target.files;
    if (key === "photos")
      setFiles((p) => ({ ...p, photos: Array.from(f).slice(0, 8) }));
    else setFiles((p) => ({ ...p, [key]: f[0] || null }));
  };

  const validateStep = () => {
    const e = {};
    if (step === 1) {
      if (!data.title.trim()) e.title = "Title is required";
      if (!data.propertyType) e.propertyType = "Select a property type";
      if (!data.streetAddress.trim())
        e.streetAddress = "Street address is required";
      if (!data.city.trim()) e.city = "City is required";
      if (!data.country.trim()) e.country = "Country is required";
    }
    if (step === 2) {
      if (!data.totalArea || Number(data.totalArea) <= 0)
        e.totalArea = "Total area is required";
    }
    if (step === 3) {
      if (!data.propertyValue || Number(data.propertyValue) <= 0)
        e.propertyValue = "Property value is required";
      if (!data.projectedRoi || Number(data.projectedRoi) <= 0)
        e.projectedRoi = "Projected ROI is required";
    }
    if (step === 4) {
      if (files.photos.length === 0)
        e.photos = "At least one property photo is required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validateStep()) setStep((s) => s + 1);
  };
  const prev = () => {
    setStep((s) => s - 1);
    setErrors({});
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let signature = null;
      if (walletAddress && signer) {
        const msg = `I confirm listing: ${data.title} at ${data.streetAddress}, ${data.city}`;
        signature = await signer.signMessage(msg);
      }
      const formData = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (Array.isArray(v)) formData.append(k, JSON.stringify(v));
        else if (v !== "") formData.append(k, v);
      });
      files.photos.forEach((f) => formData.append("photos", f));
      if (files.titleDeed) formData.append("titleDeed", files.titleDeed);
      if (files.floorPlan) formData.append("floorPlan", files.floorPlan);
      if (files.valuation) formData.append("valuation", files.valuation);
      if (files.noc) formData.append("noc", files.noc);
      if (signature) {
        formData.append("submissionSignature", signature);
        formData.append(
          "submissionMessage",
          `I confirm listing: ${data.title} at ${data.streetAddress}, ${data.city}`,
        );
      }

      const result = await api.listProperty(formData);
      const property = result?.property;

      // Call AssetRegistry.listProperty() with the user's own wallet.
      // This must be done from the frontend because the contract has onlyKYCApproved
      // and msg.sender must be the user (not the backend deployer key).
      if (signer && property?.metadataUrl) {
        try {
          toast.loading(
            "Confirming on blockchain — please approve in MetaMask...",
            { id: "onchain" },
          );
          const { transactionHash, onChainId } =
            await verificationService.listPropertyOnChain(
              property.metadataUrl,
              signer,
            );
          toast.loading("Saving blockchain confirmation...", { id: "onchain" });
          // Update backend with the on-chain ID and tx hash so the property
          // moves from awaiting_blockchain → pending_assignment and the admin
          // can assign a verifier without any reconciliation fallback.
          await api.default.post("/user/update-property-tx", {
            propertyId: property.id,
            transactionHash,
            assetRegistryId: onChainId,
          });
          toast.success("Property registered on blockchain!", {
            id: "onchain",
          });
        } catch (chainErr) {
          toast.warning(
            "Property saved, but blockchain registration failed: " +
              (chainErr.reason || chainErr.shortMessage || chainErr.message),
            { id: "onchain", duration: 6000 },
          );
        }
      }

      setSubmitted(true);
      toast.success("Property submitted for review!");
    } catch (err) {
      toast.error(
        err.response?.data?.message || err.message || "Submission failed",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-green-500/15 border border-green-500/25 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-2xl font-bold text-foreground">
              Property Submitted!
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your property has been submitted for review. Our team will verify
              the details and documents within 2–5 business days.
            </p>
          </div>
          <div className="p-4 bg-navy-700 border border-navy-500 rounded-xl text-left space-y-2">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
              What happens next?
            </p>
            {[
              "Property assigned to a licensed verifier",
              "Verifier reviews documents & details",
              "Admin approves and initiates tokenization",
              "Your property tokens go live on the marketplace",
            ].map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <div className="w-4 h-4 rounded-full bg-gold-400/15 border border-gold-400/25 flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-bold text-gold-400">
                    {i + 1}
                  </span>
                </div>
                {t}
              </div>
            ))}
          </div>
          <Button
            onClick={() => navigate("/user/dashboard")}
            className="w-full h-11 text-navy-900 font-bold"
            style={{
              background: "linear-gradient(135deg,#D4AF37 0%,#8C7020 100%)",
            }}
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-navy-500 bg-navy-900">
        <div className="container-max py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={handleBack}
                className="h-8 border-navy-500 bg-navy-800 text-foreground hover:bg-navy-700 inline-flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <h1 className="font-display text-xl font-bold text-foreground">
                List Your Property
              </h1>
              <p className="text-xs text-muted-foreground">
                Step {step} of {STEPS.length}
              </p>
            </div>
            {walletAddress && (
              <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1.5">
                <CheckCircle className="w-3 h-3" />
                Wallet connected
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container-max py-8">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-10 max-w-3xl mx-auto">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                    step > s.n
                      ? "bg-gold-400 border-gold-400"
                      : step === s.n
                        ? "border-gold-400 bg-gold-400/10"
                        : "border-navy-400 bg-navy-800"
                  }`}
                >
                  {step > s.n ? (
                    <CheckCircle className="w-4 h-4 text-navy-900" />
                  ) : (
                    <s.icon
                      className={`w-4 h-4 ${step === s.n ? "text-gold-400" : "text-navy-400"}`}
                    />
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium whitespace-nowrap hidden sm:block ${step === s.n ? "text-gold-400" : step > s.n ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-px mx-2 ${step > s.n ? "bg-gold-400" : "bg-navy-500"}`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="max-w-3xl mx-auto">
          <Card className="bg-navy-700 border-navy-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                {(() => {
                  const S = STEPS[step - 1];
                  return (
                    <>
                      <S.icon className="w-5 h-5 text-gold-400" />
                      {S.label}
                    </>
                  );
                })()}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              {/* STEP 1: Basic Info */}
              {step === 1 && (
                <div className="space-y-5">
                  <Field label="Property Title" error={errors.title} required>
                    <Input
                      value={data.title}
                      onChange={(e) => update("title", e.target.value)}
                      placeholder="e.g. Luxury 3-Bed Apartment, Downtown Dubai"
                      className="bg-navy-800 border-navy-500 text-foreground h-11 focus:border-gold-500"
                    />
                  </Field>

                  <Field
                    label="Property Type"
                    error={errors.propertyType}
                    required
                  >
                    <select
                      value={data.propertyType}
                      onChange={(e) => update("propertyType", e.target.value)}
                      className="w-full bg-navy-800 border border-navy-500 text-foreground rounded-md h-11 px-3 text-sm focus:outline-none focus:border-gold-500"
                    >
                      <option value="">Select property type...</option>
                      {PROPERTY_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label="Street Address"
                    error={errors.streetAddress}
                    required
                  >
                    <Input
                      value={data.streetAddress}
                      onChange={(e) => update("streetAddress", e.target.value)}
                      placeholder="123 Marina Walk"
                      className="bg-navy-800 border-navy-500 text-foreground h-11 focus:border-gold-500"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Unit / Apartment No.">
                      <Input
                        value={data.unitNumber}
                        onChange={(e) => update("unitNumber", e.target.value)}
                        placeholder="Apt 4B"
                        className="bg-navy-800 border-navy-500 text-foreground h-11 focus:border-gold-500"
                      />
                    </Field>
                    <Field label="Floor No.">
                      <Input
                        value={data.floorNumber}
                        onChange={(e) => update("floorNumber", e.target.value)}
                        placeholder="12"
                        type="number"
                        className="bg-navy-800 border-navy-500 text-foreground h-11 focus:border-gold-500"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="City" error={errors.city} required>
                      <Input
                        value={data.city}
                        onChange={(e) => update("city", e.target.value)}
                        placeholder="Dubai"
                        className="bg-navy-800 border-navy-500 text-foreground h-11 focus:border-gold-500"
                      />
                    </Field>
                    <Field label="State / Province">
                      <Input
                        value={data.state}
                        onChange={(e) => update("state", e.target.value)}
                        placeholder="Dubai"
                        className="bg-navy-800 border-navy-500 text-foreground h-11 focus:border-gold-500"
                      />
                    </Field>
                  </div>

                  <Field label="Country" error={errors.country} required>
                    <Input
                      value={data.country}
                      onChange={(e) => update("country", e.target.value)}
                      placeholder="United Arab Emirates"
                      className="bg-navy-800 border-navy-500 text-foreground h-11 focus:border-gold-500"
                    />
                  </Field>
                </div>
              )}

              {/* STEP 2: Specifications */}
              {step === 2 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-4">
                    <Field
                      label="Total Area (sqft)"
                      error={errors.totalArea}
                      required
                    >
                      <Input
                        value={data.totalArea}
                        onChange={(e) => update("totalArea", e.target.value)}
                        type="number"
                        min="0"
                        placeholder="1850"
                        className="bg-navy-800 border-navy-500 text-foreground h-11 focus:border-gold-500"
                      />
                    </Field>
                    <Field label="Bedrooms">
                      <Input
                        value={data.bedrooms}
                        onChange={(e) => update("bedrooms", e.target.value)}
                        type="number"
                        min="0"
                        max="20"
                        placeholder="3"
                        className="bg-navy-800 border-navy-500 text-foreground h-11 focus:border-gold-500"
                      />
                    </Field>
                    <Field label="Bathrooms">
                      <Input
                        value={data.bathrooms}
                        onChange={(e) => update("bathrooms", e.target.value)}
                        type="number"
                        min="0"
                        max="20"
                        placeholder="2"
                        className="bg-navy-800 border-navy-500 text-foreground h-11 focus:border-gold-500"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Year Built">
                      <Input
                        value={data.yearBuilt}
                        onChange={(e) => update("yearBuilt", e.target.value)}
                        type="number"
                        min="1900"
                        max="2025"
                        placeholder="2019"
                        className="bg-navy-800 border-navy-500 text-foreground h-11 focus:border-gold-500"
                      />
                    </Field>
                    <Field label="Property Condition">
                      <select
                        value={data.propertyCondition}
                        onChange={(e) =>
                          update("propertyCondition", e.target.value)
                        }
                        className="w-full bg-navy-800 border border-navy-500 text-foreground rounded-md h-11 px-3 text-sm focus:outline-none focus:border-gold-500"
                      >
                        {["Excellent", "Good", "Fair", "Needs Renovation"].map(
                          (c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ),
                        )}
                      </select>
                    </Field>
                  </div>

                  <Field label="Amenities & Features">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                      {AMENITY_OPTIONS.map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => toggleAmenity(a)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                            data.amenities.includes(a)
                              ? "border-gold-500/60 bg-gold-400/10 text-gold-300"
                              : "border-navy-500 bg-navy-800 text-muted-foreground hover:border-navy-300"
                          }`}
                        >
                          {data.amenities.includes(a) && (
                            <CheckCircle className="w-3 h-3 flex-shrink-0" />
                          )}
                          {a}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label="Property Description">
                    <Textarea
                      value={data.description}
                      onChange={(e) => update("description", e.target.value)}
                      placeholder="Describe the property, its key features, views, finishing quality..."
                      rows={4}
                      className="bg-navy-800 border-navy-500 text-foreground resize-none focus:border-gold-500"
                    />
                  </Field>
                </div>
              )}

              {/* STEP 3: Financials */}
              {step === 3 && (
                <div className="space-y-5">
                  <div className="p-4 bg-navy-800 border border-gold-500/20 rounded-xl text-sm text-muted-foreground">
                    Provide accurate financial data. This determines token
                    pricing and investor returns. Values are reviewed and
                    verified by our team before tokenization.
                  </div>

                  <Field
                    label="Property Asking Price (USD)"
                    error={errors.propertyValue}
                    required
                  >
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">
                        $
                      </span>
                      <Input
                        value={data.propertyValue}
                        onChange={(e) =>
                          update("propertyValue", e.target.value)
                        }
                        type="number"
                        min="0"
                        placeholder="1,500,000"
                        className="bg-navy-800 border-navy-500 text-foreground h-11 pl-7 focus:border-gold-500"
                      />
                    </div>
                  </Field>

                  <Field label="Monthly Rental Income (USD)">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">
                        $
                      </span>
                      <Input
                        value={data.monthlyRentalIncome}
                        onChange={(e) =>
                          update("monthlyRentalIncome", e.target.value)
                        }
                        type="number"
                        min="0"
                        placeholder="8,500"
                        className="bg-navy-800 border-navy-500 text-foreground h-11 pl-7 focus:border-gold-500"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Current or expected monthly rental income (gross)
                    </p>
                  </Field>

                  <Field
                    label="Projected Annual ROI (%)"
                    error={errors.projectedRoi}
                    required
                  >
                    <div className="relative">
                      <Input
                        value={data.projectedRoi}
                        onChange={(e) => update("projectedRoi", e.target.value)}
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="8.5"
                        className="bg-navy-800 border-navy-500 text-foreground h-11 pr-8 focus:border-gold-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        %
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Expected yearly return on investment (rental +
                      appreciation)
                    </p>
                  </Field>

                  <Field label="Title Deed / Registration Number">
                    <Input
                      value={data.titleDeedNumber}
                      onChange={(e) =>
                        update("titleDeedNumber", e.target.value)
                      }
                      placeholder="DXB-RES-2019-xxxxx"
                      className="bg-navy-800 border-navy-500 text-foreground h-11 focus:border-gold-500"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Official title deed or land registry number
                    </p>
                  </Field>

                  <Field label="Investment Highlights">
                    <Textarea
                      value={data.highlights}
                      onChange={(e) => update("highlights", e.target.value)}
                      placeholder="Key selling points for investors: prime location, rental demand, appreciation potential..."
                      rows={3}
                      className="bg-navy-800 border-navy-500 text-foreground resize-none focus:border-gold-500"
                    />
                  </Field>

                  {data.propertyValue && data.projectedRoi && (
                    <div className="p-4 bg-navy-800 border border-navy-500 rounded-xl space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                        Estimated Metrics
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Annual Return
                          </p>
                          <p className="text-base font-bold text-green-400">
                            $
                            {(
                              (Number(data.propertyValue) *
                                Number(data.projectedRoi)) /
                              100
                            ).toLocaleString("en-US", {
                              maximumFractionDigits: 0,
                            })}
                          </p>
                        </div>
                        {data.monthlyRentalIncome && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Annual Rental
                            </p>
                            <p className="text-base font-bold text-gold-400">
                              $
                              {(
                                Number(data.monthlyRentalIncome) * 12
                              ).toLocaleString("en-US")}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: Documents */}
              {step === 4 && (
                <div className="space-y-5">
                  <div className="p-4 bg-navy-800 border border-navy-500 rounded-xl text-sm text-muted-foreground">
                    All documents are encrypted and stored securely on IPFS.
                    Only verified verifiers can access them during review.
                  </div>

                  <Field
                    label="Property Photos (up to 8)"
                    error={errors.photos}
                    required
                  >
                    <label className="block cursor-pointer">
                      <div
                        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${files.photos.length > 0 ? "border-gold-500/40 bg-gold-400/5" : "border-navy-400 hover:border-navy-300"}`}
                      >
                        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        {files.photos.length > 0 ? (
                          <p className="text-sm font-medium text-foreground">
                            {files.photos.length} photo(s) selected
                          </p>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-foreground">
                              Click to upload photos
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              JPG, PNG, WebP · Max 8 files · 10MB each
                            </p>
                          </>
                        )}
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileChange("photos", e)}
                        />
                      </div>
                    </label>
                    {files.photos.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {files.photos.map((f, i) => (
                          <div
                            key={i}
                            className="text-xs bg-navy-800 border border-navy-500 rounded-lg px-2 py-1.5 text-muted-foreground flex items-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3 text-green-400" />
                            {f.name.slice(0, 20)}
                            {f.name.length > 20 ? "…" : ""}
                          </div>
                        ))}
                      </div>
                    )}
                  </Field>

                  {[
                    {
                      key: "titleDeed",
                      label: "Title Deed / Ownership Certificate",
                      required: true,
                    },
                    {
                      key: "floorPlan",
                      label: "Floor Plan (PDF)",
                      required: false,
                    },
                    {
                      key: "valuation",
                      label: "Independent Valuation Report",
                      required: false,
                    },
                    {
                      key: "noc",
                      label: "No Objection Certificate (NOC)",
                      required: false,
                    },
                  ].map((doc) => (
                    <Field
                      key={doc.key}
                      label={doc.label}
                      required={doc.required}
                    >
                      <label className="block cursor-pointer">
                        <div
                          className={`border border-dashed rounded-xl p-4 flex items-center gap-4 transition-colors ${files[doc.key] ? "border-gold-500/40 bg-gold-400/5" : "border-navy-400 hover:border-navy-300"}`}
                        >
                          <FileText className="w-6 h-6 text-muted-foreground flex-shrink-0" />
                          {files[doc.key] ? (
                            <span className="text-sm text-foreground font-medium">
                              {files[doc.key].name}
                            </span>
                          ) : (
                            <>
                              <span className="text-sm text-muted-foreground">
                                Click to upload PDF
                              </span>
                            </>
                          )}
                          {files[doc.key] && (
                            <CheckCircle className="w-4 h-4 text-green-400 ml-auto" />
                          )}
                          <input
                            type="file"
                            accept=".pdf,application/pdf"
                            className="hidden"
                            onChange={(e) => handleFileChange(doc.key, e)}
                          />
                        </div>
                      </label>
                    </Field>
                  ))}
                </div>
              )}

              {/* STEP 5: Review */}
              {step === 5 && (
                <div className="space-y-5">
                  <ReviewSection title="Property Information">
                    <ReviewRow label="Title" value={data.title} />
                    <ReviewRow
                      label="Type"
                      value={
                        PROPERTY_TYPES.find(
                          (t) => t.value === data.propertyType,
                        )?.label || data.propertyType
                      }
                    />
                    <ReviewRow
                      label="Address"
                      value={[
                        data.streetAddress,
                        data.unitNumber,
                        data.city,
                        data.state,
                        data.country,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    />
                  </ReviewSection>
                  <ReviewSection title="Specifications">
                    <ReviewRow
                      label="Area"
                      value={
                        data.totalArea
                          ? `${Number(data.totalArea).toLocaleString()} sqft`
                          : "—"
                      }
                    />
                    <ReviewRow label="Bedrooms" value={data.bedrooms || "—"} />
                    <ReviewRow
                      label="Bathrooms"
                      value={data.bathrooms || "—"}
                    />
                    <ReviewRow
                      label="Year Built"
                      value={data.yearBuilt || "—"}
                    />
                    <ReviewRow
                      label="Condition"
                      value={data.propertyCondition}
                    />
                    {data.amenities.length > 0 && (
                      <ReviewRow
                        label="Amenities"
                        value={data.amenities.join(", ")}
                      />
                    )}
                  </ReviewSection>
                  <ReviewSection title="Financials">
                    <ReviewRow
                      label="Asking Price"
                      value={
                        data.propertyValue
                          ? `$${Number(data.propertyValue).toLocaleString()}`
                          : "—"
                      }
                    />
                    <ReviewRow
                      label="Monthly Rental"
                      value={
                        data.monthlyRentalIncome
                          ? `$${Number(data.monthlyRentalIncome).toLocaleString()}`
                          : "—"
                      }
                    />
                    <ReviewRow
                      label="Projected ROI"
                      value={data.projectedRoi ? `${data.projectedRoi}%` : "—"}
                    />
                    <ReviewRow
                      label="Title Deed No."
                      value={data.titleDeedNumber || "—"}
                    />
                  </ReviewSection>
                  <ReviewSection title="Documents">
                    <ReviewRow
                      label="Photos"
                      value={`${files.photos.length} file(s) selected`}
                    />
                    <ReviewRow
                      label="Title Deed"
                      value={files.titleDeed?.name || "Not uploaded"}
                    />
                    <ReviewRow
                      label="Floor Plan"
                      value={files.floorPlan?.name || "Not uploaded"}
                    />
                    <ReviewRow
                      label="Valuation"
                      value={files.valuation?.name || "Not uploaded"}
                    />
                  </ReviewSection>

                  {!walletAddress && (
                    <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-400">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      No wallet connected. Property will be submitted without a
                      blockchain signature.
                    </div>
                  )}

                  <div className="p-4 bg-navy-800 border border-navy-500 rounded-xl text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground text-sm mb-2">
                      By submitting, you confirm:
                    </p>
                    <p>
                      • You are the legal owner or authorized agent for this
                      property
                    </p>
                    <p>
                      • All information and documents provided are accurate and
                      genuine
                    </p>
                    <p>
                      • You agree to our property listing terms and verification
                      process
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t border-navy-500">
                <Button
                  variant="outline"
                  onClick={prev}
                  disabled={step === 1 || isSubmitting}
                  className="border-navy-400 text-foreground hover:bg-navy-600"
                >
                  Previous
                </Button>

                {step < 5 ? (
                  <Button
                    onClick={next}
                    className="text-navy-900 font-semibold gap-2"
                    style={{
                      background:
                        "linear-gradient(135deg,#D4AF37 0%,#8C7020 100%)",
                    }}
                  >
                    Next Step <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="text-navy-900 font-semibold gap-2"
                    style={{
                      background:
                        "linear-gradient(135deg,#D4AF37 0%,#8C7020 100%)",
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />{" "}
                        Submitting...
                      </>
                    ) : (
                      "Submit Property"
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, error, required }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-foreground text-sm font-medium">
        {label}
        {required && <span className="text-gold-400 ml-1">*</span>}
      </Label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}

function ReviewSection({ title, children }) {
  return (
    <div className="bg-navy-800 border border-navy-500 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-navy-700 border-b border-navy-500">
        <p className="text-xs font-semibold text-gold-400 uppercase tracking-wide">
          {title}
        </p>
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground flex-shrink-0">{label}</span>
      <span className="text-foreground text-right">{value}</span>
    </div>
  );
}
