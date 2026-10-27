const API_BASE = "/api/v1";

export interface User {
  id: string;
  email: string;
  full_name?: string;
  is_active: boolean;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
  created_at: string;
}

export interface WorkflowItem {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  version: number;
  definition: {
    nodes: any[];
    edges: any[];
  };
  created_at: string;
  updated_at: string;
}

export interface NodeExecution {
  id: string;
  node_id: string;
  node_name: string;
  node_type: string;
  status: string;
  input_data?: any;
  output_data?: any;
  error?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms: number;
}

export interface ExecutionItem {
  id: string;
  organization_id: string;
  workflow_id: string;
  workflow_name?: string;
  workflow_version: number;
  trigger_type: string;
  status: string;
  error?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms: number;
  node_executions: NodeExecution[];
}

export interface ApprovalItem {
  id: string;
  organization_id: string;
  execution_id: string;
  workflow_id?: string;
  workflow_name?: string;
  node_id: string;
  prompt: string;
  status: string;
  requester_email?: string;
  approver_email?: string;
  comments?: string;
  decided_at?: string;
  created_at: string;
}

export interface CredentialItem {
  id: string;
  name: string;
  type: string;
  created_at: string;
  is_configured: boolean;
}

export interface TemplateItem {
  id: string;
  name: string;
  description: string;
  category: string;
  definition: any;
}

export interface DashboardStats {
  total_workflows: number;
  active_workflows: number;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  pending_approvals: number;
  recent_executions: ExecutionItem[];
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("token");
  const currentOrgId = localStorage.getItem("current_org_id");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (currentOrgId) {
    headers["X-Organization-Id"] = currentOrgId;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const errorJson = await response.json();
      if (errorJson.detail) {
        errorDetail = errorJson.detail;
      }
    } catch {}
    throw new Error(errorDetail);
  }

  return response.json();
}
