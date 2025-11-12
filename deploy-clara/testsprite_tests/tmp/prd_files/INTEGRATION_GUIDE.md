# Integration Guide - Production WebRTC System

## Quick Start

### 1. Update Server Index

Add to `apps/server/src/index.ts`:

```typescript
import { CallRepository } from './repositories/CallRepository.js';
import { StaffAvailabilityRepository } from './repositories/StaffAvailabilityRepository.js';
import { TimeoutWorker } from './workers/TimeoutWorker.js';
import { createCallRoutes } from './routes/calls.js';
import { createStaffRoutes } from './routes/staff.js';

// Replace old callRepo initialization
const callRepo = new CallRepository();
const availabilityRepo = new StaffAvailabilityRepository();

// Add routes
app.use('/api', createCallRoutes(callRepo, availabilityRepo, io));
app.use('/api', createStaffRoutes(availabilityRepo));

// Start timeout worker
const timeoutWorker = new TimeoutWorker(callRepo, io);
timeoutWorker.start();

// On shutdown
process.on('SIGINT', () => {
  timeoutWorker.stop();
  callRepo.close();
  availabilityRepo.close();
  process.exit(0);
});
```

### 2. Update Socket Handlers

Update `apps/server/src/socket.ts` to use new event names:
- `call.initiated` (instead of `call:incoming`)
- `call.accepted`
- `call.declined`
- `call.canceled`
- `call.missed`
- `call.ended`

### 3. Environment Variables

Add to `.env`:

```env
# TURN Server (optional, for NAT traversal)
TURN_SERVER_URL=turn:your-turn-server.com:3478
TURN_USERNAME=your-username
TURN_CREDENTIAL=your-password

# Call Settings
RING_TIMEOUT_MS=45000
```

### 4. Frontend Updates Needed

#### Update CallService (`apps/client/src/services/CallService.ts`):

```typescript
// Change endpoint from /api/calls/initiate to /api/v1/calls
const res = await fetch(`${this.apiBase}/api/v1/calls`, {
  method: 'POST',
  headers: this.getHeaders(),
  body: JSON.stringify({
    orgId: 'default', // or from user context
    clientId: this.clientId,
    reason: purpose,
  }),
});
```

#### Update StaffRTC (`apps/staff/services/StaffRTC.ts`):

```typescript
// Listen for new event names
socket.on('call.initiated', (event) => {
  onIncoming(event);
});

// Update accept endpoint
const res = await fetch(`${this.apiBase}/api/v1/calls/${callId}/accept`, {
  method: 'POST',
  headers: this.getHeaders(),
});
```

### 5. Set Staff Availability

When staff logs in:

```typescript
// In Dashboard.tsx or similar
await fetch(`${apiBase}/api/v1/staff/availability`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    status: 'available',
    orgId: 'default',
  }),
});
```

## Testing

### Test Call Flow:

1. **Start server**: `npm run dev`
2. **Set staff availability**: POST to `/api/v1/staff/availability`
3. **Initiate call**: POST to `/api/v1/calls`
4. **Verify**: Staff receives `call.initiated` event
5. **Accept**: POST to `/api/v1/calls/{callId}/accept`
6. **Verify**: CAS prevents double-accept

### Test Timeout:

1. Initiate call
2. Don't accept
3. Wait 45 seconds
4. Verify call status = 'missed'
5. Verify client receives `call.missed` event

## Next Steps

1. Build frontend state machine (`callStore`)
2. Add missing UI components
3. Set up TURN server
4. Add metrics collection
5. Test across browsers

