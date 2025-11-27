-- Drop the incorrect unique constraint on driver_code alone
ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_driver_code_key;

-- The correct constraint should be on (year, driver_number) which already exists
-- Verify constraints
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'drivers'::regclass;

