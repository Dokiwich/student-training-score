SELECT code, COUNT(*) as cnt FROM criteria WHERE is_active = 1 GROUP BY code HAVING COUNT(*) > 1 ORDER BY code;
