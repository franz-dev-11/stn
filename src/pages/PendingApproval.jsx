import React from "react";
import { useNavigate } from "react-router-dom";
import { Clock, LogOut, ShieldCheck } from "lucide-react";
import { insertAuditTrail, getSessionUser, getPerformedBy } from "../utils/auditTrail";
import stnLogo from "../assets/stn logo.png";

const PendingApproval = ({ setCurrentUser }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    const user = getSessionUser();
    await insertAuditTrail([{
      action: "Logout",
      module: "Authentication",
      performed_by: getPerformedBy(user),
      details: `User "${user?.username}" signed out from pending approval screen.`,
    }]);
    sessionStorage.removeItem("stn_user");
    if (setCurrentUser) setCurrentUser(null);
    navigate("/login", { replace: true });
  };

  return (
    <div className='min-h-screen bg-[#d8ece8] px-4 py-6 sm:px-6 lg:px-10'>
      <div className='mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl overflow-visible rounded-2xl sm:rounded-[28px] bg-white shadow-[0_30px_80px_rgba(7,64,60,0.18)] lg:overflow-hidden'>
        <div className='relative flex w-full flex-col justify-center bg-[#0d6f69] px-8 py-10 text-white sm:px-12 lg:w-[38%] lg:px-14'>
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
                Account Pending Approval
              </h1>
              <p className='mt-2 text-center text-sm text-teal-50/75 lg:text-left'>
                Your access request is under review.
              </p>
            </div>

            <div className='space-y-6'>
              <div className='flex items-start gap-4 rounded-xl border border-white/18 bg-[#0a5f5a] px-4 py-4'>
                <div className='shrink-0'>
                  <Clock size={20} className='text-amber-300 animate-pulse' />
                </div>
                <div>
                  <p className='text-[10px] font-black uppercase tracking-[0.12em] text-white/70'>
                    Status
                  </p>
                  <p className='mt-1 text-sm font-semibold text-white'>
                    Waiting for Super Admin approval
                  </p>
                  <p className='mt-2 text-xs text-teal-200'>
                    Thank you for registering! Your account is currently being reviewed. You will gain access once approved.
                  </p>
                </div>
              </div>

              <div className='flex items-start gap-3 rounded-xl bg-white/10 px-4 py-3'>
                <ShieldCheck size={16} className='mt-0.5 shrink-0 text-white/60' />
                <p className='text-[11px] font-semibold text-white/80'>
                  Estimated wait time: <span className='text-white'>24-48 hours</span>
                </p>
              </div>

              <button
                onClick={handleLogout}
                className='w-full flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold tracking-[0.2em] text-[#0d6f69] uppercase transition hover:bg-[#eef8f5] cursor-pointer active:scale-[0.99]'
              >
                <LogOut size={16} /> Back to Login
              </button>
            </div>
          </div>
        </div>

        <div className='relative hidden overflow-hidden bg-[#f5fbfa] lg:flex lg:w-[62%] lg:items-center lg:justify-center'>
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
            <div className='mb-8 flex h-32 w-32 items-center justify-center rounded-full bg-white/80 shadow-lg'>
              <Clock size={64} className='animate-pulse text-amber-500' />
            </div>
            <p className='text-[0.82rem] font-semibold uppercase tracking-[0.65em] text-[#0d6f69]/70'>
              Under Review
            </p>
            <h2 className='mt-4 text-5xl font-black uppercase tracking-[0.12em] text-[#083f3b]'>
              Stay Tuned
            </h2>
            <p className='mt-5 max-w-md text-base leading-7 text-[#285c58]'>
              Your registration details are being verified by our Super Admin. We'll notify you as soon as your account is approved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;
