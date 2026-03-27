import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  Package,
  Clock,
  Database,
  ArrowDownUp,
  ArrowRight,
  ChevronDown,
} from "lucide-react";

const Inventory = ({ setCurrentPage, setSelectedPO }) => {
  const [batches, setBatches] = useState([]);
  const [archiveItems, setArchiveItems] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedNames, setExpandedNames] = useState({});
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString(),
  );

  useEffect(() => {
    fetchInventory();
    fetchArchive();
    const timer = setInterval(
      () => setCurrentTime(new Date().toLocaleTimeString()),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

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
      setBatches(data || []);

      const initialExpanded = {};
      data?.forEach((b) => {
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

  const groupedByName = batches.reduce((acc, batch) => {
    const name = batch.hardware_inventory?.name || "Unknown Item";
    if (!acc[name]) acc[name] = [];
    acc[name].push(batch);
    return acc;
  }, {});
  const groupedEntries = Object.entries(groupedByName);

  const handleEndDay = async () => {
    if (
      !window.confirm(
        "End Business Day? This locks today's balances and resets tallies.",
      )
    )
      return;
    try {
      setIsProcessing(true);
      const today = new Date().toISOString().split("T")[0];
      const products = Object.values(groupedByName).map(
        (group) => group[0].hardware_inventory,
      );

      const historyData = products.map((prod) => ({
        name: prod.name,
        initial_qty:
          (prod.stock_balance || 0) -
          (prod.inbound_qty || 0) +
          (prod.outbound_qty || 0),
        inbound_qty: prod.inbound_qty || 0,
        outbound_qty: prod.outbound_qty || 0,
        final_balance: prod.stock_balance || 0,
        snapshot_date: today,
        po_number: prod.sku,
      }));

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
    <div className='p-8 w-full bg-slate-50 min-h-screen font-sans text-slate-900'>
      {/* HEADER SECTION */}
      <div className='flex justify-between items-end mb-10 no-print'>
        <div>
          <h1 className='text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3'>
            <Database className='text-teal-600' size={32} /> INVENTORY
            MANAGEMENT
          </h1>
          <p className='text-slate-600 font-bold text-xs uppercase tracking-[0.2em] mt-2'>
            Verified System Master | Hardware Logistics
          </p>
        </div>
        <div className='flex items-center gap-8'>
          <div className='text-right pr-8'>
            <span className='text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-1'>
              Station Time
            </span>
            <div className='flex items-center gap-2 text-slate-900 font-mono font-bold text-2xl'>
              <Clock size={22} className='text-teal-600' /> {currentTime}
            </div>
          </div>
          <button
            onClick={handleEndDay}
            disabled={isProcessing}
            className='bg-slate-900 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase hover:bg-black transition-all shadow-xl active:scale-95 flex items-center gap-2'
          >
            {isProcessing ? "Processing..." : "End Business Day"}
          </button>
        </div>
      </div>

      {/* 1. DAILY MOVEMENT LEDGER */}
      <div className='mb-14'>
        <h2 className='text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 mb-5'>
          <ArrowDownUp className='text-teal-600' size={24} /> Daily Movement
          Ledger
        </h2>
        <div className='bg-white rounded-[2rem] shadow-sm overflow-hidden'>
          <table className='w-full text-left'>
            <thead>
              <tr className='bg-black text-white text-[10px] font-black uppercase'>
                <th className='px-8 py-6'>Item Details</th>
                <th className='px-8 py-6'>Category</th>
                <th className='px-8 py-6 text-center'>Opening</th>
                <th className='px-8 py-6 text-teal-400 text-center'>
                  Inbound (+)
                </th>
                <th className='px-8 py-6 text-orange-400 text-center'>
                  Outbound (-)
                </th>
                <th className='px-8 py-6 bg-black text-teal-400 text-center border-l border-slate-700'>
                  Live Balance
                </th>
              </tr>
            </thead>
            <tbody className='divide-y-2 divide-slate-50'>
              {groupedEntries.length > 0 ? (
                groupedEntries.map(([name, itemBatches]) => {
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
      </div>

      {/* 2. MASTER RECORDS (BATCHES) */}
      <div className='mb-14'>
        <h2 className='text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 mb-5'>
          <Package className='text-teal-600' size={24} /> Master Batch Records
        </h2>
        <div className='bg-white rounded-[2rem] shadow-sm overflow-hidden'>
          <table className='w-full text-left'>
            <thead>
              <tr className='bg-black text-white text-[10px] font-black uppercase'>
                <th className='px-8 py-6 w-20 text-center'>Status</th>
                <th className='px-8 py-6'>Batch Reference</th>
                <th className='px-8 py-6 text-center'>Receipt Date</th>
                <th className='px-8 py-6 text-center'>Remaining</th>
                <th className='px-8 py-6 text-right pr-12'>Action</th>
              </tr>
            </thead>
            <tbody className='divide-y-2 divide-slate-50'>
              {groupedEntries.length > 0 ? (
                groupedEntries.map(([itemName, itemBatches]) => (
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
                        colSpan='4'
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
                          className='text-xs hover:bg-teal-50/50 transition-colors'
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
                          <td className='px-8 py-6 font-mono font-black text-slate-800 text-base'>
                            {batch.batch_number}
                          </td>
                          <td className='px-8 py-6 text-center font-bold text-slate-700 text-sm'>
                            {new Date(batch.batch_date).toLocaleDateString(
                              undefined,
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </td>
                          <td className='px-8 py-6 text-emerald-800 text-center font-black text-lg'>
                            {batch.current_stock}{" "}
                            <span className='text-[11px] uppercase text-emerald-600 font-bold'>
                              {itemBatches[0].hardware_inventory.unit}
                            </span>
                          </td>
                          <td className='px-8 py-6 text-right pr-12'>
                            <button
                              onClick={() => {
                                setSelectedPO({
                                  number: batch.batch_number,
                                  date: batch.batch_date,
                                  name: itemName,
                                });
                                setCurrentPage("Item Action");
                              }}
                              className='bg-teal-600 text-white px-6 py-3 rounded-xl font-black text-[11px] uppercase flex items-center gap-2 ml-auto hover:bg-slate-900 transition-all active:scale-95 shadow-lg shadow-teal-100'
                            >
                              QR SYSTEM <ArrowRight size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td
                    colSpan='5'
                    className='px-8 py-10 text-center text-xs font-black uppercase text-slate-500'
                  >
                    No batch records available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. LEDGER HISTORY (ARCHIVE) */}
      <div className='no-print'>
        <h2 className='text-xl font-black text-slate-900 uppercase tracking-tight mb-5 flex items-center gap-2'>
          <Clock size={24} className='text-slate-400' /> Ledger History (EOD
          Snapshots)
        </h2>
        <div className='bg-white rounded-[2rem] shadow-sm overflow-hidden'>
          <table className='w-full text-left'>
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
              {archiveItems.length > 0 ? (
                archiveItems.map((record) => (
                  <tr
                    key={record.id}
                    className='text-xs hover:bg-slate-50 transition-colors'
                  >
                    <td className='px-8 py-5 font-mono font-bold text-slate-500'>
                      {new Date(record.snapshot_date).toLocaleDateString(
                        undefined,
                        { year: "numeric", month: "short", day: "numeric" },
                      )}
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
      </div>
    </div>
  );
};

export default Inventory;
