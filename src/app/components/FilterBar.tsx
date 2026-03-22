import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown, X, RotateCcw } from "lucide-react";

interface FilterBarProps {
  selectedRange: string;
  onRangeChange: (range: string) => void;
  selectedItem: string;
  onItemChange: (item: string) => void;
  onApply: () => void;
  onReset: () => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (d: string) => void;
  onDateToChange: (d: string) => void;
  /** Dynamic item names from the database */
  itemNames?: string[];
  /** Hide the "All Items" option from dropdown */
  hideAllItems?: boolean;
}

const QUICK_RANGES = [
  { value: "Today", label: "\u101a\u1014\u1031\u1037" },
  { value: "7 Days", label: "\u1047 \u101b\u1000\u103a" },
  { value: "14 Days", label: "\u1041\u1044 \u101b\u1000\u103a" },
  { value: "30 Days", label: "\u1043\u1040 \u101b\u1000\u103a" },
  { value: "This Month", label: "\u1024\u101c" },
  { value: "All", label: "\u1021\u102c\u1038\u101c\u102f\u1036\u1038" },
];
const ALL_ITEMS_LABEL = "ပစ္စည်းအမျိုးအစားများ";
const ALL_ITEMS_DROPDOWN_LABEL = "ပစ္စည်း အားလုံး";

export function FilterBar({
  selectedRange,
  onRangeChange,
  selectedItem,
  onItemChange,
  onApply,
  onReset,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  itemNames,
  hideAllItems,
}: FilterBarProps) {
  const ITEMS = hideAllItems ? (itemNames || []) : [ALL_ITEMS_LABEL, ...(itemNames || [])];
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const mobileDropRef = useRef<HTMLDivElement>(null);
  const desktopDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        mobileDropRef.current?.contains(target) ||
        desktopDropRef.current?.contains(target)
      ) {
        return;
      }
      setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3 sm:p-4">
      <div className="flex flex-col gap-3">

        {/* ── Mobile layout: vertical stack ── */}
        <div className="flex flex-col sm:hidden gap-3">
          {/* Start Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
              စတင်ရက်
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
                style={{ fontSize: "0.85rem" }}
              />
            </div>
          </div>

          {/* End Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
              ပြီးဆုံးရက်
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
                style={{ fontSize: "0.85rem" }}
              />
            </div>
          </div>

          {/* Item Dropdown */}
          <div className="flex flex-col gap-1.5 relative" ref={mobileDropRef}>
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
              ပစ္စည်းအမျိုးအစား
            </label>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center justify-between px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] hover:border-[#D6B25E]/50 transition-all cursor-pointer w-full"
              style={{ fontSize: "0.85rem" }}
            >
              <span>{selectedItem}</span>
              <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
            </button>
            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-lg z-20 py-1 max-h-64 overflow-auto">
                {ITEMS.map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      onItemChange(item);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-[#FAF6EC] transition-colors cursor-pointer ${
                      selectedItem === item
                        ? "text-[#B8943C] bg-[#FAF6EC]"
                        : "text-[#1F2937]"
                    }`}
                    style={{ fontSize: "0.85rem" }}
                  >
                    {item === ALL_ITEMS_LABEL ? ALL_ITEMS_DROPDOWN_LABEL : item}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Apply Button — full width, 44px */}
          <button
            onClick={onApply}
            className="w-full rounded-[10px] bg-[#D6B25E] hover:bg-[#B8943C] text-white transition-all cursor-pointer"
            style={{ fontSize: "0.85rem", height: "44px" }}
          >
            ကြည့်ရန်
          </button>

          {/* Reset Button — full width, secondary, mt-8px (gap-3 already gives ~12px, use mt-0) */}
          <button
            onClick={onReset}
            className="w-full flex items-center justify-center gap-1.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#1F2937] transition-all cursor-pointer"
            style={{ fontSize: "0.85rem", height: "44px" }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            ပြန်လည်သတ်မှတ်ရန်
          </button>
        </div>

        {/* ── Desktop layout: horizontal row ── */}
        <div className="hidden sm:flex sm:flex-row sm:flex-wrap sm:items-end gap-3">
          {/* Date pickers */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
              ရက်စွဲအပိုင်းအခြား
            </label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateFromChange(e.target.value)}
                  className="pl-9 pr-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
                  style={{ fontSize: "0.85rem" }}
                />
              </div>
              <span className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>
                မှ
              </span>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateToChange(e.target.value)}
                  className="pl-9 pr-3 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
                  style={{ fontSize: "0.85rem" }}
                />
              </div>
            </div>
          </div>

          {/* Item dropdown */}
          <div className="flex flex-col gap-1.5 relative" ref={desktopDropRef}>
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
              ပစ္စည်းအမျိုးအစား
            </label>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center justify-between gap-8 px-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] hover:border-[#D6B25E]/50 transition-all cursor-pointer min-w-[160px]"
              style={{ fontSize: "0.85rem" }}
            >
              <span>{selectedItem}</span>
              <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
            </button>
            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-lg z-20 py-1 max-h-64 overflow-auto">
                {ITEMS.map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      onItemChange(item);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-[#FAF6EC] transition-colors cursor-pointer ${
                      selectedItem === item
                        ? "text-[#B8943C] bg-[#FAF6EC]"
                        : "text-[#1F2937]"
                    }`}
                    style={{ fontSize: "0.85rem" }}
                  >
                    {item === ALL_ITEMS_LABEL ? ALL_ITEMS_DROPDOWN_LABEL : item}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-end gap-2 ml-auto">
            <button
              onClick={onApply}
              className="px-5 py-2 rounded-[10px] bg-[#D6B25E] hover:bg-[#B8943C] text-white transition-all cursor-pointer"
              style={{ fontSize: "0.85rem" }}
            >
              ကြည့်ရန်
            </button>
            <button
              onClick={onReset}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#1F2937] transition-all cursor-pointer"
              style={{ fontSize: "0.85rem" }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              ပြန်လည်သတ်မှတ်ရန်
            </button>
          </div>
        </div>

        {/* Row 2: Quick range chips — wraps to multi-line, 32px height */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="text-[#9CA3AF] mr-1" style={{ fontSize: "0.75rem" }}>အမြန်ရွေးရန်:</span>
          {QUICK_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => onRangeChange(r.value)}
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
          {selectedItem !== ALL_ITEMS_LABEL && (
            <span
              className="ml-1 inline-flex items-center gap-1 bg-[#FAF6EC] text-[#B8943C] border border-[#D6B25E]/30 px-3 rounded-full"
              style={{ fontSize: "0.8rem", height: "32px" }}
            >
              {selectedItem}
              <button onClick={() => onItemChange(ALL_ITEMS_LABEL)} className="cursor-pointer hover:text-[#DC2626] transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}