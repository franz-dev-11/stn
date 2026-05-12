import React, { useMemo } from "react";
import { ChevronLeft, Tag, Printer, Mail, CheckCircle } from "lucide-react";
import { insertAuditTrail, getSessionUser, getPerformedBy } from "../../utils/auditTrail";
import { printElement } from "../../utils/printUtils";

const CheckoutView = ({
  groupedOrders,
  suppliers,
  setView,
  cart,
  handleCompleteTransaction,
  isCompleting,
}) => {
  const quoteIds = useMemo(() => {
    return Object.fromEntries(
      Object.keys(groupedOrders).map((supplierName, index) => [
        supplierName,
        `QTN-${String(index + 1).padStart(4, "0")}`,
      ]),
    );
  }, [groupedOrders]);

  const handleGmailSend = (supplierName, items) => {
    const supplierObj = suppliers.find((s) => s.name === supplierName);
    const email = supplierObj?.email || "";
    const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const subject = encodeURIComponent(`Inquiry: Receipt from ${supplierName}`);
    const body = encodeURIComponent(
      `Dear ${supplierName}\n\n` +
      `I hope you are having a productive week.\n\n` +
      `We would like to proceed with the purchase of the following items. Please find the details of our order below based on the quoted total of ₱${totalAmount.toLocaleString()}\n` +
      `Regarding Receipt items:\n\n` +
      items.map((i) => `• ${i.name} (${i.quantity})`).join("\n") +
      `\nTotal Amount: ₱${totalAmount.toLocaleString()}\n\n` +
      `For further information, please see the breakdown of our requirements in the attached file.`
    );
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`,
      "_blank",
    );
    const sessionUser = getSessionUser();
    insertAuditTrail([{
      action: "EMAIL_SUPPLIER",
      supplier: supplierName,
      performed_by: getPerformedBy(sessionUser),
      total_amount: totalAmount,
      item_name: items.map((i) => i.name).join(", "),
      quantity: items.reduce((s, i) => s + i.quantity, 0),
    }]);
  };

  return (
    <div className='w-full min-h-screen p-8 bg-white text-slate-900'>
      <div className='max-w-4xl mx-auto'>
        <button
          onClick={() => setView("browse")}
          className='no-print flex items-center gap-2 mb-6 font-bold text-slate-500 hover:text-black transition-colors'
        >
          <ChevronLeft size={20} /> Return to Browse
        </button>

        {/* Transaction Header Summary */}
        <div className='mb-8 p-6 bg-slate-50 rounded-2xl no-print'>
          <h3 className='text-sm font-black uppercase mb-4 text-slate-400 text-center'>
            Checkout Overview
          </h3>
          <div className='flex justify-between items-center'>
            <div>
              <p className='text-2xl font-black'>
                {Object.keys(groupedOrders).length} Vendor Batches
              </p>
              <p className='text-xs font-bold text-slate-500 italic'>
                Individual POs will be created for each supplier.
              </p>
            </div>
            <div className='text-right'>
              <p className='text-2xl font-black text-teal-600'>
                ₱
                {cart
                  .reduce((sum, i) => sum + i.price * i.quantity, 0)
                  .toLocaleString()}
              </p>
              <p className='text-xs font-bold text-slate-500 uppercase'>
                Grand Total
              </p>
            </div>
          </div>
        </div>

        {/* Individual Quotations per Supplier */}
        {Object.keys(groupedOrders).length === 0 && (
          <div className='mb-8 bg-white rounded-2xl p-10 text-center'>
            <p className='text-xs font-black uppercase text-slate-500'>
              No supplier batches yet
            </p>
            <p className='text-[10px] font-bold text-slate-400 mt-2 uppercase'>
              Add items to cart first before finalizing orders.
            </p>
          </div>
        )}

        {Object.entries(groupedOrders).map(([supName, items], idx) => {
          const vendorInfo = suppliers.find((s) => s.name === supName);

          return (
            <div
              key={supName}
              id={`quote-${idx}`}
              className='print-this-only mb-12 rounded-2xl overflow-hidden shadow-sm'
            >
              {/* Toolbar */}
              <div className='bg-black text-white p-4 flex justify-between items-center no-print'>
                <h2 className='font-black uppercase tracking-widest text-sm flex items-center gap-2'>
                  <Tag size={16} /> {supName}
                </h2>
                <div className='flex gap-2'>
                  <button
                    type='button'
                    onClick={() => printElement(document.getElementById(`quote-${idx}`))}
                    className='bg-white text-black px-3 py-1.5 rounded-lg text-[10px] font-black hover:bg-slate-200 flex items-center gap-2'
                  >
                    <Printer size={14} /> Print PO
                  </button>
                  <button
                    onClick={() => handleGmailSend(supName, items)}
                    className='bg-[#ea4335] px-3 py-1.5 rounded-lg text-[10px] font-black text-white flex items-center gap-2'
                  >
                    <Mail size={14} /> Send Email
                  </button>
                </div>
              </div>

              {/* Printable Area */}
              <div className='p-8 bg-white'>
                <div className='flex justify-between items-start pb-4 mb-6'>
                  <div>
                    <h1 className='text-4xl font-black uppercase italic leading-none'>
                      Purchase Order
                    </h1>
                    <p className='text-xs font-bold text-slate-500 mt-2'>
                      {items.length} Item{items.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className='text-right'>
                    <p className='text-lg font-black uppercase tracking-widest'>
                      {quoteIds[supName] || "QTN-0000"}
                    </p>
                    <p className='text-sm font-black uppercase mt-1'>
                      Date: {new Date().toLocaleDateString()}
                    </p>
                    <p className='text-[10px] font-bold text-slate-400 uppercase'>
                      Procurement Dept
                    </p>
                  </div>
                </div>

                {/* Vendor Contact Details */}
                <div className='grid grid-cols-2 gap-8 mb-8'>
                  <div>
                    <h4 className='text-[10px] font-black text-slate-400 uppercase mb-1'>
                      To Vendor:
                    </h4>
                    <p className='text-sm font-black uppercase'>{supName}</p>
                    <p className='text-xs font-medium text-slate-600'>
                      {vendorInfo?.address || "No Address Provided"}
                    </p>
                    <p className='text-xs font-medium text-slate-600'>
                      {vendorInfo?.email || "No Email Provided"}
                    </p>
                  </div>
                </div>

                {/* Itemized Table */}
                <table className='w-full text-left'>
                  <thead>
                    <tr className='bg-black text-white text-[10px] font-black uppercase'>
                      <th className='px-4 py-3'>SKU</th>
                      <th className='px-4 py-3'>Description</th>
                      <th className='px-4 py-3 text-center'>Qty</th>
                      <th className='px-4 py-3 text-center'>Unit</th>
                      <th className='px-4 py-3 text-right'>Unit Price</th>
                      <th className='px-4 py-3 text-right'>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id}>
                        <td className='py-3 px-1 text-[10px] font-mono font-bold text-slate-400'>
                          #{i.sku}
                        </td>
                        <td className='py-3 text-sm font-black uppercase'>
                          {i.name}
                        </td>
                        <td className='py-3 text-center font-black'>
                          {i.quantity}
                        </td>
                        <td className='py-3 text-center text-xs font-bold text-slate-500 uppercase'>
                          {i.unit}
                        </td>
                        <td className='py-3 text-right text-sm font-bold'>
                          ₱{i.price.toLocaleString()}
                        </td>
                        <td className='py-3 text-right text-sm font-black'>
                          ₱{(i.price * i.quantity).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td
                        colSpan='5'
                        className='py-4 text-right text-xs font-black uppercase'
                      >
                        Vendor Total:
                      </td>
                      <td className='py-4 text-right text-lg font-black underline decoration-2 decoration-teal-500'>
                        ₱
                        {items
                          .reduce((sum, i) => sum + i.price * i.quantity, 0)
                          .toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                <div className='mt-12 pt-8'>
                  <p className='text-[10px] font-bold text-slate-400 uppercase italic'>
                    Note: This is an automatically generated purchase request.
                    Please confirm availability and pricing.
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        <button
          onClick={handleCompleteTransaction}
          disabled={isCompleting}
          className='w-full bg-black text-white py-6 rounded-2xl font-black uppercase tracking-widest no-print mt-4 shadow-xl flex items-center justify-center gap-3 hover:bg-teal-600 transition-colors disabled:opacity-50'
        >
          <CheckCircle />
          {isCompleting
            ? "Finalizing Orders..."
            : "Finalize Orders & Update Inventory"}
        </button>
      </div>
    </div>
  );
};

export default CheckoutView;
