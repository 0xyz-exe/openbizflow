# OpenBizFlow REST API Reference

Base URL: `/api/v1`

## Authentication
- `POST /auth/register`: Create user account & default organization.
- `POST /auth/login`: Authenticate with email/password, returns JWT token.
- `GET /auth/me`: Retrieve current user profile and workspaces.

## Workflows
- `GET /workflows/`: List workflows in current organization.
- `POST /workflows/`: Create workflow with visual graph definition.
- `GET /workflows/{id}`: Retrieve workflow by ID.
- `PUT /workflows/{id}`: Update workflow graph and increment version.
- `DELETE /workflows/{id}`: Remove workflow.
- `POST /workflows/{id}/validate`: Validate DAG structure, triggers, and configuration.
- `POST /workflows/{id}/execute`: Trigger manual execution with JSON payload.
- `POST /workflows/{id}/toggle`: Toggle workflow active/draft status.

## Executions
- `GET /executions/`: Query executions with status and workflow filters.
- `GET /executions/{id}`: Fetch detailed execution timeline and node I/O.
- `POST /executions/{id}/cancel`: Abort in-flight or waiting execution.

## Approvals
- `GET /approvals/`: List pending and historical approvals.
- `POST /approvals/{id}/decide`: Submit human decision (`approve` / `reject`).

## Webhooks
- `POST /webhooks/{endpoint_token}`: Public webhook trigger endpoint with HMAC verification and idempotency support.

## Credentials
- `GET /credentials/`: List encrypted credentials (secrets masked).
- `POST /credentials/`: Store new encrypted credential at rest.
- `DELETE /credentials/{id}`: Delete credential.
