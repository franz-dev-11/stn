import React from "react";
import {
  Tag,
  Percent,
  DollarSign,
  ArrowUpRight,
  Save,
  Search,
  Download,
} from "lucide-react";

const OutboundPricing = () => {
  return (
    <div className='p-3 sm:p-4 md:p-6 lg:p-8 bg-[#e5e7eb] min-h-screen font-sans text-slate-800 overflow-x-hidden'>
      {/* Page Title Section */}
      <div className='mb-6 flex justify-between items-end'>
        <div>
          <h1 className='text-4xl font-bold text-black tracking-tight'>
            Outbound Pricing
          </h1>
          <p className='text-slate-500 font-medium'>
            Manage Customer Price Lists & Retail Margins
          </p>
        </div>
        <div className='flex gap-3'>
          <button className='flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm'>
            <Download size={14} /> Export PDF
          </button>
          <button className='flex items-center gap-2 px-6 py-2 bg-[#a8d1cd] text-white rounded-lg text-xs font-bold hover:bg-[#96c2be] transition-all shadow-md uppercase tracking-wider'>
            <Save size={14} /> Save Changes
          </button>
        </div>
      </div>

      {/* 1. Pricing Rules Card */}

      {/* 2. Outbound Price List Table */}
      <div className='bg-white rounded-xl shadow-sm overflow-hidden'>
        <div className='p-6 flex justify-between items-center'>
          <h2 className='text-lg font-bold'>Current Price List</h2>
          <div className='relative'>
            <Search
              className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400'
              size={16}
            />
            <input
              type='text'
              placeholder='Filter items...'
              className='pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none'
            />
          </div>
        </div>

        <div className='overflow-x-auto'>
          <table className='w-full text-left'>
            <thead>
              <tr className='bg-black text-white text-[10px] font-black uppercase'>
                <th className='px-6 py-4'>Item Name</th>
                <th className='px-6 py-4 text-center'>Retail Markup</th>
                <th className='px-6 py-4 text-center'>Suggested SRP</th>
                <th className='px-6 py-4 text-right'>Final Retail Price</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-100'>
              <OutboundRow
                name="PVC BLUE Fittings 1/2'"
                markup='35'
                srp='21.20'
                final='22.00'
              />
              <OutboundRow
                name='STANLEY Hand Riveter'
                markup='30'
                srp='682.50'
                final='685.00'
              />
              <OutboundRow
                name='LOTUS Welding Mask'
                markup='25'
                srp='962.50'
                final='965.00'
              />
              <OutboundRow
                name='Electrical Wire (100m)'
                markup='20'
                srp='3,084.00'
                final='3,100.00'
              />
            </tbody>
          </table>
        </div>
      </div>

      <footer className='text-center mt-12 py-4 text-slate-400 text-[10px] uppercase tracking-[0.2em]'>
        © Synchronized Technologies 2025 | STN Outbound Module
      </footer>
    </div>
  );
};

// Sub-component for individual outbound pricing lines
const OutboundRow = ({ name, markup, srp, final }) => (
  <tr className='hover:bg-teal-50/30 transition-colors group'>
    <td className='px-6 py-5'>
      <div className='flex items-center gap-3'>
        <div className='w-8 h-8 bg-slate-100 rounded flex items-center justify-center text-slate-400 group-hover:bg-[#a8d1cd] group-hover:text-white transition-all'>
          <Tag size={14} />
        </div>
        <span className='font-bold text-sm text-slate-800'>{name}</span>
      </div>
    </td>
    <td className='px-6 py-5 text-center'>
      <span className='text-teal-600 font-bold text-xs'>+{markup}%</span>
    </td>
    <td className='px-6 py-5 text-center'>
      <span className='text-slate-400 italic text-xs'>₱{srp}</span>
    </td>
    <td className='px-6 py-5 text-right'>
      <div className='flex items-center justify-end gap-2'>
        <span className='text-lg font-black text-slate-900 tracking-tighter'>
          ₱{final}
        </span>
        <ArrowUpRight
          size={14}
          className='text-teal-500 opacity-0 group-hover:opacity-100 transition-opacity'
        />
      </div>
    </td>
  </tr>
);

export default OutboundPricing;
