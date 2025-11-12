# Development Server Startup Guide

## Quick Start

Simply run from the root directory:

```bash
npm run dev
```

This will automatically start:
- **Server** on `http://localhost:8080` (API & Socket.IO)
- **Client** on `http://localhost:5173` (React app)
- **Staff** on `http://localhost:5174` (Staff interface)

All services start simultaneously with colored output for easy identification.

## Server Configuration

The server is configured to:
- Listen on port **8080** by default
- Use environment variable `SERVER_PORT` or `PORT` if set
- Provide health check at `http://localhost:8080/healthz`
- Handle port conflicts gracefully

## Port Already in Use?

If port 8080 is already in use, you have options:

### Option 1: Use Helper Scripts (Windows)

**PowerShell:**
```powershell
.\scripts\start-dev.ps1
```

**Command Prompt:**
```cmd
scripts\start-dev.bat
```

These scripts will automatically free port 8080 before starting.

### Option 2: Manual Port Cleanup

**PowerShell:**
```powershell
# Find process using port 8080
Get-NetTCPConnection -LocalPort 8080

# Kill the process (replace PID with actual process ID)
Stop-Process -Id <PID> -Force
```

**Command Prompt:**
```cmd
# Find process using port 8080
netstat -ano | findstr ":8080"

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### Option 3: Change Port

Create or update `.env` file in `apps/server/`:
```
SERVER_PORT=8081
```

## Available Scripts

- `npm run dev` - Start all services (server, client, staff)
- `npm run dev:server-only` - Start only the server
- `npm run dev:client` - Start only the client
- `npm run dev:staff` - Start only the staff interface

## Troubleshooting

### Server Not Starting

1. Check if port 8080 is free: `netstat -ano | findstr ":8080"`
2. Check server logs for errors
3. Verify `.env` file exists in `apps/server/`
4. Ensure all dependencies are installed: `npm install`

### Connection Errors

If you see "Cannot connect to server" errors:
1. Verify server is running: Check for "Server listening on :8080" in logs
2. Test health endpoint: `curl http://localhost:8080/healthz`
3. Check CORS configuration in `apps/server/src/index.ts`

### Colored Output Not Showing

The dev script uses colored prefixes:
- **SERVER** (blue) - Backend server logs
- **CLIENT** (green) - Client app logs  
- **STAFF** (magenta) - Staff app logs

If colors don't show, your terminal may not support them, but functionality is unaffected.

## Environment Variables

Key environment variables (optional):
- `SERVER_PORT` or `PORT` - Server port (default: 8080)
- `CLIENT_ORIGIN` - Client app origin (default: http://localhost:5173)
- `CORS_ORIGINS` - Comma-separated allowed origins

See `env.example` for full list.

