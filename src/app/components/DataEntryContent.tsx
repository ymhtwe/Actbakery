import { useState, useRef, useEffect, useCallback } from "react";
import {
  ScanBarcode,
  Plus,
  Minus,
  Check,
  Trash2,
  ChevronDown,
  X,
  Package,
  CalendarDays,
  ShoppingCart,
  Search,
  UserPlus,
  AlertTriangle,
  Loader2,
  Info,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import * as db from "./db";

// ── Types ──
interface CatalogItem {
  id: string;
  name: string;
  low_stock_threshold: number;
  is_active?: boolean;
}

interface StockItem {
  id: string;
  name: string;
  currentStock: number;
  todayProduced: number;
  lowStockThreshold: number;
}

interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
}

interface EntryItem {
  id: string;
  itemId: string;
  name: string;
  quantity: number;
}

interface SaleEntryItem {
  id: string;
  itemId: string;
  name: string;
  quantity: number;
}

interface DataEntryProps {
  role?: "admin" | "staff";
  onNavigate?: (tab: string, subTab?: string) => void;
}

export function DataEntryContent({ role = "staff", onNavigate }: DataEntryProps) {
  const [activeMode, setActiveMode] = useState<"entry" | "sale">("entry");
  const [showStaffItemModal, setShowStaffItemModal] = useState(false);

  // ── Data from API ──
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const barcodeMap = useRef<Record<string, { id: string; name: string }>>({});

  // ═══════════════════════════════════
  //  ENTRY TAB STATE
  // ═══════════════════════════════════
  const barcodeRef = useRef<HTMLInputElement>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [entryItems, setEntryItems] = useState<EntryItem[]>([]);
  const [manualItem, setManualItem] = useState("");
  const [manualQtyStr, setManualQtyStr] = useState("1");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [productionDate, setProductionDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [entryDateModified, setEntryDateModified] = useState(false);
  const [showEntryDateConfirm, setShowEntryDateConfirm] = useState(false);
  const [pendingEntryAction, setPendingEntryAction] = useState<"add" | "submit" | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // ═══════════════════════════════════
  //  SALE TAB STATE
  // ═══════════════════════════════════
  // Multi-item sale support
  const [saleItems, setSaleItems] = useState<SaleEntryItem[]>([]);
  const [saleItemPick, setSaleItemPick] = useState(""); // currently picked item name
  const [saleItemPickId, setSaleItemPickId] = useState(""); // item uuid
  const [saleItemDropOpen, setSaleItemDropOpen] = useState(false);
  const saleItemDropRef = useRef<HTMLDivElement>(null);

  const [saleQtyStr, setSaleQtyStr] = useState("1");

  const [saleCustomer, setSaleCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropOpen, setCustomerDropOpen] = useState(false);
  const customerDropRef = useRef<HTMLDivElement>(null);

  const [saleSubmitted, setSaleSubmitted] = useState(false);
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  const [saleError, setSaleError] = useState("");
  const [saleDate, setSaleDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [saleDateModified, setSaleDateModified] = useState(false);
  const [showSaleDateConfirm, setShowSaleDateConfirm] = useState(false);
  const saleDateInputRef = useRef<HTMLInputElement>(null);

  // ── New Customer Modal ──
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");
  const [newCustSaving, setNewCustSaving] = useState(false);
  const [newCustError, setNewCustError] = useState("");
  const [newCustSuccess, setNewCustSuccess] = useState(false);

  // ═══════════════════════════════════
  //  LOAD DATA FROM API
  // ═══════════════════════════════════
  const loadData = useCallback(async () => {
    try {
      setDataLoading(true);

      const [items, stock, custs] = await Promise.all([
        db.getItems(),
        db.getStockWithToday(),
        db.getCustomers(),
      ]);
      const activeItems = items.filter((i: CatalogItem) => i.is_active !== false);
      setCatalogItems(activeItems);
      setStockData(stock);
      setCustomers(custs);

      const map: Record<string, { id: string; name: string }> = {};
      activeItems.forEach((item: CatalogItem, idx: number) => {
        map[`490123456789${idx}`] = { id: item.id, name: item.name };
      });
      barcodeMap.current = map;
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ═══════════════════════════════════
  //  SHARED HELPERS
  // ═══════════════════════════════════
  const formatDisplayDate = useCallback((dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = d.getTime() === today.getTime();
    const formatted = d.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    return isToday ? `${formatted} (Today)` : formatted;
  }, []);

  // ═══════════════════════════════════
  //  ENTRY TAB LOGIC
  // ═══════════════════════════════════
  useEffect(() => {
    if (activeMode === "entry") barcodeRef.current?.focus();
  }, [activeMode]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropdownOpen(false);
      if (saleItemDropRef.current && !saleItemDropRef.current.contains(e.target as Node)) setSaleItemDropOpen(false);
      if (customerDropRef.current && !customerDropRef.current.contains(e.target as Node)) setCustomerDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleScan = () => {
    if (!barcodeInput.trim()) return;
    const item = barcodeMap.current[barcodeInput.trim()];
    if (item) {
      addOrMergeItem(item.name, 1);
      setBarcodeInput("");
      barcodeRef.current?.focus();
    } else {
      alert(`Unknown barcode: ${barcodeInput.trim()}`);
      setBarcodeInput("");
      barcodeRef.current?.focus();
    }
  };

  const tryManualAdd = () => {
    if (!manualItem) return;
    if (!entryDateModified) {
      setPendingEntryAction("add");
      setShowEntryDateConfirm(true);
      return;
    }
    doManualAdd();
  };

  const doManualAdd = () => {
    if (!manualItem) return;
    const qty = parseInt(manualQtyStr, 10);
    if (isNaN(qty) || qty < 1) {
      alert("Invalid quantity");
      return;
    }
    addOrMergeItem(manualItem, qty);
    setManualItem("");
    setManualQtyStr("1");
  };

  const addOrMergeItem = (name: string, qty: number) => {
    const catalogItem = catalogItems.find((c) => c.name === name);
    const itemId = catalogItem?.id || "";
    setEntryItems((prev) => {
      const existing = prev.find((i) => i.name === name);
      if (existing) {
        return prev.map((i) => i.name === name ? { ...i, quantity: i.quantity + qty } : i);
      }
      return [...prev, { id: Date.now().toString(), itemId, name, quantity: qty }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setEntryItems((prev) =>
      prev.map((item) => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item)
    );
  };

  const removeItem = (id: string) => {
    setEntryItems((prev) => prev.filter((item) => item.id !== id));
  };

  const totalQuantity = entryItems.reduce((sum, i) => sum + i.quantity, 0);

  const trySubmit = () => {
    if (entryItems.length === 0 || submitting) return;
    if (!entryDateModified) {
      setPendingEntryAction("submit");
      setShowEntryDateConfirm(true);
      return;
    }
    doSubmit();
  };

  const doSubmit = async () => {
    if (entryItems.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const entries = entryItems.map((item) => ({
        item_id: item.itemId,
        quantity: item.quantity,
      }));
      await db.createProductionLogs(entries, productionDate);
      setSubmitted(true);
      const newStock = await db.getStockWithToday();
      setStockData(newStock);
      setTimeout(() => {
        setEntryItems([]);
        setSubmitted(false);
      }, 1800);
    } catch (e: any) {
      console.error("Submit production error:", e);
      alert(`Error: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEntryDateConfirm = () => {
    setShowEntryDateConfirm(false);
    setEntryDateModified(true);
    if (pendingEntryAction === "add") doManualAdd();
    else if (pendingEntryAction === "submit") doSubmit();
    setPendingEntryAction(null);
  };

  const handleEntryDateChange = () => {
    setShowEntryDateConfirm(false);
    setPendingEntryAction(null);
    // Focus the hidden date input
    dateInputRef.current?.click();
    dateInputRef.current?.focus();
  };

  const handleClearAll = () => {
    setEntryItems([]);
  };

  // ═══════════════════════════════════
  //  SALE TAB LOGIC
  // ═══════════════════════════════════
  const getStockForItem = (itemName: string) => {
    const s = stockData.find((s) => s.name === itemName);
    return s?.currentStock ?? 0;
  };

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // Add item to sale list
  const handleAddSaleItem = () => {
    if (!saleItemPickId || !saleItemPick) return;
    const qty = parseInt(saleQtyStr, 10);
    if (isNaN(qty) || qty < 1) {
      setSaleError("အရေအတွက် မှန်ကန်စွာ ထည့်ပါ။");
      return;
    }

    // Check stock
    const stock = getStockForItem(saleItemPick);
    // Sum already-added qty for same item
    const existingQty = saleItems.filter((si) => si.itemId === saleItemPickId).reduce((s, i) => s + i.quantity, 0);
    if (existingQty + qty > stock) {
      const msg = `ရောင်းချရန် ပစ္စည်း လက်ကျန်မလုံလောက်ပါ။ ${saleItemPick} အတွက် ${stock} ခုသာ ကျန်ရှိပါတော့သည်`;
      setSaleError(msg);
      toast.warning(msg);
      return;
    }

    setSaleError("");
    setSaleItems((prev) => {
      const existing = prev.find((i) => i.itemId === saleItemPickId);
      if (existing) {
        return prev.map((i) => i.itemId === saleItemPickId ? { ...i, quantity: i.quantity + qty } : i);
      }
      return [...prev, { id: Date.now().toString(), itemId: saleItemPickId, name: saleItemPick, quantity: qty }];
    });
    setSaleItemPick("");
    setSaleItemPickId("");
    setSaleQtyStr("1");
  };

  const removeSaleItem = (id: string) => {
    setSaleItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateSaleItemQty = (id: string, delta: number) => {
    setSaleItems((prev) =>
      prev.map((item) => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item)
    );
  };

  const trySaleSubmit = () => {
    if (saleItems.length === 0 || !saleCustomer || saleSubmitting) return;
    if (!saleDateModified) {
      setShowSaleDateConfirm(true);
      return;
    }
    doSaleSubmit();
  };

  const doSaleSubmit = async () => {
    if (saleItems.length === 0 || !saleCustomer || saleSubmitting) return;
    setSaleError("");
    setSaleSubmitting(true);
    try {
      // Stock validation for each item
      for (const si of saleItems) {
        const liveStock = await db.getItemStock(si.itemId);
        if (liveStock < si.quantity) {
          const msg = `ရောင်းချရန် ပစ္စည်း လက်ကျန်မလုံလောက်ပါ။ ${si.name} အတွက် ${liveStock} ခုသာ ကျန်ရှိပါတော့သည်`;
          setSaleError(msg);
          toast.warning(msg);
          const newStock = await db.getStockWithToday();
          setStockData(newStock);
          setSaleSubmitting(false);
          return;
        }
      }

      // Create a sale log for each item
      for (const si of saleItems) {
        await db.createSalesLog(si.itemId, si.quantity, saleCustomer.id, undefined, saleDate);
      }

      setSaleSubmitted(true);
      const newStock = await db.getStockWithToday();
      setStockData(newStock);
      setTimeout(() => {
        setSaleItems([]);
        setSaleItemPick("");
        setSaleItemPickId("");
        setSaleCustomer(null);
        setCustomerSearch("");
        setSaleQtyStr("1");
        { const now = new Date(); setSaleDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`); }
        setSaleDateModified(false);
        setSaleSubmitted(false);
      }, 1800);
    } catch (e: any) {
      console.error("Submit sale error:", e);
      setSaleError(e.message || "Error submitting sale");
    } finally {
      setSaleSubmitting(false);
    }
  };

  const handleSaleDateConfirm = () => {
    setShowSaleDateConfirm(false);
    setSaleDateModified(true);
    doSaleSubmit();
  };

  const handleSaleDateChange = () => {
    setShowSaleDateConfirm(false);
    saleDateInputRef.current?.click();
    saleDateInputRef.current?.focus();
  };

  const handleSaleCancel = () => {
    setSaleItems([]);
    setSaleItemPick("");
    setSaleItemPickId("");
    setSaleCustomer(null);
    setCustomerSearch("");
    setSaleQtyStr("1");
    setSaleError("");
  };

  const handleSaveNewCustomer = async () => {
    if (!newCustName.trim()) return;
    setNewCustSaving(true);
    setNewCustError("");
    setNewCustSuccess(false);
    try {
      const newC = await db.createCustomer(
        newCustName.trim(),
        newCustPhone.trim() || undefined,
        newCustAddress.trim() || undefined
      );
      setCustomers((prev) => [...prev, newC]);
      setSaleCustomer(newC);
      setCustomerSearch(newC.name);
      setShowNewCustomer(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustAddress("");
      setNewCustSuccess(true);
    } catch (e: any) {
      console.error("Create customer error:", e);
      setNewCustError(e.message || "Error creating customer");
    } finally {
      setNewCustSaving(false);
    }
  };

  useEffect(() => {
    if (newCustSuccess) {
      const timer = setTimeout(() => setNewCustSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [newCustSuccess]);

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#D6B25E]" />
        <span className="ml-2 text-[#9CA3AF]">Loading data...</span>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-2xl space-y-5">
        {/* ═══ Tabs: Entry | Sale ═══ */}
        <div className="flex gap-1 bg-white rounded-[12px] border border-[#E5E7EB] p-1 w-full sm:w-fit overflow-hidden">
          {[
            { id: "entry" as const, label: "ထည့်သွင်းခြင်း" },
            { id: "sale" as const, label: "ရောင်းချခြင်း" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveMode(t.id)}
              className={`flex-1 sm:flex-none px-3 sm:px-5 rounded-[10px] transition-all cursor-pointer truncate ${
                activeMode === t.id
                  ? "bg-[#FAF6EC] text-[#B8943C] border border-[#D6B25E]/30"
                  : "text-[#6B7280] hover:text-[#1F2937] border border-transparent"
              }`}
              style={{ fontSize: "0.85rem", height: "40px" }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/*  ENTRY TAB                                     */}
        {/* ═══════════════════════════════════════════════ */}
        {activeMode === "entry" && (
          <>
            {/* ══ Production Date ═══ */}
            <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 sm:p-7">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays className="w-5 h-5 text-[#D6B25E]" />
                <h3 className="text-[#1F2937]">ထုတ်လုပ်သည့် ရက်စွဲ</h3>
              </div>
              <div>
                <label className="block text-[#6B7280] mb-1.5" style={{ fontSize: "0.75rem" }}>
                  ဤထုတ်လုပ်မှုအတွက် ရက်စွဲ ရွေးချယ်ပါ
                </label>
                <div className="relative">
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={productionDate}
                    max={(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; })()}
                    onChange={(e) => {
                      if (e.target.value) {
                        setProductionDate(e.target.value);
                        setEntryDateModified(true);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ zIndex: 1 }}
                  />
                  <div
                    className="w-full flex items-center justify-between px-4 py-3.5 sm:py-3 rounded-[12px] border border-[#E5E7EB] bg-white text-[#1F2937] pointer-events-none"
                    style={{ fontSize: "0.9rem", minHeight: "48px" }}
                  >
                    <span>{formatDisplayDate(productionDate)}</span>
                    <CalendarDays className="w-4.5 h-4.5 text-[#9CA3AF] shrink-0" />
                  </div>
                </div>
                {productionDate !== (() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; })() && (
                  <p className="text-amber-600 mt-2 flex items-center gap-1.5" style={{ fontSize: "0.75rem" }}>
                    <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                    ယနေ့ မဟုတ်သော ရက်စွဲအတွက် မှတ်တမ်းတင်နေပါသည်
                  </p>
                )}
              </div>
            </div>

            {/* ═══ Section 1: Manual Entry ═══ */}
            <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 sm:p-7">
              <h4 className="text-[#1F2937] mb-5">လက်ဖြင့် ထည့်သွင်းခြင်း</h4>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative" ref={dropRef}>
                  <label className="block text-[#6B7280] mb-1.5" style={{ fontSize: "0.75rem" }}>
                    ပစ္စည်း ရွေးချယ်ရန်
                  </label>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-[12px] border border-[#E5E7EB] bg-white text-left hover:border-[#D6B25E]/50 transition-all cursor-pointer"
                    style={{ fontSize: "0.9rem" }}
                  >
                    <span className={manualItem ? "text-[#1F2937]" : "text-[#9CA3AF]"}>
                      {manualItem || "ပစ္စည်း ရွေးချယ်ပါ..."}
                    </span>
                    <ChevronDown className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                  </button>
                  {dropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-lg z-30 py-1 max-h-56 overflow-auto">
                      {catalogItems.length === 0 ? (
                        <div className="px-5 py-7 text-center">
                          <Package className="w-9 h-9 text-[#D6B25E]/40 mx-auto mb-3" />
                          <p className="text-[#1F2937] font-medium mb-1" style={{ fontSize: "0.9rem" }}>ပစ္စည်း မရှိသေးပါ</p>
                          <p className="text-[#9CA3AF] mb-4" style={{ fontSize: "0.75rem" }}>Admin မှ ပစ္စည်းများ မထည့်သေးပါ။</p>
                          <button
                            onClick={() => {
                              setDropdownOpen(false);
                              if (role === "admin") {
                                toast.info("Items settings သို့ ပြောင်းလဲနေသည်...");
                                onNavigate?.("settings", "items");
                              } else {
                                setShowStaffItemModal(true);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] bg-[#D6B25E] text-white hover:bg-[#C4A24D] transition-all cursor-pointer shadow-sm"
                            style={{ fontSize: "0.8rem" }}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            ပစ္စည်းအသစ် ထည့်ရန်
                          </button>
                        </div>
                      ) : (
                        catalogItems.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setManualItem(p.name);
                              setDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 hover:bg-[#FAF6EC] transition-colors cursor-pointer ${
                              manualItem === p.name ? "text-[#B8943C] bg-[#FAF6EC]" : "text-[#1F2937]"
                            }`}
                            style={{ fontSize: "0.85rem" }}
                          >
                            {p.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="w-full sm:w-28">
                  <label className="block text-[#6B7280] mb-1.5" style={{ fontSize: "0.75rem" }}>
                    အရေအတွက်
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={manualQtyStr}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d+$/.test(v)) setManualQtyStr(v);
                    }}
                    className="w-full px-4 py-3 rounded-[12px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all text-center"
                    style={{ fontSize: "0.9rem" }}
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={tryManualAdd}
                    disabled={!manualItem}
                    className={`w-full sm:w-auto px-5 py-3 rounded-[12px] border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      manualItem
                        ? "border-[#D6B25E] bg-[#FAF6EC] text-[#B8943C] hover:bg-[#D6B25E] hover:text-white"
                        : "border-[#E5E7EB] bg-[#F7F6F3] text-[#9CA3AF] cursor-not-allowed"
                    }`}
                    style={{ fontSize: "0.85rem" }}
                  >
                    <Plus className="w-4 h-4" />
                    စာရင်းထဲ ထည့်ရန်
                  </button>
                </div>
              </div>

              {/* Items list */}
              {entryItems.length > 0 && (
                <div className="mt-6 border-t border-[#E5E7EB] pt-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="w-4 h-4 text-[#9CA3AF]" />
                    <span className="text-[#6B7280]" style={{ fontSize: "0.85rem" }}>
                      ပစ္စည်းများ ({entryItems.length})
                    </span>
                  </div>
                  <div className="space-y-0">
                    {entryItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 py-3 border-b border-[#E5E7EB]/60 last:border-b-0">
                        <span className="flex-1 text-[#1F2937] min-w-0 truncate" style={{ fontSize: "0.9rem" }}>
                          {item.name}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:bg-[#FAF6EC] hover:border-[#D6B25E]/40 transition-colors cursor-pointer active:scale-95">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-10 text-center text-[#1F2937]" style={{ fontSize: "1rem" }}>
                            {item.quantity}
                          </span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:bg-[#FAF6EC] hover:border-[#D6B25E]/40 transition-colors cursor-pointer active:scale-95">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button onClick={() => removeItem(item.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-[#9CA3AF] hover:bg-red-50 hover:text-[#DC2626] transition-colors cursor-pointer shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {entryItems.length === 0 && (
                <div className="mt-6 border-t border-[#E5E7EB] pt-8 pb-4 text-center">
                  <Package className="w-10 h-10 mx-auto mb-2 text-[#E5E7EB]" />
                  <p className="text-[#9CA3AF]" style={{ fontSize: "0.85rem" }}>
                    ပစ္စည်း မရှိသေးပါ။ အပေါ်တွင် ပစ္စည်း ရွေးချယ်ပါ သို့မဟုတ် အောက်တွင် ဘားကုဒ် စကန်လုပ်ပါ။
                  </p>
                </div>
              )}
            </div>

            {/* ═══ Section 2: Scan Mode ═══ */}
            <div className="bg-[#FAFAF8] rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-5 sm:p-7">
              <div className="flex items-center gap-2 mb-5">
                <ScanBarcode className="w-5 h-5 text-[#D6B25E]" />
                <h3 className="text-[#1F2937]">စကန် မုဒ်</h3>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  ref={barcodeRef}
                  type="text"
                  placeholder="ဘားကုဒ် စကန်လုပ်ပါ သို့မဟုတ် ထည့်သွင်းပါ..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleScan()}
                  className="flex-1 px-4 py-3 rounded-[12px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
                  style={{ fontSize: "1rem" }}
                />
                <button
                  onClick={handleScan}
                  className="w-full sm:w-auto px-6 py-3 bg-[#D6B25E] hover:bg-[#B8943C] text-white rounded-[12px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                  style={{ fontSize: "0.9rem" }}
                >
                  <ScanBarcode className="w-4 h-4" />
                  စကန်ပြီး ထည့်ရန်
                </button>
              </div>

              <p className="text-[#9CA3AF] mt-3" style={{ fontSize: "0.7rem" }}>
                ဥပမာ - 4901234567890 (ဖရုံ), 4901234567891 (ကိတ်စို), 4901234567892 (d/c ကြ) စသည်ဖြင့်
              </p>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/*  SALE TAB                                      */}
        {/* ═══════════════════════════════════════════════ */}
        {activeMode === "sale" && (
          <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 sm:p-7">
            <div className="flex items-center gap-2 mb-6">
              <ShoppingCart className="w-5 h-5 text-[#D6B25E]" />
              <h3 className="text-[#1F2937]">ရောင်းချမှု မှတ်တမ်း</h3>
            </div>

            <div className="space-y-5">
              {/* ── 1. Select Customer FIRST ── */}
              <div className="relative" ref={customerDropRef}>
                <label className="block text-[#6B7280] mb-1.5" style={{ fontSize: "0.75rem" }}>
                  ဖောက်သည် ရွေးချယ်ရန်
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                  <input
                    type="text"
                    placeholder="ဖောက်သည် ရှာရန်..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setCustomerDropOpen(true);
                      if (!e.target.value) setSaleCustomer(null);
                    }}
                    onFocus={() => setCustomerDropOpen(true)}
                    className="w-full pl-9 pr-4 py-3 rounded-[12px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
                    style={{ fontSize: "0.9rem" }}
                  />
                  {saleCustomer && (
                    <button
                      onClick={() => { setSaleCustomer(null); setCustomerSearch(""); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#DC2626] cursor-pointer transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {customerDropOpen && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-lg z-30 py-1 max-h-56 overflow-auto">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSaleCustomer(c);
                          setCustomerSearch(c.name);
                          setCustomerDropOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 hover:bg-[#FAF6EC] transition-colors cursor-pointer ${
                          saleCustomer?.id === c.id ? "text-[#B8943C] bg-[#FAF6EC]" : "text-[#1F2937]"
                        }`}
                        style={{ fontSize: "0.85rem" }}
                      >
                        <span>{c.name}</span>
                        {c.phone && (
                          <span className="text-[#9CA3AF] ml-2" style={{ fontSize: "0.75rem" }}>
                            {c.phone}
                          </span>
                        )}
                      </button>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <p className="px-4 py-2.5 text-[#9CA3AF]" style={{ fontSize: "0.85rem" }}>
                        ဖောက်သည် မတွေ့ပါ
                      </p>
                    )}
                    <button
                      onClick={() => {
                        setCustomerDropOpen(false);
                        setShowNewCustomer(true);
                        setNewCustError("");
                        setNewCustSuccess(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-[#FAF6EC] transition-colors cursor-pointer text-[#D6B25E] flex items-center gap-2 border-t border-[#E5E7EB]"
                      style={{ fontSize: "0.85rem" }}
                    >
                      <UserPlus className="w-4 h-4" />
                      + ဖောက်သည်အသစ် ထည့်ရန်
                    </button>
                  </div>
                )}
              </div>

              {/* ── 2. Select Item + Qty ── */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative" ref={saleItemDropRef}>
                  <label className="block text-[#6B7280] mb-1.5" style={{ fontSize: "0.75rem" }}>
                    ပစ္စည်း ရွေးချယ်ရန်
                  </label>
                  <button
                    onClick={() => setSaleItemDropOpen(!saleItemDropOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-[12px] border border-[#E5E7EB] bg-white text-left hover:border-[#D6B25E]/50 transition-all cursor-pointer"
                    style={{ fontSize: "0.9rem" }}
                  >
                    <span className={saleItemPick ? "text-[#1F2937]" : "text-[#9CA3AF]"}>
                      {saleItemPick || "ပစ္စည်း ရွေးပါ..."}
                    </span>
                    <ChevronDown className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                  </button>
                  {saleItemDropOpen && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-lg z-30 py-1 max-h-56 overflow-auto">
                      {catalogItems.length === 0 ? (
                        <div className="px-5 py-7 text-center">
                          <Package className="w-9 h-9 text-[#D6B25E]/40 mx-auto mb-3" />
                          <p className="text-[#1F2937] font-medium mb-1" style={{ fontSize: "0.9rem" }}>ပစ္စည်း မရှိသေးပါ</p>
                          <p className="text-[#9CA3AF] mb-4" style={{ fontSize: "0.75rem" }}>Admin မှ ပစ္စည်းများ မထည့်သေးပါ။</p>
                          <button
                            onClick={() => {
                              setSaleItemDropOpen(false);
                              if (role === "admin") {
                                toast.info("Items settings သို့ ပြောင်းလဲနေသည်...");
                                onNavigate?.("settings", "items");
                              } else {
                                setShowStaffItemModal(true);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] bg-[#D6B25E] text-white hover:bg-[#C4A24D] transition-all cursor-pointer shadow-sm"
                            style={{ fontSize: "0.8rem" }}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            ပစ္စည်းအသစ် ထည့်ရန်
                          </button>
                        </div>
                      ) : (
                        catalogItems.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setSaleItemPick(p.name);
                              setSaleItemPickId(p.id);
                              setSaleItemDropOpen(false);
                              setSaleError("");
                            }}
                            className={`w-full text-left px-4 py-2.5 hover:bg-[#FAF6EC] transition-colors cursor-pointer flex items-center justify-between ${
                              saleItemPick === p.name ? "text-[#B8943C] bg-[#FAF6EC]" : "text-[#1F2937]"
                            }`}
                            style={{ fontSize: "0.85rem" }}
                          >
                            <span>{p.name}</span>
                            <span className="text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>
                              လက်ကျန်: {getStockForItem(p.name)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {saleItemPick && (
                    <div className="mt-2 px-3.5 py-2.5 rounded-[10px] bg-[#FAFAF8] border border-[#E5E7EB]">
                      <div className="flex items-center justify-between" style={{ fontSize: "0.75rem" }}>
                        <span className="text-[#6B7280]">လက်ရှိ လက်ကျန်:</span>
                        <span className={getStockForItem(saleItemPick) <= 5 ? "text-amber-600" : "text-[#1F2937]"}>
                          {getStockForItem(saleItemPick)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="w-full sm:w-28">
                  <label className="block text-[#6B7280] mb-1.5" style={{ fontSize: "0.75rem" }}>
                    အရေအတွက်
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={saleQtyStr}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d+$/.test(v)) {
                        setSaleQtyStr(v);
                        setSaleError("");
                      }
                    }}
                    className="w-full px-4 py-3 rounded-[12px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all text-center"
                    style={{ fontSize: "0.9rem" }}
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleAddSaleItem}
                    disabled={!saleItemPickId}
                    className={`w-full sm:w-auto px-5 py-3 rounded-[12px] border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      saleItemPickId
                        ? "border-[#D6B25E] bg-[#FAF6EC] text-[#B8943C] hover:bg-[#D6B25E] hover:text-white"
                        : "border-[#E5E7EB] bg-[#F7F6F3] text-[#9CA3AF] cursor-not-allowed"
                    }`}
                    style={{ fontSize: "0.85rem" }}
                  >
                    <Plus className="w-4 h-4" />
                    စာရင်းထဲ ထည့်ရန်
                  </button>
                </div>
              </div>

              {/* ── Sale Items List ── */}
              {saleItems.length > 0 && (
                <div className="border-t border-[#E5E7EB] pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="w-4 h-4 text-[#9CA3AF]" />
                    <span className="text-[#6B7280]" style={{ fontSize: "0.85rem" }}>
                      ရောင်းချမည့် ပစ္စည်းများ ({saleItems.length})
                    </span>
                  </div>
                  <div className="space-y-0">
                    {saleItems.map((item) => {
                      const stock = getStockForItem(item.name);
                      const remaining = stock - item.quantity;
                      const isLow = remaining >= 0 && remaining <= (stockData.find((s) => s.name === item.name)?.lowStockThreshold ?? 5);
                      return (
                        <div key={item.id} className="flex items-center gap-3 py-3 border-b border-[#E5E7EB]/60 last:border-b-0">
                          <div className="flex-1 min-w-0">
                            <span className="text-[#1F2937] truncate block" style={{ fontSize: "0.9rem" }}>
                              {item.name}
                            </span>
                            <span className="text-[#9CA3AF]" style={{ fontSize: "0.7rem" }}>
                              လက်ကျန်: {stock} → {remaining}
                              {isLow && <span className="text-amber-600 ml-1">(လက်ကျန်နည်း)</span>}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={() => updateSaleItemQty(item.id, -1)} className="w-8 h-8 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:bg-[#FAF6EC] hover:border-[#D6B25E]/40 transition-colors cursor-pointer active:scale-95">
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-10 text-center text-[#1F2937]" style={{ fontSize: "1rem" }}>
                              {item.quantity}
                            </span>
                            <button onClick={() => updateSaleItemQty(item.id, 1)} className="w-8 h-8 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:bg-[#FAF6EC] hover:border-[#D6B25E]/40 transition-colors cursor-pointer active:scale-95">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button onClick={() => removeSaleItem(item.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-[#9CA3AF] hover:bg-red-50 hover:text-[#DC2626] transition-colors cursor-pointer shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {saleItems.length === 0 && (
                <div className="border-t border-[#E5E7EB] pt-8 pb-4 text-center">
                  <Package className="w-10 h-10 mx-auto mb-2 text-[#E5E7EB]" />
                  <p className="text-[#9CA3AF]" style={{ fontSize: "0.85rem" }}>
                    ဖောက်သည် ရွေးချယ်ပြီး ပစ္စည်းများ ထည့်သွင်းပါ။
                  </p>
                </div>
              )}

              {/* ── Sale Date ── */}
              <div>
                <label className="block text-[#6B7280] mb-1.5" style={{ fontSize: "0.75rem" }}>
                  ရောင်းချသည့် ရက်စွဲ
                </label>
                <div className="relative">
                  <input
                    ref={saleDateInputRef}
                    type="date"
                    value={saleDate}
                    max={(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; })()}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSaleDate(e.target.value);
                        setSaleDateModified(true);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ zIndex: 1 }}
                  />
                  <div
                    className="w-full flex items-center justify-between px-4 py-3.5 sm:py-3 rounded-[12px] border border-[#E5E7EB] bg-white text-[#1F2937] hover:border-[#D6B25E]/50 transition-all pointer-events-none"
                    style={{ fontSize: "0.9rem", minHeight: "48px" }}
                  >
                    <span>{formatDisplayDate(saleDate)}</span>
                    <CalendarDays className="w-4.5 h-4.5 text-[#9CA3AF] shrink-0" />
                  </div>
                </div>
                {saleDate !== (() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; })() && (
                  <p className="text-amber-600 mt-2 flex items-center gap-1.5" style={{ fontSize: "0.75rem" }}>
                    <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                    ယနေ့ မဟုတ်သော ရက်စွဲအတွက် မှတ်တမ်းတင်နေပါသည်
                  </p>
                )}
              </div>

              {/* Error */}
              {saleError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-[12px] bg-red-50 border border-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-red-600" style={{ fontSize: "0.8rem" }}>{saleError}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={trySaleSubmit}
                  disabled={saleItems.length === 0 || !saleCustomer || saleSubmitted || saleSubmitting}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-[12px] transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.08)] ${
                    saleSubmitted
                      ? "bg-green-500 text-white"
                      : saleItems.length === 0 || !saleCustomer || saleSubmitting
                      ? "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed shadow-none"
                      : "bg-[#D6B25E] hover:bg-[#B8943C] text-white"
                  }`}
                  style={{ fontSize: "0.9rem" }}
                >
                  {saleSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      လုပ်ဆောင်နေသည်...
                    </>
                  ) : saleSubmitted ? (
                    <>
                      <Check className="w-4 h-4" />
                      မှတ်တမ်းတင်ပြီး!
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      ရောင်းချမှု တင်သွင်းရန်
                    </>
                  )}
                </button>
                <button
                  onClick={handleSaleCancel}
                  className="flex-1 sm:flex-none px-6 py-3 rounded-[12px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#1F2937] transition-all cursor-pointer"
                  style={{ fontSize: "0.9rem" }}
                >
                  မလုပ်တော့ပါ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Bottom Sticky Panel (Entry tab only) ═══ */}
      {activeMode === "entry" && entryItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] shadow-[0_-4px_12px_rgba(0,0,0,0.06)] z-20">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="bg-[#FAF6EC] border border-[#D6B25E]/20 rounded-[10px] px-4 py-2.5 flex items-center gap-2">
                <span className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>စုစုပေါင်း:</span>
                <span className="text-[#B8943C]" style={{ fontSize: "1.25rem" }}>{totalQuantity}</span>
                <span className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>ခု</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>
                  ပစ္စည်း {entryItems.length} မျိုး
                </span>
                <span className="text-[#9CA3AF] flex items-center gap-1" style={{ fontSize: "0.7rem" }}>
                  <CalendarDays className="w-3 h-3" />
                  {formatDisplayDate(productionDate)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
              <button
                onClick={handleClearAll}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-red-50 hover:text-[#DC2626] hover:border-red-200 transition-all cursor-pointer"
                style={{ fontSize: "0.85rem" }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">အားလုံး ဖျက်ရန်</span>
                <span className="sm:hidden">ဖျက်ရန်</span>
              </button>
              <button
                onClick={trySubmit}
                disabled={submitted || submitting}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-[10px] transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.08)] ${
                  submitted
                    ? "bg-green-500 text-white"
                    : submitting
                    ? "bg-[#D6B25E]/60 text-white cursor-not-allowed"
                    : "bg-[#D6B25E] hover:bg-[#B8943C] text-white"
                }`}
                style={{ fontSize: "0.85rem" }}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {submitted ? "တင်သွင်းပြီး!" : submitting ? "လုပ်ဆောင်နေသည်..." : "တင်သွင်းရန်"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Entry Date Confirmation Card ═══ */}
      {showEntryDateConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4" onClick={() => setShowEntryDateConfirm(false)}>
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#FAF6EC] flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5 text-[#D6B25E]" />
              </div>
              <div>
                <h3 className="text-[#1F2937]" style={{ fontSize: "1rem" }}>ရက်စွဲ အတည်ပြုရန်</h3>
                <p className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>
                  ယနေ့ ရက်စွဲ အလိုအလျောက် ရွေးချယ်ထားပါသည်
                </p>
              </div>
            </div>

            <div className="bg-[#FAFAF8] rounded-[12px] border border-[#E5E7EB] px-4 py-3 mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#D6B25E] shrink-0" />
                <span className="text-[#1F2937]" style={{ fontSize: "0.9rem" }}>
                  {formatDisplayDate(productionDate)}
                </span>
              </div>
            </div>

            <p className="text-[#6B7280] mb-5" style={{ fontSize: "0.8rem" }}>
              ယနေ့ ရက်စွဲဖြင့် ဆက်လက်မှတ်တမ်းတင်မည်လား၊ သို့မဟုတ် ရက်စွဲ ပြောင်းလဲမည်လား?
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleEntryDateConfirm}
                className="w-full py-3 rounded-[12px] bg-[#D6B25E] text-white hover:bg-[#B8943C] transition-all cursor-pointer flex items-center justify-center gap-2"
                style={{ fontSize: "0.9rem" }}
              >
                <Check className="w-4 h-4" />
                ယနေ့ ရက်စွဲဖြင့် ဆက်လက်မည်
              </button>
              <button
                onClick={handleEntryDateChange}
                className="w-full py-3 rounded-[12px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#1F2937] transition-all cursor-pointer flex items-center justify-center gap-2"
                style={{ fontSize: "0.9rem" }}
              >
                <CalendarDays className="w-4 h-4" />
                ရက်စွဲ ပြောင်းလဲမည်
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Sale Date Confirmation Card ═══ */}
      {showSaleDateConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4" onClick={() => setShowSaleDateConfirm(false)}>
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#FAF6EC] flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5 text-[#D6B25E]" />
              </div>
              <div>
                <h3 className="text-[#1F2937]" style={{ fontSize: "1rem" }}>ရက်စွဲ အတည်ပြုရန်</h3>
                <p className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>
                  ယနေ့ ရက်စွဲ အလိုအလျောက် ရွေးချယ်ထားပါသည်
                </p>
              </div>
            </div>

            <div className="bg-[#FAFAF8] rounded-[12px] border border-[#E5E7EB] px-4 py-3 mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#D6B25E] shrink-0" />
                <span className="text-[#1F2937]" style={{ fontSize: "0.9rem" }}>
                  {formatDisplayDate(saleDate)}
                </span>
              </div>
            </div>

            <p className="text-[#6B7280] mb-5" style={{ fontSize: "0.8rem" }}>
              ယနေ့ ရက်စွဲဖြင့် ဆက်လက်မှတ်တမ်းတင်မည်လား၊ သို့မဟုတ် ရက်စွဲ ပြောင်းလဲမည်လား?
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleSaleDateConfirm}
                className="w-full py-3 rounded-[12px] bg-[#D6B25E] text-white hover:bg-[#B8943C] transition-all cursor-pointer flex items-center justify-center gap-2"
                style={{ fontSize: "0.9rem" }}
              >
                <Check className="w-4 h-4" />
                ယနေ့ ရက်စွဲဖြင့် ဆက်လက်မည်
              </button>
              <button
                onClick={handleSaleDateChange}
                className="w-full py-3 rounded-[12px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#1F2937] transition-all cursor-pointer flex items-center justify-center gap-2"
                style={{ fontSize: "0.9rem" }}
              >
                <CalendarDays className="w-4 h-4" />
                ရက်စွဲ ပြောင်းလဲမည်
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast overlay (Entry) */}
      {submitted && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white border border-green-200 shadow-xl rounded-2xl px-8 py-6 text-center pointer-events-auto animate-bounce">
            <div className="w-14 h-14 rounded-full bg-green-50 border border-green-100 flex items-center justify-center mx-auto mb-3">
              <Check className="w-7 h-7 text-green-500" />
            </div>
            <p className="text-[#1F2937]" style={{ fontSize: "1rem" }}>တင်သွင်းပြီးပါပြီ!</p>
            <p className="text-[#9CA3AF] mt-1" style={{ fontSize: "0.8rem" }}>
              ပစ္စည်း {totalQuantity} ခု အောင်မြင်စွာ မှတ်တမ်းတင်ပြီးပါပြီ
            </p>
          </div>
        </div>
      )}

      {/* Success toast overlay (Sale) */}
      {saleSubmitted && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white border border-green-200 shadow-xl rounded-2xl px-8 py-6 text-center pointer-events-auto animate-bounce">
            <div className="w-14 h-14 rounded-full bg-green-50 border border-green-100 flex items-center justify-center mx-auto mb-3">
              <Check className="w-7 h-7 text-green-500" />
            </div>
            <p className="text-[#1F2937]" style={{ fontSize: "1rem" }}>ရောင်းချမှု မှတ်တမ်းတင်ပြီး!</p>
            <p className="text-[#9CA3AF] mt-1" style={{ fontSize: "0.8rem" }}>
              အောင်မြင်စွာ မှတ်တမ်းတင်ပြီးပါပြီ
            </p>
          </div>
        </div>
      )}

      {/* ══ Staff Item Permission Modal ═══ */}
      {showStaffItemModal && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4 animate-in fade-in duration-150"
          onClick={(e) => { if (e.target === e.currentTarget) setShowStaffItemModal(false); }}
          onKeyDown={(e) => { if (e.key === "Escape") setShowStaffItemModal(false); }}
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-2xl w-full max-w-sm p-6 sm:p-8 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldAlert className="w-5 h-5 text-[#D6B25E]" />
                </div>
                <div>
                  <h3 className="text-[#1F2937] font-semibold" style={{ fontSize: "1.05rem", lineHeight: "1.4" }}>ပစ္စည်းအသစ် ထည့်မရပါ</h3>
                  <span className="text-[#9CA3AF]" style={{ fontSize: "0.7rem" }}>(Staff Account)</span>
                </div>
              </div>
              <button
                onClick={() => setShowStaffItemModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#9CA3AF] hover:bg-[#F7F6F3] hover:text-[#1F2937] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5 mb-6">
              <p className="text-[#4B5563]" style={{ fontSize: "0.85rem", lineHeight: "1.6" }}>
                Staff အနေဖြင့် ပစ္စည်းအသစ်များကို ထည့်ခွင့်မရှိပါ။
              </p>
              <p className="text-[#4B5563]" style={{ fontSize: "0.85rem", lineHeight: "1.6" }}>
                Admin ကို ဆက်သွယ်ပြီး ပစ္စည်းထည့်သွင်းရန် တောင်းဆိုပါ။
              </p>
            </div>
            <button
              onClick={() => setShowStaffItemModal(false)}
              className="w-full py-2.5 rounded-[12px] bg-[#D6B25E] text-white hover:bg-[#C4A24D] transition-all cursor-pointer font-medium shadow-sm"
              style={{ fontSize: "0.85rem" }}
            >
              နားလည်ပါပြီ
            </button>
          </div>
        </div>
      )}

      {/* ══ New Customer Modal ═══ */}
      {showNewCustomer && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-2xl w-full max-w-md p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#D6B25E]" />
                <h3 className="text-[#1F2937]">ဖောက်သည် အသစ် ထည့်ရန်</h3>
              </div>
              <button
                onClick={() => { setShowNewCustomer(false); setNewCustName(""); setNewCustPhone(""); setNewCustAddress(""); }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#9CA3AF] hover:bg-[#F7F6F3] hover:text-[#1F2937] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[#6B7280] mb-1.5" style={{ fontSize: "0.75rem" }}>
                  ဖောက်သည် အမည် <span className="text-red-400">*</span>
                </label>
                <input type="text" placeholder="ဖောက်သည် အမည် ထည့်ပါ..." value={newCustName} onChange={(e) => setNewCustName(e.target.value)} className="w-full px-4 py-3 rounded-[12px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all" style={{ fontSize: "0.9rem" }} autoFocus />
              </div>
              <div>
                <label className="block text-[#6B7280] mb-1.5" style={{ fontSize: "0.75rem" }}>
                  ဖုန်းနံပါတ် <span className="text-[#9CA3AF]">(မလိုအပ်ပါ)</span>
                </label>
                <input type="tel" placeholder="ဥပမာ - 09-123456789" value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} className="w-full px-4 py-3 rounded-[12px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all" style={{ fontSize: "0.9rem" }} />
              </div>
              <div>
                <label className="block text-[#6B7280] mb-1.5" style={{ fontSize: "0.75rem" }}>
                  လိပ်စာ <span className="text-[#9CA3AF]">(မလိုအပ်ပါ)</span>
                </label>
                <input type="text" placeholder="ဥပမာ - ရန်ကုန်၊ မန္တလေး..." value={newCustAddress} onChange={(e) => setNewCustAddress(e.target.value)} className="w-full px-4 py-3 rounded-[12px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all" style={{ fontSize: "0.9rem" }} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                onClick={handleSaveNewCustomer}
                disabled={!newCustName.trim() || newCustSaving}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-[12px] transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.08)] ${
                  newCustName.trim() && !newCustSaving
                    ? "bg-[#D6B25E] hover:bg-[#B8943C] text-white"
                    : "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed shadow-none"
                }`}
                style={{ fontSize: "0.9rem" }}
              >
                {newCustSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {newCustSaving ? "Saving..." : "ဖောက်သည် သိမ်းဆည်းရန်"}
              </button>
              <button
                onClick={() => { setShowNewCustomer(false); setNewCustName(""); setNewCustPhone(""); setNewCustAddress(""); }}
                className="flex-1 px-6 py-3 rounded-[12px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#1F2937] transition-all cursor-pointer"
                style={{ fontSize: "0.9rem" }}
              >
                မလုပ်တော့ပါ
              </button>
            </div>

            {newCustError && (
              <p className="text-red-500 mt-3" style={{ fontSize: "0.8rem" }}>{newCustError}</p>
            )}
          </div>
        </div>
      )}

      {/* Success toast (New Customer) */}
      {newCustSuccess && !showNewCustomer && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white border border-green-200 shadow-xl rounded-2xl px-8 py-6 text-center pointer-events-auto animate-bounce">
            <div className="w-14 h-14 rounded-full bg-green-50 border border-green-100 flex items-center justify-center mx-auto mb-3">
              <UserPlus className="w-7 h-7 text-green-500" />
            </div>
            <p className="text-[#1F2937]" style={{ fontSize: "1rem" }}>ဖောက်သည် သိမ်းဆည်းပြီး!</p>
            <p className="text-[#9CA3AF] mt-1" style={{ fontSize: "0.8rem" }}>
              ဖောက်သည်အသစ် အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ
            </p>
          </div>
        </div>
      )}
    </>
  );
}
