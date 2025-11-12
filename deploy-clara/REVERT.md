# Rollback Instructions

If you need to revert to the original Client-only mode:

## Quick Rollback

1. Set `ENABLE_UNIFIED_MODE=false` in `.env`
2. Restart your Client dev server (if using separate servers)
3. The unified server will not interfere

## Full Rollback

If you want to completely remove unified server:

1. **Stop unified server** (if running):
```bash
# Kill any process on port 8080
```

2. **Remove unified mode flag**:
```bash
# In .env, ensure ENABLE_UNIFIED_MODE=false
```

3. **Run Client separately** (as before):
```bash
cd apps/client
npm run dev
```

4. **Optional: Remove server** (if you don't need it):
```bash
git rm -r apps/server
git rm -r packages
git commit -m "revert: remove unified server"
```

## Git History

All changes were committed separately:
- `feat(monorepo): move Client into apps/client`
- `feat(monorepo): import Staff interface`
- `feat(server): add unified server`
- etc.

You can revert specific commits:
```bash
git log --oneline
git revert <commit-hash>
```

## Restore Original Structure

If you want to move Client back to root:

```bash
git mv apps/client/* .
git rm -r apps
git commit -m "revert: restore original structure"
```

**Note**: This will lose monorepo benefits. Consider keeping monorepo and just disabling unified mode.

