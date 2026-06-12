import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  Check,
  FileImage,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

/**
 * Bank Proof Upload Component
 * Handles file upload for bank transfer proofs with IPFS integration
 */

const ALLOWED_FILE_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "application/pdf": [".pdf"],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const BankProofUpload = ({
  investmentId,
  paymentReference,
  onUploadSuccess,
  onUploadError,
  className = "",
}) => {
  const [file, setFile] = useState(null);
  const [transactionRef, setTransactionRef] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setUploadError(null);

    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.file.size > MAX_FILE_SIZE) {
        setUploadError("File size must be less than 10MB");
      } else {
        setUploadError(
          "Invalid file type. Only JPEG, PNG, and PDF are allowed",
        );
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ALLOWED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: 1,
    disabled: uploading || uploadSuccess,
  });

  const handleUpload = async () => {
    if (!file) {
      setUploadError("Please select a file");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("documentFile", file);
      formData.append("investmentId", investmentId);
      if (transactionRef) {
        formData.append("transactionReference", transactionRef);
      }

      const token = localStorage.getItem("authToken");
      const response = await fetch("/api/payments/upload-proof", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const data = await response.json();
      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error(data.error || data.message || "Upload failed");
      }

      setUploadSuccess(true);
      if (onUploadSuccess) {
        onUploadSuccess(data);
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError(error.message);
      if (onUploadError) {
        onUploadError(error);
      }
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setUploadProgress(0);
    setUploadError(null);
  };

  const FileIcon = file?.type === "application/pdf" ? FileText : FileImage;

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Payment Proof
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Payment Reference Display */}
          <div className="bg-muted p-3 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">
              Payment Reference
            </div>
            <div className="font-mono font-semibold">{paymentReference}</div>
          </div>

          {/* Transaction Reference Input */}
          <div className="space-y-2">
            <Label htmlFor="transaction-ref">
              Bank Transaction Reference (Optional)
            </Label>
            <Input
              id="transaction-ref"
              placeholder="e.g., TXN123456789"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              disabled={uploading || uploadSuccess}
            />
            <p className="text-xs text-muted-foreground">
              Your bank's transaction ID or reference number, if available
            </p>
          </div>

          {/* File Upload Area */}
          {!uploadSuccess && (
            <div>
              <Label>Upload Document</Label>
              <div
                {...getRootProps()}
                className={`mt-2 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <input {...getInputProps()} />
                {!file ? (
                  <div className="space-y-2">
                    <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                    {isDragActive ? (
                      <p className="text-sm text-primary font-medium">
                        Drop the file here...
                      </p>
                    ) : (
                      <>
                        <p className="text-sm font-medium">
                          Drag & drop your payment proof here
                        </p>
                        <p className="text-xs text-muted-foreground">
                          or click to browse files
                        </p>
                      </>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Supported: JPEG, PNG, PDF (Max 10MB)
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-4">
                    <FileIcon className="w-10 h-10 text-primary" />
                    <div className="text-left flex-1">
                      <div className="font-medium text-sm">{file.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                    {!uploading && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile();
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Uploading to IPFS...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}

          {/* Error Message */}
          {uploadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {uploadSuccess && (
            <Alert className="border-emerald-500/30 bg-emerald-500/10">
              <Check className="h-4 w-4 text-emerald-400" />
              <AlertDescription className="text-foreground">
                <strong>Upload successful!</strong> Your payment proof has been
                submitted for verification. You will be notified once it's
                reviewed.
              </AlertDescription>
            </Alert>
          )}

          {/* Upload Button */}
          {!uploadSuccess && (
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              size="lg"
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Proof
                </>
              )}
            </Button>
          )}

          {/* Instructions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Important:</strong> Ensure your document clearly shows:
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Transaction amount and currency</li>
                <li>Payment reference: {paymentReference}</li>
                <li>Transaction date and time</li>
                <li>Beneficiary account details</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default BankProofUpload;
