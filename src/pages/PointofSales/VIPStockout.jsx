import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../supabaseClient";
import {
  Search,
  ShoppingCart,
  X,
  Trash2,
  Package,
  CheckCircle,
  ChevronLeft,
  Printer,
  Plus,
  Minus,
  AlertCircle,
  Layers,
  Star,
} from "lucide-react";

const VIPStockout = () => {
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState("browse");
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const [vipCustomers, setVipCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showAddVIP, setShowAddVIP] = useState(false);
  const [newVIP, setNewVIP] = useState({ name: "", email: "", phone: "" });
  const [addingVIP, setAddingVIP] = useState(false);

  const [paymentTerms, setPaymentTerms] = useState({ downpayment: 0, installments: 1 });
  const [lastOrder, setLastOrder] = useState(null);

  useEffect(() => {
    fetchInventory();
    fetchVIPCustomers();
  }, []);

  const fetchInventory = async () => {
    const { data, error } = await supabase
      .from("hardware_inventory")
      .select("*, product_pricing (manual_retail_price), inventory_batches (*)")
      .order("name", { ascending: true });
    if (error) { console.error(error); return; }
    const formatted = (data || []).map((item) => {
      const availableBatches = (item.inventory_batches || [])
        .filter((b) => b.current_stock > 0)
        .sort((a, b) => new Date(a.expiry_date || 0) - new Date(b.expiry_date || 0));
      return {
        ...item,
        displayPrice: parseFloat(item.product_pricing?.manual_retail_price || 0),
        batches: availableBatches,
        selectedBatchId: availableBatches.length > 0 ? availableBatches[0].id : null,
      };
    });
    setItems(formatted);
  };

  const fetchVIPCustomers = async () => {
    const { data } = await supabase.from("vip_customers").select("*");
    setVipCustomers(data || []);
  };

  const handleAddVIP = async (e) => {
    e.preventDefault();
    setAddingVIP(true);
    const { name, email, phone } = newVIP;
    if (!name) { alert("Name is required"); setAddingVIP(false); return; }
    const { error } = await supabase.from("vip_customers").insert([{ name, email, phone, is_vip: true }]);
    if (error) { alert("Failed to add VIP customer: " + error.message); }
    else { setShowAddVIP(false); setNewVIP({ name: "", email: "", phone: "" }); fetchVIPCustomers(); }
    setAddingVIP(false);
  };

  const handleBatchChange = (itemId, batchId) => {
    setItems((prev) => prev.map((item) => item.id === itemId ? { ...item, selectedBatchId: batchId } : item));
  };

  const addToCart = (item) => {
    const selectedBatch = item.batches.find((b) => b.id === item.selectedBatchId);
    if (!selectedBatch) { alert("Please select an available batch."); return; }
    const cartId = `${item.id}-${selectedBatch.id}`;
    const exists = cart.find((c) => c.cartId === cartId);
    if (exists) {
      if (exists.quantity + 1 > selectedBatch.current_stock) { alert("Not enough stock in this batch."); return; }
      setCart(cart.map((c) => c.cartId === cartId ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { ...item, cartId, quantity: 1, activeBatch: selectedBatch }]);
    }
    setIsCartOpen(true);
  };

  const updateCartQty = (cartId, delta, maxStock) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.cartId !== cartId) return item;
        const newQty = typeof delta === "number" ? Math.max(1, item.quantity + delta) : Math.max(1, parseInt(delta) || 1);
        if (newQty > maxStock) return item;
        return { ...item, quantity: newQty };
      })
    );
  };

  const grandTotal = cart.reduce((s, i) => s + i.displayPrice * i.quantity, 0);
  const balance = grandTotal - (paymentTerms.downpayment || 0);
  const installmentAmt = balance / Math.max(1, paymentTerms.installments);

  const handleFinalizeOrder = async () => {
    if (!selectedCustomer) { alert("Please select a VIP customer."); return; }
    if (cart.length === 0) return;
    setIsCompleting(true);
    try {
      // 1. Generate SO number with VIP prefix
      const year = new Date().getFullYear();
      const prefix = `VIP-${year}-`;
      const { data: latestSO } = await supabase
        .from("sales_transactions")
        .select("so_number")
        .like("so_number", `${prefix}%`)
        .order("so_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastSeq = latestSO?.so_number
        ? parseInt(latestSO.so_number.replace(prefix, ""), 10) || 0
        : 0;
      const soNum = `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;

      // 2. Insert into sales_transactions (so it appears in Outbound Scheduling)
      const { data: txData, error: txErr } = await supabase
        .from("sales_transactions")
        .insert([{
          so_number: soNum,
          customer_name: selectedCustomer.name,
          transaction_type: "vip",
          total_amount: grandTotal,
          status: "Pending",
        }])
        .select()
        .single();
      if (txErr) throw txErr;

      // 3. Insert sales_items (for Outbound inventory deduction on Completed)
      const salesItemRows = cart.map((item) => ({
        transaction_id: txData.id,
        product_id: item.id,
        item_name: item.name,
        quantity: item.quantity,
        unit_price: item.displayPrice,
      }));
      const { error: salesItemsErr } = await supabase.from("sales_items").insert(salesItemRows);
      if (salesItemsErr) throw salesItemsErr;

      // 4. Insert VIP Order (payment terms record)
      const { data: orderData, error: orderErr } = await supabase
        .from("vip_orders")
        .insert([{
          customer_id: selectedCustomer.id,
          customer_name: selectedCustomer.name,
          grand_total: grandTotal,
          downpayment: paymentTerms.downpayment || 0,
          balance,
          installments: paymentTerms.installments,
          installment_amount: installmentAmt,
          status: "Active",
          so_number: soNum,
        }])
        .select()
        .single();
      if (orderErr) throw orderErr;

      // 5. Insert VIP order items
      const vipItemRows = cart.map((item) => ({
        order_id: orderData.id,
        product_id: item.id,
        item_name: item.name,
        batch_number: item.activeBatch?.batch_number || null,
        quantity: item.quantity,
        unit_price: item.displayPrice,
        subtotal: item.displayPrice * item.quantity,
      }));
      const { error: itemsErr } = await supabase.from("vip_order_items").insert(vipItemRows);
      if (itemsErr) throw itemsErr;

      // 6. Record downpayment as first payment if > 0
      if ((paymentTerms.downpayment || 0) > 0) {
        const { error: payErr } = await supabase.from("vip_payments").insert([{
          order_id: orderData.id,
          amount: paymentTerms.downpayment,
          note: "Downpayment",
        }]);
        if (payErr) throw payErr;
      }

      setLastOrder({
        orderId: orderData.id,
        soNum,
        customerName: selectedCustomer.name,
        items: [...cart],
        grandTotal,
        paymentTerms: { ...paymentTerms },
        balance,
        installmentAmt,
        date: new Date().toLocaleDateString(),
      });
      setCart([]);
      setPaymentTerms({ downpayment: 0, installments: 1 });
      setIsCartOpen(false);
      setView("invoice");
    } catch (err) {
      alert("Order failed: " + err.message);
    } finally {
      setIsCompleting(false);
    }
  };

  const filteredItems = useMemo(() =>
    items.filter((i) =>
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    ), [items, searchQuery]);

  if (view === "invoice") return <VIPInvoiceView order={lastOrder} onBack={() => setView("browse")} />;

  return (
    <div className='p-3 sm:p-4 md:p-6 lg:p-8 bg-slate-50 min-h-screen font-sans text-slate-900'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-10 gap-4'>
        <div>
          <h1 className='text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3'>
            <Star className='text-teal-600' size={32} /> VIP STOCKOUT
          </h1>
          <p className='text-slate-600 font-bold text-[8px] sm:text-xs uppercase tracking-[0.2em] mt-2'>
            VIP Sales | Payment Terms
          </p>
        </div>
        <button
          onClick={() => setIsCartOpen(true)}
          className='bg-white p-4 sm:p-5 rounded-2xl shadow-sm transition-all relative self-start sm:self-center'
        >
          <ShoppingCart />
          {cart.length > 0 && (
            <span className='absolute -top-2 -right-2 bg-teal-600 text-white text-[8px] sm:text-[10px] font-black w-6 sm:w-7 h-6 sm:h-7 flex items-center justify-center rounded-full border-4 border-slate-50'>
              {cart.length}
            </span>
          )}
        </button>
      </div>

      {/* VIP Customer Section */}
      <div className='bg-white rounded-2xl p-6 shadow-sm mb-6'>
        <div className='flex flex-wrap justify-between items-center mb-4 gap-4'>
          <h2 className='text-sm font-black uppercase text-slate-800 flex items-center gap-2'>
            <Star size={16} className='text-teal-500' /> VIP Customers
          </h2>
          <button
            onClick={() => setShowAddVIP((v) => !v)}
            className='px-4 py-3 bg-teal-600 text-white rounded-2xl text-xs font-black uppercase tracking-wide hover:bg-teal-700 transition-all'
          >
            {showAddVIP ? "Cancel" : "+ Add VIP Customer"}
          </button>
        </div>

        {showAddVIP && (
          <form onSubmit={handleAddVIP} className='mb-5 flex flex-wrap gap-3 items-end'>
            <input type="text" placeholder="Name *" value={newVIP.name} onChange={(e) => setNewVIP((v) => ({ ...v, name: e.target.value }))} className='border-2 border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-teal-500 transition-all' required />
            <input type="email" placeholder="Email (optional)" value={newVIP.email} onChange={(e) => setNewVIP((v) => ({ ...v, email: e.target.value }))} className='border-2 border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-teal-500 transition-all' />
            <input type="text" placeholder="Phone (optional)" value={newVIP.phone} onChange={(e) => setNewVIP((v) => ({ ...v, phone: e.target.value }))} className='border-2 border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-teal-500 transition-all' />
            <button type="submit" disabled={addingVIP} className='bg-black text-white px-5 py-3 rounded-2xl font-black uppercase text-xs hover:bg-teal-700 transition-all disabled:opacity-50'>{addingVIP ? "Adding..." : "Add VIP"}</button>
          </form>
        )}

        {/* VIP Customers Table */}
        {vipCustomers.length === 0 ? (
          <p className='text-xs font-bold text-slate-400 uppercase'>No VIP customers yet.</p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead>
                <tr className='bg-black text-white text-[10px] uppercase font-black'>
                  <th className='py-3 px-4 text-left'>Name</th>
                  <th className='py-3 px-4 text-left'>Email</th>
                  <th className='py-3 px-4 text-left'>Phone</th>
                  <th className='py-3 px-4 text-center'>Status</th>
                  <th className='py-3 px-4 text-center'>Action</th>
                </tr>
              </thead>
              <tbody>
                {vipCustomers.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-b border-slate-100 transition-colors cursor-pointer ${selectedCustomer?.id === c.id ? "bg-teal-50" : "hover:bg-slate-50"}`}
                    onClick={() => setSelectedCustomer(selectedCustomer?.id === c.id ? null : c)}
                  >
                    <td className='py-3 px-4 font-black uppercase'>{c.name}</td>
                    <td className='py-3 px-4 text-slate-500 font-bold'>{c.email || "—"}</td>
                    <td className='py-3 px-4 text-slate-500 font-bold'>{c.phone || "—"}</td>
                    <td className='py-3 px-4 text-center'>
                      <span className='bg-teal-100 text-teal-700 text-[10px] font-black uppercase px-2 py-1 rounded-full'>VIP</span>
                    </td>
                    <td className='py-3 px-4 text-center'>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedCustomer(c); setIsCartOpen(true); }}
                        className='bg-black text-white text-[10px] font-black uppercase px-3 py-2 rounded-xl hover:bg-teal-600 transition-all'
                      >
                        Select & Shop
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedCustomer && (
          <div className='mt-4 bg-teal-50 rounded-xl px-4 py-2 text-xs font-black text-teal-700 flex items-center gap-2'>
            <CheckCircle size={14} /> Selected: {selectedCustomer.name}
            <button onClick={() => setSelectedCustomer(null)} className='ml-auto text-slate-400 hover:text-red-500'><X size={14} /></button>
          </div>
        )}
      </div>

      {/* Products + Summary */}
      <div className='grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8'>
        <div className='lg:col-span-3'>
          {/* Search */}
          <div className='bg-white p-2 rounded-2xl mb-6 sm:mb-8 flex gap-4 shadow-sm'>
            <div className='p-3 sm:p-4'><Search className='text-slate-400' size={20} /></div>
            <input
              type='text'
              placeholder='Search products...'
              className='flex-1 outline-none font-bold uppercase text-xs'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Product Grid */}
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6'>
            {filteredItems.length > 0 ? filteredItems.map((item) => {
              const isOutOfStock = item.batches.length === 0;
              return (
                <div key={item.id} className={`bg-white rounded-[2rem] border-2 p-6 transition-all flex flex-col justify-between ${isOutOfStock ? "opacity-60 border-slate-100" : "border-slate-100 hover:shadow-xl hover:border-teal-500"}`}>
                  <div>
                    <div className='flex justify-between items-start mb-4'>
                      <div className={`p-3 rounded-xl ${isOutOfStock ? "bg-slate-100 text-slate-400" : "bg-teal-50 text-teal-600"}`}>
                        {isOutOfStock ? <AlertCircle size={20} /> : <Package size={20} />}
                      </div>
                      <span className='text-[10px] font-mono font-bold text-slate-300'>#{item.sku || "N/A"}</span>
                    </div>
                    <h3 className='font-black uppercase text-sm mb-1 leading-tight'>{item.name}</h3>
                    <p className='text-[10px] font-black text-slate-400 uppercase tracking-tighter'>Per {item.unit || "unit"}</p>

                    {!isOutOfStock && (
                      <div className='mt-4'>
                        <label className='text-[9px] font-black text-slate-400 uppercase flex items-center gap-1 mb-1.5 ml-1'>
                          <Layers size={10} className='text-teal-500' /> Select Batch
                        </label>
                        <select
                          className='w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-[11px] font-bold appearance-none cursor-pointer outline-none focus:border-teal-500 transition-all text-slate-700'
                          value={item.selectedBatchId}
                          onChange={(e) => handleBatchChange(item.id, e.target.value)}
                        >
                          {item.batches.map((batch) => (
                            <option key={batch.id} value={batch.id}>
                              {batch.batch_number} — ({batch.current_stock} available)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className='mt-6'>
                    <div className='flex items-end justify-between mb-4'>
                      <p className='text-2xl font-black italic'>₱{item.displayPrice.toLocaleString()}</p>
                      <div className='text-right'>
                        <p className='text-[9px] font-black text-slate-300 uppercase'>Status</p>
                        <p className={`text-xs font-black ${isOutOfStock ? "text-red-500" : "text-emerald-500"}`}>
                          {isOutOfStock ? "Sold Out" : "In Stock"}
                        </p>
                      </div>
                    </div>
                    <button
                      disabled={isOutOfStock}
                      onClick={() => addToCart(item)}
                      className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase transition-all shadow-sm active:scale-95 ${isOutOfStock ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-slate-900 text-white hover:bg-teal-600"}`}
                    >
                      {isOutOfStock ? "No Stock Available" : "Add to Cart"}
                    </button>
                  </div>
                </div>
              );
            }) : (
              <div className='col-span-3 bg-white rounded-2xl p-12 text-center'>
                <p className='text-xs font-black uppercase text-slate-500'>No products to display</p>
              </div>
            )}
          </div>
        </div>

        {/* Summary Panel */}
        <div className='lg:col-span-1'>
          <div className='bg-white rounded-[2.5rem] p-8 shadow-sm sticky top-8'>
            <h2 className='text-xl font-black uppercase italic mb-6 text-slate-800'>Summary</h2>
            <div className='pt-2'>
              <p className='text-[10px] font-black uppercase text-slate-400 mb-1'>Estimated Total</p>
              <h2 className='text-4xl font-black italic text-teal-600'>₱{grandTotal.toLocaleString()}</h2>
              <button
                disabled={cart.length === 0}
                onClick={() => setIsCartOpen(true)}
                className='w-full mt-8 bg-black text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-teal-700 transition-all disabled:opacity-30'
              >
                Checkout ({cart.length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className='fixed inset-0 z-50 flex justify-end'>
          <div className='absolute inset-0 bg-slate-900/40 backdrop-blur-md' onClick={() => setIsCartOpen(false)} />
          <div className='relative w-full max-w-md bg-white h-full p-10 shadow-2xl flex flex-col overflow-y-auto'>
            <div className='flex justify-between items-center mb-10'>
              <h2 className='text-3xl font-black uppercase italic tracking-tighter'>Cart</h2>
              <button onClick={() => setIsCartOpen(false)} className='p-2 hover:bg-slate-100 rounded-full'><X size={28} /></button>
            </div>

            <div className='flex-1 space-y-4 pr-2'>
              {cart.map((item) => (
                <div key={item.cartId} className='bg-white border-2 border-slate-50 p-5 rounded-3xl'>
                  <div className='flex justify-between mb-2'>
                    <p className='font-black text-sm uppercase leading-tight w-2/3'>{item.name}</p>
                    <button onClick={() => setCart(cart.filter((c) => c.cartId !== item.cartId))} className='text-slate-300 hover:text-red-500'><Trash2 size={18} /></button>
                  </div>
                  <p className='text-[10px] font-bold text-teal-500 uppercase mb-3'>Batch: {item.activeBatch.batch_number}</p>
                  <div className='flex justify-between items-center'>
                    <div className='flex items-center gap-3 rounded-xl px-2 py-1'>
                      <button onClick={() => updateCartQty(item.cartId, -1, item.activeBatch.current_stock)}><Minus size={14} /></button>
                      <input
                        type='number' min='1' max={item.activeBatch.current_stock} value={item.quantity}
                        onChange={(e) => updateCartQty(item.cartId, e.target.value, item.activeBatch.current_stock)}
                        className='font-black text-xs w-16 text-center border border-slate-200 rounded px-2 outline-none focus:border-teal-500'
                      />
                      <button onClick={() => updateCartQty(item.cartId, 1, item.activeBatch.current_stock)}><Plus size={14} /></button>
                    </div>
                    <p className='font-black text-slate-900'>₱{(item.displayPrice * item.quantity).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Payment Terms */}
            <div className='mt-8 pt-6 border-t-2 border-slate-100'>
              <h3 className='text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4'>Payment Terms</h3>
              <div className='flex flex-col gap-3 mb-4'>
                <div>
                  <label className='text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1'>Downpayment (₱)</label>
                  <input
                    type='number' min='0' max={grandTotal} value={paymentTerms.downpayment}
                    onChange={(e) => setPaymentTerms((pt) => ({ ...pt, downpayment: Math.max(0, Number(e.target.value)) }))}
                    className='w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-teal-500 transition-all'
                  />
                </div>
                <div>
                  <label className='text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1'>Installments</label>
                  <input
                    type='number' min='1' max='24' value={paymentTerms.installments}
                    onChange={(e) => setPaymentTerms((pt) => ({ ...pt, installments: Math.max(1, Number(e.target.value)) }))}
                    className='w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-teal-500 transition-all'
                  />
                </div>
              </div>
              <div className='bg-teal-50 rounded-2xl p-4 text-xs font-bold text-teal-700 mb-6 space-y-1'>
                <div className='flex justify-between'><span>Grand Total</span><span>₱{grandTotal.toLocaleString()}</span></div>
                <div className='flex justify-between'><span>Downpayment</span><span>₱{Number(paymentTerms.downpayment).toLocaleString()}</span></div>
                <div className='flex justify-between font-black text-teal-900'><span>Balance</span><span>₱{balance.toLocaleString()}</span></div>
                <div className='flex justify-between'><span>Per Installment ({paymentTerms.installments}x)</span><span>₱{installmentAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
              </div>
            </div>

            <div className='flex justify-between items-end mb-6'>
              <p className='text-[10px] font-black text-slate-400 uppercase'>Grand Total</p>
              <p className='text-3xl font-black italic'>₱{grandTotal.toLocaleString()}</p>
            </div>
            <button
              disabled={cart.length === 0 || isCompleting || !selectedCustomer}
              onClick={handleFinalizeOrder}
              className='w-full bg-black text-white py-6 rounded-[2rem] font-black uppercase text-sm tracking-widest shadow-xl disabled:opacity-50 hover:bg-teal-600 transition-all flex items-center justify-center gap-3'
            >
              <CheckCircle size={20} /> {isCompleting ? "Finalizing..." : "Finalize VIP Sale"}
            </button>
            {!selectedCustomer && <p className='text-center text-[10px] text-red-400 font-bold mt-2'>Select a VIP customer to proceed.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

const VIPInvoiceView = ({ order, onBack }) => {
  const downpayment = Number(order.paymentTerms.downpayment) || 0;
  const progressPct = order.grandTotal > 0 ? Math.min(100, (downpayment / order.grandTotal) * 100) : 0;
  const outstanding = Math.max(0, order.grandTotal - downpayment);

  return (
    <div className='p-8 bg-slate-50 min-h-screen font-sans'>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-receipt, #print-receipt * { visibility: visible !important; }
          #print-receipt { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className='max-w-3xl mx-auto'>
        <button onClick={onBack} className='mb-6 flex items-center gap-2 font-black uppercase text-[10px] text-slate-400 hover:text-black no-print'>
          <ChevronLeft size={16} /> New Transaction
        </button>
        <div className='bg-black text-white px-8 py-4 flex justify-between items-center rounded-t-2xl no-print'>
          <h2 className='font-black uppercase tracking-widest text-sm flex items-center gap-2'>
            <CheckCircle size={16} className='text-teal-400' /> Transaction Complete
          </h2>
          <button onClick={() => window.print()} className='bg-white text-black px-4 py-2 rounded-lg text-[10px] font-black flex items-center gap-2 hover:bg-slate-200 transition-all'>
            <Printer size={14} /> Print Receipt
          </button>
        </div>
        <div id='print-receipt' className='bg-white p-8 rounded-b-2xl shadow-sm'>
          {/* Header */}
          <div className='flex justify-between items-start pb-4 mb-6 border-b-2 border-slate-200'>
            <div>
              <h1 className='text-4xl font-black uppercase italic leading-none'>Billing Statement</h1>
              <p className='text-xs font-bold text-slate-600 mt-2'>{order.items.length} Item{order.items.length !== 1 ? "s" : ""}</p>
            </div>
            <div className='text-right'>
              <p className='text-sm font-black uppercase'>Date: {order.date}</p>
              <p className='text-[10px] font-bold text-slate-600 uppercase'>Ref: {order.soNum}</p>
            </div>
          </div>
          {/* Billed To / Issued By */}
          <div className='grid grid-cols-2 gap-8 mb-8'>
            <div>
              <h4 className='text-[10px] font-black text-slate-600 uppercase mb-1'>Billed To:</h4>
              <p className='text-sm font-black uppercase'>{order.customerName}</p>
              <p className='text-xs font-medium text-slate-600 uppercase mt-0.5'>VIP Customer</p>
            </div>
            <div className='text-right'>
              <h4 className='text-[10px] font-black text-slate-600 uppercase mb-1'>Issued By:</h4>
              <p className='text-sm font-black uppercase'>JohnCel Trading</p>
              <p className='text-xs font-medium text-slate-600'>254 Dir. A. Bunye, Bagumbayan</p>
              <p className='text-xs font-medium text-slate-600'>Taguig, 1630 Kalakhang Maynila</p>
            </div>
          </div>
          {/* Items Table */}
          <table className='w-full text-left mb-6'>
            <thead>
              <tr className='bg-black text-white text-[10px] uppercase font-black'>
                <th className='py-3 px-2'>Description</th>
                <th className='py-3 px-2'>Batch</th>
                <th className='py-3 px-2 text-center'>Qty</th>
                <th className='py-3 px-2 text-right'>Unit Price</th>
                <th className='py-3 px-2 text-right'>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((i, idx) => (
                <tr key={idx} className='border-b border-slate-100'>
                  <td className='py-4 px-2 text-sm font-black uppercase'>{i.name}</td>
                  <td className='py-4 px-2 text-[10px] font-mono font-bold text-teal-600'>{i.activeBatch?.batch_number?.split("-").slice(0, 2).join("-")}</td>
                  <td className='py-4 px-2 text-center font-black'>{i.quantity}</td>
                  <td className='py-4 px-2 text-right text-sm font-bold'>₱{i.displayPrice?.toLocaleString()}</td>
                  <td className='py-4 px-2 text-right text-sm font-black'>₱{(i.displayPrice * i.quantity).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className='border-t-2 border-slate-200'>
                <td colSpan='4' className='py-6 text-right text-sm font-black uppercase text-slate-600'>Grand Total:</td>
                <td className='py-6 text-right text-xl font-black underline decoration-4 decoration-teal-500'>₱{order.grandTotal.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
          {/* VIP Payment Terms Panel */}
          <div className='mt-6 border-t-2 border-teal-400 pt-6'>
            <h3 className='text-[10px] font-black uppercase text-teal-700 tracking-widest mb-4'>VIP Payment Terms</h3>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4'>
              <div className='bg-slate-50 rounded-xl p-3'>
                <p className='text-[9px] font-black uppercase text-slate-500 mb-1'>Grand Total</p>
                <p className='text-sm font-black'>₱{order.grandTotal.toLocaleString()}</p>
              </div>
              <div className='bg-slate-50 rounded-xl p-3'>
                <p className='text-[9px] font-black uppercase text-slate-500 mb-1'>Downpayment</p>
                <p className='text-sm font-black'>₱{downpayment.toLocaleString()}</p>
              </div>
              <div className='bg-slate-50 rounded-xl p-3'>
                <p className='text-[9px] font-black uppercase text-slate-500 mb-1'>Installments</p>
                <p className='text-sm font-black'>{order.paymentTerms.installments}× ₱{order.installmentAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
              <div className={`rounded-xl p-3 ${outstanding > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                <p className='text-[9px] font-black uppercase text-slate-500 mb-1'>Outstanding</p>
                <p className={`text-sm font-black ${outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>₱{outstanding.toLocaleString()}</p>
              </div>
            </div>
            {/* Progress Bar */}
            <div>
              <div className='flex justify-between text-[9px] font-black uppercase text-slate-500 mb-1'>
                <span>Payment Progress</span>
                <span>{progressPct.toFixed(0)}%</span>
              </div>
              <div className='w-full bg-slate-200 rounded-full h-2'>
                <div className='bg-teal-500 h-2 rounded-full transition-all' style={{ width: `${progressPct}%` }} />
              </div>
              <div className='flex justify-between text-[9px] font-bold text-slate-400 mt-1'>
                <span>Paid: ₱{downpayment.toLocaleString()}</span>
                <span>Total: ₱{order.grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VIPStockout;
