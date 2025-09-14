-- Script to fix duplicate Week 2 picks
-- This script safely removes duplicates while preserving actual picks

-- First, let's see what we're dealing with
SELECT 'Current Week 2 picks count:' as info;
SELECT COUNT(*) as total_picks FROM picks WHERE week = 2;

SELECT 'Picks by round and order:' as info;
SELECT round, order_in_round, COUNT(*) as count, GROUP_CONCAT(id) as pick_ids
FROM picks 
WHERE week = 2 
GROUP BY round, order_in_round
HAVING COUNT(*) > 1;

-- Show all Week 2 picks with their details
SELECT 'All Week 2 picks:' as info;
SELECT id, round, order_in_round, user_id, team_id, 
       CASE WHEN team_id IS NOT NULL THEN 'HAS TEAM' ELSE 'NO TEAM' END as status
FROM picks 
WHERE week = 2 
ORDER BY round, order_in_round, id;

-- Create a temporary table with the picks we want to keep
-- Priority: Keep picks with team_id filled, then keep lowest ID
CREATE TEMP TABLE IF NOT EXISTS picks_to_keep AS
SELECT MIN(id) as id
FROM (
    SELECT id, round, order_in_round, user_id, team_id
    FROM picks
    WHERE week = 2
    ORDER BY 
        round, 
        order_in_round,
        CASE WHEN team_id IS NOT NULL THEN 0 ELSE 1 END,  -- Prioritize picks with teams
        id  -- Then by lowest ID
) 
GROUP BY round, order_in_round
LIMIT 20;

-- Show what we're keeping
SELECT 'Picks we will keep (should be 20):' as info;
SELECT COUNT(*) FROM picks_to_keep;

-- Show what we're deleting
SELECT 'Picks to delete:' as info;
SELECT id, round, order_in_round, user_id, team_id
FROM picks 
WHERE week = 2 
  AND id NOT IN (SELECT id FROM picks_to_keep)
ORDER BY round, order_in_round;

-- Delete the duplicates (COMMENTED OUT FOR SAFETY - UNCOMMENT TO EXECUTE)
-- DELETE FROM picks 
-- WHERE week = 2 
--   AND id NOT IN (SELECT id FROM picks_to_keep);

-- Verify the result
SELECT 'Final Week 2 picks count (after deletion):' as info;
SELECT COUNT(*) as total_picks FROM picks WHERE week = 2;

-- Clean up
DROP TABLE IF EXISTS picks_to_keep;