import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../lib/authContext";
import { listLocalProjects, deleteLocalProject, getLocalProject, SavedProjectMeta } from "../lib/localProjects";
import {
  X,
  Cloud,
  HardDrive,
  FolderKanban,
  Image as ImageIcon,
  Upload,
  Trash2,
  ExternalLink,
  Plus,
  RefreshCw,
  Clock,
  Sparkles,
  Layers,
  AlertCircle,
  FileImage,
  Database,
} from "lucide-react";

interface UserStorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadProject: (projectData: any) => void;
  onSaveCurrentProject: () => Promise<void>;
  onInsertAssetAsLayer?: (imageUrl: string, filename: string) => void;
  currentProjectName?: string;
  isSavingProject?: boolean;
}

const API_BASE = "http://localhost:8000";

export const UserStorageModal: React.FC<UserStorageModalProps> = ({
  isOpen,
  onClose,
  onLoadProject,
  onSaveCurrentProject,
  onInsertAssetAsLayer,
  currentProjectName = "مشروع بدون عنوان",
  isSavingProject = false,
}) => {
  const { user, token, refreshUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"projects" | "assets" | "quota">("projects");
  const [cloudProjects, setCloudProjects] = useState<any[]>([]);
  const [localProjects, setLocalProjects] = useState<SavedProjectMeta[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUploadingAsset, setIsUploadingAsset] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const assetFileInputRef = useRef<HTMLInputElement>(null);

  const fetchCloudData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      // Fetch projects
      const resProj = await fetch(`${API_BASE}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resProj.ok) {
        const data = await resProj.json();
        setCloudProjects(data.projects || []);
      }

      // Fetch assets
      const resAssets = await fetch(`${API_BASE}/api/assets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resAssets.ok) {
        const data = await resAssets.json();
        setAssets(data.assets || []);
      }

      await refreshUser();
    } catch (err) {
      console.warn("Error fetching cloud vault data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setLocalProjects(listLocalProjects(user?.id));
      if (token) {
        fetchCloudData();
      }
    }
  }, [isOpen, token, user?.id]);

  if (!isOpen) return null;

  // Formatting helpers
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 بايت";
    const k = 1024;
    const sizes = ["بايت", "كيلوبايت", "ميغابايت", "غيغابايت"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  // Quota percentage
  const used = user?.storageUsedBytes || 0;
  const quota = user?.storageQuotaBytes || 157286400; // 150MB
  const usedPct = Math.min(100, Math.round((used / quota) * 100));

  // Handlers
  const handleOpenCloudProject = async (projectId: string) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("فشل تحميل المشروع");
      const data = await res.json();
      onLoadProject(data.project);
      onClose();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err?.message || "تعذر فتح المشروع" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenLocalProject = (projectId: string) => {
    const proj = getLocalProject(projectId, user?.id);
    if (proj) {
      onLoadProject(proj);
      onClose();
    } else {
      setStatusMsg({ type: "error", text: "المشروع المحلي غير موجود" });
    }
  };

  const handleDeleteCloudProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("هل أنت متأكد من حذف هذا المشروع نهائياً من السحابة؟")) return;
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setCloudProjects((prev) => prev.filter((p) => p.id !== projectId));
        await refreshUser();
        setStatusMsg({ type: "success", text: "تم حذف المشروع السحابي" });
      }
    } catch {
      setStatusMsg({ type: "error", text: "فشل حذف المشروع" });
    }
  };

  const handleDeleteLocalProject = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("هل أنت متأكد من حذف هذا المشروع من التخزين المحلي؟")) return;
    deleteLocalProject(projectId, user?.id);
    setLocalProjects(listLocalProjects(user?.id));
    setStatusMsg({ type: "success", text: "تم حذف المشروع المحلي" });
  };

  const handleUploadAsset = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setIsUploadingAsset(true);
    setStatusMsg(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/api/assets/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "فشل رفع الملف");
      }

      setAssets((prev) => [data.asset, ...prev]);
      await refreshUser();
      setStatusMsg({ type: "success", text: "تمت إضافة الصورة إلى خزنة وسائطك الخاصة!" });
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err?.message || "فشل رفع الصورة" });
    } finally {
      setIsUploadingAsset(false);
      if (assetFileInputRef.current) assetFileInputRef.current.value = "";
    }
  };

  const handleDeleteAsset = async (assetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("هل تريد حذف هذه الصورة من خزنتك؟")) return;
    try {
      const res = await fetch(`${API_BASE}/api/assets/${assetId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setAssets((prev) => prev.filter((a) => a.id !== assetId));
        await refreshUser();
        setStatusMsg({ type: "success", text: "تم حذف الصورة من الخزنة" });
      }
    } catch {
      setStatusMsg({ type: "error", text: "فشل حذف الملف" });
    }
  };

  return createPortal(
    <div
      id="user-storage-modal-overlay"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md"
      onClick={onClose}
      dir="rtl"
    >
      <style>{`
        @keyframes userStorageModalIn {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <div
        id="user-storage-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "userStorageModalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)" }}
        className="relative w-full max-w-4xl h-[90vh] max-h-[800px] bg-[#0d0f1b]/95 border border-purple-500/30 rounded-3xl shadow-[0_0_60px_-15px_rgba(168,85,247,0.25)] overflow-hidden flex flex-col font-['Cairo',sans-serif]"
      >
        {/* Hidden asset file input */}
        <input
          ref={assetFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUploadAsset}
        />

        {/* ================= HEADER ================= */}
        <div className="p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-950/40">
          <div className="flex items-center gap-3">
            {/* User Avatar */}
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base text-white shadow-lg shrink-0 border border-white/20"
              style={{ backgroundColor: user?.avatarColor || "#a855f7" }}
            >
              {user ? user.username.substring(0, 2).toUpperCase() : "GU"}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {user ? user.username : "وضع الضيف (تخزين محلي)"}
                </h3>
                {user ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <Cloud className="w-2.5 h-2.5" /> سحابي
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                    <HardDrive className="w-2.5 h-2.5" /> أوفلاين
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {user ? user.email : "احفظ مشاريعك محلياً أو سجّل دخولك لتفعيل السحابة"}
              </p>
            </div>
          </div>

          {/* Quick Storage Quota Preview */}
          {user && (
            <div className="flex items-center gap-3 bg-slate-900/80 px-3.5 py-2 rounded-2xl border border-slate-800">
              <div className="text-right">
                <div className="text-[10px] font-bold text-slate-400">المساحة المستهلكة</div>
                <div className="text-xs font-mono font-bold text-purple-300">
                  {formatBytes(used)} / {formatBytes(quota)}
                </div>
              </div>
              <div className="w-20 bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700/50">
                <div
                  className={`h-full transition-all rounded-full ${
                    usedPct > 85 ? "bg-rose-500" : usedPct > 60 ? "bg-amber-500" : "bg-gradient-to-r from-purple-500 to-indigo-500"
                  }`}
                  style={{ width: `${usedPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================= TABS & ACTIONS ================= */}
        <div className="px-5 py-3 border-b border-slate-800/80 flex items-center justify-between gap-3 bg-[#0c0d17]/50 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("projects")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === "projects"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>مشاريعي ({cloudProjects.length + localProjects.length})</span>
            </button>

            {user && (
              <button
                type="button"
                onClick={() => setActiveTab("assets")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === "assets"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>خزنة وسائطي ({assets.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab("quota")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === "quota"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>تفاصيل المساحة</span>
            </button>
          </div>

          {/* Quick Action Button based on tab */}
          <div className="flex items-center gap-2">
            {activeTab === "projects" && (
              <button
                type="button"
                disabled={isSavingProject}
                onClick={onSaveCurrentProject}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 active:scale-95 shadow-md shadow-purple-900/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSavingProject ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>حفظ المشروع الحالي ({currentProjectName})</span>
              </button>
            )}

            {activeTab === "assets" && user && (
              <button
                type="button"
                disabled={isUploadingAsset}
                onClick={() => assetFileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 active:scale-95 shadow-md shadow-emerald-900/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isUploadingAsset ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>رفع صورة جديدة للخزنة</span>
              </button>
            )}

            {user && (
              <button
                type="button"
                onClick={fetchCloudData}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                title="تحديث البيانات"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>
        </div>

        {/* Status Toast Message */}
        {statusMsg && (
          <div
            className={`mx-5 mt-3 p-3 rounded-xl text-xs font-semibold flex items-center justify-between border ${
              statusMsg.type === "success"
                ? "bg-emerald-950/60 text-emerald-200 border-emerald-500/40"
                : "bg-rose-950/60 text-rose-200 border-rose-500/40"
            }`}
          >
            <span>{statusMsg.text}</span>
            <button
              type="button"
              onClick={() => setStatusMsg(null)}
              className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* ================= CONTENT BODY ================= */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* TAB 1: PROJECTS */}
          {activeTab === "projects" && (
            <div>
              {/* Cloud Projects Section */}
              {user && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <Cloud className="w-3.5 h-3.5" />
                      المشاريع السحابية المتزامنة ({cloudProjects.length})
                    </h4>
                  </div>

                  {cloudProjects.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-slate-900/30 border border-dashed border-slate-800 text-center">
                      <FolderKanban className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                      <p className="text-xs text-slate-400 font-medium">
                        لا توجد مشاريع سحابية محفوظة بعد
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        انقر على "حفظ المشروع الحالي" لحفظ عملك في سحابتك الخاصة
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {cloudProjects.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => handleOpenCloudProject(p.id)}
                          className="group relative bg-[#131525] hover:bg-[#191c32] border border-slate-800 hover:border-purple-500/50 rounded-2xl p-3 flex flex-col transition-all cursor-pointer shadow-md hover:shadow-purple-950/50 hover:scale-[1.01]"
                        >
                          {/* Thumbnail preview */}
                          <div className="w-full h-32 rounded-xl bg-slate-950 border border-slate-800/80 overflow-hidden flex items-center justify-center relative mb-2.5">
                            {p.thumbnailUrl ? (
                              <img
                                src={p.thumbnailUrl}
                                alt={p.title}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <FileImage className="w-8 h-8 text-slate-700" />
                            )}
                            <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-purple-950/90 text-purple-300 border border-purple-500/30">
                              سحابي
                            </span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 flex flex-col justify-between">
                            <div>
                              <div className="font-bold text-xs text-white truncate group-hover:text-purple-300 transition-colors">
                                {p.title}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
                                <span>{p.docWidth} × {p.docHeight} px</span>
                                <span>{formatBytes(p.sizeBytes)}</span>
                              </div>
                            </div>

                            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                              <span className="flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {formatDate(p.updatedAt)}
                              </span>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteCloudProject(p.id, e)}
                                  className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 transition-colors"
                                  title="حذف المشروع"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Local Offline Projects Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                    المشاريع المحفوظة محلياً على المتصفح ({localProjects.length})
                  </h4>
                </div>

                {localProjects.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-900/20 border border-dashed border-slate-800/80 text-center">
                    <p className="text-xs text-slate-500">لا توجد مشاريع محلية مخزنة في متصفحك</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {localProjects.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleOpenLocalProject(p.id)}
                        className="group relative bg-[#111320] hover:bg-[#16182a] border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-3 flex flex-col transition-all cursor-pointer shadow-md hover:scale-[1.01]"
                      >
                        <div className="w-full h-28 rounded-xl bg-slate-950 border border-slate-800/80 overflow-hidden flex items-center justify-center relative mb-2.5">
                          {p.thumbnailUrl ? (
                            <img
                              src={p.thumbnailUrl}
                              alt={p.title}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <FileImage className="w-8 h-8 text-slate-700" />
                          )}
                          <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-900/90 text-cyan-400 border border-cyan-500/30">
                            محلي
                          </span>
                        </div>

                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <div className="font-bold text-xs text-white truncate group-hover:text-cyan-300 transition-colors">
                              {p.title}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
                              <span>{p.docWidth} × {p.docHeight} px</span>
                              <span>{formatBytes(p.sizeBytes)}</span>
                            </div>
                          </div>

                          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {formatDate(p.updatedAt)}
                            </span>

                            <button
                              type="button"
                              onClick={(e) => handleDeleteLocalProject(p.id, e)}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 transition-colors"
                              title="حذف من الجهاز"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ASSETS VAULT */}
          {activeTab === "assets" && user && (
            <div>
              {assets.length === 0 ? (
                <div className="p-12 rounded-3xl bg-slate-900/30 border border-dashed border-slate-800 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl bg-purple-950/50 flex items-center justify-center mb-3 text-purple-400 border border-purple-500/30">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">خزنة وسائطك فارغة حالياً</h4>
                  <p className="text-xs text-slate-400 max-w-sm mb-4">
                    ارفع صورك الخاصة وشعاراتك هنا للوصول إليها وإدراجها كطبقات جديدة في أي مشروع بضغطة زر واحدة
                  </p>
                  <button
                    type="button"
                    onClick={() => assetFileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-900/40 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>رفع أول صورة</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {assets.map((asset) => {
                    const rawUrl = `${API_BASE}${asset.url}?token=${token}`;
                    return (
                      <div
                        key={asset.id}
                        className="group relative bg-[#131525] border border-slate-800 hover:border-purple-500/50 rounded-2xl p-2.5 flex flex-col transition-all overflow-hidden"
                      >
                        <div className="w-full h-32 rounded-xl bg-slate-950 border border-slate-800/80 overflow-hidden flex items-center justify-center relative mb-2">
                          <img
                            src={rawUrl}
                            alt={asset.filename}
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                        </div>

                        <div className="text-[11px] font-bold text-white truncate mb-1" title={asset.filename}>
                          {asset.filename}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center justify-between mb-2">
                          <span>{formatBytes(asset.sizeBytes)}</span>
                          <span>{asset.mimeType.split("/")[1]?.toUpperCase()}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-800/80">
                          {onInsertAssetAsLayer && (
                            <button
                              type="button"
                              onClick={() => {
                                onInsertAssetAsLayer(rawUrl, asset.filename);
                                onClose();
                              }}
                              className="col-span-1 py-1 px-2 rounded-lg text-[10px] font-bold bg-purple-950/80 hover:bg-purple-900 text-purple-200 hover:text-white border border-purple-500/30 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                              title="إدراج كطبقة جديدة في العمل"
                            >
                              <Layers className="w-3 h-3" />
                              <span>إدراج</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteAsset(asset.id, e)}
                            className="col-span-1 py-1 px-2 rounded-lg text-[10px] font-bold bg-slate-900 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            title="حذف من الخزنة"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>حذف</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: QUOTA & DETAILS */}
          {activeTab === "quota" && (
            <div className="max-w-xl mx-auto space-y-5">
              <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4 text-purple-400" />
                  تفاصيل سعة التخزين وحسابك
                </h4>

                <div className="space-y-3 mb-5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">إجمالي الحصة المتاحة:</span>
                    <span className="font-bold text-white font-mono">{formatBytes(quota)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">المساحة المستخدمة حالياً:</span>
                    <span className="font-bold text-purple-300 font-mono">
                      {formatBytes(used)} ({usedPct}%)
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">المساحة المتبقية الشاغرة:</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      {formatBytes(Math.max(0, quota - used))}
                    </span>
                  </div>

                  {/* Visual Bar */}
                  <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700/60 mt-2">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        usedPct > 85 ? "bg-rose-500" : usedPct > 60 ? "bg-amber-500" : "bg-gradient-to-r from-purple-500 to-indigo-500"
                      }`}
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/20 text-xs text-purple-200 leading-relaxed">
                  💡 <strong>ملاحظة تقنية:</strong> يعتمد المحرر على معمارية هجينة تدمج بين التخزين المحلي فائق السرعة والمزامنة السحابية الآمنة لضمان استمرارية عملك حتى عند غياب الاتصال.
                </div>
              </div>

              {user && (
                <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/20 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-rose-200">تسجيل الخروج من الحساب</div>
                    <div className="text-[10px] text-slate-400">
                      يمكنك الاستمرار في استخدام المحرر بالوضع المحلي كضيف
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      onClose();
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-md shadow-rose-900/30"
                  >
                    تسجيل الخروج
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
