# Security Model

This document defines the security principles for Dogfood.

## Core Rules

- Authorization is enforced server-side.
- Client roles are never trusted.
- Session cookies are httpOnly.
- Deadlines are enforced on the server.
- Judge isolation is mandatory.

Detailed implementation arrives during Phase 2 and T2.
