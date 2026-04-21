import React, { useState } from "react";
import { Package, Plus, Minus, Trash2 } from "lucide-react";

const ItemCard = ({ item, onAdd, onDelete }) => {
  const [qty, setQty] = useState(1);

  return (
    <div className='bg-white rounded-3xl p-6 border-2 border-slate-100 transition-all flex flex-col hover:shadow-xl hover:border-teal-500 forced-colors:border-[CanvasText]'>
      <div className='flex justify-between items-start mb-4'>
        <div className='p-3 bg-slate-100 rounded-2xl'>
          <Package size={20} className='text-slate-900' />
        </div>
        <div className='flex items-center gap-2'>
          <div className='text-right'>
            <p className='text-[10px] font-black text-slate-500 uppercase'>
              Total Stock
            </p>
            <p className='font-black text-sm text-slate-900'>
              {item.stock_balance || 0}
            </p>
          </div>
          {onDelete && (
            <button
              onClick={() => {
                if (confirm(`Delete "${item.name}"?`)) {
                  onDelete(item.id);
                }
              }}
              className='text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all'
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      <h3 className='font-black uppercase text-sm mb-1 h-10 line-clamp-2 text-slate-900'>
        {item.name}
      </h3>
      <p className='text-[10px] font-mono font-bold text-teal-700 mb-4 italic'>
        SKU: {item.sku}
      </p>
      <p className='text-2xl font-black mb-6 text-slate-900'>
        ₱{
          (item.price !== undefined && item.price !== null && !isNaN(Number(item.price)))
            ? Number(item.price).toLocaleString()
            : '0'
        }
      </p>

      {/* Subtotal preview for qty > 1 */}
      {qty > 1 && (
        <p className='text-xs font-bold text-slate-600 mb-2'>
          Subtotal: ₱{
            (() => {
              const price = Number(item.price);
              const quantity = Number(qty);
              if (
                item.price !== undefined &&
                item.price !== null &&
                !isNaN(price) &&
                !isNaN(quantity)
              ) {
                return (price * quantity).toLocaleString();
              }
              return '0';
            })()
          }
        </p>
      )}

      <div className='flex gap-2 mb-6'>
        <div className='flex flex-1 rounded-xl overflow-hidden h-12'>
          <button
            onClick={() => setQty(Math.max(1, qty - 1))}
            className='px-4 bg-slate-50 text-slate-900 hover:bg-slate-100'
          >
            <Minus size={14} />
          </button>
          <input
            type='number'
            min='1'
            value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            className='w-full text-center font-black bg-white text-slate-900 outline-none focus:bg-yellow-50'
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
