import React, { useState, useEffect, useMemo } from "react";
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
  PackageCheck,
  Tag,
  Mail,
  CheckCircle2,
  RotateCcw,
  Save,
} from "lucide-react";

const PurchaseHistory = () => {
  const [batches, setBatches] = useState([]);
  const [suppliers, setSuppliers] = useState([]); // Added to fetch vendor details
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [returnMode, setReturnMode] = useState({});
  const [returnSelections, setReturnSelections] = useState({});
  const [returnSaving, setReturnSaving] = useState({});
  const [returnRecords, setReturnRecords] = useState([]); // <-- NEW

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchData = async () => {
    const { data: orderData, error: orderError } = await supabase
      .from("order_scheduling")
      .select(
        `
        *,
        hardware_inventory:product_id (
          name,
          sku,
          unit,
          supplier
        )
      `,
      )
      .order("date_ordered", { ascending: false });

    const { data: supData } = await supabase.from("suppliers").select("*");

    if (orderError) console.error("Error fetching data:", orderError);
    setBatches(orderData || []);
    setSuppliers(supData || []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch return records for all POs/items
  useEffect(() => {
    const fetchReturns = async () => {
      const { data, error } = await supabase
        .from("return_records")
        .select("*");
      if (!error) setReturnRecords(data || []);
    };
    fetchReturns();
  }, []);

  // Filtering & Pagination Logic
  const filteredBatches = batches.filter((batch) => {
    const itemName = batch.hardware_inventory?.name || "";
    const vendorName = batch.hardware_inventory?.supplier || "";
    const matchesSearch =
      batch.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendorName.toLowerCase().includes(searchTerm.toLowerCase());

    const orderDate = new Date(batch.date_ordered).toISOString().split("T")[0];
    const matchesStart = !startDate || orderDate >= startDate;
    const matchesEnd = !endDate || orderDate <= endDate;

    return matchesSearch && matchesStart && matchesEnd;
  });

  // Group items by supplier and date
  const groupedReceipts = useMemo(() => {
    const grouped = {};
    filteredBatches.forEach((batch) => {
      const supplier = batch.hardware_inventory?.supplier || "Unknown Supplier";
      const key = batch.order_number || `${supplier}|${new Date(batch.date_ordered).toISOString().split("T")[0]}`;

      if (!grouped[key]) {
        grouped[key] = {
          id: key,
          supplier,
          date_ordered: batch.date_ordered,
          order_number: batch.order_number || "—",
          status: batch.status || "—",
          items: [],
          totalAmount: 0,
        };
      }
      grouped[key].items.push(batch);
      grouped[key].totalAmount += (batch.unit_cost || 0) * (batch.quantity || 0);
    });
    // Subtract refunded value for each group
    Object.values(grouped).forEach((receipt) => {
      if (!Array.isArray(receipt.items) || !receipt.order_number) return;
      // For each item in this receipt, sum refunded value
      let refundTotal = 0;
      receipt.items.forEach((item) => {
        if (!item.product_id) return;
        const refunds = returnRecords.filter(r => r.order_number === receipt.order_number && r.product_id === item.product_id && r.resolution_status === "refunded");
        refundTotal += refunds.reduce((sum, r) => sum + ((r.return_qty || 0) * (r.unit_cost || 0)), 0);
      });
      receipt.totalAmount -= refundTotal;
      if (receipt.totalAmount < 0) receipt.totalAmount = 0;
    });
    return Object.values(grouped);
  }, [filteredBatches, returnRecords]);

  const currentItems = groupedReceipts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );
  const totalPages = Math.ceil(groupedReceipts.length / itemsPerPage);

  const handleMarkReceived = async (e, receipt) => {
    e.stopPropagation();
    if (!window.confirm(`Mark "${receipt.order_number}" as Received?`)) return;
    try {
      // Update PO and order_scheduling status
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: "Received" })
        .eq("po_number", receipt.order_number);
      if (error) throw error;
      await supabase
        .from("order_scheduling")
        .update({ status: "Received" })
        .eq("order_number", receipt.order_number);

      // Update inventory for each item in the PO
      for (const item of receipt.items) {
        const productId = item.product_id;
        const qty = Number(item.quantity) || 0;
        // Fetch inventory
        const { data: inv, error: invFetchErr } = await supabase
          .from("hardware_inventory")
          .select("inbound_qty, stock_balance")
          .eq("id", productId)
          .maybeSingle();
        if (invFetchErr) throw new Error(invFetchErr.message);
        if (inv) {
          await supabase
            .from("hardware_inventory")
            .update({
              inbound_qty: Number(inv.inbound_qty || 0) + qty,
              stock_balance: Number(inv.stock_balance || 0) + qty,
            })
            .eq("id", productId);
        }
        // Update inventory_batches: only insert if not already created by InboundScheduling
        const batchNumber = `${receipt.order_number}-${productId}`;
        const { data: batch } = await supabase
          .from("inventory_batches")
          .select("id, current_stock")
          .eq("batch_number", batchNumber)
          .maybeSingle();

        if (!batch) {
          await supabase
            .from("inventory_batches")
            .insert([{
              product_id: productId,
              batch_number: batchNumber,
              current_stock: qty,
              batch_date: new Date().toISOString(),
            }]);
        }
        // If batch already exists (created by InboundScheduling on "Arrived"), don't add again
      }

      setBatches((prev) =>
        prev.map((b) =>
          b.order_number === receipt.order_number
            ? { ...b, status: "Received" }
            : b,
        ),
      );
      alert("Inventory updated for all items in this PO.");
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleToggleReturnMode = (receiptId) => {
    setReturnMode((prev) => ({ ...prev, [receiptId]: !prev[receiptId] }));
    setReturnSelections((prev) => ({ ...prev, [receiptId]: {} }));
  };

  const handleSetReturnQty = (receiptId, itemId, qty, maxQty) => {
    const parsed = Math.min(Math.max(0, parseInt(qty) || 0), maxQty);
    setReturnSelections((prev) => ({
      ...prev,
      [receiptId]: { ...(prev[receiptId] || {}), [itemId]: parsed },
    }));
  };

  const handleSaveReturn = async (receipt) => {
    const selections = returnSelections[receipt.id] || {};
    const itemsToReturn = receipt.items
      .map((item) => ({ item, returnQty: selections[item.id] || 0 }))
      .filter(({ returnQty }) => returnQty > 0);

    if (itemsToReturn.length === 0) {
      alert("Please enter a return quantity for at least one item.");
      return;
    }

    const confirmLines = itemsToReturn
      .map(
        ({ item, returnQty }) =>
          `• ${item.hardware_inventory?.name}: return ${returnQty} of ${item.quantity}`,
      )
      .join("\n");

    if (
      !window.confirm(
        `Confirm return for the following items?\n\n${confirmLines}\n\nThis will deduct the returned quantities from inventory.`,
      )
    )
      return;

    const sessionUser = (() => {
      try { return JSON.parse(sessionStorage.getItem("stn_user") || "null"); } catch { return null; }
    })();
    const returnedBy = sessionUser
      ? `${sessionUser.first_name || ""} ${sessionUser.last_name || ""}`.trim() || sessionUser.username
      : "Unknown";

    setReturnSaving((prev) => ({ ...prev, [receipt.id]: true }));
    try {
      for (const { item, returnQty } of itemsToReturn) {
        const productId = item.product_id;
        const orderNumber = item.order_number;

        // 1. Decrement hardware_inventory stock_balance and inbound_qty
        const { data: inv, error: invFetchErr } = await supabase
          .from("hardware_inventory")
          .select("stock_balance, inbound_qty")
          .eq("id", productId)
          .single();

        if (invFetchErr) throw new Error(`Inventory fetch error: ${invFetchErr.message}`);

        const { error: invUpdateErr } = await supabase
          .from("hardware_inventory")
          .update({
            stock_balance: Math.max(0, Number(inv.stock_balance || 0) - returnQty),
            inbound_qty: Math.max(0, Number(inv.inbound_qty || 0) - returnQty),
          })
          .eq("id", productId);

        if (invUpdateErr) throw new Error(`Inventory update error: ${invUpdateErr.message}`);

        // 2. Decrement inventory_batches current_stock for the matching batch
        const batchNumber = `${orderNumber}-${productId}`;
        const { data: batch } = await supabase
          .from("inventory_batches")
          .select("id, current_stock")
          .eq("batch_number", batchNumber)
          .maybeSingle();

        if (batch) {
          await supabase
            .from("inventory_batches")
            .update({
              current_stock: Math.max(0, Number(batch.current_stock || 0) - returnQty),
            })
            .eq("id", batch.id);
        }

        // 3. Auto-deduct return value from PO total
        const refundValue = returnQty * (item.unit_cost || 0);
        if (refundValue > 0) {
          const { data: po } = await supabase
            .from("purchase_orders")
            .select("id, total_amount")
            .eq("po_number", orderNumber)
            .maybeSingle();
          if (po) {
            await supabase
              .from("purchase_orders")
              .update({ total_amount: Math.max(0, Number(po.total_amount || 0) - refundValue) })
              .eq("id", po.id);
          }
        }

        // 4. Insert audit trail row (auto-resolved as refunded)
        const { error: returnErr } = await supabase.from("return_records").insert([{
          order_number: orderNumber,
          product_id: productId,
          item_name: item.hardware_inventory?.name || null,
          sku: item.hardware_inventory?.sku || null,
          supplier: receipt.supplier || null,
          return_qty: returnQty,
          unit_cost: item.unit_cost || null,
          returned_by: returnedBy,
          resolution_status: "refunded",
        }]);
        if (returnErr) throw new Error(`Audit insert error: ${returnErr.message}`);
      }

      setReturnMode((prev) => ({ ...prev, [receipt.id]: false }));
      setReturnSelections((prev) => ({ ...prev, [receipt.id]: {} }));
      alert("Return saved. Inventory has been updated.");
      fetchData();
    } catch (err) {
      alert("Error saving return: " + err.message);
    } finally {
      setReturnSaving((prev) => ({ ...prev, [receipt.id]: false }));
    }
  };

  const handleEmailReturn = (receipt) => {
    const vendor = suppliers.find((s) => s.name === receipt.supplier);
    const email = vendor?.email || "";
    const selections = returnSelections[receipt.id] || {};
    const selectedItems = receipt.items
      .map((item) => ({ item, returnQty: selections[item.id] || 0 }))
      .filter(({ returnQty }) => returnQty > 0);
    const subject = encodeURIComponent(
      `Return Request: Order ${receipt.order_number} — ${receipt.supplier}`
    );
    const body = encodeURIComponent(
      `Dear ${receipt.supplier},\n\n` +
      `We are writing to formally request a return for the following item(s) from Order #${receipt.order_number} ` +
      `dated ${new Date(receipt.date_ordered).toLocaleDateString()}:\n\n` +
      selectedItems
        .map(
          ({ item, returnQty }) =>
            `• ${item.hardware_inventory?.name} (SKU: ${item.hardware_inventory?.sku || "N/A"}) — Return Qty: ${returnQty} of ${item.quantity} × ₱${item.unit_cost?.toLocaleString()}`
        )
        .join("\n") +
      `\n\nPlease advise on the return procedure and any applicable return authorization required.\n\n` +
      `Thank you for your prompt attention to this matter.\n\n` +
      `Best regards,\nSTN Procurement Team`
    );
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`,
      "_blank"
    );
  };

  return (
    <div className='p-3 sm:p-4 md:p-6 lg:p-8 bg-[#f3f4f6] min-h-screen text-black print:bg-white print:p-0 overflow-x-hidden'>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; border: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className='max-w-5xl mx-auto'>
        <div className='flex flex-col sm:flex-row sm:justify-between sm:items-end mb-6 sm:mb-8 gap-4 no-print'>
          <div>
            <h1 className='text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3'>
              <History size={32} className='text-teal-600' /> PROCUREMENT
              HISTORY
            </h1>
            <p className='text-slate-600 font-bold text-[8px] sm:text-xs uppercase tracking-[0.2em] mt-2'>
              Inbound Record Archive | Vendor Timeline
            </p>
          </div>
          <p className='text-slate-400 font-bold text-sm'>
            {filteredBatches.length} records
          </p>
        </div>

        {/* Filters */}
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
                  placeholder='Batch, Item, or Vendor...'
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

        {/* List */}
        <div className='bg-white rounded-2xl overflow-hidden shadow-sm'>
          <div className='overflow-x-auto'>
            <table className='w-full text-left min-w-max'>
              <thead>
                <tr className='bg-black text-white text-[10px] font-black uppercase'>
                  <th className='px-6 py-4'>Date</th>
                  <th className='px-6 py-4'>Order #</th>
                  <th className='px-6 py-4'>Vendor</th>
                  <th className='px-6 py-4'>Status</th>
                  <th className='px-6 py-4'>Items</th>
                  <th className='px-6 py-4 text-center'>Count</th>
                  <th className='px-6 py-4 text-right'>Total Amount</th>
                  <th className='px-6 py-4 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-100'>
                {currentItems.length > 0 ? (
                  currentItems.map((receipt) => {
                    const vendor = suppliers.find(
                      (s) => s.name === receipt.supplier,
                    );
                    const isExpanded = expandedBatch === receipt.id;
                    const hasReturn = returnRecords.some(r => r.order_number === receipt.order_number);
                    return (
                      <React.Fragment key={receipt.id}>
                        <tr
                          onClick={() =>
                            setExpandedBatch(isExpanded ? null : receipt.id)
                          }
                          className='hover:bg-slate-50 cursor-pointer transition-colors'
                        >
                          <td className='px-6 py-4 text-[10px] font-bold text-slate-500 whitespace-nowrap'>
                            {new Date(receipt.date_ordered).toLocaleDateString()}
                          </td>
                          <td className='px-6 py-4 font-mono font-black text-xs text-teal-700'>
                            {receipt.order_number}
                          </td>
                          <td className='px-6 py-4 font-black uppercase text-sm'>
                            {receipt.supplier || "N/A"}
                          </td>
                          <td className='px-6 py-4'>
                            <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${
                              receipt.status === "Arrived" ? "bg-emerald-100 text-emerald-700"
                              : receipt.status === "In Transit" ? "bg-blue-100 text-blue-700"
                              : receipt.status === "Pending" ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                            }`}>
                              {receipt.status}
                            </span>
                          </td>
                          <td className='px-6 py-4 text-xs max-w-75'>
                            <div className='space-y-1'>
                              {receipt.items.slice(0, 2).map((item, idx) => (
                                <div key={idx} className='text-[10px] font-bold text-slate-700'>
                                  {item.hardware_inventory?.name}
                                </div>
                              ))}
                              {receipt.items.length > 2 && (
                                <div className='text-[10px] font-bold text-slate-500 italic'>
                                  +{receipt.items.length - 2} more
                                </div>
                              )}
                            </div>
                          </td>
                          <td className='px-6 py-4 text-center font-black'>
                            {receipt.items.length}
                          </td>
                          <td className='px-6 py-4 text-right font-black text-sm'>
                            ₱{receipt.totalAmount.toLocaleString()}
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
                                    <Tag size={16} />{" "}
                                    {receipt.supplier}
                                  </h2>
                                  <div className='flex gap-2'>
                                    {receipt.status === "Arrived" && (
                                      <button
                                        onClick={(e) => handleMarkReceived(e, receipt)}
                                        className='bg-emerald-500 text-white px-4 py-2 rounded-lg text-[10px] font-black flex items-center gap-2 hover:bg-emerald-600 transition-all'
                                      >
                                        <CheckCircle2 size={14} /> Mark Received
                                      </button>
                                    )}
                                    {receipt.status === 'Arrived' && !hasReturn && (
                                      <>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleReturnMode(receipt.id); }}
                                        className={`px-4 py-2 rounded-lg text-[10px] font-black flex items-center gap-2 transition-all ${
                                          returnMode[receipt.id]
                                            ? 'bg-rose-500 text-white hover:bg-rose-600'
                                            : 'bg-[#FF6B6B] text-white hover:bg-[#ff5252]'
                                        }`}
                                      >
                                        <RotateCcw size={14} />
                                        {returnMode[receipt.id] ? 'Cancel Return' : 'Return Items'}
                                      </button>
                                      {returnMode[receipt.id] && Object.values(returnSelections[receipt.id] || {}).some((q) => q > 0) && (
                                        <>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleSaveReturn(receipt); }}
                                            disabled={returnSaving[receipt.id]}
                                            className='bg-rose-600 text-white px-4 py-2 rounded-lg text-[10px] font-black flex items-center gap-2 hover:bg-rose-700 transition-all disabled:opacity-60'
                                          >
                                            <Save size={14} /> {returnSaving[receipt.id] ? 'Saving...' : `Save Return (${Object.values(returnSelections[receipt.id] || {}).filter((q) => q > 0).length})`}
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleEmailReturn(receipt); }}
                                            className='bg-slate-700 text-white px-4 py-2 rounded-lg text-[10px] font-black flex items-center gap-2 hover:bg-slate-800 transition-all'
                                          >
                                            <Mail size={14} /> Email Vendor
                                          </button>
                                        </>
                                      )}
                                      </>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.print();
                                      }}
                                      className='bg-white text-black px-4 py-2 rounded-lg text-[10px] font-black flex items-center gap-2 hover:bg-slate-200 transition-all'
                                    >
                                      <Printer size={14} /> Print Record
                                    </button>
                                  </div>
                                </div>
                                {/* Record Content */}
                                <div className='p-8 bg-white'>
                                  <div className='flex justify-between items-start pb-4 mb-6 border-b-2 border-slate-200'>
                                    <div>
                                      <h1 className='text-4xl font-black uppercase italic leading-none'>
                                        Purchase Order
                                      </h1>
                                      <p className='text-xs font-bold text-slate-600 mt-2'>
                                        {receipt.items.length} Item{receipt.items.length !== 1 ? 's' : ''}
                                      </p>
                                    </div>
                                    <div className='text-right'>
                                      <p className='text-sm font-black uppercase'>
                                        Date:{" "}
                                        {new Date(
                                          receipt.date_ordered,
                                        ).toLocaleDateString()}
                                      </p>
                                      <p className='text-[10px] font-bold text-slate-600 uppercase'>
                                        Receipt Summary
                                      </p>
                                    </div>
                                  </div>
                                  <div className='grid grid-cols-2 gap-8 mb-8'>
                                    <div>
                                      <h4 className='text-[10px] font-black text-slate-600 uppercase mb-1'>
                                        Source Vendor:
                                      </h4>
                                      <p className='text-sm font-black uppercase'>
                                        {receipt.supplier}
                                      </p>
                                      <p className='text-xs font-medium text-slate-600'>
                                        {vendor?.address ||
                                          "Address not listed"}
                                      </p>
                                      <p className='text-xs font-medium text-slate-600'>
                                        {vendor?.email || "Email not listed"}
                                      </p>
                                    </div>
                                  </div>
                                  <table className='w-full text-left mb-6'>
                                    <thead>
                                      <tr className='bg-black text-white text-[10px] uppercase font-black'>
                                        {returnMode[receipt.id] && <th className='py-3 pl-3 w-8'></th>}
                                        <th className='py-3'>SKU</th>
                                        <th className='py-3'>Description</th>
                                        <th className='py-3 text-center'>
                                          Qty Received
                                        </th>
                                        <th className='py-3 text-center'>
                                          Unit
                                        </th>
                                        <th className='py-3 text-right'>
                                          Unit Cost
                                        </th>
                                        <th className='py-3 text-right'>
                                          Total Value
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {receipt.items.map((item, idx) => {
                                        // Aggregate return info for this item
                                        const returns = returnRecords.filter(r => r.order_number === receipt.order_number && r.product_id === item.product_id);
                                        const returnedQty = returns.filter(r => !r.resolution_status || r.resolution_status === "pending").reduce((s, r) => s + (r.return_qty || 0), 0);
                                        const replacedQty = returns.filter(r => r.resolution_status === "replaced").reduce((s, r) => s + (r.return_qty || 0), 0);
                                        const refundedQty = returns.filter(r => r.resolution_status === "refunded").reduce((s, r) => s + (r.return_qty || 0), 0);
                                        return (
                                          <tr
                                            key={idx}
                                            className={`border-b border-slate-100 transition-colors ${
                                              returnMode[receipt.id] && (returnSelections[receipt.id]?.[item.id] || 0) > 0
                                                ? 'bg-rose-50'
                                                : ''
                                            }`}
                                          >
                                            {returnMode[receipt.id] && (
                                              <td className='py-4 px-4' onClick={(e) => e.stopPropagation()}>
                                                <input
                                                  type='number'
                                                  min={0}
                                                  max={item.quantity}
                                                  value={returnSelections[receipt.id]?.[item.id] ?? ''}
                                                  placeholder='0'
                                                  onChange={(e) => handleSetReturnQty(receipt.id, item.id, e.target.value, item.quantity)}
                                                  className='w-14 px-2 py-1 text-xs font-black text-center border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent'
                                                />
                                                {item.quantity > 0 && (
                                                  <p className='text-[9px] text-slate-400 font-bold text-center mt-0.5'>of {item.quantity}</p>
                                                )}
                                              </td>
                                            )}
                                            <td className='py-4 px-4 text-[10px] font-mono font-bold text-slate-600'>
                                              #{item.hardware_inventory?.sku}
                                            </td>
                                            <td className='py-4 text-sm font-black uppercase'>
                                              {item.hardware_inventory?.name}
                                              {/* Return info badges */}
                                              <div className='flex flex-wrap gap-1 mt-1'>
                                                {returnedQty > 0 && (
                                                  <span className='inline-block bg-rose-100 text-rose-700 text-[9px] font-bold px-2 py-0.5 rounded'>
                                                    Returned: {returnedQty}
                                                  </span>
                                                )}
                                                {replacedQty > 0 && (
                                                  <span className='inline-block bg-emerald-100 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded'>
                                                    Replaced: {replacedQty}
                                                  </span>
                                                )}
                                                {refundedQty > 0 && (
                                                  <span className='inline-block bg-blue-100 text-blue-700 text-[9px] font-bold px-2 py-0.5 rounded'>
                                                    Refunded: {refundedQty}
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                            <td className='py-4 text-center font-black'>
                                              {item.quantity}
                                            </td>
                                            <td className='py-4 text-center text-xs font-bold text-slate-600 uppercase'>
                                              {item.hardware_inventory?.unit}
                                            </td>
                                            <td className='py-4 text-right text-sm font-bold'>
                                              ₱{item.unit_cost?.toLocaleString()}
                                            </td>
                                            <td className='py-4 text-right text-sm font-black'>
                                              ₱
                                              {(
                                                item.unit_cost *
                                                item.quantity
                                              ).toLocaleString()}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot>
                                      <tr className='border-t-2 border-slate-200'>
                                        <td
                                          colSpan={returnMode[receipt.id] ? 6 : 5}
                                          className='py-6 text-right text-sm font-black uppercase text-slate-600'
                                        >
                                          Receipt Total:
                                        </td>
                                        <td className='py-6 text-right text-xl font-black underline decoration-4 decoration-teal-500'>
                                          ₱{receipt.totalAmount.toLocaleString()}
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
                    <td colSpan='9' className='px-6 py-12 text-center'>
                      <p className='text-xs font-black uppercase text-slate-500'>
                        No inbound records found
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

        {/* Pagination */}
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

export default PurchaseHistory;
