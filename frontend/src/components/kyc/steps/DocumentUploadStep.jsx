import React, { useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Upload, FileText, CheckCircle, X, Eye } from 'lucide-react';

const DocumentUploadStep = ({ data, errors, onUpdate }) => {
  const documents = data.documents || {};
  const [previews, setPreviews] = useState({});

  const handleFileUpload = (documentType, file) => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews(prev => ({
          ...prev,
          [documentType]: e.target.result
        }));
      };
      reader.readAsDataURL(file);

      onUpdate({
        documents: {
          ...documents,
          [documentType]: file
        }
      });
    }
  };

  const removeFile = (documentType) => {
    const newDocuments = { ...documents };
    delete newDocuments[documentType];
    
    const newPreviews = { ...previews };
    delete newPreviews[documentType];
    
    onUpdate({ documents: newDocuments });
    setPreviews(newPreviews);
  };

  const DocumentUploadCard = ({ 
    type, 
    title, 
    description, 
    acceptedFormats = ".jpg,.jpeg,.png,.pdf",
    required = false 
  }) => {
    const hasFile = documents[type];
    const hasError = errors[type];

    return (
      <Card className={`card-base ${hasError ? 'border-destructive' : hasFile ? 'border-success' : ''}`}>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <Label className={`label-base ${required ? 'label-required' : ''}`}>
                  {title}
                </Label>
                <p className="text-caption">{description}</p>
              </div>
              {hasFile && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(type)}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {!hasFile ? (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 smooth-transition">
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Drag and drop your file here, or click to browse
                </p>
                <input
                  type="file"
                  accept={acceptedFormats}
                  onChange={(e) => handleFileUpload(type, e.target.files[0])}
                  className="hidden"
                  id={`upload-${type}`}
                />
                <label htmlFor={`upload-${type}`}>
                  <Button variant="outline" className="cursor-pointer">
                    Choose File
                  </Button>
                </label>
                <p className="text-xs text-muted-foreground mt-2">
                  Supported formats: {acceptedFormats.replace(/\./g, '').toUpperCase()}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-success/5 border border-success/20 rounded-lg">
                  <FileText className="w-5 h-5 text-success" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-success">
                      {documents[type].name}
                    </p>
                    <p className="text-xs text-success/70">
                      {(documents[type].size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  {previews[type] && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(previews[type], '_blank')}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept={acceptedFormats}
                    onChange={(e) => handleFileUpload(type, e.target.files[0])}
                    className="hidden"
                    id={`replace-${type}`}
                  />
                  <label htmlFor={`replace-${type}`}>
                    <Button variant="outline" size="sm" className="cursor-pointer">
                      Replace File
                    </Button>
                  </label>
                </div>
              </div>
            )}

            {hasError && (
              <p className="text-destructive text-sm">{errors[type]}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <FileText className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-title">Document Verification</h3>
        <p className="text-muted-foreground">
          Upload clear, high-quality images of your identification documents
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DocumentUploadCard
          type="idDocument"
          title="Government-Issued ID"
          description="Passport, driver's license, or national ID card"
          required={true}
        />
        
        <DocumentUploadCard
          type="proofOfAddress"
          title="Proof of Address"
          description="Utility bill, bank statement, or lease agreement (within 3 months)"
          required={true}
        />
      </div>

      <Card className="bg-accent/5 border-accent/20">
        <CardContent className="p-4">
          <div className="space-y-3">
            <h4 className="font-semibold text-accent">Document Requirements</h4>
            <ul className="space-y-2 text-sm text-accent/80">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                Documents must be clear and fully visible
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                All four corners of the document must be visible
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                Documents must be current and not expired
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                File size should not exceed 10MB per document
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentUploadStep;