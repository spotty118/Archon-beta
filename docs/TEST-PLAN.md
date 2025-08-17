# Archon Backend Security and Integrity Test Plan

Purpose
Validate the Phase 1–4 hardening changes with a reproducible manual and automated smoke test plan covering authentication and RBAC, Socket.IO token handshake, path traversal protections, rate-limiting, and endpoint behavior changes.

Scope
- Backend FastAPI service under [python/src/server](python/src/server)
- Security helpers in [python/src/server/config/security_config.py](python/src/server/config/security_config.py)
- Secure routers:
  - MCP API: [python/src/server/api_routes/mcp_api.py](python/src/server/api_routes/mcp_api.py)
  - Monitoring API: [python/src/server/api_routes/monitoring.py](python/src/server/api_routes/monitoring.py)
  - Coverage API: [python/src/server/api_routes/coverage_api.py](python/src/server/api_routes/coverage_api.py)
  - Agent Chat API: [python/src/server/api_routes/agent_chat_api.py](python/src/server/api_routes/agent_chat_api.py)
- Rate limiting middleware: [python/src/server/middleware/rate_limit_middleware.py](python/src/server/middleware/rate_limit_middleware.py)
- Socket.IO handlers: [python/src/server/api_routes/socketio_handlers.py](python/src/server/api_routes/socketio_handlers.py)
- Knowledge sources endpoint: [python/src/server/api_routes/knowledge_api.py](python/src/server/api_routes/knowledge_api.py)
- Versioning restore safety: [python/src/server/services/projects/versioning_service.py](python/src/server/services/projects/versioning_service.py)

Assumptions
- Base URL: http://localhost:8181 (set by ARCHON_SERVER_PORT)
- Tokens available:
  - ADMIN_JWT: a JWT with scopes ["admin"]
  - USER_JWT: a JWT with scopes ["user"]
- curl and a WebSocket client (e.g., wscat, websocat, or a small Node/Python script) available
- Server running with recent changes applied

Environment Preparation
1) Ensure JWT_SECRET_KEY is set in environment or credentials so tokens validate:
   - See [python.SecuritySettings](python/src/server/config/security_config.py)
2) Start backend:
   - uvicorn or the project’s run script targeting ASGI app at [python/src/server/main.py](python/src/server/main.py)

Testing Sections

A. Authentication and RBAC

1) MCP API (admin-only)
- Status (requires admin):
  curl -i -H "Authorization: Bearer $ADMIN_JWT" http://localhost:8181/api/mcp/status
  Expect: 200 with status payload
- Non-admin should be forbidden:
  curl -i -H "Authorization: Bearer $USER_JWT" http://localhost:8181/api/mcp/status
  Expect: 403
- Unauthenticated should be unauthorized:
  curl -i http://localhost:8181/api/mcp/status
  Expect: 401
- Start/Stop/Logs/Config/Tools require admin (spot-check one):
  curl -i -X POST -H "Authorization: Bearer $ADMIN_JWT" http://localhost:8181/api/mcp/stop
  curl -i -X POST -H "Authorization: Bearer $USER_JWT" http://localhost:8181/api/mcp/stop
  Expect: 200 then 403 respectively (if server running)

2) Monitoring API
- Health (auth required):
  curl -i -H "Authorization: Bearer $USER_JWT" http://localhost:8181/api/monitoring/health
  Expect: 200 HealthSummaryResponse
- Metrics/admin-only:
  curl -i -H "Authorization: Bearer $ADMIN_JWT" http://localhost:8181/api/monitoring/circuit-breakers
  Expect: 200 with circuit breaker states
  curl -i -H "Authorization: Bearer $USER_JWT" http://localhost:8181/api/monitoring/circuit-breakers
  Expect: 403

3) Coverage API (auth required)
- JSON endpoints (pytest or vitest summary):
  curl -i -H "Authorization: Bearer $USER_JWT" http://localhost:8181/api/coverage/vitest/summary
  Expect: 200 (if coverage exists), else 404
- Unauthenticated:
  curl -i http://localhost:8181/api/coverage/vitest/summary
  Expect: 401

4) Agent Chat API (auth required + payload limits)
- Create session:
  curl -i -X POST -H "Authorization: Bearer $USER_JWT" -H "Content-Type: application/json" \
    -d '{"agent_type":"rag"}' http://localhost:8181/api/agent-chat/sessions
  Expect: 200 with session_id
- Send message OK:
  curl -i -X POST -H "Authorization: Bearer $USER_JWT" -H "Content-Type: application/json" \
    -d '{"message":"hello","context":{"k":"v"}}' http://localhost:8181/api/agent-chat/sessions/{session_id}/messages
  Expect: 200
- Send oversized message (8192+ chars):
  curl -i -X POST -H "Authorization: Bearer $USER_JWT" -H "Content-Type: application/json" \
    -d "{\"message\":\"$(python - <<'PY'\nprint('a'*9000)\nPY)\"}" \
    http://localhost:8181/api/agent-chat/sessions/{session_id}/messages
  Expect: 413
- Unauthenticated (no Authorization header):
  Expect: 401 on both endpoints

B. Socket.IO Token Handshake

Requirements implemented in [python/src/server/api_routes/socketio_handlers.py](python/src/server/api_routes/socketio_handlers.py):
- Token required in query string (?token=JWT)
- Reject if invalid or missing
- Event handlers guard by sid in auth map

1) Connect with token (wscat example):
  wscat -c "ws://localhost:8181/socket.io/?EIO=4&transport=websocket&token=$USER_JWT"
  Expect: Connection established
2) Connect without token:
  wscat -c "ws://localhost:8181/socket.io/?EIO=4&transport=websocket"
  Expect: Connection refused/closed by server
3) Join project list:
  After connect with token, emit subscribe_projects event
  Expect: ack and projects payload (if any)
4) Document room actions require authentication:
  Try join_document_room; expect success when connected with token

C. Path Traversal Guard (Coverage HTML)

1) Valid file:
  curl -i -H "Authorization: Bearer $USER_JWT" http://localhost:8181/api/coverage/vitest/html/index.html
  Expect: 200 if file exists
2) Traversal attempt:
  curl -i -H "Authorization: Bearer $USER_JWT" \
    "http://localhost:8181/api/coverage/vitest/html/../../../../etc/passwd"
  Expect: 400 (invalid path)

D. Rate Limiting Verification

See [python/src/server/middleware/rate_limit_middleware.py](python/src/server/middleware/rate_limit_middleware.py) configured buckets:
- /api/knowledge-items/crawl: 10 requests / 600s
- /api/documents/upload: 20 requests / 300s
- /api/agent-chat: 60 requests / 300s

Procedure:
1) Simulate rapid POSTs to /api/knowledge-items/crawl with Authorization header:
  for i in $(seq 1 12); do \
    curl -s -o /dev/null -w "%{http_code}\n" -X POST \
    -H "Authorization: Bearer $USER_JWT" -H "Content-Type: application/json" \
    -d '{"url":"https://example.com","knowledge_type":"general"}' \
    http://localhost:8181/api/knowledge-items/crawl; done
  Expect ~429 status after limit exceeded; check Retry-After and X-RateLimit-* headers
2) Upload rate-limiting similar concept
3) Agent chat bucket: exercise POST /api/agent-chat/sessions/{id}/messages until 429 kicks in

E. Knowledge Sources Endpoint

1) GET /api/knowledge-items/sources:
  curl -i -H "Authorization: Bearer $USER_JWT" http://localhost:8181/api/knowledge-items/sources
  Expect: 200 with list [] or populated list, no errors

F. Version Restore Safety

See [python/src/server/services/projects/versioning_service.py](python/src/server/services/projects/versioning_service.py):
- Backup created prior to restore
- Structured result contains:
  - backup_created, restore_record_created, rolled_back, messages
- Rollback attempt on exceptions

Test procedure:
1) Create a project and set a JSONB field (features or docs)
2) Create multiple versions via [python.VersioningService.create_version()](python/src/server/services/projects/versioning_service.py)
3) Force an error scenario (e.g., improper field content or simulate exception) to trigger rollback path
4) Invoke [python.VersioningService.restore_version()](python/src/server/services/projects/versioning_service.py)
5) Verify return tuple indicates error with rolled_back True when rollback succeeds
6) Validate final DB state equals pre-restore content on failure scenarios

G. Negative Tests

- Access protected endpoints without Authorization: expect 401
- Non-admin to admin endpoints: expect 403
- Socket.IO connect with malformed token: expect connection closed/refused
- Coverage traversal with encoded traversal strings: expect 400

H. Success Criteria

- All protected endpoints enforce authentication; admin-only endpoints enforce RBAC
- Socket.IO requires token; unauthorized connections rejected
- Coverage HTML serving rejects traversal outside base
- Rate-limiting produces 429 with headers on configured buckets
- Agent chat enforces payload limits (413)
- Knowledge sources returns structured list without server errors
- Version restore returns structured status and preserves data integrity under failures

Automation Ideas (Optional)

- Implement pytest-based API tests using httpx.AsyncClient for REST and python-socketio for WS
- Consider adding per-suite coverage and integration into CI

References (Files)

- Security helpers: [python/src/server/config/security_config.py](python/src/server/config/security_config.py)
- MCP API: [python/src/server/api_routes/mcp_api.py](python/src/server/api_routes/mcp_api.py)
- Monitoring API: [python/src/server/api_routes/monitoring.py](python/src/server/api_routes/monitoring.py)
- Coverage API: [python/src/server/api_routes/coverage_api.py](python/src/server/api_routes/coverage_api.py)
- Agent Chat API: [python/src/server/api_routes/agent_chat_api.py](python/src/server/api_routes/agent_chat_api.py)
- Socket.IO handlers: [python/src/server/api_routes/socketio_handlers.py](python/src/server/api_routes/socketio_handlers.py)
- Rate limiting: [python/src/server/middleware/rate_limit_middleware.py](python/src/server/middleware/rate_limit_middleware.py)
- Versioning Service: [python/src/server/services/projects/versioning_service.py](python/src/server/services/projects/versioning_service.py)