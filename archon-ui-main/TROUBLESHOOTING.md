# Connection Troubleshooting Guide

## Common Connection Issues

### 1. Socket.IO Connection Errors

**Error**: `WebSocket connection to 'ws://host:3737/socket.io/' failed`

**Cause**: Socket.IO client trying to connect to frontend port instead of backend port.

**Solution**: 
- Ensure backend service is running on port 8181
- Set `ARCHON_SERVER_PORT=8181` in `.env` file for development
- For production: Set `VITE_API_URL=http://your-domain:8181`

### 2. Backend Health Check Failures

**Error**: `GET http://host:8181/health net::ERR_CONNECTION_REFUSED`

**Cause**: Backend FastAPI service is not running.

**Solutions**:
- **Local Development**: Run `docker-compose up -d` or `uv run python -m src.server.main`
- **Production**: Ensure backend container/service is running on port 8181
- Check firewall settings allow connections to port 8181

### 3. ARCHON_SERVER_PORT Error

**Error**: `ARCHON_SERVER_PORT environment variable is required`

**Cause**: Missing required environment variable for development.

**Solution**:
1. Copy `.env.example` to `.env` in `archon-ui-main/`
2. Set `ARCHON_SERVER_PORT=8181`
3. Restart the frontend development server

### 4. Supabase Authentication Errors

**Error**: `GET https://xxx.supabase.co/rest/v1/archon_projects 401 (Unauthorized)`

**Cause**: Missing or incorrect Supabase credentials.

**Solution**:
1. Copy `.env.example` to `.env` in `archon-ui-main/`
2. Set correct Supabase values:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
3. Restart the frontend development server

### 5. Production Deployment Issues

**For remote deployments** (like 134.199.207.41):

1. **Backend Service**: Ensure all services are running:
   ```bash
   docker-compose ps
   # Should show archon-server, archon-mcp, and archon-agents as running
   ```

2. **Port Configuration**: Verify ports are accessible:
   ```bash
   curl http://your-server:8181/health
   curl http://your-server:8051/health
   ```

3. **Environment Variables**: Set production URLs in frontend `.env`:
   ```
   VITE_API_URL=http://your-server:8181
   ```

## Quick Diagnosis Commands

```bash
# Check if backend is running
curl http://localhost:8181/health

# Check if MCP server is running  
curl http://localhost:8051/health

# Check Docker services
docker-compose ps

# View service logs
docker-compose logs archon-server
docker-compose logs archon-mcp
```

## Development Setup Checklist

- [ ] Backend services running (`docker-compose up -d`)
- [ ] Frontend `.env` file configured with `ARCHON_SERVER_PORT=8181`
- [ ] Frontend `.env` file configured with Supabase credentials
- [ ] Port 8181 accessible for backend API
- [ ] Port 8051 accessible for MCP server
- [ ] Port 3737 available for frontend development server

## Environment Configuration

### Local Development
Create `archon-ui-main/.env`:
```
ARCHON_SERVER_PORT=8181
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Production Deployment
For server deployments, set appropriate URLs:
```
VITE_API_URL=http://134.199.207.41:8181
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Auto-Detection Logic
The configuration system works as follows:
1. **Production**: Uses relative URLs (empty string) which go through proxy
2. **Development with VITE_API_URL**: Uses the specified URL directly
3. **Development without VITE_API_URL**: Constructs URL using `ARCHON_SERVER_PORT`

## Configuration System Details

The API configuration in `src/config/api.ts` provides:
- `getApiUrl()`: Returns the base API URL
- `getApiBasePath()`: Returns the full API path (`/api`)
- `getWebSocketUrl()`: Returns WebSocket URL for Socket.IO connections

Socket.IO now uses `getApiUrl()` to ensure it connects to the correct backend port.