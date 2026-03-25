/**
 * Direct Supabase client queries — no backend server needed.
 * Tables: items, customers, production_logs, sales_logs, profiles
 * View: v_item_stock
 */
import { supabase } from "./supabaseClient";

// ── Types ──
export interface Item {
  id: string;
  name: string;
  low_stock_threshold: number;
  default_price: number;
  is_active: boolean;
  created_at: string;
}

export interface StockRow {
  item_id: string;
  name: string;
  low_stock_threshold: number;
  total_produced: number;
  total_sold: number;
  current_stock: number;
  default_price: number;
}

export interface VItemStock {
  item_id: string;
  name: string;
  low_stock_threshold: number;
  total_produced: number;
  total_sold: number;
  current_stock: number;
  default_price: number;
}

export interface ReceiptHeaderInsert {
  receipt_no: string;
  customer_id: string | null;
  receipt_date: string;
  subtotal: number;
  discount_amount: number;
  grand_total: number;
  note: string | null;
  created_by: string | null;
  status: 'posted' | 'draft' | 'cancelled';
}

export interface ReceiptLineInsert {
  receipt_id: string;
  item_id: string;
  item_name_snapshot: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

export interface SalesReceipt {
  id: string;
  receipt_no: string;
  customer_id: string | null;
  receipt_date: string;
  subtotal: number;
  discount_amount: number;
  grand_total: number;
  note: string | null;
  created_by: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  created_at: string;
}

export interface ProductionLog {
  id: string;
  item_id: string;
  qty: number;
  item_name?: string;
  created_at?: string;
}

export interface SalesLog {
  id: string;
  item_id: string;
  customer_id: string | null;
  qty: number;
  sold_at: string | null;
  note: string | null;
  created_by: string | null;
  item_name?: string;
  customer_name?: string;
}

// ════════════════════════════════════
//  ITEMS
// ════════════════════════════════════
export async function getItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load items: ${error.message}`);
  return data || [];
}

export async function createItem(
  name: string,
  low_stock_threshold: number,
  default_price: number = 0,
): Promise<Item> {
  const { data, error } = await supabase
    .from("items")
    .insert({ name, low_stock_threshold, default_price, is_active: true })
    .select()
    .single();
  if (error) throw new Error(`Failed to create item: ${error.message}`);
  return data;
}

export async function updateItem(
  id: string,
  name: string,
  low_stock_threshold: number,
  default_price: number = 0,
): Promise<Item> {
  const { data, error } = await supabase
    .from("items")
    .update({ name, low_stock_threshold, default_price })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`Failed to update item: ${error.message}`);
  return data;
}

export async function getItemUsage(id: string): Promise<{ productionCount: number; salesCount: number }> {
  const [prodResult, salesResult] = await Promise.all([
    supabase.from("production_logs").select("id", { count: "exact", head: true }).eq("item_id", id),
    supabase.from("sales_logs").select("id", { count: "exact", head: true }).eq("item_id", id),
  ]);
  return {
    productionCount: prodResult.count ?? 0,
    salesCount: salesResult.count ?? 0,
  };
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete item: ${error.message}`);
}

// ════════════════════════════════════
//  STOCK (from v_item_stock view)
// ════════════════════════════════════
export async function getStock(): Promise<StockRow[]> {
  const { data, error } = await supabase.from("v_item_stock").select("*");
  if (error) throw new Error(`Failed to load stock: ${error.message}`);
  return data || [];
}

/**
 * Load items from the v_item_stock view with all fields including default_price.
 */
export async function getVItemStock(): Promise<VItemStock[]> {
  const { data, error } = await supabase.from("v_item_stock").select("*");
  if (error) throw new Error(`Failed to load v_item_stock: ${error.message}`);
  return (data || []).map((row: any) => ({
    item_id: row.item_id,
    name: row.name,
    low_stock_threshold: row.low_stock_threshold ?? 0,
    total_produced: row.total_produced ?? 0,
    total_sold: row.total_sold ?? 0,
    current_stock: row.current_stock ?? 0,
    default_price: row.default_price ?? 0,
  }));
}

/**
 * Get the current_stock for a specific item from v_item_stock.
 * Returns 0 if not found.
 */
export async function getItemStock(item_id: string): Promise<number> {
  const { data, error } = await supabase
    .from("v_item_stock")
    .select("current_stock")
    .eq("item_id", item_id)
    .single();
  if (error) return 0;
  return data?.current_stock ?? 0;
}

// ════════════════════════════════════
//  PRODUCTION LOGS
// ════════════════════════════════════

/** Get a YYYY-MM-DD string in the user's local timezone */
function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Detect the timestamp column dynamically from a row */
function findTimestampCol(row: Record<string, unknown>): string | null {
  if (!row) return null;
  const candidates = [
    "created_at",
    "logged_at",
    "produced_at",
    "recorded_at",
    "inserted_at",
    "timestamp",
    "date",
    "production_date",
  ];
  for (const c of candidates) {
    if (c in row) return c;
  }
  for (const [key, val] of Object.entries(row)) {
    if (
      typeof val === "string" &&
      /^\d{4}-\d{2}-\d{2}/.test(val) &&
      !["id", "item_id", "customer_id", "created_by"].includes(key)
    ) {
      return key;
    }
  }
  return null;
}

function getDateFromRow(
  row: Record<string, unknown>,
  tsCol: string | null,
): string {
  if (!tsCol || !row[tsCol]) return "";
  const raw = String(row[tsCol]);
  // If it contains a time component, parse as Date to get local date
  if (raw.includes("T") || raw.includes("+") || raw.includes("Z")) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? raw.substring(0, 10) : localDateStr(d);
  }
  return raw.substring(0, 10);
}

export async function getProductionLogs() {
  const { data, error } = await supabase
    .from("production_logs")
    .select("*, items(name)");
  if (error)
    throw new Error(`Failed to load production logs: ${error.message}`);

  const rows = data || [];

  return rows
    .map((row: any) => ({
      id: row.id,
      item_id: row.item_id,
      item_name: row.items?.name || "Unknown",
      quantity: row.qty,
      production_date: getDateFromRow(row, "produced_at"),
      created_at: row.produced_at || row.created_at || row.id,
    }))
    .sort((a: any, b: any) =>
      (b.created_at || "").localeCompare(a.created_at || ""),
    );
}

export async function createProductionLogs(
  entries: { item_id: string; quantity: number }[],
  produced_at?: string,
) {
  const dateStr = produced_at || localDateStr();
  const rows = entries.map((e) => ({
    item_id: e.item_id,
    qty: e.quantity,
    produced_at: dateStr + "T00:00:00+06:30",
  }));
  const { error } = await supabase.from("production_logs").insert(rows);
  if (error)
    throw new Error(`Failed to create production logs: ${error.message}`);
}

export async function updateProductionLog(
  id: string,
  item_id: string,
  qty: number,
) {
  const { data, error } = await supabase
    .from("production_logs")
    .update({ item_id, qty })
    .eq("id", id)
    .select();
  if (error)
    throw new Error(`Failed to update production log: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(
      "Update blocked: RLS policy may not allow this operation. Check Supabase RLS policies on production_logs for UPDATE.",
    );
  }
  return data[0];
}

export async function deleteProductionLog(id: string) {
  const { data, error } = await supabase
    .from("production_logs")
    .delete()
    .eq("id", id)
    .select();
  if (error)
    throw new Error(`Failed to delete production log: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(
      "Delete blocked: RLS policy may not allow this operation. Check Supabase RLS policies on production_logs for DELETE.",
    );
  }
}

// ════════════════════════════════════
//  SALES LOGS
// ════════════════════════════════════
export async function getSalesLogs() {
  const { data, error } = await supabase
    .from("sales_logs")
    .select("*, items(name), customers(name)");
  if (error) throw new Error(`Failed to load sales logs: ${error.message}`);

  const rows = data || [];

  return rows
    .map((row: any) => ({
      id: row.id,
      item_id: row.item_id,
      item_name: row.items?.name || "Unknown",
      quantity: row.qty,
      customer_id: row.customer_id,
      customer_name: row.customers?.name || "Walk-in",
      note: row.note || "",
      sold_at: row.sold_at || row.created_at || "",
      created_at: row.sold_at || row.created_at || row.id,
    }))
    .sort((a: any, b: any) =>
      (b.created_at || "").localeCompare(a.created_at || ""),
    );
}

export async function createSalesLog(
  item_id: string,
  qty: number,
  customer_id: string | null,
  note?: string,
  sold_at_date?: string,
) {
  // Get current user id for created_by
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const created_by = session?.user?.id || null;

  const row: Record<string, unknown> = {
    item_id,
    qty,
    sold_at: sold_at_date
      ? sold_at_date + "T" + new Date().toTimeString().slice(0, 8) + "+06:30"
      : new Date().toISOString(),
  };
  if (customer_id) row.customer_id = customer_id;
  if (note) row.note = note;
  if (created_by) row.created_by = created_by;

  const { error } = await supabase.from("sales_logs").insert(row);
  if (error) throw new Error(`Failed to create sales log: ${error.message}`);
}

export async function updateSalesLog(
  id: string,
  updates: {
    item_id?: string;
    qty?: number;
    customer_id?: string | null;
    note?: string | null;
    sold_at?: string | null;
  },
) {
  const { data, error } = await supabase
    .from("sales_logs")
    .update(updates)
    .eq("id", id)
    .select();
  if (error)
    throw new Error(`Failed to update sales log: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(
      "Update blocked: RLS policy may not allow this operation. Check Supabase RLS policies on sales_logs for UPDATE.",
    );
  }
  return data[0];
}

export async function deleteSalesLog(id: string) {
  const { data, error } = await supabase
    .from("sales_logs")
    .delete()
    .eq("id", id)
    .select();
  if (error)
    throw new Error(`Failed to delete sales log: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(
      "Delete blocked: RLS policy may not allow this operation. Check Supabase RLS policies on sales_logs for DELETE.",
    );
  }
}

// ════════════════════════════════════
//  SALES RECEIPTS (new schema)
// ════════════════════════════════════

/**
 * Create a receipt header + lines in sales_receipts / sales_receipt_lines.
 * Returns the inserted receipt row.
 */
export async function createSalesReceipt(
  header: ReceiptHeaderInsert,
  lines: Omit<ReceiptLineInsert, "receipt_id">[],
): Promise<SalesReceipt> {
  // Get current user id for created_by
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const created_by = session?.user?.id || null;

  // Insert receipt header
  const { data: receipt, error: hErr } = await supabase
    .from("sales_receipts")
    .insert({ ...header, created_by })
    .select()
    .single();
  if (hErr) throw new Error(`ဘောင်ချာ သိမ်းဆည်း မအောင်မြင်ပါ: ${hErr.message}`);

  // Insert receipt lines
  const lineRows = lines.map((l) => ({
    receipt_id: receipt.id,
    item_id: l.item_id,
    item_name_snapshot: l.item_name_snapshot,
    qty: l.qty,
    unit_price: l.unit_price,
    line_total: l.line_total,
  }));

  const { error: lErr } = await supabase
    .from("sales_receipt_lines")
    .insert(lineRows);
  if (lErr) {
    // Roll back: delete the orphan receipt header
    await supabase.from("sales_receipts").delete().eq("id", receipt.id);
    throw new Error(`ဘောင်ချာ အသေးစိတ် သိမ်းဆည်း မအောင်မြင်ပါ: ${lErr.message}`);
  }

  return receipt as SalesReceipt;
}

export interface SalesReceiptLine {
  id: string;
  receipt_id: string;
  item_id: string;
  item_name_snapshot: string;
  qty: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface SalesReceiptWithCustomer extends SalesReceipt {
  customer_name: string;
}

/**
 * List all receipts with customer name, ordered newest first.
 */
export async function getSalesReceipts(): Promise<SalesReceiptWithCustomer[]> {
  const { data, error } = await supabase
    .from("sales_receipts")
    .select("*, customers(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load receipts: ${error.message}`);
  return (data || []).map((r: any) => ({
    ...r,
    customer_name: r.customers?.name || "Walk-in",
  }));
}

/**
 * Get receipt lines for a given receipt id.
 */
export async function getSalesReceiptLines(receiptId: string): Promise<SalesReceiptLine[]> {
  const { data, error } = await supabase
    .from("sales_receipt_lines")
    .select("*")
    .eq("receipt_id", receiptId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load receipt lines: ${error.message}`);
  return data || [];
}

/**
 * Delete a sales receipt and its lines (lines have FK cascade, but delete lines first to be safe).
 */
export async function deleteSalesReceipt(id: string): Promise<void> {
  // Delete lines first
  await supabase.from("sales_receipt_lines").delete().eq("receipt_id", id);
  const { data, error } = await supabase
    .from("sales_receipts")
    .delete()
    .eq("id", id)
    .select();
  if (error) throw new Error(`Failed to delete receipt: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("Delete blocked: RLS policy may not allow this operation.");
  }
}

/**
 * Get the next receipt number for a given date.
 * Format: BCH-YYYYMMDD-NNNNN where NNNNN resets daily.
 */
export async function getNextReceiptNumber(receiptDate: string): Promise<string> {
  const dateCode = receiptDate.replace(/-/g, "");
  const prefix = `BCH-${dateCode}-`;

  const { data, error } = await supabase
    .from("sales_receipts")
    .select("receipt_no")
    .like("receipt_no", `${prefix}%`);

  if (error) throw new Error(`Failed to query receipt numbers: ${error.message}`);

  let maxSeq = 0;
  for (const row of data || []) {
    const tail = row.receipt_no.slice(prefix.length);
    const num = parseInt(tail, 10);
    if (!isNaN(num) && num > maxSeq) maxSeq = num;
  }

  const nextSeq = String(maxSeq + 1).padStart(5, "0");
  return `${prefix}${nextSeq}`;
}

// ════════════════════════════════════
//  CUSTOMERS
// ════════════════════════════════════
export async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, phone, address, created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load customers: ${error.message}`);
  return data || [];
}

export async function createCustomer(
  name: string,
  phone?: string,
  address?: string,
): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .insert({ name, phone: phone || null, address: address || null })
    .select()
    .single();
  if (error) throw new Error(`Failed to create customer: ${error.message}`);
  return data;
}

export async function updateCustomer(
  id: string,
  name: string,
  phone?: string,
  address?: string,
): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .update({ name, phone: phone || null, address: address || null })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`Failed to update customer: ${error.message}`);
  if (!data) throw new Error("Update blocked: RLS policy may not allow this operation.");
  return data;
}

export async function deleteCustomer(id: string) {
  const { data, error } = await supabase
    .from("customers")
    .delete()
    .eq("id", id)
    .select();
  if (error) throw new Error(`Failed to delete customer: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("Delete blocked: RLS policy may not allow this operation.");
  }
}

// ════════════════════════════════════
//  DAILY PRODUCTION (for charts)
// ════════════════════════════════════
export async function getDailyProduction(days?: number) {
  // Get active items
  const { data: items, error: itemsErr } = await supabase
    .from("items")
    .select("id, name")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (itemsErr) throw new Error(`Failed to load items: ${itemsErr.message}`);

  // Get ALL production logs
  const { data: prodLogs, error: prodErr } = await supabase
    .from("production_logs")
    .select("*");
  if (prodErr)
    throw new Error(`Failed to load production logs: ${prodErr.message}`);

  const today = new Date();
  const itemMap = new Map<string, string>();
  const itemNames: string[] = [];
  for (const item of items || []) {
    itemMap.set(item.id, item.name);
    itemNames.push(item.name);
  }

  // If no days specified, compute from earliest production log
  let numDays = days || 30;
  if (!days && prodLogs && prodLogs.length > 0) {
    let earliest = today;
    for (const log of prodLogs) {
      const logDate = getDateFromRow(log as any, "produced_at");
      if (logDate) {
        const d = new Date(logDate + "T00:00:00");
        if (!isNaN(d.getTime()) && d < earliest) earliest = d;
      }
    }
    const diffMs = today.getTime() - earliest.getTime();
    numDays = Math.max(30, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1);
  }

  const result: any[] = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = localDateStr(d);
    const displayDate = `${d.getMonth() + 1}/${d.getDate()}`;

    const entry: any = { date: displayDate, fullDate: dateStr };
    let total = 0;

    for (const name of itemNames) entry[name] = 0;

    for (const log of prodLogs || []) {
      const logDate = getDateFromRow(log as any, "produced_at");
      if (logDate === dateStr) {
        const name = itemMap.get((log as any).item_id);
        if (name) {
          entry[name] = (entry[name] || 0) + (log as any).qty;
          total += (log as any).qty;
        }
      }
    }
    entry.total = total;
    result.push(entry);
  }
  return result;
}

// ════════════════════════════════════
//  STOCK HELPERS (computed from view)
// ════════════════════════════════════
export async function getStockWithToday() {
  const [stockData, itemsData, allProd] = await Promise.all([
    getStock(),
    getItems(),
    supabase.from("production_logs").select("*"),
  ]);

  const prodRows = allProd.data || [];
  const today = localDateStr();

  const todayMap = new Map<string, number>();
  for (const row of prodRows) {
    const rowDate = getDateFromRow(row as any, "produced_at");
    if (rowDate === today) {
      todayMap.set(
        (row as any).item_id,
        (todayMap.get((row as any).item_id) || 0) + (row as any).qty,
      );
    }
  }

  // Build stock map from v_item_stock view
  const stockMap = new Map<string, StockRow>();
  for (const row of stockData) {
    stockMap.set(row.item_id, row);
  }

  // Merge: show ALL items from items table, use stock data if available
  return itemsData.map((item) => {
    const stock = stockMap.get(item.id);
    return {
      id: item.id,
      name: item.name,
      currentStock: stock ? Math.max(0, stock.current_stock ?? 0) : 0,
      todayProduced: todayMap.get(item.id) || 0,
      lowStockThreshold: item.low_stock_threshold,
      defaultPrice: stock?.default_price ?? item.default_price ?? 0,
    };
  });
}