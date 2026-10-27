import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckSquare,
  CheckCircle,
  XCircle,
  ArrowRight,
  MessageSquare,
  X,
} from "lucide-react";
import { apiRequest, type ApprovalItem } from "../lib/api";

export const ApprovalsPage: React.FC = () => {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [statusTab, setStatusTab] = useState<"PENDING" | "HISTORY">("PENDING");
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<{ approval: ApprovalItem; action: "approve" | "reject" } | null>(null);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const fetchApprovals = () => {
    setLoading(true);
    apiRequest<ApprovalItem[]>("/approvals/")
      .then((data) => setApprovals(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleDecision = async () => {
    if (!activeModal) return;
    setSubmitting(true);
    try {
      const res = await apiRequest(`/approvals/${activeModal.approval.id}/decide`, {
        method: "POST",
        body: JSON.stringify({
          decision: activeModal.action,
          comments,
        }),
      });
      setActiveModal(null);
      setComments("");
      fetchApprovals();
      navigate(`/executions/${res.id}`);
    } catch (err: any) {
      alert(err.message || "Failed to submit decision");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = approvals.filter((a) => {
    if (statusTab === "PENDING") return a.status === "PENDING";
    return a.status !== "PENDING";
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Approval Center</h1>
          <p className="text-sm text-slate-500 mt-1">Review, authorize, or reject paused workflow execution gates</p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 text-xs font-semibold shadow-xs">
          <button
            onClick={() => setStatusTab("PENDING")}
            className={`px-3 py-1.5 rounded-md transition ${
              statusTab === "PENDING" ? "bg-amber-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Pending Review
          </button>
          <button
            onClick={() => setStatusTab("HISTORY")}
            className={`px-3 py-1.5 rounded-md transition ${
              statusTab === "HISTORY" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            History & Audit
          </button>
        </div>
      </div>

      {/* Cards list */}
      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading approval queue...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center shadow-xs">
          <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">No {statusTab.toLowerCase()} approval requests</p>
          <p className="text-xs text-slate-500 mt-1">Workflows paused at an approval step will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      item.status === "PENDING"
                        ? "bg-amber-100 text-amber-800"
                        : item.status === "APPROVED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {item.status}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {item.workflow_name || "Workflow"}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{item.prompt}</h3>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span>Requested: {new Date(item.created_at).toLocaleString()}</span>
                  <Link
                    to={`/executions/${item.execution_id}`}
                    className="text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>View execution context</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                {item.comments && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 mt-2">
                    <span className="font-semibold text-slate-700">Approver Comment:</span> {item.comments}
                  </p>
                )}
              </div>

              {item.status === "PENDING" && (
                <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
                  <button
                    onClick={() => setActiveModal({ approval: item, action: "reject" })}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                  <button
                    onClick={() => setActiveModal({ approval: item, action: "approve" })}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition shadow shadow-emerald-600/10"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Decision Modal */}
      {activeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 capitalize">
                {activeModal.action} Workflow Request
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mt-3 font-medium">{activeModal.approval.prompt}</p>

            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                <span>Decision Comment (Optional)</span>
              </label>
              <textarea
                rows={3}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add audit rationale or guidance for requester..."
                className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDecision}
                disabled={submitting}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg transition shadow disabled:opacity-50 ${
                  activeModal.action === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-rose-600 hover:bg-rose-500"
                }`}
              >
                {activeModal.action === "approve" ? (
                  <CheckCircle className="w-3.5 h-3.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                <span>
                  {submitting
                    ? "Submitting..."
                    : `Confirm ${activeModal.action === "approve" ? "Approval" : "Rejection"}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
