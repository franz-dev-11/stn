import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  Edit3,
  Save,
  CheckCircle2,
  X,
  Truck,
  List,
  Calendar as CalendarIcon,
  Search,
  Filter,
} from "lucide-react";

const InboundScheduling = () => {
  const [orders, setOrders] = useState([]);
  const [viewMode, setViewMode] = useState("table");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All Statuses");
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ eta: "", status: "" });
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("order_scheduling")
      .select("*")
      .order("date_ordered", { ascending: false });
    setOrders(data || []);
  };

  const handleSave = async (id) => {
    try {
      console.log("Starting save process for ID:", id);

      // 1. Kunin ang latest data ng scheduling record
      const { data: order, error: fetchErr } = await supabase
        .from("order_scheduling")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchErr) throw new Error("Fetch Order Error: " + fetchErr.message);

      // Check if status is transitioning to Arrived
      const isBecomingArrived =
        editData.status === "Arrived" && order.status !== "Arrived";

      // 2. Update the Status of the Order
      const { error: statusUpdateErr } = await supabase
        .from("order_scheduling")
        .update({
          eta: editData.eta,
          status: editData.status,
          date_arrived:
            editData.status === "Arrived"
              ? new Date().toISOString()
              : order.date_arrived,
        })
        .eq("id", id);

      if (statusUpdateErr)
        throw new Error("Status Update Error: " + statusUpdateErr.message);

      // 3. IF ARRIVED: Record to Inventory and Batches
      if (isBecomingArrived) {
        console.log("Status is Arrived. Updating Inventory and Batches...");

        // A. Get current inventory
        const { data: inv, error: invFetchErr } = await supabase
          .from("hardware_inventory")
          .select("stock_balance, inbound_qty, outbound_qty")
          .eq("id", order.product_id)
          .single();

        if (invFetchErr)
          throw new Error("Inventory Fetch Error: " + invFetchErr.message);

        // B. Update Hardware Inventory Table
        const { error: invUpdateErr } = await supabase
          .from("hardware_inventory")
          .update({
            inbound_qty: Number(inv?.inbound_qty || 0) + Number(order.quantity),
            stock_balance:
              Number(inv?.stock_balance || 0) + Number(order.quantity),
            outbound_qty: Number(inv?.outbound_qty || 0),
          })
          .eq("id", order.product_id);

        if (invUpdateErr)
          throw new Error("Inventory Update Error: " + invUpdateErr.message);

        // C. Insert into inventory_batches (Match sa image_28b46f.png)
        const { error: batchErr } = await supabase
          .from("inventory_batches")
          .insert([
            {
              product_id: order.product_id,
              batch_date: new Date().toISOString(),
              current_stock: Number(order.quantity), // int4 sa DB
              unit_cost: Number(order.unit_cost || 0), // numeric sa DB
              batch_number: order.order_number || `BAT-${Date.now()}`, // text sa DB
            },
          ]);

        if (batchErr) {
          console.error("Batch Insert Error Details:", batchErr);
          throw new Error("Batch Recording Error: " + batchErr.message);
        }

        console.log("Successfully recorded all data!");
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }

      setEditingId(null);
      fetchOrders();
    } catch (err) {
      console.error("CRITICAL ERROR:", err.message);
      alert("SYSTEM ERROR: " + err.message);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.order_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      filterStatus === "All Statuses" || o.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const normalizeDate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const isSameDate = (a, b) => {
    if (!a || !b) return false;
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  };

  const calendarEvents = useMemo(() => {
    return filteredOrders
      .filter((o) => o.eta)
      .map((o) => ({
        id: String(o.id),
        title: `${o.order_number} • ${o.item_name}`,
        start: o.eta,
        allDay: true,
        extendedProps: { status: o.status },
      }));
  }, [filteredOrders]);

  return (
    <div className='p-8 bg-[#f3f4f6] min-h-screen relative font-sans text-black'>
      {showSuccess && (
        <div className='fixed top-10 left-1/2 -translate-x-1/2 z-[100] bg-black text-white px-8 py-4 rounded-xl font-black shadow-lg flex items-center gap-2 animate-bounce'>
          <CheckCircle2 className='text-emerald-400' /> INVENTORY & BATCHES
          UPDATED
        </div>
      )}

      <style>{`
        .inbound-calendar .fc {
          font-family: inherit;
        }

        .inbound-calendar .fc .fc-toolbar-title {
          font-size: 0.95rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #0f172a;
        }

        .inbound-calendar .fc .fc-button {
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

        .inbound-calendar .fc .fc-button:hover {
          background: #1e293b;
        }

        .inbound-calendar .fc .fc-button:active {
          transform: scale(0.98);
        }

        .inbound-calendar .fc .fc-daygrid-day.fc-day-today {
          background: #eff6ff;
        }

        .inbound-calendar .fc .fc-daygrid-event {
          border: none;
          border-radius: 0.5rem;
          background: #3b82f6;
          padding: 0.1rem 0.35rem;
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.03em;
          cursor: pointer;
          touch-action: manipulation;
        }

        @media (max-width: 768px) {
          .inbound-calendar .fc .fc-toolbar-title {
            font-size: 0.75rem;
            margin: 0.5rem 0;
          }
          .inbound-calendar .fc .fc-button {
            font-size: 0.55rem;
            padding: 0.25rem 0.5rem;
          }
          .inbound-calendar .fc .fc-daygrid-event {
            font-size: 0.5rem;
            padding: 0.05rem 0.25rem;
          }
          .inbound-calendar .fc .fc-col-header-cell {
            padding: 0.25rem 0 !important;
            font-size: 0.7rem;
          }
          .inbound-calendar .fc .fc-daygrid-day-number {
            padding: 0.25rem 0.5rem !important;
            font-size: 0.7rem;
          }
          .inbound-calendar .fc .fc-daygrid-day {
            height: 60px;
          }
        }

        @media (max-width: 640px) {
          .inbound-calendar .fc .fc-toolbar-title {
            font-size: 0.65rem;
            margin: 0.25rem 0;
          }
          .inbound-calendar .fc .fc-button {
            font-size: 0.5rem;
            padding: 0.2rem 0.4rem;
          }
          .inbound-calendar .fc .fc-daygrid-event {
            font-size: 0.45rem;
            padding: 0 0.2rem;
          }
          .inbound-calendar .fc .fc-col-header-cell {
            padding: 0.15rem 0 !important;
            font-size: 0.6rem;
          }
          .inbound-calendar .fc .fc-daygrid-day-number {
            padding: 0.15rem 0.3rem !important;
            font-size: 0.6rem;
          }
          .inbound-calendar .fc .fc-daygrid-day {
            height: 50px;
          }
        }
      `}</style>

      {/* Header */}
      <div className='flex justify-between items-center mb-8'>
        <div>
          <h1 className='text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3'>
            <Truck className='text-teal-600' size={32} /> INBOUND DELIVERY
          </h1>
          <p className='text-slate-600 font-bold text-xs uppercase tracking-[0.2em] mt-2'>
            Supplier Arrivals | Receiving Schedule
          </p>
        </div>
        <div className='flex bg-white rounded-xl p-1 shadow-sm'>
          <button
            onClick={() => setViewMode("table")}
            className={`px-6 py-2 rounded-lg flex items-center gap-2 text-xs font-black uppercase transition-all ${
              viewMode === "table"
                ? "bg-black text-white"
                : "text-black hover:bg-slate-100"
            }`}
          >
            <List size={16} /> Table
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`px-6 py-2 rounded-lg flex items-center gap-2 text-xs font-black uppercase transition-all ${
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
            placeholder='Search Order # or Item...'
            className='w-full pl-12 pr-4 py-4 rounded-2xl font-black uppercase text-xs outline-none focus:bg-yellow-50 transition-all shadow-sm'
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
            className='w-full pl-12 pr-4 py-4 rounded-2xl font-black uppercase text-xs outline-none appearance-none bg-white cursor-pointer shadow-sm'
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option>All Statuses</option>
            <option>Pending</option>
            <option>In Transit</option>
            <option>Arrived</option>
          </select>
        </div>
      </div>

      {viewMode === "table" ? (
        <div className='bg-white rounded-2xl shadow-sm overflow-hidden'>
          <table className='w-full text-left'>
            <thead>
              <tr className='bg-black text-white text-[10px] font-black uppercase'>
                <th className='px-6 py-4'>Order Details</th>
                <th className='px-6 py-4'>ETA</th>
                <th className='px-6 py-4'>Status</th>
                <th className='px-6 py-4 text-right'>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((o) => (
                  <tr
                    key={o.id}
                    className='hover:bg-yellow-50 transition-colors'
                  >
                    <td className='p-6'>
                      <span className='font-mono text-teal-700 font-black text-sm'>
                        #{o.order_number}
                      </span>
                      <p className='font-black uppercase text-lg leading-none mb-2'>
                        {o.item_name}
                      </p>
                      <p className='text-[10px] font-bold text-slate-500 uppercase'>
                        {o.supplier} | Qty: {o.quantity}
                      </p>
                    </td>
                    <td className='p-6'>
                      {editingId === o.id ? (
                        <input
                          type='date'
                          className='rounded-lg p-2 text-sm font-black uppercase w-full'
                          value={editData.eta}
                          onChange={(e) =>
                            setEditData({ ...editData, eta: e.target.value })
                          }
                        />
                      ) : (
                        <div className='text-sm font-black text-slate-700 uppercase'>
                          {o.eta || "TBD"}
                        </div>
                      )}
                    </td>
                    <td className='p-6'>
                      {editingId === o.id ? (
                        <select
                          className='rounded-lg p-2 text-sm font-black uppercase w-full'
                          value={editData.status}
                          onChange={(e) =>
                            setEditData({ ...editData, status: e.target.value })
                          }
                        >
                          <option value='Pending'>Pending</option>
                          <option value='In Transit'>In Transit</option>
                          <option value='Arrived'>Arrived</option>
                        </select>
                      ) : (
                        <span
                          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase ${
                            o.status === "Arrived"
                              ? "bg-emerald-400 text-black"
                              : o.status === "In Transit"
                                ? "bg-teal-400 text-black"
                                : "bg-white text-black"
                          }`}
                        >
                          {o.status}
                        </span>
                      )}
                    </td>
                    <td className='p-6 text-right'>
                      {editingId === o.id ? (
                        <div className='flex justify-end gap-3'>
                          <button
                            onClick={() => handleSave(o.id)}
                            className='bg-emerald-400 p-2 rounded-lg hover:translate-x-[2px] hover:translate-y-[2px] transition-all'
                          >
                            <Save size={24} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className='bg-red-400 p-2 rounded-lg'
                          >
                            <X size={24} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(o.id);
                            setEditData({ eta: o.eta || "", status: o.status });
                          }}
                          className='p-3 hover:bg-slate-100 rounded-xl transition-all'
                        >
                          <Edit3 size={24} strokeWidth={2.5} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan='4'
                    className='p-10 text-center text-xs font-black uppercase text-slate-500'
                  >
                    No inbound schedules found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className='bg-white rounded-2xl p-4 shadow-sm inbound-calendar'>
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
            dateClick={(info) => setSelectedDate(info.date)}
            eventClick={(info) => {
              if (info.event.start) {
                setSelectedDate(info.event.start);
              }
            }}
            eventDisplay='block'
            dayMaxEvents={3}
          />
        </div>
      )}
    </div>
  );
};

export default InboundScheduling;
