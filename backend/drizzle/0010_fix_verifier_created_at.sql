-- Fix verifier_applications missing created_at column
-- The table has submitted_at but schema.js expects created_at

ALTER TABLE verifier_applications 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW() NOT NULL;

-- Copy submitted_at to created_at for existing rows if both exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='verifier_applications' AND column_name='submitted_at'
    ) THEN
        UPDATE verifier_applications 
        SET created_at = submitted_at 
        WHERE created_at IS NULL;
    END IF;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Added created_at column to verifier_applications';
END $$;
