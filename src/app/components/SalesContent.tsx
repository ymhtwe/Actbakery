import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Search,
  Loader2,
  ShoppingBag,
  Calendar,
  ChevronDown,
  RotateCcw,
  Trash2,
  X,
  CheckSquare,
  Square,
  MinusSquare,
  AlertTriangle,
  Eye,
  Printer,
} from "lucide-react";

import * as db from "./db";
import type { SalesReceiptWithCustomer, SalesReceiptLine } from "./db";
import { ReceiptPrint } from "./ReceiptPrint";
import type { ReceiptLineItem } from "./ReceiptPrint";

const ALL_CUSTOMERS_LABEL = "\u101d\u101a\u103a\u101a\u1030\u101e\u1030\u1021\u102c\u1038\u101c\u102f\u1036\u1038";
const ALL_CUSTOMERS_DROPDOWN_LABEL = "\u101d\u101a\u103a\u101a\u1030\u101e\u1030 \u1021\u102c\u1038\u101c\u102f\u1036\u1038";

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
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

function formatTime(iso: string) {
  if (!iso || !iso.includes("T")) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNumber(n: number) {
  return n.toLocaleString("en-US");
}

export function SalesContent({ initialSearchTerm }: { initialSearchTerm?: string } = {}) {
  const [receipts, setReceipts] = useState<SalesReceiptWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || "");

  // Filter state
  const defaults = getDefaultDates("All");
  const [selectedRange, setSelectedRange] = useState("All");
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [selectedCustomer, setSelectedCustomer] = useState(ALL_CUSTOMERS_LABEL);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);

  // Detail modal state
  const [detailReceipt, setDetailReceipt] = useState<SalesReceiptWithCustomer | null>(null);
  const [detailLines, setDetailLines] = useState<SalesReceiptLine[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Print state
  const [printReceipt, setPrintReceipt] = useState<SalesReceiptWithCustomer | null>(null);
  const [printLines, setPrintLines] = useState<ReceiptLineItem[]>([]);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Delete confirm state
  const [deleteRow, setDeleteRow] = useState<SalesReceiptWithCustomer | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteStep, setBulkDeleteStep] = useState<0 | 1 | 2>(0);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Customers for filter dropdown
  const [allCustomers, setAllCustomers] = useState<{ id: string; name: string }[]>([]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const loadReceipts = useCallback(async () => {
    try {
      setLoading(true);
      const [data, customers] = await Promise.all([
        db.getSalesReceipts(),
        db.getCustomers(),
      ]);
      setReceipts(data);
      setAllCustomers(customers.map((c) => ({ id: c.id, name: c.name })));
    } catch (e) {
      console.error("Failed to load receipts:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  const handleRangeChange = (r: string) => {
    setSelectedRange(r);
    const d = getDefaultDates(r);
    setDateFrom(d.from);
    setDateTo(d.to);
  };

  const handleReset = () => {
    setSelectedRange("All");
    setSelectedCustomer(ALL_CUSTOMERS_LABEL);
    setSearchTerm("");
    const d = getDefaultDates("All");
    setDateFrom(d.from);
    setDateTo(d.to);
  };

  // Filtered receipts
  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      const dateStr = r.receipt_date || r.created_at;
      if (dateStr) {
        // Normalise to YYYY-MM-DD (local day) for timezone-safe comparison
        let day: string;
        if (dateStr.length <= 10) {
          day = dateStr;                              // already "YYYY-MM-DD"
        } else {
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) { return true; }    // unparseable → keep
          day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        }
        if (day < dateFrom || day > dateTo) return false;
      }
      if (selectedCustomer !== ALL_CUSTOMERS_LABEL && r.customer_name !== selectedCustomer) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          r.receipt_no.toLowerCase().includes(q) ||
          r.customer_name.toLowerCase().includes(q) ||
          (r.note && r.note.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [receipts, dateFrom, dateTo, selectedCustomer, searchTerm]);

  // ── Detail handlers ──
  const openDetail = async (r: SalesReceiptWithCustomer) => {
    setDetailReceipt(r);
    setDetailLoading(true);
    try {
      const lines = await db.getSalesReceiptLines(r.id);
      setDetailLines(lines);
    } catch (e) {
      console.error("Failed to load receipt lines:", e);
      setDetailLines([]);
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Print handler ──
  const handlePrint = async (r: SalesReceiptWithCustomer) => {
    try {
      const lines = await db.getSalesReceiptLines(r.id);
      const printItems: ReceiptLineItem[] = lines.map((l) => ({
        id: l.id,
        name: l.item_name_snapshot,
        quantity: l.qty,
        price: l.unit_price,
        total: l.line_total,
      }));
      setPrintReceipt(r);
      setPrintLines(printItems);
      // Small delay to let state render, then print
      setTimeout(() => {
        window.print();
      }, 300);
    } catch (e) {
      console.error("Failed to load receipt for print:", e);
    }
  };

  // ── Delete handlers ──
  const handleDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      await db.deleteSalesReceipt(deleteRow.id);
      setDeleteRow(null);
      await loadReceipts();
    } catch (e: any) {
      console.error("Failed to delete receipt:", e);
      alert(e?.message || "\u1016\u103b\u1000\u103a\u101b\u1014\u103a \u1019\u1021\u1031\u102c\u1004\u103a\u1019\u103c\u1004\u103a\u1015\u102b\u104b");
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    const selectedRows = filteredReceipts.filter((r) => selectedIds.has(r.id));
    if (selectedRows.length === 0) return;
    setBulkDeleting(true);
    try {
      let failCount = 0;
      for (const row of selectedRows) {
        try {
          await db.deleteSalesReceipt(row.id);
        } catch {
          failCount++;
        }
      }
      if (failCount > 0) {
        alert(`${selectedRows.length - failCount} \u1001\u102f \u1016\u103b\u1000\u103a\u1015\u103c\u102e\u1038 ${failCount} \u1001\u102f \u1019\u1016\u103b\u1000\u103a\u1014\u102d\u102f\u1004\u103a\u1001\u1032\u1037\u1015\u102b\u104b`);
      }
      setSelectedIds(new Set());
      setBulkDeleteStep(0);
      await loadReceipts();
    } catch (e: any) {
      console.error("Bulk delete failed:", e);
      alert(e?.message || "\u1016\u103b\u1000\u103a\u101b\u1014\u103a \u1019\u1021\u1031\u102c\u1004\u103a\u1019\u103c\u1004\u103a\u1015\u102b\u104b");
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
    if (selectedIds.size === filteredReceipts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredReceipts.map((r) => r.id)));
    }
  };
  const isAllSelected = filteredReceipts.length > 0 && selectedIds.size === filteredReceipts.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < filteredReceipts.length;

  // Clear selection when filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setSelectedIds(new Set()); }, [dateFrom, dateTo, selectedCustomer, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-[#D6B25E]" />
        <span className="text-[#9CA3AF]" style={{ fontSize: "0.85rem" }}>
          ဘောင်ချာဒေတာ ခေါ်ယူနေသည်...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Hidden print area ── */}
      {printReceipt && (
        <ReceiptPrint
          ref={receiptRef}
          customerName={printReceipt.customer_name}
          date={printReceipt.receipt_date}
          receiptNo={printReceipt.receipt_no}
          items={printLines}
          grandTotal={printReceipt.grand_total}
        />
      )}

      {/* ── Filters ── */}
      <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3 sm:p-4 space-y-3">
        {/* Desktop */}
        <div className="hidden sm:flex sm:flex-row sm:flex-wrap sm:items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>{"\u101b\u1000\u103a\u1021\u1015\u102d\u102f\u1004\u103a\u1038\u1021\u1001\u103c\u102c\u1038"}</label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setSelectedRange(""); }} className="pl-9 pr-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all" style={{ fontSize: "0.85rem" }} />
              </div>
              <span className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>{"\u1019\u103e"}</span>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setSelectedRange(""); }} className="pl-9 pr-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all" style={{ fontSize: "0.85rem" }} />
              </div>
            </div>
          </div>

          {/* Customer dropdown */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>{"\u101d\u101a\u103a\u101a\u1030\u101e\u1030"}</label>
            <button onClick={() => setCustomerDropdownOpen(!customerDropdownOpen)} className="flex items-center justify-between gap-8 px-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] hover:border-[#D6B25E]/50 transition-all cursor-pointer min-w-[160px]" style={{ fontSize: "0.85rem" }}>
              <span>{selectedCustomer}</span>
              <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
            </button>
            {customerDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-lg z-20 py-1 max-h-64 overflow-auto">
                {[ALL_CUSTOMERS_LABEL, ...allCustomers.map((c) => c.name)].map((customer) => (
                  <button key={`cust-${customer}`} onClick={() => { setSelectedCustomer(customer); setCustomerDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-[#FAF6EC] transition-colors cursor-pointer ${selectedCustomer === customer ? "text-[#B8943C] bg-[#FAF6EC]" : "text-[#1F2937]"}`} style={{ fontSize: "0.85rem" }}>
                    {customer === ALL_CUSTOMERS_LABEL ? ALL_CUSTOMERS_DROPDOWN_LABEL : customer}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>{"\u101b\u103e\u102c\u1016\u103d\u1031\u101b\u1014\u103a"}</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input type="text" placeholder={"\u1018\u1031\u102c\u1004\u103a\u1001\u103b\u102c\u1021\u1019\u103e\u1010\u103a / \u101d\u101a\u103a\u101a\u1030\u101e\u1030 \u101b\u103e\u102c\u101b\u1014\u103a..."} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all" style={{ fontSize: "0.85rem" }} />
            </div>
          </div>

          <div className="flex items-end gap-2 ml-auto">
            <button onClick={handleReset} className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#1F2937] transition-all cursor-pointer" style={{ fontSize: "0.85rem" }}>
              <RotateCcw className="w-3.5 h-3.5" />
              {"\u1015\u103c\u1014\u103a\u101c\u100a\u103a\u101e\u1010\u103a\u1019\u103e\u1010\u103a\u101b\u1014\u103a"}
            </button>
          </div>
        </div>

        {/* Mobile */}
        <div className="flex flex-col sm:hidden gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>{"\u1005\u1010\u1004\u103a\u101b\u1000\u103a"}</label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setSelectedRange(""); }} className="w-full pl-9 pr-3 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all" style={{ fontSize: "0.85rem" }} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>{"\u1000\u102f\u1014\u103a\u1006\u102f\u1036\u1038\u101b\u1000\u103a"}</label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setSelectedRange(""); }} className="w-full pl-9 pr-3 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all" style={{ fontSize: "0.85rem" }} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 relative">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>{"\u101d\u101a\u103a\u101a\u1030\u101e\u1030"}</label>
            <button onClick={() => setCustomerDropdownOpen(!customerDropdownOpen)} className="flex items-center justify-between px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] w-full cursor-pointer" style={{ fontSize: "0.85rem" }}>
              <span>{selectedCustomer}</span>
              <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
            </button>
            {customerDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-lg z-20 py-1 max-h-64 overflow-auto">
                {[ALL_CUSTOMERS_LABEL, ...allCustomers.map((c) => c.name)].map((customer) => (
                  <button key={`mob-cust-${customer}`} onClick={() => { setSelectedCustomer(customer); setCustomerDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-[#FAF6EC] transition-colors cursor-pointer ${selectedCustomer === customer ? "text-[#B8943C] bg-[#FAF6EC]" : "text-[#1F2937]"}`} style={{ fontSize: "0.85rem" }}>
                    {customer === ALL_CUSTOMERS_LABEL ? ALL_CUSTOMERS_DROPDOWN_LABEL : customer}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={handleReset} className="w-full flex items-center justify-center gap-1.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] transition-all cursor-pointer" style={{ fontSize: "0.85rem", height: "44px" }}>
            <RotateCcw className="w-3.5 h-3.5" />
            {"\u1015\u103c\u1014\u103a\u101c\u100a\u103a\u101e\u1010\u103a\u1019\u103e\u1010\u103a\u101b\u1014\u103a"}
          </button>
        </div>

        {/* Quick range chips */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="text-[#9CA3AF] mr-1" style={{ fontSize: "0.75rem" }}>{"\u1021\u1019\u103c\u1014\u103a\u101b\u103d\u1031\u1038\u101b\u1014\u103a:"}</span>
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

      {/* ── Receipts Table ── */}
      <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 sm:p-7">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <h3 className="text-[#1F2937]">{"\u1018\u1031\u102c\u1004\u103a\u1001\u103b\u102c\u1019\u103e\u1010\u103a\u1010\u1019\u103a\u1038\u1005\u102c\u101b\u1004\u103a\u1038"}</h3>
          <span className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>
            {filteredReceipts.length} {"\u1019\u103e\u1010\u103a\u1010\u1019\u103a\u1038"}
          </span>
        </div>

        {filteredReceipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#9CA3AF]">
            <ShoppingBag className="w-12 h-12 text-[#E8D5A0]" />
            <p>{"\u1018\u1031\u102c\u1004\u103a\u1001\u103b\u102c \u1019\u101b\u103e\u102d\u101e\u1031\u1038\u1015\u102b"}</p>
            <p style={{ fontSize: "0.8rem" }}>{"\u101b\u103d\u1031\u1038\u1001\u103b\u101a\u103a\u1011\u102c\u1038\u101e\u1031\u102c \u1005\u1005\u103a\u1011\u102f\u1010\u103a\u1019\u103e\u102f\u1021\u1010\u103d\u1000\u103a \u1019\u103e\u1010\u103a\u1010\u1019\u103a\u1038\u1019\u1010\u103d\u1031\u1037\u1015\u102b\u104b"}</p>
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
                    {selectedIds.size} {"\u1001\u102f \u101b\u103d\u1031\u1038\u1001\u103b\u101a\u103a\u1011\u102c\u1038\u101e\u100a\u103a"}
                  </span>
                </div>
                <button
                  onClick={() => setBulkDeleteStep(1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-all cursor-pointer"
                  style={{ fontSize: "0.85rem" }}
                >
                  <Trash2 className="w-4 h-4" />
                  {"\u101b\u103d\u1031\u1038\u1011\u102c\u1038\u101e\u100a\u103a\u1019\u103b\u102c\u1038 \u1016\u103b\u1000\u103a\u101b\u1014\u103a"}
                </button>
              </div>
            )}

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full" style={{ minWidth: "760px" }}>
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
                    <th className="text-left py-3 px-4 text-[#6B7280]" style={{ fontSize: "0.8rem" }}>{"\u1018\u1031\u102c\u1004\u103a\u1001\u103b\u102c\u1021\u1019\u103e\u1010\u103a"}</th>
                    <th className="text-left py-3 px-4 text-[#6B7280]" style={{ fontSize: "0.8rem" }}>{"\u101b\u1000\u103a\u1005\u103d\u1032"}</th>
                    <th className="text-left py-3 px-4 text-[#6B7280]" style={{ fontSize: "0.8rem" }}>{"\u101d\u101a\u103a\u101a\u1030\u101e\u1030"}</th>
                    <th className="text-right py-3 px-4 text-[#6B7280]" style={{ fontSize: "0.8rem" }}>{"\u1005\u102f\u1005\u102f\u1015\u1031\u102b\u1004\u103a\u1038"}</th>
                    <th className="text-left py-3 px-4 text-[#6B7280]" style={{ fontSize: "0.8rem" }}>{"\u1019\u103e\u1010\u103a\u1001\u103b\u1000\u103a"}</th>
                    <th className="text-center py-3 px-2 text-[#6B7280]" style={{ fontSize: "0.8rem" }}>{"\u1000\u103c\u100a\u103a\u1037\u1019\u100a\u103a"}</th>
                    <th className="text-center py-3 px-2 text-[#6B7280]" style={{ fontSize: "0.8rem" }}>{"\u1015\u101b\u1004\u103a\u1037"}</th>
                    <th className="text-center py-3 px-2 text-[#6B7280]" style={{ fontSize: "0.8rem" }}>{"\u1016\u103b\u1000\u103a\u101b\u1014\u103a"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceipts.map((r) => (
                    <tr key={r.id} className={`border-b border-[#E5E7EB]/60 hover:bg-[#FAF6EC] transition-colors ${selectedIds.has(r.id) ? "bg-[#FAF6EC]" : ""}`}>
                      <td className="py-3.5 px-3 text-center" style={{ width: "44px" }}>
                        <button onClick={() => toggleSelect(r.id)} className="p-0.5 rounded cursor-pointer hover:bg-[#FAF6EC] transition-colors">
                          {selectedIds.has(r.id) ? (
                            <CheckSquare className="w-[18px] h-[18px] text-[#D6B25E]" />
                          ) : (
                            <Square className="w-[18px] h-[18px] text-[#9CA3AF]" />
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[#B8943C] font-medium" style={{ fontSize: "0.85rem" }}>{r.receipt_no || "\u2014"}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="text-[#1F2937]" style={{ fontSize: "0.85rem" }}>{formatDate(r.receipt_date || r.created_at)}</span>
                          {formatTime(r.created_at) && (
                            <span className="text-[#9CA3AF] ml-2" style={{ fontSize: "0.75rem" }}>{formatTime(r.created_at)}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#6B7280]" style={{ fontSize: "0.85rem" }}>{r.customer_name}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center justify-center min-w-[60px] px-2.5 py-0.5 rounded-full bg-[#FAF6EC] text-[#B8943C] border border-[#D6B25E]/20" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                          {formatNumber(r.grand_total)} Ks
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>{r.note || "\u2014"}</td>
                      <td className="py-3.5 px-2 text-center">
                        <button onClick={() => openDetail(r)} className="p-1.5 rounded-[8px] text-[#6B7280] hover:text-[#D6B25E] hover:bg-[#FAF6EC] transition-all cursor-pointer" title={"\u1021\u101e\u1031\u1038\u1005\u102d\u1010\u103a \u1000\u103c\u100a\u103a\u1037\u1019\u100a\u103a"}>
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="py-3.5 px-2 text-center">
                        <button onClick={() => handlePrint(r)} className="p-1.5 rounded-[8px] text-[#6B7280] hover:text-[#D6B25E] hover:bg-[#FAF6EC] transition-all cursor-pointer" title={"\u1015\u101b\u1004\u103a\u1037\u1011\u102f\u1010\u103a\u1019\u100a\u103a"}>
                          <Printer className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="py-3.5 px-2 text-center">
                        <button onClick={() => setDeleteRow(r)} className="p-1.5 rounded-[8px] text-[#6B7280] hover:text-[#DC2626] hover:bg-red-50 transition-all cursor-pointer" title={"\u1016\u103b\u1000\u103a\u101b\u1014\u103a"}>
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
              {filteredReceipts.map((r) => (
                <div key={r.id} className={`border rounded-[12px] p-4 ${selectedIds.has(r.id) ? "border-[#D6B25E] bg-[#FAF6EC]/50" : "border-[#E5E7EB]"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <button onClick={() => toggleSelect(r.id)} className="p-0.5 rounded cursor-pointer mt-0.5 shrink-0">
                        {selectedIds.has(r.id) ? (
                          <CheckSquare className="w-[18px] h-[18px] text-[#D6B25E]" />
                        ) : (
                          <Square className="w-[18px] h-[18px] text-[#9CA3AF]" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className="text-[#B8943C] font-medium" style={{ fontSize: "1rem" }}>{r.receipt_no || "\u2014"}</p>
                        <p className="text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>
                          {formatDate(r.receipt_date || r.created_at)} {formatTime(r.created_at)}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center justify-center min-w-[50px] px-2.5 py-1 rounded-full bg-[#FAF6EC] text-[#B8943C] border border-[#D6B25E]/20 shrink-0 ml-2" style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                      {formatNumber(r.grand_total)} Ks
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <p className="text-[#9CA3AF]" style={{ fontSize: "0.7rem" }}>{"\u101d\u101a\u103a\u101a\u1030\u101e\u1030"}</p>
                      <p className="text-[#6B7280]" style={{ fontSize: "0.85rem" }}>{r.customer_name}</p>
                    </div>
                    {r.note && (
                      <div>
                        <p className="text-[#9CA3AF]" style={{ fontSize: "0.7rem" }}>{"\u1019\u103e\u1010\u103a\u1001\u103b\u1000\u103a"}</p>
                        <p className="text-[#9CA3AF]" style={{ fontSize: "0.85rem" }}>{r.note}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 border-t border-[#E5E7EB]/60 pt-2">
                    <button onClick={() => openDetail(r)} className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] text-[#6B7280] hover:text-[#D6B25E] hover:bg-[#FAF6EC] transition-all cursor-pointer border border-[#E5E7EB]" style={{ fontSize: "0.75rem" }}>
                      <Eye className="w-3.5 h-3.5" /> {"\u1000\u103c\u100a\u103a\u1037\u1019\u100a\u103a"}
                    </button>
                    <button onClick={() => handlePrint(r)} className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] text-[#6B7280] hover:text-[#D6B25E] hover:bg-[#FAF6EC] transition-all cursor-pointer border border-[#E5E7EB]" style={{ fontSize: "0.75rem" }}>
                      <Printer className="w-3.5 h-3.5" /> {"\u1015\u101b\u1004\u103a\u1037"}
                    </button>
                    <button onClick={() => setDeleteRow(r)} className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] text-[#6B7280] hover:text-[#DC2626] hover:bg-red-50 transition-all cursor-pointer border border-[#E5E7EB]" style={{ fontSize: "0.75rem" }}>
                      <Trash2 className="w-3.5 h-3.5" /> {"\u1016\u103b\u1000\u103a\u101b\u1014\u103a"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {detailReceipt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetailReceipt(null)}>
          <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[#1F2937]">{"\u1018\u1031\u102c\u1004\u103a\u1001\u103b\u102c \u1021\u101e\u1031\u1038\u1005\u102d\u1010\u103a"}</h3>
              <button onClick={() => setDetailReceipt(null)} className="p-1 rounded-full hover:bg-[#F3F4F6] cursor-pointer">
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>

            {/* Receipt header info */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#6B7280]">{"\u1018\u1031\u102c\u1004\u103a\u1001\u103b\u102c\u1021\u1019\u103e\u1010\u103a"}</span>
                <span className="text-[#B8943C] font-medium">{detailReceipt.receipt_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">{"\u101b\u1000\u103a\u1005\u103d\u1032"}</span>
                <span className="text-[#1F2937]">{formatDate(detailReceipt.receipt_date || detailReceipt.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">{"\u101d\u101a\u103a\u101a\u1030\u101e\u1030"}</span>
                <span className="text-[#1F2937]">{detailReceipt.customer_name}</span>
              </div>
              {detailReceipt.note && (
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">{"\u1019\u103e\u1010\u103a\u1001\u103b\u1000\u103a"}</span>
                  <span className="text-[#9CA3AF]">{detailReceipt.note}</span>
                </div>
              )}
            </div>

            {/* Lines table */}
            <div className="border-t border-[#E5E7EB] pt-3">
              {detailLoading ? (
                <div className="flex items-center justify-center py-6 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#D6B25E]" />
                  <span className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>{"\u1001\u1031\u102b\u103a\u101a\u1030\u1014\u1031\u101e\u100a\u103a..."}</span>
                </div>
              ) : detailLines.length === 0 ? (
                <p className="text-[#9CA3AF] text-center py-4" style={{ fontSize: "0.85rem" }}>{"\u1015\u1005\u1039\u1005\u100a\u103a\u1038 \u1019\u101b\u103e\u102d\u1015\u102b"}</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E5E7EB]">
                      <th className="text-left py-2 px-2 text-[#6B7280]" style={{ fontSize: "0.75rem" }}>{"\u1005\u1025\u103a"}</th>
                      <th className="text-left py-2 px-2 text-[#6B7280]" style={{ fontSize: "0.75rem" }}>{"\u1015\u1005\u1039\u1005\u100a\u103a\u1038"}</th>
                      <th className="text-center py-2 px-2 text-[#6B7280]" style={{ fontSize: "0.75rem" }}>{"\u1021\u101b\u1031\u1021\u1010\u103d\u1000\u103a"}</th>
                      <th className="text-right py-2 px-2 text-[#6B7280]" style={{ fontSize: "0.75rem" }}>{"\u1008\u1031\u1038\u1014\u103e\u102f\u1014\u103a\u1038"}</th>
                      <th className="text-right py-2 px-2 text-[#6B7280]" style={{ fontSize: "0.75rem" }}>{"\u1005\u102f\u1005\u102f\u1015\u1031\u102b\u1004\u103a\u1038"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailLines.map((l, idx) => (
                      <tr key={l.id} className="border-b border-[#E5E7EB]/60">
                        <td className="py-2 px-2 text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>{idx + 1}</td>
                        <td className="py-2 px-2 text-[#1F2937]" style={{ fontSize: "0.85rem" }}>{l.item_name_snapshot}</td>
                        <td className="py-2 px-2 text-center text-[#1F2937]" style={{ fontSize: "0.85rem" }}>{l.qty}</td>
                        <td className="py-2 px-2 text-right text-[#6B7280]" style={{ fontSize: "0.85rem" }}>{formatNumber(l.unit_price)}</td>
                        <td className="py-2 px-2 text-right text-[#1F2937]" style={{ fontSize: "0.85rem" }}>{formatNumber(l.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Totals */}
            <div className="border-t border-[#E5E7EB] pt-3 space-y-1">
              {detailReceipt.discount_amount > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B7280]">{"\u1005\u102f\u1005\u102f\u1015\u1031\u102b\u1004\u103a\u1038\u1004\u103d\u1031"}</span>
                    <span className="text-[#1F2937]">{formatNumber(detailReceipt.subtotal)} Ks</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B7280]">{"\u101c\u103b\u103e\u1031\u102c\u1037\u1005\u1031\u103b\u1038"}</span>
                    <span className="text-red-500">-{formatNumber(detailReceipt.discount_amount)} Ks</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-semibold">
                <span className="text-[#1F2937]">{"\u1005\u102f\u1005\u102f\u1015\u1031\u102b\u1004\u103a\u1038"}</span>
                <span className="text-[#B8943C]">{formatNumber(detailReceipt.grand_total)} Ks</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button onClick={() => setDetailReceipt(null)} className="flex-1 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-all cursor-pointer" style={{ fontSize: "0.85rem" }}>
                {"\u1015\u102d\u1010\u103a\u1019\u100a\u103a"}
              </button>
              <button onClick={() => { setDetailReceipt(null); handlePrint(detailReceipt); }} className="flex-1 py-2.5 rounded-[10px] bg-[#D6B25E] text-white hover:bg-[#C4A24D] transition-all cursor-pointer flex items-center justify-center gap-2" style={{ fontSize: "0.85rem" }}>
                <Printer className="w-4 h-4" />
                {"\u1015\u101b\u1004\u103a\u1037\u1011\u102f\u1010\u103a\u1019\u100a\u103a"}
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
                <h3 className="text-[#1F2937]">{"\u1016\u103b\u1000\u103a\u101b\u1014\u103a \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1015\u102b"}</h3>
                <p className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>
                  {deleteRow.receipt_no} — {formatNumber(deleteRow.grand_total)} Ks {"\u1016\u103b\u1000\u103a\u1019\u100a\u103a\u101c\u102c\u1038?"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button onClick={() => setDeleteRow(null)} className="flex-1 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-all cursor-pointer" style={{ fontSize: "0.85rem" }}>
                {"\u1019\u101c\u102f\u1015\u103a\u1010\u1031\u102c\u1037\u1015\u102b"}
              </button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-[10px] bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2" style={{ fontSize: "0.85rem" }}>
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {"\u1016\u103b\u1000\u103a\u1019\u100a\u103a"}
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
                    <h3 className="text-[#1F2937]">{"\u1016\u103b\u1000\u103a\u101b\u1014\u103a \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1015\u102b"}</h3>
                    <p className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>
                      {selectedIds.size} {"\u1001\u102f \u1018\u1031\u102c\u1004\u103a\u1001\u103b\u102c \u1016\u103b\u1000\u103a\u1019\u100a\u103a\u101c\u102c\u1038?"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={() => setBulkDeleteStep(0)} className="flex-1 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-all cursor-pointer" style={{ fontSize: "0.85rem" }}>
                    {"\u1019\u101c\u102f\u1015\u103a\u1010\u1031\u102c\u1037\u1015\u102b"}
                  </button>
                  <button onClick={() => setBulkDeleteStep(2)} className="flex-1 py-2.5 rounded-[10px] bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-all cursor-pointer" style={{ fontSize: "0.85rem" }}>
                    {"\u1016\u103b\u1000\u103a\u1019\u100a\u103a"}
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
                    <h3 className="text-[#1F2937]">{"\u1014\u1031\u102c\u1000\u103a\u1006\u102f\u1036\u1038 \u1021\u1010\u100a\u103a\u1015\u103c\u102f\u1001\u103b\u1000\u103a"}</h3>
                    <p className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>
                      {"\u1024\u101c\u102f\u1015\u103a\u1006\u1031\u102c\u1004\u103a\u1001\u103b\u1000\u103a\u1000\u102d\u102f \u1015\u103c\u1014\u103a\u1016\u103b\u1000\u103a\u104d\u1019\u101b\u1015\u102b\u104b"} {selectedIds.size} {"\u1001\u102f \u1016\u103b\u1000\u103a\u1019\u100a\u103a\u101c\u102c\u1038?"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={() => setBulkDeleteStep(0)} className="flex-1 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-all cursor-pointer" style={{ fontSize: "0.85rem" }}>
                    {"\u1019\u101c\u102f\u1015\u103a\u1010\u1031\u102c\u1037\u1015\u102b"}
                  </button>
                  <button onClick={handleBulkDelete} disabled={bulkDeleting} className="flex-1 py-2.5 rounded-[10px] bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2" style={{ fontSize: "0.85rem" }}>
                    {bulkDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {"\u1021\u1010\u100a\u103a\u1015\u103c\u102f \u1016\u103b\u1000\u103a\u1019\u100a\u103a"}
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
