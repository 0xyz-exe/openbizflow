import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  Layers,
  ChevronDown,
  ChevronRight,
  StopCircle,
} from "lucide-react";
import { apiRequest, type ExecutionItem, type NodeExecution } from "../lib/api";

export const ExecutionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [execution, setExecution] = useState<ExecutionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const fetchExecution = () => {
    if (!id) return;
    setLoading(true);
    apiRequest<ExecutionItem>(`/executions/${id}`)
      .then((data) => {
        setExecution(data);
        // Expand first node by default
        if (data.node_executions?.length) {
          setExpandedNodes({ [data.node_executions[0].id]: true });
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchExecution();
  }, [id]);

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleCancel = async () => {
    if (!id || !confirm("Are you sure you want to cancel this execution?")) return;
    try {
      const updated = await apiRequest<ExecutionItem>(`/executions/${id}/cancel`, { method: "POST" });
      setExecution(updated);
    } catch (err: any) {
      alert(err.message || "Failed to cancel execution");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading execution details...</div>;
  }

  if (!execution) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600">Execution not found.</p>
        <Link to="/executions" className="text-indigo-600 text-sm font-semibold underline mt-2 inline-block">
          Back to executions
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link
            to="/executions"
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {execution.workflow_name || "Workflow"} Run
            </h1>
            <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {execution.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {(execution.status === "RUNNING" || execution.status === "WAITING") && (
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition"
            >
              <StopCircle className="w-4 h-4" />
              <span>Cancel Run</span>
            </button>
          )}

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              execution.status === "SUCCEEDED"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : execution.status === "FAILED"
                ? "bg-rose-50 text-rose-700 border border-rose-200"
                : execution.status === "WAITING"
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : "bg-blue-50 text-blue-700 border border-blue-200"
            }`}
          >
            {execution.status === "SUCCEEDED" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            {execution.status === "FAILED" && <XCircle className="w-4 h-4 text-rose-500" />}
            {execution.status === "WAITING" && <Clock className="w-4 h-4 text-amber-500" />}
            {execution.status === "RUNNING" && <Activity className="w-4 h-4 text-blue-500 animate-pulse" />}
            <span>{execution.status}</span>
          </span>
        </div>
      </div>

      {/* Overview Stat Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs text-xs">
        <div>
          <span className="text-slate-400 block font-semibold uppercase">Trigger Type</span>
          <span className="font-medium text-slate-800 capitalize mt-1 block">{execution.trigger_type}</span>
        </div>
        <div>
          <span className="text-slate-400 block font-semibold uppercase">Duration</span>
          <span className="font-medium text-slate-800 mt-1 block">{execution.duration_ms} ms</span>
        </div>
        <div>
          <span className="text-slate-400 block font-semibold uppercase">Started</span>
          <span className="font-medium text-slate-800 mt-1 block">
            {execution.started_at ? new Date(execution.started_at).toLocaleTimeString() : "—"}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block font-semibold uppercase">Completed</span>
          <span className="font-medium text-slate-800 mt-1 block">
            {execution.completed_at ? new Date(execution.completed_at).toLocaleTimeString() : "In progress"}
          </span>
        </div>
      </div>

      {/* Error banner */}
      {execution.error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
          <p className="font-semibold uppercase tracking-wider mb-1">Execution Error</p>
          <pre className="font-mono whitespace-pre-wrap">{execution.error}</pre>
        </div>
      )}

      {/* Step by Step Timeline */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          <span>Execution Timeline ({execution.node_executions?.length || 0} Steps)</span>
        </h2>

        {!execution.node_executions?.length ? (
          <p className="text-xs text-slate-400 py-6 text-center">No node execution records available.</p>
        ) : (
          <div className="space-y-3">
            {execution.node_executions.map((node: NodeExecution, idx: number) => {
              const isExpanded = !!expandedNodes[node.id];
              return (
                <div key={node.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleExpand(node.id)}
                    className="w-full flex items-center justify-between p-3.5 bg-slate-50/70 hover:bg-slate-100 text-left transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-semibold text-xs text-slate-900 block">{node.node_name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {node.node_type} • {node.duration_ms}ms
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          node.status === "SUCCEEDED"
                            ? "bg-emerald-100 text-emerald-800"
                            : node.status === "FAILED"
                            ? "bg-rose-100 text-rose-800"
                            : node.status === "SKIPPED"
                            ? "bg-slate-200 text-slate-600"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {node.status}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Input/Output */}
                  {isExpanded && (
                    <div className="p-4 bg-white border-t border-slate-100 text-xs space-y-3 font-mono">
                      {node.error && (
                        <div>
                          <span className="font-bold text-rose-600 block mb-1">Step Error:</span>
                          <div className="p-2 bg-rose-50 text-rose-700 rounded border border-rose-200 whitespace-pre-wrap">
                            {node.error}
                          </div>
                        </div>
                      )}

                      <div>
                        <span className="font-bold text-slate-600 block mb-1">Step Input:</span>
                        <pre className="p-2.5 bg-slate-900 text-slate-200 rounded-lg overflow-x-auto text-[11px]">
                          {JSON.stringify(node.input_data, null, 2)}
                        </pre>
                      </div>

                      <div>
                        <span className="font-bold text-slate-600 block mb-1">Step Output:</span>
                        <pre className="p-2.5 bg-slate-900 text-emerald-400 rounded-lg overflow-x-auto text-[11px]">
                          {JSON.stringify(node.output_data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
