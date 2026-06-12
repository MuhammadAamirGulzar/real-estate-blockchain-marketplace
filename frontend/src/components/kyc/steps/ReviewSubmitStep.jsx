import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { CheckCircle, User, FileText, Camera, Calendar, Globe, MapPin, Phone } from 'lucide-react';

const ReviewSubmitStep = ({ data }) => {
  const { personalDetails, documents, selfieData } = data;

  const formatDate = (dateString) => {
    if (!dateString) return 'Not provided';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const ReviewSection = ({ title, icon: Icon, children, completed = true }) => (
    <Card className="card-base">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            completed ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
          }`}>
            {completed ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
          </div>
          {title}
          {completed && <Badge variant="success" className="ml-auto">Complete</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  );

  const InfoRow = ({ label, value, icon: Icon }) => (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="w-4 h-4" />}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-medium text-foreground">{value || 'Not provided'}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-title">Review Your Information</h3>
        <p className="text-muted-foreground">
          Please review all information before submitting your KYC application
        </p>
      </div>

      <div className="space-y-6">
        {/* Personal Details Review */}
        <ReviewSection title="Personal Information" icon={User} completed={!!personalDetails?.firstName}>
          <div className="space-y-0">
            <InfoRow 
              label="Full Name" 
              value={`${personalDetails?.firstName || ''} ${personalDetails?.lastName || ''}`.trim()}
              icon={User}
            />
            <InfoRow 
              label="Date of Birth" 
              value={formatDate(personalDetails?.dateOfBirth)}
              icon={Calendar}
            />
            <InfoRow 
              label="Nationality" 
              value={personalDetails?.nationality}
              icon={Globe}
            />
            {personalDetails?.streetAddress && (
              <InfoRow 
                label="Address" 
                value={`${personalDetails.streetAddress}, ${personalDetails.city || ''} ${personalDetails.state || ''} ${personalDetails.postalCode || ''}`.trim()}
                icon={MapPin}
              />
            )}
            {personalDetails?.phoneNumber && (
              <InfoRow 
                label="Phone Number" 
                value={personalDetails.phoneNumber}
                icon={Phone}
              />
            )}
          </div>
        </ReviewSection>

        {/* Documents Review */}
        <ReviewSection title="Document Verification" icon={FileText} completed={!!documents?.idDocument}>
          <div className="space-y-4">
            {documents?.idDocument && (
              <div className="flex items-center justify-between p-3 bg-success/5 border border-success/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-success" />
                  <div>
                    <p className="text-sm font-medium text-success">Government-Issued ID</p>
                    <p className="text-xs text-success/70">{documents.idDocument.name}</p>
                  </div>
                </div>
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
            )}
            
            {documents?.proofOfAddress && (
              <div className="flex items-center justify-between p-3 bg-success/5 border border-success/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-success" />
                  <div>
                    <p className="text-sm font-medium text-success">Proof of Address</p>
                    <p className="text-xs text-success/70">{documents.proofOfAddress.name}</p>
                  </div>
                </div>
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
            )}
          </div>
        </ReviewSection>

        {/* Selfie Review */}
        <ReviewSection title="Selfie Verification" icon={Camera} completed={!!selfieData?.selfieImage}>
          {selfieData?.selfieImage ? (
            <div className="flex items-center justify-between p-3 bg-success/5 border border-success/20 rounded-lg">
              <div className="flex items-center gap-3">
                <Camera className="w-5 h-5 text-success" />
                <div>
                  <p className="text-sm font-medium text-success">Selfie Captured</p>
                  <p className="text-xs text-success/70">
                    Taken on {formatDate(selfieData.timestamp)}
                  </p>
                </div>
              </div>
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No selfie captured</p>
          )}
        </ReviewSection>
      </div>

      {/* Terms and Conditions */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="space-y-4">
            <h4 className="font-semibold text-primary">Terms and Conditions</h4>
            <div className="space-y-3 text-sm text-primary/80">
              <p>By submitting this KYC application, you confirm that:</p>
              <ul className="space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  All information provided is accurate and truthful
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  You consent to the processing of your personal data
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  You agree to our Terms of Service and Privacy Policy
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  You understand that false information may result in account suspension
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Processing Information */}
      <Card className="bg-accent/5 border-accent/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 bg-accent rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-accent-foreground text-xs font-bold">i</span>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-accent">Processing Time</p>
              <p className="text-sm text-accent/80">
                Your KYC application will be reviewed within 1-3 business days. 
                You will receive an email notification once the review is complete.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReviewSubmitStep;