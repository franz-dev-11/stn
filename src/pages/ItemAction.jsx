import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  Layers,
  ChevronRight,
  Calendar,
} from "lucide-react";

const ItemAction = ({ po_number, setCurrentPage }) => {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [batchDate, setBatchDate] = useState(null);
  const [currentStock, setCurrentStock] = useState(
    typeof po_number === "object" && po_number !== null && po_number.stock != null
      ? po_number.stock
      : null,
  );
  const [productName, setProductName] = useState(""); // State for joined product name

  const isObject = typeof po_number === "object" && po_number !== null;
  const batchRef = isObject ? po_number.number : po_number;

  // batch_number format is "${orderNumber}-${productId}" where productId is UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let orderNumber = batchRef;
  let productId = null;
  
  // Try to parse batchRef as "orderNumber-uuid"
  const parts = batchRef.split('-');
  if (parts.length >= 5) {
    const potentialUuid = parts.slice(-5).join('-');
    if (uuidRegex.test(potentialUuid)) {
      orderNumber = parts.slice(0, -5).join('-');
      productId = potentialUuid;
    }
  }

  useEffect(() => {
    if (isObject && po_number.name) {
      setProductName(po_number.name);
    }
  }, [isObject, po_number]);

  useEffect(() => {
    const fetchData = async () => {
      if (!batchRef) {
        return;
      }

      let itemsRes;
      try {
        // 1. Fetch Items in this PO from order_scheduling
        //    Filter to the specific product if productId is present
        let itemsRequest = supabase
          .from("order_scheduling")
          .select("*")
          .eq("po_number", orderNumber);
        if (productId) {
          itemsRequest = itemsRequest.eq("product_id", productId);
        }

        // 2. Try to get receipt date from inventory_batches
        const batchRequest = supabase
          .from("inventory_batches")
          .select("batch_date, current_stock, product_id")
          .eq("batch_number", batchRef)
          .maybeSingle();

        // 3. If we have productId but no productName, fetch from products table
        let productRequest = null;
        if (productId && !productName) {
          productRequest = supabase
            .from("products")
            .select("name")
            .eq("id", productId)
            .maybeSingle();
        }

        const promises = [itemsRequest, batchRequest];
        if (productRequest) promises.push(productRequest);

        let batchRes, productRes;
        [itemsRes, batchRes, productRes] = await Promise.all(promises);

        if (productRes?.data?.name) {
          setProductName(productRes.data.name);
        }

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
        if (batchRes.data?.current_stock != null) {
          setCurrentStock(batchRes.data.current_stock);
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
  }, [batchRef, orderNumber, productId, productName]);

  const qrUrl = `${window.location.origin}/batch/${batchRef}`;

  return (
    <div className='min-h-screen bg-slate-50 flex items-center justify-center p-4'>
      {/* Print-specific Styles */}
      <style>
        {`
          @page { size: A6 portrait; margin: 0; }
          @media print {
            body { background: white !important; margin: 0 !important; }
            body * { visibility: hidden !important; }
            .print-area, .print-area * { visibility: visible !important; }
            .no-print { display: none !important; }
            .print-area {
              position: fixed !important;
              left: 0 !important; top: 0 !important;
              width: 105mm !important; height: 148mm !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              border: none !important; box-shadow: none !important;
              margin: 0 !important; padding: 0 !important;
              border-radius: 0 !important;
            }
            .printable-card {
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              width: 105mm !important;
              height: 148mm !important;
            }
            .print-hide { display: none !important; }
          }
        `}
      </style>

      <div className='bg-white p-8 rounded-3xl shadow-xl w-full max-w-md relative overflow-hidden print-area'>
        <div className='flex justify-between items-center mb-6 no-print'>
          <button
            onClick={() => setCurrentPage("Inventory")}
            className='text-slate-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:text-black'
          >
            <ArrowLeft size={16} /> Back
          </button>
        </div>

        {/* --- PRINTABLE SECTION --- */}
        <div className='printable-card'>
          <div className='flex justify-center'>
            <QRCodeSVG
              value={qrUrl}
              size={220}
              level='H'
              includeMargin={true}
            />
          </div>

          <div className='print-hide space-y-1 text-center mt-6'>
            <p className='text-[10px] font-black text-teal-600 uppercase tracking-[0.2em]'>
              {productName || "Batch Record"}
            </p>
            <h1 className='text-3xl font-black text-slate-900 tracking-tight uppercase'>
              {batchRef}
            </h1>
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
                <div className='mt-3 flex items-center gap-4'>
                  <div className='flex items-center gap-2'>
                    <span className='text-[10px] font-black text-slate-400 uppercase tracking-widest'>Order Qty:</span>
                    <span className='text-sm font-black text-white'>{selectedItem.quantity ?? "—"}</span>
                  </div>
                  {currentStock != null && (
                    <div className='flex items-center gap-2'>
                      <span className='text-[10px] font-black text-slate-400 uppercase tracking-widest'>Stock Qty:</span>
                      <span className='text-sm font-black text-emerald-400'>{currentStock}</span>
                    </div>
                  )}
                </div>
              </div>


            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemAction;
