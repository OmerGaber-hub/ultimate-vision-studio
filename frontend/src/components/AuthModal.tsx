import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../lib/authContext";
import {
  X,
  Lock,
  Mail,
  User as UserIcon,
  Sparkles,
  Eye,
  EyeOff,
  Cloud,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "register";
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = "login",
}) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login(identifier, password);
        setSuccessMsg("تم تسجيل الدخول بنجاح!");
      } else {
        await register(username, email, password);
        setSuccessMsg("تم إنشاء الحساب ومساحتك التخزينية بنجاح!");
      }
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err?.message || "حدث خطأ غير متوقع، يرجى المحاولة لاحقاً");
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      id="auth-modal-overlay"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      onClick={onClose}
      dir="rtl"
    >
      <style>{`
        @keyframes authModalIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <div
        id="auth-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "authModalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)" }}
        className="relative w-full max-w-md bg-[#0e101c]/95 border border-purple-500/30 rounded-3xl shadow-[0_0_50px_-10px_rgba(168,85,247,0.3)] overflow-hidden flex flex-col p-6 sm:p-8"
      >
        {/* Ambient Glows */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-600/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-600/30 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 left-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 p-0.5 shadow-lg shadow-purple-900/50 mb-3 flex items-center justify-center">
            <div className="w-full h-full rounded-[14px] bg-[#0c0d16] flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-purple-400 animate-pulse" />
            </div>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide font-['Cairo',sans-serif]">
            {mode === "login" ? "تسجيل الدخول إلى حسابك" : "إنشاء مساحة سحابية خاصة"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {mode === "login"
              ? "مرحباً بعودتك! افتح مشاريعك المحفوظة ووسائطك من أي جهاز"
              : "احصل على مساحة تخزين خاصة لحفظ مشاريعك وطبقاتك بأمان"}
          </p>
        </div>

        {/* Tabs Switcher */}
        <div className="grid grid-cols-2 p-1 bg-slate-900/80 rounded-2xl border border-slate-800 mb-5 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`py-2.5 rounded-xl transition-all cursor-pointer ${
              mode === "login"
                ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={`py-2.5 rounded-xl transition-all cursor-pointer ${
              mode === "register"
                ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            حساب جديد
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2 animate-in fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "register" && (
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                اسم المستخدم
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: omer_artist"
                  className="w-full bg-slate-900/70 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all font-mono"
                />
                <UserIcon className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
              </div>
            </div>
          )}

          {mode === "register" ? (
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-900/70 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all font-mono"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                البريد الإلكتروني أو اسم المستخدم
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="أدخل بريدك أو اسم المستخدم"
                  className="w-full bg-slate-900/70 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/70 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pr-10 pl-10 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all font-mono"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-3 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-purple-900/50 cursor-pointer disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>{mode === "login" ? "دخول إلى المحرر" : "إنشاء الحساب وتفعيل المساحة"}</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </>
            )}
          </button>
        </form>

        {/* Benefits Footer */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[10px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Cloud className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>150MB مساحة سحابية خاصة</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>حفظ كامل طبقات التصميم</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>تشفير آمن وحماية قصوى</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>إمكانية العمل المحلي أوفلاين</span>
          </div>
        </div>

        {/* Guest fallback button */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
          >
            المتابعة كضيف مؤقتاً والعمل محلياً ←
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
