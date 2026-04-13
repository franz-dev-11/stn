import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { Package, Calendar, Layers, CheckCircle } from "lucide-react";

const BatchRecord = () => {
  const { batchRef } = useParams();
  const [items, setItems] = useState([]);
  const [batchDate, setBatchDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchBatch = async () => {
      try {
        const [itemsRes, batchRes] = await Promise.all([
          supabase
            .from("order_scheduling")
            .select("*")
            .eq("order_number", batchRef),
          supabase
            .from("inventory_batches")
            .select("batch_date, current_stock")
            .eq("batch_number", batchRef)
            .single(),
        ]);

        const fetchedItems = itemsRes.data || [];
        setItems(fetchedItems);

        if (batchRes.data?.batch_date) {
          setBatchDate(batchRes.data.batch_date);
        } else if (fetchedItems.length > 0) {
          setBatchDate(fetchedItems[0].date_arrived);
        }

        if (fetchedItems.length === 0 && !batchRes.data) {
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

          {/* Items */}
          <div className="flex items-start gap-3">
            <Layers size={16} className="text-teal-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">
                Items ({items.length})
              </p>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center bg-slate-50 rounded-xl px-3 py-2"
                  >
                    <div>
                      <p className="text-xs font-black uppercase text-slate-800">
                        {item.item_name}
                      </p>
                      {item.date_arrived && (
                        <p className="text-[9px] font-bold text-slate-400 uppercase">
                          Arrived: {formatDate(item.date_arrived)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle size={12} className="text-teal-500" />
                      <span className="text-xs font-black text-slate-700">{item.quantity}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
