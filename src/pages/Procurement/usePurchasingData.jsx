import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../supabaseClient";

export const usePurchasing = () => {
  const [view, setView] = useState("browse");
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data: inv, error: invErr } = await supabase
        .from("hardware_inventory")
        .select(
          `
          *,
          product_pricing (supplier_cost),
          inventory_batches (*)
        `,
        )
        .order("name", { ascending: true });
      if (invErr) throw invErr;

      const { data: sup, error: supErr } = await supabase
        .from("suppliers")
        .select("*")
        .order("name");
      if (supErr) throw supErr;

      const merged = (inv || []).map((item) => ({
        ...item,
        batches: (item.inventory_batches || [])
          .filter((batch) => batch.current_stock > 0)
          .sort(
            (a, b) =>
              new Date(a.expiry_date || 0) - new Date(b.expiry_date || 0),
          ),
        stock_balance:
          item.stock_balance ??
          (item.inventory_batches || []).reduce(
            (total, batch) => total + Number(batch.current_stock || 0),
            0,
          ),
        price: Number(item.product_pricing?.supplier_cost || 0),
      }));

      setItems(merged);
      setSuppliers(sup || []);
    } catch (err) {
      console.error("Fetch error:", err.message);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addToCart = (product, quantity) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.id === product.id);
      if (existing) {
        return prev.map((p) =>
          p.id === product.id ? { ...p, quantity: p.quantity + quantity } : p,
        );
      }
      return [...prev, { ...product, quantity }];
    });
    setIsCartOpen(true);
  };

  const handleCompleteTransaction = async () => {
    if (cart.length === 0) return;
    setIsCompleting(true);
    try {
      const now = new Date().toISOString();
      const year = new Date().getFullYear();
      const poPrefix = `PO-${year}`;
      const { data: latestPO } = await supabase
        .from("purchase_orders")
        .select("po_number")
        .like("po_number", `${poPrefix}%`)
        .order("po_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      let poSeq = latestPO?.po_number
        ? parseInt(latestPO.po_number.replace(poPrefix, ""), 10) || 0
        : 0;

      const grouped = cart.reduce((acc, item) => {
        if (!acc[item.supplier]) acc[item.supplier] = [];
        acc[item.supplier].push(item);
        return acc;
      }, {});

      for (const [supplierName, products] of Object.entries(grouped)) {
        poSeq += 1;
        const poNum = `${poPrefix}${String(poSeq).padStart(4, "0")}`;
        const total = products.reduce((s, p) => s + p.price * p.quantity, 0);

        const { error: poErr } = await supabase.from("purchase_orders").insert([
          {
            po_number: poNum,
            supplier_name: supplierName,
            total_amount: total,
            status: "Pending",
          },
        ]);
        if (poErr) throw poErr;

        const sched = products.map((p) => ({
          order_number: poNum,
          product_id: p.id,
          item_name: p.name,
          quantity: p.quantity,
          unit_cost: p.price,
          supplier: p.supplier,
          date_ordered: now,
          status: "Pending",
        }));
        await supabase.from("order_scheduling").insert(sched);
      }
      alert("Success! Orders Finalized.");
      setCart([]);
      setView("browse");
    } catch (err) {
      alert(err.message);
    } finally {
      setIsCompleting(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(
      (i) =>
        i.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.sku?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [items, searchTerm]);

  return {
    view,
    setView,
    items: filteredItems,
    suppliers,
    cart,
    setCart,
    isCartOpen,
    setIsCartOpen,
    searchTerm,
    setSearchTerm,
    fetchData,
    isCompleting,
    addToCart,
    handleCompleteTransaction,
  };
};
