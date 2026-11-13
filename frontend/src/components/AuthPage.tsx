import React, { useState } from "react";
import { useAuth, SavedAccount } from "../lib/authContext";
import {
  Sparkles,
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  Cloud,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Users,
  Check,
  Trash2,
  ChevronLeft,
  HardDrive,
  Cpu,
} from "lucide-react";

interface AuthPageProps {
  onBackToStudio: () => void;
  initialMode?: "login" | "register";
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onBackToStudio,
  initialMode = "login",
}) => {
  const {
    user,
    savedAccounts,
    login,
    register,
    switchAccount,
    removeSavedAccount,
    logout,
  } = useAuth();

  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [showAddForm, setShowAddForm] = useState<boolean>(savedAccounts.length === 0);
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login(identifier, password);
        setSuccessMsg("تم تسجيل الدخول بنجاح! جاري نقلك إلى المحرر...");
      } else {
        await register(username, email, password);
        setSuccessMsg("تم إنشاء الحساب ومساحتك السحابية الخاصة بنجاح!");
      }
      setTimeout(() => {
        onBackToStudio();
      }, 700);
    } catch (err: any) {
      setError(err?.message || "حدث خطأ غير متوقع، يرجى التحقق من البيانات");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSwitch = async (targetId: string) => {
    try {
      await switchAccount(targetId);
      setSuccessMsg("تم تبديل الحساب بنجاح! جاري فتح مساحة العمل...");
      setTimeout(() => {
        onBackToStudio();
      }, 600);
    } catch {
      setError("فشل تبديل الحساب");
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full bg-[#090a12] text-slate-100 flex flex-col font-['Cairo',sans-serif] selection:bg-purple-600 selection:text-white relative overflow-x-hidden"
    >
      {/* Dynamic Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(#a855f7 1px, transparent 1px), linear-gradient(to right, #a855f7 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Top Navigation Bar */}
      <header className="relative z-10 w-full border-b border-purple-500/20 bg-[#0d0f1c]/80 backdrop-blur-xl px-4 sm:px-8 py-3.5 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-800 p-0.5 shadow-lg shadow-purple-900/40">
            <div className="w-full h-full rounded-[10px] bg-[#0c0d16] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-white tracking-wide flex items-center gap-2">
              <span>Ultimate Vision Studio</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Cloud Vault
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              إدارة الحسابات، التخزين السحابي الآمن، ومزامنة المشاريع
            </p>
          </div>
        </div>

        {/* Back to Studio CTA */}
        <button
          type="button"
          onClick={onBackToStudio}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-purple-950/60 border border-slate-700/80 hover:border-purple-500/50 text-slate-300 hover:text-white text-xs font-bold transition-all shadow-md cursor-pointer group"
        >
          <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>العودة إلى استوديو التصميم</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-14">
        {/* LEFT COLUMN (Showcase & Value Proposition) */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center space-y-6 text-right">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-950/70 border border-purple-500/40 text-purple-300 text-xs font-semibold w-fit">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>نظام هجين ذكي: عزل تخزيني كامل وأمان فائق</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight">
            مساحتك السحابية الخاصة
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
              لمشاريع الرؤية الحاسوبية والتصميم
            </span>
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed max-w-lg">
            سجّل دخولك لحفظ طبقات التصميم، خوارزميات OpenCV، ووسائطك الخاصة في خزنة سحابية محمية ومستقلة تماماً، مع إمكانية التنقل السلس بين حسابات متعددة كما في المنصات الاحترافية.
          </p>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            <div className="p-4 rounded-2xl bg-[#121424]/80 border border-purple-500/20 backdrop-blur-sm flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white mb-0.5">150MB مساحة مستقلة</h4>
                <p className="text-[11px] text-slate-400 leading-snug">
                  حصة سحابية مجانية لكل حساب لحفظ الأعمال والوسائط.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#121424]/80 border border-purple-500/20 backdrop-blur-sm flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white mb-0.5">حفظ كامل الطبقات</h4>
                <p className="text-[11px] text-slate-400 leading-snug">
                  استعادة مساحات العمل والأقنعة والفلاتر بدقة بكسلية تامة.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#121424]/80 border border-purple-500/20 backdrop-blur-sm flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white mb-0.5">خصوصية وعزل كامل</h4>
                <p className="text-[11px] text-slate-400 leading-snug">
                  مشاريع كل حساب مفصولة سحابياً ومحلياً لمنع أي تداخل.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#121424]/80 border border-purple-500/20 backdrop-blur-sm flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white mb-0.5">تبديل حسابات سريع</h4>
                <p className="text-[11px] text-slate-400 leading-snug">
                  انتقل بين حسابات العمل والحساب الشخصي بنقرة زر واحدة.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (Card: Multi-Account Switcher & Auth Forms) */}
        <div className="w-full lg:w-1/2 max-w-md">
          <div className="relative bg-[#0e101f]/95 border border-purple-500/30 rounded-3xl shadow-[0_0_60px_-10px_rgba(168,85,247,0.25)] backdrop-blur-2xl p-6 sm:p-8 overflow-hidden">
            {/* Ambient inner glow */}
            <div className="absolute -top-20 -left-20 w-44 h-44 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

            {/* Notification Alerts */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* MULTI-ACCOUNT SWITCHER LIST (If user has saved accounts) */}
            {savedAccounts.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span>الحسابات المحفوظة على هذا الجهاز ({savedAccounts.length})</span>
                  </div>
                  {showAddForm && (
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer"
                    >
                      عرض الحسابات
                    </button>
                  )}
                </div>

                {!showAddForm ? (
                  <div className="space-y-2">
                    {savedAccounts.map((account: SavedAccount) => {
                      const isActive = user?.id === account.user.id;
                      return (
                        <div
                          key={account.user.id}
                          className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                            isActive
                              ? "bg-purple-950/40 border-purple-500/60 shadow-md shadow-purple-950/50"
                              : "bg-slate-900/60 border-slate-800 hover:border-purple-500/30 hover:bg-slate-900/90"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow shrink-0 border border-white/20"
                              style={{ backgroundColor: account.user.avatarColor || "#a855f7" }}
                            >
                              {account.user.username.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-xs truncate">
                                  {account.user.username}
                                </span>
                                {isActive && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    نشط الآن
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 block truncate">
                                {account.user.email}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isActive ? (
                              <button
                                type="button"
                                onClick={onBackToStudio}
                                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md cursor-pointer transition-colors"
                              >
                                فتح المحرر
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleQuickSwitch(account.user.id)}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-purple-600 hover:text-white text-slate-300 font-semibold text-xs border border-slate-700 cursor-pointer transition-all"
                              >
                                تبديل
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => removeSavedAccount(account.user.id)}
                              title="إزالة الحساب من هذا الجهاز"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Add Another Account Trigger */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(true);
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      className="w-full py-2.5 px-4 mt-3 rounded-xl border border-dashed border-purple-500/40 hover:border-purple-400 text-purple-300 hover:text-white hover:bg-purple-950/30 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <UserIcon className="w-3.5 h-3.5" />
                      <span>تسجيل الدخول بحساب آخر +</span>
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {/* LOGIN / REGISTER FORM */}
            {(showAddForm || savedAccounts.length === 0) && (
              <div>
                {/* Header title */}
                <div className="mb-5 text-center">
                  <h3 className="text-xl font-bold text-white">
                    {mode === "login" ? "تسجيل الدخول إلى حسابك" : "إنشاء حساب سحابي جديد"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {mode === "login"
                      ? "أدخل بياناتك لفتح مساحتك التخزينية ومشاريعك"
                      : "احصل فوراً على 150MB سحابية آمنة ومستقلة"}
                  </p>
                </div>

                {/* Mode switcher tabs */}
                <div className="grid grid-cols-2 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 mb-5 text-xs font-bold">
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
                    إنشاء حساب
                  </button>
                </div>

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
                          className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all font-mono"
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
                          className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all font-mono"
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
                          className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all"
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
                        className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pr-10 pl-10 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all font-mono"
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
                    className="w-full mt-2 py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-purple-900/50 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
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

                {/* Cancel add account if other accounts exist */}
                {savedAccounts.length > 0 && (
                  <div className="mt-3 text-center">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      إلغاء والعودة للحسابات المحفوظة
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Actions: Guest Bypass & Sign Out All */}
            <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col gap-2.5 text-center">
              <button
                type="button"
                onClick={onBackToStudio}
                className="text-xs text-slate-400 hover:text-purple-300 transition-colors cursor-pointer"
              >
                المتابعة كضيف مؤقتاً والعمل محلياً ←
              </button>

              {savedAccounts.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("هل أنت متأكد من تسجيل الخروج من جميع الحسابات المحفوظة على هذا الجهاز؟")) {
                      logout(true);
                      setShowAddForm(true);
                    }
                  }}
                  className="text-[11px] text-rose-400/80 hover:text-rose-300 transition-colors cursor-pointer"
                >
                  تسجيل الخروج من كافة الحسابات
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
