import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import {
  LayoutDashboard,
  FileBarChart,
  Package,
  LogOut,
  Cake,
  Menu,
  X,
  AlertTriangle,
  Search,
  ArrowRight,
  Settings,
  Pencil,
  Trash2,
  Plus,
  ScanBarcode,
  Loader2,
  ShoppingBag,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
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
  Legend,
  Cell,
  LabelList,
} from "recharts";
import { FilterBar } from "./FilterBar";
import { DataEntryContent } from "./DataEntryContent";
import * as db from "./db";
import { supabase } from "./supabaseClient";
import { UserManagement } from "./UserManagement";
import { SalesContent } from "./SalesContent";
import { ProductionLogContent } from "./ProductionLogContent";
import { CustomerManagement } from "./CustomerManagement";

// ── Sidebar items ──
const sidebarItems = [
  { icon: LayoutDashboard, label: "ယနေ့အခြေအနေ", id: "dashboard" },
  { icon: ScanBarcode, label: "မှတ်တမ်းသွင်းရန်", id: "data_entry" },
  { icon: Cake, label: "ကုန်ထုတ်လုပ်မှုမှတ်တမ်း", id: "production_log" },
  { icon: ShoppingBag, label: "အရောင်းမှတ်တမ်း", id: "sales" },
  { icon: Package, label: "လက်ကျန်ပစ္စည်း", id: "inventory" },
  { icon: FileBarChart, label: "အစီရင်ခံစာ", id: "reports" },
  { icon: Settings, label: "စနစ်ဆက်တင်", id: "settings" },
];

// Tabs visible to staff role
const staffVisibleTabs = new Set(["dashboard", "data_entry"]);

// ── Types ──
interface Product {
  id: string;
  name: string;
  todayProduced: number;
  currentStock: number;
  lowStockThreshold: number;
  status: "in_stock" | "low_stock" | "critical";
}

interface ItemData {
  id: string;
  name: string;
  low_stock_threshold: number;
  is_active?: boolean;
}

function deriveStatus(stock: number, threshold: number): Product["status"] {
  if (stock <= threshold / 2) return "critical";
  if (stock <= threshold) return "low_stock";
  return "in_stock";
}

const statusConfig = {
  in_stock: { label: "လက်ကျန်ရှိ", bg: "bg-green-50", text: "text-[#16A34A]", border: "border-green-200", dot: "bg-[#16A34A]" },
  low_stock: { label: "လက်ကျန်နည်း", bg: "bg-amber-50", text: "text-[#F59E0B]", border: "border-amber-200", dot: "bg-[#F59E0B]" },
  critical: { label: "လက်ကျန်မရှိ", bg: "bg-red-50", text: "text-[#DC2626]", border: "border-red-200", dot: "bg-[#DC2626]" },
};

const ALL_ITEMS_LABEL = "ပစ္စည်းအမျိုးအစားများ";
const ALL_ITEMS_DROPDOWN_LABEL = "ပစ္စည်း အားလုံး";

// ── Helper: date defaults ──
function getDefaultDates(range: string) {
  const to = new Date();
  const from = new Date();
  switch (range) {
    case "7 Days": from.setDate(to.getDate() - 6); break;
    case "14 Days": from.setDate(to.getDate() - 13); break;
    case "30 Days": from.setDate(to.getDate() - 29); break;
    case "This Month": from.setDate(1); break;
    default: from.setDate(to.getDate() - 6);
  }
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    from: fmt(from),
    to: fmt(to),
  };
}

// ── Component ──
export function AdminDashboard({ role = "admin" }: { role?: "admin" | "staff" }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Data from API ──
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<ItemData[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Settings modal state
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [modalForm, setModalForm] = useState({ name: "", threshold: 10 });
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<{ productionCount: number; salesCount: number } | null>(null);
  const [deleteChecking, setDeleteChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filter state
  const defaults = getDefaultDates("7 Days");
  const [selectedRange, setSelectedRange] = useState("7 Days");
  const [selectedItem, setSelectedItem] = useState(ALL_ITEMS_LABEL);
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);

  // Reports tab state
  const [reportTab, setReportTab] = useState("overview");

  // Settings sub-tab state
  const [settingsTab, setSettingsTab] = useState("items");

  // Inventory filters
  const [invSearch, setInvSearch] = useState("");
  const [invStatus, setInvStatus] = useState("All");
  const [invSearchFocused, setInvSearchFocused] = useState(false);
  const invSearchRef = useRef<HTMLDivElement>(null);

  // Close inventory search suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (invSearchRef.current && !invSearchRef.current.contains(e.target as Node)) {
        setInvSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Unique item names for inventory search suggestions
  const invItemNames = useMemo(() => {
    return products.map((p) => p.name).filter(Boolean).sort();
  }, [products]);

  const invSearchSuggestions = useMemo(() => {
    if (!invSearch) return invItemNames;
    const q = invSearch.toLowerCase();
    return invItemNames.filter((name) => name.toLowerCase().includes(q));
  }, [invItemNames, invSearch]);

  // ── Load data from Supabase directly ──
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [stockData, itemsData, daily] = await Promise.all([
        db.getStockWithToday(),
        db.getItems(),
        db.getDailyProduction(30),
      ]);

      setItems(itemsData);

      const prods: Product[] = stockData.map((s: any) => ({
        id: s.id,
        name: s.name,
        todayProduced: s.todayProduced,
        currentStock: s.currentStock,
        lowStockThreshold: s.lowStockThreshold,
        status: deriveStatus(s.currentStock, s.lowStockThreshold),
      }));
      setProducts(prods);
      setDailyData(daily);
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh data when switching to certain tabs
  useEffect(() => {
    if (!loading && (activeTab === "dashboard" || activeTab === "inventory" || activeTab === "settings" || activeTab === "sales" || activeTab === "production_log")) {
      loadData();
    }
  }, [activeTab]);

  const handleRangeChange = (r: string) => {
    setSelectedRange(r);
    if (r !== "Custom") {
      const d = getDefaultDates(r);
      setDateFrom(d.from);
      setDateTo(d.to);
    }
  };

  const handleReset = () => {
    setSelectedRange("7 Days");
    setSelectedItem(ALL_ITEMS_LABEL);
    const d = getDefaultDates("7 Days");
    setDateFrom(d.from);
    setDateTo(d.to);
  };

  const goToItemTrend = (itemName: string) => {
    setActiveTab("reports");
    setReportTab("byItem");
    setSelectedItem(itemName);
    setSelectedRange("7 Days");
    const d = getDefaultDates("7 Days");
    setDateFrom(d.from);
    setDateTo(d.to);
  };

  // ── Derived data ──
  const lowStockAlerts = products.filter((p) => p.currentStock <= p.lowStockThreshold);

  const filteredDaily = useMemo(() => {
    const fromD = new Date(dateFrom);
    const toD = new Date(dateTo);
    const filtered = dailyData.filter((d: any) => {
      if (!d.fullDate) return false;
      const dd = new Date(d.fullDate);
      if (isNaN(dd.getTime())) return false;
      return dd >= fromD && dd <= toD;
    });
    // Deduplicate by fullDate to prevent Recharts duplicate key warnings
    const seen = new Set<string>();
    return filtered.filter((d: any) => {
      if (seen.has(d.fullDate)) return false;
      seen.add(d.fullDate);
      return true;
    }).map((d: any, idx: number) => {
      // Ensure all product keys are numeric (not null/undefined) to prevent null key warnings
      const sanitized: any = { ...d, _uid: `day-${d.fullDate}-${idx}` };
      for (const p of products) {
        if (p.name && sanitized[p.name] == null) sanitized[p.name] = 0;
      }
      if (sanitized.total == null) sanitized.total = 0;
      return sanitized;
    });
  }, [dateFrom, dateTo, dailyData, products]);

  const topItemsData = useMemo(() => {
    const names = products.map((p) => p.name).filter(Boolean);
    const seen = new Set<string>();
    const totals: { name: string; total: number }[] = [];
    for (const n of names) {
      if (seen.has(n)) continue;
      seen.add(n);
      totals.push({
        name: n,
        total: filteredDaily.reduce((s: number, d: any) => s + ((d[n] as number) || 0), 0),
      });
    }
    return totals.sort((a, b) => b.total - a.total);
  }, [filteredDaily, products]);

  const reportSummary = useMemo(() => {
    if (!filteredDaily.length) return { totalProduced: 0, avgPerDay: 0, highestDay: 0, lowestDay: 0, totalDays: 0, itemCount: 0 };
    const isFiltered = selectedItem !== ALL_ITEMS_LABEL;
    const vals = filteredDaily.map((d: any) => {
      if (isFiltered) return (d[selectedItem] as number) || 0;
      return (d.total as number) || 0;
    });
    const totalProduced = vals.reduce((a: number, b: number) => a + b, 0);
    const avgPerDay = vals.length ? Math.round(totalProduced / vals.length) : 0;
    const highestDay = vals.length ? Math.max(...vals) : 0;
    const lowestDay = vals.length ? Math.min(...vals) : 0;
    return { totalProduced, avgPerDay, highestDay, lowestDay, totalDays: filteredDaily.length, itemCount: products.length };
  }, [filteredDaily, selectedItem, products]);

  const byItemStats = useMemo(() => {
    if (selectedItem === ALL_ITEMS_LABEL) return null;
    const vals = filteredDaily.map((d: any) => (d[selectedItem] as number) || 0);
    const total = vals.reduce((a: number, b: number) => a + b, 0);
    const avg = vals.length ? Math.round(total / vals.length) : 0;
    const highest = vals.length ? Math.max(...vals) : 0;
    const lowest = vals.length ? Math.min(...vals) : 0;
    return { total, avg, highest, lowest };
  }, [filteredDaily, selectedItem]);

  const filteredInventory = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(invSearch.toLowerCase());
      const matchStatus =
        invStatus === "All" ||
        (invStatus === "In Stock" && p.status === "in_stock") ||
        (invStatus === "Low Stock" && p.status === "low_stock") ||
        (invStatus === "Critical" && p.status === "critical");
      return matchSearch && matchStatus;
    });
  }, [invSearch, invStatus, products]);

  const filterProps = {
    selectedRange,
    onRangeChange: handleRangeChange,
    selectedItem,
    onItemChange: setSelectedItem,
    onApply: () => {},
    onReset: handleReset,
    dateFrom,
    dateTo,
    onDateFromChange: setDateFrom,
    onDateToChange: setDateTo,
    itemNames: products.map((p) => p.name),
  };

  const tooltipStyle: React.CSSProperties = {
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    padding: "10px 14px",
  };

  // Custom tooltip for line charts (date-based)
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const dateLabel = (() => {
      const d = new Date(label);
      return isNaN(d.getTime()) ? label : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    })();
    return (
      <div style={{ ...tooltipStyle, fontSize: isMobile ? "0.75rem" : "0.85rem", maxWidth: isMobile ? "180px" : "260px" }}>
        <p style={{ color: "#6B7280", marginBottom: "6px", fontWeight: 500 }}>{dateLabel}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "2px 0" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: entry.color || "#D6B25E", flexShrink: 0 }} />
            <span style={{ color: "#374151" }}>{entry.name}:</span>
            <span style={{ color: "#1F2937", fontWeight: 600, marginLeft: "auto" }}>{entry.value} ခု</span>
          </div>
        ))}
      </div>
    );
  };

  // Custom tooltip for horizontal bar chart (top items)
  const BarTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0]?.payload;
    return (
      <div style={{ ...tooltipStyle, fontSize: isMobile ? "0.75rem" : "0.85rem" }}>
        <p style={{ color: "#374151", fontWeight: 500, marginBottom: "4px" }}>{data?.name}</p>
        <p style={{ color: "#1F2937", fontWeight: 600 }}>စုစုပေါင်း: {payload[0]?.value} ခု</p>
      </div>
    );
  };

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const chartHeight = isMobile ? 220 : 280;
  const reportChartHeight = isMobile ? 200 : 240;

  // ── Settings: Save/Delete handlers ──
  const handleSaveItem = async () => {
    if (!modalForm.name.trim() || saving) return;
    setSaving(true);
    try {
      if (editingItem) {
        await db.updateItem(editingItem.id, modalForm.name.trim(), modalForm.threshold);
      } else {
        await db.createItem(modalForm.name.trim(), modalForm.threshold);
      }
      await loadData();
      setShowItemModal(false);
    } catch (e: any) {
      console.error("Save item error:", e);
      alert(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = async (item: Product) => {
    setDeleteConfirm(item);
    setDeleteUsage(null);
    setDeleteChecking(true);
    try {
      const usage = await db.getItemUsage(item.id);
      setDeleteUsage(usage);
    } catch (e: any) {
      console.error("Failed to check item usage:", e);
      setDeleteUsage({ productionCount: 0, salesCount: 0 });
    } finally {
      setDeleteChecking(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteConfirm || saving) return;
    setSaving(true);
    try {
      await db.deleteItem(deleteConfirm.id);
      await loadData();
      setDeleteConfirm(null);
    } catch (e: any) {
      console.error("Delete item error:", e);
      alert(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#F7F6F3]" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#D6B25E]" />
          <span className="text-[#9CA3AF]">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full max-w-[100vw] bg-[#F7F6F3] flex overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed z-50 top-0 left-0 h-screen bg-white border-r border-[#E5E7EB] flex flex-col overflow-hidden transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        style={{ width: "260px" }}
      >
        <div className="p-6 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FAF6EC] border border-[#E5E7EB] flex items-center justify-center">
              <Cake className="w-5 h-5 text-[#D6B25E]" />
            </div>
            <div>
              <h3 className="text-[#1F2937]">ACT Bakery</h3>
              <p className="text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>{role === "admin" ? "Admin Panel" : "Staff Panel"}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-1">
          {sidebarItems.filter((item) => role === "admin" || staffVisibleTabs.has(item.id)).map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-[12px] transition-all cursor-pointer w-full text-left ${
                activeTab === item.id
                  ? "bg-[#FAF6EC] text-[#B8943C] border border-[#D6B25E]/30"
                  : "text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#1F2937] border border-transparent"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-[#E5E7EB]">
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate("/"); }}
            className="flex items-center gap-3 px-4 py-3 rounded-[12px] text-[#6B7280] hover:bg-red-50 hover:text-red-500 transition-all w-full cursor-pointer border border-transparent"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col h-screen lg:ml-[260px] min-w-0 max-w-full">
        {/* Header */}
        <header
          className="fixed top-0 right-0 bg-white border-b border-[#E5E7EB] px-4 sm:px-6 flex items-center justify-between z-30 lg:left-[260px] left-0"
          style={{ height: "72px" }}
        >
          <div className="flex items-center gap-3 lg:flex-none flex-1 lg:flex-initial">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-[#6B7280] cursor-pointer shrink-0">
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <div className="lg:text-left text-center flex-1 lg:flex-initial">
              <h2 className="text-[#1F2937] capitalize">
                {activeTab === "dashboard" ? "အနှစ်ချုပ်" : activeTab === "data_entry" ? "မှတ်တမ်းသွင်းရန်" : activeTab === "production_log" ? "ကုန်ထုတ်လုပ်မှုမှတ်တမ်း" : activeTab === "sales" ? "အရောင်းမှတ်တမ်း" : activeTab === "inventory" ? "လက်ကျန်ပစ္စည်း" : activeTab === "reports" ? "အစီရင်ခံစာ" : activeTab === "settings" ? "စနစ်ဆက်တင်" : activeTab}
              </h2>
              {activeTab === "dashboard" && (
                <p className="text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>ထုတ်လုပ်မှုနှင့် လက်ကျန် စီမံခန့်ခွဲမှု</p>
              )}
              {activeTab === "data_entry" && (
                <p className="text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>ထုတ်လုပ်မှု မှတ်တမ်းသွင်းရန်</p>
              )}
              {activeTab === "production_log" && (
                <p className="text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>ထုတ်လုပ်မှု မှတ်တမ်းများ ကြည့်ရှု/ပြင်ဆင်ရန်</p>
              )}
              {activeTab === "sales" && (
                <p className="text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>ရောင်းချမှု မှတ်တမ်းများ</p>
              )}
              {activeTab === "inventory" && (
                <p className="text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>လက်ကျန်ပစ္စည်း စီမံခန့်ခွဲမှု</p>
              )}
              {activeTab === "reports" && (
                <p className="text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>အစီရင်ခံစာများ ကြည့်ရှုရန်</p>
              )}
              {activeTab === "settings" && (
                <p className="text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>စနစ် ပြင်ဆင်သတ်မှတ်ချက်များ</p>
              )}
            </div>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#FAF6EC] border border-[#E5E7EB] flex items-center justify-center text-[#B8943C] shrink-0" style={{ fontSize: "0.8rem" }}>
            {role === "admin" ? "A" : "S"}
          </div>
        </header>

        {/* Scrollable content area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0" style={{ marginTop: "72px" }}>
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4 sm:py-6 min-w-0 w-full box-border">

            {/* ═══════ DASHBOARD ═══════ */}
            {activeTab === "dashboard" && (
              <div className="space-y-10">
                {/* Today Snapshot */}
                <div>
                  <div className="mb-5">
                    <h3 className="text-[#1F2937]">ယနေ့ အခြေအနေ</h3>
                    <p className="text-[#9CA3AF] mt-0.5" style={{ fontSize: "0.85rem" }}>ယနေ့ ထုတ်လုပ်မှုနှင့် လက်ကျန်ပမာဏ အခြေအနေ</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                    {products.map((product) => {
                      const sc = statusConfig[product.status];
                      return (
                        <div key={product.id} className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[#1F2937]" style={{ fontSize: "1.05rem" }}>{product.name}</span>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`} style={{ fontSize: "0.7rem" }}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                              {sc.label}
                            </span>
                          </div>
                          <div className="flex items-end justify-between mt-auto">
                            <div>
                              <p className="text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>ယနေ့ ထုတ်လုပ်</p>
                              <p className="text-[#1F2937]" style={{ fontSize: "1.35rem" }}>{product.todayProduced}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>လက်ကျန်ပမာဏ</p>
                              <p className={product.currentStock <= product.lowStockThreshold ? "text-[#DC2626]" : "text-[#1F2937]"} style={{ fontSize: "1.35rem" }}>{product.currentStock}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Low Stock Alerts */}
                {lowStockAlerts.length > 0 && (
                  <div className="bg-amber-50/60 border border-amber-200/60 rounded-[12px] px-5 py-4 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2 shrink-0">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="text-amber-700" style={{ fontSize: "0.85rem" }}>
                        လက်ကျန်နည်းနေသော ပစ္စည်းများ – {lowStockAlerts.length} မျိုး
                      </span>
                    </div>
                    <div className="h-5 w-px bg-amber-200/80 shrink-0 hidden sm:block" />
                    <div className="flex items-center gap-2 flex-wrap">
                      {lowStockAlerts.map((item) => (
                        <span
                          key={item.id}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${
                            item.status === "critical"
                              ? "bg-red-50 text-[#DC2626] border-red-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                          style={{ fontSize: "0.8rem" }}
                        >
                          {item.name}
                          <span className="opacity-60">&middot;</span>
                          <span>{item.currentStock}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Production Trend */}
                <div className="bg-[#F9FAFB] rounded-2xl p-4 sm:p-6 space-y-5 overflow-hidden">
                  <div>
                    <h3 className="text-[#1F2937]">ကုန်ထုတ်လုပ်မှု အခြေအနေ</h3>
                    <p className="text-[#9CA3AF] mt-0.5" style={{ fontSize: "0.85rem" }}>ရက်စွဲနှင့် ပစ္စည်းရွေးချယ်ပြီး ထုတ်လုပ်မှုကို ကြည့်ပါ</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className={`bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-4 sm:p-6 overflow-hidden ${selectedItem === ALL_ITEMS_LABEL ? "lg:col-span-2" : "lg:col-span-3"}`}>
                      <h4 className="text-[#1F2937] mb-4">
                        {selectedItem === ALL_ITEMS_LABEL
                          ? "နေ့စဉ် ထုတ်လုပ်မှု — ပစ္စည်းအားလုံး (စုစုပေါင်း)"
                          : `နေ့စဉ် ထုတ်လုပ်မှု — ${selectedItem}`}
                      </h4>
                      {filteredDaily.length > 0 ? (
                        <div style={{ width: "100%", height: chartHeight }}>
                          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                            <LineChart data={filteredDaily} margin={isMobile ? { top: 20, right: 15, left: -10, bottom: 5 } : { top: 25, right: 30, left: 5, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.6} />
                              <XAxis dataKey="fullDate" stroke="#9CA3AF" tickLine={false} axisLine={{ stroke: "#E5E7EB" }} style={{ fontSize: isMobile ? "0.65rem" : "0.75rem" }} interval={isMobile ? "preserveStartEnd" : 0} tickFormatter={(v: string) => { const d = new Date(v); return isNaN(d.getTime()) ? v : `${d.getMonth()+1}/${d.getDate()}`; }} />
                              <YAxis stroke="#9CA3AF" tickLine={false} axisLine={{ stroke: "#E5E7EB" }} width={isMobile ? 40 : 55} style={{ fontSize: isMobile ? "0.65rem" : "0.75rem" }} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`} />
                              <Tooltip content={<CustomTooltip />} />
                              <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ paddingBottom: "12px", fontSize: "0.8rem" }} />
                              {selectedItem === ALL_ITEMS_LABEL ? (
                                <Line key="line-total" type="monotone" dataKey="total" name="စုစုပေါင်း" stroke="#D6B25E" strokeWidth={2} dot={{ fill: "#D6B25E", r: isMobile ? 2 : 3 }} activeDot={{ r: isMobile ? 5 : 7, stroke: "#D6B25E", strokeWidth: 2, fill: "#fff" }} label={isMobile ? undefined : { position: "top", fill: "#6B7280", fontSize: 11, offset: 10, formatter: (v: number) => v > 0 ? v.toLocaleString() : "" }} />
                              ) : (
                                <Line key={`line-${selectedItem}`} type="monotone" dataKey={selectedItem} name={selectedItem} stroke="#D6B25E" strokeWidth={2} dot={{ fill: "#D6B25E", r: isMobile ? 2 : 3 }} activeDot={{ r: isMobile ? 5 : 7, stroke: "#D6B25E", strokeWidth: 2, fill: "#fff" }} label={isMobile ? undefined : { position: "top", fill: "#6B7280", fontSize: 11, offset: 10, formatter: (v: number) => v > 0 ? v.toLocaleString() : "" }} />
                              )}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div style={{ height: chartHeight }} className="flex items-center justify-center text-[#9CA3AF]"><p style={{ fontSize: "0.85rem" }}>ဒေတာ မရှိပါ</p></div>
                      )}
                    </div>

                    {selectedItem === ALL_ITEMS_LABEL && topItemsData.length > 0 && (
                      <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-4 sm:p-6 overflow-hidden">
                        <h4 className="text-[#1F2937] mb-4">ထိပ်တန်း ပစ္စည်းများ</h4>
                        <div style={{ width: "100%", height: Math.max(isMobile ? 180 : 220, topItemsData.length * (isMobile ? 36 : 40) + 40), overflow: "visible" }}>
                          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                            <BarChart data={topItemsData} layout="vertical" barCategoryGap="30%" margin={isMobile ? { top: 5, right: 80, left: 0, bottom: 5 } : { top: 5, right: 90, left: 0, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.6} horizontal={false} />
                              <XAxis type="number" stroke="#9CA3AF" tickLine={false} axisLine={{ stroke: "#E5E7EB" }} style={{ fontSize: isMobile ? "0.65rem" : "0.75rem" }} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`} />
                              <YAxis dataKey="name" type="category" allowDuplicatedCategory={false} stroke="#9CA3AF" tickLine={false} axisLine={{ stroke: "#E5E7EB" }} width={isMobile ? 60 : 80} style={{ fontSize: isMobile ? "0.7rem" : "0.8rem" }} />
                              <Tooltip content={<BarTooltip />} />
                              <Bar key="bar-total" dataKey="total" fill="#D6B25E" radius={[0, 6, 6, 0]} maxBarSize={isMobile ? 22 : 28}>
                                <LabelList dataKey="total" position="right" content={({ x, y, width, height, value }: any) => { if (!value || value <= 0) return null; return (<text x={(x || 0) + (width || 0) + 8} y={(y || 0) + (height || 0) / 2} fill="#6B7280" fontSize={isMobile ? 10 : 12} textAnchor="start" dominantBaseline="middle">{`${Number(value).toLocaleString()} ခု`}</text>); }} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>

                  <FilterBar {...filterProps} />

                  {/* Daily Totals Table */}
                  <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-4 sm:p-6 overflow-hidden">
                    <h4 className="text-[#1F2937] mb-4">နေ့စဉ် ထုတ်လုပ်မှုစာရင်း</h4>
                    <div className="overflow-x-auto w-full">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[#E5E7EB]">
                            <th className="text-left py-3 px-4 text-[#6B7280]" style={{ fontSize: "0.85rem" }}>ရက်စွဲ</th>
                            <th className="text-center py-3 px-4 text-[#6B7280]" style={{ fontSize: "0.85rem" }}>ထုတ်လုပ်မှု</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDaily.map((d: any, idx: number) => (
                            <tr key={d.fullDate || idx} className="border-b border-[#E5E7EB]/60 hover:bg-[#FAF6EC] transition-colors">
                              <td className="py-3 px-4 text-[#1F2937]" style={{ fontSize: "0.85rem" }}>{d.date}</td>
                              <td className="py-3 px-4 text-center text-[#1F2937]" style={{ fontSize: "0.85rem" }}>
                                {selectedItem === ALL_ITEMS_LABEL
                                  ? (d.total as number)
                                  : ((d[selectedItem] as number) || 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════ REPORTS ═══════ */}
            {activeTab === "reports" && (
              <div className="space-y-4 sm:space-y-5 overflow-x-hidden">
                <div className="flex gap-1 bg-white rounded-[12px] border border-[#E5E7EB] p-1 w-full sm:w-fit overflow-hidden">
                  {[
                    { id: "overview", label: "အနှစ်ချုပ်" },
                    { id: "byItem", label: "ပစ္စည်းအလိုက်" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setReportTab(t.id)}
                      className={`flex-1 sm:flex-none px-3 sm:px-5 rounded-[10px] transition-all cursor-pointer truncate ${
                        reportTab === t.id
                          ? "bg-[#FAF6EC] text-[#B8943C] border border-[#D6B25E]/30"
                          : "text-[#6B7280] hover:text-[#1F2937] border border-transparent"
                      }`}
                      style={{ fontSize: "0.85rem", height: "40px" }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Overview Tab */}
                {reportTab === "overview" && (
                  <div className="space-y-4 sm:space-y-5 overflow-x-hidden">
                    {/* Summary cards — filtered by item selection in FilterBar */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { label: "စုစုပေါင်း ထုတ်လုပ်မှု", value: reportSummary.totalProduced.toLocaleString(), sub: selectedItem !== ALL_ITEMS_LABEL ? selectedItem : "ပစ္စည်းအားလုံး", icon: Package, color: "text-[#D6B25E]", bg: "bg-[#FAF6EC]" },
                        { label: "ပျမ်းမျှ / ရက်", value: reportSummary.avgPerDay.toLocaleString(), sub: `${reportSummary.totalDays} ရက်`, icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-50" },
                        { label: "အမြင့်ဆုံးရက်", value: reportSummary.highestDay.toLocaleString(), sub: "တစ်ရက်တာ အများဆုံး", icon: ArrowUpRight, color: "text-green-500", bg: "bg-green-50" },
                        { label: "အနိမ့်ဆုံးရက်", value: reportSummary.lowestDay.toLocaleString(), sub: "တစ်ရက်တာ အနည်းဆုံး", icon: ArrowDownRight, color: "text-orange-500", bg: "bg-orange-50" },
                      ].map((card) => (
                        <div key={card.label} className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3.5 sm:p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-8 h-8 rounded-[10px] ${card.bg} flex items-center justify-center shrink-0`}>
                              <card.icon className={`w-4 h-4 ${card.color}`} />
                            </div>
                          </div>
                          <p className="text-[#1F2937] mt-1" style={{ fontSize: isMobile ? "1.25rem" : "1.4rem" }}>{card.value}</p>
                          <p className="text-[#9CA3AF] mt-0.5 leading-tight" style={{ fontSize: "0.72rem" }}>{card.label}</p>
                          <p className="text-[#B8943C] mt-0.5" style={{ fontSize: "0.68rem" }}>{card.sub}</p>
                        </div>
                      ))}
                    </div>

                    <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3 sm:p-5 overflow-hidden">
                      <h4 className="text-[#1F2937] mb-2 sm:mb-3">{selectedItem !== ALL_ITEMS_LABEL ? `${selectedItem} — နေ့စဉ်စုစုပေါင်း` : "ပစ္စည်းအားလုံး နေ့စဉ်စုစုပေါင်း"}</h4>
                      {filteredDaily.length > 0 ? (
                        <div style={{ width: "100%", height: reportChartHeight }}>
                          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                            <LineChart data={filteredDaily} margin={isMobile ? { top: 20, right: 15, left: -10, bottom: 5 } : { top: 25, right: 30, left: 5, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.6} />
                              <XAxis dataKey="fullDate" stroke="#9CA3AF" tickLine={false} axisLine={{ stroke: "#E5E7EB" }} style={{ fontSize: isMobile ? "0.65rem" : "0.75rem" }} interval={isMobile ? "preserveStartEnd" : 0} tick={{ dy: 6 }} tickFormatter={(v: string) => { const d = new Date(v); return isNaN(d.getTime()) ? v : `${d.getMonth()+1}/${d.getDate()}`; }} />
                              <YAxis stroke="#9CA3AF" tickLine={false} axisLine={{ stroke: "#E5E7EB" }} width={isMobile ? 40 : 55} style={{ fontSize: isMobile ? "0.65rem" : "0.75rem" }} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`} />
                              <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 10 }} />
                              <Line key="overview-total" type="monotone" dataKey={selectedItem !== ALL_ITEMS_LABEL ? selectedItem : "total"} name={selectedItem !== ALL_ITEMS_LABEL ? selectedItem : "စုစုပေါင်း"} stroke="#D6B25E" strokeWidth={2} dot={{ fill: "#D6B25E", r: isMobile ? 2 : 3 }} activeDot={{ r: isMobile ? 5 : 7, stroke: "#D6B25E", strokeWidth: 2, fill: "#fff" }} label={isMobile ? undefined : { position: "top", fill: "#6B7280", fontSize: 11, offset: 10, formatter: (v: number) => v > 0 ? v.toLocaleString() : "" }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div style={{ height: reportChartHeight }} className="flex items-center justify-center text-[#9CA3AF]"><p style={{ fontSize: "0.85rem" }}>ဒေတာ မရှိပါ</p></div>
                      )}
                    </div>

                    <FilterBar {...filterProps} />

                    {/* Daily Summary Table */}
                    <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3 sm:p-7 overflow-hidden max-w-full">
                      <h4 className="text-[#1F2937] mb-3 sm:mb-5">Daily Summary</h4>
                      <div className="overflow-auto w-full" style={{ maxHeight: "480px", WebkitOverflowScrolling: "touch" as any }}>
                        <table className="w-full border-collapse" style={{ minWidth: "580px" }}>
                          <thead className="sticky top-0 z-[2]">
                            <tr className="bg-white">
                              <th className="text-left py-3 px-3 text-[#6B7280] sticky left-0 bg-white z-[3] border-b-2 border-[#E5E7EB]" style={{ fontSize: "0.8rem", minWidth: "70px" }}>Date</th>
                              {products.map((p) => {
                                const isHL = selectedItem !== ALL_ITEMS_LABEL && selectedItem === p.name;
                                const isFd = selectedItem !== ALL_ITEMS_LABEL && selectedItem !== p.name;
                                return (
                                  <th key={p.id} className={`text-center py-3 px-2.5 whitespace-nowrap border-b-2 bg-white transition-all duration-200 ${isHL ? "text-[#B8943C] font-bold border-[#D6B25E]" : isFd ? "text-[#D1D5DB] border-[#E5E7EB]" : "text-[#6B7280] border-[#E5E7EB]"}`} style={{ fontSize: "0.8rem" }}>{p.name}</th>
                                );
                              })}
                              <th className={`text-center py-3 px-3 whitespace-nowrap border-b-2 bg-white transition-all duration-200 ${selectedItem !== ALL_ITEMS_LABEL ? "text-[#D1D5DB] border-[#E5E7EB]" : "text-[#1F2937] border-[#E5E7EB]"}`} style={{ fontSize: "0.8rem" }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredDaily.map((d: any, idx: number) => (
                              <tr key={d.fullDate || idx} className="border-b border-[#E5E7EB]/60 hover:bg-[#FAF6EC] transition-colors">
                                <td className="py-3 px-3 text-[#1F2937] sticky left-0 bg-white z-[1]" style={{ fontSize: "0.8rem", minWidth: "70px" }}>{d.date}</td>
                                {products.map((p) => {
                                  const isHL = selectedItem !== ALL_ITEMS_LABEL && selectedItem === p.name;
                                  const isFd = selectedItem !== ALL_ITEMS_LABEL && selectedItem !== p.name;
                                  return (
                                    <td key={p.id} className={`py-3 px-2.5 text-center whitespace-nowrap transition-all duration-200 ${isHL ? "text-[#B8943C] font-semibold bg-[#FAF6EC]/50" : isFd ? "text-[#D1D5DB]" : "text-[#6B7280]"}`} style={{ fontSize: "0.8rem" }}>{(d[p.name] as number) || 0}</td>
                                  );
                                })}
                                <td className={`py-3 px-3 text-center whitespace-nowrap transition-all duration-200 ${selectedItem !== ALL_ITEMS_LABEL ? "text-[#D1D5DB]" : "text-[#1F2937]"}`} style={{ fontSize: "0.8rem" }}>{(d.total as number) || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="sticky bottom-0 z-[2]">
                            <tr className="bg-[#FAF6EC] border-t-2 border-[#D6B25E]/40">
                              <td className="py-3 px-3 text-[#1F2937] font-semibold sticky left-0 bg-[#FAF6EC] z-[3]" style={{ fontSize: "0.8rem", minWidth: "70px" }}>Total</td>
                              {products.map((p) => {
                                const colTotal = filteredDaily.reduce((sum: number, d: any) => sum + ((d[p.name] as number) || 0), 0);
                                const isHL = selectedItem !== ALL_ITEMS_LABEL && selectedItem === p.name;
                                const isFd = selectedItem !== ALL_ITEMS_LABEL && selectedItem !== p.name;
                                return (
                                  <td key={p.id} className={`py-3 px-2.5 text-center font-semibold whitespace-nowrap transition-all duration-200 ${isHL ? "text-[#B8943C] bg-[#F5EDD5]" : isFd ? "text-[#D1D5DB] bg-[#FAF6EC]" : "text-[#1F2937] bg-[#FAF6EC]"}`} style={{ fontSize: "0.8rem" }}>{colTotal}</td>
                                );
                              })}
                              <td className={`py-3 px-3 text-center font-bold whitespace-nowrap transition-all duration-200 ${selectedItem !== ALL_ITEMS_LABEL ? "text-[#D1D5DB] bg-[#FAF6EC]" : "text-[#D6B25E] bg-[#FAF6EC]"}`} style={{ fontSize: "0.85rem" }}>
                                {filteredDaily.reduce((sum: number, d: any) => sum + ((d.total as number) || 0), 0)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* By Item Tab */}
                {reportTab === "byItem" && (
                  <div className="space-y-4 sm:space-y-6 overflow-x-hidden">
                    <FilterBar {...filterProps} />

                    {selectedItem === ALL_ITEMS_LABEL ? (
                      <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 sm:p-10 text-center">
                        <Package className="w-12 h-12 mx-auto text-[#E8D5A0] mb-3" />
                        <p className="text-[#1F2937] mb-1">Select an item</p>
                        <p className="text-[#9CA3AF]" style={{ fontSize: "0.85rem" }}>Use the Item filter above to view detailed trends for a specific product.</p>
                      </div>
                    ) : (
                      <>
                        {byItemStats && (
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            {[
                              { label: "Total Produced", value: byItemStats.total },
                              { label: "Average per Day", value: byItemStats.avg },
                              { label: "Highest Day", value: byItemStats.highest },
                              { label: "Lowest Day", value: byItemStats.lowest },
                            ].map((s) => (
                              <div key={s.label} className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 sm:p-5">
                                <p className="text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>{s.label}</p>
                                <p className="text-[#1F2937] mt-1" style={{ fontSize: isMobile ? "1.25rem" : "1.5rem" }}>{s.value}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3 sm:p-7 overflow-hidden">
                          <h4 className="text-[#1F2937] mb-3 sm:mb-5">{selectedItem} — Daily Trend</h4>
                          {filteredDaily.length > 0 ? (
                            <div style={{ width: "100%", height: reportChartHeight }}>
                              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                                <LineChart data={filteredDaily} margin={isMobile ? { top: 5, right: 8, left: 0, bottom: 5 } : { top: 5, right: 20, left: 0, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.6} />
                                  <XAxis dataKey="fullDate" stroke="#9CA3AF" tickLine={false} axisLine={{ stroke: "#E5E7EB" }} style={{ fontSize: isMobile ? "0.65rem" : "0.75rem" }} interval={isMobile ? "preserveStartEnd" : 0} tick={{ dy: 6 }} tickFormatter={(v: string) => { const d = new Date(v); return isNaN(d.getTime()) ? v : `${d.getMonth()+1}/${d.getDate()}`; }} />
                                  <YAxis stroke="#9CA3AF" tickLine={false} axisLine={{ stroke: "#E5E7EB" }} width={isMobile ? 30 : 60} style={{ fontSize: isMobile ? "0.65rem" : "0.75rem" }} />
                                  <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 10 }} />
                                  <Line key={`byitem-${selectedItem}`} type="monotone" dataKey={selectedItem} name={selectedItem} stroke="#D6B25E" strokeWidth={2.5} dot={{ fill: "#D6B25E", r: isMobile ? 2 : 4 }} activeDot={{ r: isMobile ? 5 : 7, stroke: "#D6B25E", strokeWidth: 2, fill: "#fff" }} label={isMobile ? undefined : { position: "top", fill: "#6B7280", fontSize: 11, formatter: (v: number) => v > 0 ? v : "" }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div style={{ height: reportChartHeight }} className="flex items-center justify-center text-[#9CA3AF]"><p style={{ fontSize: "0.85rem" }}>ဒေတာ မရှိပါ</p></div>
                          )}
                        </div>

                        <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3 sm:p-7 overflow-hidden">
                          <h4 className="text-[#1F2937] mb-3 sm:mb-5">Day-by-Day Counts</h4>
                          <div className="overflow-x-auto w-full">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-[#E5E7EB]">
                                  <th className="text-left py-3 px-4 text-[#6B7280]">Date</th>
                                  <th className="text-center py-3 px-4 text-[#6B7280]">Quantity</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredDaily.map((d: any, idx: number) => (
                                  <tr key={d.fullDate || idx} className="border-b border-[#E5E7EB]/60 hover:bg-[#FAF6EC] transition-colors">
                                    <td className="py-3 px-4 text-[#1F2937]" style={{ fontSize: "0.85rem" }}>{d.date}</td>
                                    <td className="py-3 px-4 text-center text-[#1F2937]" style={{ fontSize: "0.85rem" }}>{d[selectedItem] as number}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ═══════ DATA ENTRY ═══════ */}
            {activeTab === "data_entry" && (
              <div className="space-y-6">
                <DataEntryContent
                  role={role}
                  onNavigate={(tab, subTab) => {
                    setActiveTab(tab);
                    if (subTab) setSettingsTab(subTab);
                  }}
                />
              </div>
            )}

            {/* ═══════ PRODUCTION LOG ═══════ */}
            {activeTab === "production_log" && <ProductionLogContent onNavigate={(tab, subTab) => {
              setActiveTab(tab);
              if (tab === "settings" && subTab) setSettingsTab(subTab);
              if (tab === "reports") setReportTab("overview");
            }} />}

            {/* ═══════ SALES ═══════ */}
            {activeTab === "sales" && <SalesContent />}

            {/* ═══════ INVENTORY ═══════ */}
            {activeTab === "inventory" && (
              <div className="space-y-6">
                <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-4">
                  <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                    <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>ရှာဖွေရန်</label>
                    <div className="relative" ref={invSearchRef}>
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                      <input
                        type="text"
                        placeholder="ကုန်ပစ္စည်းအမည် ရှာရန်..."
                        value={invSearch}
                        onChange={(e) => setInvSearch(e.target.value)}
                        onFocus={() => setInvSearchFocused(true)}
                        className="w-full pl-9 pr-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
                        style={{ fontSize: "0.85rem" }}
                      />
                      {invSearchFocused && invSearchSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full z-10 bg-white border border-[#E5E7EB] shadow-md rounded-b-[10px] max-h-40 overflow-y-auto">
                          {invSearchSuggestions.map((name) => (
                            <div
                              key={name}
                              className="px-3 py-2 cursor-pointer hover:bg-[#FAF6EC] transition-colors text-[#1F2937]"
                              style={{ fontSize: "0.85rem" }}
                              onClick={() => { setInvSearch(name); setInvSearchFocused(false); }}
                            >
                              {name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                    <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>အခြေအနေ</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {[
                        { key: "All", label: "အားလုံး" },
                        { key: "In Stock", label: "လက်ကျန်ရှိ" },
                        { key: "Low Stock", label: "လက်ကျန်နည်း" },
                        { key: "Critical", label: "လက်ကျန်မရှိ" },
                      ].map((s) => (
                        <button
                          key={s.key}
                          onClick={() => setInvStatus(s.key)}
                          className={`px-3.5 py-2 rounded-[10px] border transition-all cursor-pointer ${
                            invStatus === s.key
                              ? "bg-[#FAF6EC] text-[#B8943C] border-[#D6B25E]/40"
                              : "bg-white text-[#6B7280] border-[#E5E7EB] hover:bg-[#FAF6EC]"
                          }`}
                          style={{ fontSize: "0.8rem" }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 sm:p-7">
                  <h3 className="text-[#1F2937] mb-5">လက်ကျန်ပစ္စည်း အနှစ်ချုပ်</h3>

                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full" style={{ minWidth: "580px" }}>
                      <thead>
                        <tr className="border-b border-[#E5E7EB]">
                          <th className="text-left py-3 px-4 text-[#6B7280]">ကုန်ပစ္စည်း</th>
                          <th className="text-center py-3 px-4 text-[#6B7280]">ယနေ့ ထုတ်လုပ်မှု</th>
                          <th className="text-center py-3 px-4 text-[#6B7280]">လက်ရှိ လက်ကျန်</th>
                          <th className="text-left py-3 px-4 text-[#6B7280]">အခြေအနေ</th>
                          <th className="text-right py-3 px-4 text-[#6B7280]">လုပ်ဆောင်ချက်</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInventory.map((item) => {
                          const sc = statusConfig[item.status];
                          return (
                            <tr key={item.id} className="border-b border-[#E5E7EB]/60 hover:bg-[#FAF6EC] transition-colors">
                              <td className="py-3.5 px-4 text-[#1F2937]">{item.name}</td>
                              <td className="py-3.5 px-4 text-center text-[#1F2937]">{item.todayProduced}</td>
                              <td className={`py-3.5 px-4 text-center ${item.currentStock <= item.lowStockThreshold ? "text-[#DC2626]" : "text-[#1F2937]"}`}>{item.currentStock}</td>
                              <td className="py-3.5 px-4">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`} style={{ fontSize: "0.8rem" }}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                  {sc.label}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  onClick={() => goToItemTrend(item.name)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#B8943C] hover:border-[#D6B25E]/40 transition-all cursor-pointer"
                                  style={{ fontSize: "0.8rem" }}
                                >
                                  အသေးစိတ် ကြည့်ရန်
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredInventory.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-10 text-center text-[#9CA3AF]">စစ်ထုတ်မှုနှင့် ကိုက်ညီသော ပစ္စည်းမရှိပါ။</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile card list */}
                  <div className="md:hidden space-y-3">
                    {filteredInventory.map((item) => {
                      const sc = statusConfig[item.status];
                      return (
                        <div key={item.id} className="border border-[#E5E7EB] rounded-[12px] p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[#1F2937]" style={{ fontSize: "1rem" }}>{item.name}</span>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`} style={{ fontSize: "0.7rem" }}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                              {sc.label}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <p className="text-[#9CA3AF]" style={{ fontSize: "0.7rem" }}>ယနေ့ ထုတ်လုပ်မှု</p>
                              <p className="text-[#1F2937]" style={{ fontSize: "1.15rem" }}>{item.todayProduced}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[#9CA3AF]" style={{ fontSize: "0.7rem" }}>လက်ရှိ လက်ကျန်</p>
                              <p className={item.currentStock <= item.lowStockThreshold ? "text-[#DC2626]" : "text-[#1F2937]"} style={{ fontSize: "1.15rem" }}>{item.currentStock}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => goToItemTrend(item.name)}
                            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#B8943C] transition-all cursor-pointer"
                            style={{ fontSize: "0.8rem" }}
                          >
                            အသေးစိတ် ကြည့်ရန်
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    {filteredInventory.length === 0 && (
                      <div className="py-10 text-center text-[#9CA3AF]">စစ်ထုတ်မှုနှင့် ကိုက်ညီသော ပစ္စည်းမရှိပါ။</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═══════ SETTINGS ═══════ */}
            {activeTab === "settings" && (
              <div className="space-y-6">
                {/* Settings Sub-Tabs */}
                <div className="flex gap-1 bg-white rounded-[12px] border border-[#E5E7EB] p-1 w-full sm:w-fit overflow-hidden">
                  {[
                    { id: "items", label: "ကုန်ပစ္စည်းများ" },
                    { id: "customers", label: "ဝယ်သူများ" },
                    { id: "users", label: "အသုံးပြုသူများ" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSettingsTab(t.id)}
                      className={`flex-1 sm:flex-none px-3 sm:px-5 rounded-[10px] transition-all cursor-pointer whitespace-nowrap ${
                        settingsTab === t.id
                          ? "bg-[#FAF6EC] text-[#B8943C] border border-[#D6B25E]/30"
                          : "text-[#6B7280] hover:text-[#1F2937] border border-transparent"
                      }`}
                      style={{ fontSize: "0.85rem", height: "40px" }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* User Management Tab */}
                {settingsTab === "users" && <UserManagement />}

                {/* Customer Management Tab */}
                {settingsTab === "customers" && <CustomerManagement />}

                {/* Item Management Tab */}
                {settingsTab === "items" && (
                <>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-[#1F2937]">ကုန်ပစ္စည်း စီမံခန့်ခွဲမှု</h3>
                    <button
                      onClick={() => {
                        setEditingItem(null);
                        setModalForm({ name: "", threshold: 10 });
                        setShowItemModal(true);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[12px] bg-[#D6B25E] text-white hover:bg-[#C4A24D] transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                      style={{ fontSize: "0.85rem" }}
                    >
                      <Plus className="w-4 h-4" />
                      အသစ် ထည့်ရန်
                    </button>
                  </div>
                  <p className="text-[#9CA3AF]" style={{ fontSize: "0.85rem" }}>ကုန်ပစ္စည်းများကို ထည့်သွင်းခြင်း၊ ပြင်ဆင်ခြင်းနှင့် ဖျက်ခြင်း</p>
                </div>

                <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 sm:p-7">
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full" style={{ minWidth: "640px" }}>
                      <thead>
                        <tr className="border-b border-[#E5E7EB]">
                          <th className="text-left py-3 px-4 text-[#6B7280]" style={{ fontSize: "0.85rem" }}>ကုန်ပစ္စည်းအမည်</th>
                          <th className="text-center py-3 px-4 text-[#6B7280]" style={{ fontSize: "0.85rem" }}>လက်ရှိလက်ကျန်</th>
                          <th className="text-center py-3 px-4 text-[#6B7280]" style={{ fontSize: "0.85rem" }}>လက်ကျန်နည်း သတ်မှတ်ချက်</th>
                          <th className="text-left py-3 px-4 text-[#6B7280]" style={{ fontSize: "0.85rem" }}>အခြေအနေ</th>
                          <th className="text-right py-3 px-4 text-[#6B7280]" style={{ fontSize: "0.85rem" }}>လုပ်ဆောင်ချက်</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((item) => {
                          const sc = statusConfig[item.status];
                          return (
                            <tr key={item.id} className="border-b border-[#E5E7EB]/60 hover:bg-[#FAF6EC] transition-colors">
                              <td className="py-3.5 px-4 text-[#1F2937]">{item.name}</td>
                              <td className={`py-3.5 px-4 text-center ${item.currentStock <= item.lowStockThreshold ? "text-[#DC2626]" : "text-[#1F2937]"}`}>{item.currentStock}</td>
                              <td className="py-3.5 px-4 text-center text-[#6B7280]">{item.lowStockThreshold}</td>
                              <td className="py-3.5 px-4">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`} style={{ fontSize: "0.8rem" }}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                  {sc.label}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingItem(item);
                                      setModalForm({ name: item.name, threshold: item.lowStockThreshold });
                                      setShowItemModal(true);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#B8943C] hover:border-[#D6B25E]/40 transition-all cursor-pointer"
                                    style={{ fontSize: "0.8rem" }}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                    ပြင်ရန်
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClick(item)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-red-50 hover:text-[#DC2626] hover:border-red-200 transition-all cursor-pointer"
                                    style={{ fontSize: "0.8rem" }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    ဖျက်ရန်
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {products.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-10 text-center text-[#9CA3AF]">ကုန်ပစ္စည်း မရှိသေးပါ။ "အသစ် ထည့်ရန်" ကို နှိပ်ပါ။</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile card list */}
                  <div className="md:hidden space-y-3">
                    {products.map((item) => {
                      const sc = statusConfig[item.status];
                      return (
                        <div key={item.id} className="border border-[#E5E7EB] rounded-[12px] p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[#1F2937]" style={{ fontSize: "1rem" }}>{item.name}</span>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`} style={{ fontSize: "0.7rem" }}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                              {sc.label}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                              <p className="text-[#9CA3AF]" style={{ fontSize: "0.7rem" }}>လက်ရှိလက်ကျန်</p>
                              <p className={item.currentStock <= item.lowStockThreshold ? "text-[#DC2626]" : "text-[#1F2937]"} style={{ fontSize: "1.15rem" }}>{item.currentStock}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[#9CA3AF]" style={{ fontSize: "0.7rem" }}>လက်ကျန်နည်း သတ်မှတ်ချက်</p>
                              <p className="text-[#6B7280]" style={{ fontSize: "1.15rem" }}>{item.lowStockThreshold}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setModalForm({ name: item.name, threshold: item.lowStockThreshold });
                                setShowItemModal(true);
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#B8943C] transition-all cursor-pointer"
                              style={{ fontSize: "0.8rem" }}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              ပြင်ရန်
                            </button>
                            <button
                              onClick={() => handleDeleteClick(item)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-red-50 hover:text-[#DC2626] hover:border-red-200 transition-all cursor-pointer"
                              style={{ fontSize: "0.8rem" }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              ဖျက်ရန်
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {products.length === 0 && (
                      <div className="py-10 text-center text-[#9CA3AF]">ကုန်ပစ္စည်း မရှိသေးပါ။ "အသစ် ထည့်ရန်" ကို နှိပ်ပါ။</div>
                    )}
                  </div>
                </div>
                </>
                )}

              </div>
            )}

          </div>
        </main>
      </div>

      {/* ═══════ Add / Edit Item Modal ═══════ */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4" onClick={() => setShowItemModal(false)}>
          <div
            className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-lg w-full max-w-md p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[#1F2937] mb-1">{editingItem ? "ကုန်ပစ္စည်း ပြင်ဆင်ရန်" : "ကုန်ပစ္စည်းအသစ် ထည့်ရန်"}</h3>
            <p className="text-[#9CA3AF] mb-6" style={{ fontSize: "0.85rem" }}>
              {editingItem ? "ကုန်ပစ္စည်း အချက်အလက်များကို ပြင်ဆင်ပါ။" : "ကုန်ပစ္စည်းအသစ်၏ အချက်အလက်များကို ဖြည့်သွင်းပါ။"}
            </p>

            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>ကုန်ပစ္စည်းအမည်</label>
                <input
                  type="text"
                  value={modalForm.name}
                  onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                  placeholder="e.g. ကိတ်စို"
                  className="w-full px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
                  style={{ fontSize: "0.85rem" }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>လက်ကျန်နည်း သတ်မှတ်ချက်</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={modalForm.threshold}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      setModalForm({ ...modalForm, threshold: "" as any });
                    } else if (/^\d+$/.test(v)) {
                      setModalForm({ ...modalForm, threshold: parseInt(v) });
                    }
                  }}
                  className="w-full px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
                  style={{ fontSize: "0.85rem" }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-7">
              <button
                onClick={() => setShowItemModal(false)}
                className="px-5 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F7F6F3] transition-all cursor-pointer"
                style={{ fontSize: "0.85rem" }}
              >
                မလုပ်တော့ပါ
              </button>
              <button
                onClick={handleSaveItem}
                disabled={saving || !modalForm.name.trim()}
                className={`px-5 py-2.5 rounded-[10px] text-white transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.08)] flex items-center gap-2 ${
                  saving || !modalForm.name.trim()
                    ? "bg-[#D6B25E]/60 cursor-not-allowed"
                    : "bg-[#D6B25E] hover:bg-[#C4A24D]"
                }`}
                style={{ fontSize: "0.85rem" }}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingItem ? "သိမ်းဆည်းရန်" : "ထည့်သွင်းရန်"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Delete Confirmation ═══════ */}
      {deleteConfirm && (() => {
        const hasRecords = deleteUsage && (deleteUsage.productionCount > 0 || deleteUsage.salesCount > 0);
        return (
        <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div
            className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-lg w-full max-w-sm p-7 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {deleteChecking ? (
              <div className="flex items-center justify-center py-8 gap-2 text-[#9CA3AF]">
                <Loader2 className="w-5 h-5 animate-spin text-[#D6B25E]" />
                <span style={{ fontSize: "0.85rem" }}>စစ်ဆေးနေသည်...</span>
              </div>
            ) : hasRecords ? (
              <>
                <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="text-[#1F2937] mb-1">ဖျက်၍ မရနိုင်ပါ</h3>
                <p className="text-[#9CA3AF] mb-4" style={{ fontSize: "0.85rem" }}>
                  <strong className="text-[#1F2937]">{deleteConfirm.name}</strong> တွင် ဆက်စပ်မှတ်တမ်းများ ရှိနေသောကြောင့် ဖျက်၍ မရနိုင်ပါ။
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-3 mb-4 space-y-1">
                  {deleteUsage!.productionCount > 0 && (
                    <p className="text-amber-700" style={{ fontSize: "0.8rem" }}>
                      ကုန်ထုတ်လုပ်မှု မှတ်တမ်း — {deleteUsage!.productionCount} ခု
                    </p>
                  )}
                  {deleteUsage!.salesCount > 0 && (
                    <p className="text-amber-700" style={{ fontSize: "0.8rem" }}>
                      အရောင်း မှတ်တမ်း — {deleteUsage!.salesCount} ခု
                    </p>
                  )}
                </div>
                <p className="text-[#9CA3AF] mb-6" style={{ fontSize: "0.8rem" }}>
                  ဖျက်လိုပါက ဆက်စပ်မှတ်တမ်းများကို အရင်ဖျက်ပါ။
                </p>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-6 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F7F6F3] transition-all cursor-pointer"
                  style={{ fontSize: "0.85rem" }}
                >
                  နားလည်ပါပြီ
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-5 h-5 text-[#DC2626]" />
                </div>
                <h3 className="text-[#1F2937] mb-1">ကုန်ပစ္စည်း ဖျက်ရန်</h3>
                <p className="text-[#9CA3AF] mb-6" style={{ fontSize: "0.85rem" }}>
                  <strong className="text-[#1F2937]">{deleteConfirm.name}</strong> ကို ဖျက်မှာ သေချာပါသလား? ဤလုပ်ဆောင်ချက်ကို ပြန်ပြင်၍ မရပါ။
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="px-5 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F7F6F3] transition-all cursor-pointer"
                    style={{ fontSize: "0.85rem" }}
                  >
                    မလုပ်တော့ပါ
                  </button>
                  <button
                    onClick={handleDeleteItem}
                    disabled={saving}
                    className={`px-5 py-2.5 rounded-[10px] text-white transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.08)] flex items-center gap-2 ${
                      saving ? "bg-[#DC2626]/60 cursor-not-allowed" : "bg-[#DC2626] hover:bg-[#B91C1C]"
                    }`}
                    style={{ fontSize: "0.85rem" }}
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    ဖျက်မည်
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        );
      })()}
    </div>
  );
}
