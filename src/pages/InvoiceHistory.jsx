import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import {
  Printer,
  ChevronDown,
  ChevronUp,
  History,
  Search,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Tag,
} from "lucide-react";

const InvoiceHistory = () => {
  const [invoices, setInvoices] = useState([]);
  const [expandedInvoice, setExpandedInvoice] = useState(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        // Fetch from sales_transactions and join with sales_items
        const { data, error } = await supabase
          .from("sales_transactions")
          .select(
            `
            *,
            sales_items (*)
          `,
          )
          .order("created_at", { ascending: false });

        if (error) throw error;
        setInvoices(data || []);
      } catch (err) {
        console.error("Error fetching invoices:", err.message);
      }
    };
    fetchInvoices();
  }, []);

  // Filtering Logic
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      (inv.so_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.customer_name || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const invDate = new Date(inv.created_at).toISOString().split("T")[0];
    const matchesStart = !startDate || invDate >= startDate;
    const matchesEnd = !endDate || invDate <= endDate;

    return matchesSearch && matchesStart && matchesEnd;
  });

  const currentItems = filteredInvoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);

  return (
    <div className='p-8 bg-[#f3f4f6] min-h-screen text-black print:bg-white print:p-0'>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; border: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className='max-w-5xl mx-auto'>
        <div className='flex justify-between items-end mb-8 no-print'>
          <div>
            <h1 className='text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3'>
              <Receipt size={32} className='text-teal-600' /> INVOICE HISTORY
            </h1>
            <p className='text-slate-600 font-bold text-xs uppercase tracking-[0.2em] mt-2'>
              Sales Ledger Archive | Customer Transactions
            </p>
          </div>
          <p className='text-slate-400 font-bold text-sm'>
            {filteredInvoices.length} sales records
          </p>
        </div>

        {/* Filters - Matching PurchaseHistory style */}
        <div className='bg-white p-6 rounded-2xl mb-8 shadow-sm no-print'>
          <div className='grid grid-cols-1 md:grid-cols-12 gap-6'>
            <div className='md:col-span-5'>
              <label className='block text-[10px] font-black uppercase text-slate-600 mb-2'>
                Search Records
              </label>
              <div className='relative'>
                <Search
                  className='absolute left-4 top-1/2 -translate-y-1/2 text-black'
                  size={18}
                />
                <input
                  type='text'
                  placeholder='Order # or Customer...'
                  className='w-full pl-12 pr-4 py-3 rounded-lg outline-none font-black uppercase text-xs focus:bg-yellow-50 transition-all'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className='md:col-span-7'>
              <div className='flex justify-between items-center mb-2'>
                <label className='block text-[10px] font-black uppercase text-slate-600'>
                  Date Range
                </label>
                {(searchTerm || startDate || endDate) && (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setStartDate("");
                      setEndDate("");
                    }}
                    className='text-[10px] font-black uppercase text-red-500 flex items-center gap-1 hover:text-red-600'
                  >
                    <XCircle size={12} /> Clear
                  </button>
                )}
              </div>
              <div className='flex items-center gap-3'>
                <input
                  type='date'
                  className='flex-1 px-4 py-3 rounded-lg font-black uppercase text-xs outline-none focus:bg-yellow-50 transition-all'
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className='font-black text-slate-300 text-xs'>TO</span>
                <input
                  type='date'
                  className='flex-1 px-4 py-3 rounded-lg font-black uppercase text-xs outline-none focus:bg-yellow-50 transition-all'
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Invoice List */}
        <div className='bg-white rounded-2xl overflow-hidden shadow-sm'>
          <table className='w-full text-left'>
            <thead>
              <tr className='bg-black text-white text-[10px] font-black uppercase'>
                <th className='px-6 py-4'>Date</th>
                <th className='px-6 py-4'>Order #</th>
                <th className='px-6 py-4'>Customer</th>
                <th className='px-6 py-4'>Status</th>
                <th className='px-6 py-4 text-center'>Items</th>
                <th className='px-6 py-4 text-right'>Total Amount</th>
                <th className='px-6 py-4 text-right'>Actions</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-100'>
              {currentItems.length > 0 ? (
                currentItems.map((inv) => {
                  const isExpanded = expandedInvoice === inv.id;
                  return (
                    <React.Fragment key={inv.id}>
                      <tr
                        onClick={() =>
                          setExpandedInvoice(isExpanded ? null : inv.id)
                        }
                        className='hover:bg-slate-50 cursor-pointer transition-colors'
                      >
                        <td className='px-6 py-4 text-[10px] font-bold text-slate-500 whitespace-nowrap'>
                          {new Date(inv.created_at).toLocaleDateString()}
                        </td>
                        <td className='px-6 py-4'>
                          <span className='font-mono font-black text-teal-700 text-sm'>
                            {inv.so_number}
                          </span>
                        </td>
                        <td className='px-6 py-4 font-black uppercase text-xs'>
                          {inv.customer_name}
                        </td>
                        <td className='px-6 py-4'>
                          <span
                            className={`text-[10px] font-black px-3 py-1 rounded-lg ${
                              inv.status === "Completed"
                                ? "bg-emerald-400 text-black"
                                : "bg-teal-400 text-black"
                            }`}
                          >
                            {inv.status?.toUpperCase()}
                          </span>
                        </td>
                        <td className='px-6 py-4 text-center font-black text-sm'>
                          {inv.sales_items?.length || 0}
                        </td>
                        <td className='px-6 py-4 text-right font-black text-sm'>
                          ₱{inv.total_amount?.toLocaleString()}
                        </td>
                        <td className='px-6 py-4 text-right'>
                          <div className='flex justify-end'>
                            {isExpanded ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan='7' className='p-0 bg-slate-50'>
                            <div className='print-area'>
                              {/* Toolbar */}
                              <div className='bg-black text-white px-8 py-4 flex justify-between items-center no-print'>
                                <h2 className='font-black uppercase tracking-widest text-sm flex items-center gap-2'>
                                  <Tag size={16} /> Transaction Details
                                </h2>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.print();
                                  }}
                                  className='bg-white text-black px-4 py-2 rounded-lg text-[10px] font-black flex items-center gap-2 hover:bg-slate-200 transition-all'
                                >
                                  <Printer size={14} /> Print Invoice
                                </button>
                              </div>
                              {/* Invoice Content */}
                              <div className='p-8 bg-white'>
                                <div className='flex justify-between items-start pb-4 mb-6 border-b-2 border-slate-200'>
                                  <div>
                                    <h1 className='text-4xl font-black uppercase italic leading-none'>
                                      Sales Invoice
                                    </h1>
                                    <p className='text-xs font-bold text-slate-600 mt-2'>
                                      Ref Order: {inv.so_number}
                                    </p>
                                  </div>
                                  <div className='text-right'>
                                    <p className='text-sm font-black uppercase'>
                                      Date:{" "}
                                      {new Date(
                                        inv.created_at,
                                      ).toLocaleDateString()}
                                    </p>
                                    <p className='text-[10px] font-bold text-slate-600 uppercase'>
                                      Transaction Record
                                    </p>
                                  </div>
                                </div>
                                <div className='mb-8'>
                                  <h4 className='text-[10px] font-black text-slate-600 uppercase mb-1'>
                                    Billed To:
                                  </h4>
                                  <p className='text-sm font-black uppercase'>
                                    {inv.customer_name}
                                  </p>
                                </div>
                                <table className='w-full text-left mb-6'>
                                  <thead>
                                    <tr className='bg-black text-white text-[10px] uppercase font-black'>
                                      <th className='py-3'>Description</th>
                                      <th className='py-3 text-center'>Qty</th>
                                      <th className='py-3 text-right'>
                                        Unit Price
                                      </th>
                                      <th className='py-3 text-right'>
                                        Subtotal
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {inv.sales_items?.map((item) => (
                                      <tr
                                        key={item.id}
                                        className='border-b border-slate-100'
                                      >
                                        <td className='py-4 text-sm font-black uppercase'>
                                          {item.item_name}
                                        </td>
                                        <td className='py-4 text-center font-black'>
                                          {item.quantity}
                                        </td>
                                        <td className='py-4 text-right text-sm font-bold'>
                                          ₱{item.unit_price?.toLocaleString()}
                                        </td>
                                        <td className='py-4 text-right text-sm font-black'>
                                          ₱
                                          {(
                                            item.quantity * item.unit_price
                                          ).toLocaleString()}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr className='border-t-2 border-slate-200'>
                                      <td
                                        colSpan='3'
                                        className='py-6 text-right text-sm font-black uppercase text-slate-600'
                                      >
                                        Grand Total:
                                      </td>
                                      <td className='py-6 text-right text-xl font-black underline decoration-4 decoration-teal-500'>
                                        ₱{inv.total_amount?.toLocaleString()}
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan='7' className='px-6 py-12 text-center'>
                    <p className='text-xs font-black uppercase text-slate-500'>
                      No invoices found
                    </p>
                    <p className='text-[10px] font-bold text-slate-400 mt-2 uppercase'>
                      Try adjusting search keywords or date filters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className='mt-10 flex justify-center items-center gap-2 no-print'>
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className='p-2 rounded-lg bg-white shadow-sm disabled:opacity-30 hover:shadow-lg transition-all'
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
              className='p-2 rounded-lg bg-white shadow-sm disabled:opacity-30 hover:shadow-lg transition-all'
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceHistory;
