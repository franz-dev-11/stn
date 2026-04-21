import React, { Suspense, lazy, useState, useEffect } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { supabase } from "./supabaseClient";

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
const UserManagement = lazy(() => import("./pages/UserManagement"));
const AccountCreation = lazy(() => import("./pages/AccountCreation"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const BatchRecord = lazy(() => import("./pages/BatchRecord"));
const ReturnRecords = lazy(() => import("./pages/ReturnRecords"));
const AuditTrail = lazy(() => import("./pages/AuditTrail"));

const AppLayout = ({ currentUser, mustChangePassword, setCurrentUser }) => {
  const [currentPage, setCurrentPage] = useState("Dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!currentUser) return <Navigate to="/login" replace />;
  if (mustChangePassword) return <Navigate to="/change-password" replace />;

  return (
    <div className='flex min-h-screen w-full overflow-x-hidden md:h-screen md:overflow-hidden'>
      <button
        className='fixed top-4 right-4 sm:top-6 sm:right-6 z-60 md:hidden flex items-center justify-center p-2 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-all duration-300'
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
        setCurrentUser={setCurrentUser}
      />
      <div className='flex-1 flex flex-col overflow-y-auto overflow-x-hidden'>
        <Outlet />
      </div>
    </div>
  );
};

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem("stn_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Re-validate session against DB on load — catches must_change_password updates etc.
  useEffect(() => {
    const stored = sessionStorage.getItem("stn_user");
    if (!stored) return;
    let user;
    try { user = JSON.parse(stored); } catch { return; }
    if (!user?.id) return;

    supabase
      .from("users")
      .select("id, employee_id, first_name, last_name, role, username, must_change_password")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          // User deleted or doesn't exist — force logout
          sessionStorage.removeItem("stn_user");
          setCurrentUser(null);
        } else {
          sessionStorage.setItem("stn_user", JSON.stringify(data));
          setCurrentUser(data);
        }
      });
  }, []);

  const userRole = currentUser?.role ?? null;

  // --- STATES FOR QR SYSTEM NAVIGATION ---
  const [inventoryView, setInventoryView] = useState("Inventory");
  const [selectedPO, setSelectedPO] = useState(null);

  return (
    <Suspense fallback={null}>
      <Routes>
        {/* Routes */}
        <Route path='/' element={<Navigate to='/dashboard' replace />} />
        <Route path='/batch/:batchRef' element={<BatchRecord />} />

        <Route
          path='/login'
          element={currentUser ? <Navigate to='/dashboard' replace /> : <Login setCurrentUser={setCurrentUser} />}
        />
        <Route path='/change-password' element={<ChangePassword setCurrentUser={setCurrentUser} />} />

        <Route element={<AppLayout currentUser={currentUser} mustChangePassword={currentUser?.must_change_password === true} setCurrentUser={setCurrentUser} />}>

          <Route path='/dashboard' element={userRole === "Staff" ? <Navigate to='/pos' replace /> : <Dashboard />} />
          <Route path='/inventory' element={userRole === "Staff" ? <Navigate to='/pos' replace /> :
              inventoryView === "Item Action" ? (
                <ItemAction po_number={selectedPO} setCurrentPage={setInventoryView} />
              ) : (
                <Inventory setSelectedPO={setSelectedPO} setCurrentPage={setInventoryView} />
              )
            }
          />

          <Route path='/pricing' element={userRole === "Cashier" ? <Navigate to='/pos' replace /> : <Pricing />} />
          <Route path='/purchasing' element={userRole === "Cashier" ? <Navigate to='/pos' replace /> : <Purchasing />} />
          <Route path='/purchase-history' element={userRole === "Cashier" ? <Navigate to='/pos' replace /> : <PurchaseHistory />} />
          <Route path='/inbound' element={userRole === "Cashier" ? <Navigate to='/pos' replace /> : <InboundDelivery />} />
          <Route path='/pos' element={<RecordSales />} />
          <Route path='/invoice-history' element={<InvoiceHistory />} />
          <Route path='/outbound' element={<OutboundDelivery />} />
          <Route path='/dashboard' element={userRole === "Cashier" ? <Navigate to='/pos' replace /> : <Dashboard />} />
          <Route path='/inventory' element={userRole === "Cashier" ? <Navigate to='/pos' replace /> :
              inventoryView === "Item Action" ? (
                <ItemAction po_number={selectedPO} setCurrentPage={setInventoryView} />
              ) : (
                <Inventory setSelectedPO={setSelectedPO} setCurrentPage={setInventoryView} />
              )
            }
          />

          <Route path='/account-creation' element={userRole === "Cashier" ? <Navigate to='/pos' replace /> : <AccountCreation />} />
          <Route path='/manage-users' element={userRole === "Cashier" ? <Navigate to='/pos' replace /> : <UserManagement />} />
          <Route path='/return-records' element={userRole === "Cashier" ? <Navigate to='/pos' replace /> : <ReturnRecords />} />
          <Route path='/audit-trail' element={userRole === "Cashier" ? <Navigate to='/pos' replace /> : <AuditTrail />} />
        </Route>

        <Route path='*' element={<Navigate to='/login' replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
