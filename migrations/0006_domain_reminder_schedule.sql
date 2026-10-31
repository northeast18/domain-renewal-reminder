-- Add multi-node reminder days schedule column to domains table
ALTER TABLE domains ADD COLUMN reminder_days_schedule TEXT;
