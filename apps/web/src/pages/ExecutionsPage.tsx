import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  PlayCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  ArrowRight,
} from "lucide-react";
import { apiRequest, type ExecutionItem } from "../lib/api";

export const ExecutionsPage: React.FC = () => {
  const [executions, setExecutions] = useState<ExecutionItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  const fetchExecutions = () => {
    setLoading(true);
    let url = "/executions/";
    if (statusFilter) {
      url += `?status=${statusFilter}`;
    }
    apiRequest<ExecutionItem[]>(url)
      .then((data) => setExecutions(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchExecutions();
  }, [statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Execution History</h1>
          <p className="text-sm text-slate-500 mt-1">Audit log and live monitoring of workflow runs</p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 text-xs font-semibold shadow-xs">
          <button
            onClick={() => setStatusFilter("")}
            className={`px-3 py-1.5 rounded-md transition ${
              statusFilter === "" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter("SUCCEEDED")}
            className={`px-3 py-1.5 rounded-md transition ${
              statusFilter === "SUCCEEDED" ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Succeeded
          </button>
          <button
            onClick={() => setStatusFilter("WAITING")}
            className={`px-3 py-1.5 rounded-md transition ${
              statusFilter === "WAITING" ? "bg-amber-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Waiting
          </button>
          <button
            onClick={() => setStatusFilter("FAILED")}
            className={`px-3 py-1.5 rounded-md transition ${
              statusFilter === "FAILED" ? "bg-rose-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Failed
          </button>
        </div>
      </div>

      {/* Execution Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400">Loading execution records...</div>
        ) : executions.length === 0 ? (
          <div className="py-16 text-center">
            <PlayCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700">No executions found</p>
            <p className="text-xs text-slate-500 mt-1">Runs triggered via UI or incoming webhooks will appear here.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Workflow</th>
                <th className="px-4 py-3">Execution ID</th>
                <th className="px-4 py-3">Trigger</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-6 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {executions.map((ex) => (
                <tr key={ex.id} className="hover:bg-slate-50/60 transition">
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        ex.status === "SUCCEEDED"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : ex.status === "FAILED"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : ex.status === "WAITING"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}
                    >
                      {ex.status === "SUCCEEDED" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                      {ex.status === "FAILED" && <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                      {ex.status === "WAITING" && <Clock className="w-3.5 h-3.5 text-amber-500" />}
                      {ex.status === "RUNNING" && <Activity className="w-3.5 h-3.5 text-blue-500 animate-pulse" />}
                      <span>{ex.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-slate-900">{ex.workflow_name || "Workflow"}</span>
                    <span className="text-xs text-slate-400 block">v{ex.workflow_version}</span>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-600">{ex.id.slice(0, 8)}</td>
                  <td className="px-4 py-4 text-xs capitalize text-slate-600">{ex.trigger_type}</td>
                  <td className="px-4 py-4 text-xs text-slate-600">{ex.duration_ms}ms</td>
                  <td className="px-4 py-4 text-xs text-slate-500">
                    {ex.started_at ? new Date(ex.started_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/executions/${ex.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                    >
                      <span>View</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
