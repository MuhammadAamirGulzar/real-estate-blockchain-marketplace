import React from 'react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Card, CardContent } from '../../ui/card';
import { User, Calendar, Globe, MapPin } from 'lucide-react';

const PersonalDetailsStep = ({ data, errors, onUpdate }) => {
  const personalDetails = data.personalDetails || {};

  const handleChange = (field, value) => {
    onUpdate({
      personalDetails: {
        ...personalDetails,
        [field]: value
      }
    });
  };

  const countries = [
    'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany',
    'France', 'Japan', 'Singapore', 'UAE', 'Switzerland', 'Other'
  ];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <User className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-title">Personal Information</h3>
        <p className="text-muted-foreground">
          Please provide your personal details as they appear on your official documents
        </p>
      </div>

      <Card className="card-base">
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="label-base label-required">First Name</Label>
              <Input
                className={errors.firstName ? 'input-error' : 'input-base'}
                placeholder="Enter your first name"
                value={personalDetails.firstName || ''}
                onChange={(e) => handleChange('firstName', e.target.value)}
              />
              {errors.firstName && (
                <p className="text-destructive text-sm">{errors.firstName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="label-base label-required">Last Name</Label>
              <Input
                className={errors.lastName ? 'input-error' : 'input-base'}
                placeholder="Enter your last name"
                value={personalDetails.lastName || ''}
                onChange={(e) => handleChange('lastName', e.target.value)}
              />
              {errors.lastName && (
                <p className="text-destructive text-sm">{errors.lastName}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="label-base label-required flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Date of Birth
            </Label>
            <Input
              type="date"
              className={errors.dateOfBirth ? 'input-error' : 'input-base'}
              value={personalDetails.dateOfBirth || ''}
              onChange={(e) => handleChange('dateOfBirth', e.target.value)}
              max={new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
            />
            {errors.dateOfBirth && (
              <p className="text-destructive text-sm">{errors.dateOfBirth}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="label-base label-required flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Nationality
            </Label>
            <select
              className={errors.nationality ? 'input-error' : 'input-base'}
              value={personalDetails.nationality || ''}
              onChange={(e) => handleChange('nationality', e.target.value)}
            >
              <option value="">Select your nationality</option>
              {countries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
            {errors.nationality && (
              <p className="text-destructive text-sm">{errors.nationality}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PersonalDetailsStep;