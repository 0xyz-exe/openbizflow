from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# --- Auth Schemas ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None
    organization_name: Optional[str] = "My Workspace"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    current_organization_id: str

# --- Organization Schemas ---
class OrganizationCreate(BaseModel):
    name: str

class OrganizationOut(BaseModel):
    id: str
    name: str
    slug: str
    role: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class MemberOut(BaseModel):
    id: str
    user_id: str
    email: str
    full_name: Optional[str]
    role: str
    created_at: datetime

class MemberAdd(BaseModel):
    email: EmailStr
    role: str = "editor"  # owner, admin, editor, operator, viewer

# --- Credential Schemas ---
class CredentialCreate(BaseModel):
    name: str
    type: str  # http_basic, bearer_token, smtp, custom_header
    data: Dict[str, Any]

class CredentialOut(BaseModel):
    id: str
    name: str
    type: str
    created_at: datetime
    is_configured: bool = True

    class Config:
        from_attributes = True

# --- Workflow Schemas ---
class WorkflowNode(BaseModel):
    id: str
    type: str  # manual_trigger, webhook_trigger, http_request, condition, transform, email, notification, approval, log
    data: Dict[str, Any] = Field(default_factory=dict)
    position: Optional[Dict[str, float]] = None

class WorkflowEdge(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None

class WorkflowDefinition(BaseModel):
    nodes: List[Dict[str, Any]] = Field(default_factory=list)
    edges: List[Dict[str, Any]] = Field(default_factory=list)

class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    definition: WorkflowDefinition = Field(default_factory=WorkflowDefinition)

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    definition: Optional[WorkflowDefinition] = None

class WorkflowOut(BaseModel):
    id: str
    organization_id: str
    name: str
    description: Optional[str] = None
    is_active: bool
    version: int
    definition: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class WorkflowValidationResult(BaseModel):
    is_valid: bool
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    node_count: int = 0
    edge_count: int = 0
    trigger_node: Optional[str] = None

# --- Execution Schemas ---
class ExecutionTriggerReq(BaseModel):
    payload: Dict[str, Any] = Field(default_factory=dict)

class NodeExecutionOut(BaseModel):
    id: str
    node_id: str
    node_name: str
    node_type: str
    status: str
    input_data: Optional[Dict[str, Any]] = None
    output_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: int = 0

    class Config:
        from_attributes = True

class ExecutionOut(BaseModel):
    id: str
    organization_id: str
    workflow_id: str
    workflow_name: Optional[str] = None
    workflow_version: int
    trigger_type: str
    status: str
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: int = 0
    node_executions: List[NodeExecutionOut] = Field(default_factory=list)

    class Config:
        from_attributes = True

# --- Approval Schemas ---
class ApprovalOut(BaseModel):
    id: str
    organization_id: str
    execution_id: str
    workflow_id: Optional[str] = None
    workflow_name: Optional[str] = None
    node_id: str
    prompt: str
    status: str  # PENDING, APPROVED, REJECTED
    requester_email: Optional[str] = None
    approver_email: Optional[str] = None
    comments: Optional[str] = None
    decided_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ApprovalDecisionReq(BaseModel):
    decision: str  # approve, reject
    comments: Optional[str] = None

# --- Webhook Schemas ---
class WebhookEndpointOut(BaseModel):
    id: str
    workflow_id: str
    endpoint_token: str
    secret: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Dashboard Schemas ---
class DashboardStatsOut(BaseModel):
    total_workflows: int
    active_workflows: int
    total_executions: int
    successful_executions: int
    failed_executions: int
    pending_approvals: int
    recent_executions: List[ExecutionOut]
