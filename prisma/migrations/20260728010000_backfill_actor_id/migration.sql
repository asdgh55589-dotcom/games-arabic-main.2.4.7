UPDATE notifications
SET actor_id = data->'actor'->>'id'
WHERE data->'actor'->>'id' IS NOT NULL
AND actor_id IS NULL;
