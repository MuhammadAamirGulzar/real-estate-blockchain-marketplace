-- Migration 0018: Add missing property detail columns to match schema.js
-- These columns are defined in schema.js but missing from all prior migrations

ALTER TABLE properties ADD COLUMN IF NOT EXISTS street_address VARCHAR(500);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS unit_number VARCHAR(50);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS floor_number INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS total_area NUMERIC(12, 2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS bedrooms INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS bathrooms INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS year_built INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_condition VARCHAR(50);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS amenities TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS image_urls TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS highlights TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS title_deed_number VARCHAR(200);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS monthly_rental_income NUMERIC(18, 2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS projected_roi NUMERIC(8, 4);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS token_price NUMERIC(18, 8);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS tokens_sold NUMERIC(36, 18) DEFAULT 0;
