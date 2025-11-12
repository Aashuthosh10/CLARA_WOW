# Clara Unified Monorepo

Secure monorepo hosting both Client and Staff interfaces with real-time video call signaling.

## Architecture

- **apps/client**: Client interface (React + Vite)
- **apps/staff**: Staff interface (React + Vite)
- **apps/server**: Unified Express + Socket.IO server
- **packages/shared**: Shared TypeScript types
- **packages/webrtc**: WebRTC validation helpers

## Features

- **Feature-flagged**: All unified behavior behind `ENABLE_UNIFIED_MODE` (default: `false`)
- **JWT Auth**: Minimal issuer + acceptance of existing tokens
- **Real-time Signaling**: Socket.IO for WebRTC SDP/ICE exchange
- **Postgres State**: Call sessions with in-memory fallback
- **Secure**: CORS, rate limiting, payload validation

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (optional, falls back to in-memory)
- npm or pnpm

### Development

1. **Install dependencies**:
```bash
npm install
```

2. **Set environment variables**:
```bash
cp env.example .env
# Edit .env with your values
```

3. **Run in development**:
```bash
npm run dev
```

This starts:
- Client on http://localhost:5173
- Staff on http://localhost:5174
- Server on http://localhost:8080 (proxies /client and /staff)

### Production

1. **Build all apps**:
```bash
npm run build
```

2. **Set `ENABLE_UNIFIED_MODE=true` in .env**

3. **Start server**:
```bash
npm start
```

Server serves static bundles at:
- `/` → Client app
- `/staff` → Staff app
- `/api/*` → REST API
- `/socket` → WebSocket

## Environment Variables

See `env.example` for all options. Key ones:

- `ENABLE_UNIFIED_MODE`: Enable unified server (default: `false`)
- `JWT_SECRET`: Secret for JWT signing
- `DATABASE_URL`: Postgres connection string (optional)
- `PORT`: Server port (default: 8080)

## Client Features

When `ENABLE_UNIFIED_MODE=true`:
- "Unified Call" button appears in header
- Click to initiate video call to staff
- Shows call status in chat

## Staff Features

When `ENABLE_UNIFIED_MODE=true`:
- Incoming call popup appears when client calls
- Accept/Decline buttons
- WebRTC connection on accept

## API Endpoints

- `POST /api/auth/login` - Get JWT token
- `POST /api/calls/initiate` - Start call
- `POST /api/calls/accept` - Accept call
- `POST /api/calls/decline` - Decline call
- `POST /api/calls/sdp` - Send SDP
- `POST /api/calls/ice` - Send ICE candidate
- `GET /healthz` - Health check

## Docker

```bash
cd infra
docker-compose up
```

## Safety & Rollback

- **Default safe**: `ENABLE_UNIFIED_MODE=false` means Client runs unchanged
- **Rollback**: Set flag to `false` and restart
- **History preserved**: All moves done via `git mv`

See `REVERT.md` for detailed rollback steps.

## Testing

```bash
npm test
```

## License

Private

