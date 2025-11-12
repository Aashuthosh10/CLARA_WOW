# Baseline Updates (`baseline-updates`)

Commit reference: `12a29cf` — *chore: set new baseline after upstream sync*

This document captures the state that should be restored whenever a **revert** is requested.

## Key Application Updates

- **Client**
  - `apps/client/index.html`
  - `apps/client/index.tsx`
  - `apps/client/src/services/CallService.ts`
  - `apps/client/public/assets/svit-logo.png`
- **Server**
  - `apps/server/src/index.ts`
  - `apps/server/src/routes/calls.ts`
  - `apps/server/src/routes/staff.ts`
  - `apps/server/src/socket.ts`
- **Staff Interface**
  - `apps/staff/components/Dashboard.tsx`
  - `apps/staff/services/StaffRTC.ts`

## Automated Test Additions

Extensive Socket.IO, WebRTC, and timetable coverage added under `testsprite_tests/`, including:

- `TC020` through `TC034` scenario tests
- `run_all_tests.py`
- Shared helpers in `testsprite_tests/test_utils/`
- Supporting reports in `testsprite_tests/tmp/`

## Revert Instructions

To restore this baseline:

```bash
git reset --hard baseline-updates
# or
git reset --hard 12a29cf
```

This resets the repository to the fully updated state described above.

