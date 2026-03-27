-- ============================================================
-- SUPABASE RLS SETUP — STN Business System
-- Run this entire script in Supabase SQL Editor
-- Project: Hardware Inventory & Sales Management
-- Roles: Super Admin | Admin | Cashier
-- ============================================================


-- ============================================================
-- STEP 1: HELPER FUNCTIONS
-- These are used inside policies to keep them clean and reusable
-- ============================================================

-- Returns true if the current user's account is approved
CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND approval_status = 'approved'
  );
$$;

-- Returns the role string of the current user (e.g. 'Super Admin', 'Admin', 'Cashier')
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


-- ============================================================
-- STEP 2: ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hardware_inventory      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_batches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_pricing         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_scheduling        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_ledger_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles                   ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 3: DROP EXISTING POLICIES (safe re-run)
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;


-- ============================================================
-- STEP 4: PROFILES TABLE
-- Fine-grained: users see/edit their own; Super Admins manage all
-- ============================================================

-- Any approved user can view all profiles
-- (Required by UserManagement page which lists all users)
CREATE POLICY "approved_users_select_profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_approved());

-- Users can insert their own profile (fallback if trigger fails)
CREATE POLICY "users_insert_own_profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Users can update only their own profile
CREATE POLICY "users_update_own_profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Super Admins can update ANY profile (needed to set approval_status)
CREATE POLICY "superadmin_update_any_profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.get_user_role() = 'Super Admin')
WITH CHECK (public.get_user_role() = 'Super Admin');


-- ============================================================
-- STEP 5: HARDWARE INVENTORY
-- Read: all approved users | Write: Admin + Super Admin only
-- ============================================================

CREATE POLICY "approved_select_hardware_inventory"
ON public.hardware_inventory FOR SELECT
TO authenticated
USING (public.is_approved());

CREATE POLICY "admin_insert_hardware_inventory"
ON public.hardware_inventory FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role() IN ('Super Admin', 'Admin'));

CREATE POLICY "admin_update_hardware_inventory"
ON public.hardware_inventory FOR UPDATE
TO authenticated
USING (public.get_user_role() IN ('Super Admin', 'Admin'))
WITH CHECK (public.get_user_role() IN ('Super Admin', 'Admin'));

CREATE POLICY "admin_delete_hardware_inventory"
ON public.hardware_inventory FOR DELETE
TO authenticated
USING (public.get_user_role() IN ('Super Admin', 'Admin'));


-- ============================================================
-- STEP 6: INVENTORY BATCHES
-- Read: all approved | Write: Admin + Super Admin
-- ============================================================

CREATE POLICY "approved_select_inventory_batches"
ON public.inventory_batches FOR SELECT
TO authenticated
USING (public.is_approved());

CREATE POLICY "admin_insert_inventory_batches"
ON public.inventory_batches FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role() IN ('Super Admin', 'Admin'));

CREATE POLICY "admin_update_inventory_batches"
ON public.inventory_batches FOR UPDATE
TO authenticated
USING (public.get_user_role() IN ('Super Admin', 'Admin'))
WITH CHECK (public.get_user_role() IN ('Super Admin', 'Admin'));

-- Cashier can also update batches (stock deduction on sale)
CREATE POLICY "cashier_update_inventory_batches"
ON public.inventory_batches FOR UPDATE
TO authenticated
USING (public.get_user_role() = 'Cashier')
WITH CHECK (public.get_user_role() = 'Cashier');

CREATE POLICY "admin_delete_inventory_batches"
ON public.inventory_batches FOR DELETE
TO authenticated
USING (public.get_user_role() IN ('Super Admin', 'Admin'));


-- ============================================================
-- STEP 7: PRODUCT PRICING
-- Read: all approved | Write: Admin + Super Admin
-- ============================================================

CREATE POLICY "approved_select_product_pricing"
ON public.product_pricing FOR SELECT
TO authenticated
USING (public.is_approved());

CREATE POLICY "admin_insert_product_pricing"
ON public.product_pricing FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role() IN ('Super Admin', 'Admin'));

CREATE POLICY "admin_update_product_pricing"
ON public.product_pricing FOR UPDATE
TO authenticated
USING (public.get_user_role() IN ('Super Admin', 'Admin'))
WITH CHECK (public.get_user_role() IN ('Super Admin', 'Admin'));

CREATE POLICY "admin_delete_product_pricing"
ON public.product_pricing FOR DELETE
TO authenticated
USING (public.get_user_role() IN ('Super Admin', 'Admin'));


-- ============================================================
-- STEP 8: SUPPLIERS
-- Read: all approved | Write: Admin + Super Admin
-- ============================================================

CREATE POLICY "approved_select_suppliers"
ON public.suppliers FOR SELECT
TO authenticated
USING (public.is_approved());

CREATE POLICY "admin_insert_suppliers"
ON public.suppliers FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role() IN ('Super Admin', 'Admin'));

CREATE POLICY "admin_update_suppliers"
ON public.suppliers FOR UPDATE
TO authenticated
USING (public.get_user_role() IN ('Super Admin', 'Admin'))
WITH CHECK (public.get_user_role() IN ('Super Admin', 'Admin'));

CREATE POLICY "admin_delete_suppliers"
ON public.suppliers FOR DELETE
TO authenticated
USING (public.get_user_role() IN ('Super Admin', 'Admin'));


-- ============================================================
-- STEP 9: PURCHASE ORDERS
-- Read: all approved | Write: Admin + Super Admin
-- ============================================================

CREATE POLICY "approved_select_purchase_orders"
ON public.purchase_orders FOR SELECT
TO authenticated
USING (public.is_approved());

CREATE POLICY "admin_insert_purchase_orders"
ON public.purchase_orders FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role() IN ('Super Admin', 'Admin'));

CREATE POLICY "admin_update_purchase_orders"
ON public.purchase_orders FOR UPDATE
TO authenticated
USING (public.get_user_role() IN ('Super Admin', 'Admin'))
WITH CHECK (public.get_user_role() IN ('Super Admin', 'Admin'));

CREATE POLICY "admin_delete_purchase_orders"
ON public.purchase_orders FOR DELETE
TO authenticated
USING (public.get_user_role() IN ('Super Admin', 'Admin'));


-- ============================================================
-- STEP 10: ORDER SCHEDULING (Inbound delivery tracking)
-- ============================================================

CREATE POLICY "approved_select_order_scheduling"
ON public.order_scheduling FOR SELECT
TO authenticated
USING (public.is_approved());

CREATE POLICY "admin_insert_order_scheduling"
ON public.order_scheduling FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role() IN ('Super Admin', 'Admin'));

CREATE POLICY "admin_update_order_scheduling"
ON public.order_scheduling FOR UPDATE
TO authenticated
USING (public.get_user_role() IN ('Super Admin', 'Admin'))
WITH CHECK (public.get_user_role() IN ('Super Admin', 'Admin'));

CREATE POLICY "admin_delete_order_scheduling"
ON public.order_scheduling FOR DELETE
TO authenticated
USING (public.get_user_role() IN ('Super Admin', 'Admin'));


-- ============================================================
-- STEP 11: SALES TRANSACTIONS
-- Cashier can INSERT (create sales); Admin can manage all
-- ============================================================

CREATE POLICY "approved_select_sales_transactions"
ON public.sales_transactions FOR SELECT
TO authenticated
USING (public.is_approved());

CREATE POLICY "cashier_insert_sales_transactions"
ON public.sales_transactions FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role() IN ('Super Admin', 'Admin', 'Cashier'));

CREATE POLICY "admin_update_sales_transactions"
ON public.sales_transactions FOR UPDATE
TO authenticated
USING (public.get_user_role() IN ('Super Admin', 'Admin'))
WITH CHECK (public.get_user_role() IN ('Super Admin', 'Admin'));

CREATE POLICY "admin_delete_sales_transactions"
ON public.sales_transactions FOR DELETE
TO authenticated
USING (public.get_user_role() IN ('Super Admin', 'Admin'));


-- ============================================================
-- STEP 12: SALES ITEMS
-- ============================================================

CREATE POLICY "approved_select_sales_items"
ON public.sales_items FOR SELECT
TO authenticated
USING (public.is_approved());

CREATE POLICY "cashier_insert_sales_items"
ON public.sales_items FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role() IN ('Super Admin', 'Admin', 'Cashier'));

CREATE POLICY "admin_update_sales_items"
ON public.sales_items FOR UPDATE
TO authenticated
USING (public.get_user_role() IN ('Super Admin', 'Admin'))
WITH CHECK (public.get_user_role() IN ('Super Admin', 'Admin'));

CREATE POLICY "admin_delete_sales_items"
ON public.sales_items FOR DELETE
TO authenticated
USING (public.get_user_role() IN ('Super Admin', 'Admin'));


-- ============================================================
-- STEP 13: DAILY LEDGER HISTORY
-- ============================================================

CREATE POLICY "approved_select_daily_ledger_history"
ON public.daily_ledger_history FOR SELECT
TO authenticated
USING (public.is_approved());

CREATE POLICY "admin_insert_daily_ledger_history"
ON public.daily_ledger_history FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role() IN ('Super Admin', 'Admin'));

CREATE POLICY "admin_update_daily_ledger_history"
ON public.daily_ledger_history FOR UPDATE
TO authenticated
USING (public.get_user_role() IN ('Super Admin', 'Admin'))
WITH CHECK (public.get_user_role() IN ('Super Admin', 'Admin'));

CREATE POLICY "admin_delete_daily_ledger_history"
ON public.daily_ledger_history FOR DELETE
TO authenticated
USING (public.get_user_role() IN ('Super Admin', 'Admin'));


-- ============================================================
-- STEP 14: ROLES TABLE
-- Read: all approved | Write: Super Admin only
-- ============================================================

CREATE POLICY "approved_select_roles"
ON public.roles FOR SELECT
TO authenticated
USING (public.is_approved());

CREATE POLICY "superadmin_insert_roles"
ON public.roles FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role() = 'Super Admin');

CREATE POLICY "superadmin_update_roles"
ON public.roles FOR UPDATE
TO authenticated
USING (public.get_user_role() = 'Super Admin')
WITH CHECK (public.get_user_role() = 'Super Admin');

CREATE POLICY "superadmin_delete_roles"
ON public.roles FOR DELETE
TO authenticated
USING (public.get_user_role() = 'Super Admin');


-- ============================================================
-- STEP 15: AUTO-SYNC ROLE FROM auth.users TO profiles
-- This trigger fires when a new user signs up via supabase.auth.signUp()
-- and creates their profile row with role + pending status automatically
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, approval_status, is_approved, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'Cashier'),
    'pending',
    false,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users (runs on every new signup)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- VERIFICATION QUERIES
-- Run these after to confirm everything is set up correctly
-- ============================================================

-- Check which tables have RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- List all created policies
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
