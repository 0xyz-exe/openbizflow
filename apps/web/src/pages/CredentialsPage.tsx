import React, { useEffect, useState } from "react";
import {
  KeyRound,
  Plus,
  Trash2,
  ShieldCheck,
  Lock,
  X,
} from "lucide-react";
import { apiRequest, type CredentialItem } from "../lib/api";

export const CredentialsPage: React.FC = () => {
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("bearer_token");
  const [secretVal, setSecretVal] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCredentials = () => {
    setLoading(true);
    apiRequest<CredentialItem[]>("/credentials/")
      .then((data) => setCredentials(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest("/credentials/", {
        method: "POST",
        body: JSON.stringify({
          name,
          type,
          data: { secret: secretVal },
        }),
      });
      setShowAddModal(false);
      setName("");
      setSecretVal("");
      fetchCredentials();
    } catch (err: any) {
      alert(err.message || "Failed to create credential");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this credential?")) return;
    try {
      await apiRequest(`/credentials/${id}`, { method: "DELETE" });
      setCredentials((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete credential");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Credentials & Secrets</h1>
          <p className="text-sm text-slate-500 mt-1">
            Encrypted credential vault for API authentication and external integrations
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Credential</span>
        </button>
      </div>

      {/* Security notice */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center gap-3 text-xs text-indigo-900">
        <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
        <div>
          <span className="font-bold block">Authenticated Encryption at Rest</span>
          <span>
            All integration secrets are encrypted with Fernet symmetric cryptography. Keys are never returned in plaintext to the browser.
          </span>
        </div>
      </div>

      {/* Credentials Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400">Loading vault...</div>
        ) : credentials.length === 0 ? (
          <div className="py-16 text-center">
            <KeyRound className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700">No credentials configured</p>
            <p className="text-xs text-slate-500 mt-1">Add API keys or webhook tokens to use them securely inside workflow steps.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Stored Value</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {credentials.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60 transition">
                  <td className="px-6 py-4 font-semibold text-slate-900">{c.name}</td>
                  <td className="px-4 py-4 text-xs capitalize text-slate-600">{c.type.replace("_", " ")}</td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-400">••••••••••••••••</td>
                  <td className="px-4 py-4 text-xs text-slate-500">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-600" />
                <span>Store New Credential</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold uppercase text-slate-600 mb-1">Credential Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stripe Production Key"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-600 mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="bearer_token">Bearer Token / API Key</option>
                  <option value="http_basic">HTTP Basic Authentication</option>
                  <option value="custom_header">Custom Header Value</option>
                  <option value="smtp">SMTP Email Password</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-600 mb-1">Secret Data / Token</label>
                <input
                  type="password"
                  required
                  placeholder="Paste private key or password..."
                  value={secretVal}
                  onChange={(e) => setSecretVal(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="mt-5 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition shadow disabled:opacity-50"
                >
                  {saving ? "Encrypting..." : "Store Secret"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
