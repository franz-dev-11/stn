import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { getSessionUser, getPerformedBy, insertAuditTrail } from "../utils/auditTrail";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  Edit3,
  Save,
  List,
  Truck,
  Calendar as CalendarIcon,
  X,
  Search,
  Filter,
  Clock,
  CheckCircle2,
} from "lucide-react";

const OutboundScheduling = () => {
  const location = useLocation();
  const [transactions, setTransactions] = useState([]);
  const [viewMode, setViewMode] = useState("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState(location.state?.filterStatus || "All Statuses");
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ delivery_date: "", status: "" });
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("sales_transactions")
        .select(`*, sales_items (*)`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error("Fetch error:", err.message);
    }
  };

  const handleSave = async (id) => {
    console.log("--- Starting Outbound Save Process ---");
    try {
      // 1. Fetch current database state
      const { data: order, error: fetchErr } = await supabase
        .from("sales_transactions")
        .select("*, sales_items(*)")
        .eq("id", id)
        .single();

      if (fetchErr) throw new Error("Fetch Order Error: " + fetchErr.message);

      // Check if status is transitioning TO "Completed" or "Delivered"
      const isBecomingCompleted =
        (editData.status === "Completed" || editData.status === "Delivered") &&
        order.status !== "Completed" && order.status !== "Delivered";

      // 2. Update the main sales transaction record
      const { error: statusUpdateErr } = await supabase
        .from("sales_transactions")
        .update({
          status: editData.status,
          delivery_date: editData.delivery_date,
          date_processed:
            (editData.status === "Completed" || editData.status === "Delivered")
              ? order.created_at
              : order.date_processed,
        })
        .eq("id", id);

      if (statusUpdateErr)
        throw new Error("Status Update Error: " + statusUpdateErr.message);

      // Audit trail — delivery status change
      const user = getSessionUser();
      await insertAuditTrail([{
        action: `DELIVERY_STATUS_UPDATE:${editData.status.toUpperCase()}`,
        reference_number: order.so_number,
        product_id: null,
        item_name: `${order.customer_name || 'Customer'} — ${order.sales_items?.length || 0} item(s)`,
        sku: null,
        supplier: null,
        quantity: null,
        unit_cost: null,
        total_amount: order.total_amount || 0,
        performed_by: getPerformedBy(user),
      }]);

      // 3. IF COMPLETED: Process Inventory and Ledger updates
      if (isBecomingCompleted) {
        console.log("Status is Completed. Processing Inventory & Ledger...");

        for (const item of order.sales_items) {
          // A. Fetch current hardware inventory
          const { data: inv, error: invFetchErr } = await supabase
            .from("hardware_inventory")
            .select("stock_balance, outbound_qty, name")
            .eq("id", item.product_id)
            .single();

          if (invFetchErr)
            throw new Error(
              `Inventory Fetch Error for ${item.item_name}: ` +
                invFetchErr.message,
            );

          // B. Update hardware_inventory: Increment outbound_qty and Decrement stock_balance
          const { error: invUpdateErr } = await supabase
            .from("hardware_inventory")
            .update({
              stock_balance:
                Number(inv?.stock_balance || 0) - Number(item.quantity),
              outbound_qty:
                Number(inv?.outbound_qty || 0) + Number(item.quantity),
            })
            .eq("id", item.product_id);

          if (invUpdateErr)
            throw new Error(
              `Inventory Update Error for ${item.item_name}: ` +
                invUpdateErr.message,
            );

          // C. Insert into Ledger Table (best-effort — table may not exist yet)
          const { error: ledgerErr } = await supabase.from("ledger").insert([
            {
              transaction_type: "OUTBOUND",
              reference_number: order.so_number,
              product_id: item.product_id,
              item_name: item.item_name,
              quantity: Number(item.quantity),
              amount: Number(item.quantity) * Number(item.unit_price || 0),
              timestamp: new Date().toISOString(),
            },
          ]);

          if (ledgerErr) {
            console.warn(
              `Ledger skipped for ${item.item_name}:`,
              ledgerErr.message,
            );
          }

          // Audit trail — stock dispatched outbound
          const user = getSessionUser();
          await insertAuditTrail([{
            action: "STOCK_OUT",
            reference_number: order.so_number,
            product_id: item.product_id,
            item_name: item.item_name,
            sku: null,
            supplier: null,
            quantity: item.quantity,
            unit_cost: item.unit_price || 0,
            total_amount: (item.quantity || 0) * (item.unit_price || 0),
            performed_by: getPerformedBy(user),
          }]);
        }

        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }

      setEditingId(null);
      fetchTransactions();
    } catch (err) {
      console.error("CRITICAL ERROR:", err.message);
      alert("SYSTEM ERROR: " + err.message);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({ delivery_date: "", status: "" });
  };

  const handleEdit = (tx) => {
    setEditingId(tx.id);
    setEditData({
      delivery_date: tx.delivery_date || "",
      status: tx.status || "Pending",
      date_processed: tx.date_processed || "",
    });
  };

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      tx.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.so_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      filterStatus === "All Statuses" ||
      (filterStatus === "Active Orders" ? ["Pending", "In Transit"].includes(tx.status) : tx.status === filterStatus);
    return matchesSearch && matchesStatus;
  });

  const calendarEvents = useMemo(() => {
    const statusColors = {
      Pending: { background: '#fbbf24', text: '#000' },
      'In Transit': { background: '#60a5fa', text: '#fff' },
      Delivered: { background: '#4ade80', text: '#000' },
      Completed: { background: '#4ade80', text: '#000' },
      Cancelled: { background: '#9ca3af', text: '#fff' },
    };
    
    return filteredTransactions
      .filter((tx) => tx.delivery_date)
      .map((tx) => {
        const displayStatus = tx.status === 'Cancelled' ? 'Cancelled' : (tx.status === 'Completed' || tx.status === 'Delivered') ? tx.status : tx.status === 'In Transit' ? 'In Transit' : 'Pending';
        const colors = statusColors[displayStatus] || { background: '#9ca3af', text: '#fff' };
        return {
          id: String(tx.id),
          title: `${tx.so_number} • ${tx.customer_name}`,
          start: tx.delivery_date,
          allDay: true,
          backgroundColor: colors.background,
          textColor: colors.text,
          borderColor: colors.background,
          extendedProps: {
            status: displayStatus,
            lineItems: tx.sales_items?.length || 0,
          },
        };
      });
  }, [filteredTransactions]);

  return (
    <div className='p-3 sm:p-4 md:p-6 lg:p-8 bg-[#f3f4f6] min-h-screen relative font-sans text-black overflow-x-hidden'>
      {showSuccess && (
        <div className='fixed top-6 left-1/2 -translate-x-1/2 z-100 w-[calc(100%-1.5rem)] max-w-md bg-black text-white px-4 sm:px-8 py-3 sm:py-4 rounded-xl text-[10px] sm:text-sm font-black shadow-lg flex items-center justify-center gap-2 text-center animate-bounce'>
          <CheckCircle2 className='text-emerald-400' /> INVENTORY & BATCHES
          UPDATED
        </div>
      )}

      <style>{`
        .outbound-calendar .fc {
          font-family: inherit;
        }

        .outbound-calendar .fc .fc-toolbar-title {
          font-size: 0.95rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #0f172a;
        }

        .outbound-calendar .fc .fc-button {
          background: #0f172a;
          border: none;
          border-radius: 0.75rem;
          text-transform: uppercase;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          padding: 0.35rem 0.7rem;
          cursor: pointer;
          touch-action: manipulation;
        }

        .outbound-calendar .fc .fc-button:hover {
          background: #1e293b;
        }

        .outbound-calendar .fc .fc-button:active {
          transform: scale(0.98);
        }

        .outbound-calendar .fc .fc-daygrid-day.fc-day-today {
          background: #eff6ff;
        }

        .outbound-calendar .fc .fc-daygrid-event {
          border: none !important;
          border-radius: 0.5rem;
          padding: 0.1rem 0.35rem;
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.03em;
          cursor: pointer;
          touch-action: manipulation;
        }

        .outbound-calendar .fc-event-title {
          font-weight: 800 !important;
        }

        @media (max-width: 768px) {
          .outbound-calendar .fc .fc-toolbar-title {
            font-size: 0.75rem;
            margin: 0.5rem 0;
          }
          .outbound-calendar .fc .fc-button {
            font-size: 0.55rem;
            padding: 0.25rem 0.5rem;
          }
          .outbound-calendar .fc .fc-daygrid-event {
            font-size: 0.5rem;
            padding: 0.05rem 0.25rem;
          }
          .outbound-calendar .fc .fc-col-header-cell {
            padding: 0.25rem 0 !important;
            font-size: 0.7rem;
          }
          .outbound-calendar .fc .fc-daygrid-day-number {
            padding: 0.25rem 0.5rem !important;
            font-size: 0.7rem;
          }
          .outbound-calendar .fc .fc-daygrid-day {
            height: 60px;
          }
        }

        @media (max-width: 640px) {
          .outbound-calendar .fc .fc-toolbar-title {
            font-size: 0.65rem;
            margin: 0.25rem 0;
          }
          .outbound-calendar .fc .fc-button {
            font-size: 0.5rem;
            padding: 0.2rem 0.4rem;
          }
          .outbound-calendar .fc .fc-daygrid-event {
            font-size: 0.45rem;
            padding: 0 0.2rem;
          }
          .outbound-calendar .fc .fc-col-header-cell {
            padding: 0.15rem 0 !important;
            font-size: 0.6rem;
          }
          .outbound-calendar .fc .fc-daygrid-day-number {
            padding: 0.15rem 0.3rem !important;
            font-size: 0.6rem;
          }
          .outbound-calendar .fc .fc-daygrid-day {
            height: 50px;
          }
        }
      `}</style>

      {/* Header */}
      <div className='mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='flex flex-wrap items-center gap-2 sm:gap-3 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight'>
            <Truck className='text-teal-600' size={32} /> OUTBOUND DELIVERY
          </h1>
          <p className='mt-2 text-[10px] sm:text-xs font-bold uppercase tracking-[0.14em] sm:tracking-[0.2em] text-slate-600'>
            Dispatch Queue | Delivery Scheduling
          </p>
        </div>
        <div className='flex w-full sm:w-auto overflow-x-auto bg-white rounded-xl p-1 shadow-sm'>
          <button
            onClick={() => setViewMode("table")}
            className={`px-4 sm:px-6 py-2 rounded-lg flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase whitespace-nowrap transition-all ${
              viewMode === "table"
                ? "bg-black text-white"
                : "text-black hover:bg-slate-100"
            }`}
          >
            <List size={16} /> Table
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`px-4 sm:px-6 py-2 rounded-lg flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase whitespace-nowrap transition-all ${
              viewMode === "calendar"
                ? "bg-black text-white"
                : "text-black hover:bg-slate-100"
            }`}
          >
            <CalendarIcon size={16} /> Calendar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-8'>
        <div className='md:col-span-2 relative'>
          <Search
            className='absolute left-4 top-1/2 -translate-y-1/2 text-black'
            size={20}
          />
          <input
            type='text'
            placeholder='Search Order # or Customer...'
            className='w-full pl-12 pr-4 py-3 sm:py-4 rounded-2xl font-black uppercase text-xs outline-none focus:bg-yellow-50 transition-all shadow-sm'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className='relative'>
          <Filter
            className='absolute left-4 top-1/2 -translate-y-1/2 text-black'
            size={20}
          />
          <select
            className='w-full pl-12 pr-4 py-3 sm:py-4 rounded-2xl font-black uppercase text-xs outline-none appearance-none bg-white cursor-pointer shadow-sm'
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option>All Statuses</option>
            <option>Active Orders</option>
            <option>Pending</option>
            <option>In Transit</option>
            <option>Delivered</option>
            <option>Completed</option>
          </select>
        </div>
      </div>

      {viewMode === "table" ? (
        <div className='bg-white rounded-2xl shadow-sm overflow-hidden'>
          <div className='overflow-x-auto'>
          <table className='w-full min-w-max text-left'>
            <thead>
              <tr className='bg-black text-white text-[10px] font-black uppercase'>
                <th className='px-6 py-4'>Customer & Items</th>
                <th className='px-6 py-4'>Delivery Date</th>
                <th className='px-6 py-4'>Status</th>
                <th className='px-6 py-4'>Date Processed</th>
                <th className='px-6 py-4 text-right'>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length > 0
                ? filteredTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className='hover:bg-yellow-50 transition-colors'
                    >
                      <td className='p-6'>
                        <p className='font-mono text-teal-700 font-black text-sm mb-1'>
                          #{tx.so_number}
                        </p>
                        <p className='font-black uppercase text-lg leading-none mb-2'>
                          {tx.customer_name}
                        </p>
                        <div className='flex flex-wrap gap-2 mt-2'>
                          {tx.sales_items?.map((item, idx) => (
                            <span
                              key={idx}
                              className='text-[10px] bg-white px-2 py-1 rounded font-black text-black uppercase'
                            >
                              {item.item_name} (x{item.quantity})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className='p-6'>
                        {editingId === tx.id ? (
                          <input
                            type='date'
                            className='rounded-lg p-2 text-sm font-black uppercase w-full'
                            value={editData.delivery_date}
                            onChange={(e) =>
                              setEditData({ ...editData, delivery_date: e.target.value })
                            }
                          />
                        ) : (
                          <div className='flex items-center gap-2 text-sm font-black text-slate-700 uppercase'>
                            <Clock size={18} strokeWidth={2.5} />{' '}
                            {tx.delivery_date || 'NOT SCHEDULED'}
                          </div>
                        )}
                      </td>
                      <td className='p-6'>
                        {editingId === tx.id ? (
                          <select
                            className='rounded-lg p-2 text-sm font-black uppercase w-full'
                            value={editData.status}
                            onChange={(e) =>
                              setEditData({ ...editData, status: e.target.value })
                            }
                          >
                            <option value='Pending'>Pending</option>
                            <option value='In Transit'>In Transit</option>
                            <option value='Delivered'>Delivered</option>
                            <option value='Completed'>Completed</option>
                          </select>
                        ) : (
                          <span
                            className={`px-2 py-1 rounded text-xs font-black uppercase ${
                              tx.status === 'Completed' || tx.status === 'Delivered'
                                ? 'bg-green-100 text-green-700'
                                : tx.status === 'In Transit'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {tx.status}
                          </span>
                        )}
                      </td>
                      <td className='p-6'>
                        <span className='text-xs font-black uppercase text-slate-700'>
                          {tx.created_at ? new Date(tx.created_at).toLocaleString() : '—'}
                        </span>
                      </td>
                      <td className='p-6 text-right'>
                        {editingId === tx.id ? (
                          <>
                            <button
                              className='mr-2 px-4 py-2 rounded bg-green-600 text-white text-xs font-black uppercase hover:bg-green-700 transition-colors'
                              onClick={() => handleSave(tx.id)}
                            >
                              Save
                            </button>
                            <button
                              className='px-4 py-2 rounded bg-slate-300 text-slate-700 text-xs font-black uppercase hover:bg-slate-400 transition-colors'
                              onClick={handleCancel}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleEdit(tx)}
                            className='p-3 hover:bg-slate-100 rounded-xl transition-all'
                          >
                            <Edit3 size={24} strokeWidth={2.5} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                : (
                    <tr>
                      <td
                        colSpan='5'
                        className='p-10 text-center text-xs font-black uppercase text-slate-500'
                      >
                        No outbound transactions found
                      </td>
                    </tr>
                  )}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <div className='bg-white rounded-2xl p-4 shadow-sm outbound-calendar'>
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView='dayGridMonth'
            headerToolbar={{
              left: "prev,next",
              center: "title",
              right: "",
            }}
            height='auto'
            events={calendarEvents}
            eventDisplay='block'
            dayMaxEvents={3}
          />
        </div>
      )}
    </div>
  );
};

export default OutboundScheduling;
