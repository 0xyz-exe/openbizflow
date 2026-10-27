import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  GitBranch,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Plus,
  Boxes,
  Activity,
  Layers,
} from "lucide-react";
import { apiRequest, type DashboardStats } from "../lib/api";

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    apiRequest<DashboardStats>("/dashboard/stats")
      .then((data) => setStats(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const successRate =
    stats && stats.total_executions > 0
      ? Math.round((stats.successful_executions / stats.total_executions) * 100)
      : 100;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Overview Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time automation metrics and workflow activity</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/templates"
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm"
          >
            <Boxes className="w-4 h-4 text-slate-500" />
            <span>Templates</span>
          </Link>
          <button
            onClick={() => navigate("/workflows/new")}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Workflow</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Workflows</span>
            <GitBranch className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats ? stats.total_workflows : "—"}</p>
          <span className="text-xs text-slate-400 mt-1 block">Created in workspace</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats ? stats.active_workflows : "—"}</p>
          <span className="text-xs text-emerald-600 font-medium mt-1 block">Listening for events</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Runs</span>
            <PlayCircle className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats ? stats.total_executions : "—"}</p>
          <span className="text-xs text-slate-400 mt-1 block">Executed pipelines</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Success Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats ? `${successRate}%` : "—"}</p>
          <span className="text-xs text-slate-400 mt-1 block">Reliability score</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approvals</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">{stats ? stats.pending_approvals : "—"}</p>
          <Link to="/approvals" className="text-xs text-amber-600 hover:underline mt-1 block">
            Awaiting human review
          </Link>
        </div>
      </div>

      {/* Main Grid: Recent Executions + Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recent Executions */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Recent Executions</h2>
            <Link to="/executions" className="text-xs text-indigo-600 hover:text-indigo-500 font-medium flex items-center gap-1">
              <span>View all</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">Loading metrics...</div>
          ) : !stats?.recent_executions.length ? (
            <div className="py-12 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg">
              No executions yet. Trigger a workflow to see logs.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.recent_executions.map((ex) => (
                <div key={ex.id} className="py-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    {ex.status === "SUCCEEDED" && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                    {ex.status === "FAILED" && <XCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                    {ex.status === "WAITING" && <Clock className="w-4 h-4 text-amber-500 shrink-0" />}
                    {ex.status === "RUNNING" && <Activity className="w-4 h-4 text-blue-500 animate-pulse shrink-0" />}
                    <div>
                      <Link to={`/executions/${ex.id}`} className="font-medium text-slate-800 hover:text-indigo-600 truncate block">
                        {ex.workflow_name || "Workflow Run"}
                      </Link>
                      <span className="text-xs text-slate-400">ID: {ex.id.slice(0, 8)} • Trigger: {ex.trigger_type}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        ex.status === "SUCCEEDED"
                          ? "bg-emerald-50 text-emerald-700"
                          : ex.status === "FAILED"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {ex.status}
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">{ex.duration_ms}ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Quick Starters */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Automate Fast</h2>
            <p className="text-xs text-slate-500 mb-4">
              Import production-grade templates with pre-configured triggers, conditional branches, and human approvals.
            </p>
            <div className="space-y-2.5">
              <Link
                to="/templates"
                className="p-3 border border-slate-200 hover:border-indigo-400 rounded-lg flex items-center justify-between group transition"
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-medium text-slate-800 group-hover:text-indigo-600">Employee Leave Approval</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition" />
              </Link>
              <Link
                to="/templates"
                className="p-3 border border-slate-200 hover:border-indigo-400 rounded-lg flex items-center justify-between group transition"
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-medium text-slate-800 group-hover:text-indigo-600">Purchase Request & Signoff</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition" />
              </Link>
              <Link
                to="/templates"
                className="p-3 border border-slate-200 hover:border-indigo-400 rounded-lg flex items-center justify-between group transition"
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-medium text-slate-800 group-hover:text-indigo-600">Website Lead Qualification</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
