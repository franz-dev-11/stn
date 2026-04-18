import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BarChart3,
  Boxes,
  CalendarRange,
  DollarSign,
  FileText,
  Filter,
  Flame,
  AlertTriangle,
  ArrowUpRight,
  Package,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  X,
} from "lucide-react";

const RANGE_OPTIONS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

const REORDER_RANGE_OPTIONS = [
  { label: "Last Month", days: 30 },
  { label: "Last Year", days: 365 },
];

const REORDER_LEAD_TIME_DAYS = 30;
const SERVICE_LEVEL_Z = 1.65;

const PIE_COLORS = ["#14b8a6", "#3b82f6", "#f59e0b", "#ef4444"];

const safeNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(safeNumber(value));

const Dashboard = () => {
  const [inventory, setInventory] = useState([]);
  const [history, setHistory] = useState([]);
  const [inventoryBatches, setInventoryBatches] = useState([]);
  const [salesItems, setSalesItems] = useState([]);
  const [salesTransactions, setSalesTransactions] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [orderScheduling, setOrderScheduling] = useState([]);
  const [productPricing, setProductPricing] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedRange, setSelectedRange] = useState(30);
  const [reorderRange, setReorderRange] = useState(30);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [trendMode, setTrendMode] = useState("units");
  const [reorderPage, setReorderPage] = useState(1);
  const REORDER_PAGE_SIZE = 10;

  const [drillDown, setDrillDown] = useState(null);
  const [reportHTML, setReportHTML] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const reportIframeRef = useRef(null);
  const [reportPickerOpen, setReportPickerOpen] = useState(false);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");

  const openDrill = (title, headers, rows) => setDrillDown({ title, headers, rows });
  const closeDrill = () => setDrillDown(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        invRes,
        histRes,
        batchRes,
        salesItemRes,
        salesRes,
        poRes,
        schedRes,
        pricingRes,
        profilesRes,
        suppliersRes,
      ] = await Promise.all([
        supabase
          .from("hardware_inventory")
          .select(
            "id, sku, name, category, quantity, min_stock_level, inbound_qty, outbound_qty, stock_balance",
          ),
        supabase
          .from("daily_ledger_history")
          .select(
            "snapshot_date, sku, name, category, inbound_qty, outbound_qty, total_value",
          )
          .order("snapshot_date", { ascending: true }),
        supabase.from("inventory_batches").select("product_id, current_stock"),
        supabase
          .from("sales_items")
          .select(
            "product_id, item_name, quantity, unit_price, sales_transactions(created_at, status)",
          ),
        supabase
          .from("sales_transactions")
          .select("id, created_at, status, total_amount")
          .order("created_at", { ascending: true }),
        supabase
          .from("purchase_orders")
          .select("id, created_at, status, total_amount, supplier_name")
          .order("created_at", { ascending: true }),
        supabase
          .from("order_scheduling")
          .select("id, product_id, date_ordered, eta, status, quantity")
          .order("date_ordered", { ascending: true }),
        supabase
          .from("product_pricing")
          .select(
            "product_id, supplier_cost, margin_percent, suggested_srp, manual_retail_price",
          ),
        supabase.from("profiles").select("id, role, approval_status, is_approved"),
        supabase.from("suppliers").select("id"),
      ]);

      if (invRes.error) throw invRes.error;
      if (histRes.error) throw histRes.error;
      if (batchRes.error) throw batchRes.error;
      if (salesItemRes.error) throw salesItemRes.error;
      if (salesRes.error) throw salesRes.error;
      if (poRes.error) throw poRes.error;
      if (schedRes.error) throw schedRes.error;
      if (pricingRes.error) throw pricingRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (suppliersRes.error) throw suppliersRes.error;

      setInventory(invRes.data || []);
      setHistory(histRes.data || []);
      setInventoryBatches(batchRes.data || []);
      setSalesItems(salesItemRes.data || []);
      setSalesTransactions(salesRes.data || []);
      setPurchaseOrders(poRes.data || []);
      setOrderScheduling(schedRes.data || []);
      setProductPricing(pricingRes.data || []);
      setProfiles(profilesRes.data || []);
      setSuppliers(suppliersRes.data || []);
    } catch (fetchError) {
      console.error("Dashboard Load Error:", fetchError.message);
      setError(fetchError.message || "Failed to load dashboard analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const categoryOptions = useMemo(() => {
    const categories = [
      ...new Set(inventory.map((i) => i.category).filter(Boolean)),
    ];
    return ["All", ...categories.sort()];
  }, [inventory]);

  const cutoffDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (selectedRange - 1));
    return d;
  }, [selectedRange]);

  const selectedRangeLabel = useMemo(() => {
    const found = RANGE_OPTIONS.find((range) => range.days === selectedRange);
    return found ? found.label : `Last ${selectedRange} Days`;
  }, [selectedRange]);

  const reorderCutoffDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (reorderRange - 1));
    return d;
  }, [reorderRange]);

  const filteredInventory = useMemo(
    () =>
      selectedCategory === "All"
        ? inventory
        : inventory.filter((item) => item.category === selectedCategory),
    [inventory, selectedCategory],
  );

  const batchStockByProduct = useMemo(() => {
    const map = {};
    inventoryBatches.forEach((batch) => {
      if (!batch.product_id) return;
      map[batch.product_id] =
        (map[batch.product_id] || 0) + safeNumber(batch.current_stock);
    });
    return map;
  }, [inventoryBatches]);

  const filteredInventoryItems = useMemo(
    () =>
      filteredInventory.map((item) => ({
        ...item,
        availableStock: safeNumber(batchStockByProduct[item.id]),
      })),
    [filteredInventory, batchStockByProduct],
  );

  const filteredHistory = useMemo(
    () =>
      history.filter((row) => {
        const rowDate = toDate(row.snapshot_date);
        if (!rowDate || rowDate < cutoffDate) return false;
        if (selectedCategory === "All") return true;
        return row.category === selectedCategory;
      }),
    [history, cutoffDate, selectedCategory],
  );

  const filteredSales = useMemo(
    () =>
      salesTransactions.filter((row) => {
        const rowDate = toDate(row.created_at);
        return rowDate && rowDate >= cutoffDate;
      }),
    [salesTransactions, cutoffDate],
  );

  const filteredPO = useMemo(
    () =>
      purchaseOrders.filter((row) => {
        const rowDate = toDate(row.created_at);
        return rowDate && rowDate >= cutoffDate;
      }),
    [purchaseOrders, cutoffDate],
  );

  const filteredScheduling = useMemo(
    () =>
      orderScheduling.filter((row) => {
        const rowDate = toDate(row.date_ordered);
        return rowDate && rowDate >= cutoffDate;
      }),
    [orderScheduling, cutoffDate],
  );

  const dailyDemandByItem = useMemo(() => {
    const result = {};
    const counts = {};

    filteredHistory.forEach((row) => {
      const key = row.sku || row.name;
      if (!key) return;
      result[key] = (result[key] || 0) + safeNumber(row.outbound_qty);
      counts[key] = (counts[key] || 0) + 1;
    });

    Object.keys(result).forEach((key) => {
      result[key] = counts[key] ? result[key] / counts[key] : 0;
    });

    return result;
  }, [filteredHistory]);

  const stockoutRiskItems = useMemo(() => {
    const list = filteredInventoryItems
      .map((item) => {
        const key = item.sku || item.name;
        const avgDailyDemand = Math.max(
          safeNumber(dailyDemandByItem[key]),
          0.1,
        );
        const runwayDays = safeNumber(item.availableStock) / avgDailyDemand;
        return { ...item, avgDailyDemand, runwayDays };
      })
      .filter((item) => item.availableStock > 0 && item.runwayDays <= 7)
      .sort((a, b) => a.runwayDays - b.runwayDays);

    return list;
  }, [filteredInventoryItems, dailyDemandByItem]);

  const trendData = useMemo(() => {
    const trendMap = {};

    filteredHistory.forEach((row) => {
      const dateKey = row.snapshot_date;
      if (!dateKey) return;
      if (!trendMap[dateKey]) {
        trendMap[dateKey] = {
          date: dateKey,
          inbound: 0,
          outbound: 0,
          inventoryValue: 0,
          salesRevenue: 0,
        };
      }

      trendMap[dateKey].inbound += safeNumber(row.inbound_qty);
      trendMap[dateKey].outbound += safeNumber(row.outbound_qty);
      trendMap[dateKey].inventoryValue += safeNumber(row.total_value);
    });

    filteredSales.forEach((sale) => {
      const d = toDate(sale.created_at);
      if (!d) return;
      const dateKey = d.toISOString().slice(0, 10);
      if (!trendMap[dateKey]) {
        trendMap[dateKey] = {
          date: dateKey,
          inbound: 0,
          outbound: 0,
          inventoryValue: 0,
          salesRevenue: 0,
        };
      }
      trendMap[dateKey].salesRevenue += safeNumber(sale.total_amount);
    });

    return Object.values(trendMap)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((row) => ({
        ...row,
        label: new Date(row.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      }));
  }, [filteredHistory, filteredSales]);

  const inventorySegments = useMemo(
    () => {
      const items = filteredInventoryItems;
      return [
        {
          name: "Healthy",
          value: items.filter(
            (item) =>
              safeNumber(item.availableStock) > safeNumber(item.min_stock_level),
          ).length,
          items: items.filter(i => safeNumber(i.availableStock) > safeNumber(i.min_stock_level)),
        },
        {
          name: "Low Stock",
          value: items.filter(
            (item) =>
              safeNumber(item.availableStock) > 0 &&
              safeNumber(item.availableStock) <= safeNumber(item.min_stock_level),
          ).length,
          items: items.filter(i => safeNumber(i.availableStock) > 0 && safeNumber(i.availableStock) <= safeNumber(i.min_stock_level)),
        },
        {
          name: "Out of Stock",
          value: items.filter(
            (item) => safeNumber(item.availableStock) <= 0,
          ).length,
          items: items.filter(i => safeNumber(i.availableStock) <= 0),
        },
        {
          name: "No Movement",
          value: items.filter((item) => {
            const key = item.sku || item.name;
            return safeNumber(dailyDemandByItem[key]) === 0;
          }).length,
          items: items.filter(i => safeNumber(dailyDemandByItem[i.sku || i.name]) === 0),
        },
      ];
    },
    [filteredInventoryItems, dailyDemandByItem],
  );

  const reorderSignals = useMemo(() => {
    const productDailySales = {};

    salesItems.forEach((row) => {
      const productId = row.product_id;
      const transaction = row.sales_transactions;
      const transactionDate = toDate(transaction?.created_at);
      const transactionStatus = transaction?.status;

      if (!productId || !transactionDate) return;
      if ((transactionStatus || "").toLowerCase() === "cancelled") return;
      if (transactionDate < reorderCutoffDate) return;

      const dayKey = transactionDate.toISOString().slice(0, 10);
      if (!productDailySales[productId]) {
        productDailySales[productId] = {};
      }

      productDailySales[productId][dayKey] =
        (productDailySales[productId][dayKey] || 0) + safeNumber(row.quantity);
    });

    const rows = filteredInventoryItems
      .map((item) => {
        const productDays = productDailySales[item.id] || {};
        const dayValues = [];

        for (let i = 0; i < reorderRange; i += 1) {
          const day = new Date(reorderCutoffDate);
          day.setDate(reorderCutoffDate.getDate() + i);
          const dayKey = day.toISOString().slice(0, 10);
          dayValues.push(safeNumber(productDays[dayKey]));
        }

        const avgDailyDemand =
          dayValues.reduce((sum, value) => sum + value, 0) /
          Math.max(reorderRange, 1);

        const variance =
          dayValues.reduce(
            (sum, value) => sum + (value - avgDailyDemand) ** 2,
            0,
          ) / Math.max(reorderRange, 1);
        const stdDev = Math.sqrt(variance);

        const leadTimeDemand = avgDailyDemand * REORDER_LEAD_TIME_DAYS;
        const safetyStock =
          SERVICE_LEVEL_Z * stdDev * Math.sqrt(REORDER_LEAD_TIME_DAYS);
        const computedRop = Math.ceil(leadTimeDemand + safetyStock);
        const minLevel = safeNumber(item.min_stock_level);
        const reorderPoint = Math.max(computedRop, minLevel);
        const availStock = safeNumber(item.availableStock);

        // If no sales history, fall back to min_stock_level comparison;
        // if min_stock_level also isn't set, use 10% of stock_balance as a soft floor
        const effectiveFloor = minLevel > 0
          ? minLevel
          : Math.ceil(safeNumber(item.stock_balance) * 0.1);
        const reorderQty = reorderPoint > 0
          ? Math.max(0, reorderPoint - availStock)
          : Math.max(0, effectiveFloor - availStock);

        let cls = { label: "C", color: "bg-slate-100 text-slate-700" };
        if (avgDailyDemand >= 10) {
          cls = { label: "A", color: "bg-rose-100 text-rose-700" };
        } else if (avgDailyDemand >= 4) {
          cls = { label: "B", color: "bg-amber-100 text-amber-700" };
        }

        return {
          ...item,
          avgDailyDemand,
          salesStdDev: stdDev,
          leadTimeDemand,
          safetyStock,
          reorderPoint: reorderPoint || effectiveFloor,
          reorderQty,
          cls,
        };
      })
      .sort((a, b) => b.reorderQty - a.reorderQty);

    return rows;
  }, [filteredInventoryItems, salesItems, reorderCutoffDate, reorderRange]);

  const kpis = useMemo(() => {
    const onHand = filteredInventoryItems.reduce(
      (sum, item) => sum + safeNumber(item.availableStock),
      0,
    );
    const stockBalance = filteredInventoryItems.reduce(
      (sum, item) => sum + safeNumber(item.stock_balance),
      0,
    );
    const revenue = filteredSales.reduce(
      (sum, row) => sum + safeNumber(row.total_amount),
      0,
    );
    const procurementSpend = filteredPO.reduce(
      (sum, row) => sum + safeNumber(row.total_amount),
      0,
    );
    const completedSales = filteredSales.filter(
      (row) => row.status === "Completed",
    ).length;
    const completionRate = filteredSales.length
      ? (completedSales / filteredSales.length) * 100
      : 0;

    const pendingInbound = filteredScheduling.filter((row) =>
      ["Pending", "In Transit"].includes(row.status),
    ).length;

    return {
      onHand,
      stockBalance,
      revenue,
      procurementSpend,
      completionRate,
      pendingInbound,
      lowStock: inventorySegments[1]?.value || 0,
      risky: stockoutRiskItems.length,
    };
  }, [
    filteredInventoryItems,
    filteredPO,
    filteredSales,
    filteredScheduling,
    inventorySegments,
    stockoutRiskItems.length,
  ]);

  const pendingInboundByProduct = useMemo(() => {
    const map = {};
    orderScheduling.forEach((row) => {
      if (!row.product_id) return;
      const status = (row.status || "").toLowerCase();
      if (!["pending", "in transit"].includes(status)) return;
      map[row.product_id] =
        (map[row.product_id] || 0) + Math.max(0, safeNumber(row.quantity));
    });
    return map;
  }, [orderScheduling]);

  const inventoryValueByCategory = useMemo(() => {
    const pricingByProduct = {};
    productPricing.forEach((row) => {
      if (!row.product_id) return;
      const retail =
        safeNumber(row.manual_retail_price) || safeNumber(row.suggested_srp);
      pricingByProduct[row.product_id] = {
        cost: safeNumber(row.supplier_cost),
        retail,
      };
    });

    const byCategory = {};
    filteredInventoryItems.forEach((item) => {
      const category = item.category || "Uncategorized";
      if (!byCategory[category]) {
        byCategory[category] = { category, costValue: 0, retailValue: 0 };
      }

      const pricing = pricingByProduct[item.id] || { cost: 0, retail: 0 };
      const available = safeNumber(item.availableStock);
      byCategory[category].costValue += available * pricing.cost;
      byCategory[category].retailValue += available * pricing.retail;
    });

    return Object.values(byCategory)
      .sort((a, b) => b.retailValue - a.retailValue)
      .slice(0, 6)
      .map((row) => ({
        ...row,
        label: row.category.length > 12 ? `${row.category.slice(0, 12)}...` : row.category,
      }));
  }, [filteredInventoryItems, productPricing]);

  const erpOps = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const openSalesOrders = filteredSales.filter((row) => {
      const status = (row.status || "").toLowerCase();
      return status !== "completed";
    }).length;

    const openPurchaseOrders = filteredPO.filter((row) => {
      const status = (row.status || "").toLowerCase();
      return status !== "completed" && status !== "received";
    }).length;

    const overdueInbound = filteredScheduling.filter((row) => {
      const status = (row.status || "").toLowerCase();
      const eta = toDate(row.eta);
      if (!["pending", "in transit"].includes(status) || !eta) return false;
      eta.setHours(0, 0, 0, 0);
      return eta < today;
    }).length;

    const lowCoverageSkus = filteredInventoryItems.filter((item) => {
      const available = safeNumber(item.availableStock);
      const minimum = safeNumber(item.min_stock_level);
      const inbound = safeNumber(pendingInboundByProduct[item.id]);
      return available + inbound <= minimum;
    }).length;

    const pendingApprovals = profiles.filter((profile) => {
      const approvalStatus = (profile.approval_status || "").toLowerCase();
      return !profile.is_approved || approvalStatus === "pending";
    }).length;

    const supplierCoverage = suppliers.length;

    const statusRows = [
      {
        lane: "Sales",
        pending: filteredSales.filter(
          (row) => (row.status || "").toLowerCase() === "pending",
        ).length,
        inProgress: filteredSales.filter(
          (row) => (row.status || "").toLowerCase() === "in transit",
        ).length,
        done: filteredSales.filter(
          (row) => (row.status || "").toLowerCase() === "completed",
        ).length,
      },
      {
        lane: "Inbound",
        pending: filteredScheduling.filter(
          (row) => (row.status || "").toLowerCase() === "pending",
        ).length,
        inProgress: filteredScheduling.filter(
          (row) => (row.status || "").toLowerCase() === "in transit",
        ).length,
        done: filteredScheduling.filter((row) => {
          const status = (row.status || "").toLowerCase();
          return status === "completed" || status === "arrived";
        }).length,
      },
      {
        lane: "Procurement",
        pending: filteredPO.filter(
          (row) => (row.status || "").toLowerCase() === "pending",
        ).length,
        inProgress: filteredPO.filter((row) => {
          const status = (row.status || "").toLowerCase();
          return ["approved", "in progress", "processing"].includes(status);
        }).length,
        done: filteredPO.filter((row) => {
          const status = (row.status || "").toLowerCase();
          return status === "completed" || status === "received";
        }).length,
      },
    ];

    const supplierSpendRows = Object.entries(
      filteredPO.reduce((acc, row) => {
        const key = row.supplier_name || "Unknown Supplier";
        acc[key] = (acc[key] || 0) + safeNumber(row.total_amount);
        return acc;
      }, {}),
    )
      .map(([supplierName, spend]) => ({
        supplierName,
        spend,
        label:
          supplierName.length > 14
            ? `${supplierName.slice(0, 14)}...`
            : supplierName,
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);

    return {
      openSalesOrders,
      openPurchaseOrders,
      overdueInbound,
      lowCoverageSkus,
      pendingApprovals,
      supplierCoverage,
      statusRows,
      supplierSpendRows,
    };
  }, [
    filteredInventoryItems,
    filteredPO,
    filteredSales,
    filteredScheduling,
    pendingInboundByProduct,
    profiles,
    suppliers.length,
  ]);

  const salesStatusMix = useMemo(() => {
    const counts = filteredSales.reduce(
      (acc, row) => {
        const status = (row.status || "Pending").toLowerCase();
        if (status === "completed") acc.completed += 1;
        else if (status === "in transit") acc.inTransit += 1;
        else acc.pending += 1;
        return acc;
      },
      { pending: 0, inTransit: 0, completed: 0 },
    );

    return [
      { name: "Pending", value: counts.pending },
      { name: "In Transit", value: counts.inTransit },
      { name: "Completed", value: counts.completed },
    ];
  }, [filteredSales]);

  const etaBucketData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets = {
      Overdue: 0,
      "0-7d": 0,
      "8-14d": 0,
      "15+d": 0,
      Unknown: 0,
    };

    filteredScheduling.forEach((row) => {
      const status = (row.status || "").toLowerCase();
      if (!["pending", "in transit"].includes(status)) return;

      const qty = Math.max(0, safeNumber(row.quantity));
      const eta = toDate(row.eta);
      if (!eta) {
        buckets.Unknown += qty;
        return;
      }

      eta.setHours(0, 0, 0, 0);
      const dayDiff = Math.floor((eta - today) / (1000 * 60 * 60 * 24));
      if (dayDiff < 0) buckets.Overdue += qty;
      else if (dayDiff <= 7) buckets["0-7d"] += qty;
      else if (dayDiff <= 14) buckets["8-14d"] += qty;
      else buckets["15+d"] += qty;
    });

    return Object.entries(buckets).map(([bucket, quantity]) => ({
      bucket,
      quantity,
    }));
  }, [filteredScheduling]);

  const reorderPressureData = useMemo(
    () =>
      reorderSignals
        .slice(0, 8)
        .map((item) => ({
          label: item.name.length > 12 ? `${item.name.slice(0, 12)}...` : item.name,
          reorderQty: safeNumber(item.reorderQty),
          availableStock: safeNumber(item.availableStock),
        })),
    [reorderSignals],
  );

  const demandForecast = useMemo(() => {
    if (!filteredInventoryItems.length) return { data: [] };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowDays = 30;
    const start = new Date(today);
    start.setDate(today.getDate() - (windowDays - 1));
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Aggregate actual daily sales across ALL items
    const actualByDay = {};
    salesItems.forEach((row) => {
      const tx = row.sales_transactions;
      if ((tx?.status || "").toLowerCase() === "cancelled") return;
      const txDate = toDate(tx?.created_at);
      if (!txDate || txDate < start || txDate >= tomorrow) return;
      const key = txDate.toISOString().slice(0, 10);
      actualByDay[key] = (actualByDay[key] || 0) + safeNumber(row.quantity);
    });

    // Projected: sum of all items' historical avg daily demand
    const totalProjectedDaily = filteredInventoryItems.reduce((sum, item) => {
      return sum + safeNumber(dailyDemandByItem[item.sku || item.name]);
    }, 0);

    const totalActual = Object.values(actualByDay).reduce((s, v) => s + v, 0);
    const projectedDailyRate = totalProjectedDaily > 0 ? totalProjectedDaily : totalActual / windowDays || 1;

    // Build daily rows: actual units sold each day vs projected daily rate
    const rows = [];
    for (let i = 0; i < windowDays; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      rows.push({
        date: key,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        actual: safeNumber(actualByDay[key]),
        projected: parseFloat(projectedDailyRate.toFixed(1)),
      });
    }

    return { data: rows };
  }, [filteredInventoryItems, salesItems, dailyDemandByItem]);

  const topSellingProducts = useMemo(() => {
    const totals = {};
    salesItems.forEach((row) => {
      const tx = row.sales_transactions;
      if ((tx?.status || "").toLowerCase() === "cancelled") return;
      const key = row.product_id || row.item_name || "Unknown";
      const cleanName = (row.item_name || key).replace(/\s*\(.*?\)\s*$/, "").trim();
      if (!totals[key]) totals[key] = { name: cleanName, qty: 0, revenue: 0 };
      totals[key].qty += safeNumber(row.quantity);
      totals[key].revenue += safeNumber(row.quantity) * safeNumber(row.unit_price);
    });
    return Object.values(totals).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [salesItems]);

  const generateReport = (fromStr, toStr) => {
    const now = new Date();
    const reportDate = now.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
    const reportTime = now.toLocaleTimeString("en-PH");

    // ── Date range setup ──
    const rFrom = fromStr ? new Date(fromStr + "T00:00:00") : null;
    const rTo   = toStr   ? new Date(toStr   + "T23:59:59") : null;
    const inRange = (dateVal) => {
      const d = toDate(dateVal);
      if (!d) return false;
      return (!rFrom || d >= rFrom) && (!rTo || d <= rTo);
    };
    const rangeLabel = rFrom || rTo
      ? [rFrom ? rFrom.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "Start",
         rTo   ? rTo.toLocaleDateString("en-PH",   { year: "numeric", month: "short", day: "numeric" }) : "Today"].join(" – ")
      : "All Time";

    // ── Report-scoped filtered arrays ──
    const rSales = salesTransactions.filter(r => inRange(r.created_at));
    const rPO    = purchaseOrders.filter(r => inRange(r.created_at));
    const rSched = orderScheduling.filter(r => inRange(r.date_ordered));

    // ── Report-scoped KPIs ──
    const rOnHand       = filteredInventoryItems.reduce((s, i) => s + safeNumber(i.availableStock), 0);
    const rStockBal     = filteredInventoryItems.reduce((s, i) => s + safeNumber(i.stock_balance), 0);
    const rRevenue      = rSales.reduce((s, r) => s + safeNumber(r.total_amount), 0);
    const rSpend        = rPO.reduce((s, r) => s + safeNumber(r.total_amount), 0);
    const rCompleted    = rSales.filter(r => (r.status || "").toLowerCase() === "completed").length;
    const rCompRate     = rSales.length ? (rCompleted / rSales.length) * 100 : 0;
    const rPendingInb   = rSched.filter(r => ["pending","in transit"].includes((r.status || "").toLowerCase())).length;
    const rOpenSales    = rSales.filter(r => (r.status || "").toLowerCase() !== "completed").length;
    const rOpenPO       = rPO.filter(r => { const st = (r.status || "").toLowerCase(); return st !== "completed" && st !== "received"; }).length;
    const today0r = new Date(); today0r.setHours(0,0,0,0);
    const rOverdue      = rSched.filter(r => { const st = (r.status || "").toLowerCase(); const eta = toDate(r.eta); if (!eta || !["pending","in transit"].includes(st)) return false; eta.setHours(0,0,0,0); return eta < today0r; }).length;
    const rLowCoverage  = filteredInventoryItems.filter(i => { const avail = safeNumber(i.availableStock); const min = safeNumber(i.min_stock_level); const inb = safeNumber(pendingInboundByProduct[i.id]); return avail + inb <= min; }).length;

    // ── Report-scoped order status by lane ──
    const rStatusRows = [
      { lane: "Sales",
        pending:    rSales.filter(r => (r.status || "").toLowerCase() === "pending").length,
        inProgress: rSales.filter(r => (r.status || "").toLowerCase() === "in transit").length,
        done:       rSales.filter(r => (r.status || "").toLowerCase() === "completed").length },
      { lane: "Inbound",
        pending:    rSched.filter(r => (r.status || "").toLowerCase() === "pending").length,
        inProgress: rSched.filter(r => (r.status || "").toLowerCase() === "in transit").length,
        done:       rSched.filter(r => ["completed","arrived"].includes((r.status || "").toLowerCase())).length },
      { lane: "Procurement",
        pending:    rPO.filter(r => (r.status || "").toLowerCase() === "pending").length,
        inProgress: rPO.filter(r => ["approved","in progress","processing"].includes((r.status || "").toLowerCase())).length,
        done:       rPO.filter(r => ["completed","received"].includes((r.status || "").toLowerCase())).length },
    ];

    const esc = (v) => String(v ?? "—").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const th = (txt, align = "left") => `<th style="text-align:${align}">${esc(txt)}</th>`;
    const td = (txt, align = "left", style = "") => `<td style="text-align:${align};${style}">${txt ?? "—"}</td>`;
    const badge = (txt, color) => `<span class="badge" style="background:${color}20;color:${color};border:1px solid ${color}40">${esc(txt)}</span>`;

    const section = (num, title, subtitle, content) => `
      <div class="section">
        <div class="section-header">
          <div class="section-num">${num}</div>
          <div>
            <div class="section-title">${title}</div>
            ${subtitle ? `<div class="section-sub">${subtitle}</div>` : ""}
          </div>
        </div>
        ${content}
      </div>`;

    const table = (headCols, bodyRows, emptyMsg = "No data available") => `
      <div class="table-wrap">
        <table>
          <thead><tr>${headCols.join("")}</tr></thead>
          <tbody>${bodyRows || `<tr><td colspan="${headCols.length}" class="empty">${emptyMsg}</td></tr>`}</tbody>
        </table>
      </div>`;

    const kpiGrid = (items) => `
      <div class="kpi-grid">
        ${items.map(([label, value, sub, color]) => `
          <div class="kpi-card" style="border-top:3px solid ${color || "#0d9488"}">
            <div class="kpi-label">${esc(label)}</div>
            <div class="kpi-value" style="color:${color || "#0f172a"}">${esc(value)}</div>
            ${sub ? `<div class="kpi-sub">${esc(sub)}</div>` : ""}
          </div>`).join("")}
      </div>`;

    // ── SECTION 1: Executive Summary KPIs ──
    const sec1 = kpiGrid([
      ["Total Items on Hand",    rOnHand.toLocaleString(),           `Stock balance: ${rStockBal.toLocaleString()}`,    "#0d9488"],
      ["Sales Revenue",          formatCurrency(rRevenue),           rangeLabel,                                        "#10b981"],
      ["Procurement Spend",      formatCurrency(rSpend),             `${rPendingInb} pending inbound`,                  "#8b5cf6"],
      ["Completion Rate",        `${rCompRate.toFixed(1)}%`,         `${rSales.length} total orders`,                   "#3b82f6"],
      ["Open Sales Orders",      rOpenSales.toLocaleString(),        "Not yet completed",                               "#f59e0b"],
      ["Open Purchase Orders",   rOpenPO.toLocaleString(),           "Pending or processing",                           "#f97316"],
      ["Overdue Inbound",        rOverdue.toLocaleString(),          "Past ETA date",                                   "#ef4444"],
      ["Stockout Risk Items",    kpis.risky.toLocaleString(),        "≤ 7 days runway (current)",                       "#dc2626"],
      ["Low Stock Items",        kpis.lowStock.toLocaleString(),     "Below minimum level (current)",                   "#f59e0b"],
      ["Items Below Safe Level", rLowCoverage.toLocaleString(),      "Including pending inbound",                       "#ef4444"],
      ["Supplier Count",         erpOps.supplierCoverage.toLocaleString(), "Active suppliers on file",               "#64748b"],
      ["Pending Approvals",      erpOps.pendingApprovals.toLocaleString(), "Awaiting account approval",              "#94a3b8"],
    ]);

    // ── SECTION 2: Full Inventory Listing ──
    const pricingMap = {};
    productPricing.forEach(r => {
      pricingMap[r.product_id] = {
        cost: safeNumber(r.supplier_cost),
        retail: safeNumber(r.manual_retail_price) || safeNumber(r.suggested_srp),
      };
    });
    const inventoryRows = [...filteredInventoryItems]
      .sort((a, b) => (a.category || "").localeCompare(b.category || "") || (a.name || "").localeCompare(b.name || ""))
      .map(item => {
        const p = pricingMap[item.id] || { cost: 0, retail: 0 };
        const stock = safeNumber(item.availableStock);
        const minLvl = safeNumber(item.min_stock_level);
        const statusTxt = stock <= 0 ? "Out of Stock" : stock <= minLvl ? "Low Stock" : "Healthy";
        const statusColor = stock <= 0 ? "#ef4444" : stock <= minLvl ? "#f59e0b" : "#10b981";
        return `<tr>
          ${td(item.name)}
          ${td(item.sku || "—", "left", "font-family:monospace;font-size:9.5px;color:#64748b")}
          ${td(item.category || "—")}
          ${td(stock, "right")}
          ${td(minLvl || "—", "right")}
          ${td(safeNumber(item.inbound_qty), "right", "color:#0d9488;font-weight:700")}
          ${td(safeNumber(item.outbound_qty), "right", "color:#f97316;font-weight:700")}
          ${td(safeNumber(item.stock_balance), "right", "font-weight:800")}
          ${td(p.retail > 0 ? formatCurrency(p.retail) : "—", "right")}
          ${td(p.retail > 0 ? formatCurrency(stock * p.retail) : "—", "right", "font-weight:800")}
          <td style="text-align:center">${badge(statusTxt, statusColor)}</td>
        </tr>`;
      }).join("");
    const totalRetailVal = filteredInventoryItems.reduce((s, item) => {
      const p = pricingMap[item.id] || { retail: 0 };
      return s + safeNumber(item.availableStock) * p.retail;
    }, 0);
    const sec2 = table(
      [th("#", "center"), th("Item Name"), th("SKU"), th("Category"), th("Stock", "right"), th("Min Level", "right"), th("In (+)", "right"), th("Out (−)", "right"), th("Balance", "right"), th("Unit Price", "right"), th("Stock Value", "right"), th("Status", "center")].slice(1),
      inventoryRows || "",
      "No inventory data"
    ) + `<div class="table-footer">Total Retail Inventory Value: <strong>${formatCurrency(totalRetailVal)}</strong> &nbsp;|&nbsp; ${filteredInventoryItems.length} SKUs listed</div>`;

    // ── SECTION 3: Sales Transactions ──
    const salesRows = [...rSales]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map((s, i) => {
        const stColor = (s.status || "").toLowerCase() === "completed" ? "#10b981" : (s.status || "").toLowerCase() === "in transit" ? "#3b82f6" : "#f59e0b";
        return `<tr>
          ${td(i + 1, "center")}
          ${td(new Date(s.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }))}
          ${td(new Date(s.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }))}
          <td style="text-align:center">${badge(s.status || "Pending", stColor)}</td>
          ${td(formatCurrency(s.total_amount), "right", "font-weight:800")}
        </tr>`;
      }).join("");
    const totalSalesAmt = rSales.reduce((s, r) => s + safeNumber(r.total_amount), 0);
    const completedSalesAmt = rSales.filter(r => (r.status || "").toLowerCase() === "completed").reduce((s, r) => s + safeNumber(r.total_amount), 0);
    const sec3 = table(
      [th("#", "center"), th("Date"), th("Time"), th("Status", "center"), th("Amount", "right")],
      salesRows || "",
      "No sales in selected period"
    ) + `<div class="table-footer">Total: <strong>${formatCurrency(totalSalesAmt)}</strong> &nbsp;|&nbsp; Completed: <strong>${formatCurrency(completedSalesAmt)}</strong> &nbsp;|&nbsp; ${rSales.length} transactions &nbsp;|&nbsp; Completion rate: <strong>${rCompRate.toFixed(1)}%</strong></div>`;

    // ── SECTION 4: Top Selling Products ──
    const totalRevAll = topSellingProducts.reduce((s, p) => s + p.revenue, 0);
    const topRows = topSellingProducts.map((p, i) => {
      const pct = totalRevAll > 0 ? ((p.revenue / totalRevAll) * 100).toFixed(1) : "0.0";
      return `<tr>
        ${td(i + 1, "center")}
        ${td(p.name)}
        ${td(p.qty.toLocaleString(), "right", "font-weight:800")}
        ${td(formatCurrency(p.revenue), "right", "font-weight:800")}
        ${td(`${pct}%`, "right")}
      </tr>`;
    }).join("");
    const sec4 = table(
      [th("#", "center"), th("Product"), th("Units Sold", "right"), th("Revenue", "right"), th("% of Total", "right")],
      topRows || "",
      "No sales data in selected period"
    ) + (topSellingProducts.length ? `<div class="table-footer">Combined Revenue: <strong>${formatCurrency(totalRevAll)}</strong></div>` : "");

    // ── SECTION 5: Sales Items Detail ──
    const itemSalesMap = {};
    salesItems.forEach(row => {
      const tx = row.sales_transactions;
      if ((tx?.status || "").toLowerCase() === "cancelled") return;
      if (!inRange(tx?.created_at)) return;
      const key = row.product_id || row.item_name || "Unknown";
      const cleanName = (row.item_name || key).replace(/\s*\(.*?\)\s*$/, "").trim();
      if (!itemSalesMap[key]) itemSalesMap[key] = { name: cleanName, qty: 0, revenue: 0, txCount: 0 };
      itemSalesMap[key].qty += safeNumber(row.quantity);
      itemSalesMap[key].revenue += safeNumber(row.quantity) * safeNumber(row.unit_price);
      itemSalesMap[key].txCount += 1;
    });
    const itemSalesRows = Object.values(itemSalesMap)
      .sort((a, b) => b.qty - a.qty)
      .map((p, i) => `<tr>
        ${td(i + 1, "center")}
        ${td(p.name)}
        ${td(p.txCount, "right")}
        ${td(p.qty.toLocaleString(), "right", "font-weight:800")}
        ${td(formatCurrency(p.revenue), "right", "font-weight:800")}
        ${td(p.qty > 0 ? formatCurrency(p.revenue / p.qty) : "—", "right")}
      </tr>`).join("");
    const sec5 = table(
      [th("#", "center"), th("Product"), th("Transactions", "right"), th("Units Sold", "right"), th("Total Revenue", "right"), th("Avg Unit Price", "right")],
      itemSalesRows || "",
      "No item-level sales data in selected period"
    ) + `<div class="table-footer">${Object.keys(itemSalesMap).length} products sold in this period</div>`;

    // ── SECTION 6: Purchase Orders ──
    const poRows = [...rPO]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map((p, i) => {
        const stColor = ["completed","received"].includes((p.status || "").toLowerCase()) ? "#10b981" : ["approved","in progress","processing"].includes((p.status || "").toLowerCase()) ? "#3b82f6" : "#f59e0b";
        return `<tr>
          ${td(i + 1, "center")}
          ${td(new Date(p.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }))}
          ${td(esc(p.supplier_name) || "—")}
          <td style="text-align:center">${badge(p.status || "Pending", stColor)}</td>
          ${td(formatCurrency(p.total_amount), "right", "font-weight:800")}
        </tr>`;
      }).join("");
    const totalPOAmt = rPO.reduce((s, r) => s + safeNumber(r.total_amount), 0);
    const sec6 = table(
      [th("#", "center"), th("Date"), th("Supplier"), th("Status", "center"), th("Amount", "right")],
      poRows || "",
      "No purchase orders in selected period"
    ) + `<div class="table-footer">Total Procurement Spend: <strong>${formatCurrency(totalPOAmt)}</strong> &nbsp;|&nbsp; ${rPO.length} orders</div>`;

    // ── SECTION 7: Inbound Scheduling ──
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const schedRows = [...rSched]
      .sort((a, b) => {
        const etaA = toDate(a.eta); const etaB = toDate(b.eta);
        if (!etaA && !etaB) return 0;
        if (!etaA) return 1;
        if (!etaB) return -1;
        return etaA - etaB;
      })
      .map((s, i) => {
        const inv = inventory.find(item => item.id === s.product_id);
        const eta = toDate(s.eta);
        const daysLeft = eta ? Math.floor((new Date(eta).setHours(0,0,0,0) - today0.getTime()) / 86400000) : null;
        const etaLabel = daysLeft === null ? "—" : daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Today" : `in ${daysLeft}d`;
        const etaColor = daysLeft === null ? "#94a3b8" : daysLeft < 0 ? "#ef4444" : daysLeft <= 3 ? "#f59e0b" : "#10b981";
        const stColor = (s.status || "").toLowerCase() === "arrived" ? "#10b981" : (s.status || "").toLowerCase() === "in transit" ? "#3b82f6" : "#f59e0b";
        return `<tr>
          ${td(i + 1, "center")}
          ${td(esc(inv?.name) || s.product_id || "—")}
          ${td(esc(inv?.sku) || "—", "left", "font-family:monospace;font-size:9.5px;color:#64748b")}
          <td style="text-align:center">${badge(s.status || "Pending", stColor)}</td>
          ${td(s.date_ordered ? new Date(s.date_ordered).toLocaleDateString("en-PH") : "—")}
          ${td(eta ? eta.toLocaleDateString("en-PH") : "—")}
          <td style="text-align:center;font-weight:700;color:${etaColor}">${etaLabel}</td>
          ${td(safeNumber(s.quantity), "right", "font-weight:800")}
        </tr>`;
      }).join("");
    const sec7 = table(
      [th("#", "center"), th("Product"), th("SKU"), th("Status", "center"), th("Ordered"), th("ETA"), th("Arriving", "center"), th("Qty", "right")],
      schedRows || "",
      "No inbound orders in selected period"
    ) + `<div class="table-footer">${rSched.length} scheduled orders &nbsp;|&nbsp; ${rOverdue} overdue</div>`;

    // ── SECTION 8: Supplier Spend Analysis ──
    const allSupplierSpend = Object.entries(
      rPO.reduce((acc, row) => {
        const key = row.supplier_name || "Unknown Supplier";
        acc[key] = (acc[key] || 0) + safeNumber(row.total_amount);
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1]);
    const supplierRows = allSupplierSpend.map(([ name, spend ], i) => {
      const pct = totalPOAmt > 0 ? ((spend / totalPOAmt) * 100).toFixed(1) : "0.0";
      return `<tr>
        ${td(i + 1, "center")}
        ${td(esc(name))}
        ${td(formatCurrency(spend), "right", "font-weight:800")}
        ${td(`${pct}%`, "right")}
      </tr>`;
    }).join("");
    const sec8 = table(
      [th("#", "center"), th("Supplier"), th("Total Spend", "right"), th("% of Total", "right")],
      supplierRows || "",
      "No supplier spend in selected period"
    ) + (allSupplierSpend.length ? `<div class="table-footer">Total: <strong>${formatCurrency(totalPOAmt)}</strong> across ${allSupplierSpend.length} suppliers</div>` : "");

    // ── SECTION 9: Full Reorder Intelligence ──
    const reorderRows = reorderSignals.map((item, i) => {
      const needsRestock = item.reorderQty > 0;
      const clsColor = item.cls.label === "A" ? "#ef4444" : item.cls.label === "B" ? "#f59e0b" : "#64748b";
      return `<tr style="${needsRestock ? "" : "color:#94a3b8"}">
        ${td(i + 1, "center")}
        ${td(esc(item.name))}
        ${td(item.category || "—")}
        <td style="text-align:center">${badge(item.cls.label, clsColor)}</td>
        ${td(safeNumber(item.availableStock), "right")}
        ${td(item.reorderPoint || "—", "right")}
        ${td(item.avgDailyDemand.toFixed(2), "right")}
        ${td(Math.ceil(safeNumber(item.safetyStock)), "right")}
        ${td(needsRestock ? `<strong style="color:#f97316">+${item.reorderQty}</strong>` : `<span style="color:#10b981">✓ OK</span>`, "right")}
      </tr>`;
    }).join("");
    const needRestockCount = reorderSignals.filter(i => i.reorderQty > 0).length;
    const sec9 = table(
      [th("#", "center"), th("Product"), th("Category"), th("Class", "center"), th("Stock", "right"), th("Reorder Point", "right"), th("Avg Daily Sales", "right"), th("Safety Stock", "right"), th("Action", "right")],
      reorderRows || "",
      "No items to analyze"
    ) + `<div class="table-footer">${needRestockCount} items need restocking &nbsp;|&nbsp; ${reorderSignals.length - needRestockCount} items healthy</div>`;

    // ── SECTION 10: Stockout Risk ──
    const riskRows = stockoutRiskItems.map((item, i) => {
      const urgencyColor = item.runwayDays <= 2 ? "#dc2626" : item.runwayDays <= 4 ? "#ef4444" : "#f59e0b";
      return `<tr>
        ${td(i + 1, "center")}
        ${td(esc(item.name))}
        ${td(item.category || "—")}
        ${td(item.sku || "—", "left", "font-family:monospace;font-size:9.5px;color:#64748b")}
        ${td(safeNumber(item.availableStock), "right")}
        ${td(safeNumber(item.min_stock_level) || "—", "right")}
        ${td(item.avgDailyDemand.toFixed(2), "right")}
        <td style="text-align:center"><span style="font-weight:900;color:${urgencyColor}">${item.runwayDays.toFixed(1)} days</span></td>
      </tr>`;
    }).join("");
    const sec10 = table(
      [th("#", "center"), th("Product"), th("Category"), th("SKU"), th("Current Stock", "right"), th("Min Level", "right"), th("Avg Daily Sales", "right"), th("Runway", "center")],
      riskRows || "",
      "No urgent stockout risk in selected filters"
    );

    // ── SECTION 11: Stock Health + Category Value ──
    const healthRows = inventorySegments.map(seg => {
      const pct = filteredInventoryItems.length > 0 ? ((seg.value / filteredInventoryItems.length) * 100).toFixed(1) : "0.0";
      const color = seg.name === "Healthy" ? "#10b981" : seg.name === "Low Stock" ? "#f59e0b" : seg.name === "Out of Stock" ? "#ef4444" : "#94a3b8";
      return `<tr>
        <td style="text-align:left"><span class="badge" style="background:${color}20;color:${color};border:1px solid ${color}40">${seg.name}</span></td>
        ${td(seg.value, "right", "font-weight:800")}
        ${td(`${pct}%`, "right")}
      </tr>`;
    }).join("");
    const catValueRows = inventoryValueByCategory.map((row, i) => {
      const margin = row.retailValue > 0 ? (((row.retailValue - row.costValue) / row.retailValue) * 100).toFixed(1) : "—";
      return `<tr>
        ${td(i + 1, "center")}
        ${td(row.category)}
        ${td(formatCurrency(row.retailValue), "right", "font-weight:800")}
        ${td(formatCurrency(row.costValue), "right")}
        ${td(row.retailValue > 0 ? formatCurrency(row.retailValue - row.costValue) : "—", "right", "color:#10b981;font-weight:700")}
        ${td(margin !== "—" ? `${margin}%` : "—", "right")}
      </tr>`;
    }).join("");
    const totalCatRetail = inventoryValueByCategory.reduce((s, r) => s + r.retailValue, 0);
    const totalCatCost = inventoryValueByCategory.reduce((s, r) => s + r.costValue, 0);
    const sec11a = table([th("Status"), th("Item Count", "right"), th("% of Total", "right")], healthRows, "No data");
    const sec11b = table(
      [th("#", "center"), th("Category"), th("Retail Value", "right"), th("Cost Value", "right"), th("Gross Profit", "right"), th("Margin %", "right")],
      catValueRows || "",
      "No category value data"
    ) + `<div class="table-footer">Total Retail: <strong>${formatCurrency(totalCatRetail)}</strong> &nbsp;|&nbsp; Total Cost: <strong>${formatCurrency(totalCatCost)}</strong> &nbsp;|&nbsp; Gross Profit: <strong>${formatCurrency(totalCatRetail - totalCatCost)}</strong></div>`;

    // ── SECTION 12: Order Status by Lane ──
    const orderRows = rStatusRows.map(row => {
      const total = row.pending + row.inProgress + row.done;
      const donePct = total > 0 ? ((row.done / total) * 100).toFixed(0) : "0";
      return `<tr>
        ${td(row.lane, "left", "font-weight:800")}
        ${td(row.pending, "right", "color:#f59e0b;font-weight:700")}
        ${td(row.inProgress, "right", "color:#3b82f6;font-weight:700")}
        ${td(row.done, "right", "color:#10b981;font-weight:700")}
        ${td(total, "right", "font-weight:800")}
        ${td(`${donePct}%`, "right")}
      </tr>`;
    }).join("");
    const sec12 = table(
      [th("Lane"), th("Pending", "right"), th("In Progress", "right"), th("Done", "right"), th("Total", "right"), th("Completion %", "right")],
      orderRows, "No order data"
    );

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>STN Detailed Report — ${reportDate}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 12mm; }
    @page :first { margin-top: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 10.5px; background: #fff; }

    /* ── COVER ── */
    .cover { padding: 20px 0 18px; border-bottom: 3px solid #0d9488; margin-bottom: 24px; }
    .cover-top { display: flex; align-items: flex-start; justify-content: space-between; }
    .cover-logo { font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #0f172a; line-height: 1; }
    .cover-logo span { color: #0d9488; }
    .cover-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #64748b; margin-top: 4px; }
    .cover-stamp { text-align: right; font-size: 9px; font-weight: 700; text-transform: uppercase; color: #94a3b8; line-height: 1.8; }
    .cover-stamp strong { color: #0d9488; font-size: 10px; }
    .cover-meta { display: flex; gap: 0; margin-top: 16px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .cover-meta-item { flex: 1; padding: 8px 12px; border-right: 1px solid #e2e8f0; }
    .cover-meta-item:last-child { border-right: none; }
    .cover-meta-item .lbl { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #94a3b8; margin-bottom: 2px; }
    .cover-meta-item .val { font-size: 11px; font-weight: 800; color: #0f172a; }

    /* ── SECTIONS ── */
    .section { margin-bottom: 22px; page-break-inside: avoid; }
    .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .section-num { width: 22px; height: 22px; background: #0d9488; color: white; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 900; flex-shrink: 0; }
    .section-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #0f172a; }
    .section-sub { font-size: 9px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 1px; }
    .section-group-title { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; background: #f8fafc; padding: 4px 10px; margin: 10px 0 0; border-left: 2px solid #cbd5e1; }

    /* ── KPI GRID ── */
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .kpi-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; background: #fff; }
    .kpi-label { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 4px; }
    .kpi-value { font-size: 16px; font-weight: 900; line-height: 1; }
    .kpi-sub { font-size: 8px; font-weight: 600; color: #94a3b8; margin-top: 4px; }

    /* ── TABLES ── */
    .table-wrap { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #0f172a; color: #f8fafc; }
    thead th { padding: 7px 10px; font-weight: 800; text-transform: uppercase; font-size: 8.5px; letter-spacing: 0.1em; white-space: nowrap; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody tr:hover { background: #f0fdfa; }
    tbody td { padding: 5px 10px; font-weight: 600; border-bottom: 1px solid #f1f5f9; font-size: 10px; }
    .empty { text-align: center; color: #94a3b8; font-weight: 700; text-transform: uppercase; font-size: 9px; padding: 16px; }
    .table-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 6px 12px; font-size: 9px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .table-footer strong { color: #0f172a; }

    /* ── BADGES ── */
    .badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; }

    /* ── PAGE BREAK ── */
    .page-break { page-break-before: always; }

    /* ── FOOTER ── */
    .doc-footer { margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; }
    .doc-footer-left { font-size: 8.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase; line-height: 1.7; }
    .doc-footer-right { font-size: 8.5px; color: #0d9488; font-weight: 800; text-transform: uppercase; text-align: right; line-height: 1.7; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>

  <!-- COVER -->
  <div class="cover">
    <div class="cover-top">
      <div>
        <div class="cover-logo">STN <span>System</span></div>
        <div class="cover-title">Detailed Operations Report</div>
      </div>
      <div class="cover-stamp">
        <div>Generated: <strong>${reportDate}</strong></div>
        <div>Time: <strong>${reportTime}</strong></div>
        <div>Period: <strong>${rangeLabel}</strong></div>
        <div>Category Filter: <strong>${selectedCategory}</strong></div>
      </div>
    </div>
    <div class="cover-meta">
      <div class="cover-meta-item"><div class="lbl">Total SKUs</div><div class="val">${filteredInventoryItems.length}</div></div>
      <div class="cover-meta-item"><div class="lbl">Sales Revenue</div><div class="val">${formatCurrency(rRevenue)}</div></div>
      <div class="cover-meta-item"><div class="lbl">Procurement Spend</div><div class="val">${formatCurrency(rSpend)}</div></div>
      <div class="cover-meta-item"><div class="lbl">Completion Rate</div><div class="val">${rCompRate.toFixed(1)}%</div></div>
      <div class="cover-meta-item"><div class="lbl">Stockout Risk</div><div class="val" style="color:#ef4444">${kpis.risky} items</div></div>
    </div>
  </div>

  ${section("01", "Executive Summary", `Key performance indicators — ${rangeLabel}`, sec1)}
  ${section("02", "Full Inventory Listing", `${filteredInventoryItems.length} SKUs · ${selectedCategory} · sorted by category`, sec2)}

  <div class="page-break"></div>

  ${section("03", "Sales Transactions", `${rSales.length} transactions in selected period`, sec3)}
  ${section("04", "Top Selling Products", "Ranked by units sold — all time", sec4)}
  ${section("05", "Sales by Product (Detail)", `Item-level breakdown — ${rangeLabel}`, sec5)}

  <div class="page-break"></div>

  ${section("06", "Purchase Orders", `${rPO.length} orders in selected period`, sec6)}
  ${section("07", "Inbound Scheduling", `${rSched.length} scheduled orders — ${rOverdue} overdue`, sec7)}
  ${section("08", "Supplier Spend Analysis", "All suppliers ranked by total spend", sec8)}

  <div class="page-break"></div>

  ${section("09", "Restocking Intelligence", `${needRestockCount} items need replenishment · ${reorderRange}-day demand basis (current)`, sec9)}
  ${section("10", "Stockout Risk Alert", "Items with 7 days or less of remaining stock", sec10)}

  <div class="page-break"></div>

  ${section("11a", "Stock Health Overview", "By health status", sec11a)}
  ${section("11b", "Inventory Value by Category", "Retail value, cost value, and margin breakdown", sec11b)}
  ${section("12", "Order Status by Lane", "Across sales, inbound, and procurement", sec12)}

  <div class="doc-footer">
    <div class="doc-footer-left">
      <div>STN Hardware Logistics System</div>
      <div>Report covers last ${selectedRange} days · Filter: ${selectedCategory}</div>
    </div>
    <div class="doc-footer-right">
      <div>Generated ${reportDate}</div>
      <div>${reportTime}</div>
    </div>
  </div>

</body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;width:0;height:0;border:none;opacity:0;pointer-events:none";
    document.body.appendChild(iframe);
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 500);
  };

  return (
    <main className='flex-1 p-3 sm:p-4 md:p-6 lg:p-8 bg-slate-50 min-h-screen font-sans overflow-x-hidden'>
      <header className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex flex-wrap items-center gap-2 sm:gap-3'>
            <BarChart3 className='text-teal-600' size={32} /> DASHBOARD
          </h1>
          <p className='mt-2 text-[10px] sm:text-xs font-bold uppercase tracking-[0.14em] sm:tracking-[0.2em] text-slate-600'>
          Live Analytics | Inventory, Sales & Purchasing
          </p>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <div className='flex items-center gap-1 rounded-xl bg-white p-1 shadow-sm'>
            {RANGE_OPTIONS.map((range) => (
              <button
                key={range.days}
                type='button'
                onClick={() => setSelectedRange(range.days)}
                className={`px-3 py-2 text-[10px] font-black uppercase rounded-lg transition ${
                  selectedRange === range.days
                    ? "bg-teal-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <CalendarRange size={12} className='inline mr-1' />
                {range.label}
              </button>
            ))}
          </div>

          <div className='flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm'>
            <Filter size={14} className='text-slate-500' />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className='bg-transparent text-xs font-black uppercase text-slate-700 outline-none'
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <button
            type='button'
            onClick={() => setReportPickerOpen(true)}
            className='flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-[10px] font-black uppercase text-white transition hover:bg-teal-700'
          >
            <FileText size={12} /> Generate Report
          </button>

          <button
            type='button'
            onClick={fetchDashboardData}
            className='flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-black uppercase text-white transition hover:bg-slate-700'
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className='mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700'>
          Failed loading some analytics data: {error}
        </div>
      )}

      {loading && (
        <div className='mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600'>
          Loading dashboard analytics...
        </div>
      )}

      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8'>
        <StatCard
          label='Total Items on Hand'
          value={kpis.onHand.toLocaleString()}
          icon={<Package className='text-teal-600' />}
          sub={`Current stock balance: ${kpis.stockBalance.toLocaleString()}`}
          onClick={() => openDrill(
            'Total Items on Hand',
            ['Item', 'Category', 'Current Stock', 'Stock Balance'],
            filteredInventoryItems.map(i => [i.name, i.category || '—', safeNumber(i.availableStock), safeNumber(i.stock_balance)])
          )}
        />
        <StatCard
          label='Total Sales'
          value={formatCurrency(kpis.revenue)}
          icon={<TrendingUp className='text-emerald-600' />}
          sub={selectedRangeLabel}
          trend={<ArrowUpRight size={14} className='text-emerald-500' />}
          onClick={() => openDrill(
            'Total Sales',
            ['Date', 'Status', 'Amount'],
            filteredSales.map(s => [new Date(s.created_at).toLocaleDateString(), s.status || '—', formatCurrency(s.total_amount)])
          )}
        />
        <StatCard
          label='Total Purchases'
          value={formatCurrency(kpis.procurementSpend)}
          icon={<ShoppingCart className='text-purple-600' />}
          sub={`Items waiting to arrive: ${kpis.pendingInbound}`}
          onClick={() => openDrill(
            'Total Purchases',
            ['Date', 'Supplier', 'Status', 'Amount'],
            filteredPO.map(p => [new Date(p.created_at).toLocaleDateString(), p.supplier_name || '—', p.status || '—', formatCurrency(p.total_amount)])
          )}
        />
        <StatCard
          label='Items Running Low'
          value={kpis.risky}
          icon={<AlertTriangle className='text-rose-600' />}
          sub={`Low stock items: ${kpis.lowStock}`}
          isAlert
          onClick={() => openDrill(
            'Items Running Low',
            ['Item', 'Category', 'Current Stock', 'Days Left'],
            stockoutRiskItems.map(i => [i.name, i.category || '—', safeNumber(i.availableStock), i.runwayDays.toFixed(1)])
          )}
        />
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8'>
        <StatCard
          label='Ongoing Sales Orders'
          value={erpOps.openSalesOrders.toLocaleString()}
          icon={<Activity className='text-cyan-600' />}
          sub='Orders not yet completed'
          onClick={() => openDrill(
            'Ongoing Sales Orders',
            ['Date', 'Status', 'Amount'],
            filteredSales.filter(s => (s.status || '').toLowerCase() !== 'completed').map(s => [new Date(s.created_at).toLocaleDateString(), s.status || '—', formatCurrency(s.total_amount)])
          )}
        />
        <StatCard
          label='Ongoing Purchase Orders'
          value={erpOps.openPurchaseOrders.toLocaleString()}
          icon={<ShoppingCart className='text-indigo-600' />}
          sub='Pending or being processed'
          onClick={() => openDrill(
            'Ongoing Purchase Orders',
            ['Date', 'Supplier', 'Status', 'Amount'],
            filteredPO.filter(p => { const st = (p.status || '').toLowerCase(); return st !== 'completed' && st !== 'received'; }).map(p => [new Date(p.created_at).toLocaleDateString(), p.supplier_name || '—', p.status || '—', formatCurrency(p.total_amount)])
          )}
        />
        <StatCard
          label='Top Selling Product'
          value={topSellingProducts[0]?.name ?? '—'}
          icon={<Flame className='text-orange-500' />}
          sub={topSellingProducts[0] ? `${topSellingProducts[0].qty.toLocaleString()} units sold · ${formatCurrency(topSellingProducts[0].revenue)}` : 'No sales data'}
          onClick={() => openDrill(
            'Top Selling Products',
            ['Product', 'Units Sold', 'Revenue'],
            topSellingProducts.map(p => [p.name, p.qty.toLocaleString(), formatCurrency(p.revenue)])
          )}
        />
        <StatCard
          label='Accounts for Approval'
          value={erpOps.pendingApprovals.toLocaleString()}
          icon={<Filter className='text-fuchsia-600' />}
          sub={`Suppliers on file: ${erpOps.supplierCoverage}`}
          onClick={() => openDrill(
            'Accounts for Approval',
            ['Profile ID', 'Role', 'Approval Status', 'Approved'],
            profiles.filter(p => !p.is_approved || (p.approval_status || '').toLowerCase() === 'pending').map(p => [p.id, p.role || '—', p.approval_status || '—', p.is_approved ? 'Yes' : 'No'])
          )}
        />
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8'>
        <div
          className='lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm cursor-pointer hover:shadow-md transition-shadow'
          onClick={() => {
            const itemMap = {};
            filteredHistory.forEach(r => {
              const key = r.name || r.sku || 'Unknown';
              if (!itemMap[key]) itemMap[key] = { name: r.name || '—', sku: r.sku || '—', category: r.category || '—', in: 0, out: 0, days: new Set() };
              itemMap[key].in += safeNumber(r.inbound_qty);
              itemMap[key].out += safeNumber(r.outbound_qty);
              if (r.snapshot_date) itemMap[key].days.add(r.snapshot_date);
            });
            const rows = Object.values(itemMap)
              .filter(i => i.in > 0 || i.out > 0)
              .map(i => [i.name, i.sku, i.category, i.in, i.out, i.days.size > 0 ? (i.out / i.days.size).toFixed(1) : '0'])
              .sort((a, b) => parseFloat(b[5]) - parseFloat(a[5]));
            openDrill('Sales & Stock Trend — Items with Movement', ['Item', 'SKU', 'Category', 'Total In', 'Total Out', 'Avg Out/Day'], rows);
          }}
        >
          <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
            <h3 className='font-black text-slate-800 uppercase text-xs flex items-center gap-2'>
              <TrendingUp size={16} /> Sales & Stock Trend
            </h3>

            <div className='flex items-center gap-1 rounded-lg bg-slate-100 p-1' onClick={(e) => e.stopPropagation()}>
              <button
                type='button'
                onClick={(e) => { e.stopPropagation(); setTrendMode("units"); }}
                className={`px-3 py-1 text-[10px] font-black uppercase rounded ${
                  trendMode === "units"
                    ? "bg-white text-slate-900"
                    : "text-slate-500"
                }`}
              >
                Units
              </button>
              <button
                type='button'
                onClick={(e) => { e.stopPropagation(); setTrendMode("value"); }}
                className={`px-3 py-1 text-[10px] font-black uppercase rounded ${
                  trendMode === "value"
                    ? "bg-white text-slate-900"
                    : "text-slate-500"
                }`}
              >
                Value
              </button>
            </div>
          </div>

          <div className='h-64 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id='trendA' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='5%' stopColor='#0d9488' stopOpacity={0.24} />
                    <stop offset='95%' stopColor='#0d9488' stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id='trendB' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='5%' stopColor='#3b82f6' stopOpacity={0.22} />
                    <stop offset='95%' stopColor='#3b82f6' stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray='3 3'
                  vertical={false}
                  stroke='#f1f5f9'
                />
                <XAxis
                  dataKey='label'
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                />
                <Tooltip
                  formatter={(value) =>
                    trendMode === "value"
                      ? formatCurrency(value)
                      : safeNumber(value).toLocaleString()
                  }
                  contentStyle={{
                    borderRadius: "16px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                  }}
                />

                {trendMode === "units" ? (
                  <>
                    <Area
                      type='monotone'
                      dataKey='inbound'
                      stroke='#3b82f6'
                      strokeWidth={2.5}
                      fill='url(#trendB)'
                      name='Stock In'
                    />
                    <Area
                      type='monotone'
                      dataKey='outbound'
                      stroke='#0d9488'
                      strokeWidth={2.5}
                      fill='url(#trendA)'
                      name='Stock Out'
                    />
                  </>
                ) : (
                  <>
                    <Area
                      type='monotone'
                      dataKey='inventoryValue'
                      stroke='#0d9488'
                      strokeWidth={2.5}
                      fill='url(#trendA)'
                      name='Inventory Value'
                    />
                    <Area
                      type='monotone'
                      dataKey='salesRevenue'
                      stroke='#3b82f6'
                      strokeWidth={2.5}
                      fill='url(#trendB)'
                      name='Sales Revenue'
                    />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          className='bg-white p-6 rounded-3xl shadow-sm cursor-pointer hover:shadow-md transition-shadow'
          onClick={() => {
            const allItems = inventorySegments.flatMap((seg, index) =>
              (seg.items || []).map(i => [
                i.name,
                i.category || '—',
                safeNumber(i.availableStock),
                seg.name,
              ])
            ).sort((a, b) => a[3].localeCompare(b[3]) || b[2] - a[2]);
            openDrill('Stock Health Overview', ['Item', 'Category', 'Current Stock', 'Status'], allItems);
          }}
        >
          <h3 className='font-black text-slate-800 uppercase text-xs mb-4 flex items-center gap-2'>
            <Boxes size={16} /> Stock Health Overview
          </h3>
          <div className='h-64 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <PieChart>
                <Pie
                  data={inventorySegments}
                  dataKey='value'
                  nameKey='name'
                  outerRadius={92}
                  innerRadius={52}
                  paddingAngle={2}
                  stroke='none'
                  style={{ cursor: 'pointer' }}
                  onClick={(seg, _idx, e) => {
                    e.stopPropagation();
                    if (!seg?.items) return;
                    openDrill(
                      `Stock Health: ${seg.name}`,
                      ['Item', 'Category', 'Current Stock'],
                      seg.items.map(i => [i.name, i.category || '—', safeNumber(i.availableStock)])
                    );
                  }}
                >
                  {inventorySegments.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => safeNumber(value).toLocaleString()}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className='mt-2 space-y-2'>
            {inventorySegments.map((segment, index) => (
              <div key={segment.name} className='flex items-center justify-between text-[11px] font-bold uppercase'>
                <div className='flex items-center gap-2'>
                  <span
                    className='h-2.5 w-2.5 rounded-full shrink-0'
                    style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                  />
                  <span className='text-slate-500'>{segment.name}</span>
                </div>
                <span className='text-slate-900'>{segment.value}</span>
              </div>
            ))}
          </div>

          <p className='mt-3 pt-1.5 border-t border-slate-100 text-[10px] font-black uppercase text-teal-600'>
            Click to view all items →
          </p>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8'>
        <div
          className='lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm cursor-pointer hover:shadow-md transition-shadow'
          onClick={() => {
            const rows = [
              ...filteredSales
                .filter(s => (s.status || '').toLowerCase() !== 'completed')
                .map(s => ['Sales', s.status || '—', new Date(s.created_at).toLocaleDateString(), formatCurrency(s.total_amount)]),
              ...filteredScheduling
                .filter(s => ['pending','in transit'].includes((s.status || '').toLowerCase()))
                .map(s => { const inv = inventory.find(i => i.id === s.product_id); return ['Inbound', s.status || '—', s.eta ? new Date(s.eta).toLocaleDateString() : '—', inv?.name || s.product_id || '—']; }),
              ...filteredPO
                .filter(p => { const st = (p.status || '').toLowerCase(); return st !== 'completed' && st !== 'received'; })
                .map(p => ['Procurement', p.status || '—', new Date(p.created_at).toLocaleDateString(), p.supplier_name || '—']),
            ];
            openDrill('Order Status Overview — All Open Orders', ['Lane', 'Status', 'Date / ETA', 'Item / Supplier'], rows);
          }}
        >
          <div className='mb-4 flex items-center justify-between gap-3'>
            <h3 className='font-black text-slate-800 uppercase text-xs flex items-center gap-2'>
              <Activity size={16} /> Order Status Overview
            </h3>
            <p className='text-[10px] font-bold uppercase text-slate-400'>
              Waiting vs In Progress vs Done
            </p>
          </div>

          <div className='h-64 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={erpOps.statusRows}>
                <CartesianGrid
                  strokeDasharray='3 3'
                  vertical={false}
                  stroke='#f1f5f9'
                />
                <XAxis
                  dataKey='lane'
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none" }} />
                <Bar
                  dataKey='pending'
                  stackId='ops'
                  name='Pending'
                  fill='#f59e0b'
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey='inProgress'
                  stackId='ops'
                  name='In Progress'
                  fill='#3b82f6'
                />
                <Bar
                  dataKey='done'
                  stackId='ops'
                  name='Done'
                  fill='#10b981'
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className='mt-4 grid grid-cols-1 md:grid-cols-3 gap-3'>
            <div className='rounded-2xl bg-slate-50 p-3'>
              <p className='text-[10px] font-black uppercase text-slate-500'>
                Items Below Safe Level
              </p>
              <p className='text-xl font-black text-slate-900'>
                {erpOps.lowCoverageSkus}
              </p>
            </div>
            <div className='rounded-2xl bg-slate-50 p-3'>
              <p className='text-[10px] font-black uppercase text-slate-500'>
                Active Sales Orders
              </p>
              <p className='text-xl font-black text-slate-900'>
                {erpOps.openSalesOrders}
              </p>
            </div>
            <div className='rounded-2xl bg-slate-50 p-3'>
              <p className='text-[10px] font-black uppercase text-slate-500'>
                Active Purchase Orders
              </p>
              <p className='text-xl font-black text-slate-900'>
                {erpOps.openPurchaseOrders}
              </p>
            </div>
          </div>
        </div>

        <div className='bg-white p-6 rounded-3xl shadow-sm'>
          <h3 className='font-black text-slate-800 uppercase text-xs mb-5 flex items-center gap-2'>
            <DollarSign size={16} /> Supplier Spend Focus
          </h3>

          {erpOps.supplierSpendRows.length === 0 ? (
            <div className='rounded-2xl bg-slate-50 p-4 text-[11px] font-bold uppercase text-slate-500'>
              No supplier spend in selected window.
            </div>
          ) : (
            <div className='space-y-3'>
              {erpOps.supplierSpendRows.map((row) => (
                <div key={row.supplierName}>
                  <div className='flex items-center justify-between text-[11px] font-black uppercase mb-1'>
                    <span className='text-slate-500'>{row.label}</span>
                    <span className='text-slate-900'>{formatCurrency(row.spend)}</span>
                  </div>
                  <div className='h-2 rounded-full bg-slate-100'>
                    <div
                      className='h-2 rounded-full bg-teal-500'
                      style={{
                        width: `${
                          (row.spend /
                            Math.max(
                              erpOps.supplierSpendRows[0]?.spend || 1,
                              1,
                            )) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className='mt-6 border-t border-slate-100 pt-4'>
            <p className='text-[10px] font-black uppercase text-slate-400 mb-2'>
              Stock Value by Category
            </p>
            <div className='h-40'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart
                    data={inventoryValueByCategory}
                    style={{ cursor: 'pointer' }}
                    onClick={(data) => {
                      if (!data?.activePayload?.[0]) return;
                      const cat = data.activePayload[0].payload?.category;
                      if (!cat) return;
                      const pricingByProduct = {};
                      productPricing.forEach(r => {
                        if (!r.product_id) return;
                        pricingByProduct[r.product_id] = {
                          cost: safeNumber(r.supplier_cost),
                          retail: safeNumber(r.manual_retail_price) || safeNumber(r.suggested_srp),
                        };
                      });
                      const catItems = filteredInventoryItems.filter(i => i.category === cat);
                      const rows = catItems.map(i => {
                        const p = pricingByProduct[i.id] || { cost: 0, retail: 0 };
                        const stock = safeNumber(i.availableStock);
                        return [i.name, stock, formatCurrency(p.retail), formatCurrency(p.cost), formatCurrency(stock * p.retail), formatCurrency(stock * p.cost)];
                      }).sort((a, b) => parseFloat(b[4].replace(/[^0-9.]/g,'')) - parseFloat(a[4].replace(/[^0-9.]/g,'')));
                      openDrill(`Stock Value: ${cat}`, ['Item', 'Stock Qty', 'Selling Price', 'Cost Price', 'Total Retail Value', 'Total Cost Value'], rows);
                    }}
                  >
                  <XAxis
                    dataKey='label'
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fontWeight: 700, fill: "#94a3b8" }}
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{ borderRadius: "12px", border: "none" }}
                  />
                  <Bar
                    dataKey='retailValue'
                    name='Selling Price'
                    fill='#0d9488'
                    radius={[6, 6, 0, 0]}
                    barSize={16}
                  />
                  <Bar
                    dataKey='costValue'
                    name='Purchase Cost'
                    fill='#1e293b'
                    radius={[6, 6, 0, 0]}
                    barSize={16}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8'>
        <div className='lg:col-span-2'>
          <div className='bg-white rounded-3xl shadow-sm overflow-hidden'>
            <div className='p-6 bg-slate-50/50 font-black text-slate-800 uppercase text-xs flex flex-wrap items-center justify-between gap-3'>
              <div className='flex items-center gap-2'>
                <BarChart3 size={16} /> Restocking Suggestions
                <span className='text-[9px] font-bold text-slate-400 normal-case'>({reorderSignals.length} items)</span>
              </div>
              <div className='flex items-center gap-2'>
                <div className='flex items-center gap-1 rounded-lg bg-white p-1 shadow-sm'>
                  {REORDER_RANGE_OPTIONS.map((option) => (
                    <button
                      key={option.days}
                      type='button'
                      onClick={() => { setReorderRange(option.days); setReorderPage(1); }}
                      className={`px-3 py-1 text-[10px] font-black uppercase rounded transition ${
                        reorderRange === option.days
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className='overflow-x-auto'>
            <table className='w-full text-left min-w-max'>
              <thead>
                <tr className='bg-black text-white text-[10px] font-black uppercase'>
                  <th className='px-6 py-4'>Product</th>
                  <th className='px-6 py-4'>Class</th>
                  <th className='px-6 py-4'>Stock</th>
                  <th className='px-6 py-4'>Avg Daily Sales</th>
                  <th className='px-6 py-4'>Restock At</th>
                  <th className='px-6 py-4 text-right'>Action Needed</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-100'>
                {reorderSignals.length === 0 ? (
                  <tr>
                    <td colSpan='6' className='px-6 py-10 text-center text-[11px] font-bold uppercase text-emerald-600'>
                      All items are sufficiently stocked.
                    </td>
                  </tr>
                ) : reorderSignals.slice((reorderPage - 1) * REORDER_PAGE_SIZE, reorderPage * REORDER_PAGE_SIZE).map((item) => (
                  <tr key={item.id} className='hover:bg-slate-50/50 text-xs'>
                    <td className='px-6 py-4 font-bold text-slate-800 uppercase'>
                      {item.name}
                    </td>
                    <td className='px-6 py-4'>
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${item.cls.color}`}>
                        {item.cls.label}
                      </span>
                    </td>
                    <td className='px-6 py-4 font-mono font-bold text-slate-700'>
                      {safeNumber(item.availableStock)}
                    </td>
                    <td className='px-6 py-4 font-mono text-slate-500'>
                      {item.avgDailyDemand.toFixed(1)} / day
                    </td>
                    <td className='px-6 py-4 font-mono text-slate-500'>
                      {item.reorderPoint}
                      <span className='ml-2 text-[9px] text-slate-400'>
                        Lead {REORDER_LEAD_TIME_DAYS}d
                      </span>
                    </td>
                    <td className='px-6 py-4 text-right'>
                      {item.reorderQty > 0 ? (
                        <span className='bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-black text-[10px] animate-pulse'>
                          REPLENISH: +{item.reorderQty}
                        </span>
                      ) : (
                        <span className='text-emerald-500 font-black text-[10px] uppercase'>
                          Healthy
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {reorderSignals.length > REORDER_PAGE_SIZE && (
              <div className='flex items-center justify-between px-6 py-3 border-t border-slate-100'>
                <p className='text-[10px] font-bold text-slate-400 uppercase'>
                  Page {reorderPage} of {Math.ceil(reorderSignals.length / REORDER_PAGE_SIZE)}
                </p>
                <div className='flex gap-2'>
                  <button
                    onClick={() => setReorderPage((p) => Math.max(1, p - 1))}
                    disabled={reorderPage === 1}
                    className='p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-all'
                  >
                    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3'><path d='M15 18l-6-6 6-6'/></svg>
                  </button>
                  <button
                    onClick={() => setReorderPage((p) => Math.min(Math.ceil(reorderSignals.length / REORDER_PAGE_SIZE), p + 1))}
                    disabled={reorderPage === Math.ceil(reorderSignals.length / REORDER_PAGE_SIZE)}
                    className='p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-all'
                  >
                    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3'><path d='M9 18l6-6-6-6'/></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className='bg-white rounded-3xl shadow-lg shadow-rose-100 overflow-hidden'>
          <div className='p-6 bg-rose-50 font-black text-rose-800 uppercase text-xs flex items-center gap-2'>
            <Flame size={16} className='text-rose-600' /> Items Almost Out of Stock
          </div>
          <div className='overflow-x-auto'>
          <table className='w-full text-left min-w-max'>
            <thead>
              <tr className='bg-black text-white text-[10px] font-black uppercase'>
                <th className='px-4 py-4'>Item</th>
                <th className='px-4 py-4'>Qty</th>
                <th className='px-4 py-4 text-right'>Days Left</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-rose-50'>
              {stockoutRiskItems.length === 0 ? (
                <tr>
                  <td
                    colSpan='3'
                    className='px-4 py-6 text-center text-[11px] font-bold uppercase text-emerald-600'
                  >
                    No urgent stockout risk in selected filters.
                  </td>
                </tr>
              ) : (
                stockoutRiskItems.slice(0, 8).map((item) => (
                  <tr key={item.id} className='hover:bg-rose-50/30 text-xs'>
                    <td className='px-4 py-4 font-bold text-slate-800 uppercase truncate max-w-30'>
                      {item.name}
                    </td>
                    <td className='px-4 py-4 font-mono font-bold text-rose-600'>
                      {item.availableStock}
                    </td>
                    <td className='px-4 py-4 text-right'>
                      <span className='bg-rose-600 text-white px-2 py-1 rounded text-[9px] font-black uppercase'>
                        {item.runwayDays.toFixed(1)} Days
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <div
        className='bg-white p-6 rounded-3xl shadow-sm mb-8 cursor-pointer hover:shadow-md transition-shadow'
        onClick={() => {
          const focusItem = reorderSignals[0] || filteredInventoryItems[0];
          if (!focusItem) return;
          const today = new Date(); today.setHours(0,0,0,0);
          const start = new Date(today); start.setDate(today.getDate() - 29);
          const actualByItem = {};
          const projByItem = {};
          salesItems.forEach(si => {
            const d = toDate(si.sales_transactions?.created_at);
            if (!d || d < start) return;
            if ((si.sales_transactions?.status || '').toLowerCase() === 'cancelled') return;
            actualByItem[si.product_id] = (actualByItem[si.product_id] || 0) + safeNumber(si.quantity);
          });
          filteredInventoryItems.forEach(item => {
            const key = item.sku || item.name;
            const avg = safeNumber(dailyDemandByItem[key]);
            projByItem[item.id] = Math.round(avg * 30);
          });
          const rows = filteredInventoryItems.map(item => {
            const actual = safeNumber(actualByItem[item.id]);
            const proj = safeNumber(projByItem[item.id]);
            const gap = proj - actual;
            return [item.name, item.sku || '—', actual, proj, gap > 0 ? `+${gap} below forecast` : gap < 0 ? `${gap} above forecast` : 'On track'];
          }).filter(r => r[2] > 0 || r[3] > 0).sort((a, b) => parseInt(b[4]) - parseInt(a[4]));
          openDrill('30-Day Sales Forecast vs Actual', ['Item', 'SKU', 'Actual Sold', 'Projected', 'Forecast Gap'], rows);
        }}
      >
        <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
          <h3 className='font-black text-slate-800 uppercase text-xs flex items-center gap-2'>
            <TrendingUp size={16} /> 30-Day Sales Forecast (All Items — Actual vs Projected)
          </h3>
          <p className='text-[10px] font-bold uppercase text-slate-400'>Daily Units Sold</p>
        </div>

        <div className='h-72 w-full'>
          <ResponsiveContainer width='100%' height='100%'>
            <LineChart data={demandForecast.data}>
              <CartesianGrid
                strokeDasharray='3 3'
                vertical={false}
                stroke='#f1f5f9'
              />
              <XAxis
                dataKey='label'
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
              />
              <Tooltip
                formatter={(value, name) => [`${safeNumber(value).toFixed(0)} units`, name]}
                contentStyle={{ borderRadius: "12px", border: "none" }}
              />
              <Line
                type='monotone'
                dataKey='actual'
                name='Actual Daily Sales'
                stroke='#0f766e'
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                type='monotone'
                dataKey='projected'
                name='Projected Daily Target'
                stroke='#f97316'
                strokeWidth={2}
                strokeDasharray='6 4'
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8'>
        <div className='bg-white p-6 rounded-3xl shadow-sm'>
          <h3 className='font-black text-slate-800 uppercase text-xs mb-5 flex items-center gap-2'>
            <Package size={16} /> Sales Order Breakdown
          </h3>
          <div className='h-64 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <PieChart>
                <Pie
                  data={salesStatusMix}
                  dataKey='value'
                  nameKey='name'
                  outerRadius={88}
                  innerRadius={50}
                  paddingAngle={2}
                  stroke='none'
                  style={{ cursor: 'pointer' }}
                  onClick={(seg) => {
                    if (!seg) return;
                    const status = seg.name;
                    const productQtys = {};
                    salesItems.forEach(si => {
                      const st = (si.sales_transactions?.status || '').toLowerCase();
                      const d = toDate(si.sales_transactions?.created_at);
                      if (!d || d < cutoffDate) return;
                      const match =
                        (status === 'Completed' && st === 'completed') ||
                        (status === 'In Transit' && st === 'in transit') ||
                        (status === 'Pending' && st !== 'completed' && st !== 'in transit');
                      if (!match) return;
                      productQtys[si.product_id] = (productQtys[si.product_id] || 0) + safeNumber(si.quantity);
                    });
                    const rows = Object.entries(productQtys).map(([pid, qty]) => {
                      const inv = inventory.find(i => i.id === pid);
                      return [inv?.name || pid, inv?.sku || '—', inv?.category || '—', qty];
                    }).sort((a, b) => b[3] - a[3]);
                    openDrill(`Items in ${status} Orders`, ['Item', 'SKU', 'Category', 'Qty'], rows);
                  }}
                >
                  <Cell fill='#f59e0b' />
                  <Cell fill='#3b82f6' />
                  <Cell fill='#10b981' />
                </Pie>
                <Tooltip formatter={(value) => safeNumber(value).toLocaleString()} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className='mt-2 space-y-2'>
            {salesStatusMix.map((row) => (
              <div
                key={row.name}
                className='flex items-center justify-between text-[11px] font-bold uppercase'
              >
                <span className='text-slate-500'>{row.name}</span>
                <span className='text-slate-900'>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          className='bg-white p-6 rounded-3xl shadow-sm cursor-pointer hover:shadow-md transition-shadow'
          onClick={() => {
            const rows = filteredScheduling.map(s => {
              const inv = inventory.find(i => i.id === s.product_id);
              const eta = toDate(s.eta);
              const today = new Date(); today.setHours(0,0,0,0);
              const daysLeft = eta ? Math.floor((new Date(eta).setHours(0,0,0,0) - today) / 86400000) : null;
              const daysLabel = daysLeft === null ? '—' : daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Today' : `in ${daysLeft}d`;
              return [inv?.name || s.product_id || '—', inv?.sku || '—', s.status || '—', s.eta ? new Date(s.eta).toLocaleDateString() : '—', daysLabel, safeNumber(s.quantity)];
            }).sort((a, b) => {
              const aD = a[4].includes('overdue') ? -9999 : parseInt(a[4]) || 0;
              const bD = b[4].includes('overdue') ? -9999 : parseInt(b[4]) || 0;
              return aD - bD;
            });
            openDrill('Incoming Deliveries Schedule', ['Item', 'SKU', 'Status', 'ETA', 'Arriving', 'Qty'], rows);
          }}
        >
          <h3 className='font-black text-slate-800 uppercase text-xs mb-5 flex items-center gap-2'>
            <CalendarRange size={16} /> Incoming Deliveries Schedule
          </h3>
          <div className='h-64 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={etaBucketData}>
                <CartesianGrid
                  strokeDasharray='3 3'
                  vertical={false}
                  stroke='#f1f5f9'
                />
                <XAxis
                  dataKey='bucket'
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                />
                <Tooltip
                  formatter={(value) => `${safeNumber(value).toLocaleString()} units`}
                  contentStyle={{ borderRadius: "12px", border: "none" }}
                />
                <Bar
                  dataKey='quantity'
                  name='Quantity Expected'
                  fill='#0ea5e9'
                  radius={[8, 8, 0, 0]}
                  barSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          className='bg-white p-6 rounded-3xl shadow-sm cursor-pointer hover:shadow-md transition-shadow'
          onClick={() => {
            const rows = reorderSignals.map(item => [item.name, item.sku || '—', item.category || '—', safeNumber(item.availableStock), item.reorderQty, item.cls?.label || '—']);
            openDrill('All Items Needing Restocking', ['Item', 'SKU', 'Category', 'Current Stock', 'Qty to Restock', 'Class'], rows);
          }}
        >
          <h3 className='font-black text-slate-800 uppercase text-xs mb-5 flex items-center gap-2'>
            <BarChart3 size={16} /> Items Needing Restocking
          </h3>
          <div className='h-64 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={reorderPressureData}>
                <CartesianGrid
                  strokeDasharray='3 3'
                  vertical={false}
                  stroke='#f1f5f9'
                />
                <XAxis
                  dataKey='label'
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fontWeight: 700, fill: "#94a3b8" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none" }} />
                <Bar
                  dataKey='reorderQty'
                  name='Qty to Restock'
                  fill='#f97316'
                  radius={[6, 6, 0, 0]}
                  barSize={18}
                />
                <Bar
                  dataKey='availableStock'
                  name='Current Stock'
                  fill='#334155'
                  radius={[6, 6, 0, 0]}
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div
        className='bg-white p-6 rounded-3xl shadow-sm cursor-pointer hover:shadow-md transition-shadow'
        onClick={() => {
          const pricingByProduct = {};
          productPricing.forEach(r => {
            if (!r.product_id) return;
            pricingByProduct[r.product_id] = safeNumber(r.manual_retail_price) || safeNumber(r.suggested_srp);
          });
          const salesRevByProduct = {};
          filteredSales.forEach(s => {
            salesItems
              .filter(si => si.product_id && toDate(si.sales_transactions?.created_at) >= cutoffDate)
              .forEach(si => {
                const price = safeNumber(pricingByProduct[si.product_id]);
                salesRevByProduct[si.product_id] = (salesRevByProduct[si.product_id] || 0) + safeNumber(si.quantity) * price;
              });
          });
          const itemMap = {};
          filteredHistory.forEach(r => {
            const key = r.name || r.sku || 'Unknown';
            if (!itemMap[key]) itemMap[key] = { name: r.name || '—', sku: r.sku || '—', category: r.category || '—', value: 0 };
            itemMap[key].value += safeNumber(r.total_value);
          });
          const rows = Object.values(itemMap)
            .filter(i => i.value > 0)
            .map(i => [i.name, i.sku, i.category, formatCurrency(i.value)])
            .sort((a, b) => parseFloat(b[3].replace(/[^0-9.]/g,'')) - parseFloat(a[3].replace(/[^0-9.]/g,'')));
          openDrill('Sales vs Stock Value — Items by Stock Value', ['Item', 'SKU', 'Category', 'Stock Value'], rows);
        }}
      >
        <h3 className='font-black text-slate-800 uppercase text-xs mb-6 flex items-center gap-2'>
          <DollarSign size={16} /> Sales vs Stock Value Summary
        </h3>
        <div className='h-64 w-full'>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart data={trendData}>
              <CartesianGrid
                strokeDasharray='3 3'
                vertical={false}
                stroke='#f1f5f9'
              />
              <XAxis
                dataKey='label'
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
              />
              <Tooltip
                formatter={(value) => formatCurrency(value)}
                contentStyle={{ borderRadius: "12px", border: "none" }}
              />
              <Bar
                dataKey='salesRevenue'
                name='Sales Revenue'
                fill='#0d9488'
                radius={[8, 8, 0, 0]}
                barSize={24}
              />
              <Bar
                dataKey='inventoryValue'
                name='Stock Value'
                fill='#3b82f6'
                radius={[8, 8, 0, 0]}
                barSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className='mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-500'>
          Completion Rate: {kpis.completionRate.toFixed(1)}% | Category:{" "}
          {selectedCategory}
        </p>
      </div>

      {reportPickerOpen && (
        <div className='fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4' onClick={() => setReportPickerOpen(false)}>
          <div className='bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8' onClick={e => e.stopPropagation()}>
            <h3 className='font-black text-slate-900 uppercase text-sm tracking-wide mb-1'>Generate Report</h3>
            <p className='text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-6'>Select date range for the report</p>
            <div className='space-y-4 mb-6'>
              <div>
                <label className='block text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1.5'>From</label>
                <input
                  type='date'
                  value={reportFrom}
                  onChange={e => setReportFrom(e.target.value)}
                  className='w-full py-3 px-4 rounded-2xl bg-slate-50 border border-slate-200 font-bold text-sm outline-none focus:ring-2 focus:ring-teal-400'
                />
              </div>
              <div>
                <label className='block text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1.5'>To</label>
                <input
                  type='date'
                  value={reportTo}
                  onChange={e => setReportTo(e.target.value)}
                  className='w-full py-3 px-4 rounded-2xl bg-slate-50 border border-slate-200 font-bold text-sm outline-none focus:ring-2 focus:ring-teal-400'
                />
              </div>
            </div>
            <p className='text-[10px] font-bold text-slate-400 uppercase mb-4'>Leave blank to include all records</p>
            <div className='flex gap-3'>
              <button
                onClick={() => { generateReport(reportFrom, reportTo); setReportPickerOpen(false); }}
                className='flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all active:scale-95'
              >
                <FileText size={14} /> Print Report
              </button>
              <button
                onClick={() => setReportPickerOpen(false)}
                className='px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase transition-all'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {drillDown && (
        <div
          className='fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4'
          onClick={closeDrill}
        >
          <div
            className='bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-center justify-between px-6 py-4 border-b border-slate-100'>
              <h3 className='font-black uppercase text-sm text-slate-900 tracking-wide'>{drillDown.title}</h3>
              <button
                type='button'
                onClick={closeDrill}
                className='p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition'
              >
                <X size={16} />
              </button>
            </div>
            <div className='overflow-auto flex-1'>
              <table className='w-full text-left text-xs'>
                <thead>
                  <tr className='bg-slate-50 text-[10px] font-black uppercase text-slate-500 sticky top-0'>
                    {drillDown.headers.map((h) => (
                      <th key={h} className='px-5 py-3 whitespace-nowrap'>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className='divide-y divide-slate-50'>
                  {drillDown.rows.length === 0 ? (
                    <tr>
                      <td colSpan={drillDown.headers.length} className='px-5 py-10 text-center text-slate-400 font-bold uppercase text-[11px]'>
                        No records found
                      </td>
                    </tr>
                  ) : (
                    drillDown.rows.map((row, i) => (
                      <tr key={i} className='hover:bg-slate-50'>
                        {row.map((cell, j) => (
                          <td key={j} className='px-5 py-3 font-bold text-slate-700 whitespace-nowrap'>{cell ?? '—'}</td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className='px-6 py-3 border-t border-slate-100 text-[10px] font-black uppercase text-slate-400'>
              {drillDown.rows.length} record{drillDown.rows.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

const StatCard = ({ label, value, icon, sub, trend, isAlert, onClick }) => (
  <div
    onClick={onClick}
    className={`p-6 rounded-3xl border transition-all ${onClick ? "cursor-pointer hover:scale-[1.02] hover:shadow-md active:scale-100" : ""} ${
      isAlert
        ? "bg-rose-50 border-rose-200 shadow-lg shadow-rose-100"
        : "bg-white border-slate-200 shadow-sm"
    }`}
  >
    <div className='flex justify-between items-start mb-4'>
      <div
        className={`p-3 rounded-xl ${isAlert ? "bg-rose-100" : "bg-slate-50"}`}
      >
        {icon}
      </div>
      {trend}
    </div>
    <p className='text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1'>
      {label}
    </p>
    <h2
      className={`text-3xl font-black ${
        isAlert ? "text-rose-900" : "text-slate-900"
      }`}
    >
      {value}
    </h2>
    <p
      className={`text-[10px] font-bold mt-2 uppercase flex items-center gap-1 ${
        isAlert ? "text-rose-600" : "text-slate-400"
      }`}
    >
      {isAlert && <Activity size={12} />} {sub}
    </p>
  </div>
);

export default Dashboard;
