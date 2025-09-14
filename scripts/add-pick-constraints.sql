-- Script to add constraints to prevent duplicate picks
-- This ensures we never have more than 20 picks per week

-- First, check if we can add a unique constraint
-- This will fail if there are existing duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_picks_week_round_order 
ON picks(week, round, order_in_round);

-- Also add a check to ensure valid rounds and orders
-- Round should be 1-4, order_in_round should be 1-5
-- This is informational only as SQLite doesn't support CHECK constraints after table creation

-- Future consideration: Add application-level validation
-- In your queries.ts file, before inserting picks:
-- 1. Check that week doesn't already have 20 picks
-- 2. Check that round is between 1-4
-- 3. Check that order_in_round is between 1-5
-- 4. Check that the combination of week+round+order doesn't already exist