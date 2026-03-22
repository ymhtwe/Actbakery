import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Loader2,
  Pencil,
  Trash2,
  X,
  Search,
  Calendar,
  RotateCcw,
  Cake,
  ChevronRight,
  CheckSquare,
  Square,
  MinusSquare,
  AlertTriangle,
} from "lucide-react";
import * as db from "./db";

interface ProdRow {
  id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  production_date: string;
  created_at: string;
}

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
      from.setDate(to.getDate() - 29);
  }
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(from), to: fmt(to) };
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

export function ProductionLogContent({ onNavigate }: { onNavigate?: (tab: string, subTab?: string) => void }) {
  const [logs, setLogs] = useState<ProdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Filter state
  const defaults = getDefaultDates("7 Days");
  const [selectedRange, setSelectedRange] = useState("7 Days");
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);

  // Items list for edit dropdown
  const [allItems, setAllItems] = useState<{ id: string; name: string }[]>([]);

  // Edit modal
  const [editingRow, setEditingRow] = useState<ProdRow | null>(null);
  const [editForm, setEditForm] = useState({ item_id: "", quantityStr: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete confirm
  const [deleteRow, setDeleteRow] = useState<ProdRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteStep, setBulkDeleteStep] = useState<0 | 1 | 2>(0); // 0=hidden, 1=first confirm, 2=second confirm
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Search suggestions
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Close search suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Unique item names for suggestions
  const itemNamesList = useMemo(() => {
    const names = new Set(logs.map((l) => l.item_name).filter(Boolean));
    return Array.from(names).sort();
  }, [logs]);

  // Filtered suggestions based on search term
  const searchSuggestions = useMemo(() => {
    if (!searchTerm) return itemNamesList;
    const q = searchTerm.toLowerCase();
    return itemNamesList.filter((name) => name.toLowerCase().includes(q));
  }, [itemNamesList, searchTerm]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [prodData, itemsData] = await Promise.all([
        db.getProductionLogs(),
        db.getItems(),
      ]);
      setLogs(prodData as ProdRow[]);
      setAllItems(itemsData.map((i) => ({ id: i.id, name: i.name })));
    } catch (e) {
      console.error("Failed to load production logs:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRangeChange = (r: string) => {
    setSelectedRange(r);
    const d = getDefaultDates(r);
    setDateFrom(d.from);
    setDateTo(d.to);
  };

  const handleReset = () => {
    setSearchTerm("");
    setSelectedRange("7 Days");
    const d = getDefaultDates("7 Days");
    setDateFrom(d.from);
    setDateTo(d.to);
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    const fromD = new Date(dateFrom + "T00:00:00");
    const toD = new Date(dateTo + "T23:59:59");

    return logs.filter((l) => {
      const logDate = l.production_date || l.created_at;
      if (logDate) {
        const ld = new Date(logDate);
        if (!isNaN(ld.getTime()) && (ld < fromD || ld > toD)) return false;
      }
      if (searchTerm) {
        return l.item_name.toLowerCase().includes(searchTerm.toLowerCase());
      }
      return true;
    });
  }, [logs, dateFrom, dateTo, searchTerm]);

  // Edit handlers
  const openEdit = (row: ProdRow) => {
    setEditingRow(row);
    setEditForm({ item_id: row.item_id, quantityStr: row.quantity.toString() });
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
      const db = await import("./db");

      // Stock validation: if reducing production qty, check that stock won't go negative
      const qtyDiff = editingRow.quantity - parsedQty; // positive means reducing production
      if (qtyDiff > 0) {
        // We're reducing production — check current stock can absorb it
        const currentStock = await db.getItemStock(editingRow.item_id);
        if (currentStock < qtyDiff) {
          setEditError(
            `ထုတ်လုပ်မှု အရေအတွက် လျှော့ချ၍မရပါ။ လက်ရှိလက်ကျန် ${currentStock} ခုသာ ရှိပြီး ${editingRow.quantity - currentStock} ခု အထိသာလျှော့ချနိုင်ပါသည်။ အရောင်းမှတ်တမ်းများကို အရင်ပြင်ဆင်ပါ။`
          );
          setEditSaving(false);
          return;
        }
      }

      // If item changed, also validate the old item won't go negative
      if (editForm.item_id !== editingRow.item_id) {
        const oldItemStock = await db.getItemStock(editingRow.item_id);
        if (oldItemStock < editingRow.quantity) {
          setEditError(
            `ပစ္စည်းအမျိုးအစား ပြောင်းလဲ၍မရပါ။ မူလပစ္စည်း၏ လက်ကျန် ${oldItemStock} ခုသာ ရှိပြီး ပြောင်းလဲရန် လက်ကျန် မလုံလောက်ပါ။ အရောင်းမှတ်တမ်းများကို အရင်ပြင်ဆင်ပါ။`
          );
          setEditSaving(false);
          return;
        }
      }

      await db.updateProductionLog(editingRow.id, editForm.item_id, parsedQty);
      setEditingRow(null);
      setEditError("");
      await loadData();
    } catch (e: any) {
      console.error("Failed to update production log:", e);
      setEditError(e?.message || "အမှားပြင်ဆင်ရန် မအောင်မြင်ပါ။");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      const db = await import("./db");

      // Stock validation: deleting production means removing produced qty
      // Check that current stock can absorb the full deletion
      const currentStock = await db.getItemStock(deleteRow.item_id);
      if (currentStock < deleteRow.quantity) {
        alert(
          `ဖျက်၍မရပါ။ ဤထုတ်လုပ်မှု (${deleteRow.quantity} ခု) ကို ဖျက်လျှင် လက်ကျန် အနုတ်ကိန်း ဖြစ်သွားပါမည်။\n\nလက်ရှိလက်ကျန်: ${currentStock} ခု\nဖျက်မည့် ထုတ်လုပ်မှု: ${deleteRow.quantity} ခု\n\nအရောင်းမှတ်တမ်းများကို အရင်ဖျက်ပါ သို့မဟုတ် ပြင်ဆင်ပါ။`
        );
        setDeleting(false);
        setDeleteRow(null);
        return;
      }

      await db.deleteProductionLog(deleteRow.id);
      setDeleteRow(null);
      await loadData();
    } catch (e: any) {
      console.error("Failed to delete production log:", e);
      alert(e?.message || "ဖျက်ရန် မအောင်မြင်ပါ။");
    } finally {
      setDeleting(false);
    }
  };

  // Multi-select handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLogs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLogs.map((l) => l.id)));
    }
  };

  const isAllSelected = filteredLogs.length > 0 && selectedIds.size === filteredLogs.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < filteredLogs.length;

  // Get selected rows details for the confirmation modal
  const selectedRows = useMemo(() => {
    return filteredLogs.filter((l) => selectedIds.has(l.id));
  }, [filteredLogs, selectedIds]);

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) return;
    setBulkDeleting(true);
    try {
      const dbModule = await import("./db");

      // Stock validation for each selected row
      for (const row of selectedRows) {
        const currentStock = await dbModule.getItemStock(row.item_id);
        // Sum total qty being deleted for same item
        const totalDeleteQty = selectedRows
          .filter((r) => r.item_id === row.item_id)
          .reduce((sum, r) => sum + r.quantity, 0);
        if (currentStock < totalDeleteQty) {
          alert(
            `ဖျက်၍မရပါ။ ${row.item_name} ၏ လက်ကျန် ${currentStock} ခုသာ ရှိပြီး ဖျက်မည့် စုစုပေါင်း ${totalDeleteQty} ခု ဖြစ်နေပါသည်။ အရောင်းမှတ်တမ်းများကို အရင်ဖျက်ပါ။`
          );
          setBulkDeleting(false);
          return;
        }
      }

      // Delete all selected rows
      let failCount = 0;
      for (const row of selectedRows) {
        try {
          await dbModule.deleteProductionLog(row.id);
        } catch {
          failCount++;
        }
      }
      if (failCount > 0) {
        alert(`${selectedRows.length - failCount} ခု ဖျက်ပြီး ${failCount} ခု မဖျက်နိုင်ခဲ့ပါ။`);
      }
      setSelectedIds(new Set());
      setBulkDeleteStep(0);
      await loadData();
    } catch (e: any) {
      console.error("Bulk delete failed:", e);
      alert(e?.message || "ဖျက်ရန် မအောင်မြင်ပါ။");
    } finally {
      setBulkDeleting(false);
    }
  };

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [dateFrom, dateTo, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-[#D6B25E]" />
        <span className="text-[#9CA3AF]" style={{ fontSize: "0.85rem" }}>
          ထုတ်လုပ်မှု ဒေတာ ခေါ်ယူနေသည်...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Summary ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <button
          onClick={() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4 sm:p-5 text-left hover:border-[#D6B25E]/50 hover:shadow-[0_2px_8px_rgba(214,178,94,0.12)] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#1F2937] mt-1" style={{ fontSize: isMobile ? "1.25rem" : "1.5rem" }}>{filteredLogs.length}</p>
              <p className="text-[#9CA3AF] mt-0.5 leading-tight" style={{ fontSize: "0.72rem" }}>ထုတ်လုပ်မှု မှတ်တမ်း</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#D1D5DB] group-hover:text-[#D6B25E] transition-colors" />
          </div>
        </button>
        <button
          onClick={() => onNavigate?.("reports")}
          className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4 sm:p-5 text-left hover:border-[#D6B25E]/50 hover:shadow-[0_2px_8px_rgba(214,178,94,0.12)] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#1F2937] mt-1" style={{ fontSize: isMobile ? "1.25rem" : "1.5rem" }}>
                {filteredLogs.reduce((sum, l) => sum + l.quantity, 0).toLocaleString()}
              </p>
              <p className="text-[#9CA3AF] mt-0.5 leading-tight" style={{ fontSize: "0.72rem" }}>စုစုပေါင်း ထုတ်လုပ်မှု</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#D1D5DB] group-hover:text-[#D6B25E] transition-colors" />
          </div>
        </button>
        <button
          onClick={() => onNavigate?.("settings", "items")}
          className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4 sm:p-5 text-left hover:border-[#D6B25E]/50 hover:shadow-[0_2px_8px_rgba(214,178,94,0.12)] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#1F2937] mt-1" style={{ fontSize: isMobile ? "1.25rem" : "1.5rem" }}>
                {new Set(filteredLogs.map((l) => l.item_name)).size}
              </p>
              <p className="text-[#9CA3AF] mt-0.5 leading-tight" style={{ fontSize: "0.72rem" }}>ပစ္စည်း အမျိုးအစား</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#D1D5DB] group-hover:text-[#D6B25E] transition-colors" />
          </div>
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3 sm:p-4">
        <div className={`flex ${isMobile ? "flex-col" : "flex-row flex-wrap items-end"} gap-3`}>
          <div className="flex flex-col gap-1.5">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>ရက်အပိုင်းအခြား</label>
            <div className={`flex items-center gap-2 ${isMobile ? "flex-col" : ""}`}>
              <div className="relative w-full sm:w-auto">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setSelectedRange(""); }} className="w-full pl-9 pr-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all" style={{ fontSize: "0.85rem" }} />
              </div>
              {!isMobile && <span className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>မှ</span>}
              <div className="relative w-full sm:w-auto">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setSelectedRange(""); }} className="w-full pl-9 pr-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all" style={{ fontSize: "0.85rem" }} />
              </div>
            </div>
          </div>

          <div className={`flex flex-col gap-1.5 ${isMobile ? "" : "flex-1 min-w-[180px]"}`}>
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>ရှာဖွေရန်</label>
            <div className="relative" ref={searchRef}>
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input type="text" placeholder="ပစ္စည်း ရှာရန်..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onFocus={() => setSearchFocused(true)} className="w-full pl-9 pr-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all" style={{ fontSize: "0.85rem" }} />
              {searchFocused && searchSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 bg-white border border-[#E5E7EB] shadow-md rounded-b-[10px] max-h-40 overflow-y-auto">
                  {searchSuggestions.map((name) => (
                    <div key={name} className="px-3 py-2 cursor-pointer hover:bg-[#FAF6EC] transition-colors" style={{ fontSize: "0.85rem" }} onClick={() => { setSearchTerm(name); setSearchFocused(false); }}>
                      {name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={`flex ${isMobile ? "" : "items-end"}`}>
            <button onClick={handleReset} className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#1F2937] transition-all cursor-pointer ${isMobile ? "w-full" : ""}`} style={{ fontSize: "0.85rem", height: isMobile ? "44px" : undefined }}>
              <RotateCcw className="w-3.5 h-3.5" />
              ပြန်လည်သတ်မှတ်ရန်
            </button>
          </div>
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

      {/* ── Production Log Table ── */}
      <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 sm:p-7">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <h3 className="text-[#1F2937]">ကုန်ထုတ်လုပ်မှု မှတ်တမ်းစာရင်း</h3>
          <span className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>
            {filteredLogs.length} မှတ်တမ်း
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#9CA3AF]">
            <Cake className="w-12 h-12 text-[#E8D5A0]" />
            <p>ထုတ်လုပ်မှု မှတ်တမ်း မရှိသေးပါ</p>
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
            <div className="hidden md:block overflow-x-auto" ref={tableRef}>
              <table className="w-full" style={{ minWidth: "720px" }}>
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
                    <th className="text-center py-3 px-4 text-[#6B7280]" style={{ fontSize: "0.8rem" }}>ထုတ်လုပ်ခဲ့သော အရေအတွက်</th>
                    <th className="text-center py-3 px-2 text-[#6B7280]" style={{ fontSize: "0.8rem" }}>ပြင်ရန်</th>
                    <th className="text-center py-3 px-2 text-[#6B7280]" style={{ fontSize: "0.8rem" }}>ဖျက်ရန်</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((l) => (
                    <tr key={l.id} className={`border-b border-[#E5E7EB]/60 hover:bg-[#FAF6EC] transition-colors ${selectedIds.has(l.id) ? "bg-[#FAF6EC]" : ""}`}>
                      <td className="py-3.5 px-3 text-center" style={{ width: "44px" }}>
                        <button onClick={() => toggleSelect(l.id)} className="p-0.5 rounded cursor-pointer hover:bg-[#FAF6EC] transition-colors">
                          {selectedIds.has(l.id) ? (
                            <CheckSquare className="w-[18px] h-[18px] text-[#D6B25E]" />
                          ) : (
                            <Square className="w-[18px] h-[18px] text-[#9CA3AF]" />
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-[#1F2937]" style={{ fontSize: "0.85rem" }}>
                        {formatDate(l.production_date || l.created_at)}
                      </td>
                      <td className="py-3.5 px-4 text-[#1F2937]" style={{ fontSize: "0.85rem" }}>{l.item_name}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[40px] px-2.5 py-0.5 rounded-full bg-[#FAF6EC] text-[#B8943C] border border-[#D6B25E]/20" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                          {l.quantity}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-center">
                        <button onClick={() => openEdit(l)} className="p-1.5 rounded-[8px] text-[#6B7280] hover:text-[#D6B25E] hover:bg-[#FAF6EC] transition-all cursor-pointer" title="ပြင်ရန်">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="py-3.5 px-2 text-center">
                        <button onClick={() => setDeleteRow(l)} className="p-1.5 rounded-[8px] text-[#6B7280] hover:text-[#DC2626] hover:bg-red-50 transition-all cursor-pointer" title="ဖျက်ရန်">
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
              {filteredLogs.map((l) => (
                <div key={l.id} className={`border rounded-[12px] p-4 ${selectedIds.has(l.id) ? "border-[#D6B25E] bg-[#FAF6EC]/50" : "border-[#E5E7EB]"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <button onClick={() => toggleSelect(l.id)} className="p-0.5 rounded cursor-pointer mt-0.5 shrink-0">
                        {selectedIds.has(l.id) ? (
                          <CheckSquare className="w-[18px] h-[18px] text-[#D6B25E]" />
                        ) : (
                          <Square className="w-[18px] h-[18px] text-[#9CA3AF]" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className="text-[#1F2937]" style={{ fontSize: "1rem" }}>{l.item_name}</p>
                        <p className="text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>
                          {formatDate(l.production_date || l.created_at)}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center justify-center min-w-[40px] px-2.5 py-1 rounded-full bg-[#FAF6EC] text-[#B8943C] border border-[#D6B25E]/20 shrink-0 ml-2" style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                      {l.quantity}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 border-t border-[#E5E7EB]/60 pt-2">
                    <button onClick={() => openEdit(l)} className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] text-[#6B7280] hover:text-[#D6B25E] hover:bg-[#FAF6EC] transition-all cursor-pointer border border-[#E5E7EB]" style={{ fontSize: "0.75rem" }}>
                      <Pencil className="w-3.5 h-3.5" /> ပြင်ရန်
                    </button>
                    <button onClick={() => setDeleteRow(l)} className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] text-[#6B7280] hover:text-[#DC2626] hover:bg-red-50 transition-all cursor-pointer border border-[#E5E7EB]" style={{ fontSize: "0.75rem" }}>
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
              <h3 className="text-[#1F2937]">ထုတ်လုပ်မှု မှတ်တမ်း ပြင်ဆင်ရန်</h3>
              <button onClick={() => setEditingRow(null)} className="p-1 rounded-full hover:bg-[#F3F4F6] cursor-pointer"><X className="w-5 h-5 text-[#6B7280]" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[#6B7280] block mb-1" style={{ fontSize: "0.75rem" }}>ပစ္စည်း</label>
                <select value={editForm.item_id} onChange={(e) => setEditForm({ ...editForm, item_id: e.target.value })} className="w-full px-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E]" style={{ fontSize: "0.85rem" }}>
                  {allItems.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[#6B7280] block mb-1" style={{ fontSize: "0.75rem" }}>ထုတ်လုပ်ခဲ့သော အရေအတွက်</label>
                <input type="text" inputMode="numeric" value={editForm.quantityStr} onChange={(e) => { const v = e.target.value; if (v === "" || /^\d+$/.test(v)) setEditForm({ ...editForm, quantityStr: v }); }} className="w-full px-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E]" style={{ fontSize: "0.85rem" }} />
              </div>
              {editError && <p className="text-red-500 text-sm">{editError}</p>}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button onClick={() => setEditingRow(null)} className="flex-1 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-all cursor-pointer" style={{ fontSize: "0.85rem" }}>
                မလုပ်တော့ပါ
              </button>
              <button onClick={handleEditSave} disabled={editSaving || !editForm.item_id || parseInt(editForm.quantityStr) < 1} className="flex-1 py-2.5 rounded-[10px] bg-[#D6B25E] text-white hover:bg-[#C4A24D] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" style={{ fontSize: "0.85rem" }}>
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

      {/* ── Bulk Delete Confirm Modal ── */}
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
                      {selectedRows.length} ခု ထုတ်လုပ်မှု မှတ်တမ်း ဖျက်မည်လား?
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={() => setBulkDeleteStep(0)} className="flex-1 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-all cursor-pointer" style={{ fontSize: "0.85rem" }}>
                    မလုပ်တော့ပါ
                  </button>
                  <button onClick={() => setBulkDeleteStep(2)} className="flex-1 py-2.5 rounded-[10px] bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2" style={{ fontSize: "0.85rem" }}>
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
                    <h3 className="text-[#1F2937]">ဖျက်ရန် အတည်ပြုပါ</h3>
                    <p className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>
                      သင်သတ်မှတ်ပါ။ အချက်အလက်များ ဖျက်မည်။ သင်သတ်မှတ်ပါ။
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={() => setBulkDeleteStep(0)} className="flex-1 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-all cursor-pointer" style={{ fontSize: "0.85rem" }}>
                    မလုပ်တော့ပါ
                  </button>
                  <button onClick={handleBulkDelete} disabled={bulkDeleting} className="flex-1 py-2.5 rounded-[10px] bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2" style={{ fontSize: "0.85rem" }}>
                    {bulkDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                    ဖျက်မည်
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