-- Cleanup duplicate races (keep the one with lowest id)
DELETE FROM races
WHERE id NOT IN (
    SELECT MIN(id)
    FROM races
    GROUP BY year, round
);

-- Verify cleanup
SELECT year, COUNT(*) as race_count 
FROM races 
GROUP BY year 
ORDER BY year;

