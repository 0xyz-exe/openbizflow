import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Download,
} from "lucide-react";
import { apiRequest, type TemplateItem } from "../lib/api";

export const TemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [importingId, setImportingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    apiRequest<TemplateItem[]>("/templates/")
      .then((data) => setTemplates(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const categories = ["All", ...Array.from(new Set(templates.map((t) => t.category)))];

  const filtered = category === "All" ? templates : templates.filter((t) => t.category === category);

  const handleImport = async (tplId: string) => {
    setImportingId(tplId);
    try {
      const res = await apiRequest(`/templates/${tplId}/import`, { method: "POST" });
      navigate(`/workflows/${res.id}`);
    } catch (err: any) {
      alert(err.message || "Failed to import template");
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Workflow Templates</h1>
          <p className="text-sm text-slate-500 mt-1">
            Pre-built enterprise business automations ready to deploy in seconds
          </p>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 text-xs font-semibold shadow-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-md transition ${
                category === cat ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading template library...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-indigo-300 hover:shadow-md transition"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                    {tpl.category}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {tpl.definition?.nodes?.length || 0} Steps
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">{tpl.name}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">{tpl.description}</p>

                {/* Steps Preview */}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 mb-4 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pipeline Flow</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {tpl.definition?.nodes?.map((n: any, idx: number) => (
                      <React.Fragment key={n.id}>
                        <span className="text-[11px] font-medium bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700 truncate max-w-[140px]">
                          {n.data?.label || n.type}
                        </span>
                        {idx < (tpl.definition?.nodes?.length || 0) - 1 && (
                          <ArrowRight className="w-3 h-3 text-slate-300" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleImport(tpl.id)}
                disabled={importingId === tpl.id}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition shadow-xs disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{importingId === tpl.id ? "Importing to Workspace..." : "Use Template"}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
