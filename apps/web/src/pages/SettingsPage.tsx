import React, { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Building,
  Shield,
  Mail,
  AlertCircle,
} from "lucide-react";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";

interface Member {
  id: string;
  user_id: string;
  email: string;
  full_name?: string;
  role: string;
  created_at: string;
}

export const SettingsPage: React.FC = () => {
  const { currentOrg, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const fetchMembers = () => {
    if (!currentOrg) return;
    setLoading(true);
    apiRequest<Member[]>(`/organizations/${currentOrg.id}/members`)
      .then((data) => setMembers(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMembers();
  }, [currentOrg]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg) return;
    setInviting(true);
    setInviteError(null);
    try {
      await apiRequest(`/organizations/${currentOrg.id}/members`, {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });
      setInviteEmail("");
      fetchMembers();
      alert(`User ${inviteEmail} added to organization!`);
    } catch (err: any) {
      setInviteError(err.message || "Failed to add member");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Organization & Team</h1>
        <p className="text-sm text-slate-500 mt-1">Manage team access, RBAC permissions, and workspace parameters</p>
      </div>

      {/* Org Profile Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{currentOrg?.name || "Workspace"}</h2>
            <p className="text-xs text-slate-400">Slug: {currentOrg?.slug} • Your role: {currentOrg?.role}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-3 border-t border-slate-100">
          <div>
            <span className="text-slate-400 font-semibold uppercase block">Tenant Identifier</span>
            <span className="font-mono text-slate-700 mt-1 block">{currentOrg?.id}</span>
          </div>
          <div>
            <span className="text-slate-400 font-semibold uppercase block">Active Account</span>
            <span className="text-slate-700 mt-1 block">{user?.email}</span>
          </div>
        </div>
      </div>

      {/* Invite Member Box */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-indigo-600" />
          <span>Invite Member</span>
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Add an existing user to this workspace with defined operational permissions.
        </p>

        {inviteError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{inviteError}</span>
          </div>
        )}

        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="email"
              required
              placeholder="teammate@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
            />
          </div>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-700"
          >
            <option value="owner">Owner (Full Admin)</option>
            <option value="admin">Admin</option>
            <option value="editor">Editor (Create & Edit)</option>
            <option value="operator">Operator (Trigger Only)</option>
            <option value="viewer">Viewer (Read Only)</option>
          </select>
          <button
            type="submit"
            disabled={inviting}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition shadow-xs disabled:opacity-50"
          >
            {inviting ? "Adding..." : "Add Member"}
          </button>
        </form>
      </div>

      {/* Member Roster */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Workspace Members ({members.length})</span>
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading members...</div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 uppercase font-semibold text-slate-500">
                <th className="px-6 py-3">Member</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3.5">
                    <span className="font-semibold text-slate-900 block">{m.full_name || "Team Member"}</span>
                    <span className="text-slate-400 font-mono text-[11px]">{m.email}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1 font-semibold capitalize text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                      <Shield className="w-3 h-3 text-slate-400" />
                      <span>{m.role}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-500">{new Date(m.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
