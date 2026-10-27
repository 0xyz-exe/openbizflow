# Workflow Execution Engine

## Node Execution Model

Each node in OpenBizFlow implements a deterministic lifecycle:
`QUEUED` -> `RUNNING` -> `SUCCEEDED` | `WAITING` | `FAILED` | `SKIPPED`

### Supported Node Types
1. **Triggers**:
   - `manual_trigger`: Invoked through the UI or REST API.
   - `webhook_trigger`: Invoked via external POST requests with optional HMAC-SHA256 signature verification.
   - `schedule_trigger`: Triggered on cron intervals or fixed schedules.
2. **Actions**:
   - `http_request`: Executes HTTP calls with SSRF protection against private IP spaces and AWS/GCP metadata endpoints.
   - `email`: Sends formatted email messages via SMTP or delivery sink.
   - `notification`: Emits in-app workspace alerts.
   - `transform`: Remaps and formats incoming data dictionaries.
   - `log`: Records audit lines into the execution log.
3. **Logic & Human-in-the-Loop**:
   - `condition`: Evaluates operators (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `exists`). Directs flow along either `true` or `false` handles.
   - `approval`: Creates human review request, transitions execution to `WAITING`, and pauses the pipeline.

## Variable Interpolation
Values support dynamic variable paths:
- `{{ trigger.payload.fieldName }}`
- `{{ nodes.node_id.output.resultName }}`
