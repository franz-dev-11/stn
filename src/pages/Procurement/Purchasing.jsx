import React, { useMemo, useState } from "react";
import { getSessionUser, getPerformedBy, insertAuditTrail } from "../../utils/auditTrail";
import { usePurchasing } from "./usePurchasingData";
import { ItemRegistry, SupplierRegistry } from "./RegistryForms";
import CartDrawer from "./CartDrawer";
import ItemCard from "./ItemCard";
import CheckoutView from "./CheckoutView";
import { supabase } from "../../supabaseClient";
import {
  ShoppingCart,
  Search,
  Trash2,
  X,
  Plus,
  Minus,
  Filter,
  Info,
  Mail,
  FileText,
} from "lucide-react";

const Purchasing = () => {
  const data = usePurchasing();
  const [selectedSupplier, setSelectedSupplier] = useState("All");
  const [quotationSupplier, setQuotationSupplier] = useState("All");

  // Delete item function
  const deleteItem = async (id) => {
    if (!window.confirm("Delete this item and all its associated records?")) return;
    try {
      await supabase.from("product_pricing").delete().eq("product_id", id);
      await supabase.from("order_scheduling").delete().eq("product_id", id);
      await supabase.from("inventory_batches").delete().eq("product_id", id);
      const { error } = await supabase
        .from("hardware_inventory")
        .delete()
        .eq("id", id);
      if (error) throw error;
      data.fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteSupplier = async (id, name) => {
    if (!window.confirm(`Delete supplier "${name}"?`)) return;
    try {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
      data.fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleQuotationRequest = () => {
    const vendor = data.suppliers.find((s) => s.name === quotationSupplier);
    const email = vendor?.email || "";
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const subject = encodeURIComponent(`Request for Price Quotation — ${quotationSupplier} (${today})`);
    const body = encodeURIComponent(
      `Dear ${quotationSupplier} Sales Team,\n\n` +
      `We hope this message finds you well.\n\n` +
      `We are writing on behalf of STN to formally request an updated price quotation for your full product catalog. ` +
      `As part of our procurement review process, we would like to obtain your latest pricing, available stock, and any applicable terms or promotions currently in effect.\n\n` +
      `Kindly provide the following details for each item in your catalog:\n\n` +
      `  • Product Name and SKU / Item Code\n` +
      `  • Unit of Measurement\n` +
      `  • Unit Price (exclusive and inclusive of VAT, if applicable)\n` +
      `  • Minimum Order Quantity (MOQ)\n` +
      `  • Lead Time / Estimated Delivery Date\n` +
      `  • Payment Terms\n` +
      `  • Any available discounts or promotional pricing\n\n` +
      `We appreciate your continued partnership and look forward to your prompt response. ` +
      `Please feel free to reach out should you require any further information from our end.\n\n` +
      `Thank you very much.\n\n` +
      `Warm regards,\n` +
      `STN Procurement Team\n` +
      `Date: ${today}`
    );
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`,
      "_blank"
    );
  };

  const handleAvailedItemsQuotation = () => {
    const vendor = data.suppliers.find((s) => s.name === quotationSupplier);
    const email = vendor?.email || "";
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const supplierItems = (data.allItems || data.items).filter((i) => i.supplier === quotationSupplier);

    // 1. Generate and download CSV for supplier to fill out
    const csvHeaders = [
      "Product Name", "SKU", "Unit", "Last Price (PHP)",
      "New Unit Price (PHP)", "Available Stock", "Lead Time (days)", "MOQ", "Payment Terms", "Notes",
    ];
    const csvRows = supplierItems.map((item) => [
      `"${(item.name || "").replace(/"/g, '""')}"`,
      `"${(item.sku || "N/A").replace(/"/g, '""')}"`,
      `"${(item.unit || "—").replace(/"/g, '""')}"`,
      Number(item.price || 0).toFixed(2),
      "", "", "", "", "", "",
    ]);
    const csv = [csvHeaders.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quotation_${quotationSupplier.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    // 2. Open Gmail with updated body referencing CSV
    const subject = encodeURIComponent(`Request for Updated Pricing — Availed Items (${quotationSupplier}) — ${today}`);
    const itemList = supplierItems
      .map(
        (item, idx) =>
          `  ${idx + 1}. ${item.name}\n` +
          `     SKU: ${item.sku || "N/A"} | Unit: ${item.unit || "—"} | Last Price: PHP ${Number(item.price || 0).toLocaleString()}`
      )
      .join("\n");
    const body = encodeURIComponent(
      `Dear ${quotationSupplier} Sales Team,\n\n` +
      `We hope this message finds you well.\n\n` +
      `We are writing to request updated pricing for the following items that we currently source from your company. ` +
      `Please fill out the CSV attached in this email and reply with the updated prices.\n\n` +
      `Items for Re-quotation:\n\n` +
      itemList +
      `\n\nFor each item, kindly include:\n` +
      `  • Updated Unit Price (VAT-exclusive and VAT-inclusive)\n` +
      `  • Available Stock / Lead Time\n` +
      `  • Minimum Order Quantity (MOQ)\n` +
      `  • Payment Terms\n\n` +
      `We value our ongoing partnership and look forward to your prompt response.\n\n` +
      `Thank you very much.\n\n` +
      `Warm regards,\n` +
      `STN Procurement Team\n` +
      `Date: ${today}`
    );
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`,
      "_blank"
    );

    // 3. Audit trail
    const user = getSessionUser();
    insertAuditTrail([{
      action: "QUOTATION_REQUEST",
      reference_number: null,
      product_id: null,
      item_name: null,
      sku: null,
      supplier: quotationSupplier,
      quantity: supplierItems.length,
      unit_cost: 0,
      total_amount: 0,
      performed_by: getPerformedBy(user),
    }]);
  };

  // Filter logic para sa Catalog
  const filteredCatalog = useMemo(() => {
    let list = data.items;
    if (selectedSupplier !== "All") {
      list = list.filter((item) => item.supplier === selectedSupplier);
    }
    return list;
  }, [data.items, selectedSupplier]);

  // Unique supplier names from all items (for quotation dropdown)
  const itemSuppliers = useMemo(() => {
    const names = (data.allItems || data.items)
      .map((i) => i.supplier)
      .filter(Boolean);
    return [...new Set(names)].sort();
  }, [data.allItems, data.items]);

  // Logic para sa grouping na kailangan ng CheckoutView
  const groupedOrders = useMemo(() => {
    return data.cart.reduce((acc, item) => {
      if (!acc[item.supplier]) acc[item.supplier] = [];
      acc[item.supplier].push(item);
      return acc;
    }, {});
  }, [data.cart]);

  return (
    <div className='p-3 sm:p-4 md:p-6 lg:p-8 bg-[#f3f4f6] min-h-screen text-black font-sans overflow-x-hidden'>
      {/* 1. HEADER & TOP NAVIGATION (Hidden on Checkout) */}
      {data.view !== "checkout" && (
        <>
          <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8'>
            <div>
              <h1 className='text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3'>
                <ShoppingCart className='text-teal-600' size={32} />
                PROCUREMENT
              </h1>
              <p className='text-slate-600 font-bold text-[8px] sm:text-xs uppercase tracking-[0.2em] mt-2'>
                Supplier Catalog | Purchasing Terminal
              </p>
            </div>
            <button
              onClick={() => data.setIsCartOpen(true)}
              className='bg-white p-4 sm:p-5 rounded-2xl shadow-sm hover:shadow-lg transition-all relative self-start sm:self-center'
            >
              <ShoppingCart />
              {data.cart.length > 0 && (
                <span className='absolute -top-2 -right-2 bg-teal-600 text-white text-[8px] sm:text-[10px] font-black w-6 sm:w-7 h-6 sm:h-7 flex items-center justify-center rounded-full'>
                  {data.cart.length}
                </span>
              )}
            </button>
          </div>

          <div className='space-y-4 sm:space-y-6 mb-6 sm:mb-8 no-print'>
            {/* TAB NAVIGATION */}
            <div className='flex bg-white p-1 rounded-2xl w-fit shadow-sm overflow-x-auto'>
              {["browse", "addItem", "addSupplier"].map((v) => (
                <button
                  key={v}
                  onClick={() => data.setView(v)}
                  className={`px-4 sm:px-6 py-2 rounded-xl font-black uppercase text-[8px] sm:text-[10px] transition-all whitespace-nowrap ${
                    data.view === v
                      ? "bg-black text-white"
                      : "text-black hover:bg-slate-100"
                  }`}
                >
                  {v === "browse"
                    ? "Catalog"
                    : v === "addItem"
                      ? "New Item"
                      : "New Supplier"}
                </button>
              ))}
            </div>

            {/* SUPPLIER FILTER BAR - Only visible in Browse Mode */}
            {data.view === "browse" && (
              <div className='flex items-center gap-3 sm:gap-4 bg-white p-3 sm:p-4 rounded-2xl shadow-sm overflow-x-auto'>
                <Filter size={18} className='text-black flex-shrink-0' />
                <span className='text-[8px] sm:text-xs font-black uppercase text-slate-600 flex-shrink-0'>
                  Filter Supplier:
                </span>
                <div className='flex gap-2 overflow-x-auto pb-1'>
                  <button
                    onClick={() => setSelectedSupplier("All")}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-all ${
                      selectedSupplier === "All"
                        ? "bg-black text-white"
                        : "bg-slate-100 text-black hover:bg-slate-200"
                    }`}
                  >
                    All Vendors
                  </button>
                  {data.suppliers.map((sup) => (
                    <button
                      key={sup.id}
                      onClick={() => setSelectedSupplier(sup.name)}
                      className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-all ${
                        selectedSupplier === sup.name
                          ? "bg-black text-white"
                          : "bg-slate-100 text-black hover:bg-slate-200"
                      }`}
                    >
                      {sup.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* 2. VIEWS SWITCHER */}
      {data.view === "browse" && (
        <>
          <div className='mb-8 relative no-print'>
            <Search
              className='absolute left-4 top-1/2 -translate-y-1/2 text-black'
              size={20}
            />
            <input
              type='text'
              placeholder='Search product name or SKU...'
              className='w-full pl-12 pr-4 py-4 rounded-2xl font-black uppercase text-xs outline-none focus:bg-yellow-50 transition-all shadow-sm'
              value={data.searchTerm}
              onChange={(e) => data.setSearchTerm(e.target.value)}
            />
          </div>
          <div className='grid grid-cols-1 lg:grid-cols-4 gap-8'>
            {/* ITEMS GRID */}
            <div className='lg:col-span-3'>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-6 no-print'>
                {filteredCatalog.length > 0 ? (
                  filteredCatalog.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onAdd={data.addToCart}
                      onDelete={deleteItem}
                    />
                  ))
                ) : (
                  <div className='md:col-span-3 bg-white rounded-2xl p-10 text-center'>
                    <p className='text-xs font-black uppercase text-slate-500'>
                      No products found
                    </p>
                    <p className='text-[10px] font-bold text-slate-400 mt-2 uppercase'>
                      Try a different search or supplier filter.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* SUMMARY SECTION */}
            <div className='lg:col-span-1'>
              <div className='bg-white rounded-2xl p-8 shadow-sm sticky top-8'>
                <h2 className='text-xl font-black uppercase italic mb-6 flex items-center gap-2 text-slate-800'>
                  <Info size={18} className='text-teal-500' /> Summary
                </h2>
                <div className='pt-6'>
                  <p className='text-[10px] font-black uppercase text-slate-400 mb-1'>
                    Order Total
                  </p>
                  <h2 className='text-4xl font-black italic text-teal-600'>
                    ₱
                    {data.cart
                      .reduce((s, i) => s + i.price * i.quantity, 0)
                      .toLocaleString()}
                  </h2>
                  <div className='mt-4 space-y-2'>
                    <p className='text-[10px] font-bold text-slate-500'>
                      Items:{" "}
                      <span className='font-black text-slate-700'>
                        {data.cart.length}
                      </span>
                    </p>
                    <p className='text-[10px] font-bold text-slate-500'>
                      Quantity:{" "}
                      <span className='font-black text-slate-700'>
                        {data.cart.reduce((sum, item) => sum + item.quantity, 0)}
                      </span>
                    </p>
                  </div>
                  <button
                    disabled={data.cart.length === 0}
                    onClick={() => data.setView("checkout")}
                    className='w-full mt-8 bg-black text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-teal-600 transition-all disabled:opacity-30 disabled:hover:bg-black'
                  >
                    Checkout ({data.cart.length})
                  </button>
                  {selectedSupplier !== "All" && (
                    <button
                      onClick={handleQuotationRequest}
                      className='w-full mt-3 bg-sky-500 hover:bg-sky-600 text-white py-3 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2'
                    >
                      <FileText size={14} /> Request Quotation
                    </button>
                  )}
                  <div className='mt-4 border-t border-slate-100 pt-4'>
                    <p className='text-[10px] font-black uppercase text-slate-400 mb-2'>Request Quotation</p>
                    <select
                      className='w-full px-3 py-2 text-xs font-black uppercase rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-sky-400 mb-2'
                      value={quotationSupplier}
                      onChange={(e) => setQuotationSupplier(e.target.value)}
                    >
                      <option value='All'>— Select Supplier —</option>
                      {itemSuppliers.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <button
                      disabled={quotationSupplier === "All"}
                      onClick={handleQuotationRequest}
                      className='w-full bg-sky-500 hover:bg-sky-600 disabled:opacity-30 disabled:hover:bg-sky-500 text-white py-3 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2'
                    >
                      <FileText size={14} /> Request Full Catalog
                    </button>
                    <button
                      disabled={quotationSupplier === "All"}
                      onClick={handleAvailedItemsQuotation}
                      className='w-full mt-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-30 disabled:hover:bg-indigo-500 text-white py-3 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2'
                    >
                      <Mail size={14} /> Request Availed Items
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {data.view === "addItem" && (
        <ItemRegistry
          suppliers={data.suppliers}
          onRefresh={() => {
            data.fetchData();
            data.setView("browse");
          }}
        />
      )}
      {data.view === "addSupplier" && (
        <SupplierRegistry
          suppliers={data.suppliers}
          onDelete={deleteSupplier}
          onRefresh={() => {
            data.fetchData();
            data.setView("browse");
          }}
        />
      )}

      {/* RENDER CHECKOUT VIEW */}
      {data.view === "checkout" && (
        <CheckoutView
          groupedOrders={groupedOrders}
          suppliers={data.suppliers}
          setView={data.setView}
          cart={data.cart}
          handleCompleteTransaction={data.handleCompleteTransaction}
          isCompleting={data.isCompleting}
        />
      )}

      {/* 3. CART DRAWER */}
      <CartDrawer
        isOpen={data.isCartOpen}
        onClose={() => data.setIsCartOpen(false)}
        cart={data.cart}
        setCart={data.setCart}
        setView={data.setView}
      />
    </div>
  );
};

export default Purchasing;
