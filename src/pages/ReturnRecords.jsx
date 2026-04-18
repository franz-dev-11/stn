import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../supabaseClient";
import {
  RotateCcw,
  Search,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const ReturnRecords = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("return_records")
        .select("*")
        .order("returned_at", { ascending: false });

      if (error) console.error("Error fetching return records:", error.message);
      setRecords(data || []);
      setLoading(false);
    };
    fetchRecords();
  }, []);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const term = searchTerm.toLowerCase();
      const matchSearch =
        !term ||
        r.order_number?.toLowerCase().includes(term) ||
        r.item_name?.toLowerCase().includes(term) ||
        r.sku?.toLowerCase().includes(term) ||
        r.supplier?.toLowerCase().includes(term) ||
        r.returned_by?.toLowerCase().includes(term);

      const date = r.returned_at?.split("T")[0] || "";
      const matchStart = !startDate || date >= startDate;
      const matchEnd = !endDate || date <= endDate;

      return matchSearch && matchStart && matchEnd;
    });
  }, [records, searchTerm, startDate, endDate]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const totalQty = filtered.reduce((s, r) => s + (r.return_qty || 0), 0);
  const totalValue = filtered.reduce(
    (s, r) => s + (r.return_qty || 0) * (r.unit_cost || 0),
    0,
  );

  const clearFilters = () => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 bg-[#f3f4f6] min-h-screen text-black overflow-x-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-6 sm:mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <RotateCcw size={32} className="text-rose-500" /> RETURN RECORDS
            </h1>
            <p className="text-slate-600 font-bold text-[8px] sm:text-xs uppercase tracking-[0.2em] mt-2">
              Audit Trail | Returned Items Log
            </p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Total Returns</p>
              <p className="text-xl font-black text-slate-800">{filtered.length} records</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Total Qty</p>
              <p className="text-xl font-black text-rose-600">{totalQty.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Total Value</p>
              <p className="text-xl font-black text-slate-800">₱{totalValue.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <label className="block text-[10px] font-black uppercase text-slate-600 mb-2">
                Search
              </label>
              <div className="relative">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-black"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Order #, Item, SKU, Supplier, User..."
                  className="w-full pl-11 pr-4 py-3 rounded-lg outline-none font-bold text-xs focus:bg-yellow-50 transition-all bg-slate-50"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
              </div>
            </div>
            <div className="md:col-span-7">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[10px] font-black uppercase text-slate-600">
                  Date Range
                </label>
                {(searchTerm || startDate || endDate) && (
                  <button
                    onClick={clearFilters}
                    className="text-[10px] font-black uppercase text-red-500 flex items-center gap-1 hover:text-red-600"
                  >
                    <XCircle size={12} /> Clear
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  className="flex-1 px-4 py-3 rounded-lg font-bold text-xs outline-none focus:bg-yellow-50 transition-all bg-slate-50"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                />
                <span className="font-black text-slate-300 text-xs">TO</span>
                <input
                  type="date"
                  className="flex-1 px-4 py-3 rounded-lg font-bold text-xs outline-none focus:bg-yellow-50 transition-all bg-slate-50"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-max">
              <thead>
                <tr className="bg-black text-white text-[10px] font-black uppercase">
                  <th className="px-5 py-4">Date & Time</th>
                  <th className="px-5 py-4">Order #</th>
                  <th className="px-5 py-4">Item</th>
                  <th className="px-5 py-4">SKU</th>
                  <th className="px-5 py-4">Supplier</th>
                  <th className="px-5 py-4 text-center">Qty Returned</th>
                  <th className="px-5 py-4 text-right">Unit Cost</th>
                  <th className="px-5 py-4 text-right">Total Value</th>
                  <th className="px-5 py-4">Returned By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-12 text-center text-xs font-black uppercase text-slate-400">
                      Loading...
                    </td>
                  </tr>
                ) : paginated.length > 0 ? (
                  paginated.map((r) => (
                    <tr key={r.id} className="hover:bg-rose-50/40 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <p className="text-[10px] font-bold text-slate-700">
                          {new Date(r.returned_at).toLocaleDateString()}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400">
                          {new Date(r.returned_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </td>
                      <td className="px-5 py-4 font-mono font-black text-xs text-teal-700 whitespace-nowrap">
                        {r.order_number}
                      </td>
                      <td className="px-5 py-4 font-black uppercase text-xs max-w-45">
                        <span className="line-clamp-2">{r.item_name || "—"}</span>
                      </td>
                      <td className="px-5 py-4 font-mono text-[10px] font-bold text-slate-500">
                        {r.sku ? `#${r.sku}` : "—"}
                      </td>
                      <td className="px-5 py-4 text-xs font-bold text-slate-700 uppercase whitespace-nowrap">
                        {r.supplier || "—"}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-block bg-rose-100 text-rose-700 font-black text-xs px-3 py-1 rounded-full">
                          -{r.return_qty}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-xs font-bold text-slate-600">
                        {r.unit_cost != null ? `₱${Number(r.unit_cost).toLocaleString()}` : "—"}
                      </td>
                      <td className="px-5 py-4 text-right font-black text-sm">
                        {r.unit_cost != null
                          ? `₱${(r.return_qty * r.unit_cost).toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="px-5 py-4 text-xs font-bold text-slate-700 whitespace-nowrap">
                        {r.returned_by || "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="px-6 py-12 text-center">
                      <p className="text-xs font-black uppercase text-slate-500">No return records found</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">
                        Try adjusting your filters.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-white shadow-sm disabled:opacity-30 hover:shadow-lg transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-10 h-10 rounded-lg font-black text-xs transition-all ${
                  currentPage === i + 1
                    ? "bg-black text-white shadow-sm"
                    : "bg-white hover:shadow-lg"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-white shadow-sm disabled:opacity-30 hover:shadow-lg transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReturnRecords;
