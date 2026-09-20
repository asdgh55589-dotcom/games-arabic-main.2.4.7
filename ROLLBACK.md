# Rollback Procedure — Games Arabic

## Quick Rollback (container)

```bash
# 1. Stop the current deployment
docker stop games-arabic

# 2. Switch to the previous known-good commit
git checkout <previous-commit>

# 3. Rebuild
docker build -t games-arabic:rollback .

# 4. Start (secrets from file, never baked into the image)
docker run -d --name games-arabic --env-file .env -p 3000:3000 games-arabic:rollback
```

## Database Rollback

Migrations run during `bun run build` (`prisma migrate deploy`). To inspect
and revert:

```bash
# List migration status
npx prisma migrate status

# Mark a migration as rolled back (after restoring the DB backup)
npx prisma migrate resolve --rolled-back <migration-name>
```

> Always snapshot the database before deploying a migration that alters
> existing tables. Code rollback without a DB restore only works for
> additive migrations.

## Notes

- `.env` / `.env.local` are gitignored and NOT part of any image — a code
  rollback never touches production secrets.
- Known-good commits: Phase 1 merge `826bdbc`, Phase 2 merge `2d63842`.
- Verify after rollback: `curl localhost:3000/api/health` → `{"data":{"status":"ok"}}`.
