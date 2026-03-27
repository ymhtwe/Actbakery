import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
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
  Printer,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import * as db from "./db";
import { ReceiptPrint } from "./ReceiptPrint";
import type { ReceiptLineItem } from "./ReceiptPrint";

// ── Types ──
interface CatalogItem {
  id: string;
  name: string;
  low_stock_threshold: number;
  is_active?: boolean;
  default_price?: number;
}

interface StockItem {
  id: string;
  name: string;
  currentStock: number;
  todayProduced: number;
  lowStockThreshold: number;
  defaultPrice: number;
}

interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
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
  price: number;
  total: number;
}

interface DataEntryProps {
  role?: "admin" | "staff";
  onNavigate?: (tab: string, subTab?: string) => void;
}

function makeTempReceiptNo(dateStr: string) {
  const dateCode = dateStr.replace(/-/g, "");
  return `BCH-${dateCode}-00000`;
}

const EntryItemRow = memo(({
  item,
  quantity,
  price,
  onUpdateQty,
  onSetQty,
}: {
  item: CatalogItem;
  quantity: number;
  price: number;
  onUpdateQty: (itemId: string, delta: number) => void;
  onSetQty: (itemId: string, qty: number) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const startEdit = () => {
    setEditValue(quantity === 0 ? "" : String(quantity));
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    const parsed = parseInt(editValue, 10);
    onSetQty(item.id, isNaN(parsed) || parsed < 0 ? 0 : parsed);
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-[#E5E7EB]/60 last:border-b-0 px-1">
      <div className="flex-1 min-w-0 mr-3">
        <span className="text-[#1F2937] block truncate" style={{ fontSize: "0.9rem" }}>{item.name}</span>
        {price > 0 && (
          <span className="text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>{price.toLocaleString()} ကျပ်</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => onUpdateQty(item.id, -1)}
          disabled={quantity === 0}
          className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors active:scale-95 ${
            quantity === 0
              ? "border-[#E5E7EB] text-[#D1D5DB] cursor-default"
              : "bg-white border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:border-[#D6B25E]/40 cursor-pointer"
          }`}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        {editing ? (
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            value={editValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^\d+$/.test(v)) setEditValue(v);
            }}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); }}
            className="w-16 text-center rounded-[8px] border border-[#D6B25E] bg-[#FAF6EC] text-[#B8943C] font-semibold focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 py-1"
            style={{ fontSize: "0.95rem" }}
          />
        ) : (
          <button
            onClick={startEdit}
            className={`w-12 text-center cursor-pointer rounded-[8px] py-1 transition-colors hover:bg-[#FAF6EC] ${quantity > 0 ? "text-[#B8943C] font-semibold" : "text-[#9CA3AF]"}`}
            style={{ fontSize: "1rem" }}
            title="နှိပ်၍ အရေအတွက် ရိုက်ထည့်ပါ"
          >
            {quantity}
          </button>
        )}
        <button
          onClick={() => onUpdateQty(item.id, 1)}
          className="w-8 h-8 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:bg-[#FAF6EC] hover:border-[#D6B25E]/40 transition-colors cursor-pointer active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});

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
  const [entryQuantities, setEntryQuantities] = useState<Record<string, number>>({});
  const [entrySearch, setEntrySearch] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showEntryConfirm, setShowEntryConfirm] = useState(false);
  const [productionDate, setProductionDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [entryDateModified, setEntryDateModified] = useState(false);
  const [showEntryDateConfirm, setShowEntryDateConfirm] = useState(false);
  const [pendingEntryAction, setPendingEntryAction] = useState<"add" | "submit" | null>(null);
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
  const [salePriceStr, setSalePriceStr] = useState("");
  const [receiptNo, setReceiptNo] = useState("");
  const [receiptNoManual, setReceiptNoManual] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

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
  const [pendingSaleAction, setPendingSaleAction] = useState<"save" | "saveAndPrint" | null>(null);
  const saleDateInputRef = useRef<HTMLInputElement>(null);

  // Auto-generate receipt number for a given date
  const refreshReceiptNo = useCallback(async (dateStr: string) => {
    try {
      const next = await db.getNextReceiptNumber(dateStr);
      setReceiptNo(next);
    } catch (e) {
      console.error("Failed to generate receipt no:", e);
      setReceiptNo(makeTempReceiptNo(dateStr));
    }
    setReceiptNoManual(false);
  }, []);

  // Generate receipt number on mount
  useEffect(() => {
    refreshReceiptNo(saleDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setEntryQuantities(prev => ({
        ...prev,
        [item.id]: (prev[item.id] ?? 0) + 1,
      }));
      setBarcodeInput("");
      barcodeRef.current?.focus();
    } else {
      alert(`Unknown barcode: ${barcodeInput.trim()}`);
      setBarcodeInput("");
      barcodeRef.current?.focus();
    }
  };

  const updateEntryQuantity = useCallback((itemId: string, delta: number) => {
    setEntryQuantities(prev => {
      const current = prev[itemId] ?? 0;
      const newQty = Math.max(0, current + delta);
      if (newQty === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: newQty };
    });
  }, []);

  const setEntryQuantity = useCallback((itemId: string, qty: number) => {
    setEntryQuantities(prev => {
      if (qty <= 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: qty };
    });
  }, []);

  const getItemPrice = useCallback((itemId: string) => {
    const cat = catalogItems.find(c => c.id === itemId);
    return cat?.default_price ?? stockData.find(s => s.id === itemId)?.defaultPrice ?? 0;
  }, [catalogItems, stockData]);

  const entrySelectedItems = useMemo(() =>
    Object.entries(entryQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const cat = catalogItems.find(c => c.id === itemId);
        return { item_id: itemId, name: cat?.name ?? '', price: getItemPrice(itemId), quantity: qty };
      }),
    [entryQuantities, catalogItems, getItemPrice]
  );

  const totalQuantity = useMemo(() => entrySelectedItems.reduce((sum, i) => sum + i.quantity, 0), [entrySelectedItems]);
  const totalPrice = useMemo(() => entrySelectedItems.reduce((sum, i) => sum + i.quantity * i.price, 0), [entrySelectedItems]);

  const filteredCatalogItems = useMemo(() =>
    entrySearch.trim()
      ? catalogItems.filter(item => item.name.toLowerCase().includes(entrySearch.toLowerCase()))
      : catalogItems,
    [catalogItems, entrySearch]
  );

  const trySubmit = () => {
    if (entrySelectedItems.length === 0 || submitting) return;
    if (!entryDateModified) {
      setPendingEntryAction("submit");
      setShowEntryDateConfirm(true);
      return;
    }
    setShowEntryConfirm(true);
  };

  const doSubmit = async () => {
    if (entrySelectedItems.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const entries = entrySelectedItems.map((item) => ({
        item_id: item.item_id,
        quantity: item.quantity,
      }));
      await db.createProductionLogs(entries, productionDate);
      setSubmitted(true);
      const newStock = await db.getStockWithToday();
      setStockData(newStock);
      setTimeout(() => {
        setEntryQuantities({});
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
    if (pendingEntryAction === "submit") setShowEntryConfirm(true);
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
    setEntryQuantities({});
    setEntrySearch("");
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
    const price = parseInt(salePriceStr, 10);
    if (isNaN(price) || price < 0) {
      setSaleError("ဈေးနှုန်း မှန်ကန်စွာ ထည့်ပါ။");
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
        const newQty = existing.quantity + qty;
        return prev.map((i) => i.itemId === saleItemPickId ? { ...i, quantity: newQty, price, total: newQty * price } : i);
      }
      return [...prev, { id: Date.now().toString(), itemId: saleItemPickId, name: saleItemPick, quantity: qty, price, total: qty * price }];
    });
    setSaleItemPick("");
    setSaleItemPickId("");
    setSaleQtyStr("1");
    setSalePriceStr("");
  };

  const removeSaleItem = (id: string) => {
    setSaleItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateSaleItemQty = (id: string, delta: number) => {
    setSaleItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty, total: newQty * item.price };
      })
    );
  };

  const saleGrandTotal = saleItems.reduce((sum, i) => sum + i.total, 0);
  const saleTotalQty = saleItems.reduce((sum, i) => sum + i.quantity, 0);

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleSaveAndPrint = () => {
    if (saleItems.length === 0 || !saleCustomer || saleSubmitting) return;
    if (!saleDateModified) {
      setPendingSaleAction("saveAndPrint");
      setShowSaleDateConfirm(true);
      return;
    }
    doSaleSubmitAndPrint();
  };

  const doSaleSubmitAndPrint = async () => {
    await doSaleSubmit();
    // Small delay to let state update, then print
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const trySaleSubmit = () => {
    if (saleItems.length === 0 || !saleCustomer || saleSubmitting) return;
    if (!saleDateModified) {
      setPendingSaleAction("save");
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

      // Build receipt header
      const subtotal = saleItems.reduce((sum, si) => sum + si.total, 0);
      const discountAmount = 0;
      const grandTotal = subtotal - discountAmount;

      const header: db.ReceiptHeaderInsert = {
        receipt_no: receiptNo,
        customer_id: saleCustomer?.id ?? null,
        receipt_date: saleDate,
        subtotal,
        discount_amount: discountAmount,
        grand_total: grandTotal,
        note: null,
        created_by: null,
        status: 'posted',
      };

      // Build receipt lines
      const lines = saleItems.map((si) => ({
        item_id: si.itemId,
        item_name_snapshot: si.name,
        qty: si.quantity,
        unit_price: si.price,
        line_total: si.total,
      }));

      await db.createSalesReceipt(header, lines);

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
        setSalePriceStr("");
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        setSaleDate(todayStr);
        refreshReceiptNo(todayStr);
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
    if (pendingSaleAction === "saveAndPrint") {
      doSaleSubmitAndPrint();
    } else {
      doSaleSubmit();
    }
    setPendingSaleAction(null);
  };

  const handleSaleDateChange = () => {
    setShowSaleDateConfirm(false);
    setPendingSaleAction(null);
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
    setSalePriceStr("");
    refreshReceiptNo(saleDate);
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

            {/* ═══ Section 1: Item Selection (POS-style) ═══ */}
            <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 sm:p-7">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[#1F2937]" style={{ fontSize: "0.95rem" }}>ပစ္စည်း ရွေးချယ်ရန်</h4>
                {entrySelectedItems.length > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-[#D6B25E] text-white" style={{ fontSize: "0.7rem" }}>
                    {entrySelectedItems.length} မျိုး ရွေးထား
                  </span>
                )}
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                <input
                  type="text"
                  placeholder="ပစ္စည်းအမည် ရှာရန်..."
                  value={entrySearch}
                  onChange={(e) => setEntrySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 rounded-[12px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
                  style={{ fontSize: "0.9rem" }}
                />
                {entrySearch && (
                  <button
                    onClick={() => setEntrySearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#1F2937] cursor-pointer transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Scrollable item list */}
              {catalogItems.length === 0 ? (
                <div className="py-8 text-center">
                  <Package className="w-9 h-9 text-[#D6B25E]/40 mx-auto mb-3" />
                  <p className="text-[#1F2937] font-medium mb-1" style={{ fontSize: "0.9rem" }}>ပစ္စည်း မရှိသေးပါ</p>
                  <p className="text-[#9CA3AF] mb-4" style={{ fontSize: "0.75rem" }}>Admin မှ ပစ္စည်းများ မထည့်သေးပါ။</p>
                  <button
                    onClick={() => {
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
                <div className="max-h-[50vh] overflow-y-auto -mx-1 scrollbar-thin">
                  {filteredCatalogItems.length === 0 ? (
                    <div className="py-8 text-center">
                      <Search className="w-8 h-8 mx-auto mb-2 text-[#E5E7EB]" />
                      <p className="text-[#9CA3AF]" style={{ fontSize: "0.85rem" }}>
                        &ldquo;{entrySearch}&rdquo; နှင့် ကိုက်ညီသော ပစ္စည်း မတွေ့ပါ
                      </p>
                    </div>
                  ) : (
                    filteredCatalogItems.map((item) => (
                      <EntryItemRow
                        key={item.id}
                        item={item}
                        quantity={entryQuantities[item.id] ?? 0}
                        price={getItemPrice(item.id)}
                        onUpdateQty={updateEntryQuantity}
                        onSetQty={setEntryQuantity}
                      />
                    ))
                  )}
                </div>
              )}

              {/* Inline summary */}
              {entrySelectedItems.length > 0 && (
                <div className="mt-4 pt-4 border-t-2 border-[#D6B25E]/30 space-y-2">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[#6B7280]" style={{ fontSize: "0.85rem" }}>စုစုပေါင်းပစ္စည်းအရေအတွက်</span>
                    <span className="text-[#1F2937]" style={{ fontSize: "0.9rem" }}>{totalQuantity} ခု</span>
                  </div>
                  <div className="flex items-center justify-between px-2 py-2 rounded-[10px] bg-[#FAF6EC]">
                    <span className="text-[#B8943C] font-medium" style={{ fontSize: "0.95rem" }}>စုစုပေါင်းတန်ဖိုး</span>
                    <span className="text-[#B8943C] font-bold" style={{ fontSize: "1.15rem" }}>{totalPrice.toLocaleString()} ကျပ်</span>
                  </div>
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
        {/*  SALE TAB — RECEIPT / VOUCHER BUILDER          */}
        {/* ═══════════════════════════════════════════════ */}
        {activeMode === "sale" && (
          <div className="space-y-5 print:hidden">

            {/* ─── 1) RECEIPT HEADER ─── */}
            <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 sm:p-7">
              <div className="flex items-center gap-2 mb-5">
                <Receipt className="w-5 h-5 text-[#D6B25E]" />
                <h3 className="text-[#1F2937]">ဘောင်ချာ တည်ဆောက်ရန်</h3>
              </div>

              <div className="space-y-4">
                {/* Customer selector */}
                <div className="relative" ref={customerDropRef}>
                  <label className="block text-[#6B7280] mb-1.5" style={{ fontSize: "0.75rem" }}>
                    ၀ယ်သူအမည် <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                    <input
                      type="text"
                      placeholder="၀ယ်သူအမည် ရှာရန်..."
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
                          ၀ယ်သူအမည် မတွေ့ပါ
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
                        + ၀ယ်သူအမည်အသစ် ထည့်ရန်
                      </button>
                    </div>
                  )}
                </div>
                {!saleCustomer && !customerDropOpen && customerSearch === "" && (
                  <p className="text-amber-600 mt-1.5 flex items-center gap-1.5" style={{ fontSize: "0.7rem" }}>
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    ကျေးဇူးပြု၍ ဝယ်သူကို ရွေးချယ်ပါ
                  </p>
                )}

                {/* Date & Receipt No */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#6B7280] mb-1.5" style={{ fontSize: "0.75rem" }}>
                      နေ့စွဲ
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
                            if (!receiptNoManual) {
                              refreshReceiptNo(e.target.value);
                            }
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        style={{ zIndex: 1 }}
                      />
                      <div
                        className="w-full flex items-center justify-between px-4 py-3 rounded-[12px] border border-[#E5E7EB] bg-white text-[#1F2937] pointer-events-none"
                        style={{ fontSize: "0.9rem", minHeight: "48px" }}
                      >
                        <span>{formatDisplayDate(saleDate)}</span>
                        <CalendarDays className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                      </div>
                    </div>
                    {saleDate !== (() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; })() && (
                      <p className="text-amber-600 mt-1.5 flex items-center gap-1.5" style={{ fontSize: "0.7rem" }}>
                        <CalendarDays className="w-3 h-3 shrink-0" />
                        ယနေ့ မဟုတ်သော ရက်စွဲ
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[#6B7280] mb-1.5" style={{ fontSize: "0.75rem" }}>
                      ဘောင်ချာအမှတ်
                    </label>
                    <input
                      type="text"
                      placeholder="BCH-20250101-00001"
                      value={receiptNo}
                      onChange={(e) => { setReceiptNo(e.target.value); setReceiptNoManual(true); }}
                      className="w-full px-4 py-3 rounded-[12px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
                      style={{ fontSize: "0.9rem" }}
                    />
                  </div>
                </div>
              </div>

              {/* Summary badge */}
              {saleItems.length > 0 && (
                <div className="mt-4 px-3.5 py-2.5 rounded-[10px] bg-[#FAF6EC] border border-[#D6B25E]/20">
                  <p className="text-[#B8943C]" style={{ fontSize: "0.8rem" }}>
                    ဒီဘောင်ချာတွင် ပစ္စည်း ({saleItems.length}) မျိုး
                  </p>
                </div>
              )}
            </div>

            {/* ─── 2) ADD LINE ITEM FORM ─── */}
            <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 sm:p-7">
              <h4 className="text-[#1F2937] mb-4" style={{ fontSize: "0.95rem" }}>ပစ္စည်းထည့်ရန်</h4>

              <div className="space-y-3">
                {/* Item selector */}
                <div className="relative" ref={saleItemDropRef}>
                  <label className="block text-[#6B7280] mb-1.5" style={{ fontSize: "0.75rem" }}>
                    ပစ္စည်းရွေးရန်
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
                              const stockPrice = stockData.find((s) => s.id === p.id)?.defaultPrice ?? p.default_price ?? 0;
                              setSalePriceStr(stockPrice ? String(stockPrice) : "");
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
                    <div className="mt-2 px-3.5 py-2 rounded-[10px] bg-[#FAFAF8] border border-[#E5E7EB]">
                      <div className="flex items-center justify-between" style={{ fontSize: "0.75rem" }}>
                        <span className="text-[#6B7280]">လက်ရှိ လက်ကျန်:</span>
                        <span className={getStockForItem(saleItemPick) <= 5 ? "text-amber-600" : "text-[#1F2937]"}>
                          {getStockForItem(saleItemPick)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Price + Qty row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#6B7280] mb-1.5" style={{ fontSize: "0.75rem" }}>
                      ဈေးနှုန်း (ကျပ်)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={salePriceStr}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "" || /^\d+$/.test(v)) setSalePriceStr(v);
                      }}
                      className="w-full px-4 py-3 rounded-[12px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all text-center"
                      style={{ fontSize: "0.9rem" }}
                    />
                  </div>
                  <div>
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
                </div>

                {/* Add button */}
                <button
                  onClick={handleAddSaleItem}
                  disabled={!saleItemPickId || !salePriceStr}
                  className={`w-full px-5 py-3 rounded-[12px] border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    saleItemPickId && salePriceStr
                      ? "border-[#D6B25E] bg-[#FAF6EC] text-[#B8943C] hover:bg-[#D6B25E] hover:text-white"
                      : "border-[#E5E7EB] bg-[#F7F6F3] text-[#9CA3AF] cursor-not-allowed"
                  }`}
                  style={{ fontSize: "0.85rem" }}
                >
                  <Plus className="w-4 h-4" />
                  ပစ္စည်းထည့်ရန်
                </button>
                <p className="text-[#9CA3AF] text-center" style={{ fontSize: "0.7rem" }}>
                  တစ်ကြိမ်တည်းတွင် ပစ္စည်းများစွာ ထည့်နိုင်သည်
                </p>
              </div>
            </div>

            {/* ─── 3) RECEIPT ITEM LIST (CART) ─── */}
            <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 sm:p-7">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-[#D6B25E]" />
                  <h4 className="text-[#1F2937]" style={{ fontSize: "0.95rem" }}>ဒီဘောင်ချာထဲရှိ ပစ္စည်းများ</h4>
                </div>
                {saleItems.length > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-[#D6B25E] text-white" style={{ fontSize: "0.7rem" }}>
                    {saleItems.length}
                  </span>
                )}
              </div>

              {saleItems.length > 0 ? (
                <>
                  {/* Desktop table header */}
                  <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-2 py-2 border-b border-[#E5E7EB] mb-1">
                    <span className="text-[#6B7280]" style={{ fontSize: "0.7rem" }}>ပစ္စည်းအမည်</span>
                    <span className="text-[#6B7280] text-center w-24" style={{ fontSize: "0.7rem" }}>အရေအတွက်</span>
                    <span className="text-[#6B7280] text-right w-20" style={{ fontSize: "0.7rem" }}>ဈေးနှုန်း</span>
                    <span className="text-[#6B7280] text-right w-24" style={{ fontSize: "0.7rem" }}>စုစုပေါင်း</span>
                    <span className="w-8"></span>
                  </div>

                  {/* Desktop rows */}
                  <div className="hidden sm:block space-y-0">
                    {saleItems.map((item) => {
                      const stock = getStockForItem(item.name);
                      const remaining = stock - item.quantity;
                      const isLow = remaining >= 0 && remaining <= (stockData.find((s) => s.name === item.name)?.lowStockThreshold ?? 5);
                      return (
                        <div key={item.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center py-3 px-2 border-b border-[#E5E7EB]/60 last:border-b-0">
                          <div className="min-w-0">
                            <span className="text-[#1F2937] truncate block" style={{ fontSize: "0.9rem" }}>{item.name}</span>
                            {isLow && (
                              <span className="text-amber-600" style={{ fontSize: "0.65rem" }}>
                                လက်ကျန်: {stock} → {remaining} (လက်ကျန်နည်း)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 w-24 justify-center">
                            <button onClick={() => updateSaleItemQty(item.id, -1)} className="w-7 h-7 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:bg-[#FAF6EC] hover:border-[#D6B25E]/40 transition-colors cursor-pointer active:scale-95">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-[#1F2937]" style={{ fontSize: "0.9rem" }}>{item.quantity}</span>
                            <button onClick={() => updateSaleItemQty(item.id, 1)} className="w-7 h-7 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:bg-[#FAF6EC] hover:border-[#D6B25E]/40 transition-colors cursor-pointer active:scale-95">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-right text-[#6B7280] w-20" style={{ fontSize: "0.85rem" }}>{item.price.toLocaleString()}</span>
                          <span className="text-right text-[#1F2937] font-medium w-24" style={{ fontSize: "0.85rem" }}>{item.total.toLocaleString()}</span>
                          <button onClick={() => removeSaleItem(item.id)} className="w-7 h-7 rounded-full flex items-center justify-center text-[#9CA3AF] hover:bg-red-50 hover:text-[#DC2626] transition-colors cursor-pointer shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Mobile stacked cards */}
                  <div className="sm:hidden divide-y divide-[#E5E7EB]/60">
                    {saleItems.map((item) => {
                      const stock = getStockForItem(item.name);
                      const remaining = stock - item.quantity;
                      const isLow = remaining >= 0 && remaining <= (stockData.find((s) => s.name === item.name)?.lowStockThreshold ?? 5);
                      return (
                        <div key={item.id} className="py-3.5 px-1 space-y-2">
                          {/* Row 1: item name + delete */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-[#1F2937] block" style={{ fontSize: "0.95rem" }}>{item.name}</span>
                              <span className="text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>
                                {item.price.toLocaleString()} × {item.quantity} = {item.total.toLocaleString()} ကျပ်
                              </span>
                              {isLow && (
                                <span className="text-amber-600 block" style={{ fontSize: "0.65rem" }}>
                                  လက်ကျန်: {stock} → {remaining} (လက်ကျန်နည်း)
                                </span>
                              )}
                            </div>
                            <button onClick={() => removeSaleItem(item.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-[#9CA3AF] hover:bg-red-50 hover:text-[#DC2626] transition-colors cursor-pointer shrink-0 -mt-0.5">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          {/* Row 2: quantity controls + line total */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button onClick={() => updateSaleItemQty(item.id, -1)} className="w-8 h-8 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:bg-[#FAF6EC] hover:border-[#D6B25E]/40 transition-colors cursor-pointer active:scale-95">
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-10 text-center text-[#1F2937] font-medium" style={{ fontSize: "1rem" }}>{item.quantity}</span>
                              <button onClick={() => updateSaleItemQty(item.id, 1)} className="w-8 h-8 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:bg-[#FAF6EC] hover:border-[#D6B25E]/40 transition-colors cursor-pointer active:scale-95">
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="text-[#1F2937] font-semibold" style={{ fontSize: "0.95rem" }}>{item.total.toLocaleString()} Ks</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ─── 4) SUMMARY ─── */}
                  <div className="mt-4 pt-4 border-t-2 border-[#D6B25E]/30 space-y-2">
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[#6B7280]" style={{ fontSize: "0.85rem" }}>စုစုပေါင်းပစ္စည်းအရေအတွက်</span>
                      <span className="text-[#1F2937]" style={{ fontSize: "0.9rem" }}>{saleTotalQty} ခု</span>
                    </div>
                    <div className="flex items-center justify-between px-2 py-2 rounded-[10px] bg-[#FAF6EC]">
                      <span className="text-[#B8943C] font-medium" style={{ fontSize: "0.95rem" }}>စုစုပေါင်းငွေ</span>
                      <span className="text-[#B8943C] font-bold" style={{ fontSize: "1.15rem" }}>{saleGrandTotal.toLocaleString()} ကျပ်</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center">
                  <Package className="w-10 h-10 mx-auto mb-2 text-[#E5E7EB]" />
                  <p className="text-[#9CA3AF]" style={{ fontSize: "0.85rem" }}>
                    ၀ယ်သူအမည် ရွေးချယ်ပြီး ပစ္စည်းများ ထည့်သွင်းပါ။
                  </p>
                </div>
              )}
            </div>

            {/* Error */}
            {saleError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-[12px] bg-red-50 border border-red-200">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-red-600" style={{ fontSize: "0.8rem" }}>{saleError}</p>
              </div>
            )}

            {/* ─── 5) ACTION BUTTONS ─── */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={trySaleSubmit}
                disabled={saleItems.length === 0 || !saleCustomer || saleSubmitted || saleSubmitting}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-[12px] transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.08)] ${
                  saleSubmitted
                    ? "bg-green-500 text-white shadow-none"
                    : saleItems.length === 0 || !saleCustomer || saleSubmitting
                    ? "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed shadow-none"
                    : "bg-[#D6B25E] hover:bg-[#B8943C] text-white"
                }`}
                style={{ fontSize: "0.9rem" }}
              >
                {saleSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> လုပ်ဆောင်နေသည်...</>
                ) : saleSubmitted ? (
                  <><Check className="w-4 h-4" /> မှတ်တမ်းတင်ပြီး!</>
                ) : !saleCustomer ? (
                  "ဝယ်သူရွေးရန်လိုအပ်သည်"
                ) : (
                  <><Check className="w-4 h-4" /> ဘောက်ချာ သိမ်းမည်</>
                )}
              </button>
              <button
                onClick={handleSaveAndPrint}
                disabled={saleItems.length === 0 || !saleCustomer || saleSubmitted || saleSubmitting}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-[12px] transition-all cursor-pointer border ${
                  saleItems.length === 0 || !saleCustomer || saleSubmitting || saleSubmitted
                    ? "bg-[#F7F6F3] text-[#9CA3AF] cursor-not-allowed border-[#E5E7EB]"
                    : "bg-white text-[#1F2937] border-[#E5E7EB] hover:bg-[#FAF6EC] hover:border-[#D6B25E]/50"
                }`}
                style={{ fontSize: "0.9rem" }}
              >
                <Printer className="w-4 h-4" />
                သိမ်းပြီး ပရင့်ထုတ်မည်
              </button>
              <button
                onClick={handleSaleCancel}
                className="sm:w-auto px-5 py-3.5 rounded-[12px] border border-[#E5E7EB] text-[#6B7280] hover:bg-red-50 hover:text-[#DC2626] hover:border-red-200 transition-all cursor-pointer"
                style={{ fontSize: "0.85rem" }}
              >
                <Trash2 className="w-4 h-4 mx-auto sm:mx-0" />
              </button>
            </div>

            {/* ─── RECEIPT PREVIEW (inline, optional) ─── */}
            {saleItems.length > 0 && saleCustomer && (
              <details className="bg-[#FAFAF8] rounded-[12px] border border-[#E5E7EB] overflow-hidden">
                <summary className="px-5 py-3 cursor-pointer text-[#6B7280] hover:text-[#1F2937] transition-colors" style={{ fontSize: "0.85rem" }}>
                  ဘောင်ချာ အကြိုကြည့်ရန်
                </summary>
                <div className="px-5 pb-5">
                  <div className="bg-white border border-[#E5E7EB] rounded-[10px] p-5 max-w-md mx-auto">
                    <div className="text-center mb-4">
                      <h3 className="text-[#1F2937] font-bold" style={{ fontSize: "1.1rem" }}>ACT Bakery</h3>
                      <p className="text-[#6B7280]" style={{ fontSize: "0.85rem" }}>ငွေလက်ငင်းဖြတ်ပိုင်း</p>
                    </div>
                    <div className="flex justify-between mb-1" style={{ fontSize: "0.8rem" }}>
                      <span className="text-[#6B7280]">၀ယ်သူအမည်:</span>
                      <span className="text-[#1F2937]">{saleCustomer.name}</span>
                    </div>
                    <div className="flex justify-between mb-1" style={{ fontSize: "0.8rem" }}>
                      <span className="text-[#6B7280]">နေ့စွဲ:</span>
                      <span className="text-[#1F2937]">{formatDisplayDate(saleDate)}</span>
                    </div>
                    {receiptNo && (
                      <div className="flex justify-between mb-1" style={{ fontSize: "0.8rem" }}>
                        <span className="text-[#6B7280]">ဘောင်ချာအမှတ်:</span>
                        <span className="text-[#1F2937]">{receiptNo}</span>
                      </div>
                    )}
                    <div className="border-t border-dashed border-[#E5E7EB] my-3"></div>
                    <table className="w-full" style={{ fontSize: "0.8rem" }}>
                      <thead>
                        <tr className="text-[#6B7280]">
                          <th className="text-left pb-1">ပစ္စည်း</th>
                          <th className="text-center pb-1">ခု</th>
                          <th className="text-right pb-1">ဈေး</th>
                          <th className="text-right pb-1">ပေါင်း</th>
                        </tr>
                      </thead>
                      <tbody>
                        {saleItems.map((item) => (
                          <tr key={item.id} className="text-[#1F2937]">
                            <td className="py-0.5">{item.name}</td>
                            <td className="text-center">{item.quantity}</td>
                            <td className="text-right">{item.price.toLocaleString()}</td>
                            <td className="text-right">{item.total.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="border-t border-dashed border-[#E5E7EB] my-3"></div>
                    <div className="flex justify-between font-bold text-[#1F2937]" style={{ fontSize: "0.9rem" }}>
                      <span>စုစုပေါင်း</span>
                      <span>{saleGrandTotal.toLocaleString()} ကျပ်</span>
                    </div>
                  </div>
                </div>
              </details>
            )}
          </div>
        )}

        {/* Hidden print-only receipt */}
        {activeMode === "sale" && saleCustomer && (
          <ReceiptPrint
            ref={receiptRef}
            customerName={saleCustomer.name}
            date={saleDate}
            receiptNo={receiptNo || undefined}
            items={saleItems.map((si): ReceiptLineItem => ({
              id: si.id,
              name: si.name,
              quantity: si.quantity,
              price: si.price,
              total: si.total,
            }))}
            grandTotal={saleGrandTotal}
          />
        )}
      </div>

      {/* ═══ Bottom Sticky Panel (Entry tab only) ═══ */}
      {activeMode === "entry" && entrySelectedItems.length > 0 && (
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
                  ပစ္စည်း {entrySelectedItems.length} မျိုး
                </span>
                <span className="text-[#B8943C] font-medium" style={{ fontSize: "0.8rem" }}>
                  {totalPrice.toLocaleString()} ကျပ်
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

      {/* ═══ Entry Confirmation Modal ═══ */}
      {showEntryConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4" onClick={() => setShowEntryConfirm(false)}>
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-[#FAF6EC] flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-[#D6B25E]" />
              </div>
              <div>
                <h3 className="text-[#1F2937]" style={{ fontSize: "1rem" }}>မှတ်တမ်းတင်ရန် အတည်ပြုပါ</h3>
                <p className="text-[#9CA3AF]" style={{ fontSize: "0.8rem" }}>
                  ပစ္စည်းများ မှန်ကန်ကြောင်း စစ်ဆေးပါ
                </p>
              </div>
            </div>

            {/* Date */}
            <div className="bg-[#FAFAF8] rounded-[10px] border border-[#E5E7EB] px-4 py-2.5 mb-4 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#D6B25E] shrink-0" />
              <span className="text-[#1F2937]" style={{ fontSize: "0.85rem" }}>{formatDisplayDate(productionDate)}</span>
            </div>

            {/* Item list */}
            <div className="max-h-[40vh] overflow-y-auto mb-4 border border-[#E5E7EB] rounded-[12px] divide-y divide-[#E5E7EB]">
              {entrySelectedItems.map((item) => (
                <div key={item.item_id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-[#1F2937] truncate flex-1 min-w-0 mr-3" style={{ fontSize: "0.9rem" }}>{item.name}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[#B8943C] font-semibold" style={{ fontSize: "0.95rem" }}>{item.quantity.toLocaleString()}</span>
                    <span className="text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>ခု</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-[#FAF6EC] rounded-[10px] px-4 py-3 mb-5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[#6B7280]" style={{ fontSize: "0.85rem" }}>စုစုပေါင်း ပစ္စည်းအမျိုးအစား</span>
                <span className="text-[#1F2937]" style={{ fontSize: "0.9rem" }}>{entrySelectedItems.length} မျိုး</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6B7280]" style={{ fontSize: "0.85rem" }}>စုစုပေါင်း အရေအတွက်</span>
                <span className="text-[#B8943C] font-bold" style={{ fontSize: "1.1rem" }}>{totalQuantity.toLocaleString()} ခု</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6B7280]" style={{ fontSize: "0.85rem" }}>စုစုပေါင်း တန်ဖိုး</span>
                <span className="text-[#B8943C] font-bold" style={{ fontSize: "1.1rem" }}>{totalPrice.toLocaleString()} ကျပ်</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => { setShowEntryConfirm(false); doSubmit(); }}
                disabled={submitting}
                className="w-full py-3 rounded-[12px] bg-[#D6B25E] text-white hover:bg-[#B8943C] transition-all cursor-pointer flex items-center justify-center gap-2"
                style={{ fontSize: "0.9rem" }}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {submitting ? "လုပ်ဆောင်နေသည်..." : "အတည်ပြုမည်"}
              </button>
              <button
                onClick={() => setShowEntryConfirm(false)}
                className="w-full py-3 rounded-[12px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#1F2937] transition-all cursor-pointer flex items-center justify-center gap-2"
                style={{ fontSize: "0.9rem" }}
              >
                ပြန်ပြင်မည်
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
                <h3 className="text-[#1F2937]">၀ယ်သူအမည် အသစ် ထည့်ရန်</h3>
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
                  ၀ယ်သူအမည် <span className="text-red-400">*</span>
                </label>
                <input type="text" placeholder="၀ယ်သူအမည် ထည့်ပါ..." value={newCustName} onChange={(e) => setNewCustName(e.target.value)} className="w-full px-4 py-3 rounded-[12px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all" style={{ fontSize: "0.9rem" }} autoFocus />
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
                {newCustSaving ? "Saving..." : "၀ယ်သူအမည် သိမ်းဆည်းရန်"}
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
            <p className="text-[#1F2937]" style={{ fontSize: "1rem" }}>၀ယ်သူအမည် သိမ်းဆည်းပြီး!</p>
            <p className="text-[#9CA3AF] mt-1" style={{ fontSize: "0.8rem" }}>
              ၀ယ်သူအမည်အသစ် အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ
            </p>
          </div>
        </div>
      )}
    </>
  );
}
