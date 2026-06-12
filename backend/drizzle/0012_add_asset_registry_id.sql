-- Migration: Add missing id column to asset_registry table
-- Current state: asset_id is PRIMARY KEY
-- Target state: id is PRIMARY KEY, asset_id is UNIQUE
-- Dependencies: properties.asset_registry_id references asset_registry.asset_id

-- Step 1: Drop foreign key constraints that depend on asset_id primary key
ALTER TABLE properties 
DROP CONSTRAINT IF EXISTS properties_asset_registry_id_fkey;

ALTER TABLE properties 
DROP CONSTRAINT IF EXISTS properties_asset_registry_id_asset_registry_asset_id_fk;

-- Step 2: Add id column as serial
ALTER TABLE asset_registry 
ADD COLUMN IF NOT EXISTS id SERIAL;

-- Step 3: Drop existing primary key on asset_id
ALTER TABLE asset_registry 
DROP CONSTRAINT IF EXISTS asset_registry_pkey;

-- Step 4: Add primary key on id
ALTER TABLE asset_registry 
ADD CONSTRAINT asset_registry_pkey PRIMARY KEY (id);

-- Step 5: Add unique constraint on asset_id to maintain its uniqueness (safe if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'asset_registry_asset_id_unique' AND table_name = 'asset_registry'
  ) THEN
    ALTER TABLE asset_registry ADD CONSTRAINT asset_registry_asset_id_unique UNIQUE (asset_id);
  END IF;
END $$;

-- Step 6: Re-create foreign key constraint (safe if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'properties_asset_registry_id_asset_registry_asset_id_fk' AND table_name = 'properties'
  ) THEN
    ALTER TABLE properties 
    ADD CONSTRAINT properties_asset_registry_id_asset_registry_asset_id_fk 
    FOREIGN KEY (asset_registry_id) REFERENCES asset_registry(asset_id);
  END IF;
END $$;
