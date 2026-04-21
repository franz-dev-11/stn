import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../supabaseClient";
import {
  Search,
  ShoppingCart,
  Truck,
  Calculator,
  RotateCcw,
  RefreshCw,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Filter,
  ClipboardList,
} from "lucide-react";

const ACTION_META = {
  PROCUREMENT: {
    label: "Procurement",
    icon: <ShoppingCart size={12} />,
    color: "bg-blue-100 text-blue-700",
  },
  STOCK_IN: {
    label: "Stock-In",
    icon: <Truck size={12} />,
    color: "bg-emerald-100 text-emerald-700",
  },
  SALE: {
    label: "Sale",
    icon: <Calculator size={12} />,
    color: "bg-teal-100 text-teal-700",
  },
  STOCK_OUT: {
    label: "Stock-Out",
    icon: <Truck size={12} />,
    color: "bg-orange-100 text-orange-700",
  },
  RETURN: {
    label: "Return",
    icon: <RotateCcw size={12} />,
    color: "bg-rose-100 text-rose-700",
  },
  REPLACED: {
    label: "Replaced",
    icon: <RefreshCw size={12} />,
    color: "bg-violet-100 text-violet-700",
  },
  REFUNDED: {
    label: "Refunded",
    icon: <Banknote size={12} />,
    color: "bg-amber-100 text-amber-700",
  },
};

const ITEMS_PER_PAGE = 20;

const AuditTrail = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState("All");
  const [filterUser, setFilterUser] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("audit_trail")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) console.error("Audit trail fetch error:", error.message);
      setRecords(data || []);
      setLoading(false);
    };
    fetchRecords();
  }, []);

  const userOptions = useMemo(() => {
    const names = [...new Set(records.map((r) => r.performed_by).filter(Boolean))].sort();
    return names;
  }, [records]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        r.reference_number?.toLowerCase().includes(search) ||
        r.item_name?.toLowerCase().includes(search) ||
        r.sku?.toLowerCase().includes(search) ||
        r.supplier?.toLowerCase().includes(search) ||
        r.performed_by?.toLowerCase().includes(search);

      const matchesAction = filterAction === "All" || r.action === filterAction;
      const matchesUser = filterUser === "All" || r.performed_by === filterUser;

      const recDate = r.created_at ? r.created_at.split("T")[0] : "";
      const matchesStart = !startDate || recDate >= startDate;
      const matchesEnd = !endDate || recDate <= endDate;

      return matchesSearch && matchesAction && matchesUser && matchesStart && matchesEnd;
    });
  }, [records, searchTerm, filterAction, filterUser, startDate, endDate]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleFilterChange = (value) => {
    setFilterAction(value);
    setCurrentPage(1);
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // Summary totals
  const totals = useMemo(() => ({
    records: filtered.length,
    qty: filtered.reduce((s, r) => s + (r.quantity || 0), 0),
    value: filtered.reduce((s, r) => s + (r.total_amount || 0), 0),
  }), [filtered]);

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 bg-[#f3f4f6] min-h-screen text-black overflow-x-hidden">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <ClipboardList className="text-teal-600" size={32} /> AUDIT TRAIL
        </h1>
        <p className="text-slate-600 font-bold text-[8px] sm:text-xs uppercase tracking-[0.2em] mt-2">
          Full Activity Log | All Modules
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        {[
          { label: "Records", value: totals.records.toLocaleString(), sub: "matching filters" },
          { label: "Total Qty", value: totals.qty.toLocaleString(), sub: "units across events" },
          { label: "Total Value", value: `₱${totals.value.toLocaleString()}`, sub: "transaction value" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{card.label}</p>
            <p className="text-xl sm:text-2xl font-black mt-1">{card.value}</p>
            <p className="text-[9px] font-bold text-slate-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm mb-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="flex items-center gap-3 flex-1 bg-slate-50 rounded-xl px-4 py-2.5">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search reference, item, SKU, supplier, user..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-xs font-bold uppercase"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Filter size={14} className="text-slate-400" />
          <select
            value={filterAction}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="text-xs font-black uppercase bg-slate-50 border-0 rounded-xl px-3 py-2.5 outline-none cursor-pointer"
          >
            <option value="All">All Actions</option>
            <option value="PROCUREMENT">Procurement</option>
            <option value="STOCK_IN">Stock-In</option>
            <option value="SALE">Sale</option>
            <option value="STOCK_OUT">Stock-Out</option>
            <option value="RETURN">Return</option>
            <option value="REPLACED">Replaced</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Filter size={14} className="text-slate-400" />
          <select
            value={filterUser}
            onChange={(e) => { setFilterUser(e.target.value); setCurrentPage(1); }}
            className="text-xs font-black uppercase bg-slate-50 border-0 rounded-xl px-3 py-2.5 outline-none cursor-pointer"
          >
            <option value="All">All Users</option>
            {userOptions.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 shrink-0">
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
            className="text-xs font-bold bg-slate-50 border-0 rounded-xl px-3 py-2.5 outline-none"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
            className="text-xs font-bold bg-slate-50 border-0 rounded-xl px-3 py-2.5 outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-black text-white text-[9px] sm:text-[10px] uppercase font-black tracking-wider">
                <th className="px-4 sm:px-6 py-3 sm:py-4">Timestamp</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4">Action</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4">Reference</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4">Item</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4">Supplier</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-center">Qty</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-right">Unit Cost</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4 text-right">Total</th>
                <th className="px-4 sm:px-6 py-3 sm:py-4">Performed By</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-xs font-black uppercase text-slate-400">
                    Loading audit trail...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center">
                    <p className="text-xs font-black uppercase text-slate-500">No records found</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">
                      Try adjusting your search or filters.
                    </p>
                  </td>
                </tr>
              ) : (
                paginated.map((r) => {
                  const meta = ACTION_META[r.action] || { label: r.action, icon: null, color: "bg-slate-100 text-slate-600" };
                  return (
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-[10px] font-bold text-slate-500 whitespace-nowrap">
                        {r.created_at
                          ? new Date(r.created_at).toLocaleString("en-PH", {
                              month: "short", day: "numeric", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-lg uppercase ${meta.color}`}>
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-[10px] font-mono font-bold text-slate-700">
                        {r.reference_number || "—"}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4">
                        <p className="text-xs font-black text-slate-800 uppercase">{r.item_name || "—"}</p>
                        {r.sku && <p className="text-[9px] font-mono text-slate-400">#{r.sku}</p>}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-[10px] font-bold text-slate-600">
                        {r.supplier || "—"}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-center font-black text-sm">
                        {r.quantity ?? "—"}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold">
                        {r.unit_cost != null ? `₱${Number(r.unit_cost).toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-right text-sm font-black">
                        {r.total_amount != null ? `₱${Number(r.total_amount).toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-[10px] font-bold text-slate-600">
                        {r.performed_by || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-500 uppercase">
              Page {currentPage} of {totalPages} — {filtered.length} records
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-all"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-all"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditTrail;
