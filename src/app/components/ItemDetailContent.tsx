import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowLeft,
  Loader2,
  Cake,
  ShoppingBag,
  Calendar,
  RotateCcw,
  Package,
  FileText,
} from "lucide-react";
import * as db from "./db";
import type { SalesReceiptWithCustomer } from "./db";

interface ProdRow {
  id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  production_date: string;
  created_at: string;
}

interface SaleLine {
  receipt_id: string;
  receipt_no: string;
  receipt_date: string;
  customer_name: string;
  item_name_snapshot: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

const QUICK_RANGES = [
  { value: "Today", label: "ယနေ့" },
  { value: "7 Days", label: "၇ ရက်" },
  { value: "14 Days", label: "၁၄ ရက်" },
  { value: "30 Days", label: "၃၀ ရက်" },
  { value: "All", label: "အားလုံး" },
];

function getDefaultDates(range: string) {
  const to = new Date();
  const from = new Date();
  switch (range) {
    case "Today": break;
    case "7 Days": from.setDate(to.getDate() - 6); break;
    case "14 Days": from.setDate(to.getDate() - 13); break;
    case "30 Days": from.setDate(to.getDate() - 29); break;
    case "All": from.setFullYear(2020); break;
    default: from.setDate(to.getDate() - 29);
  }
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(from), to: fmt(to) };
}

function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.substring(0, 10) || "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatNumber(n: number) {
  return n.toLocaleString("en-US");
}

interface ItemDetailContentProps {
  itemId: string;
  itemName: string;
  currentStock: number;
  onBack: () => void;
  onNavigate?: (tab: string, search?: string) => void;
}

export function ItemDetailContent({ itemId, itemName, currentStock, onBack, onNavigate }: ItemDetailContentProps) {
  const [prodLogs, setProdLogs] = useState<ProdRow[]>([]);
  const [saleLines, setSaleLines] = useState<SaleLine[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const defaults = getDefaultDates("30 Days");
  const [selectedRange, setSelectedRange] = useState("30 Days");
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);

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
      const [allLogs, allReceipts] = await Promise.all([
        db.getProductionLogs(),
        db.getSalesReceipts(),
      ]);

      // Filter production logs for this item
      const itemLogs = allLogs.filter((l: any) => l.item_id === itemId);
      setProdLogs(itemLogs);

      // Get all receipt IDs, then fetch lines for matching item
      const receiptMap = new Map<string, SalesReceiptWithCustomer>();
      for (const r of allReceipts) {
        receiptMap.set(r.id, r);
      }

      // Fetch all lines for all receipts and filter by item
      const allLines: SaleLine[] = [];
      for (const receipt of allReceipts) {
        const lines = await db.getSalesReceiptLines(receipt.id);
        for (const line of lines) {
          if (line.item_id === itemId) {
            allLines.push({
              receipt_id: receipt.id,
              receipt_no: receipt.receipt_no,
              receipt_date: receipt.receipt_date || receipt.created_at,
              customer_name: receipt.customer_name,
              item_name_snapshot: line.item_name_snapshot,
              qty: line.qty,
              unit_price: line.unit_price,
              line_total: line.line_total,
            });
          }
        }
      }
      setSaleLines(allLines);
    } catch (e) {
      console.error("Failed to load item details:", e);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRangeChange = (r: string) => {
    setSelectedRange(r);
    const d = getDefaultDates(r);
    setDateFrom(d.from);
    setDateTo(d.to);
  };

  const handleReset = () => {
    setSelectedRange("30 Days");
    const d = getDefaultDates("30 Days");
    setDateFrom(d.from);
    setDateTo(d.to);
  };

  // Filter production logs by date
  const filteredProdLogs = useMemo(() => {
    const fromD = new Date(dateFrom + "T00:00:00");
    const toD = new Date(dateTo + "T23:59:59");
    return prodLogs.filter((l) => {
      const dateStr = l.production_date || l.created_at;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime()) && (d < fromD || d > toD)) return false;
      }
      return true;
    });
  }, [prodLogs, dateFrom, dateTo]);

  // Filter sales by date
  const filteredSaleLines = useMemo(() => {
    const fromD = new Date(dateFrom + "T00:00:00");
    const toD = new Date(dateTo + "T23:59:59");
    return saleLines.filter((s) => {
      const dateStr = s.receipt_date;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime()) && (d < fromD || d > toD)) return false;
      }
      return true;
    });
  }, [saleLines, dateFrom, dateTo]);

  // Summaries
  const totalProduced = filteredProdLogs.reduce((sum, l) => sum + l.quantity, 0);
  const totalSoldQty = filteredSaleLines.reduce((sum, s) => sum + s.qty, 0);
  const totalSoldAmount = filteredSaleLines.reduce((sum, s) => sum + s.line_total, 0);
  const totalReceipts = new Set(filteredSaleLines.map(s => s.receipt_id)).size;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-[#D6B25E]" />
        <span className="text-[#9CA3AF]" style={{ fontSize: "0.85rem" }}>
          ဒေတာ ခေါ်ယူနေသည်...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-9 h-9 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#1F2937] transition-all cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h3 className="text-[#1F2937]" style={{ fontSize: isMobile ? "1.1rem" : "1.25rem" }}>{itemName}</h3>
          <p className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>ထုတ်လုပ်မှုနှင့် အရောင်းမှတ်တမ်း</p>
        </div>
      </div>

      {/* Summary Cards - Row 1 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-[10px] bg-blue-50 flex items-center justify-center shrink-0">
              <Cake className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <p className="text-[#1F2937]" style={{ fontSize: isMobile ? "1.15rem" : "1.35rem" }}>{formatNumber(totalProduced)}</p>
          <p className="text-[#9CA3AF] mt-0.5" style={{ fontSize: "0.72rem" }}>စုစုပေါင်း ထုတ်လုပ်</p>
        </div>
        <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-[10px] bg-green-50 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4 text-green-500" />
            </div>
          </div>
          <p className="text-[#1F2937]" style={{ fontSize: isMobile ? "1.15rem" : "1.35rem" }}>{formatNumber(totalSoldQty)}</p>
          <p className="text-[#9CA3AF] mt-0.5" style={{ fontSize: "0.72rem" }}>စုစုပေါင်း ရောင်းချ</p>
        </div>
        <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-[10px] bg-orange-50 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-orange-500" />
            </div>
          </div>
          <p className="text-[#1F2937]" style={{ fontSize: isMobile ? "1.15rem" : "1.35rem" }}>{formatNumber(currentStock)}</p>
          <p className="text-[#9CA3AF] mt-0.5" style={{ fontSize: "0.72rem" }}>လက်ကျန်ပစ္စည်းပမာဏ</p>
        </div>
      </div>

      {/* Summary Cards - Row 2 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-[10px] bg-purple-50 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-purple-500" />
            </div>
          </div>
          <p className="text-[#1F2937]" style={{ fontSize: isMobile ? "1.15rem" : "1.35rem" }}>{formatNumber(totalReceipts)}</p>
          <p className="text-[#9CA3AF] mt-0.5" style={{ fontSize: "0.72rem" }}>စုစုပေါင်း ဘောင်ချာမှတ်တမ်း</p>
        </div>
        <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-[10px] bg-[#FAF6EC] flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4 text-[#D6B25E]" />
            </div>
          </div>
          <p className="text-[#1F2937]" style={{ fontSize: isMobile ? "1.15rem" : "1.35rem" }}>{formatNumber(totalSoldAmount)} Ks</p>
          <p className="text-[#9CA3AF] mt-0.5" style={{ fontSize: "0.72rem" }}>စုစုပေါင်း ရောင်းရငွေ</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>ရက်အပိုင်းအခြား</label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="pl-9 pr-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all w-full sm:w-auto" style={{ fontSize: "0.85rem" }} />
              </div>
              <span className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>မှ</span>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="pl-9 pr-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all w-full sm:w-auto" style={{ fontSize: "0.85rem" }} />
              </div>
            </div>
          </div>
          <button onClick={handleReset} className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#1F2937] transition-all cursor-pointer sm:ml-auto" style={{ fontSize: "0.85rem" }}>
            <RotateCcw className="w-3.5 h-3.5" />
            ပြန်လည်သတ်မှတ်ရန်
          </button>
        </div>
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

      {/* Production Log Table */}
      <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 sm:p-6 overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <Cake className="w-4 h-4 text-blue-500" />
          <h4 className="text-[#1F2937]" style={{ fontSize: "1rem" }}>ကုန်ထုတ်လုပ်မှုမှတ်တမ်း</h4>
          <span className="text-[#9CA3AF] ml-auto" style={{ fontSize: "0.75rem" }}>{filteredProdLogs.length} ခု</span>
        </div>
        {filteredProdLogs.length === 0 ? (
          <p className="text-[#9CA3AF] text-center py-8" style={{ fontSize: "0.85rem" }}>ထုတ်လုပ်မှု မှတ်တမ်း မရှိပါ</p>
        ) : (
          <div className="overflow-auto" style={{ maxHeight: "400px" }}>
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-[2]">
                <tr className="bg-white">
                  <th className="text-left py-3 px-3 text-[#6B7280] border-b-2 border-[#E5E7EB]" style={{ fontSize: "0.8rem" }}>ရက်စွဲ</th>
                  <th className="text-center py-3 px-3 text-[#6B7280] border-b-2 border-[#E5E7EB]" style={{ fontSize: "0.8rem" }}>အရေအတွက်</th>
                </tr>
              </thead>
              <tbody>
                {filteredProdLogs.map((log) => (
                  <tr key={log.id} onClick={() => onNavigate?.("production_log", itemName)} className="border-b border-[#E5E7EB]/60 hover:bg-[#FAF6EC] transition-colors cursor-pointer">
                    <td className="py-3 px-3 text-[#1F2937]" style={{ fontSize: "0.85rem" }}>{formatDate(log.production_date)}</td>
                    <td className="py-3 px-3 text-center text-[#1F2937]" style={{ fontSize: "0.85rem" }}>{log.quantity}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 z-[2]">
                <tr className="bg-[#FAF6EC] border-t-2 border-[#D6B25E]/40">
                  <td className="py-3 px-3 text-[#1F2937] font-semibold" style={{ fontSize: "0.85rem" }}>စုစုပေါင်း</td>
                  <td className="py-3 px-3 text-center text-[#1F2937] font-semibold" style={{ fontSize: "0.85rem" }}>{formatNumber(totalProduced)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 sm:p-6 overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingBag className="w-4 h-4 text-[#D6B25E]" />
          <h4 className="text-[#1F2937]" style={{ fontSize: "1rem" }}>အရောင်းမှတ်တမ်း</h4>
          <span className="text-[#9CA3AF] ml-auto" style={{ fontSize: "0.75rem" }}>{filteredSaleLines.length} ခု</span>
        </div>
        {filteredSaleLines.length === 0 ? (
          <p className="text-[#9CA3AF] text-center py-8" style={{ fontSize: "0.85rem" }}>အရောင်း မှတ်တမ်း မရှိပါ</p>
        ) : (
          <div className="overflow-auto" style={{ maxHeight: "400px" }}>
            <table className="w-full border-collapse" style={{ minWidth: "480px" }}>
              <thead className="sticky top-0 z-[2]">
                <tr className="bg-white">
                  <th className="text-left py-3 px-3 text-[#6B7280] border-b-2 border-[#E5E7EB]" style={{ fontSize: "0.8rem" }}>ရက်စွဲ</th>
                  <th className="text-left py-3 px-3 text-[#6B7280] border-b-2 border-[#E5E7EB]" style={{ fontSize: "0.8rem" }}>ဘောင်ချာနံပါတ်</th>
                  <th className="text-left py-3 px-3 text-[#6B7280] border-b-2 border-[#E5E7EB]" style={{ fontSize: "0.8rem" }}>ဝယ်ယူသူ</th>
                  <th className="text-center py-3 px-3 text-[#6B7280] border-b-2 border-[#E5E7EB]" style={{ fontSize: "0.8rem" }}>အရေအတွက်</th>
                  <th className="text-right py-3 px-3 text-[#6B7280] border-b-2 border-[#E5E7EB]" style={{ fontSize: "0.8rem" }}>ကျသင့်ငွေ</th>
                </tr>
              </thead>
              <tbody>
                {filteredSaleLines.map((s, idx) => (
                  <tr key={`${s.receipt_id}-${idx}`} onClick={() => onNavigate?.("sales", s.receipt_no)} className="border-b border-[#E5E7EB]/60 hover:bg-[#FAF6EC] transition-colors cursor-pointer">
                    <td className="py-3 px-3 text-[#1F2937]" style={{ fontSize: "0.85rem" }}>{formatDate(s.receipt_date)}</td>
                    <td className="py-3 px-3 text-[#6B7280]" style={{ fontSize: "0.8rem" }}>{s.receipt_no}</td>
                    <td className="py-3 px-3 text-[#1F2937]" style={{ fontSize: "0.85rem" }}>{s.customer_name}</td>
                    <td className="py-3 px-3 text-center text-[#1F2937]" style={{ fontSize: "0.85rem" }}>{s.qty}</td>
                    <td className="py-3 px-3 text-right text-[#1F2937]" style={{ fontSize: "0.85rem" }}>{formatNumber(s.line_total)} Ks</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 z-[2]">
                <tr className="bg-[#FAF6EC] border-t-2 border-[#D6B25E]/40">
                  <td className="py-3 px-3 text-[#1F2937] font-semibold" style={{ fontSize: "0.85rem" }}>စုစုပေါင်း</td>
                  <td className="py-3 px-3" />
                  <td className="py-3 px-3" />
                  <td className="py-3 px-3 text-center text-[#1F2937] font-semibold" style={{ fontSize: "0.85rem" }}>{formatNumber(totalSoldQty)}</td>
                  <td className="py-3 px-3 text-right text-[#1F2937] font-semibold" style={{ fontSize: "0.85rem" }}>{formatNumber(totalSoldAmount)} Ks</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
