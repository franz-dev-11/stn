import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Filter,
  Flame,
  AlertTriangle,
  ArrowUpRight,
  Package,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
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
  const [selectedForecastSkuId, setSelectedForecastSkuId] = useState("auto");

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
            "product_id, quantity, sales_transactions(created_at, status)",
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
    () => [
      {
        name: "Healthy",
        value: filteredInventoryItems.filter(
          (item) =>
            safeNumber(item.availableStock) > safeNumber(item.min_stock_level),
        ).length,
      },
      {
        name: "Low Stock",
        value: filteredInventoryItems.filter(
          (item) =>
            safeNumber(item.availableStock) > 0 &&
            safeNumber(item.availableStock) <= safeNumber(item.min_stock_level),
        ).length,
      },
      {
        name: "Out of Stock",
        value: filteredInventoryItems.filter(
          (item) => safeNumber(item.availableStock) <= 0,
        ).length,
      },
      {
        name: "No Movement",
        value: filteredInventoryItems.filter((item) => {
          const key = item.sku || item.name;
          return safeNumber(dailyDemandByItem[key]) === 0;
        }).length,
      },
    ],
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
      if (transactionStatus !== "Completed") return;
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
        const reorderPoint = Math.max(
          computedRop,
          safeNumber(item.min_stock_level),
        );
        const reorderQty = Math.max(
          0,
          reorderPoint - safeNumber(item.availableStock),
        );

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
          reorderPoint,
          reorderQty,
          cls,
        };
      })
      .sort((a, b) => b.reorderQty - a.reorderQty)
      .slice(0, 8);

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

  const forecastSkuOptions = useMemo(() => {
    const source = reorderSignals.length ? reorderSignals : filteredInventoryItems;
    return source.slice(0, 20).map((item) => ({
      id: item.id,
      name: item.name,
    }));
  }, [filteredInventoryItems, reorderSignals]);

  const forecastSelectValue = useMemo(() => {
    if (selectedForecastSkuId === "auto") return "auto";
    const exists = forecastSkuOptions.some(
      (item) => item.id === selectedForecastSkuId,
    );
    return exists ? selectedForecastSkuId : "auto";
  }, [forecastSkuOptions, selectedForecastSkuId]);

  const demandForecast = useMemo(() => {
    const manuallySelectedItem =
      selectedForecastSkuId !== "auto"
        ? filteredInventoryItems.find(
            (item) => item.id === selectedForecastSkuId,
          ) ||
          reorderSignals.find((item) => item.id === selectedForecastSkuId) ||
          null
        : null;

    const focusItem =
      manuallySelectedItem || reorderSignals[0] || filteredInventoryItems[0] || null;
    if (!focusItem) {
      return { focusLabel: "No SKU", data: [] };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const windowDays = 30;
    const start = new Date(today);
    start.setDate(today.getDate() - (windowDays - 1));

    const actualByDay = {};
    salesItems.forEach((row) => {
      if (row.product_id !== focusItem.id) return;
      const tx = row.sales_transactions;
      if ((tx?.status || "") !== "Completed") return;
      const txDate = toDate(tx?.created_at);
      if (!txDate || txDate < start || txDate > today) return;

      const key = txDate.toISOString().slice(0, 10);
      actualByDay[key] = (actualByDay[key] || 0) + safeNumber(row.quantity);
    });

    const rows = [];
    const rolling = [];
    for (let i = 0; i < windowDays; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const actual = safeNumber(actualByDay[key]);
      rolling.push(actual);

      const lookback = rolling.slice(Math.max(rolling.length - 7, 0));
      const projected =
        lookback.reduce((sum, value) => sum + value, 0) /
        Math.max(lookback.length, 1);

      rows.push({
        date: key,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        actual,
        projected,
      });
    }

    return {
      focusLabel: focusItem.name,
      data: rows,
    };
  }, [filteredInventoryItems, reorderSignals, salesItems, selectedForecastSkuId]);

  return (
    <main className='flex-1 p-3 sm:p-4 md:p-6 lg:p-8 bg-slate-50 min-h-screen font-sans overflow-x-hidden'>
      <header className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex flex-wrap items-center gap-2 sm:gap-3'>
            <BarChart3 className='text-teal-600' size={32} /> DASHBOARD
          </h1>
          <p className='mt-2 text-[10px] sm:text-xs font-bold uppercase tracking-[0.14em] sm:tracking-[0.2em] text-slate-600'>
            Live SQL Analytics | Inventory, Sales, Procurement
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
          label='On-Hand Units'
          value={kpis.onHand.toLocaleString()}
          icon={<Package className='text-teal-600' />}
          sub={`Stock balance: ${kpis.stockBalance.toLocaleString()}`}
        />
        <StatCard
          label='Sales Revenue'
          value={formatCurrency(kpis.revenue)}
          icon={<TrendingUp className='text-emerald-600' />}
          sub={selectedRangeLabel}
          trend={<ArrowUpRight size={14} className='text-emerald-500' />}
        />
        <StatCard
          label='Procurement Spend'
          value={formatCurrency(kpis.procurementSpend)}
          icon={<ShoppingCart className='text-purple-600' />}
          sub={`Pending inbound: ${kpis.pendingInbound}`}
        />
        <StatCard
          label='Stockout Risk'
          value={kpis.risky}
          icon={<AlertTriangle className='text-rose-600' />}
          sub={`Low stock SKUs: ${kpis.lowStock}`}
          isAlert
        />
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8'>
        <StatCard
          label='Open Sales Orders'
          value={erpOps.openSalesOrders.toLocaleString()}
          icon={<Activity className='text-cyan-600' />}
          sub='Statuses not completed'
        />
        <StatCard
          label='Open Purchase Orders'
          value={erpOps.openPurchaseOrders.toLocaleString()}
          icon={<ShoppingCart className='text-indigo-600' />}
          sub='Pending, approved, or processing'
        />
        <StatCard
          label='Overdue Inbound ETAs'
          value={erpOps.overdueInbound.toLocaleString()}
          icon={<AlertTriangle className='text-orange-600' />}
          sub='Pending/In transit with past ETA'
          isAlert={erpOps.overdueInbound > 0}
        />
        <StatCard
          label='User Approval Queue'
          value={erpOps.pendingApprovals.toLocaleString()}
          icon={<Filter className='text-fuchsia-600' />}
          sub={`Suppliers in master file: ${erpOps.supplierCoverage}`}
        />
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8'>
        <div className='lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm'>
          <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
            <h3 className='font-black text-slate-800 uppercase text-xs flex items-center gap-2'>
              <TrendingUp size={16} /> Volume and Value Trend
            </h3>

            <div className='flex items-center gap-1 rounded-lg bg-slate-100 p-1'>
              <button
                type='button'
                onClick={() => setTrendMode("units")}
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
                onClick={() => setTrendMode("value")}
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
                      name='Inbound'
                    />
                    <Area
                      type='monotone'
                      dataKey='outbound'
                      stroke='#0d9488'
                      strokeWidth={2.5}
                      fill='url(#trendA)'
                      name='Outbound'
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

        <div className='bg-white p-6 rounded-3xl shadow-sm'>
          <h3 className='font-black text-slate-800 uppercase text-xs mb-6 flex items-center gap-2'>
            <Boxes size={16} /> Inventory Health Mix
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
              <div
                key={segment.name}
                className='flex items-center justify-between text-[11px] font-bold uppercase'
              >
                <div className='flex items-center gap-2'>
                  <span
                    className='h-2.5 w-2.5 rounded-full'
                    style={{
                      backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                    }}
                  />
                  <span className='text-slate-500'>{segment.name}</span>
                </div>
                <span className='text-slate-900'>{segment.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8'>
        <div className='lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm'>
          <div className='mb-4 flex items-center justify-between gap-3'>
            <h3 className='font-black text-slate-800 uppercase text-xs flex items-center gap-2'>
              <Activity size={16} /> ERP Flow Control Tower
            </h3>
            <p className='text-[10px] font-bold uppercase text-slate-400'>
              Pending vs In Progress vs Done
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
                Low Coverage SKUs
              </p>
              <p className='text-xl font-black text-slate-900'>
                {erpOps.lowCoverageSkus}
              </p>
            </div>
            <div className='rounded-2xl bg-slate-50 p-3'>
              <p className='text-[10px] font-black uppercase text-slate-500'>
                Open SO
              </p>
              <p className='text-xl font-black text-slate-900'>
                {erpOps.openSalesOrders}
              </p>
            </div>
            <div className='rounded-2xl bg-slate-50 p-3'>
              <p className='text-[10px] font-black uppercase text-slate-500'>
                Open PO
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
              Inventory Value by Category (Retail vs Cost)
            </p>
            <div className='h-40'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={inventoryValueByCategory}>
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
                    name='Retail Value'
                    fill='#0d9488'
                    radius={[6, 6, 0, 0]}
                    barSize={16}
                  />
                  <Bar
                    dataKey='costValue'
                    name='Cost Value'
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
                <BarChart3 size={16} /> Reorder Recommendation Engine
              </div>
              <div className='flex items-center gap-1 rounded-lg bg-white p-1 shadow-sm'>
                {REORDER_RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.days}
                    type='button'
                    onClick={() => setReorderRange(option.days)}
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
            <div className='overflow-x-auto'>
            <table className='w-full text-left min-w-max'>
              <thead>
                <tr className='bg-black text-white text-[10px] font-black uppercase'>
                  <th className='px-6 py-4'>Product</th>
                  <th className='px-6 py-4'>Class</th>
                  <th className='px-6 py-4'>Avg Daily Sales</th>
                  <th className='px-6 py-4'>Reorder Point</th>
                  <th className='px-6 py-4 text-right'>Buy Signal</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-100'>
                {reorderSignals.map((item) => {
                  return (
                    <tr key={item.id} className='hover:bg-slate-50/50 text-xs'>
                      <td className='px-6 py-4 font-bold text-slate-800 uppercase'>
                        {item.name}
                      </td>
                      <td className='px-6 py-4'>
                        <span
                          className={`px-2 py-1 rounded text-[10px] font-black uppercase ${item.cls.color}`}
                        >
                          {item.cls.label}
                        </span>
                      </td>
                      <td className='px-6 py-4 font-mono text-slate-500'>
                        {item.avgDailyDemand.toFixed(1)} / day
                      </td>
                      <td className='px-6 py-4 font-mono text-slate-500'>
                        {item.reorderPoint}
                        <span className='ml-2 text-[9px] text-slate-400'>
                          LT {REORDER_LEAD_TIME_DAYS}d
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
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        <div className='bg-white rounded-3xl shadow-lg shadow-rose-100 overflow-hidden'>
          <div className='p-6 bg-rose-50 font-black text-rose-800 uppercase text-xs flex items-center gap-2'>
            <Flame size={16} className='text-rose-600' /> Stockout Monitor
          </div>
          <div className='overflow-x-auto'>
          <table className='w-full text-left min-w-max'>
            <thead>
              <tr className='bg-black text-white text-[10px] font-black uppercase'>
                <th className='px-4 py-4'>Item</th>
                <th className='px-4 py-4'>Qty</th>
                <th className='px-4 py-4 text-right'>Runway</th>
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

      <div className='bg-white p-6 rounded-3xl shadow-sm mb-8'>
        <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
          <h3 className='font-black text-slate-800 uppercase text-xs flex items-center gap-2'>
            <TrendingUp size={16} /> 30-Day Demand Forecast (Actual vs Projected)
          </h3>
          <div className='flex items-center gap-2'>
            <p className='text-[10px] font-bold uppercase text-slate-400'>
              Focus SKU: {demandForecast.focusLabel}
            </p>
            <select
              value={forecastSelectValue}
              onChange={(e) => setSelectedForecastSkuId(e.target.value)}
              className='rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase text-slate-600 outline-none'
            >
              <option value='auto'>Auto (Top Reorder Priority)</option>
              {forecastSkuOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
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
                formatter={(value) => `${safeNumber(value).toFixed(1)} units`}
                contentStyle={{ borderRadius: "12px", border: "none" }}
              />
              <Line
                type='monotone'
                dataKey='actual'
                name='Actual Demand'
                stroke='#0f766e'
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                type='monotone'
                dataKey='projected'
                name='Projected Demand'
                stroke='#f97316'
                strokeWidth={2.5}
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
            <Package size={16} /> Sales Status Mix
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

        <div className='bg-white p-6 rounded-3xl shadow-sm'>
          <h3 className='font-black text-slate-800 uppercase text-xs mb-5 flex items-center gap-2'>
            <CalendarRange size={16} /> Inbound ETA Buckets
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
                  name='Inbound Quantity'
                  fill='#0ea5e9'
                  radius={[8, 8, 0, 0]}
                  barSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className='bg-white p-6 rounded-3xl shadow-sm'>
          <h3 className='font-black text-slate-800 uppercase text-xs mb-5 flex items-center gap-2'>
            <BarChart3 size={16} /> Reorder Pressure Chart
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
                  name='Reorder Qty'
                  fill='#f97316'
                  radius={[6, 6, 0, 0]}
                  barSize={18}
                />
                <Bar
                  dataKey='availableStock'
                  name='Available Stock'
                  fill='#334155'
                  radius={[6, 6, 0, 0]}
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className='bg-white p-6 rounded-3xl shadow-sm'>
        <h3 className='font-black text-slate-800 uppercase text-xs mb-6 flex items-center gap-2'>
          <DollarSign size={16} /> Transaction Snapshot
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
                name='Inventory Value'
                fill='#3b82f6'
                radius={[8, 8, 0, 0]}
                barSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className='mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-500'>
          Completion Rate: {kpis.completionRate.toFixed(1)}% | Category Filter:{" "}
          {selectedCategory}
        </p>
      </div>
    </main>
  );
};

const StatCard = ({ label, value, icon, sub, trend, isAlert }) => (
  <div
    className={`p-6 rounded-3xl border transition-all ${
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
