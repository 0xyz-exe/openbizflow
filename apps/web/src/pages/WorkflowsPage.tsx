import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  GitBranch,
  Plus,
  Search,
  Play,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  Boxes,
  X,
} from "lucide-react";
import { apiRequest, type WorkflowItem } from "../lib/api";

export const WorkflowsPage: React.FC = () => {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedWfForRun, setSelectedWfForRun] = useState<WorkflowItem | null>(null);
  const [runPayload, setRunPayload] = useState('{\n  "employee_name": "Jane Doe",\n  "days": 4,\n  "employee_email": "jane@corp.com"\n}');
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchWorkflows = () => {
    setLoading(true);
    apiRequest<WorkflowItem[]>("/workflows/")
      .then((data) => setWorkflows(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleToggle = async (wf: WorkflowItem) => {
    try {
      await apiRequest(`/workflows/${wf.id}/toggle`, { method: "POST" });
      fetchWorkflows();
    } catch (err: any) {
      alert(err.message || "Failed to toggle status");
    }
  };

  const handleDelete = async (wfId: string) => {
    if (!confirm("Are you sure you want to delete this workflow?")) return;
    try {
      await apiRequest(`/workflows/${wfId}`, { method: "DELETE" });
      setWorkflows((prev) => prev.filter((w) => w.id !== wfId));
    } catch (err: any) {
      alert(err.message || "Failed to delete workflow");
    }
  };

  const handleExecute = async () => {
    if (!selectedWfForRun) return;
    setRunning(true);
    setRunError(null);
    try {
      let parsedPayload = {};
      if (runPayload.trim()) {
        parsedPayload = JSON.parse(runPayload);
      }
      const res = await apiRequest(`/workflows/${selectedWfForRun.id}/execute`, {
        method: "POST",
        body: JSON.stringify({ payload: parsedPayload }),
      });
      setSelectedWfForRun(null);
      navigate(`/executions/${res.id}`);
    } catch (err: any) {
      setRunError(err.message || "Execution failed");
    } finally {
      setRunning(false);
    }
  };

  const filtered = workflows.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    (w.description && w.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Workflows</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and execute business automation pipelines</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/templates"
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm"
          >
            <Boxes className="w-4 h-4 text-slate-500" />
            <span>Templates</span>
          </Link>
          <Link
            to="/workflows/new"
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Workflow</span>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search workflows by name..."
          className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
        />
      </div>

      {/* Workflow List Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400">Loading workflows...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <GitBranch className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700">No workflows found</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">Create your first automated workflow or import a template</p>
            <Link
              to="/templates"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition shadow-sm"
            >
              Explore Templates
            </Link>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3">Workflow Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Nodes</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((wf) => (
                <tr key={wf.id} className="hover:bg-slate-50/60 transition">
                  <td className="px-6 py-4">
                    <Link to={`/workflows/${wf.id}`} className="font-semibold text-slate-900 hover:text-indigo-600">
                      {wf.name}
                    </Link>
                    {wf.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{wf.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => handleToggle(wf)}
                      title="Click to toggle status"
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer ${
                        wf.is_active
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      {wf.is_active ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Clock className="w-3.5 h-3.5 text-slate-400" />}
                      <span>{wf.is_active ? "Active" : "Draft"}</span>
                    </button>
                  </td>
                  <td className="px-4 py-4 text-xs font-medium text-slate-600">v{wf.version}</td>
                  <td className="px-4 py-4 text-xs text-slate-500">{wf.definition?.nodes?.length || 0} steps</td>
                  <td className="px-4 py-4 text-xs text-slate-500">
                    {new Date(wf.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedWfForRun(wf)}
                        title="Trigger manual run"
                        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <Link
                        to={`/workflows/${wf.id}`}
                        title="Edit visual canvas"
                        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(wf.id)}
                        title="Delete"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Manual Trigger Test Modal */}
      {selectedWfForRun && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Run Workflow: {selectedWfForRun.name}</h3>
              <button onClick={() => setSelectedWfForRun(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {runError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {runError}
              </div>
            )}

            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Trigger Input JSON Payload
              </label>
              <textarea
                rows={6}
                value={runPayload}
                onChange={(e) => setRunPayload(e.target.value)}
                className="w-full font-mono text-xs p-3 bg-slate-900 text-emerald-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setSelectedWfForRun(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                disabled={running}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition shadow disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{running ? "Executing..." : "Start Execution"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
