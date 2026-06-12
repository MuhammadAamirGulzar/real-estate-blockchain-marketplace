import React, { useState, useRef } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Camera, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

const SelfieVerificationStep = ({ data, errors, onUpdate }) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const selfieData = data.selfieData || {};

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsCapturing(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
        onUpdate({
          selfieData: {
            ...selfieData,
            selfieImage: file,
            timestamp: new Date().toISOString()
          }
        });
        stopCamera();
      }, 'image/jpeg', 0.8);
    }
  };

  const retakeSelfie = () => {
    onUpdate({
      selfieData: {
        ...selfieData,
        selfieImage: null,
        timestamp: null
      }
    });
    startCamera();
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <Camera className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-title">Selfie Verification</h3>
        <p className="text-muted-foreground">
          Take a clear selfie to verify your identity
        </p>
      </div>

      <div className="max-w-md mx-auto">
        <Card className="card-base">
          <CardContent className="p-6 space-y-6">
            {!selfieData.selfieImage ? (
              <div className="space-y-4">
                {!isCapturing ? (
                  <div className="text-center space-y-4">
                    <div className="w-48 h-48 mx-auto bg-muted rounded-full flex items-center justify-center">
                      <Camera className="w-16 h-16 text-muted-foreground" />
                    </div>
                    <Button onClick={startCamera} className="btn-primary w-full">
                      <Camera className="w-4 h-4 mr-2" />
                      Start Camera
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full rounded-lg"
                        style={{ transform: 'scaleX(-1)' }}
                      />
                      <div className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none">
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-60 border-2 border-primary rounded-full opacity-50"></div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={capturePhoto} className="btn-primary flex-1">
                        <Camera className="w-4 h-4 mr-2" />
                        Capture
                      </Button>
                      <Button onClick={stopCamera} variant="outline">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-48 h-48 mx-auto bg-success/10 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle className="w-16 h-16 text-success" />
                  </div>
                  <p className="text-success font-medium">Selfie captured successfully!</p>
                  <p className="text-caption">Your selfie has been saved for verification</p>
                </div>
                <Button onClick={retakeSelfie} variant="outline" className="w-full">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retake Selfie
                </Button>
              </div>
            )}

            {errors.selfieImage && (
              <div className="flex items-center gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <p className="text-destructive text-sm">{errors.selfieImage}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-secondary/5 border-secondary/20">
        <CardContent className="p-4">
          <div className="space-y-3">
            <h4 className="font-semibold text-secondary">Selfie Guidelines</h4>
            <ul className="space-y-2 text-sm text-secondary/80">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
                Look directly at the camera
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
                Ensure good lighting on your face
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
                Remove sunglasses and hats
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
                Keep a neutral expression
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default SelfieVerificationStep;