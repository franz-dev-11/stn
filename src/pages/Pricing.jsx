import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { RefreshCcw, Edit3, Save, X, Truck, Tag, Filter, Search } from "lucide-react";

const InboundPricing = () => {
  const [pricingData, setPricingData] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState("All Suppliers");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({
    supplier_cost: 0,
    manual_retail_price: 0,
    margin_percent: 0,
    suggested_srp: 0,
  });

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    try {
      const { data, error } = await supabase
        .from("product_pricing")
        .select(
          `
          id,
          supplier_cost,
          manual_retail_price,
          margin_percent,
          suggested_srp,
          hardware_inventory (name, sku, supplier)
        `,
        )
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setPricingData(data || []);

      // Extract unique suppliers
      const uniqueSuppliers = [
        ...new Set(
          (data || [])
            .map((item) => item.hardware_inventory?.supplier)
            .filter(Boolean),
        ),
      ].sort();
      setSuppliers(uniqueSuppliers);
    } catch (err) {
      console.error("Error fetching pricing:", err.message);
    }
  };

  const handleUpdateRow = async (id) => {
    try {
      const { error } = await supabase
        .from("product_pricing")
        .update({
          supplier_cost: parseFloat(editData.supplier_cost).toFixed(2),
          manual_retail_price: parseFloat(editData.manual_retail_price).toFixed(
            2,
          ),
          margin_percent: parseFloat(editData.margin_percent).toFixed(2),
          suggested_srp: parseFloat(editData.suggested_srp).toFixed(2),
          updated_at: new Date(),
        })
        .eq("id", id);

      if (error) throw error;
      setEditingId(null);
      await fetchPricing();
    } catch (err) {
      alert("Update failed: " + err.message);
    }
  };

  const handleMarginChange = (val) => {
    const margin = Math.max(0, parseFloat(val || 0));
    const cost = parseFloat(editData.supplier_cost || 0);
    const srp = margin < 100 ? cost / (1 - margin / 100) : cost;

    setEditData({
      ...editData,
      margin_percent: margin,
      suggested_srp: parseFloat(srp.toFixed(2)),
    });
  };

  const filteredPricing = useMemo(() => {
    let filtered = pricingData;

    // Filter by supplier
    if (selectedSupplier !== "All Suppliers") {
      filtered = filtered.filter(
        (item) => item.hardware_inventory?.supplier === selectedSupplier,
      );
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.hardware_inventory?.name?.toLowerCase().includes(searchLower) ||
          item.hardware_inventory?.sku?.toLowerCase().includes(searchLower),
      );
    }

    return filtered;
  }, [pricingData, selectedSupplier, searchTerm]);

  return (
    <div className='min-h-screen bg-[#f8fafc] p-4 sm:p-6 md:p-8'>
      <h1 className='text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2 sm:gap-3'>
        <Tag className='text-teal-600' size={28} />{" "}
        <span className='hidden sm:inline'>EDIT PRICING</span>
        <span className='sm:hidden'>PRICING</span>
      </h1>
      <p className='text-slate-600 font-bold text-[10px] sm:text-xs uppercase tracking-[0.2em] mt-2 mb-6 sm:mb-10'>
        Supplier Cost Matrix | Retail Price Controls
      </p>

      {/* Filters */}
      <div className='mb-6 sm:mb-8 flex flex-col sm:flex-row gap-3 sm:items-center'>
        {/* Search Bar */}
        <div className='relative flex-1'>
          <Search
            className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-400'
            size={18}
          />
          <input
            type='text'
            placeholder='Search by product name or SKU...'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className='w-full pl-12 pr-4 py-2.5 rounded-lg border-2 border-slate-200 font-bold text-sm outline-none focus:border-teal-500 focus:bg-teal-50/30 bg-white transition-all'
          />
        </div>

        {/* Supplier Filter */}
        <div className='flex items-center gap-2'>
          <Filter size={18} className='text-slate-500' />
          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className='px-4 py-2.5 rounded-lg border-2 border-slate-200 font-bold text-sm uppercase outline-none focus:border-teal-500 bg-white cursor-pointer transition-all'
          >
            <option>All Suppliers</option>
            {suppliers.map((supplier) => (
              <option key={supplier} value={supplier}>
                {supplier}
              </option>
            ))}
          </select>
        </div>

        {/* Item Count */}
        <span className='text-xs font-bold text-slate-500 uppercase whitespace-nowrap'>
          {filteredPricing.length} item{filteredPricing.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className='bg-white rounded-2xl sm:rounded-3xl shadow-sm overflow-x-auto'>
        <table className='w-full text-left'>
          <thead>
            <tr className='bg-black text-white text-[9px] sm:text-[10px] font-black uppercase'>
              <th className='px-3 sm:px-6 py-3 sm:py-4'>Product Item</th>
              <th className='px-3 sm:px-6 py-3 sm:py-4'>Supplier Cost</th>
              <th className='px-3 sm:px-6 py-3 sm:py-4 text-center'>
                Margin %
              </th>
              <th className='px-3 sm:px-6 py-3 sm:py-4'>Suggested SRP</th>
              <th className='px-3 sm:px-6 py-3 sm:py-4'>Retail Price</th>
              <th className='px-3 sm:px-6 py-3 sm:py-4 text-right'>Actions</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-slate-50'>
            {filteredPricing.length > 0 ? (
              filteredPricing.map((item) => {
                const isEditing = editingId === item.id;
                return (
                  <tr
                    key={item.id}
                    className={`transition-all ${
                      isEditing ? "bg-teal-50/40" : "hover:bg-slate-50/50"
                    }`}
                  >
                  <td className='p-3 sm:p-6'>
                    <div className='font-black text-xs sm:text-sm uppercase text-black'>
                      {item.hardware_inventory?.name}
                    </div>
                    <div className='text-[8px] sm:text-[10px] text-slate-400 font-bold'>
                      {item.hardware_inventory?.sku}
                    </div>
                  </td>

                  <td className='p-3 sm:p-6 bg-teal-50/10'>
                    {isEditing ? (
                      <input
                        type='number'
                        step='0.01'
                        min='0'
                        className='w-20 sm:w-24 border-2 border-teal-400 rounded p-1 sm:p-2 font-black text-xs sm:text-sm text-black outline-none bg-white'
                        value={parseFloat(editData.supplier_cost) || ''}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            supplier_cost: e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value)),
                          })
                        }
                      />
                    ) : (
                      <span className='font-bold text-teal-700 text-xs sm:text-sm'>
                        ₱{parseFloat(item.supplier_cost).toLocaleString()}
                      </span>
                    )}
                  </td>

                  <td className='p-3 sm:p-6 text-center'>
                    {isEditing ? (
                      <input
                        type='number'
                        step='0.01'
                        min='0'
                        className='w-14 sm:w-16 border-2 border-slate-300 rounded p-1 sm:p-2 font-black text-xs sm:text-sm text-black outline-none bg-white'
                        value={parseFloat(editData.margin_percent) || ''}
                        onChange={(e) => handleMarginChange(e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value)))}
                      />
                    ) : (
                      <span className='text-[8px] sm:text-xs font-black text-slate-500'>
                        {parseFloat(item.margin_percent).toFixed(1)}%
                      </span>
                    )}
                  </td>

                  <td className='p-3 sm:p-6'>
                    <span className='font-black text-teal-600 italic text-xs sm:text-sm'>
                      ₱
                      {isEditing
                        ? parseFloat(editData.suggested_srp).toLocaleString(
                            undefined,
                            { minimumFractionDigits: 2 },
                          )
                        : parseFloat(item.suggested_srp).toLocaleString(
                            undefined,
                            { minimumFractionDigits: 2 },
                          )}
                    </span>
                  </td>

                  <td className='p-3 sm:p-6 bg-emerald-50/10'>
                    {isEditing ? (
                      <input
                        type='number'
                        step='0.01'
                        min='0'
                        className='w-20 sm:w-24 border-2 border-emerald-400 rounded p-1 sm:p-2 font-black text-xs sm:text-sm text-black outline-none bg-white'
                        value={parseFloat(editData.manual_retail_price) || ''}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            manual_retail_price: e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value)),
                          })
                        }
                      />
                    ) : (
                      <span className='font-black text-emerald-700 text-xs sm:text-sm'>
                        ₱{parseFloat(item.manual_retail_price).toLocaleString()}
                      </span>
                    )}
                  </td>

                  <td className='p-3 sm:p-6 text-right'>
                    <div className='flex justify-end gap-1 sm:gap-2'>
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleUpdateRow(item.id)}
                            className='bg-emerald-500 text-white p-2 sm:p-2.5 rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-200'
                          >
                            <Save size={16} className='sm:w-4.5 sm:h-4.5' />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className='bg-slate-200 text-slate-500 p-2 sm:p-2.5 rounded-xl hover:bg-slate-300'
                          >
                            <X size={16} className='sm:w-4.5 sm:h-4.5' />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(item.id);
                            setEditData({
                              supplier_cost: parseFloat(item.supplier_cost),
                              manual_retail_price: parseFloat(item.manual_retail_price || item.suggested_srp),
                              margin_percent: parseFloat(item.margin_percent),
                              suggested_srp: parseFloat(item.suggested_srp),
                            });
                          }}
                          className='bg-white border-2 border-slate-100 p-2 sm:p-2.5 rounded-xl text-slate-600 hover:border-black hover:text-black transition-all'
                        >
                          <Edit3 size={16} className='sm:w-4.5 sm:h-4.5' />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
            ) : (
              <tr>
                <td colSpan='6' className='p-8 text-center'>
                  <p className='text-slate-500 font-black uppercase text-xs'>
                    No items found for {selectedSupplier}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InboundPricing;
