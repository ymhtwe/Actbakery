import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShoppingBag,
  FileText,
  Users,
  Calendar,
  ChevronDown,
  RotateCcw,
  Loader2,
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
import type { SalesReceiptWithCustomer } from "./db";

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
    case "Today": break;
    case "7 Days": from.setDate(to.getDate() - 6); break;
    case "14 Days": from.setDate(to.getDate() - 13); break;
    case "30 Days": from.setDate(to.getDate() - 29); break;
    case "All": from.setFullYear(2020); break;
    default: from.setDate(to.getDate() - 6);
  }
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(from), to: fmt(to) };
}

function formatNumber(n: number) {
  return n.toLocaleString("en-US");
}

export function SalesReportContent({ onNavigate }: { onNavigate?: (tab: string, subTab?: string) => void }) {
  const [receipts, setReceipts] = useState<SalesReceiptWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const defaults = getDefaultDates("30 Days");
  const [selectedRange, setSelectedRange] = useState("30 Days");
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [selectedCustomer, setSelectedCustomer] = useState(ALL_CUSTOMERS_LABEL);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [allCustomers, setAllCustomers] = useState<{ id: string; name: string }[]>([]);

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
      const [data, customers] = await Promise.all([
        db.getSalesReceipts(),
        db.getCustomers(),
      ]);
      setReceipts(data);
      setAllCustomers(customers.map((c) => ({ id: c.id, name: c.name })));
    } catch (e) {
      console.error("Failed to load sales report data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRangeChange = (r: string) => {
    setSelectedRange(r);
    const d = getDefaultDates(r);
    setDateFrom(d.from);
    setDateTo(d.to);
  };

  const handleReset = () => {
    setSelectedRange("30 Days");
    setSelectedCustomer(ALL_CUSTOMERS_LABEL);
    const d = getDefaultDates("30 Days");
    setDateFrom(d.from);
    setDateTo(d.to);
  };

  const filteredReceipts = useMemo(() => {
    const fromD = new Date(dateFrom + "T00:00:00");
    const toD = new Date(dateTo + "T23:59:59");
    return receipts.filter((r) => {
      const dateStr = r.receipt_date || r.created_at;
      if (dateStr) {
        const sd = new Date(dateStr);
        if (!isNaN(sd.getTime()) && (sd < fromD || sd > toD)) return false;
      }
      if (selectedCustomer !== ALL_CUSTOMERS_LABEL && r.customer_name !== selectedCustomer) return false;
      return true;
    });
  }, [receipts, dateFrom, dateTo, selectedCustomer]);

  // Summary stats
  const stats = useMemo(() => {
    const totalAmount = filteredReceipts.reduce((sum, r) => sum + (r.grand_total || 0), 0);
    const totalReceipts = filteredReceipts.length;
    const uniqueCustomers = new Set(
      filteredReceipts.filter((r) => r.customer_id).map((r) => r.customer_id),
    ).size;
    return { totalAmount, totalReceipts, uniqueCustomers };
  }, [filteredReceipts]);

  // Daily sales trend
  const dailySalesData = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filteredReceipts) {
      const dateStr = (r.receipt_date || r.created_at || "").split("T")[0];
      if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        map.set(dateStr, (map.get(dateStr) || 0) + (r.grand_total || 0));
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amount]) => {
        const d = new Date(date);
        return { date: `${d.getMonth() + 1}/${d.getDate()}`, fullDate: date, amount };
      });
  }, [filteredReceipts]);

  // Top customers
  const topCustomersData = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filteredReceipts) {
      const name = (r.customer_name || "").trim();
      if (!name || name === "Walk-in") continue;
      map.set(name, (map.get(name) || 0) + (r.grand_total || 0));
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredReceipts]);

  const tooltipStyle = {
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  };

  const chartHeight = isMobile ? 200 : 260;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-[#D6B25E]" />
        <span className="text-[#9CA3AF]" style={{ fontSize: "0.85rem" }}>
          ရောင်းငွေဒေတာ ခေါ်ယူနေသည်...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: "စုစုပေါင်း ရောင်းရငွေ", sub: "totalAmount", value: `${formatNumber(stats.totalAmount)} Ks`, icon: ShoppingBag, color: "text-[#D6B25E]", bg: "bg-[#FAF6EC]", nav: "sales" as const },
          { label: "ဘောင်ချာ အရေအတွက်", sub: "receipts", value: stats.totalReceipts, icon: FileText, color: "text-blue-500", bg: "bg-blue-50", nav: "sales" as const },
          { label: "ဝယ်ယူသူ ဦးရေ", sub: "customers", value: stats.uniqueCustomers, icon: Users, color: "text-green-500", bg: "bg-green-50", nav: "sales" as const },
        ].map((card) => (
          <button key={card.sub} onClick={() => onNavigate?.("sales")} className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4 sm:p-5 text-left hover:border-[#D6B25E]/50 hover:shadow-[0_2px_8px_rgba(214,178,94,0.12)] transition-all cursor-pointer group">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-[10px] ${card.bg} flex items-center justify-center shrink-0`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <p className="text-[#1F2937] mt-1" style={{ fontSize: isMobile ? "1.25rem" : "1.5rem" }}>{card.value}</p>
            <p className="text-[#9CA3AF] mt-0.5 leading-tight" style={{ fontSize: "0.72rem" }}>{card.label}</p>
          </button>
        ))}
      </div>

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

          {/* Customer dropdown */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>ဝယ်ယူသူ</label>
            <button onClick={() => setCustomerDropdownOpen(!customerDropdownOpen)} className="flex items-center justify-between gap-8 px-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] hover:border-[#D6B25E]/50 transition-all cursor-pointer min-w-[160px]" style={{ fontSize: "0.85rem" }}>
              <span>{selectedCustomer}</span>
              <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
            </button>
            {customerDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-lg z-20 py-1 max-h-64 overflow-auto">
                {[ALL_CUSTOMERS_LABEL, ...allCustomers.map((c) => c.name)].map((customer) => (
                  <button key={`sr-cust-${customer}`} onClick={() => { setSelectedCustomer(customer); setCustomerDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-[#FAF6EC] transition-colors cursor-pointer ${selectedCustomer === customer ? "text-[#B8943C] bg-[#FAF6EC]" : "text-[#1F2937]"}`} style={{ fontSize: "0.85rem" }}>
                    {customer === ALL_CUSTOMERS_LABEL ? ALL_CUSTOMERS_DROPDOWN_LABEL : customer}
                  </button>
                ))}
              </div>
            )}
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
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>ဝယ်ယူသူ</label>
            <button onClick={() => setCustomerDropdownOpen(!customerDropdownOpen)} className="flex items-center justify-between px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] w-full cursor-pointer" style={{ fontSize: "0.85rem" }}>
              <span>{selectedCustomer}</span>
              <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
            </button>
            {customerDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-lg z-20 py-1 max-h-64 overflow-auto">
                {[ALL_CUSTOMERS_LABEL, ...allCustomers.map((c) => c.name)].map((customer) => (
                  <button key={`mob-sr-cust-${customer}`} onClick={() => { setSelectedCustomer(customer); setCustomerDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-[#FAF6EC] transition-colors cursor-pointer ${selectedCustomer === customer ? "text-[#B8943C] bg-[#FAF6EC]" : "text-[#1F2937]"}`} style={{ fontSize: "0.85rem" }}>
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

      {/* ── Daily Revenue Chart ── */}
      {dailySalesData.length > 0 && (
        <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-4 sm:p-6 overflow-hidden">
          <h4 className="text-[#1F2937] mb-4">နေ့စဉ် အရောင်းအခြေအနေ</h4>
          <div style={{ width: "100%", height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
              <LineChart data={dailySalesData} margin={isMobile ? { top: 20, right: 15, left: -10, bottom: 5 } : { top: 25, right: 30, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.6} />
                <XAxis dataKey="fullDate" stroke="#9CA3AF" tickLine={false} axisLine={{ stroke: "#E5E7EB" }} style={{ fontSize: isMobile ? "0.65rem" : "0.75rem" }} interval={isMobile ? "preserveStartEnd" : 0} tickFormatter={(v: string) => { const d = new Date(v); return isNaN(d.getTime()) ? v : `${d.getMonth() + 1}/${d.getDate()}`; }} />
                <YAxis stroke="#9CA3AF" tickLine={false} axisLine={{ stroke: "#E5E7EB" }} width={isMobile ? 50 : 65} style={{ fontSize: isMobile ? "0.65rem" : "0.75rem" }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${formatNumber(Number(v))} Ks`, "ရောင်းရငွေ"]} />
                <Line key="sales-amount" type="monotone" dataKey="amount" name="ရောင်းရငွေ" stroke="#D6B25E" strokeWidth={2.5} dot={{ fill: "#D6B25E", r: isMobile ? 2 : 3 }} activeDot={{ r: isMobile ? 5 : 7, stroke: "#D6B25E", strokeWidth: 2, fill: "#fff" }} label={isMobile ? undefined : { position: "top", fill: "#6B7280", fontSize: 11, offset: 10, formatter: (v: number) => v > 0 ? formatNumber(v) : "" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Top Customers Chart ── */}
      {topCustomersData.length > 0 && (() => {
        const barH = Math.max(isMobile ? 180 : 200, topCustomersData.length * (isMobile ? 36 : 40) + 60);
        return (
          <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-4 sm:p-6 overflow-hidden">
            <h4 className="text-[#1F2937] mb-4">အရောင်းအများဆုံး ဝယ်ယူသူများ</h4>
            <div style={{ width: "100%", height: barH }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                <BarChart data={topCustomersData} layout="vertical" barCategoryGap="30%" margin={isMobile ? { top: 5, right: 80, left: 0, bottom: 5 } : { top: 5, right: 90, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.6} horizontal={false} />
                  <XAxis type="number" stroke="#9CA3AF" tickLine={false} axisLine={{ stroke: "#E5E7EB" }} style={{ fontSize: isMobile ? "0.65rem" : "0.75rem" }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                  <YAxis dataKey="name" type="category" allowDuplicatedCategory={false} stroke="#9CA3AF" tickLine={false} axisLine={{ stroke: "#E5E7EB" }} width={isMobile ? 60 : 80} style={{ fontSize: isMobile ? "0.7rem" : "0.8rem" }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${formatNumber(Number(v))} Ks`, "စုစုပေါင်း"]} />
                  <Bar key="cust-bar-total" dataKey="total" fill="#D6B25E" radius={[0, 6, 6, 0]} maxBarSize={isMobile ? 22 : 28}>
                    <LabelList dataKey="total" position="right" content={({ x, y, width, height, value }: any) => { if (!value || value <= 0) return null; return (<text x={(x || 0) + (width || 0) + 8} y={(y || 0) + (height || 0) / 2} fill="#6B7280" fontSize={isMobile ? 10 : 12} textAnchor="start" dominantBaseline="middle">{`${formatNumber(Number(value))} Ks`}</text>); }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })()}

      {/* ── Daily Summary Table ── */}
      {dailySalesData.length > 0 && (
        <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3 sm:p-7 overflow-hidden max-w-full">
          <h4 className="text-[#1F2937] mb-3 sm:mb-5">နေ့စဉ် ရောင်းရငွေအချုပ်</h4>
          <div className="overflow-auto w-full" style={{ maxHeight: "480px", WebkitOverflowScrolling: "touch" as any }}>
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-[2]">
                <tr className="bg-white">
                  <th className="text-left py-3 px-3 text-[#6B7280] border-b-2 border-[#E5E7EB]" style={{ fontSize: "0.8rem" }}>ရက်စွဲ</th>
                  <th className="text-right py-3 px-3 text-[#6B7280] border-b-2 border-[#E5E7EB]" style={{ fontSize: "0.8rem" }}>ရောင်းရငွေ (Ks)</th>
                </tr>
              </thead>
              <tbody>
                {dailySalesData.map((d, idx) => (
                  <tr key={d.fullDate || idx} className="border-b border-[#E5E7EB]/60 hover:bg-[#FAF6EC] transition-colors">
                    <td className="py-3 px-3 text-[#1F2937]" style={{ fontSize: "0.85rem" }}>{d.fullDate}</td>
                    <td className="py-3 px-3 text-right text-[#1F2937]" style={{ fontSize: "0.85rem" }}>{formatNumber(d.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 z-[2]">
                <tr className="bg-[#FAF6EC] border-t-2 border-[#D6B25E]/40">
                  <td className="py-3 px-3 text-[#1F2937] font-semibold" style={{ fontSize: "0.8rem" }}>စုစုပေါင်း</td>
                  <td className="py-3 px-3 text-right text-[#D6B25E] font-bold" style={{ fontSize: "0.85rem" }}>
                    {formatNumber(dailySalesData.reduce((s, d) => s + d.amount, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
