import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { printElement } from "../utils/printUtils";
import { formatPSTDate, formatPSTDateTime } from "../utils/dateTimeUtils";
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
  const location = useLocation();
  const [invoices, setInvoices] = useState([]);
  const [expandedInvoice, setExpandedInvoice] = useState(null);
  const [vipData, setVipData] = useState({}); // { [inv.id]: { order, payments } }

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from("sales_transactions")
        .select(`*, sales_items (*)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error("Error fetching invoices:", err.message);
    }
  };

  useEffect(() => {
    fetchInvoices();
    const channel = supabase
      .channel("invoice-history-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_transactions" }, fetchInvoices)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_items" }, fetchInvoices)
      .subscribe();
    return () => supabase.removeChannel(channel);
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

  const [autoExpandSO, setAutoExpandSO] = useState(() => location.state?.soNumber || null);
  useEffect(() => {
    if (!autoExpandSO || invoices.length === 0) return;
    const idx = filteredInvoices.findIndex((inv) => inv.so_number === autoExpandSO);
    if (idx !== -1) {
      setCurrentPage(Math.floor(idx / itemsPerPage) + 1);
      setExpandedInvoice(filteredInvoices[idx].id);
      setAutoExpandSO(null);
    }
  }, [autoExpandSO, invoices, filteredInvoices, itemsPerPage]);

  const toggleExpand = async (inv) => {
    const isOpen = expandedInvoice === inv.id;
    setExpandedInvoice(isOpen ? null : inv.id);
    if (!isOpen && inv.transaction_type === 'vip' && !vipData[inv.id]) {
      const { data: orderRow } = await supabase
        .from('vip_orders')
        .select('id, grand_total, downpayment, balance, installments, installment_amount, status')
        .eq('so_number', inv.so_number)
        .maybeSingle();
      if (orderRow) {
        const { data: payments } = await supabase
          .from('vip_payments')
          .select('id, amount, note, paid_at')
          .eq('order_id', orderRow.id)
          .order('paid_at');
        setVipData(prev => ({ ...prev, [inv.id]: { order: orderRow, payments: payments || [] } }));
      }
    }
  };

  return (
    <div className='p-3 sm:p-4 md:p-6 lg:p-8 bg-[#f3f4f6] min-h-screen text-black print:bg-white print:p-0 overflow-x-hidden'>

      <div className='max-w-5xl mx-auto'>
        <div className='flex flex-col sm:flex-row sm:justify-between sm:items-end mb-6 sm:mb-8 gap-4 no-print'>
          <div>
            <h1 className='text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3'>
              <Receipt size={32} className='text-teal-600' /> INVOICE HISTORY
            </h1>
            <p className='text-slate-600 font-bold text-[8px] sm:text-xs uppercase tracking-[0.2em] mt-2'>
              Sales Ledger Archive | Customer Transactions
            </p>
          </div>
          <p className='text-slate-400 font-bold text-sm'>
            {filteredInvoices.length} sales records
          </p>
        </div>

        {/* Filters - Matching PurchaseHistory style */}
        <div className='bg-white p-4 sm:p-6 rounded-2xl mb-8 shadow-sm no-print'>
          <div className='grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6'>
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
          <div className='overflow-x-auto'>
            <table className='w-full text-left min-w-max'>
              <thead>
                <tr className='bg-black text-white text-[10px] font-black uppercase'>
                  <th className='px-6 py-4'>Date</th>
                  <th className='px-6 py-4'>Order #</th>
                  <th className='px-6 py-4'>Customer</th>
                  <th className='px-6 py-4'>Type</th>
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
                          onClick={() => toggleExpand(inv)}
                          className='hover:bg-slate-50 cursor-pointer transition-colors'
                        >
                          <td className='px-6 py-4 text-[10px] font-bold text-slate-500 whitespace-nowrap'>
                            {formatPSTDate(inv.created_at)}
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
                            <span className='text-[10px] font-black px-2 py-1 rounded-lg uppercase bg-slate-100 text-slate-700'>
                              {inv.transaction_type || 'walk-in'}
                            </span>
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
                            <td colSpan='8' className='p-0 bg-slate-50'>
                              <div className='print-area'>
                                {/* Toolbar */}
                                <div className='bg-black text-white px-8 py-4 flex justify-between items-center no-print'>
                                  <h2 className='font-black uppercase tracking-widest text-sm flex items-center gap-2'>
                                    <Tag size={16} /> Transaction Details
                                  </h2>
                                  <button
                                    type='button'
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      printElement(e.currentTarget.closest('.print-area'));
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
                                        Billing Statement
                                      </h1>
                                      <p className='text-xs font-bold text-slate-600 mt-2'>
                                        {inv.sales_items?.length} Item{inv.sales_items?.length !== 1 ? 's' : ''}
                                      </p>
                                    </div>
                                    <div className='text-right'>
                                      <p className='text-lg font-black uppercase tracking-widest'>
                                        {inv.so_number}
                                      </p>
                                      <p className='text-sm font-black uppercase mt-1'>
                                        Date:{" "}
                                        {formatPSTDate(inv.created_at)}
                                      </p>
                                      <p className='text-[10px] font-bold text-slate-600 uppercase'>
                                        Billing Statement
                                      </p>
                                    </div>
                                  </div>
                                  <div className='grid grid-cols-2 gap-8 mb-8'>
                                    <div>
                                      <h4 className='text-[10px] font-black text-slate-600 uppercase mb-1'>
                                        Billed To:
                                      </h4>
                                      <p className='text-sm font-black uppercase'>
                                        {inv.customer_name}
                                      </p>
                                      <p className='text-xs font-medium text-slate-600 uppercase mt-0.5'>
                                        {inv.transaction_type || 'Walk-in'}
                                      </p>
                                    </div>
                                    <div className='text-right'>
                                      <h4 className='text-[10px] font-black text-slate-600 uppercase mb-1'>
                                        Issued By:
                                      </h4>
                                      <p className='text-sm font-black uppercase'>
                                        JohnCel Trading
                                      </p>
                                      <p className='text-xs font-medium text-slate-600'>
                                        254 Dir. A. Bunye, Bagumbayan
                                      </p>
                                      <p className='text-xs font-medium text-slate-600'>
                                        Taguig, 1630 Kalakhang Maynila
                                      </p>
                                    </div>
                                  </div>
                                  <table className='w-full text-left mb-6'>
                                    <thead>
                                      <tr className='bg-black text-white text-[10px] uppercase font-black'>
                                        <th className='py-3'>Description</th>
                                        <th className='py-3 text-center'>Qty</th>
                                        <th className='py-3 text-right'>Unit Price</th>
                                        <th className='py-3 text-right'>Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {inv.sales_items?.map((item) => (
                                        <tr key={item.id} className='border-b border-slate-100'>
                                          <td className='py-4 text-sm font-black uppercase'>
                                            {(item.item_name || "").replace(/\s*\(PO-[^)]+\)/gi, "").trim()}
                                          </td>
                                          <td className='py-4 text-center font-black'>
                                            {item.quantity}
                                          </td>
                                          <td className='py-4 text-right text-sm font-bold'>
                                            ₱{item.unit_price?.toLocaleString()}
                                          </td>
                                          <td className='py-4 text-right text-sm font-black'>
                                            ₱{(item.quantity * item.unit_price).toLocaleString()}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      {(() => {
                                        const itemsSubtotal = (inv.sales_items || []).reduce((s, it) => s + (it.unit_price * it.quantity), 0);
                                        const discount = Math.round((itemsSubtotal - Number(inv.total_amount)) * 100) / 100;
                                        return (
                                          <>
                                            {discount > 0 && (
                                              <>
                                                <tr className='border-t border-slate-200'>
                                                  <td colSpan='3' className='py-1 text-right text-xs font-bold uppercase text-slate-400'>Items Subtotal:</td>
                                                  <td className='py-1 text-right text-sm font-bold text-slate-500'>₱{itemsSubtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                                </tr>
                                                <tr>
                                                  <td colSpan='3' className='py-1 text-right text-xs font-black uppercase text-rose-500'>Discount:</td>
                                                  <td className='py-1 text-right text-sm font-black text-rose-500'>-₱{discount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                                </tr>
                                              </>
                                            )}
                                            <tr className='border-t-2 border-slate-200'>
                                              <td colSpan='3' className='py-6 text-right text-sm font-black uppercase text-slate-600'>Grand Total:</td>
                                              <td className='py-6 text-right text-xl font-black underline decoration-4 decoration-teal-500'>₱{inv.total_amount?.toLocaleString()}</td>
                                            </tr>
                                          </>
                                        );
                                      })()}
                                    </tfoot>
                                  </table>

                                  {/* VIP Installment Payment Panel */}
                                  {inv.transaction_type === 'vip' && (() => {
                                    const vip = vipData[inv.id];
                                    if (!vip) return (
                                      <div className='mt-4 p-4 bg-teal-50 rounded-xl text-xs font-bold text-teal-700 uppercase'>Loading payment info...</div>
                                    );
                                    const { order, payments } = vip;
                                    const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
                                    const outstanding = Math.max(0, Number(order.grand_total) - totalPaid);
                                    const progressPct = order.grand_total > 0 ? Math.min(100, (totalPaid / order.grand_total) * 100) : 0;
                                    return (
                                      <div className='mt-6 border-t-2 border-teal-400 pt-6'>
                                        <h3 className='text-[10px] font-black uppercase text-teal-700 tracking-widest mb-4'>VIP Payment Terms</h3>
                                        <div className='grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4'>
                                          <div className='bg-slate-50 rounded-xl p-3'>
                                            <p className='text-[9px] font-black uppercase text-slate-500 mb-1'>Grand Total</p>
                                            <p className='text-sm font-black'>₱{Number(order.grand_total).toLocaleString()}</p>
                                          </div>
                                          <div className='bg-slate-50 rounded-xl p-3'>
                                            <p className='text-[9px] font-black uppercase text-slate-500 mb-1'>Downpayment</p>
                                            <p className='text-sm font-black'>₱{Number(order.downpayment).toLocaleString()}</p>
                                          </div>
                                          <div className='bg-slate-50 rounded-xl p-3'>
                                            <p className='text-[9px] font-black uppercase text-slate-500 mb-1'>Installments</p>
                                            <p className='text-sm font-black'>{order.installments}× ₱{Number(order.installment_amount).toLocaleString()}</p>
                                          </div>
                                          <div className={`rounded-xl p-3 ${outstanding > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                                            <p className='text-[9px] font-black uppercase text-slate-500 mb-1'>Outstanding</p>
                                            <p className={`text-sm font-black ${outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>₱{outstanding.toLocaleString()}</p>
                                          </div>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className='mb-4'>
                                          <div className='flex justify-between text-[9px] font-black uppercase text-slate-500 mb-1'>
                                            <span>Payment Progress</span>
                                            <span>{progressPct.toFixed(0)}%</span>
                                          </div>
                                          <div className='w-full bg-slate-200 rounded-full h-2'>
                                            <div className='bg-teal-500 h-2 rounded-full transition-all' style={{ width: `${progressPct}%` }} />
                                          </div>
                                          <div className='flex justify-between text-[9px] font-bold text-slate-400 mt-1'>
                                            <span>Paid: ₱{totalPaid.toLocaleString()}</span>
                                            <span>Total: ₱{Number(order.grand_total).toLocaleString()}</span>
                                          </div>
                                        </div>
                                        {/* Payment History */}
                                        {payments.length > 0 && (
                                          <div>
                                            <p className='text-[9px] font-black uppercase text-slate-500 mb-2'>Payment History</p>
                                            <table className='w-full text-left text-[10px]'>
                                              <thead>
                                                <tr className='bg-slate-100 font-black uppercase text-slate-500'>
                                                  <th className='px-3 py-2'>#</th>
                                                  <th className='px-3 py-2'>Date</th>
                                                  <th className='px-3 py-2'>Note</th>
                                                  <th className='px-3 py-2 text-right'>Amount</th>
                                                </tr>
                                              </thead>
                                              <tbody className='divide-y divide-slate-100'>
                                                {payments.map((p, idx) => (
                                                  <tr key={p.id}>
                                                    <td className='px-3 py-2 font-black text-slate-400'>{idx + 1}</td>
                                                    <td className='px-3 py-2 font-bold text-slate-600'>{p.paid_at ? formatPSTDate(p.paid_at) : '—'}</td>
                                                    <td className='px-3 py-2 font-bold text-slate-600'>{p.note || '—'}</td>
                                                    <td className='px-3 py-2 text-right font-black text-teal-700'>₱{Number(p.amount).toLocaleString()}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
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
