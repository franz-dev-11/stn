import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { Package, Calendar, Layers } from "lucide-react";

const BatchRecord = () => {
  const { batchRef } = useParams();
  const [items, setItems] = useState([]);
  const [batchDate, setBatchDate] = useState(null);
  const [currentStock, setCurrentStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // batch_number format is "${orderNumber}-${productId}" (UUID = 36 chars)
  const uuidSuffixRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const hasUuidSuffix = batchRef && batchRef.length > 37 && uuidSuffixRegex.test(batchRef.slice(-36));
  const orderNumber = hasUuidSuffix ? batchRef.slice(0, -37) : batchRef;
  const productId = hasUuidSuffix ? batchRef.slice(-36) : null;

  useEffect(() => {
    const fetchBatch = async () => {
      try {
        let itemsQuery = supabase
          .from("order_scheduling")
          .select("*")
          .eq("order_number", orderNumber);
        if (productId) {
          itemsQuery = itemsQuery.eq("product_id", productId);
        }
        const itemsRes = await itemsQuery;

        const fetchedItems = itemsRes.data || [];
        setItems(fetchedItems);

        // Try inventory_batches — ignore errors (row may not exist yet)
        const batchRes = await supabase
          .from("inventory_batches")
          .select("batch_date, current_stock")
          .eq("batch_number", batchRef)
          .maybeSingle();

        if (batchRes.data?.batch_date) {
          setBatchDate(batchRes.data.batch_date);
        } else if (fetchedItems.length > 0) {
          setBatchDate(fetchedItems[0].date_arrived);
        }

        if (batchRes.data?.current_stock != null) {
          setCurrentStock(batchRes.data.current_stock);
        }

        if (fetchedItems.length === 0) {
          setNotFound(true);
        }
      } catch (err) {
        console.error("BatchRecord fetch error:", err.message);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    if (batchRef) fetchBatch();
  }, [batchRef]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Loading...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <Package size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-black uppercase text-slate-500">Batch not found</p>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase">{batchRef}</p>
        </div>
      </div>
    );
  }

  const supplier = items[0]?.supplier || "—";
  const status = items[0]?.status || "—";

  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-8 py-8">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-400 mb-1">
            Batch Record
          </p>
          <h1 className="text-2xl font-black uppercase tracking-tight">{batchRef}</h1>
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${
                status === "Arrived"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : status === "In Transit"
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-amber-500/20 text-amber-400"
              }`}
            >
              {status}
            </span>
          </div>
        </div>

        <div className="px-8 py-6 space-y-5">
          {/* Received Date */}
          <div className="flex items-start gap-3">
            <Calendar size={16} className="text-teal-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Received Date
              </p>
              <p className="text-sm font-black text-slate-800 uppercase mt-0.5">
                {formatDate(batchDate)}
              </p>
            </div>
          </div>

          {/* Supplier */}
          <div className="flex items-start gap-3">
            <Package size={16} className="text-teal-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Supplier
              </p>
              <p className="text-sm font-black text-slate-800 uppercase mt-0.5">{supplier}</p>
            </div>
          </div>

          {/* Item Name */}
          <div className="flex items-start gap-3">
            <Layers size={16} className="text-teal-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Item Name
              </p>
              <p className="text-sm font-black text-slate-800 uppercase mt-0.5">
                {items[0]?.item_name || "—"}
              </p>
            </div>
          </div>

          {/* Order Qty & Stock Quantity */}
          <div className="flex gap-4">
            {items[0]?.quantity != null && (
              <div className="flex-1 bg-slate-50 rounded-2xl px-4 py-3">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  Order Qty
                </p>
                <p className="text-xl font-black text-slate-800 mt-0.5">
                  {items[0].quantity}
                </p>
              </div>
            )}
            {currentStock != null && (
              <div className="flex-1 bg-emerald-50 rounded-2xl px-4 py-3">
                <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">
                  Stock Qty
                </p>
                <p className="text-xl font-black text-emerald-600 mt-0.5">
                  {currentStock}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="px-8 pb-6 text-center">
          <p className="text-[9px] font-black uppercase text-slate-300 tracking-[0.2em]">
            STN Inventory System
          </p>
        </div>
      </div>
    </div>
  );
};

export default BatchRecord;
