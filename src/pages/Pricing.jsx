import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../supabaseClient";
import { formatPSTFullDate, getCurrentPSTDateTime } from "../utils/dateTimeUtils";
import { RefreshCcw, Edit3, Save, X, Truck, Tag, Filter, Search, Download, Upload, Mail } from "lucide-react";
import { insertAuditTrail, getSessionUser, getPerformedBy } from "../utils/auditTrail";

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
    const channel = supabase
      .channel("pricing-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "product_pricing" }, fetchPricing)
      .on("postgres_changes", { event: "*", schema: "public", table: "hardware_inventory" }, fetchPricing)
      .subscribe();
    return () => supabase.removeChannel(channel);
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
          manual_retail_price: parseFloat(editData.manual_retail_price).toFixed(2),
          margin_percent: parseFloat(editData.margin_percent).toFixed(2),
          suggested_srp: parseFloat(editData.suggested_srp).toFixed(2),
          updated_at: getCurrentPSTDateTime(),
        })
        .eq("id", id);

      if (error) throw error;

      const item = pricingData.find((p) => p.id === id);
      const user = getSessionUser();
      await insertAuditTrail([{
        action: "PRICE_UPDATE",
        reference_number: null,
        product_id: item?.hardware_inventory?.id || null,
        item_name: item?.hardware_inventory?.name || null,
        sku: item?.hardware_inventory?.sku || null,
        supplier: item?.hardware_inventory?.supplier || null,
        quantity: null,
        unit_cost: parseFloat(editData.supplier_cost),
        total_amount: null,
        performed_by: getPerformedBy(user),
      }]);

      setEditingId(null);
      await fetchPricing();
    } catch (err) {
      alert("Update failed: " + err.message);
    }
  };

  const [isUploading, setIsUploading] = useState(false);
  const csvInputRef = useRef(null);

  const handleDownloadSupplierTemplate = (supplier) => {
    // Filter items for this supplier
    const supplierItems = pricingData.filter(
      (item) => item.hardware_inventory?.supplier === supplier
    );
    
    if (supplierItems.length === 0) {
      alert(`No items found for supplier: ${supplier}`);
      return;
    }

    const headers = ["Item Name", "SKU", "Supplier Cost"];
    const rows = supplierItems.map((item) => [
      `"${(item.hardware_inventory?.name || "").replace(/"/g, '""')}"`,
      `"${(item.hardware_inventory?.sku || "").replace(/"/g, '""')}"`,
      "", // Blank for supplier to fill out
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pricing_template_${supplier.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEmailSupplier = async (supplier) => {
    const supplierItems = pricingData.filter(
      (item) => item.hardware_inventory?.supplier === supplier
    );
    
    if (supplierItems.length === 0) {
      alert(`No items found for supplier: ${supplier}`);
      return;
    }

    // Download the template first
    handleDownloadSupplierTemplate(supplier);

    // Fetch supplier email
    let supplierEmail = "";
    try {
      const { data: supplierData } = await supabase
        .from("suppliers")
        .select("email")
        .eq("name", supplier)
        .maybeSingle();
      supplierEmail = supplierData?.email || "";
    } catch (err) {
      console.error("Error fetching supplier email:", err);
    }

    // Generate email
    const today = formatPSTFullDate(new Date());
    const itemList = supplierItems
      .map(
        (item, idx) =>
          `  ${idx + 1}. ${item.hardware_inventory?.name}\n` +
          `     SKU: ${item.hardware_inventory?.sku || "N/A"}`
      )
      .join("\n");

    const subject = encodeURIComponent(`Request for Updated Pricing — STN Procurement — ${today}`);
    const body = encodeURIComponent(
      `Dear ${supplier} Sales Team,\n\n` +
      `We hope this message finds you well.\n\n` +
      `We are writing to request updated supplier pricing for the following items that we currently source from your company. ` +
      `Please fill out the CSV template attached to this email with the updated supplier costs and reply with the completed file.\n\n` +
      `Items for Pricing Update:\n\n` +
      itemList +
      `\n\nPlease ensure all prices are accurate and complete. We value our partnership with you and look forward to your prompt response.\n\n` +
      `Thank you very much.\n\n` +
      `Warm regards,\n` +
      `STN Procurement Team\n` +
      `Date: ${today}`
    );

    const recipientEmail = supplierEmail ? `&to=${encodeURIComponent(supplierEmail)}` : "";
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1${recipientEmail}&su=${subject}&body=${body}`,
      "_blank"
    );
  };

  const handleUploadCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const parseNum = (s) => Math.max(0, parseFloat(String(s || "").replace(/,/g, "")) || 0);
      const parseCSVLine = (line) => {
        const result = [];
        let i = 0;
        while (i <= line.length) {
          if (line[i] === '"') {
            let field = "";
            i++;
            while (i < line.length) {
              if (line[i] === '"' && line[i + 1] === '"') { field += '"'; i += 2; }
              else if (line[i] === '"') { i++; break; }
              else field += line[i++];
            }
            result.push(field.trim());
            if (line[i] === ",") i++;
          } else {
            const end = line.indexOf(",", i);
            if (end === -1) { result.push(line.slice(i).trim()); break; }
            result.push(line.slice(i, end).trim());
            i = end + 1;
          }
        }
        return result;
      };
      const text = await file.text();
      const lines = text.trim().split("\n");
      if (lines.length < 2) throw new Error("CSV has no data rows.");
      const headerRow = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
      const col = {
        sku: headerRow.findIndex((h) => h === "sku"),
        supplier_cost: headerRow.findIndex((h) => h.includes("supplier cost")),
        margin: headerRow.findIndex((h) => h.includes("margin")),
        suggested_srp: headerRow.findIndex((h) => h.includes("suggested")),
        retail_price: headerRow.findIndex((h) => h.includes("retail")),
      };
      if (col.sku === -1) throw new Error("Could not find 'SKU' column in CSV.");
      const updates = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = parseCSVLine(lines[i]);
        const sku = cols[col.sku];
        if (!sku) continue;
        const match = pricingData.find((p) => p.hardware_inventory?.sku?.toLowerCase() === sku.toLowerCase());
        if (!match) continue;
        updates.push({
          id: match.id,
          supplier_cost: col.supplier_cost !== -1 ? parseNum(cols[col.supplier_cost]) : null,
          margin_percent: col.margin !== -1 ? parseNum(cols[col.margin]) : null,
          suggested_srp: col.suggested_srp !== -1 ? parseNum(cols[col.suggested_srp]) : null,
          manual_retail_price: col.retail_price !== -1 ? parseNum(cols[col.retail_price]) : null,
        });
      }
      if (updates.length === 0) throw new Error("No matching SKUs found. Ensure SKU column matches items in the system.");
      let success = 0;
      const user = getSessionUser();
      const auditRows = [];
      for (const u of updates) {
        const payload = { updated_at: getCurrentPSTDateTime() };
        if (u.supplier_cost !== null) payload.supplier_cost = u.supplier_cost.toFixed(2);
        if (u.margin_percent !== null) payload.margin_percent = u.margin_percent.toFixed(2);
        if (u.suggested_srp !== null) payload.suggested_srp = u.suggested_srp.toFixed(2);
        if (u.manual_retail_price !== null) payload.manual_retail_price = u.manual_retail_price.toFixed(2);
        const { error } = await supabase.from("product_pricing").update(payload).eq("id", u.id);
        if (!error) {
          success++;
          const item = pricingData.find((p) => p.id === u.id);
          auditRows.push({
            action: "PRICE_UPDATE",
            reference_number: null,
            product_id: item?.hardware_inventory?.id || null,
            item_name: item?.hardware_inventory?.name || null,
            sku: item?.hardware_inventory?.sku || null,
            supplier: item?.hardware_inventory?.supplier || null,
            quantity: null,
            unit_cost: u.supplier_cost,
            total_amount: null,
            performed_by: getPerformedBy(user),
          });
        }
      }
      if (auditRows.length > 0) await insertAuditTrail(auditRows);
      alert(`Updated ${success} of ${updates.length} matching items.`);
      fetchPricing();
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = "";
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

        {/* CSV Actions */}
        <div className='flex gap-2 flex-wrap'>
          <button
            onClick={() => csvInputRef.current?.click()}
            disabled={isUploading}
            className='flex items-center gap-1.5 px-3 py-2.5 rounded-lg border-2 border-slate-200 bg-white text-xs font-black uppercase text-slate-600 hover:border-emerald-500 hover:text-emerald-600 transition-all whitespace-nowrap disabled:opacity-50'
          >
            <Upload size={14} /> {isUploading ? "Uploading..." : "Upload CSV"}
          </button>
          {selectedSupplier !== "All Suppliers" && (
            <>
              <button
                onClick={() => handleDownloadSupplierTemplate(selectedSupplier)}
                className='bg-blue-500 text-white px-4 py-2.5 rounded-lg text-xs font-black flex items-center gap-2 hover:bg-blue-600 transition-all whitespace-nowrap'
              >
                <Download size={14} /> Supplier Template
              </button>
              <button
                onClick={() => handleEmailSupplier(selectedSupplier)}
                className='bg-purple-500 text-white px-4 py-2.5 rounded-lg text-xs font-black flex items-center gap-2 hover:bg-purple-600 transition-all whitespace-nowrap'
              >
                <Mail size={14} /> Email Supplier
              </button>
            </>
          )}
          <input ref={csvInputRef} type='file' accept='.csv' className='hidden' onChange={handleUploadCSV} />
        </div>
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
