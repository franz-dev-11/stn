import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import {
  Printer,
  ChevronDown,
  ChevronUp,
  History,
  Search,
  XCircle,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  Tag,
  Mail,
} from "lucide-react";

const PurchaseHistory = () => {
  const [batches, setBatches] = useState([]);
  const [suppliers, setSuppliers] = useState([]); // Added to fetch vendor details
  const [expandedBatch, setExpandedBatch] = useState(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchData = async () => {
      // Fetch Batches
      const { data: batchData, error: batchError } = await supabase
        .from("inventory_batches")
        .select(
          `
          *,
          hardware_inventory (
            name,
            sku,
            unit,
            supplier
          )
        `,
        )
        .order("batch_date", { ascending: false });

      // Fetch Suppliers for contact info
      const { data: supData } = await supabase.from("suppliers").select("*");

      if (batchError) console.error("Error fetching data:", batchError);
      setBatches(batchData || []);
      setSuppliers(supData || []);
    };
    fetchData();
  }, []);

  // Filtering & Pagination Logic
  const filteredBatches = batches.filter((batch) => {
    const itemName = batch.hardware_inventory?.name || "";
    const vendorName = batch.hardware_inventory?.supplier || "";
    const matchesSearch =
      batch.batch_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendorName.toLowerCase().includes(searchTerm.toLowerCase());

    const batchDate = new Date(batch.batch_date).toISOString().split("T")[0];
    const matchesStart = !startDate || batchDate >= startDate;
    const matchesEnd = !endDate || batchDate <= endDate;

    return matchesSearch && matchesStart && matchesEnd;
  });

  const currentItems = filteredBatches.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );
  const totalPages = Math.ceil(filteredBatches.length / itemsPerPage);

  const handleGmailSend = (batch) => {
    const vendor = suppliers.find(
      (s) => s.name === batch.hardware_inventory?.supplier,
    );
    const email = vendor?.email || "";
    const subject = encodeURIComponent(`Inquiry: Batch ${batch.batch_number}`);
    const body = encodeURIComponent(
      `Regarding Item: ${batch.hardware_inventory?.name} (${batch.hardware_inventory?.sku})\nQuantity: ${batch.current_stock}`,
    );
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`,
      "_blank",
    );
  };

  return (
    <div className='p-8 bg-[#f3f4f6] min-h-screen text-black print:bg-white print:p-0'>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; border: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className='max-w-5xl mx-auto'>
        <div className='flex justify-between items-end mb-8 no-print'>
          <div>
            <h1 className='text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3'>
              <History size={32} className='text-teal-600' /> PROCUREMENT
              HISTORY
            </h1>
            <p className='text-slate-600 font-bold text-xs uppercase tracking-[0.2em] mt-2'>
              Inbound Record Archive | Vendor Timeline
            </p>
          </div>
          <p className='text-slate-400 font-bold text-sm'>
            {filteredBatches.length} records
          </p>
        </div>

        {/* Filters */}
        <div className='bg-white p-6 rounded-2xl mb-8 shadow-sm no-print'>
          <div className='grid grid-cols-1 md:grid-cols-12 gap-6'>
            <div className='md:col-span-5'>
              <label className='block text-[10px] font-black uppercase text-slate-600 mb-2'>
                Search Records
              </label>
              <div className='relative'>
                <Search
                  className='absolute left-4 top-1/2 -translate-y-1/2 text-black'
                  size={18}
                />
                <input
                  type='text'
                  placeholder='Batch, Item, or Vendor...'
                  className='w-full pl-12 pr-4 py-3 rounded-lg outline-none font-black uppercase text-xs focus:bg-yellow-50 transition-all'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className='md:col-span-7'>
              <div className='flex justify-between items-center mb-2'>
                <label className='block text-[10px] font-black uppercase text-slate-600'>
                  Date Range
                </label>
                {(searchTerm || startDate || endDate) && (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setStartDate("");
                      setEndDate("");
                    }}
                    className='text-[10px] font-black uppercase text-red-500 flex items-center gap-1 hover:text-red-600'
                  >
                    <XCircle size={12} /> Clear
                  </button>
                )}
              </div>
              <div className='flex items-center gap-3'>
                <input
                  type='date'
                  className='flex-1 px-4 py-3 rounded-lg font-black uppercase text-xs outline-none focus:bg-yellow-50 transition-all'
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className='font-black text-slate-300 text-xs'>TO</span>
                <input
                  type='date'
                  className='flex-1 px-4 py-3 rounded-lg font-black uppercase text-xs outline-none focus:bg-yellow-50 transition-all'
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* List */}
        <div className='bg-white rounded-2xl overflow-hidden shadow-sm'>
          <table className='w-full text-left'>
            <thead>
              <tr className='bg-black text-white text-[10px] font-black uppercase'>
                <th className='px-6 py-4'>Date</th>
                <th className='px-6 py-4'>Batch #</th>
                <th className='px-6 py-4'>Vendor</th>
                <th className='px-6 py-4'>Item</th>
                <th className='px-6 py-4'>SKU</th>
                <th className='px-6 py-4 text-center'>Qty</th>
                <th className='px-6 py-4 text-right'>Unit Cost</th>
                <th className='px-6 py-4 text-right'>Total Value</th>
                <th className='px-6 py-4 text-right'>Actions</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-100'>
              {currentItems.length > 0 ? (
                currentItems.map((batch) => {
                  const vendor = suppliers.find(
                    (s) => s.name === batch.hardware_inventory?.supplier,
                  );
                  const isExpanded = expandedBatch === batch.id;
                  return (
                    <React.Fragment key={batch.id}>
                      <tr
                        onClick={() =>
                          setExpandedBatch(isExpanded ? null : batch.id)
                        }
                        className='hover:bg-slate-50 cursor-pointer transition-colors'
                      >
                        <td className='px-6 py-4 text-[10px] font-bold text-slate-500 whitespace-nowrap'>
                          {new Date(batch.batch_date).toLocaleDateString()}
                        </td>
                        <td className='px-6 py-4'>
                          <span className='font-mono font-black text-teal-700 text-sm'>
                            {batch.batch_number}
                          </span>
                        </td>
                        <td className='px-6 py-4 font-black uppercase text-xs'>
                          {batch.hardware_inventory?.supplier || "N/A"}
                        </td>
                        <td className='px-6 py-4 font-black uppercase text-xs max-w-[160px] truncate'>
                          {batch.hardware_inventory?.name}
                        </td>
                        <td className='px-6 py-4 font-mono text-[10px] text-slate-500'>
                          {batch.hardware_inventory?.sku}
                        </td>
                        <td className='px-6 py-4 text-center font-black'>
                          {batch.current_stock}{" "}
                          <span className='text-[10px] font-bold text-slate-400'>
                            {batch.hardware_inventory?.unit}
                          </span>
                        </td>
                        <td className='px-6 py-4 text-right font-bold text-sm'>
                          ₱{batch.unit_cost?.toLocaleString()}
                        </td>
                        <td className='px-6 py-4 text-right font-black text-sm'>
                          ₱
                          {(
                            batch.unit_cost * batch.current_stock
                          ).toLocaleString()}
                        </td>
                        <td className='px-6 py-4 text-right'>
                          <div className='flex justify-end'>
                            {isExpanded ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan='9' className='p-0 bg-slate-50'>
                            <div className='print-area'>
                              {/* Toolbar */}
                              <div className='bg-black text-white px-8 py-4 flex justify-between items-center no-print'>
                                <h2 className='font-black uppercase tracking-widest text-sm flex items-center gap-2'>
                                  <Tag size={16} />{" "}
                                  {batch.hardware_inventory?.supplier}
                                </h2>
                                <div className='flex gap-2'>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.print();
                                    }}
                                    className='bg-white text-black px-4 py-2 rounded-lg text-[10px] font-black flex items-center gap-2 hover:bg-slate-200 transition-all'
                                  >
                                    <Printer size={14} /> Print Record
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGmailSend(batch);
                                    }}
                                    className='bg-[#ea4335] px-4 py-2 rounded-lg text-[10px] font-black text-white flex items-center gap-2 hover:bg-[#d33c27] transition-all'
                                  >
                                    <Mail size={14} /> Email Vendor
                                  </button>
                                </div>
                              </div>
                              {/* Record Content */}
                              <div className='p-8 bg-white'>
                                <div className='flex justify-between items-start pb-4 mb-6 border-b-2 border-slate-200'>
                                  <div>
                                    <h1 className='text-4xl font-black uppercase italic leading-none'>
                                      Inbound Record
                                    </h1>
                                    <p className='text-xs font-bold text-slate-600 mt-2'>
                                      Ref Batch: {batch.batch_number}
                                    </p>
                                  </div>
                                  <div className='text-right'>
                                    <p className='text-sm font-black uppercase'>
                                      Date:{" "}
                                      {new Date(
                                        batch.batch_date,
                                      ).toLocaleDateString()}
                                    </p>
                                    <p className='text-[10px] font-bold text-slate-600 uppercase'>
                                      Inventory History
                                    </p>
                                  </div>
                                </div>
                                <div className='grid grid-cols-2 gap-8 mb-8'>
                                  <div>
                                    <h4 className='text-[10px] font-black text-slate-600 uppercase mb-1'>
                                      Source Vendor:
                                    </h4>
                                    <p className='text-sm font-black uppercase'>
                                      {batch.hardware_inventory?.supplier}
                                    </p>
                                    <p className='text-xs font-medium text-slate-600'>
                                      {vendor?.address || "Address not listed"}
                                    </p>
                                    <p className='text-xs font-medium text-slate-600'>
                                      {vendor?.email || "Email not listed"}
                                    </p>
                                  </div>
                                </div>
                                <table className='w-full text-left mb-6'>
                                  <thead>
                                    <tr className='bg-black text-white text-[10px] uppercase font-black'>
                                      <th className='py-3'>SKU</th>
                                      <th className='py-3'>Description</th>
                                      <th className='py-3 text-center'>
                                        Qty Received
                                      </th>
                                      <th className='py-3 text-center'>Unit</th>
                                      <th className='py-3 text-right'>
                                        Unit Cost
                                      </th>
                                      <th className='py-3 text-right'>
                                        Total Value
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr className='border-b border-slate-100'>
                                      <td className='py-4 text-[10px] font-mono font-bold text-slate-600'>
                                        #{batch.hardware_inventory?.sku}
                                      </td>
                                      <td className='py-4 text-sm font-black uppercase'>
                                        {batch.hardware_inventory?.name}
                                      </td>
                                      <td className='py-4 text-center font-black'>
                                        {batch.current_stock}
                                      </td>
                                      <td className='py-4 text-center text-xs font-bold text-slate-600 uppercase'>
                                        {batch.hardware_inventory?.unit}
                                      </td>
                                      <td className='py-4 text-right text-sm font-bold'>
                                        ₱{batch.unit_cost?.toLocaleString()}
                                      </td>
                                      <td className='py-4 text-right text-sm font-black'>
                                        ₱
                                        {(
                                          batch.unit_cost * batch.current_stock
                                        ).toLocaleString()}
                                      </td>
                                    </tr>
                                  </tbody>
                                  <tfoot>
                                    <tr className='border-t-2 border-slate-200'>
                                      <td
                                        colSpan='5'
                                        className='py-6 text-right text-sm font-black uppercase text-slate-600'
                                      >
                                        Recorded Inventory Value:
                                      </td>
                                      <td className='py-6 text-right text-xl font-black underline decoration-4 decoration-teal-500'>
                                        ₱
                                        {(
                                          batch.unit_cost * batch.current_stock
                                        ).toLocaleString()}
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan='9' className='px-6 py-12 text-center'>
                    <p className='text-xs font-black uppercase text-slate-500'>
                      No inbound records found
                    </p>
                    <p className='text-[10px] font-bold text-slate-400 mt-2 uppercase'>
                      Try adjusting search keywords or date filters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className='mt-10 flex justify-center items-center gap-2 no-print'>
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className='p-2 rounded-lg bg-white shadow-sm disabled:opacity-30 hover:shadow-lg transition-all'
            >
              <ChevronLeft size={20} />
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-10 h-10 rounded-lg font-black text-xs transition-all ${
                  currentPage === i + 1
                    ? "bg-black text-white shadow-sm"
                    : "bg-white hover:shadow-lg"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className='p-2 rounded-lg bg-white shadow-sm disabled:opacity-30 hover:shadow-lg transition-all'
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseHistory;
