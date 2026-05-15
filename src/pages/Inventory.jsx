import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { formatPSTDate, formatPSTTime } from "../utils/dateTimeUtils";
import { QRCodeSVG } from "qrcode.react";
import {
  Package,
  Clock,
  Database,
  ArrowDownUp,
  ChevronDown,
  Search,
  Download,
  X,
  QrCode,
} from "lucide-react";

const Inventory = () => {
  const navigate = useNavigate();
  const _sessionUser = (() => { try { return JSON.parse(sessionStorage.getItem("stn_user") || "null"); } catch { return null; } })();
  const _userRole = _sessionUser?.role === "Staff" ? "Cashier" : _sessionUser?.role;

  const [batches, setBatches] = useState([]);
  const [archiveItems, setArchiveItems] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedNames, setExpandedNames] = useState({});
  const [showLedger, setShowLedger] = useState(true);
  const [showBatches, setShowBatches] = useState(true);
  const [showArchive, setShowArchive] = useState(true);
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString(),
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [ledgerDateFrom, setLedgerDateFrom] = useState("");
  const [ledgerDateTo, setLedgerDateTo] = useState("");
  const [batchDateFrom, setBatchDateFrom] = useState("");
  const [batchDateTo, setBatchDateTo] = useState("");
  const [archiveDateFrom, setArchiveDateFrom] = useState("");
  const [archiveDateTo, setArchiveDateTo] = useState("");
  const [selectedPOForQR, setSelectedPOForQR] = useState("");
  const [poQRData, setPOQRData] = useState(null);
  const printTableRef = useRef(null);
  const PAGE_SIZE = 10;
  const [ledgerPage, setLedgerPage] = useState(1);
  const [batchPage, setBatchPage] = useState(1);
  const [archivePage, setArchivePage] = useState(1);

  useEffect(() => {
    fetchInventory();
    fetchArchive();
    const timer = setInterval(
      () => setCurrentTime(new Date().toLocaleTimeString()),
      1000,
    );
    const channel = supabase
      .channel("inventory-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "hardware_inventory" }, fetchInventory)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_batches" }, fetchInventory)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_ledger_history" }, fetchInventory)
      .subscribe();
    return () => { clearInterval(timer); supabase.removeChannel(channel); };
  }, []);

  const extractPO = (batchNumber) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (batchNumber?.length > 37 && uuidRegex.test(batchNumber.slice(-36))) {
      return batchNumber.slice(0, -37);
    }
    return batchNumber;
  };

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from("inventory_batches")
        .select(
          `
          *,
          hardware_inventory (
            name, 
            sku, 
            inbound_qty, 
            outbound_qty, 
            stock_balance, 
            category, 
            unit
          )
        `,
        )
        .order("batch_date", { ascending: false });

      if (error) throw error;

      // Fetch date_arrived from order_scheduling keyed by order_number
      const poNumbers = [...new Set((data || []).map((b) => extractPO(b.batch_number)).filter(Boolean))];
      let dateArrivedMap = {};
      if (poNumbers.length > 0) {
        const { data: schedData } = await supabase
          .from("order_scheduling")
          .select("order_number, date_arrived")
          .in("order_number", poNumbers);
        (schedData || []).forEach((row) => {
          if (row.date_arrived) dateArrivedMap[row.order_number] = row.date_arrived;
        });
      }

      const enriched = (data || []).map((b) => ({
        ...b,
        _date_arrived: dateArrivedMap[extractPO(b.batch_number)] || null,
      }));

      setBatches(enriched);

      const initialExpanded = {};
      enriched.forEach((b) => {
        if (b.hardware_inventory)
          initialExpanded[b.hardware_inventory.name] = true;
      });
      setExpandedNames(initialExpanded);
    } catch (err) {
      console.error("Error fetching batches:", err.message);
    }
  };

  const fetchArchive = async () => {
    try {
      const { data, error } = await supabase
        .from("daily_ledger_history")
        .select("*")
        .order("snapshot_date", { ascending: false });
      if (error) throw error;
      setArchiveItems(data || []);
    } catch (err) {
      console.error("Archive Error:", err.message);
    }
  };

  const groupedByPO = batches.reduce((acc, batch) => {
    const po = extractPO(batch.batch_number);
    if (!acc[po]) acc[po] = [];
    acc[po].push({
      batchNumber: batch.batch_number,
      itemName: batch.hardware_inventory?.name || "Unknown Item",
      qty: batch.current_stock ?? 0,
      unit: batch.hardware_inventory?.unit || "",
      batchDate: batch._date_arrived || batch.batch_date,
    });
    return acc;
  }, {});

  const handleDownloadPOQRs = () => {
    if (!selectedPOForQR || !groupedByPO[selectedPOForQR]) return;
    setPOQRData({ po: selectedPOForQR, items: groupedByPO[selectedPOForQR] });
  };

  const handlePrint = () => {
    if (!printTableRef.current) return;
    const tableHTML = printTableRef.current.outerHTML;
    const win = window.open("", "_blank");
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Sheet - ${poQRData.po}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: sans-serif; }
            table { border-collapse: collapse; width: 100%; table-layout: fixed; }
            td { border: 1px solid #999; padding: 8px; vertical-align: middle; word-break: break-word; }
            tr { page-break-inside: avoid; break-inside: avoid; }
            .qr-col-qr  { width: 28mm; }
            .qr-col-po  { width: 34mm; }
            .qr-col-date{ width: 38mm; }
            p { margin: 0; }
            .mono { font-family: monospace; font-size: 10px; color: #666; word-break: break-all; line-height: 1.4; }
            .name { font-size: 13px; font-weight: 900; text-transform: uppercase; color: #111; }
            .recv { font-size: 12px; font-weight: 700; color: #444; }
          </style>
        </head>
        <body>${tableHTML}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const groupedByName = batches.reduce((acc, batch) => {
    const name = batch.hardware_inventory?.name || "Unknown Item";
    if (!acc[name]) acc[name] = [];
    acc[name].push(batch);
    return acc;
  }, {});

  const allCategories = [...new Set(batches.map(b => b.hardware_inventory?.category).filter(Boolean))];

  const filteredLedgerEntries = Object.entries(groupedByName).filter(([name, itemBatches]) => {
    const master = itemBatches[0].hardware_inventory;
    const matchName = name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !category || master?.category === category;
    const batchDates = itemBatches.map(b => b.batch_date?.split('T')[0] || '');
    const matchDate = (!ledgerDateFrom && !ledgerDateTo) || batchDates.some(d =>
      (!ledgerDateFrom || d >= ledgerDateFrom) && (!ledgerDateTo || d <= ledgerDateTo)
    );
    return matchName && matchCat && matchDate;
  }).sort(([a], [b]) => a.localeCompare(b));

  const filteredBatchEntries = Object.entries(groupedByName).filter(([name, itemBatches]) => {
    const master = itemBatches[0].hardware_inventory;
    const matchName = name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !category || master?.category === category;
    const batchDates = itemBatches.map(b => b.batch_date?.split('T')[0] || '');
    const matchDate = (!batchDateFrom && !batchDateTo) || batchDates.some(d =>
      (!batchDateFrom || d >= batchDateFrom) && (!batchDateTo || d <= batchDateTo)
    );
    return matchName && matchCat && matchDate;
  }).sort(([a], [b]) => a.localeCompare(b));

  const filteredArchiveItems = archiveItems.filter((r) => {
    const matchName = r.name?.toLowerCase().includes(search.toLowerCase());
    const d = r.snapshot_date?.split('T')[0] || '';
    const matchDate = (!archiveDateFrom || d >= archiveDateFrom) && (!archiveDateTo || d <= archiveDateTo);
    return matchName && matchDate;
  });

  const pagedLedger = filteredLedgerEntries.slice((ledgerPage - 1) * PAGE_SIZE, ledgerPage * PAGE_SIZE);
  const pagedBatches = filteredBatchEntries.slice((batchPage - 1) * PAGE_SIZE, batchPage * PAGE_SIZE);
  const pagedArchive = filteredArchiveItems.slice((archivePage - 1) * PAGE_SIZE, archivePage * PAGE_SIZE);

  const PaginationBar = ({ page, setPage, total }) => {
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (totalPages <= 1) return null;
    return (
      <div className='flex items-center justify-between px-8 py-3 border-t border-slate-100'>
        <p className='text-[10px] font-bold text-slate-400 uppercase'>
          Page {page} of {totalPages} — {total} items
        </p>
        <div className='flex gap-2'>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className='p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-all'>
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3'><path d='M15 18l-6-6 6-6'/></svg>
          </button>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className='p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-all'>
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3'><path d='M9 18l6-6-6-6'/></svg>
          </button>
        </div>
      </div>
    );
  };

  const handleEndDay = async () => {
    if (
      !window.confirm(
        "End Business Day? This locks today's balances and resets tallies.",
      )
    )
      return;
    try {
      setIsProcessing(true);
      const _d = new Date();
      const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, "0")}-${String(_d.getDate()).padStart(2, "0")}`;
      const products = Object.values(groupedByName).map(
        (group) => group[0].hardware_inventory,
      );

      // Fetch supplier costs to compute total_value
      const { data: pricingData } = await supabase
        .from("product_pricing")
        .select("product_id, supplier_cost");
      const costMap = {};
      (pricingData || []).forEach((p) => {
        costMap[p.product_id] = p.supplier_cost || 0;
      });

      // Also fetch product ids from hardware_inventory for mapping
      const { data: invData } = await supabase
        .from("hardware_inventory")
        .select("id, sku");
      const skuToId = {};
      (invData || []).forEach((i) => { skuToId[i.sku] = i.id; });

      const historyData = products.map((prod) => {
        const productId = skuToId[prod.sku];
        const cost = costMap[productId] || 0;
        const balance = prod.stock_balance || 0;
        return {
          name: prod.name,
          sku: prod.sku,
          category: prod.category || null,
          initial_qty:
            (prod.stock_balance || 0) -
            (prod.inbound_qty || 0) +
            (prod.outbound_qty || 0),
          inbound_qty: prod.inbound_qty || 0,
          outbound_qty: prod.outbound_qty || 0,
          final_balance: balance,
          total_value: balance * cost,
          snapshot_date: today,
          po_number: prod.sku,
        };
      });

      await supabase.from("daily_ledger_history").insert(historyData);
      await supabase
        .from("hardware_inventory")
        .update({ inbound_qty: 0, outbound_qty: 0 })
        .gt("stock_balance", -1000000);

      fetchInventory();
      fetchArchive();
      alert("Business day closed successfully.");
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className='p-3 sm:p-4 md:p-6 lg:p-8 w-full bg-slate-50 min-h-screen font-sans text-slate-900 overflow-x-hidden'>
      {/* HEADER SECTION */}
      <div className='flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 sm:mb-10 gap-4 no-print'>
        <div>
          <h1 className='text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3'>
            <Database className='text-teal-600' size={32} /> INVENTORY
            MANAGEMENT
          </h1>
          <p className='text-slate-600 font-bold text-[8px] sm:text-xs uppercase tracking-[0.2em] mt-2'>
            Verified System Master | Hardware Logistics
          </p>
        </div>
        <div className='flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8'>
          <div className='text-right'>
            <span className='text-[8px] sm:text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-1'>
              Station Time
            </span>
            <div className='flex items-center gap-2 text-slate-900 font-mono font-bold text-lg sm:text-2xl'>
              <Clock size={16} className='text-teal-600' /> {currentTime}
            </div>
          </div>
          {_userRole !== "Stockman" && (
            <button
              onClick={handleEndDay}
              disabled={isProcessing}
              className='bg-slate-900 text-white px-4 sm:px-8 py-3 sm:py-4 rounded-2xl text-[8px] sm:text-xs font-black uppercase hover:bg-black transition-all shadow-xl active:scale-95 flex items-center gap-2 whitespace-nowrap'
            >
              {isProcessing ? "Processing..." : "End Business Day"}
            </button>
          )}
        </div>
      </div>

      {/* UNIVERSAL FILTER BAR */}
      <div className='flex flex-col sm:flex-row gap-3 mb-8 no-print'>
        <div className='relative flex-1'>
          <Search className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-400' size={16} />
          <input
            type='text'
            placeholder='Search items, batches, history...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='w-full pl-10 pr-4 py-3 rounded-2xl bg-white shadow-sm font-bold text-xs uppercase outline-none focus:ring-2 focus:ring-teal-400'
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className='py-3 px-4 rounded-2xl bg-white shadow-sm font-bold text-xs uppercase outline-none focus:ring-2 focus:ring-teal-400 min-w-40'
        >
          <option value=''>All Categories</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* 1. DAILY MOVEMENT LEDGER */}
      <div className='mb-8 sm:mb-14'>
        <button
          onClick={() => setShowLedger((v) => !v)}
          className='w-full text-left flex items-center gap-2 mb-3 group'
        >
          <h2 className='text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2'>
            <ArrowDownUp className='text-teal-600' size={24} /> Daily Movement Ledger
          </h2>
          <ChevronDown
            size={20}
            className={`ml-auto text-slate-400 group-hover:text-teal-600 transition-transform duration-300 ${showLedger ? '' : '-rotate-90'}`}
          />
        </button>
        <div className='flex gap-2 mb-4 no-print'>
          <input type='date' value={ledgerDateFrom} onChange={(e) => { setLedgerDateFrom(e.target.value); setLedgerPage(1); }}
            className='py-2 px-3 rounded-xl bg-white shadow-sm font-bold text-xs outline-none focus:ring-2 focus:ring-teal-400' />
          <input type='date' value={ledgerDateTo} onChange={(e) => { setLedgerDateTo(e.target.value); setLedgerPage(1); }}
            className='py-2 px-3 rounded-xl bg-white shadow-sm font-bold text-xs outline-none focus:ring-2 focus:ring-teal-400' />
          {(ledgerDateFrom || ledgerDateTo) && (
            <button onClick={() => { setLedgerDateFrom(''); setLedgerDateTo(''); }}
              className='p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all'>
              <X size={14} />
            </button>
          )}
        </div>
        {showLedger && (
          <div className='bg-white rounded-4xl shadow-sm overflow-hidden'>
          <div className='overflow-x-auto'>
          <table className='w-full text-left min-w-max'>
            <thead>
              <tr className='bg-black text-white text-[10px] font-black uppercase'>
                <th className='px-8 py-6'>Item Details</th>
                <th className='px-8 py-6'>Category</th>
                <th className='px-8 py-6 text-center'>Current Stock</th>
                <th className='px-8 py-6 text-teal-400 text-center'>
                  In (+)
                </th>
                <th className='px-8 py-6 text-orange-400 text-center'>
                  Out (-)
                </th>
                <th className='px-8 py-6 bg-black text-teal-400 text-center border-l border-slate-700'>
                  Stock Balance
                </th>
              </tr>
            </thead>
            <tbody className='divide-y-2 divide-slate-50'>
              {filteredLedgerEntries.length > 0 ? (
                pagedLedger.map(([name, itemBatches]) => {
                  const master = itemBatches[0].hardware_inventory;
                  const opening =
                    (master.stock_balance || 0) -
                    (master.inbound_qty || 0) +
                    (master.outbound_qty || 0);
                  return (
                    <tr
                      key={name}
                      className='hover:bg-teal-50/40 transition-colors'
                    >
                      <td className='px-8 py-6'>
                        <span className='font-black uppercase text-base text-slate-900 block leading-tight'>
                          {name}
                        </span>
                        <span className='font-mono text-[11px] text-slate-500 font-bold'>
                          SKU: {master.sku}
                        </span>
                      </td>
                      <td className='px-8 py-6'>
                        <span className='text-[10px] font-black uppercase bg-slate-100 px-3 py-1.5 rounded-lg text-slate-700 border border-slate-200'>
                          {master.category || "N/A"}
                        </span>
                      </td>
                      <td className='px-8 py-6 text-center font-bold text-slate-600'>
                        {opening}
                      </td>
                      <td className='px-8 py-6 text-center font-black text-teal-700 text-lg'>
                        +{master.inbound_qty || 0}
                      </td>
                      <td className='px-8 py-6 text-center font-black text-orange-700 text-lg'>
                        -{master.outbound_qty || 0}
                      </td>
                      <td className='px-8 py-6 text-center font-black bg-teal-50/50 border-l border-slate-100 text-teal-900 text-xl'>
                        {master.stock_balance || 0}{" "}
                        <span className='text-[10px] font-bold text-teal-600 ml-1'>
                          {master.unit}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan='6'
                    className='px-8 py-10 text-center text-xs font-black uppercase text-slate-500'
                  >
                    No inventory movement yet
                  </td>
                </tr>
              )}
            </tbody>
            </table>
            </div>
            <PaginationBar page={ledgerPage} setPage={setLedgerPage} total={filteredLedgerEntries.length} />
          </div>
        )}
      </div>

      {/* QR DOWNLOAD BY PO */}
      <div className='mb-8 bg-white rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 no-print'>
        <div className='flex items-center gap-2 shrink-0'>
          <QrCode size={18} className='text-teal-600' />
          <span className='text-[10px] font-black uppercase tracking-widest text-slate-500'>Download QRs by PO</span>
        </div>
        <select
          value={selectedPOForQR}
          onChange={(e) => setSelectedPOForQR(e.target.value)}
          className='flex-1 py-2.5 px-4 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-xs uppercase outline-none focus:ring-2 focus:ring-teal-400'
        >
          <option value=''>Select PO Number...</option>
          {Object.entries(groupedByPO).map(([po, items]) => (
            <option key={po} value={po}>{po} — {items.length} item{items.length !== 1 ? 's' : ''}</option>
          ))}
        </select>
        <button
          onClick={handleDownloadPOQRs}
          disabled={!selectedPOForQR}
          className='flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all active:scale-95 shrink-0'
        >
          <Download size={15} /> Download QRs
        </button>
      </div>

      {/* 2. MASTER RECORDS (BATCHES) */}
      <div className='mb-8 sm:mb-14'>
        <button
          onClick={() => setShowBatches((v) => !v)}
          className='w-full text-left flex items-center gap-2 mb-3 group'
        >
          <h2 className='text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2'>
            <Package className='text-teal-600' size={24} /> Master Batch Records
          </h2>
          <ChevronDown
            size={20}
            className={`ml-auto text-slate-400 group-hover:text-teal-600 transition-transform duration-300 ${showBatches ? '' : '-rotate-90'}`}
          />
        </button>
        <div className='flex gap-2 mb-4 no-print'>
          <input type='date' value={batchDateFrom} onChange={(e) => { setBatchDateFrom(e.target.value); setBatchPage(1); }}
            className='py-2 px-3 rounded-xl bg-white shadow-sm font-bold text-xs outline-none focus:ring-2 focus:ring-teal-400' />
          <input type='date' value={batchDateTo} onChange={(e) => { setBatchDateTo(e.target.value); setBatchPage(1); }}
            className='py-2 px-3 rounded-xl bg-white shadow-sm font-bold text-xs outline-none focus:ring-2 focus:ring-teal-400' />
          {(batchDateFrom || batchDateTo) && (
            <button onClick={() => { setBatchDateFrom(''); setBatchDateTo(''); }}
              className='p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all'>
              <X size={14} />
            </button>
          )}
        </div>
        {showBatches && (
          <div className='bg-white rounded-4xl shadow-sm overflow-hidden'>
          <div className='overflow-x-auto'>
          <table className='w-full text-left min-w-max'>
            <thead>
              <tr className='bg-black text-white text-[10px] font-black uppercase'>
                <th className='px-8 py-6 w-20 text-center'>Status</th>
                <th className='px-8 py-6'>Batch Reference</th>
                <th className='px-8 py-6 text-center'>Receipt Date</th>
                <th className='px-8 py-6 text-center'>Remaining</th>
              </tr>
            </thead>
            <tbody className='divide-y-2 divide-slate-50'>
              {filteredBatchEntries.length > 0 ? (
                pagedBatches.map(([itemName, itemBatches]) => (
                  <React.Fragment key={itemName}>
                    <tr
                      className='bg-slate-50/80 cursor-pointer'
                      onClick={() =>
                        setExpandedNames((p) => ({
                          ...p,
                          [itemName]: !p[itemName],
                        }))
                      }
                    >
                      <td className='px-8 py-5 text-center'>
                        <ChevronDown
                          size={22}
                          className={`transition-transform duration-300 ${
                            expandedNames[itemName]
                              ? "text-teal-600"
                              : "text-slate-400 -rotate-90"
                          }`}
                        />
                      </td>
                      <td
                        colSpan='3'
                        className='px-8 py-5 font-black text-lg uppercase italic text-slate-900'
                      >
                        {itemName}
                        <span className='ml-4 text-[10px] bg-teal-600 text-white px-3 py-1 rounded-full not-italic font-black tracking-widest'>
                          {itemBatches[0].hardware_inventory.category}
                        </span>
                      </td>
                    </tr>
                    {expandedNames[itemName] &&
                      itemBatches.map((batch) => (
                        <tr
                          key={batch.id}
                          onClick={() => {
                            const po = extractPO(batch.batch_number);
                            navigate("/purchase-history", { state: { orderNumber: po } });
                          }}
                          className='text-xs hover:bg-teal-50/50 transition-colors cursor-pointer'
                        >
                          <td className='px-8 py-6 text-center'>
                            <div
                              className={`w-3 h-3 rounded-full mx-auto ${
                                batch.current_stock > 0
                                  ? "bg-emerald-500"
                                  : "bg-slate-300"
                              }`}
                            ></div>
                          </td>
                          <td className='px-8 py-6 font-mono font-black text-slate-800 text-base cursor-pointer hover:text-teal-600'>
                            {batch.batch_number?.split("-").slice(0, 2).join("-")}
                          </td>
                          <td className='px-8 py-6 text-center font-bold text-slate-700 text-sm'>
                            {formatPSTDate(batch.batch_date)}
                          </td>
                          <td className='px-8 py-6 text-emerald-800 text-center font-black text-lg'>
                            {batch.current_stock}{" "}
                            <span className='text-[11px] uppercase text-emerald-600 font-bold'>
                              {itemBatches[0].hardware_inventory.unit}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td
                    colSpan='4'
                    className='px-8 py-10 text-center text-xs font-black uppercase text-slate-500'
                  >
                    No batch records available
                  </td>
                </tr>
              )}
            </tbody>
            </table>
            </div>
            <PaginationBar page={batchPage} setPage={setBatchPage} total={filteredBatchEntries.length} />
          </div>
        )}
      </div>

      {/* 3. LEDGER HISTORY (ARCHIVE) */}
      <div className='no-print'>
        <button
          onClick={() => setShowArchive((v) => !v)}
          className='w-full text-left flex items-center gap-2 mb-3 group'
        >
          <h2 className='text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2'>
            <Clock size={24} className='text-slate-400' /> Ledger History (EOD Snapshots)
          </h2>
          <ChevronDown
            size={20}
            className={`ml-auto text-slate-400 group-hover:text-teal-600 transition-transform duration-300 ${showArchive ? '' : '-rotate-90'}`}
          />
        </button>
        <div className='flex gap-2 mb-4'>
          <input type='date' value={archiveDateFrom} onChange={(e) => { setArchiveDateFrom(e.target.value); setArchivePage(1); }}
            className='py-2 px-3 rounded-xl bg-white shadow-sm font-bold text-xs outline-none focus:ring-2 focus:ring-teal-400' />
          <input type='date' value={archiveDateTo} onChange={(e) => { setArchiveDateTo(e.target.value); setArchivePage(1); }}
            className='py-2 px-3 rounded-xl bg-white shadow-sm font-bold text-xs outline-none focus:ring-2 focus:ring-teal-400' />
          {(archiveDateFrom || archiveDateTo) && (
            <button onClick={() => { setArchiveDateFrom(''); setArchiveDateTo(''); }}
              className='p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all'>
              <X size={14} />
            </button>
          )}
        </div>
        {showArchive && (
          <div className='bg-white rounded-4xl shadow-sm overflow-hidden'>
          <div className='overflow-x-auto'>
          <table className='w-full text-left min-w-max'>
            <thead>
              <tr className='bg-black text-white text-[10px] uppercase font-black'>
                <th className='px-8 py-6 tracking-widest'>Snapshot Date</th>
                <th className='px-8 py-6 tracking-widest'>Item Description</th>
                <th className='px-8 py-6 text-center tracking-widest'>
                  Initial
                </th>
                <th className='px-8 py-6 text-center tracking-widest'>
                  Daily In
                </th>
                <th className='px-8 py-6 text-center tracking-widest'>
                  Daily Out
                </th>
                <th className='px-8 py-6 text-right pr-12 tracking-widest'>
                  Closing Balance
                </th>
              </tr>
            </thead>
            <tbody className='divide-y-2 divide-slate-50'>
              {filteredArchiveItems.length > 0 ? (
                pagedArchive.map((record) => (
                  <tr
                    key={record.id}
                    className='text-xs hover:bg-slate-50 transition-colors'
                  >
                    <td className='px-8 py-5 font-mono font-bold text-slate-500'>
                      {formatPSTDate(record.snapshot_date)}
                    </td>
                    <td className='px-8 py-5 font-black text-slate-900 uppercase text-sm'>
                      {record.name}
                    </td>
                    <td className='px-8 py-5 text-center text-slate-400 font-bold'>
                      {record.initial_qty}
                    </td>
                    <td className='px-8 py-5 text-center text-teal-800 font-black text-base'>
                      +{record.inbound_qty}
                    </td>
                    <td className='px-8 py-5 text-center text-orange-800 font-black text-base'>
                      -{record.outbound_qty}
                    </td>
                    <td className='px-8 py-5 text-right pr-12 font-black text-slate-900 bg-slate-50/50 text-lg'>
                      {record.final_balance}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan='6'
                    className='px-8 py-16 text-center text-slate-400 font-bold uppercase text-[11px] tracking-[0.3em]'
                  >
                    No historical logs available for this station
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          <PaginationBar page={archivePage} setPage={setArchivePage} total={filteredArchiveItems.length} />
        </div>
        )}
      </div>

      {/* QR PRINT MODAL */}
      {poQRData && (
        <div className='fixed inset-0 z-50 bg-white overflow-auto flex flex-col'>
          <div className='flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-white sticky top-0 z-10'>
            <div>
              <p className='text-[10px] font-black uppercase tracking-widest text-teal-600 mb-0.5'>Batch QR Sheet</p>
              <h2 className='text-xl font-black text-slate-900 uppercase'>{poQRData.po}</h2>
              <p className='text-xs text-slate-500 font-bold mt-0.5'>{poQRData.items.length} batch{poQRData.items.length !== 1 ? 'es' : ''}</p>
            </div>
            <div className='flex items-center gap-3'>
              <button
                type='button'
                onClick={handlePrint}
                className='flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-95'
              >
                <Download size={15} /> Print / Save PDF
              </button>
              <button
                onClick={() => setPOQRData(null)}
                className='p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all'
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className='p-8 overflow-auto'>
            <table ref={printTableRef} className='w-full border-collapse table-fixed'>
              <colgroup>
                <col style={{ width: '112px' }} />
                <col style={{ width: '136px' }} />
                <col />
                <col style={{ width: '152px' }} />
              </colgroup>
              <tbody>
                {poQRData.items.map((item) => (
                  <tr key={item.batchNumber} className='border border-slate-300'>
                    <td className='border border-slate-300 p-2 align-middle'>
                      <QRCodeSVG
                        value={`${window.location.origin}/batch/${item.batchNumber}`}
                        size={90}
                        level='H'
                        includeMargin
                      />
                    </td>
                    <td className='border border-slate-300 p-3 align-middle'>
                      <p className='text-[11px] font-mono text-slate-500 break-all leading-relaxed'>{extractPO(item.batchNumber)}</p>
                    </td>
                    <td className='border border-slate-300 p-3 align-middle'>
                      <p className='text-sm font-black uppercase text-slate-900 leading-snug'>{item.itemName}</p>
                    </td>
                    <td className='border border-slate-300 p-3 align-middle'>
                      <p className='text-sm font-bold text-slate-700'>
                        Received:{' '}
                        {item.batchDate ? formatPSTDate(item.batchDate) : '—'}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
