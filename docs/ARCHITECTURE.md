# OpenBizFlow Architecture

OpenBizFlow is structured as a modular workflow automation platform with clear separation of concerns.

```
                    +------------------------+
                    |  React 19 + TypeScript  |
                    |     Vite + Tailwind    |
                    +-----------+------------+
                                | REST API
                                v
                    +------------------------+
                    |  FastAPI REST Gateway  |
                    |  Tenant Authorization  |
                    +-----------+------------+
                                |
             +------------------+------------------+
             |                                     |
             v                                     v
+------------------------+             +------------------------+
| Workflow DAG Engine    |             | Credential Vault       |
| - Topological Sort     |             | - Fernet At-Rest Crypto|
| - Variable Resolver    |             | - SSRF URL Validator   |
| - Condition Evaluator  |             +------------------------+
| - Human Approval Gate  |
+------------+-----------+
             |
             v
+------------------------+
| PostgreSQL / SQLite    |
| - Workflows            |
| - Versions             |
| - Executions           |
| - Approvals            |
+------------------------+
```

## Architectural Highlights
- **Tenant Isolation**: All workflow operations enforce organization ownership on the server side. Cross-tenant access is blocked with 403 Forbidden.
- **Acyclic DAG Traversal**: Workflows are directed acyclic graphs executed topologically. Cycles are rejected at validation time.
- **Durable Human Approvals**: When an approval node is reached, the engine records pending signoff state, marks execution `WAITING`, and halts. On decision, execution state is loaded and downstream nodes are dispatched.
