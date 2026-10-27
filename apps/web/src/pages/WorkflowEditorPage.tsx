import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Save,
  Play,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Settings2,
  Trash2,
  HelpCircle,
  Send,
  GitBranch as GitIcon,
  CheckSquare,
  Globe,
  Bell,
  Code,
  FileText,
} from "lucide-react";
import { apiRequest, type WorkflowItem } from "../lib/api";

// --- Custom Nodes ---

const TriggerNode: React.FC<{ data: any; selected: boolean }> = ({ data, selected }) => {
  return (
    <div
      className={`px-4 py-3 rounded-xl bg-white border-2 shadow-sm min-w-[180px] transition ${
        selected ? "border-indigo-600 ring-2 ring-indigo-200" : "border-indigo-300"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
          <Play className="w-4 h-4 fill-indigo-600" />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Trigger</span>
          <p className="text-xs font-semibold text-slate-800">{data.label || "Start Trigger"}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-indigo-600 border-2 !border-white" />
    </div>
  );
};

const ActionNode: React.FC<{ data: any; selected: boolean }> = ({ data, selected }) => {
  return (
    <div
      className={`px-4 py-3 rounded-xl bg-white border-2 shadow-sm min-w-[180px] transition ${
        selected ? "border-blue-600 ring-2 ring-blue-200" : "border-slate-300"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-slate-400 border-2 !border-white" />
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
          <Globe className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Action</span>
          <p className="text-xs font-semibold text-slate-800">{data.label || "Action Step"}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-blue-600 border-2 !border-white" />
    </div>
  );
};

const ConditionNode: React.FC<{ data: any; selected: boolean }> = ({ data, selected }) => {
  return (
    <div
      className={`px-4 py-3 rounded-xl bg-white border-2 shadow-sm min-w-[200px] transition ${
        selected ? "border-amber-600 ring-2 ring-amber-200" : "border-amber-300"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-slate-400 border-2 !border-white" />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
          <GitIcon className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Branching Condition</span>
          <p className="text-xs font-semibold text-slate-800">{data.label || "If / Else"}</p>
        </div>
      </div>
      <div className="flex justify-between items-center text-[10px] font-bold mt-2 pt-1 border-t border-slate-100">
        <span className="text-emerald-600">TRUE</span>
        <span className="text-rose-600">FALSE</span>
      </div>
      {/* Branch Handles */}
      <Handle
        type="source"
        id="true"
        position={Position.Bottom}
        className="!left-8 !w-3 !h-3 !bg-emerald-500 border-2 !border-white"
      />
      <Handle
        type="source"
        id="false"
        position={Position.Bottom}
        className="!left-[calc(100%-2rem)] !w-3 !h-3 !bg-rose-500 border-2 !border-white"
      />
    </div>
  );
};

const ApprovalNode: React.FC<{ data: any; selected: boolean }> = ({ data, selected }) => {
  return (
    <div
      className={`px-4 py-3 rounded-xl bg-white border-2 shadow-sm min-w-[190px] transition ${
        selected ? "border-purple-600 ring-2 ring-purple-200" : "border-purple-300"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-slate-400 border-2 !border-white" />
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
          <CheckSquare className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Human Approval</span>
          <p className="text-xs font-semibold text-slate-800">{data.label || "Manager Signoff"}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-purple-600 border-2 !border-white" />
    </div>
  );
};

export const WorkflowEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [workflow, setWorkflow] = useState<WorkflowItem | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const nodeTypes = useMemo(
    () => ({
      manual_trigger: TriggerNode,
      webhook_trigger: TriggerNode,
      schedule_trigger: TriggerNode,
      http_request: ActionNode,
      email: ActionNode,
      notification: ActionNode,
      transform: ActionNode,
      log: ActionNode,
      condition: ConditionNode,
      approval: ApprovalNode,
    }),
    []
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const fetchWorkflow = async () => {
    if (!id || id === "new") {
      // Default blank template
      const defaultNodes: Node[] = [
        {
          id: "trigger_1",
          type: "manual_trigger",
          data: { label: "Manual Trigger" },
          position: { x: 250, y: 50 },
        },
      ];
      setNodes(defaultNodes);
      setEdges([]);
      setName("Untitled Workflow");
      setDescription("Automated workflow pipeline");
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<WorkflowItem>(`/workflows/${id}`);
      setWorkflow(data);
      setName(data.name);
      setDescription(data.description || "");

      const rawNodes = data.definition?.nodes || [];
      const rawEdges = data.definition?.edges || [];
      setNodes(rawNodes);
      setEdges(rawEdges);
    } catch (err: any) {
      alert(err.message || "Failed to load workflow");
      navigate("/workflows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflow();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    const definition = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        data: n.data,
        position: n.position,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })),
    };

    try {
      if (!id || id === "new") {
        const res = await apiRequest<WorkflowItem>("/workflows/", {
          method: "POST",
          body: JSON.stringify({ name, description, definition }),
        });
        navigate(`/workflows/${res.id}`);
      } else {
        const res = await apiRequest<WorkflowItem>(`/workflows/${id}`, {
          method: "PUT",
          body: JSON.stringify({ name, description, definition }),
        });
        setWorkflow(res);
        alert("Workflow saved successfully!");
      }
    } catch (err: any) {
      alert(err.message || "Failed to save workflow");
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!id || id === "new") {
      alert("Please save the workflow first before validating.");
      return;
    }
    try {
      const res = await apiRequest(`/workflows/${id}/validate`, { method: "POST" });
      setValidationResult(res);
    } catch (err: any) {
      alert(err.message || "Validation request failed");
    }
  };

  const addNode = (type: string, label: string) => {
    const newId = `${type}_${Date.now()}`;
    const newNode: Node = {
      id: newId,
      type,
      data: { label },
      position: { x: 250 + Math.random() * 50, y: 150 + nodes.length * 60 },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(newId);
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const nodeData = (selectedNode?.data || {}) as Record<string, any>;

  const updateSelectedNodeData = (key: string, value: any) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              [key]: value,
            },
          };
        }
        return n;
      })
    );
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading editor canvas...</div>;
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col -m-4 sm:-m-6 lg:-m-8 bg-slate-100">
      {/* Top Canvas Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-4 z-10 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/workflows")}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workflow Title..."
              className="font-bold text-slate-900 text-base bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-600 focus:outline-none px-1 py-0.5"
            />
            <span className="text-xs text-slate-400 block px-1">
              {workflow ? `v${workflow.version} • ${workflow.is_active ? "Active" : "Draft"}` : "New Pipeline"}
            </span>
          </div>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleValidate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            <CheckCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>Validate</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition shadow disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Saving..." : "Save"}</span>
          </button>
        </div>
      </div>

      {/* Validation Banner */}
      {validationResult && (
        <div
          className={`px-6 py-2.5 text-xs flex items-center justify-between z-20 ${
            validationResult.is_valid
              ? "bg-emerald-50 text-emerald-800 border-b border-emerald-200"
              : "bg-rose-50 text-rose-800 border-b border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {validationResult.is_valid ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>
              {validationResult.is_valid
                ? `Workflow graph is valid (${validationResult.node_count} nodes, ${validationResult.edge_count} edges). Ready for execution.`
                : `Validation failed: ${validationResult.errors.join("; ")}`}
            </span>
          </div>
          <button onClick={() => setValidationResult(null)} className="font-bold underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Canvas + Sidebar Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* React Flow Viewport */}
        <div className="flex-1 h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            fitView
          >
            <Background color="#cbd5e1" gap={16} />
            <Controls />
            <MiniMap className="!bg-white !border-slate-200 !rounded-lg !shadow" />
          </ReactFlow>

          {/* Floating Node Palette Menu */}
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-xl shadow-lg p-2 flex flex-col gap-1 z-10">
            <span className="text-[10px] font-bold uppercase text-slate-400 px-2 py-1">Add Step</span>
            <button
              onClick={() => addNode("http_request", "HTTP Request")}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg text-left transition"
            >
              <Globe className="w-3.5 h-3.5 text-blue-500" />
              <span>HTTP Request</span>
            </button>
            <button
              onClick={() => addNode("condition", "Check Condition")}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg text-left transition"
            >
              <GitIcon className="w-3.5 h-3.5 text-amber-500" />
              <span>If / Else Branch</span>
            </button>
            <button
              onClick={() => addNode("approval", "Manager Approval")}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg text-left transition"
            >
              <CheckSquare className="w-3.5 h-3.5 text-purple-500" />
              <span>Human Approval</span>
            </button>
            <button
              onClick={() => addNode("email", "Send Email")}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg text-left transition"
            >
              <Send className="w-3.5 h-3.5 text-emerald-500" />
              <span>Send Email</span>
            </button>
            <button
              onClick={() => addNode("notification", "In-App Alert")}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg text-left transition"
            >
              <Bell className="w-3.5 h-3.5 text-cyan-500" />
              <span>Notification</span>
            </button>
            <button
              onClick={() => addNode("transform", "Transform Data")}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg text-left transition"
            >
              <Code className="w-3.5 h-3.5 text-indigo-500" />
              <span>Transform</span>
            </button>
            <button
              onClick={() => addNode("log", "Audit Log")}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg text-left transition"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Log Output</span>
            </button>
          </div>
        </div>

        {/* Node Inspector Panel */}
        {selectedNode ? (
          <div className="w-80 bg-white border-l border-slate-200 h-full p-5 overflow-y-auto z-10 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-indigo-600" />
                <h3 className="font-semibold text-sm text-slate-900">Step Properties</h3>
              </div>
              <button
                onClick={deleteSelectedNode}
                title="Delete this step"
                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold uppercase text-slate-500 mb-1">Step Name</label>
                <input
                  type="text"
                  value={nodeData.label || ""}
                  onChange={(e) => updateSelectedNodeData("label", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Node specific config */}
              {selectedNode.type === "http_request" && (
                <>
                  <div>
                    <label className="block font-semibold uppercase text-slate-500 mb-1">Method</label>
                    <select
                      value={nodeData.method || "GET"}
                      onChange={(e) => updateSelectedNodeData("method", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold uppercase text-slate-500 mb-1">Destination URL</label>
                    <input
                      type="text"
                      placeholder="https://api.example.com/webhook"
                      value={nodeData.url || ""}
                      onChange={(e) => updateSelectedNodeData("url", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 font-mono text-xs"
                    />
                  </div>
                </>
              )}

              {selectedNode.type === "condition" && (
                <>
                  <div>
                    <label className="block font-semibold uppercase text-slate-500 mb-1">Left Operand</label>
                    <input
                      type="text"
                      placeholder="{{trigger.payload.amount}}"
                      value={nodeData.left_operand || ""}
                      onChange={(e) => updateSelectedNodeData("left_operand", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold uppercase text-slate-500 mb-1">Comparison Operator</label>
                    <select
                      value={nodeData.operator || "eq"}
                      onChange={(e) => updateSelectedNodeData("operator", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900"
                    >
                      <option value="eq">Equal (==)</option>
                      <option value="neq">Not Equal (!=)</option>
                      <option value="gt">Greater Than (&gt;)</option>
                      <option value="gte">Greater or Equal (&gt;=)</option>
                      <option value="lt">Less Than (&lt;)</option>
                      <option value="lte">Less or Equal (&lt;=)</option>
                      <option value="contains">Contains</option>
                      <option value="exists">Exists</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold uppercase text-slate-500 mb-1">Right Operand</label>
                    <input
                      type="text"
                      placeholder="1000"
                      value={nodeData.right_operand || ""}
                      onChange={(e) => updateSelectedNodeData("right_operand", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 font-mono text-xs"
                    />
                  </div>
                </>
              )}

              {selectedNode.type === "approval" && (
                <div>
                  <label className="block font-semibold uppercase text-slate-500 mb-1">Prompt for Approver</label>
                  <textarea
                    rows={3}
                    placeholder="Approve order {{trigger.payload.order_id}} for ${{trigger.payload.total}}"
                    value={nodeData.prompt || ""}
                    onChange={(e) => updateSelectedNodeData("prompt", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 font-mono text-xs"
                  />
                </div>
              )}

              {selectedNode.type === "email" && (
                <>
                  <div>
                    <label className="block font-semibold uppercase text-slate-500 mb-1">Recipient</label>
                    <input
                      type="text"
                      placeholder="{{trigger.payload.email}}"
                      value={nodeData.to || ""}
                      onChange={(e) => updateSelectedNodeData("to", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold uppercase text-slate-500 mb-1">Subject</label>
                    <input
                      type="text"
                      placeholder="Action Required"
                      value={nodeData.subject || ""}
                      onChange={(e) => updateSelectedNodeData("subject", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 font-mono text-xs"
                    />
                  </div>
                </>
              )}

              {selectedNode.type === "notification" && (
                <>
                  <div>
                    <label className="block font-semibold uppercase text-slate-500 mb-1">Title</label>
                    <input
                      type="text"
                      value={nodeData.title || ""}
                      onChange={(e) => updateSelectedNodeData("title", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold uppercase text-slate-500 mb-1">Message</label>
                    <textarea
                      rows={3}
                      value={nodeData.message || ""}
                      onChange={(e) => updateSelectedNodeData("message", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 font-mono text-xs"
                    />
                  </div>
                </>
              )}

              {selectedNode.type === "log" && (
                <div>
                  <label className="block font-semibold uppercase text-slate-500 mb-1">Log Message</label>
                  <input
                    type="text"
                    value={nodeData.message || ""}
                    onChange={(e) => updateSelectedNodeData("message", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md p-2 text-slate-900 font-mono text-xs"
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="w-72 bg-white border-l border-slate-200 h-full p-6 text-center text-slate-400 flex flex-col items-center justify-center">
            <HelpCircle className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs font-medium text-slate-600">No step selected</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Click any node on the canvas to configure its triggers, parameters, or endpoints.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
