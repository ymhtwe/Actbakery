import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Search,
  Loader2,
  CheckSquare,
  Square,
  MinusSquare,
  Trash2,
  AlertTriangle,
  X,
  Pencil,
} from "lucide-react";
import * as db from "./db";
import type { ReceiptPaymentWithInfo } from "./db";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNumber(n: number) {
  return n.toLocaleString("en-US");
}

export function PaymentLogContent() {
  const [paymentLogs, setPaymentLogs] = useState<ReceiptPaymentWithInfo[]>([]);
  const [paymentLogLoading, setPaymentLogLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [receiptSearch, setReceiptSearch] = useState("");
  const [customerDropOpen, setCustomerDropOpen] = useState(false);
  const [receiptDropOpen, setReceiptDropOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "outstanding" | "paid">("all");
  const [plSelectedIds, setPlSelectedIds] = useState<Set<string>>(new Set());
  const [plDeleteRow, setPlDeleteRow] = useState<ReceiptPaymentWithInfo | null>(null);
  const [plDeleting, setPlDeleting] = useState(false);
  const [plBulkDeleting, setPlBulkDeleting] = useState(false);
  const [plBulkDeleteConfirm, setPlBulkDeleteConfirm] = useState(false);
  const [plEditRow, setPlEditRow] = useState<ReceiptPaymentWithInfo | null>(null);
  const [plEditAmount, setPlEditAmount] = useState("");
  const [plEditNote, setPlEditNote] = useState("");
  const [plEditSaving, setPlEditSaving] = useState(false);

  const loadPaymentLogs = useCallback(async () => {
    setPaymentLogLoading(true);
    try {
      const data = await db.getAllReceiptPayments();
      setPaymentLogs(data);
    } catch (e) {
      console.error("Failed to load payment logs:", e);
    } finally {
      setPaymentLogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPaymentLogs();
  }, [loadPaymentLogs]);

  // Refs for click-outside closing
  const customerDropRef = useRef<HTMLDivElement>(null);
  const receiptDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerDropRef.current && !customerDropRef.current.contains(e.target as Node)) setCustomerDropOpen(false);
      if (receiptDropRef.current && !receiptDropRef.current.contains(e.target as Node)) setReceiptDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Unique customer names for suggestions
  const customerSuggestions = useMemo(() => {
    const names = [...new Set(paymentLogs.map((p) => p.customer_name))].sort();
    if (!customerSearch.trim()) return names;
    const q = customerSearch.toLowerCase();
    return names.filter((n) => n.toLowerCase().includes(q));
  }, [paymentLogs, customerSearch]);

  // Unique receipt numbers for suggestions
  const receiptSuggestions = useMemo(() => {
    const nums = [...new Set(paymentLogs.map((p) => p.receipt_no))].sort();
    if (!receiptSearch.trim()) return nums;
    const q = receiptSearch.toLowerCase();
    return nums.filter((n) => n.toLowerCase().includes(q));
  }, [paymentLogs, receiptSearch]);

  const filteredPaymentLogs = useMemo(() => {
    let result = paymentLogs;

    // Status filter
    if (statusFilter === "outstanding") {
      result = result.filter((p) => p.grand_total - p.receipt_paid_amount > 0);
    } else if (statusFilter === "paid") {
      result = result.filter((p) => p.grand_total - p.receipt_paid_amount <= 0);
    }

    // Customer name filter
    if (customerSearch.trim()) {
      const q = customerSearch.toLowerCase();
      result = result.filter((p) => p.customer_name.toLowerCase().includes(q));
    }

    // Receipt number filter
    if (receiptSearch.trim()) {
      const q = receiptSearch.toLowerCase();
      result = result.filter((p) => p.receipt_no.toLowerCase().includes(q));
    }

    return result;
  }, [paymentLogs, customerSearch, receiptSearch, statusFilter]);

  const plIsAllSelected = filteredPaymentLogs.length > 0 && plSelectedIds.size === filteredPaymentLogs.length;
  const plIsSomeSelected = plSelectedIds.size > 0 && plSelectedIds.size < filteredPaymentLogs.length;

  const handlePlDelete = async () => {
    if (!plDeleteRow) return;
    setPlDeleting(true);
    try {
      await db.deletePaymentLog(plDeleteRow.id, plDeleteRow.receipt_id);
      setPlDeleteRow(null);
      await loadPaymentLogs();
    } catch (e: any) {
      alert(e?.message || "ဖျက်၍ မအောင်မြင်ပါ");
    } finally {
      setPlDeleting(false);
    }
  };

  const handlePlBulkDelete = async () => {
    setPlBulkDeleting(true);
    try {
      const items = paymentLogs.filter((p) => plSelectedIds.has(p.id));
      await db.bulkDeletePaymentLogs(items.map((p) => ({ id: p.id, receipt_id: p.receipt_id })));
      setPlSelectedIds(new Set());
      setPlBulkDeleteConfirm(false);
      await loadPaymentLogs();
    } catch (e: any) {
      alert(e?.message || "ဖျက်၍ မအောင်မြင်ပါ");
    } finally {
      setPlBulkDeleting(false);
    }
  };

  const handlePlEditSave = async () => {
    if (!plEditRow) return;
    const amount = parseInt(plEditAmount) || 0;
    if (amount <= 0) return;
    setPlEditSaving(true);
    try {
      await db.updatePaymentLog(plEditRow.id, plEditRow.receipt_id, {
        amount,
        note: plEditNote || undefined,
      });
      setPlEditRow(null);
      await loadPaymentLogs();
    } catch (e: any) {
      alert(e?.message || "ပြင်ဆင်၍ မအောင်မြင်ပါ");
    } finally {
      setPlEditSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status filter tabs */}
      <div className="flex gap-2">
        {([
          { id: "all" as const, label: "အားလုံး" },
          { id: "outstanding" as const, label: "အကြွေးကျန်" },
          { id: "paid" as const, label: "အကြွေးဆပ်ပီး" },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setStatusFilter(tab.id); setPlSelectedIds(new Set()); }}
            className={`px-3 py-2 rounded-[10px] transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === tab.id
                ? "bg-[#FAF6EC] text-[#B8943C] border border-[#D6B25E]/30"
                : "text-[#6B7280] hover:text-[#1F2937] border border-transparent hover:border-[#E5E7EB]"
            }`}
            style={{ fontSize: "0.8rem" }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Customer name search with dropdown */}
        <div ref={customerDropRef} className="relative">
          <label className="block text-[#6B7280] mb-1" style={{ fontSize: "0.75rem" }}>ဝယ်သူအမည်</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="ဝယ်သူအမည် ရှာရန်..."
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setCustomerDropOpen(true); }}
              onFocus={() => setCustomerDropOpen(true)}
              className="w-full pl-9 pr-4 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
              style={{ fontSize: "0.85rem" }}
            />
          </div>
          {customerDropOpen && customerSuggestions.length > 0 && (
            <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-[#E5E7EB] rounded-[10px] shadow-lg max-h-48 overflow-y-auto">
              {customerSuggestions.map((name) => (
                <button
                  key={name}
                  onClick={() => { setCustomerSearch(name); setCustomerDropOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-[#1F2937] hover:bg-[#FAF6EC] transition-colors cursor-pointer"
                  style={{ fontSize: "0.85rem" }}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Receipt number search with dropdown */}
        <div ref={receiptDropRef} className="relative">
          <label className="block text-[#6B7280] mb-1" style={{ fontSize: "0.75rem" }}>ဘောင်ချာနံပါတ်</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="ဘောင်ချာ ရှာရန်..."
              value={receiptSearch}
              onChange={(e) => { setReceiptSearch(e.target.value); setReceiptDropOpen(true); }}
              onFocus={() => setReceiptDropOpen(true)}
              className="w-full pl-9 pr-4 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
              style={{ fontSize: "0.85rem" }}
            />
          </div>
          {receiptDropOpen && receiptSuggestions.length > 0 && (
            <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-[#E5E7EB] rounded-[10px] shadow-lg max-h-48 overflow-y-auto">
              {receiptSuggestions.map((num) => (
                <button
                  key={num}
                  onClick={() => { setReceiptSearch(num); setReceiptDropOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-[#1F2937] hover:bg-[#FAF6EC] transition-colors cursor-pointer"
                  style={{ fontSize: "0.85rem" }}
                >
                  {num}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Select all / bulk actions */}
      {filteredPaymentLogs.length > 0 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (plIsAllSelected) { setPlSelectedIds(new Set()); }
              else { setPlSelectedIds(new Set(filteredPaymentLogs.map((p) => p.id))); }
            }}
            className="flex items-center gap-2 text-[#6B7280] hover:text-[#1F2937] cursor-pointer"
            style={{ fontSize: "0.8rem" }}
          >
            {plIsAllSelected ? <CheckSquare className="w-4 h-4 text-[#D6B25E]" /> : plIsSomeSelected ? <MinusSquare className="w-4 h-4 text-[#D6B25E]" /> : <Square className="w-4 h-4" />}
            {plIsAllSelected ? "\u1021\u102c\u1038\u101c\u102f\u1036\u1038 \u1016\u103c\u102f\u1010\u103a\u1019\u100a\u103a" : "\u1021\u102c\u1038\u101c\u102f\u1036\u1038 \u101b\u103d\u1031\u1038\u1019\u100a\u103a"}
          </button>
          {plSelectedIds.size > 0 && (
            <button
              onClick={() => setPlBulkDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-red-600 border border-red-200 hover:bg-red-50 transition-all cursor-pointer"
              style={{ fontSize: "0.8rem" }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {plSelectedIds.size} {"\u1001\u102f \u1016\u103b\u1000\u103a\u1019\u100a\u103a"}
            </button>
          )}
        </div>
      )}

      {paymentLogLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#D6B25E]" />
        </div>
      ) : filteredPaymentLogs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[#9CA3AF]" style={{ fontSize: "0.9rem" }}>{"\u101c\u1000\u103a\u1000\u103b\u1014\u103a\u1004\u103d\u1031 \u101c\u1000\u103a\u1001\u1036\u1019\u103e\u1010\u103a\u1010\u1019\u103a\u1038 \u1019\u101b\u103e\u102d\u101e\u1031\u1038\u1015\u102b"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPaymentLogs.map((p) => {
            const remainingBalance = p.grand_total - p.receipt_paid_amount;
            const isChecked = plSelectedIds.has(p.id);
            return (
              <div key={p.id} className={`bg-white rounded-[12px] border shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 transition-all ${isChecked ? "border-[#D6B25E] bg-[#FFFDF7]" : "border-[#E5E7EB]"}`}>
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => {
                      const next = new Set(plSelectedIds);
                      if (isChecked) next.delete(p.id); else next.add(p.id);
                      setPlSelectedIds(next);
                    }}
                    className="mt-0.5 shrink-0 cursor-pointer"
                  >
                    {isChecked ? <CheckSquare className="w-4 h-4 text-[#D6B25E]" /> : <Square className="w-4 h-4 text-[#9CA3AF]" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-[#B8943C] font-medium" style={{ fontSize: "0.85rem" }}>{p.receipt_no}</p>
                        <p className="text-[#6B7280]" style={{ fontSize: "0.8rem" }}>{p.customer_name}</p>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 shrink-0 ml-2" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                        +{formatNumber(p.amount)} Ks
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>
                      <span>{formatDate(p.payment_date)} {formatTime(p.created_at)}</span>
                      <span>
                        {remainingBalance > 0 ? (
                          <span className="text-red-500">{"\u1000\u103b\u1014\u103a"} {formatNumber(remainingBalance)} Ks</span>
                        ) : (
                          <span className="text-green-600">{"\u1004\u103d\u1031\u1015\u1031\u1038\u1015\u102e\u1038"}</span>
                        )}
                      </span>
                    </div>
                    {p.note && (
                      <p className="text-[#9CA3AF] mt-1" style={{ fontSize: "0.75rem" }}>{"\u1019\u103e\u1010\u103a\u1001\u103b\u1000\u103a: "}{p.note}</p>
                    )}
                    {/* Action buttons */}
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#E5E7EB]/60">
                      <button
                        onClick={() => { setPlEditRow(p); setPlEditAmount(String(p.amount)); setPlEditNote(p.note || ""); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#B8943C] transition-all cursor-pointer"
                        style={{ fontSize: "0.75rem" }}
                      >
                        <Pencil className="w-3 h-3" />
                        {"\u1015\u103c\u1004\u103a\u1019\u100a\u103a"}
                      </button>
                      <button
                        onClick={() => setPlDeleteRow(p)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-[#6B7280] hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer"
                        style={{ fontSize: "0.75rem" }}
                      >
                        <Trash2 className="w-3 h-3" />
                        {"\u1016\u103b\u1000\u103a\u1019\u100a\u103a"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Delete confirm modal ── */}
      {plDeleteRow && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4" onClick={(e) => { if (e.target === e.currentTarget) setPlDeleteRow(null); }}>
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
              </div>
              <div>
                <h3 className="text-[#1F2937]" style={{ fontSize: "1rem" }}>{"\u1016\u103b\u1000\u103a\u1019\u100a\u103a\u101c\u102c\u1038?"}</h3>
                <p className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>+{formatNumber(plDeleteRow.amount)} Ks — {plDeleteRow.receipt_no}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setPlDeleteRow(null)} className="flex-1 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-all cursor-pointer" style={{ fontSize: "0.85rem" }}>
                {"\u1019\u101c\u102f\u1015\u103a\u1010\u1031\u102c\u1037\u1015\u102b"}
              </button>
              <button onClick={handlePlDelete} disabled={plDeleting} className="flex-1 py-2.5 rounded-[10px] bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2" style={{ fontSize: "0.85rem" }}>
                {plDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {"\u1016\u103b\u1000\u103a\u1019\u100a\u103a"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk delete confirm modal ── */}
      {plBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4" onClick={(e) => { if (e.target === e.currentTarget) setPlBulkDeleteConfirm(false); }}>
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
              </div>
              <div>
                <h3 className="text-[#1F2937]" style={{ fontSize: "1rem" }}>{plSelectedIds.size} {"\u1001\u102f \u1016\u103b\u1000\u103a\u1019\u100a\u103a\u101c\u102c\u1038?"}</h3>
                <p className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>{"\u1024\u101c\u102f\u1015\u103a\u1006\u1031\u102c\u1004\u103a\u1001\u103b\u1000\u103a\u1000\u102d\u102f \u1015\u103c\u1014\u103a\u1016\u103b\u1000\u103a\u104d\u1019\u101b\u1015\u102b\u104b"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setPlBulkDeleteConfirm(false)} className="flex-1 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-all cursor-pointer" style={{ fontSize: "0.85rem" }}>
                {"\u1019\u101c\u102f\u1015\u103a\u1010\u1031\u102c\u1037\u1015\u102b"}
              </button>
              <button onClick={handlePlBulkDelete} disabled={plBulkDeleting} className="flex-1 py-2.5 rounded-[10px] bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2" style={{ fontSize: "0.85rem" }}>
                {plBulkDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {"\u1021\u1010\u100a\u103a\u1015\u103c\u102f \u1016\u103b\u1000\u103a\u1019\u100a\u103a"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal ── */}
      {plEditRow && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4" onClick={(e) => { if (e.target === e.currentTarget) setPlEditRow(null); }}>
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[#1F2937]" style={{ fontSize: "1rem" }}>{"\u1015\u1031\u1038\u1001\u103b\u1019\u103e\u102f \u1015\u103c\u1004\u103a\u1006\u1004\u103a\u1019\u100a\u103a"}</h3>
              <button onClick={() => setPlEditRow(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-[#9CA3AF] hover:bg-[#F7F6F3] hover:text-[#1F2937] transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>{plEditRow.receipt_no} — {plEditRow.customer_name}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-[#6B7280] mb-1" style={{ fontSize: "0.75rem" }}>{"\u1015\u1031\u1038\u1004\u103d\u1031"}</label>
                <div className="flex items-center gap-2">
                  <input type="text" inputMode="numeric" value={plEditAmount} onChange={(e) => { const v = e.target.value; if (/^\d*$/.test(v)) setPlEditAmount(v); }} className="flex-1 text-center px-3 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E]" style={{ fontSize: "0.9rem" }} autoFocus />
                  <span className="text-[#9CA3AF]" style={{ fontSize: "0.85rem" }}>Ks</span>
                </div>
              </div>
              <div>
                <label className="block text-[#6B7280] mb-1" style={{ fontSize: "0.75rem" }}>{"\u1019\u103e\u1010\u103a\u1001\u103b\u1000\u103a"}</label>
                <input type="text" value={plEditNote} onChange={(e) => setPlEditNote(e.target.value)} placeholder={"\u1019\u103e\u1010\u103a\u1001\u103b\u1000\u103a (\u1019\u101c\u102d\u102f\u1021\u1015\u103a\u1015\u102b)"} className="w-full px-3 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E]" style={{ fontSize: "0.85rem" }} />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button onClick={() => setPlEditRow(null)} className="flex-1 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-all cursor-pointer" style={{ fontSize: "0.85rem" }}>
                {"\u1015\u102d\u1010\u103a\u1019\u100a\u103a"}
              </button>
              <button onClick={handlePlEditSave} disabled={plEditSaving || !(parseInt(plEditAmount) > 0)} className="flex-1 py-2.5 rounded-[10px] bg-[#D6B25E] text-white hover:bg-[#B8943C] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2" style={{ fontSize: "0.85rem" }}>
                {plEditSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {"\u101e\u102d\u1019\u103a\u1038\u1019\u100a\u103a"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
