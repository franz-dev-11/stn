import React from "react";
import { X, Trash2, ShoppingCart } from "lucide-react";

const CartDrawer = ({ isOpen, onClose, cart, setCart, setView }) => {
  if (!isOpen) return null;

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className='fixed inset-0 z-50 overflow-hidden'>
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-black/50 backdrop-blur-sm forced-colors:bg-[Canvas] forced-colors:opacity-80'
        onClick={onClose}
      />

      <div className='absolute inset-y-0 right-0 max-w-full flex'>
        <div className='w-screen max-w-md bg-white shadow-2xl flex flex-col'>
          <div className='p-6 flex justify-between items-center text-slate-900'>
            <h2 className='text-2xl font-black uppercase flex items-center gap-2'>
              <ShoppingCart size={24} /> Cart Items
            </h2>
            <button
              onClick={onClose}
              className='p-2 hover:bg-slate-100 rounded-full forced-colors:border forced-colors:border-[ButtonText]'
            >
              <X size={24} />
            </button>
          </div>

          <div className='flex-1 overflow-y-auto p-6 space-y-4 bg-white'>
            {cart.length === 0 ? (
              <p className='text-center text-slate-500 font-bold uppercase py-10'>
                Cart is empty
              </p>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className='flex justify-between items-center p-4 bg-slate-50 rounded-2xl text-slate-900 forced-colors:border-[ButtonText]'
                >
                  <div className='flex-1'>
                    <h4 className='font-black text-xs uppercase'>
                      {item.name}
                    </h4>
                    <p className='text-[10px] font-bold italic text-teal-700'>
                      SKU: {item.sku}
                    </p>
                    <p className='text-sm font-black mt-1'>
                      {item.quantity} x ₱{item.price.toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className='text-red-500 hover:bg-red-50 p-2 rounded-lg forced-colors:text-[Highlight]'
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className='p-6'>
            <div className='mb-4 p-4 bg-slate-50 rounded-2xl'>
              <p className='text-xs font-black text-slate-500 uppercase mb-1'>
                Subtotal
              </p>
              <p className='text-2xl font-black text-slate-900'>
                ₱
                {cart
                  .reduce((sum, item) => sum + item.price * item.quantity, 0)
                  .toLocaleString()}
              </p>
            </div>
            <button
              disabled={cart.length === 0}
              onClick={() => {
                setView("checkout");
                onClose();
              }}
              className='w-full bg-black text-white py-4 rounded-2xl font-black uppercase disabled:bg-slate-300 text-sm'
            >
              Proceed to Quotations
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartDrawer;
