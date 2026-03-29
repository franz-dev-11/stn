import React, { Suspense, lazy, useState, useEffect } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { initializeAvatarStorage } from "./utils/avatarStorage";
import { Menu, X } from "lucide-react";

// Components & Pages
import Sidebar from "./components/Sidebar";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Purchasing = lazy(() => import("./pages/Procurement/Purchasing"));
const PurchaseHistory = lazy(() => import("./pages/PurchaseHistory"));
const InboundDelivery = lazy(() => import("./pages/InboundScheduling"));
const OutboundDelivery = lazy(() => import("./pages/OutboundScheduling"));
const InvoiceHistory = lazy(() => import("./pages/InvoiceHistory"));
const RecordSales = lazy(() => import("./pages/PointofSales/RecordSales"));
const Inventory = lazy(() => import("./pages/Inventory"));
const ItemAction = lazy(() => import("./pages/ItemAction"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));

const AppLayout = ({ session }) => {
  const [currentPage, setCurrentPage] = useState("Dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!session) return <Navigate to='/login' replace />;

  return (
    <div className='flex h-screen w-full overflow-hidden'>
      <button
        className='fixed top-6 right-6 z-[60] md:hidden flex items-center justify-center p-2 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-all duration-300'
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label='Toggle menu'
      >
        {isMobileMenuOpen ? (
          <X size={20} className='transition-transform duration-300' />
        ) : (
          <Menu size={20} className='transition-transform duration-300' />
        )}
      </button>
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />
      <div className='flex-1 flex flex-col overflow-y-auto overflow-x-hidden'>
        <Outlet />
      </div>
    </div>
  );
};

function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [approvalStatus, setApprovalStatus] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const isPending = approvalStatus === "pending";

  // --- ADDED STATES FOR QR SYSTEM NAVIGATION ---
  const [inventoryView, setInventoryView] = useState("Inventory");
  const [selectedPO, setSelectedPO] = useState(null);

  // Auth listener — synchronous, never awaits anything.
  // Sets session + isAuthReady immediately so route guards never get stuck.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setIsAuthReady(true);
      if (!newSession) {
        setApprovalStatus(null);
        setUserRole(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Initialize avatar storage bucket on app launch
  useEffect(() => {
    initializeAvatarStorage().catch((err) => {
      console.warn("[App] Avatar storage init warning:", err.message);
      // Non-blocking; app continues without avatars if this fails
    });
  }, []);

  // Profile fetch — runs whenever the logged-in user changes.
  // Non-blocking: route guards don't wait on this.
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from("profiles")
      .select("approval_status, role")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.warn("[App] Profile fetch failed:", error.message);
          return;
        }
        console.log("[App] Profile loaded:", data);
        setApprovalStatus(data?.approval_status ?? null);
        setUserRole(data?.role ?? null);
      });
  }, [session?.user?.id]);

  return (
    <Suspense fallback={null}>
      <Routes>
        {/* Public routes – always accessible */}
        <Route path='/login' element={<Login />} />
        <Route path='/signup' element={<Signup />} />
        <Route path='/reset-password' element={<ResetPassword />} />

        {/* Pending approval page – just needs a valid session */}
        <Route
          path='/pending-approval'
          element={
            !isAuthReady ? null : !session ? (
              <Navigate to='/login' replace />
            ) : (
              <PendingApproval />
            )
          }
        />

        {/* Protected routes – session required, pending users get bounced */}
        <Route
          element={
            !isAuthReady ? null : !session ? (
              <Navigate to='/login' replace />
            ) : isPending ? (
              <Navigate to='/pending-approval' replace />
            ) : (
              <AppLayout session={session} />
            )
          }
        >
          <Route path='/dashboard' element={<Dashboard />} />

          {/* MODIFIED INVENTORY ROUTE */}
          <Route
            path='/inventory'
            element={
              inventoryView === "Item Action" ? (
                <ItemAction
                  po_number={selectedPO}
                  setCurrentPage={setInventoryView}
                />
              ) : (
                <Inventory
                  setSelectedPO={setSelectedPO}
                  setCurrentPage={setInventoryView}
                />
              )
            }
          />

          <Route path='/pricing' element={<Pricing />} />
          <Route path='/purchasing' element={<Purchasing />} />
          <Route path='/purchase-history' element={<PurchaseHistory />} />
          <Route path='/inbound' element={<InboundDelivery />} />
          <Route path='/pos' element={<RecordSales />} />
          <Route path='/invoice-history' element={<InvoiceHistory />} />
          <Route path='/outbound' element={<OutboundDelivery />} />

          <Route
            path='/manage-users'
            element={
              userRole === "Super Admin" ? (
                <UserManagement />
              ) : (
                <Navigate to='/dashboard' replace />
              )
            }
          />
        </Route>

        <Route path='*' element={<Navigate to='/login' replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
