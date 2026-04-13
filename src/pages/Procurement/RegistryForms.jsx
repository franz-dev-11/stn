import React, { useState } from "react";
import { supabase } from "../../supabaseClient";
import { Package, User, Mail, MapPin, Phone, Hash, Ruler } from "lucide-react";

export const ItemRegistry = ({ suppliers, onRefresh }) => {
  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "",
    supplier: "",
    price: "",
    unit: "pcs",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data: inv, error: invErr } = await supabase
        .from("hardware_inventory")
        .insert([
          {
            name: form.name,
            sku: form.sku,
            category: form.category,
            supplier: form.supplier,
            unit: form.unit,
          },
        ])
        .select()
        .single();
      if (invErr) throw invErr;
      await supabase
        .from("product_pricing")
        .insert([
          { product_id: inv.id, supplier_cost: parseFloat(form.price) },
        ]);
      alert("Item Registered!");
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className='max-w-xl mx-auto bg-white p-8 rounded-[2rem] shadow-sm'>
      <h2 className='text-xl font-black mb-6 uppercase italic text-teal-600 flex items-center gap-2'>
        <Package /> New Item
      </h2>
      <form onSubmit={handleSubmit} className='space-y-4'>
        <input
          required
          placeholder='Item Name'
          className='w-full p-4 border-2 border-black rounded-xl font-bold'
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          required
          placeholder='SKU'
          className='w-full p-4 border-2 border-black rounded-xl font-bold'
          onChange={(e) => setForm({ ...form, sku: e.target.value })}
        />
        <select
          required
          className='w-full p-4 border-2 border-black rounded-xl font-bold'
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          <option value=''>Select Category</option>
          <option value='Paint'>Paint</option>
          <option value='Tools'>Tools</option>
          <option value='Hardware'>Hardware</option>
          <option value='Electrical'>Electrical</option>
          <option value='Plumbing'>Plumbing</option>
          <option value='Lumber'>Lumber</option>
          <option value='Fasteners'>Fasteners</option>
          <option value='Other'>Other</option>
        </select>
        <select
          required
          className='w-full p-4 border-2 border-black rounded-xl font-bold'
          onChange={(e) => setForm({ ...form, supplier: e.target.value })}
        >
          <option value=''>Select Supplier</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        <div className='grid grid-cols-2 gap-4'>
          <input
            required
            type='number'
            step='0.01'
            placeholder='Price (₱)'
            className='p-4 border-2 border-black rounded-xl font-bold'
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <select
            className='p-4 border-2 border-black rounded-xl font-bold'
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          >
            <option value='pcs'>pcs</option>
            <option value='box'>box</option>
            <option value='kg'>kg</option>
            <option value='meter'>meter</option>
          </select>
        </div>
        <button className='w-full bg-black text-white py-4 rounded-xl font-black uppercase hover:bg-teal-600 transition-all'>
          Save Item
        </button>
      </form>
    </div>
  );
};

export const SupplierRegistry = ({ onRefresh }) => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    contact_number: "",
    address: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("suppliers").insert([form]);
    if (!error) {
      alert("Supplier Added!");
      onRefresh();
    } else {
      alert(error.message);
    }
  };

  return (
    <div className='max-w-xl mx-auto bg-white p-8 rounded-[2rem] shadow-sm'>
      <h2 className='text-xl font-black mb-6 uppercase italic text-emerald-600 flex items-center gap-2'>
        <User /> New Supplier
      </h2>
      <form onSubmit={handleSubmit} className='space-y-4'>
        <input
          required
          placeholder='Supplier Name'
          className='w-full p-4 border-2 border-black rounded-xl font-bold'
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <div className='grid grid-cols-2 gap-4'>
          <input
            type='email'
            placeholder='Email'
            className='p-4 border-2 border-black rounded-xl font-bold'
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            required
            placeholder='Phone'
            className='p-4 border-2 border-black rounded-xl font-bold'
            onChange={(e) =>
              setForm({ ...form, contact_number: e.target.value })
            }
          />
        </div>
        <input
          placeholder='Address'
          className='w-full p-4 border-2 border-black rounded-xl font-bold'
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <button className='w-full bg-black text-white py-4 rounded-xl font-black uppercase hover:bg-emerald-600 transition-all'>
          Save Supplier
        </button>
      </form>
    </div>
  );
};
