import React, { useState } from "react";
import { Package, Calendar, Minus, Plus } from "lucide-react";

const ProductCard = ({ item, onAdd }) => {
  const [selectedBatchId, setSelectedBatchId] = useState(
    item.batches?.[0]?.id || "",
  );
  const [qty, setQty] = useState(1);

  const selectedBatch = item.batches?.find((b) => b.id === selectedBatchId);
  const outOfStock = !selectedBatch || selectedBatch.current_stock <= 0;

  return (
    <div
      className={`bg-white rounded-3xl p-6 border-2 transition-all flex flex-col 
      ${
        outOfStock
          ? "border-slate-200 opacity-60"
          : "border-slate-300 hover:border-black"
      } 
      forced-colors:border-[CanvasText]`}
    >
      <div className='flex justify-between items-start mb-4'>
        <div className='p-3 bg-slate-100 rounded-2xl'>
          <Package size={20} className='text-slate-900' />
        </div>
        <div className='text-right'>
          <p className='text-[10px] font-black text-slate-500 uppercase'>
            Total Stock
          </p>
          <p className='font-black text-sm text-slate-900'>
            {item.stock_balance} {item.unit}
          </p>
        </div>
      </div>

      <h3 className='font-black uppercase text-sm mb-1 h-10 line-clamp-2 text-slate-900'>
        {item.name}
      </h3>
      <p className='text-[10px] font-mono font-bold text-teal-700 mb-4 italic'>
        SKU: {item.sku}
      </p>
      <p className='text-2xl font-black mb-6 text-slate-900'>
        ₱{item.displayPrice.toLocaleString()}
      </p>

      <div className='mb-4'>
        <label className='text-[9px] font-black text-slate-500 uppercase flex items-center gap-1 mb-1'>
          <Calendar size={10} /> Choose Batch
        </label>
        <select
          disabled={outOfStock}
          className='w-full p-3 bg-slate-50 rounded-xl font-bold text-[11px] uppercase border-2 border-slate-200 focus:border-black text-slate-900'
          value={selectedBatchId}
          onChange={(e) => {
            setSelectedBatchId(e.target.value);
            setQty(1);
          }}
        >
          {item.batches?.length > 0 ? (
            item.batches.map((b) => (
              <option key={b.id} value={b.id}>
                {new Date(b.batch_date).toLocaleDateString()} — {b.batch_number}{" "}
                ({b.current_stock} left)
              </option>
            ))
          ) : (
            <option>No available batches</option>
          )}
        </select>
      </div>

      <div className='flex gap-2 mb-6'>
        <div className='flex flex-1 rounded-xl overflow-hidden h-12'>
          <button
            onClick={() => setQty(Math.max(1, qty - 1))}
            className='px-4 bg-slate-50 text-slate-900 hover:bg-slate-100'
          >
            <Minus size={14} />
          </button>
          <input
            readOnly
            value={qty}
            className='w-full text-center font-black bg-white text-slate-900'
          />
          <button
            onClick={() =>
              setQty(Math.min(selectedBatch?.current_stock || 1, qty + 1))
            }
            className='px-4 bg-slate-50 text-slate-900 hover:bg-slate-100'
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <button
        disabled={outOfStock}
        onClick={() =>
          onAdd({
            batchId: selectedBatch.id,
            productId: item.id,
            batchNo: selectedBatch.batch_number,
            title: item.name,
            qty,
            maxBatchStock: selectedBatch.current_stock,
            price: item.displayPrice,
            subtotal: qty * item.displayPrice,
          })
        }
        className='w-full bg-black text-white py-4 rounded-2xl text-[10px] font-black uppercase disabled:bg-slate-300 forced-colors:bg-[ButtonText]'
      >
        {outOfStock ? "Out of Stock" : "Add to Order"}
      </button>
    </div>
  );
};

export default ProductCard;
