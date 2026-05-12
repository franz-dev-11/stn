import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { Star, ChevronDown, ChevronUp, Search, X, PlusCircle } from "lucide-react";

const VIPTransactions = () => {
  const location = useLocation();
  const autoCustomer = location.state?.customerName || "";

  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [searchQuery, setSearchQuery] = useState(autoCustomer);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [orderItems, setOrderItems] = useState({});
  const [payments, setPayments] = useState({});
  const [loadingItems, setLoadingItems] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paymentInputs, setPaymentInputs] = useState({}); // { [orderId]: { amount, note } }
  const [submittingPayment, setSubmittingPayment] = useState(null);
  const hasAutoExpanded = useRef(false);

  const fetchCustomers = async () => {
    const { data } = await supabase.from("vip_customers").select("id, name").order("name");
    setCustomers(data || []);
  };

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("vip_orders")
      .select("*")
      .order("created_at", { ascending: false });
    const loadedOrders = data || [];

    let payMap = {};
    if (loadedOrders.length > 0) {
      const orderIds = loadedOrders.map((o) => o.id);
      const { data: allPays } = await supabase
        .from("vip_payments")
        .select("*")
        .in("order_id", orderIds)
        .order("paid_at");
      (allPays || []).forEach((p) => {
        if (!payMap[p.order_id]) payMap[p.order_id] = [];
        payMap[p.order_id].push(p);
      });
    }

    setOrders(loadedOrders);
    setPayments(payMap);
    setLoading(false);

    if (autoCustomer && !hasAutoExpanded.current) {
      hasAutoExpanded.current = true;
      const match = loadedOrders.find((o) =>
        o.customer_name.toLowerCase().includes(autoCustomer.toLowerCase())
      );
      if (match) {
        setExpandedOrderId(match.id);
        setLoadingItems(true);
        const [{ data: items }, { data: pays }] = await Promise.all([
          supabase.from("vip_order_items").select("*").eq("order_id", match.id),
          supabase.from("vip_payments").select("*").eq("order_id", match.id).order("paid_at"),
        ]);
        setOrderItems((prev) => ({ ...prev, [match.id]: items || [] }));
        setPayments((prev) => ({ ...prev, [match.id]: pays || [] }));
        setLoadingItems(false);
      }
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCustomers();
    fetchOrders();
    const channel = supabase
      .channel("vip-transactions-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "vip_orders" }, fetchOrders)
      .on("postgres_changes", { event: "*", schema: "public", table: "vip_payments" }, fetchOrders)
      .on("postgres_changes", { event: "*", schema: "public", table: "vip_customers" }, fetchCustomers)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpand = async (orderId) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(orderId);
    if (!orderItems[orderId]) {
      setLoadingItems(true);
      const [{ data: items }, { data: pays }] = await Promise.all([
        supabase.from("vip_order_items").select("*").eq("order_id", orderId),
        supabase.from("vip_payments").select("*").eq("order_id", orderId).order("paid_at"),
      ]);
      setOrderItems((prev) => ({ ...prev, [orderId]: items || [] }));
      setPayments((prev) => ({ ...prev, [orderId]: pays || [] }));
      setLoadingItems(false);
    }
  };

  const handleAddPayment = async (orderId, outstanding) => {
    const input = paymentInputs[orderId] || {};
    const amount = parseFloat(input.amount);
    if (!amount || amount <= 0) { alert("Enter a valid payment amount."); return; }
    if (amount > outstanding) { alert(`Amount exceeds outstanding balance of ₱${outstanding.toLocaleString()}.`); return; }
    setSubmittingPayment(orderId);
    const { error } = await supabase.from("vip_payments").insert([{
      order_id: orderId,
      amount,
      note: input.note || "Installment Payment",
    }]);
    if (error) { alert("Failed to record payment: " + error.message); setSubmittingPayment(null); return; }
    // Refresh payments for this order
    const { data: updatedPays } = await supabase.from("vip_payments").select("*").eq("order_id", orderId).order("paid_at");
    setPayments((prev) => ({ ...prev, [orderId]: updatedPays || [] }));
    setPaymentInputs((prev) => ({ ...prev, [orderId]: { amount: "", note: "" } }));
    setSubmittingPayment(null);
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchCustomer = selectedCustomerId ? o.customer_id === selectedCustomerId : true;
      const matchSearch = searchQuery
        ? o.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      return matchCustomer && matchSearch;
    });
  }, [orders, selectedCustomerId, searchQuery]);

  const totalBalance = filteredOrders.reduce((sum, o) => {
    const paid = (payments[o.id] || []).reduce((s, p) => s + Number(p.amount), 0);
    return sum + Math.max(0, Math.round((Number(o.grand_total) - paid) * 100) / 100);
  }, 0);

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 bg-slate-50 min-h-screen font-sans text-slate-900">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Star className="text-teal-600" size={32} /> VIP TRANSACTIONS
        </h1>
        <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em] mt-2">
          VIP Orders | Payment History
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Filter by Customer</label>
          <div className="flex items-center gap-2">
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="border-2 border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-teal-500 transition-all text-slate-800 min-w-[200px]"
            >
              <option value="">All VIP Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {selectedCustomerId && (
              <button onClick={() => setSelectedCustomerId("")} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-all">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Search Name</label>
          <div className="flex items-center gap-2 border-2 border-slate-100 rounded-2xl px-4 py-3 focus-within:border-teal-500 transition-all">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="outline-none text-xs font-bold text-slate-800 w-40 bg-transparent"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-slate-300 hover:text-red-400"><X size={14} /></button>
            )}
          </div>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase">Total Outstanding Balance</p>
          <p className="text-2xl font-black text-red-500">₱{totalBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs font-black uppercase text-slate-400">Loading transactions...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-xs font-black uppercase text-slate-400">No transactions found.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-black text-white text-[10px] uppercase font-black">
                <th className="py-3 px-4 text-left">Order #</th>
                <th className="py-3 px-4 text-left">Customer</th>
                <th className="py-3 px-4 text-left">Date</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-right">Downpayment</th>
                <th className="py-3 px-4 text-center">Installments</th>
                <th className="py-3 px-4 text-right">Inst. Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const orderPayments = payments[order.id] || [];
                const totalPaid = orderPayments.reduce((s, p) => s + Number(p.amount), 0);
                const outstanding = Math.max(0, Math.round((Number(order.grand_total) - totalPaid) * 100) / 100);
                const isExpanded = expandedOrderId === order.id;
                const items = orderItems[order.id] || [];

                return (
                  <React.Fragment key={order.id}>
                    <tr className={`border-b border-slate-100 transition-colors ${isExpanded ? "bg-teal-50" : "hover:bg-slate-50"}`}>
                      <td className="py-3 px-4 font-mono font-black text-teal-700 text-xs">{order.so_number || '—'}</td>
                      <td className="py-3 px-4 font-black uppercase">{order.customer_name}</td>
                      <td className="py-3 px-4 text-slate-500 font-bold">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right font-black">₱{Number(order.grand_total).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-600">₱{Number(order.downpayment).toLocaleString()}</td>
                      <td className="py-3 px-4 text-center font-bold">{order.installments}x</td>
                      <td className="py-3 px-4 text-right font-bold text-teal-600">₱{Number(order.installment_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-center">
                        {outstanding <= 0 ? (
                          <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase px-2 py-1 rounded-full">Paid</span>
                        ) : (
                          <span className="bg-amber-100 text-amber-700 text-[10px] font-black uppercase px-2 py-1 rounded-full">
                            ₱{outstanding.toLocaleString(undefined, { maximumFractionDigits: 2 })} due
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => toggleExpand(order.id)}
                          className="p-2 rounded-xl hover:bg-teal-100 text-slate-400 hover:text-teal-700 transition-all"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded: Items + Payments */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={9} className="bg-slate-50 px-6 py-4">
                          {loadingItems && items.length === 0 ? (
                            <p className="text-xs text-slate-400 font-bold">Loading...</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Items */}
                              <div>
                                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Order Items</h4>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-slate-200 text-slate-600 text-[10px] uppercase font-black">
                                      <th className="py-2 px-3 text-left">Item</th>
                                      <th className="py-2 px-3 text-left">Batch</th>
                                      <th className="py-2 px-3 text-center">Qty</th>
                                      <th className="py-2 px-3 text-right">Original Price</th>
                                      <th className="py-2 px-3 text-right">Discount</th>
                                      <th className="py-2 px-3 text-right">Final Price</th>
                                      <th className="py-2 px-3 text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {items.map((item) => {
                                      const originalPrice = item.original_price || item.unit_price / (1 - (item.item_discount_pct || 0) / 100);
                                      const discountAmount = originalPrice * item.quantity * ((item.item_discount_pct || 0) / 100);
                                      return (
                                        <tr key={item.id} className="border-b border-slate-100">
                                          <td className="py-2 px-3 font-black uppercase">{item.item_name}</td>
                                          <td className="py-2 px-3 font-mono text-teal-600">{item.batch_number || "—"}</td>
                                          <td className="py-2 px-3 text-center font-bold">{item.quantity}</td>
                                          <td className="py-2 px-3 text-right font-bold">₱{Number(originalPrice).toLocaleString()}</td>
                                          <td className="py-2 px-3 text-right font-bold text-rose-500">{item.item_discount_pct > 0 ? `-${item.item_discount_pct}% (₱${discountAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })})` : "—"}</td>
                                          <td className="py-2 px-3 text-right font-bold">₱{Number(item.unit_price).toLocaleString()}</td>
                                          <td className="py-2 px-3 text-right font-black">₱{Number(item.subtotal).toLocaleString()}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                  <tfoot>
                                    {(() => {
                                      const itemsSubtotal = items.reduce((s, it) => s + Number(it.subtotal), 0);
                                      const globalDisc = Math.round((itemsSubtotal - Number(order.grand_total)) * 100) / 100;
                                      return (
                                        <>
                                          {globalDisc > 0 && (
                                            <>
                                              <tr className="border-t border-slate-200">
                                                <td colSpan={4} className="py-1 px-3 text-right text-[10px] font-bold text-slate-400 uppercase">Items Subtotal:</td>
                                                <td className="py-1 px-3 text-right font-bold text-slate-500">₱{itemsSubtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                              </tr>
                                              <tr>
                                                <td colSpan={4} className="py-1 px-3 text-right text-[10px] font-black text-rose-500 uppercase">Discount:</td>
                                                <td className="py-1 px-3 text-right font-black text-rose-500">-₱{globalDisc.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                              </tr>
                                            </>
                                          )}
                                          <tr className="border-t-2 border-slate-200">
                                            <td colSpan={4} className="py-2 px-3 text-right text-[10px] font-black uppercase text-slate-600">Grand Total:</td>
                                            <td className="py-2 px-3 text-right font-black">₱{Number(order.grand_total).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                          </tr>
                                        </>
                                      );
                                    })()}
                                  </tfoot>
                                </table>
                              </div>

                              {/* Payments */}
                              <div>
                                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Payment History</h4>
                                {orderPayments.length === 0 ? (
                                  <p className="text-xs text-slate-400 font-bold mb-3">No payments recorded yet.</p>
                                ) : (
                                  <table className="w-full text-xs mb-3">
                                    <thead>
                                      <tr className="bg-slate-200 text-slate-600 text-[10px] uppercase font-black">
                                        <th className="py-2 px-3 text-left">Date</th>
                                        <th className="py-2 px-3 text-left">Note</th>
                                        <th className="py-2 px-3 text-right">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {orderPayments.map((p) => (
                                        <tr key={p.id} className="border-b border-slate-100">
                                          <td className="py-2 px-3 font-bold text-slate-500">{new Date(p.paid_at).toLocaleDateString()}</td>
                                          <td className="py-2 px-3 font-bold">{p.note || "—"}</td>
                                          <td className="py-2 px-3 text-right font-black text-emerald-600">₱{Number(p.amount).toLocaleString()}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t-2 border-slate-200">
                                        <td colSpan={2} className="py-2 px-3 text-right text-[10px] font-black uppercase text-slate-400">Total Paid:</td>
                                        <td className="py-2 px-3 text-right font-black text-emerald-600">₱{totalPaid.toLocaleString()}</td>
                                      </tr>
                                      <tr>
                                        <td colSpan={2} className="py-2 px-3 text-right text-[10px] font-black uppercase text-slate-400">Outstanding:</td>
                                        <td className={`py-2 px-3 text-right font-black ${outstanding <= 0 ? "text-emerald-600" : "text-red-500"}`}>
                                          ₱{outstanding.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                )}

                                {/* Add Payment Form */}
                                {outstanding > 0 && (
                                  <div className="bg-white border-2 border-teal-100 rounded-2xl p-4 mt-2">
                                    <p className="text-[10px] font-black uppercase text-teal-600 tracking-widest mb-3">Record New Payment</p>
                                    <div className="flex flex-col gap-2">
                                      <div className="flex gap-2 items-center">
                                        <div className="flex-1">
                                          <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Amount (₱)</label>
                                          <input
                                            type="number"
                                            min="1"
                                            max={outstanding}
                                            placeholder={`Max ₱${outstanding.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                                            value={paymentInputs[order.id]?.amount || ""}
                                            onChange={(e) => setPaymentInputs((prev) => ({ ...prev, [order.id]: { ...prev[order.id], amount: e.target.value } }))}
                                            className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-teal-500 transition-all"
                                          />
                                        </div>
                                        <button
                                          onClick={() => setPaymentInputs((prev) => ({ ...prev, [order.id]: { ...prev[order.id], amount: outstanding.toFixed(2) } }))}
                                          className="mt-5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-teal-50 hover:text-teal-700 transition-all whitespace-nowrap"
                                        >
                                          Full Balance
                                        </button>
                                        <button
                                          onClick={() => setPaymentInputs((prev) => ({ ...prev, [order.id]: { ...prev[order.id], amount: Number(order.installment_amount).toFixed(2) } }))}
                                          className="mt-5 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-teal-50 hover:text-teal-700 transition-all whitespace-nowrap"
                                        >
                                          1 Installment
                                        </button>
                                      </div>
                                      <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Note (optional)</label>
                                        <input
                                          type="text"
                                          placeholder="e.g. Installment 2, Cash payment..."
                                          value={paymentInputs[order.id]?.note || ""}
                                          onChange={(e) => setPaymentInputs((prev) => ({ ...prev, [order.id]: { ...prev[order.id], note: e.target.value } }))}
                                          className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-teal-500 transition-all"
                                        />
                                      </div>
                                      <button
                                        disabled={submittingPayment === order.id || !paymentInputs[order.id]?.amount}
                                        onClick={() => handleAddPayment(order.id, outstanding)}
                                        className="w-full bg-black text-white py-3 rounded-xl text-xs font-black uppercase hover:bg-teal-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
                                      >
                                        <PlusCircle size={14} />
                                        {submittingPayment === order.id ? "Recording..." : "Record Payment"}
                                      </button>
                                    </div>
                                  </div>
                                )}
                                {outstanding <= 0 && (
                                  <div className="bg-emerald-50 border-2 border-emerald-100 rounded-2xl px-4 py-3 text-xs font-black text-emerald-600 text-center mt-2">
                                    ✓ Fully Paid
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default VIPTransactions;
