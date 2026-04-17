import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import stnLogo from "../assets/stn logo.png";

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function ChangePassword({ setCurrentUser }) {
  const navigate = useNavigate();
  const user = JSON.parse(sessionStorage.getItem("stn_user") || "null");

  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [show, setShow] = useState({ new: false, confirm: false });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { newPassword, confirmPassword } = form;

    if (!newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!user?.id) {
      setError("Session expired. Please log in again.");
      return;
    }

    setLoading(true);
    try {
      const hashed = await hashPassword(newPassword);
      const { data, error: dbError } = await supabase
        .from("users")
        .update({ password: hashed, must_change_password: false })
        .eq("id", user.id)
        .select("id");

      if (dbError) {
        console.error("[ChangePassword] DB error:", dbError);
        setError(`DB error: ${dbError.message}`);
        return;
      }

      if (!data || data.length === 0) {
        setError("Update blocked — check Supabase RLS: missing UPDATE policy on users table.");
        return;
      }

      const updatedUser = { ...user, must_change_password: false };
      sessionStorage.setItem("stn_user", JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("[ChangePassword]", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 w-full max-w-sm p-8">
        <div className="flex justify-center mb-6">
          <img src={stnLogo} alt="STN Logo" className="h-16 w-auto object-contain" />
        </div>

        <div className="flex items-center justify-center gap-2 mb-1">
          <KeyRound size={18} className="text-teal-500" />
          <h2 className="text-lg font-bold text-slate-800">Change Password</h2>
        </div>
        <p className="text-xs text-slate-400 text-center mb-6">
          You must set a new password before continuing.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={show.new ? "text" : "password"}
                name="newPassword"
                value={form.newPassword}
                onChange={handleChange}
                placeholder="Minimum 8 characters"
                className="w-full px-3 py-2.5 pr-10 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
                autoComplete="new-password"
                autoFocus
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShow((s) => ({ ...s, new: !s.new }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {show.new ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={show.confirm ? "text" : "password"}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter new password"
                className="w-full px-3 py-2.5 pr-10 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
                autoComplete="new-password"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {show.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-500 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-teal-300 text-white font-semibold text-sm py-2.5 rounded-lg transition-all duration-200 mt-2"
          >
            {loading ? "Saving..." : "Set New Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
