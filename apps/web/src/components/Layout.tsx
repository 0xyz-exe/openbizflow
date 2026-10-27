import React, { useState } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  GitBranch,
  PlayCircle,
  CheckSquare,
  Boxes,
  KeyRound,
  Users,
  LogOut,
  ChevronDown,
  Workflow,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const Layout: React.FC = () => {
  const { user, organizations, currentOrg, switchOrganization, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: "Dashboard", path: "/", icon: LayoutDashboard },
    { label: "Workflows", path: "/workflows", icon: GitBranch },
    { label: "Executions", path: "/executions", icon: PlayCircle },
    { label: "Approvals", path: "/approvals", icon: CheckSquare },
    { label: "Templates", path: "/templates", icon: Boxes },
    { label: "Credentials", path: "/credentials", icon: KeyRound },
    { label: "Team & Settings", path: "/settings", icon: Users },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-200 border-r border-slate-800">
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
          <div className="bg-indigo-600 text-white p-2 rounded-lg shadow-sm">
            <Workflow className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight text-white tracking-tight">OpenBizFlow</h1>
            <p className="text-xs text-slate-400">Workflow Automation</p>
          </div>
        </div>

        {/* Organization Switcher */}
        <div className="px-4 py-3 border-b border-slate-800 relative">
          <button
            onClick={() => setShowOrgDropdown(!showOrgDropdown)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700/80 rounded-md transition"
          >
            <div className="truncate text-left">
              <span className="block text-xs text-slate-400">Organization</span>
              <span className="font-medium text-white truncate block">{currentOrg?.name || "Select Org"}</span>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {showOrgDropdown && (
            <div className="absolute left-4 right-4 mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl py-1 z-50">
              <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Switch Workspace
              </div>
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => {
                    switchOrganization(org.id);
                    setShowOrgDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-700 ${
                    org.id === currentOrg?.id ? "text-indigo-400 font-semibold bg-slate-750" : "text-slate-300"
                  }`}
                >
                  <span className="truncate">{org.name}</span>
                  <span className="text-xs bg-slate-700 px-1.5 py-0.5 rounded text-slate-400">{org.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User profile & Logout */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <div className="truncate pr-2">
            <p className="text-sm font-medium text-white truncate">{user?.full_name || user?.email}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            title="Sign out"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Workflow className="w-5 h-5 text-indigo-400" />
            <span className="font-bold">OpenBizFlow</span>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1.5 rounded hover:bg-slate-800">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded text-slate-300 hover:bg-slate-800"
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}

        {/* Dynamic page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
