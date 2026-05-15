import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../supabaseClient";
import { getSessionUser, getPerformedBy, insertAuditTrail } from "../../utils/auditTrail";
import { printElement } from "../../utils/printUtils";
import { formatPSTDate, getCurrentPSTDateTime, getTodayPSTDateString, convertToPhilippineDate } from "../../utils/dateTimeUtils";
import {
  Search,
  ShoppingCart,
  Calculator,
  X,
  Trash2,
  Package,
  CheckCircle,
  ChevronLeft,
  Printer,
  Plus,
  Minus,
  Info,
  AlertCircle,
  Layers,
} from "lucide-react";

const RecordSales = () => {
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState("browse");
  const [cart, setCart] = useState(() => {
    try {
      const saved = sessionStorage.getItem("pos_cart");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [transactionType, setTransactionType] = useState("walk-in");
  const [lastOrder, setLastOrder] = useState(null);

  useEffect(() => {
    sessionStorage.setItem("pos_cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    fetchInventory();
    const channel = supabase
      .channel("pos-inventory-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "hardware_inventory" }, fetchInventory)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_batches" }, fetchInventory)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from("hardware_inventory")
        .select(
          `
          *, 
          product_pricing (manual_retail_price),
          inventory_batches (*)
        `,
        )
        .order("name", { ascending: true });

      if (error) throw error;

      const formattedData = (data || []).map((item) => {
        const availableBatches = (item.inventory_batches || [])
          .filter((b) => b.current_stock > 0)
          .sort(
            (a, b) =>
              new Date(a.expiry_date || 0) - new Date(b.expiry_date || 0),
          );

        return {
          ...item,
          displayPrice: parseFloat(
            item.product_pricing?.manual_retail_price || 0,
          ),
          batches: availableBatches,
          selectedBatchId:
            availableBatches.length > 0 ? availableBatches[0].id : null,
        };
      });

      setItems(formattedData);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const handleBatchChange = (itemId, batchId) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, selectedBatchId: batchId } : item,
      ),
    );
  };

  const addToCart = (item) => {
    const selectedBatch = item.batches.find(
      (b) => b.id === item.selectedBatchId,
    );

    if (!selectedBatch) {
      alert("Please select an available batch.");
      return;
    }

    const cartId = `${item.id}-${selectedBatch.id}`;
    const exists = cart.find((c) => c.cartId === cartId);

    if (exists) {
      if (exists.quantity + 1 > selectedBatch.current_stock) {
        alert("Not enough stock in this specific batch.");
        return;
      }
      setCart(
        cart.map((c) =>
          c.cartId === cartId ? { ...c, quantity: c.quantity + 1 } : c,
        ),
      );
    } else {
      setCart([
        ...cart,
        {
          ...item,
          cartId,
          quantity: 1,
          activeBatch: selectedBatch,
        },
      ]);
    }
    setIsCartOpen(true);
  };

  const updateCartQty = (cartId, deltaOrValue, maxStock) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.cartId === cartId) {
          let newQty;
          if (typeof deltaOrValue === "number") {
            newQty = Math.max(1, item.quantity + deltaOrValue);
          } else {
            newQty = Math.max(1, parseInt(deltaOrValue) || 1);
          }
          if (newQty > maxStock) return item;
          return { ...item, quantity: newQty };
        }
        return item;
      }),
    );
  };

  const handleFinalizeOrder = async () => {
    if (cart.length === 0) return;
    setIsCompleting(true);
    try {
      const year = new Date().getFullYear();
      const prefix = `SO-${year}`;
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
      const totalAmount = cart.reduce(
        (sum, i) => sum + i.displayPrice * i.quantity,
        0,
      );

      // 1. Create the Transaction Record
      const _todayStr = getTodayPSTDateString();
      const { data: txData, error: txErr } = await supabase
        .from("sales_transactions")
        .insert([
          {
            so_number: soNum,
            customer_name: customerName,
            transaction_type: transactionType,
            total_amount: totalAmount,
            status: transactionType === "walk-in" ? "Completed" : "Pending",
            ...(transactionType === "walk-in" && {
              date_processed: _todayStr,
              delivery_date: _todayStr,
            }),
          },
        ])
        .select()
        .single();

      if (txErr) throw txErr;

      // 2. Prepare Item Rows
      // FIXED: Removed 'id: item.activeBatch.id' so the DB generates a unique UUID
      const itemRows = cart.map((item) => ({
        transaction_id: txData.id,
        product_id: item.id,
        item_name: item.name,
        quantity: item.quantity,
        unit_price: item.displayPrice,
      }));

      const { error: itemsErr } = await supabase
        .from("sales_items")
        .insert(itemRows);

      if (itemsErr) throw itemsErr;

      // 3. Deduct Stock from Batches and update hardware_inventory tallies
      for (const item of cart) {
        const { error: stockErr } = await supabase
          .from("inventory_batches")
          .update({
            current_stock: item.activeBatch.current_stock - item.quantity,
          })
          .eq("id", item.activeBatch.id);

        if (stockErr) console.error("Stock update error:", stockErr);

        const { data: inv } = await supabase
          .from("hardware_inventory")
          .select("stock_balance, outbound_qty")
          .eq("id", item.id)
          .single();

        await supabase
          .from("hardware_inventory")
          .update({
            stock_balance: Number(inv?.stock_balance || 0) - Number(item.quantity),
            outbound_qty: Number(inv?.outbound_qty || 0) + Number(item.quantity),
          })
          .eq("id", item.id);
      }

      // Audit trail — one row per item sold
      const user = getSessionUser();
      const performedBy = getPerformedBy(user);
      await insertAuditTrail(
        cart.map((item) => ({
          action: "SALE",
          reference_number: soNum,
          product_id: item.id,
          item_name: item.name,
          sku: item.sku || null,
          supplier: item.supplier || null,
          quantity: item.quantity,
          unit_cost: item.displayPrice,
          total_amount: item.quantity * item.displayPrice,
          performed_by: performedBy,
        }))
      );

      setLastOrder({
        soNum,
        customerName,
        transactionType,
        totalAmount,
        items: [...cart],
        date: formatPSTDate(new Date()),
      });
      setCart([]);
      sessionStorage.removeItem("pos_cart");
      setIsCartOpen(false);
      setView("invoice");
      fetchInventory();
    } catch (err) {
      alert("Order failed: " + err.message);
    } finally {
      setIsCompleting(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.sku?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [items, searchQuery]);

  if (view === "invoice")
    return <InvoiceView order={lastOrder} onBack={() => setView("browse")} />;

  return (
    <div className='p-3 sm:p-4 md:p-6 lg:p-8 bg-slate-50 min-h-screen font-sans text-slate-900 overflow-x-hidden'>
      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-10 gap-4'>
        <div>
          <h1 className='text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3'>
            <Calculator className='text-teal-600' size={32} /> POINT OF SALES
          </h1>
          <p className='text-slate-600 font-bold text-[8px] sm:text-xs uppercase tracking-[0.2em] mt-2'>
            Sales Capture | Inventory Terminal
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

      <div className='grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8'>
        <div className='lg:col-span-3'>
          <div className='bg-white p-2 rounded-2xl mb-6 sm:mb-8 flex gap-4 shadow-sm transition-all'>
            <div className='p-3 sm:p-4'>
              <Search className='text-slate-400' size={20} />
            </div>
            <input
              type='text'
              placeholder='Search products...'
              className='flex-1 outline-none font-bold uppercase text-xs'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6'>
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const isOutOfStock = item.batches.length === 0;
                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-[2rem] border-2 p-6 transition-all flex flex-col justify-between ${isOutOfStock ? "opacity-60 border-slate-100" : "border-slate-100 hover:shadow-xl hover:border-teal-500"}`}
                  >
                    <div>
                      <div className='flex justify-between items-start mb-4'>
                        <div
                          className={`p-3 rounded-xl ${isOutOfStock ? "bg-slate-100 text-slate-400" : "bg-teal-50 text-teal-600"}`}
                        >
                          {isOutOfStock ? (
                            <AlertCircle size={20} />
                          ) : (
                            <Package size={20} />
                          )}
                        </div>
                        <div className='text-right'>
                          <p className='text-[10px] font-black text-slate-500 uppercase'>Total Stock</p>
                          <p className='font-black text-sm text-slate-900'>{item.stock_balance || 0}</p>
                        </div>
                      </div>
                      <h3 className='font-black uppercase text-sm mb-1 leading-tight'>
                        {item.name}
                      </h3>
                      <p className='text-[10px] font-black text-slate-400 uppercase tracking-tighter'>
                        Per {item.unit || "unit"}
                      </p>

                      {!isOutOfStock && (
                        <div className='mt-4 group'>
                          <label className='text-[9px] font-black text-slate-400 uppercase flex items-center gap-1 mb-1.5 ml-1'>
                            <Layers size={10} className='text-teal-500' />{" "}
                            Select Batch
                          </label>
                          <div className='relative'>
                            <select
                              className='w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-[11px] font-bold appearance-none cursor-pointer outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-700 hover:bg-slate-100'
                              value={item.selectedBatchId}
                              onChange={(e) =>
                                handleBatchChange(item.id, e.target.value)
                              }
                            >
                              {item.batches.map((batch) => (
                                <option key={batch.id} value={batch.id}>
                                  {batch.batch_number} — ({batch.current_stock}{" "}
                                  available)
                                </option>
                              ))}
                            </select>
                            <div className='absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400'>
                              <Plus size={14} className='rotate-45' />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className='mt-6'>
                      <div className='flex items-end justify-between mb-4'>
                        <p className='text-2xl font-black italic'>
                          ₱{item.displayPrice.toLocaleString()}
                        </p>
                        <div className='text-right'>
                          <p className='text-[9px] font-black text-slate-300 uppercase'>
                            Status
                          </p>
                          <p
                            className={`text-xs font-black ${isOutOfStock ? "text-red-500" : "text-emerald-500"}`}
                          >
                            {isOutOfStock ? "Sold Out" : "In Stock"}
                          </p>
                        </div>
                      </div>
                      <button
                        disabled={isOutOfStock}
                        onClick={() => addToCart(item)}
                        className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase transition-all shadow-sm active:scale-95 ${isOutOfStock ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-slate-900 text-white hover:bg-teal-600 shadow-teal-200"}`}
                      >
                        {isOutOfStock ? "No Stock Available" : "Add to Cart"}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className='md:col-span-2 xl:col-span-3 bg-white rounded-2xl p-12 text-center'>
                <p className='text-xs font-black uppercase text-slate-500'>
                  No products to display
                </p>
                <p className='text-[10px] font-bold text-slate-400 mt-2 uppercase'>
                  Inventory list is empty or no match for your search.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className='lg:col-span-1'>
          <div className='bg-white rounded-[2.5rem] p-8 shadow-sm sticky top-8'>
            <h2 className='text-xl font-black uppercase italic mb-6 flex items-center gap-2 text-slate-800'>
              <Info size={18} className='text-teal-500' /> Summary
            </h2>
            <div className='pt-6'>
              <p className='text-[10px] font-black uppercase text-slate-400 mb-1'>
                Estimated Total
              </p>
              <h2 className='text-4xl font-black italic text-teal-600'>
                ₱
                {cart
                  .reduce((s, i) => s + i.displayPrice * i.quantity, 0)
                  .toLocaleString()}
              </h2>
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

      {isCartOpen && (
        <div className='fixed inset-0 z-50 flex justify-end'>
          <div
            className='absolute inset-0 bg-slate-900/40 backdrop-blur-md'
            onClick={() => setIsCartOpen(false)}
          />
          <div className='relative w-full max-w-md bg-white h-full p-10 shadow-2xl flex flex-col'>
            <div className='flex justify-between items-center mb-10'>
              <h2 className='text-3xl font-black uppercase italic tracking-tighter'>
                My Cart
              </h2>
              <button
                onClick={() => setIsCartOpen(false)}
                className='p-2 hover:bg-slate-100 rounded-full'
              >
                <X size={28} />
              </button>
            </div>
            <div className='flex-1 overflow-y-auto space-y-4 pr-2'>
              {cart.map((item) => (
                <div
                  key={item.cartId}
                  className='bg-white border-2 border-slate-50 p-5 rounded-3xl'
                >
                  <div className='flex justify-between mb-2'>
                    <p className='font-black text-sm uppercase leading-tight w-2/3'>
                      {item.name}
                    </p>
                    <button
                      onClick={() =>
                        setCart(cart.filter((c) => c.cartId !== item.cartId))
                      }
                      className='text-slate-300 hover:text-red-500'
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <p className='text-[10px] font-bold text-teal-500 uppercase mb-3'>
                    Batch: {item.activeBatch.batch_number}
                  </p>
                  <div className='flex justify-between items-center'>
                    <div className='flex items-center gap-3 rounded-xl px-2 py-1'>
                      <button
                        onClick={() =>
                          updateCartQty(
                            item.cartId,
                            -1,
                            item.activeBatch.current_stock,
                          )
                        }
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type='number'
                        min='1'
                        max={item.activeBatch.current_stock}
                        value={item.quantity}
                        onChange={(e) =>
                          updateCartQty(
                            item.cartId,
                            e.target.value,
                            item.activeBatch.current_stock,
                          )
                        }
                        className='font-black text-xs w-16 text-center border border-slate-200 rounded px-2 outline-none focus:border-teal-500'
                      />
                      <button
                        onClick={() =>
                          updateCartQty(
                            item.cartId,
                            1,
                            item.activeBatch.current_stock,
                          )
                        }
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <p className='font-black text-slate-900'>
                      ₱{(item.displayPrice * item.quantity).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className='mt-10 pt-10'>
              <div className='mb-6'>
                <label className='text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2'>
                  Customer Name
                </label>
                <input
                  type='text'
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder='Walk-in Customer / Delivery Name'
                  className='w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800 placeholder:text-slate-300'
                />
              </div>
              <div className='mb-6'>
                <label className='text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2'>
                  Transaction Type
                </label>
                <select
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value)}
                  className='w-full border-2 border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800'
                >
                  <option value='walk-in'>Walk-in</option>
                  <option value='delivery'>Delivery</option>
                </select>
              </div>
              <div className='flex justify-between items-end mb-8'>
                <p className='text-[10px] font-black text-slate-400 uppercase'>
                  Grand Total
                </p>
                <p className='text-3xl font-black italic'>
                  ₱
                  {cart
                    .reduce((s, i) => s + i.displayPrice * i.quantity, 0)
                    .toLocaleString()}
                </p>
              </div>
              <button
                disabled={cart.length === 0 || isCompleting}
                onClick={handleFinalizeOrder}
                className='w-full bg-black text-white py-6 rounded-[2rem] font-black uppercase text-sm tracking-widest shadow-xl disabled:opacity-50 hover:bg-teal-600 transition-all flex items-center justify-center gap-3'
              >
                <CheckCircle size={20} />{" "}
                {isCompleting ? "Finalizing..." : "Finalize Sale"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InvoiceView = ({ order, onBack }) => (
  <div className='p-8 bg-slate-50 min-h-screen font-sans'>
    <div className='max-w-3xl mx-auto'>
      <button
        onClick={onBack}
        className='mb-6 flex items-center gap-2 font-black uppercase text-[10px] text-slate-400 hover:text-black no-print'
      >
        <ChevronLeft size={16} /> New Transaction
      </button>

      {/* Toolbar */}
      <div className='bg-black text-white px-8 py-4 flex justify-between items-center rounded-t-2xl no-print'>
        <h2 className='font-black uppercase tracking-widest text-sm flex items-center gap-2'>
          <CheckCircle size={16} className='text-teal-400' /> Transaction Complete
        </h2>
        <button
          type='button'
          onClick={() => printElement(document.getElementById('print-receipt'))}
          className='bg-white text-black px-4 py-2 rounded-lg text-[10px] font-black flex items-center gap-2 hover:bg-slate-200 transition-all'
        >
          <Printer size={14} /> Print Receipt
        </button>
      </div>

      {/* Receipt Content */}
      <div id='print-receipt' className='bg-white p-8 rounded-b-2xl shadow-sm'>
        {/* Header */}
        <div className='flex justify-between items-start pb-4 mb-6 border-b-2 border-slate-200'>
          <div>
            <h1 className='text-4xl font-black uppercase italic leading-none'>
              Billing Statement
            </h1>
            <p className='text-xs font-bold text-slate-600 mt-2'>
              {order.items.length} Item{order.items.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className='text-right'>
            <p className='text-lg font-black uppercase tracking-widest'>
              {order.soNum}
            </p>
            <p className='text-sm font-black uppercase mt-1'>
              Date: {order.date}
            </p>
            <p className='text-[10px] font-bold text-slate-600 uppercase'>
              Billing Statement
            </p>
          </div>
        </div>

        {/* Two-column info */}
        <div className='grid grid-cols-2 gap-8 mb-8'>
          <div>
            <h4 className='text-[10px] font-black text-slate-600 uppercase mb-1'>
              Billed To:
            </h4>
            <p className='text-sm font-black uppercase'>{order.customerName}</p>
            <p className='text-xs font-medium text-slate-600 uppercase mt-0.5'>
              {order.transactionType}
            </p>
          </div>
          <div className='text-right'>
            <h4 className='text-[10px] font-black text-slate-600 uppercase mb-1'>
              Issued By:
            </h4>
            <p className='text-sm font-black uppercase'>JohnCel Trading</p>
            <p className='text-xs font-medium text-slate-600'>
              254 Dir. A. Bunye, Bagumbayan
            </p>
            <p className='text-xs font-medium text-slate-600'>
              Taguig, 1630 Kalakhang Maynila
            </p>
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
                <td className='py-4 px-2 text-[10px] font-mono font-bold text-teal-600'>
                  {i.activeBatch.batch_number?.split('-').pop() || '—'}
                </td>
                <td className='py-4 px-2 text-center font-black'>{i.quantity}</td>
                <td className='py-4 px-2 text-right text-sm font-bold'>
                  ₱{i.displayPrice?.toLocaleString()}
                </td>
                <td className='py-4 px-2 text-right text-sm font-black'>
                  ₱{(i.displayPrice * i.quantity).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className='border-t-2 border-slate-200'>
              <td colSpan='4' className='py-6 text-right text-sm font-black uppercase text-slate-600'>
                Grand Total:
              </td>
              <td className='py-6 text-right text-xl font-black underline decoration-4 decoration-teal-500'>
                ₱{order.totalAmount.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
);

export default RecordSales;
