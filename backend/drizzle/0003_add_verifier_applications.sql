-- Create verifier_applications table via Drizzle migration
CREATE TABLE IF NOT EXISTS verifier_applications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    experience TEXT NOT NULL,
    qualifications TEXT NOT NULL,
    specialization VARCHAR(255) NOT NULL,
    documents_hash VARCHAR(255),
    wallet_address VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_verifier_applications_user_id ON verifier_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_verifier_applications_status ON verifier_applications(status);

-- Ensure properties has assigned_verifier_id for admin assignment workflow
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS assigned_verifier_id INTEGER REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_properties_assigned_verifier ON properties(assigned_verifier_id);
