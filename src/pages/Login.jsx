import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { insertAuditTrail, getPerformedBy } from "../utils/auditTrail";
import { Eye, EyeOff } from "lucide-react";
import stnLogo from "../assets/stn logo.png";

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function Login({ setCurrentUser }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const username = form.username.trim();
    const password = form.password;

    if (!username || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      const hashed = await hashPassword(password);

      const { data, error: dbError } = await supabase
        .from("users")
        .select("id, employee_id, first_name, last_name, role, username, must_change_password")
        .eq("username", username)
        .eq("password", hashed)
        .maybeSingle();

      if (dbError) throw dbError;

      if (!data) {
        setError("Invalid username or password.");
        return;
      }

      sessionStorage.setItem("stn_user", JSON.stringify(data));
      setCurrentUser(data);
      await insertAuditTrail([{
        action: "Login",
        module: "Authentication",
        performed_by: getPerformedBy(data),
        details: `User "${data.username}" logged in.`,
      }]);
      navigate(data.must_change_password ? "/change-password" : "/dashboard", { replace: true });
    } catch (err) {
      console.error("[Login]", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl flex rounded-2xl overflow-hidden shadow-2xl min-h-[600px]">

      {/* ── Left Panel ── */}
      <div className="w-full md:w-[42%] bg-[#1b6b5c] flex flex-col justify-center px-10 py-14 relative overflow-hidden">

        {/* Brand */}
        <div className="mb-10 flex flex-col items-start">
          <img src={stnLogo} alt="STN Logo" className="h-14 w-auto object-contain mb-3 brightness-0 invert opacity-90" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-8 leading-snug">
          Sign in to your account
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label className="block text-[13px] font-medium text-white/80 mb-1.5">
              Username:
            </label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              className="w-full px-4 py-2.5 text-sm bg-white/95 border border-transparent rounded outline-none focus:ring-2 focus:ring-teal-300 transition placeholder:text-slate-400"
              autoComplete="username"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-white/80 mb-1.5">
              Password:
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                className="w-full px-4 py-2.5 pr-11 text-sm bg-white/95 border border-transparent rounded outline-none focus:ring-2 focus:ring-teal-300 transition placeholder:text-slate-400"
                autoComplete="current-password"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-200 bg-red-900/30 border border-red-500/30 rounded px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2d8c79]/70 hover:bg-[#2d8c79] disabled:opacity-50 border border-white/20 text-white font-semibold text-sm py-2.5 rounded transition-all duration-200"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>

      {/* ── Right Panel — Decorative ── */}
      <div className="hidden md:flex md:flex-1 bg-white relative overflow-hidden items-center justify-center">

        {/* Brush stroke layers */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Teal wide stroke — top right */}
          <div
            className="absolute bg-teal-400/30"
            style={{ width: "200%", height: "38%", top: "-8%", right: "-40%", transform: "rotate(-18deg)", borderRadius: "40%" }}
          />
          {/* Dark teal stroke — top right overlap */}
          <div
            className="absolute bg-teal-700/20"
            style={{ width: "160%", height: "22%", top: "0%", right: "-30%", transform: "rotate(-18deg)", borderRadius: "40%" }}
          />
          {/* Sage green stroke — upper left */}
          <div
            className="absolute bg-[#6b9e7e]/25"
            style={{ width: "55%", height: "55%", top: "-15%", left: "-8%", transform: "rotate(-18deg)", borderRadius: "40%" }}
          />
          {/* Gray-olive stroke — middle right */}
          <div
            className="absolute bg-slate-400/15"
            style={{ width: "70%", height: "30%", top: "32%", right: "-15%", transform: "rotate(-18deg)", borderRadius: "40%" }}
          />
          {/* Aqua stroke — center bottom */}
          <div
            className="absolute bg-cyan-300/35"
            style={{ width: "190%", height: "42%", bottom: "-10%", left: "-40%", transform: "rotate(-18deg)", borderRadius: "40%" }}
          />
          {/* Teal bottom accent */}
          <div
            className="absolute bg-teal-600/20"
            style={{ width: "140%", height: "20%", bottom: "4%", right: "-25%", transform: "rotate(-18deg)", borderRadius: "40%" }}
          />
          {/* Olive top-left accent */}
          <div
            className="absolute bg-[#8aab8a]/15"
            style={{ width: "40%", height: "18%", top: "8%", left: "-5%", transform: "rotate(-18deg)", borderRadius: "40%" }}
          />
        </div>

        {/* Center brand mark */}
        <div className="relative z-10 flex flex-col items-center select-none">
          <div className="w-36 h-36 bg-[#1b6b5c] rounded-2xl flex items-center justify-center shadow-2xl mb-6">
            <img src={stnLogo} alt="STN" className="h-20 w-auto object-contain brightness-0 invert" />
          </div>
          <p className="text-[10px] font-bold tracking-[0.3em] text-slate-400 uppercase">Powered by STN</p>
        </div>

        {/* Bottom-right powered by */}
        <div className="absolute bottom-5 right-6 z-10">
          <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">
            Powered by <span className="text-slate-600">STN</span>
          </span>
        </div>
      </div>

      </div>
    </div>
  );
}
