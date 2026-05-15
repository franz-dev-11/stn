import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { getSessionUser, getPerformedBy, insertAuditTrail } from "../utils/auditTrail";
import { formatPSTDateTime, getCurrentPSTDateTime } from "../utils/dateTimeUtils";
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
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const InboundScheduling = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [viewMode, setViewMode] = useState("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState(location.state?.filterStatus || "All Statuses");
  const [expandedPOs, setExpandedPOs] = useState(new Set());
  const togglePO = (orderNumber) =>
    setExpandedPOs((prev) => {
      const next = new Set(prev);
      next.has(orderNumber) ? next.delete(orderNumber) : next.add(orderNumber);
      return next;
    });
  const [statusChanged, setStatusChanged] = useState(false);

  useEffect(() => {
    if (location.state?.filterStatus && !statusChanged) {
      setFilterStatus(location.state.filterStatus);
      setStatusChanged(true);
    }
  }, [location.state?.filterStatus]);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ eta: "", status: "" });
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel("inbound-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "order_scheduling" }, fetchOrders)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_orders" }, fetchOrders)
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_batches" }, fetchOrders)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("order_scheduling")
      .select("*")
      .order("date_ordered", { ascending: false });
    setOrders(data || []);
  };

  const handleSave = async (firstItemId) => {
    try {

      // Get all items from the order group
      const groupItems = orders.filter(
        (o) => o.id === firstItemId || 
                (orders.find(item => item.id === firstItemId)?.order_number === o.order_number)
      );

      if (groupItems.length === 0) {
        const firstOrder = orders.find((o) => o.id === firstItemId);
        groupItems.push(firstOrder);
      }

      // Get the order_number from first item
      const orderNumber = orders.find((o) => o.id === firstItemId)?.order_number;
      

      // Fetch created_at from purchase_orders for this order group (by orderNumber)
      let poCreatedAt = null;
      if (editData.status === "Arrived" && orderNumber) {
        const { data: poData, error: poErr } = await supabase
          .from("purchase_orders")
          .select("created_at")
          .eq("po_number", orderNumber)
          .maybeSingle();
        if (poErr) throw new Error("Fetch PO Error: " + poErr.message);
        poCreatedAt = poData?.created_at || null;
      }

      // Update all items in this order group
      for (const order of groupItems) {
        // Get latest data
        const { data: orderData, error: fetchErr } = await supabase
          .from("order_scheduling")
          .select("*")
          .eq("id", order.id)
          .single();

        if (fetchErr) throw new Error("Fetch Order Error: " + fetchErr.message);

        // Check if status is transitioning to Arrived
        const isBecomingArrived =
          editData.status === "Arrived" && orderData.status !== "Arrived";

        // Update the Status
        const { error: statusUpdateErr } = await supabase
          .from("order_scheduling")
          .update({
            eta: editData.eta,
            status: editData.status,
            date_arrived:
              editData.status === "Arrived"
                ? getCurrentPSTDateTime()
                : orderData.date_arrived,
            date_processed:
              editData.status === "Arrived"
                ? (poCreatedAt || orderData.created_at)
                : orderData.date_processed,
          })
          .eq("id", order.id);

        if (statusUpdateErr)
          throw new Error("Status Update Error: " + statusUpdateErr.message);

        // Audit trail — inbound status change
        const statusUser = getSessionUser();
        await insertAuditTrail([{
          action: `INBOUND_STATUS_UPDATE:${editData.status.toUpperCase()}`,
          reference_number: orderNumber,
          product_id: orderData.product_id,
          item_name: orderData.item_name,
          sku: null,
          supplier: orderData.supplier || null,
          quantity: orderData.quantity,
          unit_cost: orderData.unit_cost || 0,
          total_amount: (orderData.quantity || 0) * (orderData.unit_cost || 0),
          performed_by: getPerformedBy(statusUser),
        }]);

        // IF ARRIVED: Record to Inventory and Batches
        if (isBecomingArrived) {
          const batchNumber = `${orderNumber}-${orderData.product_id}`;

          // Guard: skip if this batch was already processed (prevents double-counting
          // if status is changed away from Arrived then back again)
          const { data: existingBatch } = await supabase
            .from("inventory_batches")
            .select("id")
            .eq("batch_number", batchNumber)
            .maybeSingle();

          if (!existingBatch) {
            // Only insert into inventory_batches
            const { error: batchErr } = await supabase
              .from("inventory_batches")
              .insert([
                {
                  product_id: orderData.product_id,
                  batch_number: batchNumber,
                  current_stock: orderData.quantity,
                  batch_date: getCurrentPSTDateTime(),
                  unit_cost: orderData.unit_cost || 0,
                },
              ]);

            if (batchErr)
              throw new Error("Batch Insert Error: " + batchErr.message);

            // Audit trail — stock received into inventory
            const user = getSessionUser();
            await insertAuditTrail([{
              action: "STOCK_IN",
              reference_number: orderNumber,
              product_id: orderData.product_id,
              item_name: orderData.item_name,
              sku: null,
              supplier: orderData.supplier || null,
              quantity: orderData.quantity,
              unit_cost: orderData.unit_cost || 0,
              total_amount: (orderData.quantity || 0) * (orderData.unit_cost || 0),
              performed_by: getPerformedBy(user),
            }]);
          }
        }
      }

      // Sync purchase_orders status with order_scheduling status
      if (orderNumber) {
        const poStatus = editData.status === "Arrived" ? "Received" : editData.status;
        await supabase
          .from("purchase_orders")
          .update({ status: poStatus })
          .eq("po_number", orderNumber);
      }

      alert("Success! Order group updated.");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
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

  const [poCreatedAtMap, setPoCreatedAtMap] = useState({});

  useEffect(() => {
    // Fetch created_at for all unique order_numbers in filteredOrders
    const fetchPOCreatedAts = async () => {
      const uniqueOrderNumbers = Array.from(new Set(filteredOrders.map(o => o.order_number)));
      if (uniqueOrderNumbers.length === 0) {
        setPoCreatedAtMap({});
        return;
      }
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("po_number, created_at")
        .in("po_number", uniqueOrderNumbers);
      if (error) {
        setPoCreatedAtMap({});
        return;
      }
      const map = {};
      for (const row of data) {
        map[row.po_number] = row.created_at;
      }
      setPoCreatedAtMap(map);
    };
    fetchPOCreatedAts();
  }, [filteredOrders]);

  const groupedOrders = useMemo(() => {
    const grouped = {};
    filteredOrders.forEach((order) => {
      const key = order.order_number;
      if (!grouped[key]) {
        grouped[key] = {
          order_number: order.order_number,
          supplier: order.supplier,
          eta: order.eta,
          status: order.status,
          date_ordered: order.date_ordered,
          items: [],
          firstItemId: order.id,
        };
      }
      grouped[key].items.push(order);
    });
    return Object.values(grouped);
  }, [filteredOrders]);

  const calendarEvents = useMemo(() => {
    const statusColors = {
      Pending: { background: '#fbbf24', text: '#000' },
      'In Transit': { background: '#60a5fa', text: '#fff' },
      Arrived: { background: '#4ade80', text: '#000' },
      Received: { background: '#6366f1', text: '#fff' },
      Cancelled: { background: '#9ca3af', text: '#fff' },
    };

    // Group by order_number — one calendar event per PO
    const grouped = {};
    filteredOrders.filter((o) => o.eta).forEach((o) => {
      const key = o.order_number;
      if (!grouped[key]) {
        grouped[key] = { order_number: o.order_number, eta: o.eta, status: o.status, items: [] };
      }
      grouped[key].items.push(o);
    });

    return Object.values(grouped).map((group) => {
      const displayStatus = group.status === 'Cancelled' ? 'Cancelled' : group.status === 'Received' ? 'Received' : group.status === 'Arrived' ? 'Arrived' : group.status === 'In Transit' ? 'In Transit' : 'Pending';
      const colors = statusColors[displayStatus] || { background: '#9ca3af', text: '#fff' };
      return {
        id: group.order_number,
        title: `${group.order_number} · ${group.items.length} item${group.items.length !== 1 ? 's' : ''}`,
        start: group.eta,
        allDay: true,
        backgroundColor: colors.background,
        textColor: colors.text,
        borderColor: colors.background,
        extendedProps: { status: displayStatus, orderNumber: group.order_number },
      };
    });
  }, [filteredOrders]);

  return (
    <div className='p-3 sm:p-4 md:p-6 lg:p-8 bg-[#f3f4f6] min-h-screen relative font-sans text-black overflow-x-hidden'>
      {showSuccess && (
        <div className='fixed top-6 left-1/2 -translate-x-1/2 z-100 w-[calc(100%-1.5rem)] max-w-md bg-black text-white px-4 sm:px-8 py-3 sm:py-4 rounded-xl text-[10px] sm:text-sm font-black shadow-lg flex items-center justify-center gap-2 text-center animate-bounce'>
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
          border: none !important;
          border-radius: 0.5rem;
          padding: 0.1rem 0.35rem;
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.03em;
          cursor: pointer;
          touch-action: manipulation;
        }

        .inbound-calendar .fc-event-title {
          font-weight: 800 !important;
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
      <div className='mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='flex flex-wrap items-center gap-2 sm:gap-3 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight'>
            <Truck className='text-teal-600' size={32} /> STOCKIN DELIVERY
          </h1>
          <p className='mt-2 text-[10px] sm:text-xs font-bold uppercase tracking-[0.14em] sm:tracking-[0.2em] text-slate-600'>
            Supplier Arrivals | Receiving Schedule
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
            placeholder='Search Order # or Item...'
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
            <option>Pending</option>
            <option>In Transit</option>
            <option>Arrived</option>
          </select>
        </div>
      </div>

      {viewMode === "table" ? (
        <div className='bg-white rounded-2xl shadow-sm overflow-hidden'>
          <div className='overflow-x-auto'>
          <table className='w-full min-w-max text-left'>
            <thead>
              <tr className='bg-black text-white text-[10px] font-black uppercase'>
                <th className='px-6 py-4'>Order Details</th>
                <th className='px-6 py-4'>ETA</th>
                <th className='px-6 py-4'>Status</th>
                <th className='px-6 py-4'>Date Processed</th>
                <th className='px-6 py-4 text-right'>Action</th>
              </tr>
            </thead>
            <tbody>
              {groupedOrders.length > 0 ? (
                groupedOrders.map((group) => (
                  <tr
                    key={group.order_number}
                    className='hover:bg-yellow-50 transition-colors'
                  >
                    <td className='p-6'>
                      <button
                        onClick={() => togglePO(group.order_number)}
                        className='flex items-center gap-2 w-full text-left mb-1'
                      >
                        {expandedPOs.has(group.order_number)
                          ? <ChevronDown size={14} className='shrink-0 text-teal-600' />
                          : <ChevronRight size={14} className='shrink-0 text-teal-600' />}
                        <span className='font-mono text-teal-700 font-black text-sm'>
                          #{group.order_number}
                        </span>
                        <span className='font-bold text-[10px] text-slate-500 uppercase'>
                          {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                        </span>
                      </button>
                      {expandedPOs.has(group.order_number) && (
                        <div className='space-y-2 mt-2 pl-5'>
                          {group.items.map((item) => (
                            <div key={item.id} className='text-sm'>
                              <p className='font-black uppercase text-slate-900'>
                                {item.item_name}
                              </p>
                              <p className='text-[10px] font-bold text-slate-500 uppercase'>
                                {group.supplier} | Qty: {item.quantity}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className='p-6'>
                      {editingId === group.firstItemId ? (
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
                          {group.eta || "TBD"}
                        </div>
                      )}
                    </td>
                    <td className='p-6'>
                      {editingId === group.firstItemId ? (
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
                            group.status === 'Arrived'
                              ? 'bg-green-400 text-black'
                              : group.status === 'In Transit'
                              ? 'bg-blue-400 text-white'
                              : group.status === 'Received'
                              ? 'bg-indigo-500 text-white'
                              : group.status === 'Cancelled'
                              ? 'bg-gray-400 text-white'
                              : 'bg-amber-400 text-black'
                          }`}
                        >
                          {group.status}
                        </span>
                      )}
                    </td>
                    <td className='p-6'>
                      <div className='text-sm font-black text-slate-700 uppercase'>
                        {poCreatedAtMap[group.order_number]
                          ? formatPSTDateTime(poCreatedAtMap[group.order_number])
                          : (group.items[0]?.date_processed ? formatPSTDateTime(group.items[0].date_processed) : '—')}
                      </div>
                    </td>
                    <td className='p-6 text-right'>
                      {editingId === group.firstItemId ? (
                        <div className='flex justify-end gap-3'>
                          <button
                            onClick={() => handleSave(group.firstItemId)}
                            className='bg-emerald-400 p-2 rounded-lg hover:translate-x-0.5 hover:translate-y-0.5 transition-all'
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
                      ) : group.status === "Received" ? (
                        <span className='text-[10px] font-black uppercase text-slate-400 px-3 py-1 bg-slate-100 rounded-lg'>
                          Locked
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(group.firstItemId);
                            setEditData({ eta: group.eta || "", status: group.status });
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
                    No stockin schedules found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
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
            eventDisplay='block'
            dayMaxEvents={3}
            eventClick={(info) => {
              const orderNum = info.event.extendedProps.orderNumber;
              navigate("/purchase-history", { state: { orderNumber: orderNum } });
            }}
          />
        </div>
      )}
    </div>
  );
};

export default InboundScheduling;
