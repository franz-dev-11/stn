import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";

export const useSalesData = () => {
  const [items, setItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);
  const [customerName, setCustomerName] = useState("Walk-in Customer");

  const fetchData = useCallback(async () => {
    try {
      const { data: inv, error } = await supabase.from("hardware_inventory")
        .select(`
          *,
          product_pricing (manual_retail_price)
        `);
      if (error) throw error;

      const formatted = (inv || []).map((item) => ({
        ...item,
        price: parseFloat(item.product_pricing?.manual_retail_price || 0),
      }));
      setItems(formatted);
    } catch (err) {
      console.error(err.message);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFinalizeTransaction = async () => {
    if (cart.length === 0) return;
    setIsCompleting(true);
    try {
      const year = new Date().getFullYear();
      const prefix = `SO-${year}`;
      const { data: latestSO } = await supabase
        .from("sales_orders")
        .select("so_number")
        .like("so_number", `${prefix}%`)
        .order("so_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastSeq = latestSO?.so_number
        ? parseInt(latestSO.so_number.replace(prefix, ""), 10) || 0
        : 0;
      const soNum = `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;

      // 1. Insert into sales_orders
      const { error: soErr } = await supabase.from("sales_orders").insert([
        {
          so_number: soNum,
          customer_name: customerName,
          total_amount: cart.reduce((s, i) => s + i.price * i.quantity, 0),
          status: "Pending",
        },
      ]);
      if (soErr) throw soErr;

      // 2. Insert into sales_items
      const itemRows = cart.map((item) => ({
        order_number: soNum,
        product_id: item.id,
        item_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
      }));

      const { error: itemsErr } = await supabase
        .from("sales_items")
        .insert(itemRows);
      if (itemsErr) throw itemsErr;

      alert(
        "Sales Order Created! Stock will be deducted upon completion in Scheduling.",
      );
      setCart([]);
      fetchData();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setIsCompleting(false);
    }
  };

  return {
    items,
    cart,
    setCart,
    isCartOpen,
    setIsCartOpen,
    searchTerm,
    setSearchTerm,
    isCompleting,
    customerName,
    setCustomerName,
    handleFinalizeTransaction,
  };
};
