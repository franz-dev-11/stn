import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  CheckCircle,
  Layers,
  ChevronRight,
  Calendar,
  Printer, // Added Printer icon for the new print button
} from "lucide-react";

const ItemAction = ({ po_number, setCurrentPage }) => {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState(null);
  const [batchDate, setBatchDate] = useState(null);
  const [productName, setProductName] = useState(""); // State for joined product name

  const isObject = typeof po_number === "object" && po_number !== null;
  const batchRef = isObject ? po_number.number : po_number;

  useEffect(() => {
    const fetchData = async () => {
      if (!batchRef) {
        return;
      }

      try {
        // 1. Fetch Items in this PO from order_scheduling
        const itemsRequest = supabase
          .from("order_scheduling")
          .select("*")
          .eq("order_number", batchRef);

        // 2. Try to get receipt date from inventory_batches
        const batchRequest = supabase
          .from("inventory_batches")
          .select("batch_date")
          .eq("batch_number", batchRef)
          .single();

        const [itemsRes, batchRes] = await Promise.all([
          itemsRequest,
          batchRequest,
        ]);

        if (itemsRes.error) throw itemsRes.error;

        setItems(itemsRes.data || []);
        if (itemsRes.data && itemsRes.data.length > 0) {
          setSelectedItem(itemsRes.data[0]);
        }

        // Use batch_date from inventory_batches (receipt date), or fallback to date_arrived
        if (batchRes.data?.batch_date) {
          setBatchDate(batchRes.data.batch_date);
        } else if (itemsRes.data && itemsRes.data.length > 0) {
          setBatchDate(itemsRes.data[0].date_arrived);
        }
      } catch (err) {
        console.error("Fetch Error:", err.message);
        // If batch not found, still try to set date from order_scheduling
        if (itemsRes?.data && itemsRes.data.length > 0) {
          setBatchDate(itemsRes.data[0].date_arrived);
        }
      }
    };

    fetchData();
  }, [batchRef]);

  const handleTransaction = async (type) => {
    if (!selectedItem) return;
    setProcessing(true);
    const column = type === "out" ? "outbound_qty" : "inbound_qty";
    const currentValue = selectedItem[column] || 0;

    try {
      const { error } = await supabase
        .from("order_scheduling")
        .update({ [column]: currentValue + 1 })
        .eq("id", selectedItem.id);

      if (error) throw error;
      setStatus("success");
      setTimeout(() => setCurrentPage("Inventory"), 1500);
    } catch (err) {
      alert("Error: " + err.message);
      setProcessing(false);
    }
  };

  // Triggers the system print dialog
  const handlePrint = () => {
    window.print();
  };

  const qrUrl = `${window.location.origin}${window.location.pathname}?po=${batchRef}`;

  return (
    <div className='min-h-screen bg-slate-50 flex items-center justify-center p-4'>
      {/* Print-specific Styles */}
      <style>
        {`
          @media print {
            body { background: white !important; }
            .no-print { display: none !important; }
            .print-area { 
              border: none !important; 
              box-shadow: none !important; 
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
            }
            .printable-card {
              border: 1px solid #e2e8f0 !important;
              padding: 40px !important;
              border-radius: 20px !important;
              text-align: center !important;
            }
          }
        `}
      </style>

      <div className='bg-white p-8 rounded-3xl shadow-xl w-full max-w-md relative overflow-hidden print-area'>
        {status === "success" && (
          <div className='absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-3xl no-print'>
            <CheckCircle size={60} className='text-emerald-500 mb-2' />
            <h2 className='text-2xl font-black text-slate-800 uppercase'>
              Updated
            </h2>
          </div>
        )}

        <div className='flex justify-between items-center mb-6 no-print'>
          <button
            onClick={() => setCurrentPage("Inventory")}
            className='text-slate-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:text-black'
          >
            <ArrowLeft size={16} /> Back
          </button>

          <button
            onClick={handlePrint}
            className='bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 px-3 rounded-xl transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-wider'
          >
            <Printer size={16} /> Print QR
          </button>
        </div>

        {/* --- PRINTABLE SECTION --- */}
        <div className='printable-card'>
          <div className='text-center mb-8 pb-8'>
            <div className='flex justify-center mb-6'>
              <div className='p-4 bg-white rounded-2xl shadow-sm'>
                <QRCodeSVG
                  value={qrUrl}
                  size={200}
                  level='H'
                  includeMargin={true}
                />
              </div>
            </div>

            <div className='space-y-1'>
              <p className='text-[10px] font-black text-teal-600 uppercase tracking-[0.2em]'>
                {productName || "Batch Record"}
              </p>
              <h1 className='text-3xl font-black text-slate-900 tracking-tight uppercase'>
                {batchRef}
              </h1>
            </div>

            <div className='mt-4 flex items-center justify-center gap-2'>
              <div className='px-3 py-1 bg-slate-100 rounded-full flex items-center gap-2'>
                <Calendar size={14} className='text-slate-500' />
                <span className='text-[11px] font-bold text-slate-600 uppercase tracking-tighter'>
                  Received:{" "}
                  {batchDate
                    ? new Date(batchDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "--"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* --- INTERACTIVE SELECTION UI (Hidden on Print) --- */}
        <div className='no-print'>
          {!selectedItem && items.length === 0 && (
            <div className='p-6 rounded-2xl text-center'>
              <p className='text-xs font-black uppercase text-slate-500'>
                No items found for this batch
              </p>
              <p className='text-[10px] font-bold text-slate-400 mt-2 uppercase'>
                Check batch reference or create inbound records first.
              </p>
            </div>
          )}

          {!selectedItem && items.length > 0 && (
            <div className='space-y-3 animate-in fade-in slide-in-from-bottom-2'>
              <p className='text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2'>
                <Layers size={14} /> Select Item to Process:
              </p>
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className='w-full flex items-center justify-between p-4 rounded-2xl border-2 border-slate-50 hover:border-teal-500 hover:bg-teal-50 transition-all group'
                >
                  <div className='text-left'>
                    <p className='font-black text-slate-700 uppercase text-sm group-hover:text-teal-700'>
                      {item.item_name}
                    </p>
                    <p className='text-[10px] text-slate-400 font-bold'>
                      Qty: {item.quantity}
                    </p>
                  </div>
                  <ChevronRight
                    size={18}
                    className='text-slate-300 group-hover:text-teal-500'
                  />
                </button>
              ))}
            </div>
          )}

          {/* --- TRANSACTION UI (Hidden on Print) --- */}
          {selectedItem && (
            <div className='animate-in fade-in zoom-in-95'>
              <div className='bg-slate-900 p-5 rounded-2xl mb-6 shadow-lg shadow-slate-200'>
                <p className='text-[10px] font-black text-teal-400 uppercase tracking-widest mb-1'>
                  Active Item
                </p>
                <p className='font-black text-white uppercase text-lg leading-tight'>
                  {selectedItem.item_name}
                </p>
              </div>

              <div className='grid grid-cols-2 gap-4 mb-8'>
                <div className='bg-slate-50 p-4 rounded-2xl text-center'>
                  <p className='text-[9px] font-black text-slate-400 uppercase'>
                    Original Stock
                  </p>
                  <p className='text-lg font-black'>{selectedItem.quantity}</p>
                </div>
                <div className='bg-slate-50 p-4 rounded-2xl text-center'>
                  <p className='text-[9px] font-black text-slate-400 uppercase'>
                    Today's In/Out
                  </p>
                  <p className='text-lg font-black text-teal-600'>
                    +{selectedItem.inbound_qty || 0} / -
                    {selectedItem.outbound_qty || 0}
                  </p>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <button
                  disabled={processing}
                  onClick={() => handleTransaction("in")}
                  className='bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest transition-all shadow-lg shadow-emerald-100'
                >
                  Inbound
                </button>
                <button
                  disabled={processing}
                  onClick={() => handleTransaction("out")}
                  className='bg-rose-500 hover:bg-rose-600 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest transition-all shadow-lg shadow-rose-100'
                >
                  Outbound
                </button>
              </div>

              {items.length > 1 && (
                <button
                  onClick={() => setSelectedItem(null)}
                  className='w-full mt-6 text-[10px] font-black text-slate-400 uppercase hover:text-teal-600 transition-colors'
                >
                  ← Switch to another item
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemAction;
