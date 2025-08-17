# Security Posture

This document summarizes the security controls enabled in the Archon backend after the Phase 1–4 hardening pass.

## Authentication and RBAC

- All sensitive routers are protected with JWT authentication (Authorization: Bearer <token>).
- Admin-only endpoints enforce role-based access via an admin scope in token payload.
- Centralized helpers:
  - require_auth: rejects unauthenticated requests.
  - require_admin: rejects requests without admin scope.
- Implementation references:
  - security_config.py: require_auth/require_admin and JWT verification.
  - mcp_api.py: router-level auth + admin-only operations.
  - monitoring.py: router-level auth; admin scope for metrics/alerts.
  - coverage_api.py: router-level auth.
  - agent_chat_api.py: router-level auth and payload limits.

### Required scopes

- Admin: required for MCP management, monitoring internals, and coverage access.
- User: sufficient for standard feature endpoints (projects, tasks, knowledge, settings), subject to future expansion.

## Socket.IO Authentication

- Socket.IO handshakes require ?token=<JWT> query parameter.
- Connections without a valid token are rejected.
- All sensitive events (project/document/crawl/progress subscriptions) verify authentication per sid.
- Implementation: socketio_handlers.py.

## Coverage Path Traversal Mitigation

- HTML coverage files are served only after a safe path resolution check.
- Requests outside the allowed base directories are rejected (400/404).
- Implementation: coverage_api.py.

## Rate Limiting

- Endpoint buckets and limits (requests/window, burst):
  - /api/knowledge-items/crawl: 10 / 10m (burst 2)
  - /api/documents/upload: 20 / 5m (burst 5)
  - /api/agent-chat: 60 / 5m (burst 20)
  - Other read/write buckets as configured in RateLimitMiddleware.
- Identifier: user id when authenticated, else client IP.
- Implementation: rate_limit_middleware.py.

## API Endpoints Now Protected

- MCP: start, stop, status, logs, config, tools, logs/stream (WS)
- Monitoring: circuit-breakers, alerts, performance, mcp-metrics, reset-alerts
- Coverage: pytest/json, vitest/json, vitest/summary, html assets
- Agent Chat: sessions and messages

## Client Integration Notes

- Include Authorization: Bearer <JWT> on all protected REST endpoints.
- For Socket.IO, include token in connection query (e.g., io(url, { query: { token } })).
- Expect HTTP 401/403 when missing/insufficient credentials; 429 when rate limits exceeded; 413 for oversize payloads.

## Environment Configuration

- JWT_SECRET_KEY must be set in production.
- AUTH_ENABLED=true to enforce auth (default).
- RATE_LIMIT_ENABLED=true to enable rate limiting (default).
- CORS_ALLOWED_ORIGINS configured for allowed frontends.

## Version Restore Safety

- Restores create a backup version before applying changes.
- On failure, the service attempts to roll back to the previous content and reports rolled_back status.
- Implementation: versioning_service.py.

## Future Work

- Add OpenAPI response models for all secured endpoints.
- Add audit logging for security events.
- Move document sync locks/state to Redis with TTL (production).

## Reporting

Please report security concerns via the project issue tracker or contact the maintainers privately if sensitive.