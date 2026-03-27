import React from "react";
import { ChevronLeft, Printer, CheckCircle, Package } from "lucide-react";

const SalesInvoiceView = ({ transaction, onBack }) => {
  if (!transaction) return null;

  return (
    <div className='w-full min-h-screen p-8 bg-white text-slate-900 animate-in fade-in duration-500'>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none; }
        }
      `}</style>

      <div className='max-w-3xl mx-auto'>
        <button
          onClick={onBack}
          className='no-print flex items-center gap-2 mb-8 font-black uppercase text-xs text-slate-400 hover:text-black transition-colors'
        >
          <ChevronLeft size={18} /> New Transaction
        </button>

        <div className='print-area rounded-[2.5rem] overflow-hidden shadow-2xl'>
          {/* Header */}
          <div className='bg-black text-white p-10 flex justify-between items-end'>
            <div>
              <div className='flex items-center gap-3 mb-4'>
                <CheckCircle className='text-green-400' size={32} />
                <h1 className='text-4xl font-black uppercase italic tracking-tighter'>
                  Sales Invoice
                </h1>
              </div>
              <p className='text-xs font-bold opacity-60 uppercase tracking-widest'>
                No: {transaction.invoiceNo}
              </p>
            </div>
            <div className='text-right no-print'>
              <button
                onClick={() => window.print()}
                className='bg-white text-black px-6 py-3 rounded-xl font-black uppercase text-[10px] flex items-center gap-2 hover:bg-slate-200'
              >
                <Printer size={16} /> Print Receipt
              </button>
            </div>
          </div>

          <div className='p-10 bg-white'>
            <div className='grid grid-cols-2 gap-8 mb-12'>
              <div>
                <h4 className='text-[10px] font-black text-slate-400 uppercase mb-1'>
                  Billed To:
                </h4>
                <p className='text-xl font-black uppercase'>
                  {transaction.customer}
                </p>
              </div>
              <div className='text-right'>
                <h4 className='text-[10px] font-black text-slate-400 uppercase mb-1'>
                  Date Issued:
                </h4>
                <p className='text-xl font-black uppercase'>
                  {transaction.date}
                </p>
              </div>
            </div>

            <table className='w-full mb-12'>
              <thead>
                <tr className='bg-black text-white text-[10px] font-black uppercase'>
                  <th className='px-4 py-3'>Description</th>
                  <th className='px-4 py-3 text-center'>Qty</th>
                  <th className='px-4 py-3 text-right'>Unit Price</th>
                  <th className='px-4 py-3 text-right'>Total</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-100'>
                {transaction.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className='py-5'>
                      <p className='font-black uppercase text-sm'>
                        {item.title}
                      </p>
                      <p className='text-[10px] font-bold text-slate-400 uppercase italic'>
                        Batch: {item.batchNo}
                      </p>
                    </td>
                    <td className='py-5 text-center font-black'>{item.qty}</td>
                    <td className='py-5 text-right font-bold text-slate-600'>
                      ₱{item.price.toLocaleString()}
                    </td>
                    <td className='py-5 text-right font-black text-lg'>
                      ₱{item.subtotal.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className='flex justify-end pt-8'>
              <div className='text-right'>
                <p className='text-[10px] font-black text-slate-400 uppercase mb-1'>
                  Grand Total Amount
                </p>
                <p className='text-5xl font-black italic text-teal-600'>
                  ₱{transaction.totalAmount.toLocaleString()}
                </p>
              </div>
            </div>

            <div className='mt-16 pt-8 text-center'>
              <p className='text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]'>
                *** Thank you for your business ***
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesInvoiceView;
