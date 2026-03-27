import React, { useState } from "react";
import { Package, Plus, Minus } from "lucide-react";

const ItemCard = ({ item, onAdd }) => {
  const [qty, setQty] = useState(1);

  return (
    <div className='bg-white rounded-3xl p-6 border-2 border-slate-100 transition-all flex flex-col hover:shadow-xl hover:border-teal-500 forced-colors:border-[CanvasText]'>
      <div className='flex justify-between items-start mb-4'>
        <div className='p-3 bg-slate-100 rounded-2xl'>
          <Package size={20} className='text-slate-900' />
        </div>
        <div className='text-right'>
          <p className='text-[10px] font-black text-slate-500 uppercase'>
            Total Stock
          </p>
          <p className='font-black text-sm text-slate-900'>
            {item.stock_balance || 0}
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
        ₱{item.price.toLocaleString()}
      </p>

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
            onClick={() => setQty(qty + 1)}
            className='px-4 bg-slate-50 text-slate-900 hover:bg-slate-100'
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <button
        onClick={() => onAdd(item, qty)}
        className='w-full bg-black text-white py-4 rounded-2xl text-[10px] font-black uppercase transition-all shadow-sm active:scale-95 hover:bg-teal-600 forced-colors:bg-[ButtonText]'
      >
        Add to Cart
      </button>
    </div>
  );
};

export default ItemCard;
