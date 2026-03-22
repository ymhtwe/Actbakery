import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Loader2,
  ShoppingBag,
  Calendar,
  ChevronDown,
  RotateCcw,
  TrendingUp,
  Users,
  Package,
  Pencil,
  Trash2,
  X,
  CheckSquare,
  Square,
  MinusSquare,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  LabelList,
} from "recharts";
import * as db from "./db";

interface SaleRow {
  id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  customer_id: string | null;
  customer_name: string;
  note: string;
  sold_at: string;
  created_at: string;
}

const ALL_ITEMS_LABEL = "\u1015\u1005\u1039\u1005\u100a\u103a\u1038\u1021\u1019\u103b\u102d\u102f\u1038\u1021\u1005\u102c\u1038\u1019\u103b\u102c\u1038";
const ALL_ITEMS_DROPDOWN_LABEL = "ပစ္စည်း အားလုံး";
const ALL_CUSTOMERS_LABEL = "ဝယ်ယူသူအားလုံး";
const ALL_CUSTOMERS_DROPDOWN_LABEL = "ဝယ်ယူသူ အားလုံး";

const QUICK_RANGES = [
  { value: "Today", label: "\u101a\u1014\u1031\u1037" },
  { value: "7 Days", label: "\u1047 \u101b\u1000\u103a" },
  { value: "14 Days", label: "\u1041\u1044 \u101b\u1000\u103a" },
  { value: "30 Days", label: "\u1043\u1040 \u101b\u1000\u103a" },
  { value: "All", label: "\u1021\u102c\u1038\u101c\u102f\u1036\u1038" },
];

function getDefaultDates(range: string) {
  const to = new Date();
  const from = new Date();
  switch (range) {
    case "Today":
      break;
    case "7 Days":
      from.setDate(to.getDate() - 6);
      break;
    case "14 Days":
      from.setDate(to.getDate() - 13);
      break;
    case "30 Days":
      from.setDate(to.getDate() - 29);
      break;
    case "All":
      from.setFullYear(2020);
      break;
    default:
      from.setDate(to.getDate() - 6);
  }
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    from: fmt(from),
    to: fmt(to),
  };
}

function formatDate(iso: string) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.substring(0, 10) || "\u2014";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  if (!iso || !iso.includes("T")) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SalesContent() {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Filter state
  const defaults = getDefaultDates("All");
  const [selectedRange, setSelectedRange] = useState("All");
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [selectedItem, setSelectedItem] = useState(ALL_ITEMS_LABEL);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(ALL_CUSTOMERS_LABEL);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);

  // Edit modal state
  const [editingRow, setEditingRow] = useState<SaleRow | null>(null);
  const [editForm, setEditForm] = useState({ item_id: "", quantityStr: "", customer_id: "", note: "", sold_at: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete confirm state
  const [deleteRow, setDeleteRow] = useState<SaleRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteStep, setBulkDeleteStep] = useState<0 | 1 | 2>(0);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Items & customers for edit modal dropdowns
  const [allItems, setAllItems] = useState<{ id: string; name: string }[]>([]);
  const [allCustomers, setAllCustomers] = useState<{ id: string; name: string }[]>([]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const loadSales = useCallback(async () => {
    try {
      setLoading(true);

      const [data, items, customers] = await Promise.all([
        db.getSalesLogs(),
        db.getItems(),
        db.getCustomers(),
      ]);
      setSales(data as SaleRow[]);
      setAllItems(items.map((i) => ({ id: i.id, name: i.name })));
      setAllCustomers(customers.map((c) => ({ id: c.id, name: c.name })));
    } catch (e) {
      console.error("Failed to load sales:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const handleRangeChange = (r: string) => {
    setSelectedRange(r);
    const d = getDefaultDates(r);
    setDateFrom(d.from);
    setDateTo(d.to);
  };

  const handleReset = () => {
    setSelectedRange("All");
    setSelectedItem(ALL_ITEMS_LABEL);
    setSelectedCustomer(ALL_CUSTOMERS_LABEL);
    setSearchTerm("");
    const d = getDefaultDates("All");
    setDateFrom(d.from);
    setDateTo(d.to);
  };

  // Unique item names
  const itemNames = useMemo(() => {
    const names = new Set(sales.map((s) => s.item_name));
    return Array.from(names).sort();
  }, [sales]);

  // Filtered sales
  const filteredSales = useMemo(() => {
    const fromD = new Date(dateFrom + "T00:00:00");
    const toD = new Date(dateTo + "T23:59:59");

    return sales.filter((s) => {
      const saleDate = s.sold_at || s.created_at;
      if (saleDate) {
        const sd = new Date(saleDate);
        if (!isNaN(sd.getTime()) && (sd < fromD || sd > toD)) return false;
      }
      if (selectedItem !== ALL_ITEMS_LABEL && s.item_name !== selectedItem) return false;
      if (selectedCustomer !== ALL_CUSTOMERS_LABEL && s.customer_name !== selectedCustomer) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          s.item_name.toLowerCase().includes(q) ||
          s.customer_name.toLowerCase().includes(q) ||
          (s.note && s.note.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [sales, dateFrom, dateTo, selectedItem, selectedCustomer, searchTerm]);

  // Summary stats
  const stats = useMemo(() => {
    const totalQty = filteredSales.reduce((sum, s) => sum + s.quantity, 0);
    const totalTransactions = filteredSales.length;
    const uniqueCustomers = new Set(
      filteredSales.filter((s) => s.customer_id).map((s) => s.customer_id),
    ).size;
    const uniqueItems = new Set(filteredSales.map((s) => s.item_name)).size;
    return { totalQty, totalTransactions, uniqueCustomers, uniqueItems };
  }, [filteredSales]);

  // Daily sales trend chart data
  const dailySalesData = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of filteredSales) {
      const dateStr = (s.sold_at || s.created_at || "").split("T")[0];
      if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        map.set(dateStr, (map.get(dateStr) || 0) + s.quantity);
      }
    }
    const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return entries.map(([date, qty], idx) => {
      const d = new Date(date);
      return {
        id: `sales-day-${idx}`,
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        fullDate: date,
        quantity: qty,
      };
    });
  }, [filteredSales]);

  // Top sold items chart data
  const topItemsData = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of filteredSales) {
      const name = (s.item_name || "").trim();
      if (!name) continue;
      map.set(name, (map.get(name) || 0) + s.quantity);
    }
    return Array.from(map.entries())
      .map(([name, total], idx) => ({ id: `top-item-${idx}`, name, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredSales]);

  const tooltipStyle = {
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  };

  const chartHeight = isMobile ? 200 : 260;

  // ── Edit handlers ──
  const openEdit = (s: SaleRow) => {
    setEditingRow(s);
    setEditError("");
    setEditForm({
      item_id: s.item_id,
      quantityStr: String(s.quantity),
      customer_id: s.customer_id || "",
      note: s.note || "",
      sold_at: (s.sold_at || s.created_at || "").split("T")[0],
    });
  };

  const handleEditSave = async () => {
    if (!editingRow) return;
    setEditError("");

    // Validate quantity
    const parsedQty = parseInt(editForm.quantityStr);
    if (editForm.quantityStr.trim() === "" || isNaN(parsedQty) || parsedQty < 0) {
      setEditError("အရေအတွက် မှန်ကန်စွာ ထည့်ပါ။");
      return;
    }
    if (parsedQty === 0) {
      setEditError("အရေအတွက် 0 ဖြစ်ရင် ဖျက်ရန်ကို အသုံးပြုပါ");
      return;
    }

    setEditSaving(true);
    try {
      // Stock validation: if increasing sale qty, check stock can absorb the increase
      const qtyIncrease = parsedQty - editingRow.quantity; // positive means selling more
      if (qtyIncrease > 0) {
        const currentStock = await db.getItemStock(editingRow.item_id);
        if (currentStock < qtyIncrease) {
          setEditError(
            `အရောင်း အရေအတွက် တိုးမြှင့်၍မရပါ။ လက်ရှိလက်ကျန် ${currentStock} ခုသာ ရှိပြီး ${editingRow.quantity + currentStock} ခု အထိသာတိုးနိုင်ပါသည်။ ထုတ်လုပ်မှုကို အရင်တိုးပါ။`
          );
          setEditSaving(false);
          return;
        }
      }

      // If item changed, validate: old item gets stock back, new item loses stock
      if (editForm.item_id !== editingRow.item_id) {
        const newItemStock = await db.getItemStock(editForm.item_id);
        if (newItemStock < parsedQty) {
          const newItemName = allItems.find((i) => i.id === editForm.item_id)?.name || "ပစ္စည်း";
          setEditError(
            `ပစ္စည်းအမျိုးအစား ပြောင်းလဲ၍မရပါ။ ${newItemName} ၏ လက်ကျန် ${newItemStock} ခုသာ ရှိပြီး ${newItemStock} ခု အထိသာရောင်းနိုင်ပါသည်။`
          );
          setEditSaving(false);
          return;
        }
      }

      const updates: Record<string, unknown> = {
        item_id: editForm.item_id,
        qty: parsedQty,
        customer_id: editForm.customer_id || null,
        note: editForm.note || null,
      };
      if (editForm.sold_at) {
        updates.sold_at = new Date(editForm.sold_at + "T00:00:00").toISOString();
      }
      await db.updateSalesLog(editingRow.id, updates as any);
      setEditingRow(null);
      setEditError("");
      await loadSales();
    } catch (e: any) {
      console.error("Failed to update sale:", e);
      setEditError(e?.message || "အမှားပြင်ဆင်ရန် မအောင်မြင်ပါ။");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      await db.deleteSalesLog(deleteRow.id);
      setDeleteRow(null);
      await loadSales();
    } catch (e: any) {
      console.error("Failed to delete sale:", e);
      alert(e?.message || "ဖျက်ရန် မအောင်မြင်ပါ။");
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    const selectedRows = filteredSales.filter((s) => selectedIds.has(s.id));
    if (selectedRows.length === 0) return;
    setBulkDeleting(true);
    try {
      let failCount = 0;
      for (const row of selectedRows) {
        try {
          await db.deleteSalesLog(row.id);
        } catch {
          failCount++;
        }
      }
      if (failCount > 0) {
        alert(`${selectedRows.length - failCount} ခု ဖျက်ပြီး ${failCount} ခု မဖျက်နိုင်ခဲ့ပါ။`);
      }
      setSelectedIds(new Set());
      setBulkDeleteStep(0);
      await loadSales();
    } catch (e: any) {
      console.error("Bulk delete failed:", e);
      alert(e?.message || "ဖျက်ရန် မအောင်မြင်ပါ။");
    } finally {
      setBulkDeleting(false);
    }
  };

  // Multi-select helpers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSales.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSales.map((s) => s.id)));
    }
  };
  const isAllSelected = filteredSales.length > 0 && selectedIds.size === filteredSales.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < filteredSales.length;

  // Clear selection when filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setSelectedIds(new Set()); }, [dateFrom, dateTo, selectedItem, selectedCustomer, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-[#D6B25E]" />
        <span className="text-[#9CA3AF]" style={{ fontSize: "0.85rem" }}>
          အရောင်းဒေတာ ခေါ်ယူနေသည်...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "\u101b\u1031\u102c\u1004\u103a\u1038\u1001\u103b\u1015\u103c\u102e\u1038 \u1021\u101b\u1031\u1021\u1010\u103d\u1000\u103a", sub: "totalQty", value: stats.totalQty, icon: ShoppingBag, color: "text-[#D6B25E]", bg: "bg-[#FAF6EC]" },
          { label: "\u101b\u1031\u102c\u1004\u103a\u1038\u1001\u103b\u1019\u103e\u102f \u1021\u1000\u103c\u102d\u1019\u103a", sub: "transactions", value: stats.totalTransactions, icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-50" },
          { label: "\u101d\u101a\u103a\u101a\u1030\u101c\u1030 \u1026\u1038\u101b\u1031", sub: "customers", value: stats.uniqueCustomers, icon: Users, color: "text-green-500", bg: "bg-green-50" },
          { label: "\u1015\u1005\u1039\u1005\u100a\u103a\u1038 \u1021\u1019\u103b\u102d\u102f\u1038\u1021\u1005\u102c\u1038", sub: "items", value: stats.uniqueItems, icon: Package, color: "text-purple-500", bg: "bg-purple-50" },
        ].map((card) => (
          <div key={card.sub} className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-[10px] ${card.bg} flex items-center justify-center shrink-0`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <p className="text-[#1F2937] mt-1" style={{ fontSize: isMobile ? "1.25rem" : "1.5rem" }}>{card.value}</p>
            <p className="text-[#9CA3AF] mt-0.5 leading-tight" style={{ fontSize: "0.72rem" }}>{card.label}</p>
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      {filteredSales.length > 0 && (dailySalesData.length > 0 || topItemsData.length > 0) && (
        <div className="space-y-4">
          {dailySalesData.length > 0 && (
            <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-4 sm:p-6 overflow-hidden">
              <h4 className="text-[#1F2937] mb-4">နေ့စဉ် အရောင်းအခြေအနေ</h4>
              <div style={{ width: "100%", height: chartHeight }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                  <LineChart data={dailySalesData} margin={isMobile ? { top: 20, right: 15, left: -10, bottom: 5 } : { top: 25, right: 30, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.6} />
                    <XAxis dataKey="fullDate" stroke="#9CA3AF" tickLine={false} axisLine={{ stroke: "#E5E7EB" }} style={{ fontSize: isMobile ? "0.65rem" : "0.75rem" }} interval={isMobile ? "preserveStartEnd" : 0} tickFormatter={(v: string) => { const d = new Date(v); return isNaN(d.getTime()) ? v : `${d.getMonth() + 1}/${d.getDate()}`; }} />
                    <YAxis stroke="#9CA3AF" tickLine={false} axisLine={{ stroke: "#E5E7EB" }} width={isMobile ? 40 : 55} style={{ fontSize: isMobile ? "0.65rem" : "0.75rem" }} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${Number(v).toLocaleString()} \u1001\u102f`, "\u101b\u1031\u102c\u1004\u103a\u1038\u1001\u103b"]} />
                    <Line key="sales-qty" type="monotone" dataKey="quantity" name="ရောင်းချ" stroke="#D6B25E" strokeWidth={2.5} dot={{ fill: "#D6B25E", r: isMobile ? 2 : 3 }} activeDot={{ r: isMobile ? 5 : 7, stroke: "#D6B25E", strokeWidth: 2, fill: "#fff" }} label={isMobile ? undefined : { position: "top", fill: "#6B7280", fontSize: 11, offset: 10, formatter: (v: number) => v > 0 ? v.toLocaleString() : "" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {topItemsData.length > 0 && (() => {
            const barH = Math.max(isMobile ? 180 : 200, topItemsData.length * (isMobile ? 36 : 40) + 60);
            return (
              <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-4 sm:p-6 overflow-hidden">
                <h4 className="text-[#1F2937] mb-4">အရောင်းအများဆုံး ပစ္စည်းများ</h4>
                <div style={{ width: "100%", height: barH }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                    <BarChart data={topItemsData} layout="vertical" barCategoryGap="30%" margin={isMobile ? { top: 5, right: 80, left: 0, bottom: 5 } : { top: 5, right: 90, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.6} horizontal={false} />
                      <XAxis type="number" stroke="#9CA3AF" tickLine={false} axisLine={{ stroke: "#E5E7EB" }} style={{ fontSize: isMobile ? "0.65rem" : "0.75rem" }} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`} />
                      <YAxis dataKey="name" type="category" allowDuplicatedCategory={false} stroke="#9CA3AF" tickLine={false} axisLine={{ stroke: "#E5E7EB" }} width={isMobile ? 60 : 80} style={{ fontSize: isMobile ? "0.7rem" : "0.8rem" }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${Number(v).toLocaleString()} \u1001\u102f`, "\u1005\u102f\u1005\u102f\u1015\u1031\u102b\u1004\u103a\u1038"]} />
                      <Bar key="sales-bar-total" dataKey="total" fill="#D6B25E" radius={[0, 6, 6, 0]} maxBarSize={isMobile ? 22 : 28}>
                        <LabelList dataKey="total" position="right" content={({ x, y, width, height, value }: any) => { if (!value || value <= 0) return null; return (<text x={(x || 0) + (width || 0) + 8} y={(y || 0) + (height || 0) / 2} fill="#6B7280" fontSize={isMobile ? 10 : 12} textAnchor="start" dominantBaseline="middle">{`${Number(value).toLocaleString()} ခု`}</text>); }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3 sm:p-4 space-y-3">
        {/* Desktop */}
        <div className="hidden sm:flex sm:flex-row sm:flex-wrap sm:items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>ရက်အပိုင်းအခြား</label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="pl-9 pr-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all" style={{ fontSize: "0.85rem" }} />
              </div>
              <span className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>မှ</span>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="pl-9 pr-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all" style={{ fontSize: "0.85rem" }} />
              </div>
            </div>
          </div>

          {/* Item dropdown */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>ပစ္စည်း</label>
            <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center justify-between gap-8 px-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] hover:border-[#D6B25E]/50 transition-all cursor-pointer min-w-[160px]" style={{ fontSize: "0.85rem" }}>
              <span>{selectedItem}</span>
              <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
            </button>
            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-lg z-20 py-1 max-h-64 overflow-auto">
                {[ALL_ITEMS_LABEL, ...itemNames].map((item) => (
                  <button key={item} onClick={() => { setSelectedItem(item); setDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-[#FAF6EC] transition-colors cursor-pointer ${selectedItem === item ? "text-[#B8943C] bg-[#FAF6EC]" : "text-[#1F2937]"}`} style={{ fontSize: "0.85rem" }}>
                    {item === ALL_ITEMS_LABEL ? ALL_ITEMS_DROPDOWN_LABEL : item}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Customer dropdown */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>ဝယ်ယူသူ</label>
            <button onClick={() => { setCustomerDropdownOpen(!customerDropdownOpen); setDropdownOpen(false); }} className="flex items-center justify-between px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] w-full cursor-pointer" style={{ fontSize: "0.85rem" }}>
              <span>{selectedCustomer}</span>
              <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
            </button>
            {customerDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-lg z-20 py-1 max-h-64 overflow-auto">
                {[ALL_CUSTOMERS_LABEL, ...allCustomers.map(c => c.name)].map((customer) => (
                  <button key={`mob-cust-${customer}`} onClick={() => { setSelectedCustomer(customer); setCustomerDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-[#FAF6EC] transition-colors cursor-pointer ${selectedCustomer === customer ? "text-[#B8943C] bg-[#FAF6EC]" : "text-[#1F2937]"}`} style={{ fontSize: "0.85rem" }}>
                    {customer === ALL_CUSTOMERS_LABEL ? ALL_CUSTOMERS_DROPDOWN_LABEL : customer}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>ရှာဖွေရန်</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input type="text" placeholder="ပစ္စည်း / ဝယ်ယူသူ ရှာရန်..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all" style={{ fontSize: "0.85rem" }} />
            </div>
          </div>

          <div className="flex items-end gap-2 ml-auto">
            <button onClick={handleReset} className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#1F2937] transition-all cursor-pointer" style={{ fontSize: "0.85rem" }}>
              <RotateCcw className="w-3.5 h-3.5" />
              ပြန်လည်သတ်မှတ်ရန်
            </button>
          </div>
        </div>

        {/* Mobile */}
        <div className="flex flex-col sm:hidden gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>စတင်ရက်</label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all" style={{ fontSize: "0.85rem" }} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>ကုန်ဆုံးရက်</label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all" style={{ fontSize: "0.85rem" }} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 relative">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>ပစ္စည်း</label>
            <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center justify-between px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] w-full cursor-pointer" style={{ fontSize: "0.85rem" }}>
              <span>{selectedItem}</span>
              <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
            </button>
            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-lg z-20 py-1 max-h-64 overflow-auto">
                {[ALL_ITEMS_LABEL, ...itemNames].map((item) => (
                  <button key={item} onClick={() => { setSelectedItem(item); setDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-[#FAF6EC] transition-colors cursor-pointer ${selectedItem === item ? "text-[#B8943C] bg-[#FAF6EC]" : "text-[#1F2937]"}`} style={{ fontSize: "0.85rem" }}>
                    {item === ALL_ITEMS_LABEL ? ALL_ITEMS_DROPDOWN_LABEL : item}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5 relative">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>ဝယ်ယူသူ</label>
            <button onClick={() => { setCustomerDropdownOpen(!customerDropdownOpen); setDropdownOpen(false); }} className="flex items-center justify-between px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] w-full cursor-pointer" style={{ fontSize: "0.85rem" }}>
              <span>{selectedCustomer}</span>
              <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
            </button>
            {customerDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-lg z-20 py-1 max-h-64 overflow-auto">
                {[ALL_CUSTOMERS_LABEL, ...allCustomers.map(c => c.name)].map((customer) => (
                  <button key={`mob-cust-${customer}`} onClick={() => { setSelectedCustomer(customer); setCustomerDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-[#FAF6EC] transition-colors cursor-pointer ${selectedCustomer === customer ? "text-[#B8943C] bg-[#FAF6EC]" : "text-[#1F2937]"}`} style={{ fontSize: "0.85rem" }}>
                    {customer === ALL_CUSTOMERS_LABEL ? ALL_CUSTOMERS_DROPDOWN_LABEL : customer}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={handleReset} className="w-full flex items-center justify-center gap-1.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] transition-all cursor-pointer" style={{ fontSize: "0.85rem", height: "44px" }}>
            <RotateCcw className="w-3.5 h-3.5" />
            ပြန်လည်သတ်မှတ်ရန်
          </button>
        </div>

        {/* Quick range chips */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="text-[#9CA3AF] mr-1" style={{ fontSize: "0.75rem" }}>အမြန်ရွေးရန်:</span>
          {QUICK_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => handleRangeChange(r.value)}
              className={`px-3.5 rounded-full border transition-all cursor-pointer ${
                selectedRange === r.value
                  ? "bg-[#FAF6EC] text-[#B8943C] border-[#D6B25E]/40"
                  : "bg-white text-[#6B7280] border-[#E5E7EB] hover:bg-[#FAF6EC] hover:text-[#1F2937]"
              }`}
              style={{ fontSize: "0.8rem", height: "32px" }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sales Log Table ── */}
      <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 sm:p-7">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <h3 className="text-[#1F2937]">အရောင်းမှတ်တမ်းစာရင်း</h3>
          <span className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>
            {filteredSales.length} မှတ်တမ်း
          </span>
        </div>

        {filteredSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#9CA3AF]">
            <ShoppingBag className="w-12 h-12 text-[#E8D5A0]" />
            <p>ရောင်းချမှု မရှိသေးပါ</p>
            <p style={{ fontSize: "0.8rem" }}>ရွေးချယ်ထားသော စစ်ထုတ်မှုအတွက် မှတ်တမ်းမတွေ့ပါ။</p>
          </div>
        ) : (
          <>
            {/* Selection action bar */}
            {selectedIds.size > 0 && (
              <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-red-50 border-b border-red-200 px-4 py-3 shadow-md">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedIds(new Set())} className="p-1 rounded hover:bg-red-100 transition-colors cursor-pointer">
                    <X className="w-4 h-4 text-red-500" />
                  </button>
                  <span className="text-red-700" style={{ fontSize: "0.85rem" }}>
                    {selectedIds.size} ခု ရွေးချယ်ထားသည်
                  </span>
                </div>
                <button
                  onClick={() => setBulkDeleteStep(1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-all cursor-pointer"
                  style={{ fontSize: "0.85rem" }}
                >
                  <Trash2 className="w-4 h-4" />
                  ရွေးထားသည်များ ဖျက်ရန်
                </button>
              </div>
            )}

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full" style={{ minWidth: "860px" }}>
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    <th className="text-center py-3 px-3" style={{ width: "44px" }}>
                      <button onClick={toggleSelectAll} className="p-0.5 rounded cursor-pointer hover:bg-[#FAF6EC] transition-colors">
                        {isAllSelected ? (
                          <CheckSquare className="w-[18px] h-[18px] text-[#D6B25E]" />
                        ) : isSomeSelected ? (
                          <MinusSquare className="w-[18px] h-[18px] text-[#D6B25E]" />
                        ) : (
                          <Square className="w-[18px] h-[18px] text-[#9CA3AF]" />
                        )}
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 text-[#6B7280]" style={{ fontSize: "0.8rem" }}>ရက်စွဲ</th>
                    <th className="text-left py-3 px-4 text-[#6B7280]" style={{ fontSize: "0.8rem" }}>ပစ္စည်း</th>
                    <th className="text-center py-3 px-4 text-[#6B7280]" style={{ fontSize: "0.8rem" }}>အရေအတွက်</th>
                    <th className="text-left py-3 px-4 text-[#6B7280]" style={{ fontSize: "0.8rem" }}>ဝယ်ယူသူ</th>
                    <th className="text-left py-3 px-4 text-[#6B7280]" style={{ fontSize: "0.8rem" }}>မှတ်ချက်</th>
                    <th className="text-center py-3 px-2 text-[#6B7280]" style={{ fontSize: "0.8rem" }}>ပြင်ရန်</th>
                    <th className="text-center py-3 px-2 text-[#6B7280]" style={{ fontSize: "0.8rem" }}>ဖျက်ရန်</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((s) => (
                    <tr key={s.id} className={`border-b border-[#E5E7EB]/60 hover:bg-[#FAF6EC] transition-colors ${selectedIds.has(s.id) ? "bg-[#FAF6EC]" : ""}`}>
                      <td className="py-3.5 px-3 text-center" style={{ width: "44px" }}>
                        <button onClick={() => toggleSelect(s.id)} className="p-0.5 rounded cursor-pointer hover:bg-[#FAF6EC] transition-colors">
                          {selectedIds.has(s.id) ? (
                            <CheckSquare className="w-[18px] h-[18px] text-[#D6B25E]" />
                          ) : (
                            <Square className="w-[18px] h-[18px] text-[#9CA3AF]" />
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="text-[#1F2937]" style={{ fontSize: "0.85rem" }}>{formatDate(s.sold_at || s.created_at)}</span>
                          {formatTime(s.sold_at || s.created_at) && (
                            <span className="text-[#9CA3AF] ml-2" style={{ fontSize: "0.75rem" }}>{formatTime(s.sold_at || s.created_at)}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#1F2937]" style={{ fontSize: "0.85rem" }}>{s.item_name}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[40px] px-2.5 py-0.5 rounded-full bg-[#FAF6EC] text-[#B8943C] border border-[#D6B25E]/20" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                          {s.quantity}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[#6B7280]" style={{ fontSize: "0.85rem" }}>{s.customer_name}</td>
                      <td className="py-3.5 px-4 text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>{s.note || "\u2014"}</td>
                      <td className="py-3.5 px-2 text-center">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-[8px] text-[#6B7280] hover:text-[#D6B25E] hover:bg-[#FAF6EC] transition-all cursor-pointer" title="ပြင်ရန်">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="py-3.5 px-2 text-center">
                        <button onClick={() => setDeleteRow(s)} className="p-1.5 rounded-[8px] text-[#6B7280] hover:text-[#DC2626] hover:bg-red-50 transition-all cursor-pointer" title="ဖျက်ရန်">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-3">
              {filteredSales.map((s) => (
                <div key={s.id} className={`border rounded-[12px] p-4 ${selectedIds.has(s.id) ? "border-[#D6B25E] bg-[#FAF6EC]/50" : "border-[#E5E7EB]"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <button onClick={() => toggleSelect(s.id)} className="p-0.5 rounded cursor-pointer mt-0.5 shrink-0">
                        {selectedIds.has(s.id) ? (
                          <CheckSquare className="w-[18px] h-[18px] text-[#D6B25E]" />
                        ) : (
                          <Square className="w-[18px] h-[18px] text-[#9CA3AF]" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className="text-[#1F2937]" style={{ fontSize: "1rem" }}>{s.item_name}</p>
                        <p className="text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>
                          {formatDate(s.sold_at || s.created_at)} {formatTime(s.sold_at || s.created_at)}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center justify-center min-w-[40px] px-2.5 py-1 rounded-full bg-[#FAF6EC] text-[#B8943C] border border-[#D6B25E]/20 shrink-0 ml-2" style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                      {s.quantity}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <p className="text-[#9CA3AF]" style={{ fontSize: "0.7rem" }}>ဝယ်ယူသူ</p>
                      <p className="text-[#6B7280]" style={{ fontSize: "0.85rem" }}>{s.customer_name}</p>
                    </div>
                    {s.note && (
                      <div>
                        <p className="text-[#9CA3AF]" style={{ fontSize: "0.7rem" }}>မှတ်ချက်</p>
                        <p className="text-[#9CA3AF]" style={{ fontSize: "0.85rem" }}>{s.note}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 border-t border-[#E5E7EB]/60 pt-2">
                    <button onClick={() => openEdit(s)} className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] text-[#6B7280] hover:text-[#D6B25E] hover:bg-[#FAF6EC] transition-all cursor-pointer border border-[#E5E7EB]" style={{ fontSize: "0.75rem" }}>
                      <Pencil className="w-3.5 h-3.5" /> ပြင်ရန်
                    </button>
                    <button onClick={() => setDeleteRow(s)} className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] text-[#6B7280] hover:text-[#DC2626] hover:bg-red-50 transition-all cursor-pointer border border-[#E5E7EB]" style={{ fontSize: "0.75rem" }}>
                      <Trash2 className="w-3.5 h-3.5" /> ဖျက်ရန်
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Edit Modal ── */}
      {editingRow && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setEditingRow(null)}>
          <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[#1F2937]">အရောင်းမှတ်တမ်း ပြင်ဆင်ရန်</h3>
              <button onClick={() => setEditingRow(null)} className="p-1 rounded-full hover:bg-[#F3F4F6] cursor-pointer"><X className="w-5 h-5 text-[#6B7280]" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[#6B7280] block mb-1" style={{ fontSize: "0.75rem" }}>ရက်စွ</label>
                <input type="date" value={editForm.sold_at} onChange={(e) => setEditForm({ ...editForm, sold_at: e.target.value })} className="w-full px-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E]" style={{ fontSize: "0.85rem" }} />
              </div>
              <div>
                <label className="text-[#6B7280] block mb-1" style={{ fontSize: "0.75rem" }}>ပစ္စည်း</label>
                <select value={editForm.item_id} onChange={(e) => setEditForm({ ...editForm, item_id: e.target.value })} className="w-full px-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E]" style={{ fontSize: "0.85rem" }}>
                  {allItems.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[#6B7280] block mb-1" style={{ fontSize: "0.75rem" }}>အရေအတွက်</label>
                <input type="text" inputMode="numeric" value={editForm.quantityStr} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d+$/.test(v)) setEditForm({ ...editForm, quantityStr: v }); }} className="w-full px-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E]" style={{ fontSize: "0.85rem" }} />
              </div>
              <div>
                <label className="text-[#6B7280] block mb-1" style={{ fontSize: "0.75rem" }}>ဝယ်ယူသူ</label>
                <select value={editForm.customer_id} onChange={(e) => setEditForm({ ...editForm, customer_id: e.target.value })} className="w-full px-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E]" style={{ fontSize: "0.85rem" }}>
                  <option value="">— Walk-in —</option>
                  {allCustomers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[#6B7280] block mb-1" style={{ fontSize: "0.75rem" }}>မှတ်ချက်</label>
                <input type="text" value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} className="w-full px-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E]" style={{ fontSize: "0.85rem" }} placeholder="မှတ်ချက် ထည့်ပါ..." />
              </div>
              {editError && (
                <div className="text-red-500 text-sm mt-1">{editError}</div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button onClick={() => setEditingRow(null)} className="flex-1 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-all cursor-pointer" style={{ fontSize: "0.85rem" }}>
                မလုပ်တော့ပါ
              </button>
              <button onClick={handleEditSave} disabled={editSaving || !editForm.item_id} className="flex-1 py-2.5 rounded-[10px] bg-[#D6B25E] text-white hover:bg-[#C4A24D] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" style={{ fontSize: "0.85rem" }}>
                {editSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                သိမ်းဆည်းရန်
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteRow && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteRow(null)}>
          <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-[#DC2626]" />
              </div>
              <div>
                <h3 className="text-[#1F2937]">ဖျက်ရန် အတည်ပြုပါ</h3>
                <p className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>
                  {deleteRow.item_name} — {deleteRow.quantity} ခု ဖျက်မည်လား?
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button onClick={() => setDeleteRow(null)} className="flex-1 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-all cursor-pointer" style={{ fontSize: "0.85rem" }}>
                မလုပ်တော့ပါ
              </button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-[10px] bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2" style={{ fontSize: "0.85rem" }}>
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                ဖျက်မည်
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Delete Confirm Modal (double confirmation) ── */}
      {bulkDeleteStep > 0 && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setBulkDeleteStep(0)}>
          <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            {bulkDeleteStep === 1 && (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5 text-[#DC2626]" />
                  </div>
                  <div>
                    <h3 className="text-[#1F2937]">ဖျက်ရန် အတည်ပြုပါ</h3>
                    <p className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>
                      {selectedIds.size} ခု အရောင်းမှတ်တမ်း ဖျက်မည်လား?
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={() => setBulkDeleteStep(0)} className="flex-1 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-all cursor-pointer" style={{ fontSize: "0.85rem" }}>
                    မလုပ်တော့ပါ
                  </button>
                  <button onClick={() => setBulkDeleteStep(2)} className="flex-1 py-2.5 rounded-[10px] bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-all cursor-pointer" style={{ fontSize: "0.85rem" }}>
                    ဖျက်မည်
                  </button>
                </div>
              </>
            )}
            {bulkDeleteStep === 2 && (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
                  </div>
                  <div>
                    <h3 className="text-[#1F2937]">နောက်ဆုံး အတည်ပြုချက်</h3>
                    <p className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>
                      ဤလုပ်ဆောင်ချက်ကို ပြန်ဖျက်၍မရပါ။ {selectedIds.size} ခု ဖျက်မည်လား?
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={() => setBulkDeleteStep(0)} className="flex-1 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-all cursor-pointer" style={{ fontSize: "0.85rem" }}>
                    မလုပ်တော့ပါ
                  </button>
                  <button onClick={handleBulkDelete} disabled={bulkDeleting} className="flex-1 py-2.5 rounded-[10px] bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2" style={{ fontSize: "0.85rem" }}>
                    {bulkDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                    အတည်ပြု ဖျက်မည်
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}