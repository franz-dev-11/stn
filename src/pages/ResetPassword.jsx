import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import stnLogo from "../assets/stn logo.png";
import { Eye, EyeOff, Check, AlertCircle } from "lucide-react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invalidResetLink = !searchParams.get("code");

  const displayError =
    error ||
    (invalidResetLink
      ? "Invalid reset link. Please request a new password reset."
      : "");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (invalidResetLink) {
      return;
    }

    // Validation
    if (!password || !confirmPassword) {
      setError("Both password fields are required.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message || "Failed to reset password.");
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 2000);
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className='min-h-screen bg-[#d8ece8] px-4 py-6 sm:px-6 lg:px-10'>
      <div className='mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl overflow-visible rounded-2xl sm:rounded-[28px] bg-white shadow-[0_30px_80px_rgba(7,64,60,0.18)] lg:overflow-hidden'>
        {/* Left Panel - Teal with Form */}
        <section className='relative flex w-full flex-col justify-center bg-[#0d6f69] px-8 py-10 text-white sm:px-12 lg:w-[38%] lg:px-14'>
          <div className='absolute inset-y-0 right-0 hidden w-px bg-white/10 lg:block' />

          <div className='relative z-10 mx-auto flex w-full max-w-sm flex-col'>
            <div className='mb-8 flex flex-col items-center lg:items-start'>
              <img
                src={stnLogo}
                alt='STN Trading'
                className='mb-5 h-20 w-20 rounded-2xl border border-white/15 bg-white/10 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.16)]'
              />
              <p className='text-center text-[0.72rem] font-semibold uppercase tracking-[0.38em] text-white/70 lg:text-left'>
                STN Trading
              </p>
              <h1 className='mt-3 text-center text-3xl font-semibold tracking-tight lg:text-left'>
                Reset your password
              </h1>
              <p className='mt-2 text-center text-sm text-teal-50/75 lg:text-left'>
                Enter your new password below to regain access to your account.
              </p>
            </div>

            {success ? (
              <div className='flex flex-col items-center justify-center space-y-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-6 py-8'>
                <Check size={48} className='text-emerald-400' />
                <div className='text-center'>
                  <h2 className='font-semibold text-white'>Password reset successful!</h2>
                  <p className='mt-2 text-sm text-teal-50/75'>Redirecting to login...</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className='space-y-5'>
                {/* New Password */}
                <label className='block'>
                  <span className='mb-2 block text-xs font-medium uppercase tracking-[0.22em] text-white/70'>
                    New Password
                  </span>
                  <div className='relative'>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder='Enter new password'
                      disabled={isLoading}
                      className='w-full border border-white/18 bg-white/10 px-4 py-3 text-white placeholder-white/40 outline-none transition-all focus:border-white/40 focus:ring-1 focus:ring-white/20 disabled:opacity-50'
                    />
                    <button
                      type='button'
                      onClick={() => setShowPassword(!showPassword)}
                      className='absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/80'
                      disabled={isLoading}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                {/* Confirm Password */}
                <label className='block'>
                  <span className='mb-2 block text-xs font-medium uppercase tracking-[0.22em] text-white/70'>
                    Confirm Password
                  </span>
                  <div className='relative'>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder='Confirm new password'
                      disabled={isLoading}
                      className='w-full border border-white/18 bg-white/10 px-4 py-3 text-white placeholder-white/40 outline-none transition-all focus:border-white/40 focus:ring-1 focus:ring-white/20 disabled:opacity-50'
                    />
                    <button
                      type='button'
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className='absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/80'
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                {/* Error Message */}
                {displayError && (
                  <div className='flex items-start gap-3 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3'>
                    <AlertCircle size={18} className='mt-0.5 shrink-0 text-red-300' />
                    <p className='text-sm text-red-100'>{displayError}</p>
                  </div>
                )}

                {/* Password Requirements */}
                <div className='rounded-lg bg-white/5 px-4 py-3'>
                  <p className='mb-2 text-xs font-medium text-white/70'>Password requirements:</p>
                  <ul className='space-y-1 text-xs text-white/60'>
                    <li className={`${password.length >= 6 ? "text-emerald-400" : ""}`}>
                      • At least 6 characters
                    </li>
                    <li className={`${password === confirmPassword && password.length > 0 ? "text-emerald-400" : ""}`}>
                      • Passwords match
                    </li>
                  </ul>
                </div>

                {/* Submit Button */}
                <button
                  type='submit'
                  disabled={
                    isLoading ||
                    invalidResetLink ||
                    !password ||
                    !confirmPassword ||
                    password !== confirmPassword
                  }
                  className='w-full bg-white px-4 py-3 font-semibold text-[#0d6f69] outline-none transition-all hover:bg-white/90 disabled:opacity-50'
                >
                  {isLoading ? "Resetting..." : "Reset Password"}
                </button>
              </form>
            )}

            {/* Back to Login Link */}
            <div className='mt-8 text-center'>
              <p className='text-sm text-white/70'>
                Remember your password?{" "}
                <button
                  onClick={() => navigate("/login")}
                  className='font-semibold text-white hover:text-white/80 underline underline-offset-2'
                >
                  Sign in
                </button>
              </p>
            </div>
          </div>
        </section>

        {/* Right Panel - Light Branded Background */}
        <section className='relative hidden flex-col items-center justify-center bg-gradient-to-br from-[#f5fbfa] via-[#eaf7f5] to-[#d8ece8] px-8 py-10 sm:px-12 lg:flex lg:w-[62%]'>
          {/* Decorative circles and shapes */}
          <div className='absolute inset-0 overflow-hidden'>
            <div className='absolute -right-40 -top-40 h-96 w-96 rounded-full bg-gradient-radial from-teal-200/20 to-transparent blur-3xl' />
            <div className='absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-gradient-radial from-blue-200/10 to-transparent blur-3xl' />
            <div className='absolute right-1/4 bottom-1/4 h-64 w-64 rounded-full bg-gradient-radial from-cyan-200/15 to-transparent blur-3xl' />
          </div>

          {/* Content */}
          <div className='relative z-10 flex flex-col items-center space-y-6 text-center'>
            <div className='flex h-32 w-32 items-center justify-center rounded-full border-4 border-teal-300/20 bg-gradient-to-br from-teal-300/10 to-cyan-300/5'>
              <div className='h-16 w-16 rounded-full border-2 border-teal-400/30 flex items-center justify-center'>
                <div className='h-10 w-10 rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 animate-pulse' />
              </div>
            </div>

            <div>
              <h2 className='text-3xl font-bold text-slate-800'>Secure Your Access</h2>
              <p className='mt-3 text-base text-slate-600'>
                Update your password to maintain the security of your STN Trading account
              </p>
            </div>

            <div className='mt-6 space-y-3 rounded-lg border border-teal-200/20 bg-white/40 px-6 py-4 backdrop-blur-sm'>
              <p className='text-sm font-semibold text-slate-700'>Security Tips:</p>
              <ul className='space-y-2 text-sm text-slate-600'>
                <li>• Use a strong, unique password</li>
                <li>• Never share your password with anyone</li>
                <li>• Change your password regularly</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ResetPassword;
