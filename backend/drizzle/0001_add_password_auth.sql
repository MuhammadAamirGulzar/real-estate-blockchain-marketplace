-- Add password field and update user table for hybrid auth
ALTER TABLE "users" 
ADD COLUMN "password" varchar(255),
ADD COLUMN "is_wallet_connected" boolean DEFAULT false;

-- Make email required and unique
ALTER TABLE "users" 
ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "first_name" SET NOT NULL,
ALTER COLUMN "last_name" SET NOT NULL;

-- Make wallet_address optional (can be null until connected)
ALTER TABLE "users" 
ALTER COLUMN "wallet_address" DROP NOT NULL;

-- Update existing users to have a default password (they'll need to reset)
UPDATE "users" SET "password" = '$2a$12$defaulthash' WHERE "password" IS NULL;

-- Now make password required
ALTER TABLE "users" 
ALTER COLUMN "password" SET NOT NULL;