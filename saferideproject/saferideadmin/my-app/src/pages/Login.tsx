import { useState } from "react";
import { loginUser } from "../services/api";
import { setToken } from "../utils/auth";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, Loader2, LogIn } from "lucide-react";

interface LoginForm {
  email: string;
  password: string;
}

export default function Login() {
  const [form, setForm] = useState<LoginForm>({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await loginUser(form);
      const token = res.data?.token || res.data?.data?.token;
      if (!token) {
        setError(res.data?.message || "Login failed: no token received");
        return;
      }
      setToken(token);
      navigate("/dashboard");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] px-4 py-10">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="z-10 w-full max-w-[420px]"
      >
        <div className="bg-[#0f172a]/60 backdrop-blur-3xl border border-white/10 shadow-2xl rounded-[2rem] p-6 sm:p-8 md:p-10">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-5 shadow-lg shadow-blue-500/20">
              <LogIn className="text-white w-6 h-6" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Welcome Back
            </h2>

            <p className="text-slate-400 mt-2 text-sm">
              Enter your credentials to access admin panel
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#f87171", marginBottom: 16, textAlign: "center" }}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            
            {/* Email */}
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-widest ml-1">
                Email Address
              </label>

              <div className="relative mt-2">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />

                <input
                  required
                  type="email"
                  placeholder="admin@company.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/50 border border-white/5 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">
                  Password
                </label>

                <a
                  href="#"
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Forgot?
                </a>
              </div>

              <div className="relative mt-2">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />

                <input
                  required
                  type="password"
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/50 border border-white/5 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Button */}
            <button
              disabled={loading}
              type="submit"
              className="w-full py-3.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-5 border-t border-white/5 text-center">
            <p className="text-slate-600 text-[10px] uppercase tracking-[0.2em]">
              © 2026 Admin Dashboard
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}