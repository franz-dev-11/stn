import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import stnLogo from "../assets/stn logo.png";
// Note: Navigation after login is handled by App.jsx route guards.
// Login only authenticates; App.jsx detects the session change and redirects.

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");

    try {
      console.log("[Login] Attempting signInWithPassword…");
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        console.error("[Login] Auth failed:", authError.message);
        setError(authError.message || "Invalid credentials");
        return;
      }

      console.log("[Login] Auth success, checking approval status…");

      // Query profile with the fresh session to decide where to redirect.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("approval_status")
        .eq("id", authData.user.id)
        .maybeSingle();

      console.log("[Login] Profile:", profile, "Error:", profileError);

      if (profileError) {
        // RLS is blocking the read — route to dashboard and let the app handle it.
        console.warn(
          "[Login] Profile query blocked (RLS?), routing to dashboard.",
        );
        navigate("/dashboard", { replace: true });
        return;
      }

      if (profile?.approval_status === "pending") {
        navigate("/pending-approval", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      if (err instanceof TypeError && /Failed to fetch/i.test(err.message)) {
        setError(
          "Cannot connect to Supabase. Check VITE_SUPABASE_URL in .env and restart the app.",
        );
      } else {
        setError("An unexpected error occurred");
      }
    }
  };

  const handlePasswordReset = async () => {
    setError("");
    setInfoMessage("");

    if (!email.trim()) {
      setError("Enter your email address first to reset your password.");
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      },
    );

    if (resetError) {
      setError(resetError.message || "Unable to send reset email.");
      return;
    }

    setInfoMessage("Password reset instructions have been sent to your email.");
  };

  return (
    <div className='min-h-screen bg-[#d8ece8] px-4 py-6 sm:px-6 lg:px-10'>
      <div className='mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_rgba(7,64,60,0.18)]'>
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
                Sign in to your account
              </h1>
              <p className='mt-2 text-center text-sm text-teal-50/75 lg:text-left'>
                Access inventory, scheduling, pricing, and sales operations.
              </p>
            </div>

            <form onSubmit={handleSubmit} className='space-y-5'>
              <label className='block'>
                <span className='mb-2 block text-xs font-medium uppercase tracking-[0.22em] text-white/70'>
                  Email address
                </span>
                <input
                  type='email'
                  placeholder='Enter your email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className='w-full rounded-xl border border-white/18 bg-[#0a5f5a] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/45 focus:bg-[#08534f]'
                />
              </label>

              <div className='block'>
                <span className='mb-2 block text-xs font-medium uppercase tracking-[0.22em] text-white/70'>
                  Password
                </span>
                <div className='relative'>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder='Enter your password'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className='w-full rounded-xl border border-white/18 bg-[#0a5f5a] px-4 py-3 pr-11 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/45 focus:bg-[#08534f]'
                  />
                  <button
                    type='button'
                    onClick={() => setShowPassword((v) => !v)}
                    className='absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/90 transition'
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg xmlns='http://www.w3.org/2000/svg' className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
                        <path strokeLinecap='round' strokeLinejoin='round' d='M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7s4-7 9-7a9.967 9.967 0 015.657 1.757M15 12a3 3 0 11-4.243-4.243M3 3l18 18' />
                      </svg>
                    ) : (
                      <svg xmlns='http://www.w3.org/2000/svg' className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
                        <path strokeLinecap='round' strokeLinejoin='round' d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
                        <path strokeLinecap='round' strokeLinejoin='round' d='M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className='flex flex-col gap-3 text-sm text-white/80 sm:flex-row sm:items-center sm:justify-between'>
                <label className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className='h-4 w-4 rounded border-white/30 bg-transparent text-white accent-[#d8ece8]'
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type='button'
                  onClick={handlePasswordReset}
                  className='text-left font-medium text-[#dff7f3] transition hover:text-white hover:underline sm:text-right'
                >
                  Forgot password?
                </button>
              </div>

              {error && (
                <div className='rounded-xl border border-red-300/35 bg-red-500/10 px-4 py-3 text-sm text-red-100'>
                  {error}
                </div>
              )}

              {infoMessage && (
                <div className='rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50'>
                  {infoMessage}
                </div>
              )}

              <button
                type='submit'
                className='w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold tracking-[0.2em] text-[#0d6f69] uppercase transition hover:bg-[#eef8f5] cursor-pointer active:scale-[0.99]'
              >
                Sign in
              </button>
            </form>

            <p className='mt-7 text-center text-sm text-white/75 lg:text-left'>
              Need an account?{" "}
              <button
                type='button'
                onClick={() => navigate("/signup")}
                className='font-semibold text-white transition hover:underline'
              >
                Request access
              </button>
            </p>
          </div>
        </section>

        <section className='relative hidden overflow-hidden bg-[#f5fbfa] lg:flex lg:w-[62%] lg:items-center lg:justify-center'>
          <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(28,195,184,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(13,111,105,0.24),transparent_38%)]' />
          <div className='absolute -left-12 top-0 h-40 w-80 rotate-[-28deg] bg-[#0d6f69]' />
          <div className='absolute -left-6 top-12 h-24 w-72 rotate-[-28deg] bg-white/95' />
          <div className='absolute -left-2 top-20 h-14 w-64 rotate-[-28deg] bg-[#48c9c2]' />
          <div className='absolute -right-24 -top-16 h-64 w-64 rounded-full bg-[#dff7f3] blur-2xl' />
          <div className='absolute -right-20 -bottom-8 h-72 w-72 rounded-full bg-[#7fd8d1]/30 blur-3xl' />
          <div className='absolute -right-16 bottom-12 h-24 w-72 rotate-[-28deg] bg-[#0d6f69]' />
          <div className='absolute right-0 bottom-0 h-16 w-64 rotate-[-28deg] bg-[#48c9c2]' />
          <div className='absolute left-[14%] top-[10%] h-[68%] w-[72%] rotate-12 rounded-[36px] bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(229,249,246,0.7))] opacity-80 shadow-[0_30px_60px_rgba(72,201,194,0.16)]' />
          <div className='absolute left-[23%] top-[17%] h-[58%] w-[55%] -rotate-16 rounded-4xl bg-[linear-gradient(135deg,rgba(85,209,202,0.14),rgba(255,255,255,0.75))]' />

          <div className='relative z-10 flex max-w-xl flex-col items-center px-12 text-center text-[#0a3734]'>
            <img
              src={stnLogo}
              alt='STN Trading'
              className='h-44 w-44 object-contain drop-shadow-[0_24px_30px_rgba(13,111,105,0.15)]'
            />
            <p className='mt-8 text-[0.82rem] font-semibold uppercase tracking-[0.65em] text-[#0d6f69]/70'>
              STN Trading
            </p>
            <h2 className='mt-4 text-5xl font-black uppercase tracking-[0.12em] text-[#083f3b]'>
              Welcome Back
            </h2>
            <p className='mt-5 max-w-md text-base leading-7 text-[#285c58]'>
              Centralized access to warehouse operations, order scheduling,
              inventory, and sales records in one workspace.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Login;
