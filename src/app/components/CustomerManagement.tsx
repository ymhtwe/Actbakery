import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Users,
  X,
  Phone,
  MapPin,
  Search,
} from "lucide-react";
import * as db from "./db";
import type { Customer } from "./db";

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

export function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);

      const data = await db.getCustomers();
      setCustomers(data);
    } catch (e: any) {
      console.error("Failed to load customers:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = customers.filter((c) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(s) ||
      (c.phone || "").toLowerCase().includes(s) ||
      (c.address || "").toLowerCase().includes(s)
    );
  });

  const openAdd = () => {
    setEditingCustomer(null);
    setForm({ name: "", phone: "", address: "" });
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setForm({
      name: c.name,
      phone: c.phone || "",
      address: c.address || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    setFormError("");
    if (!form.name.trim()) {
      setFormError("ဖောက်သည် အမည် ထည့်သွင်းရန် လိုအပ်ပါသည်။");
      return;
    }
    setSaving(true);
    try {
      if (editingCustomer) {
        await db.updateCustomer(
          editingCustomer.id,
          form.name.trim(),
          form.phone.trim() || undefined,
          form.address.trim() || undefined
        );
      } else {
        await db.createCustomer(
          form.name.trim(),
          form.phone.trim() || undefined,
          form.address.trim() || undefined
        );
      }
      setShowModal(false);
      await loadCustomers();
    } catch (e: any) {
      console.error("Failed to save customer:", e);
      setFormError(e?.message || "သိမ်းဆည်းရန် မအောင်မြင်ပါ။");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await db.deleteCustomer(deleteConfirm.id);
      setDeleteConfirm(null);
      await loadCustomers();
    } catch (e: any) {
      console.error("Failed to delete customer:", e);
      alert(e?.message || "ဖျက်ရန် မအောင်မြင်ပါ။");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-[#1F2937]">ဖောက်သည် စီမံခန့်ခွဲမှု</h3>
          <p className="text-[#9CA3AF]" style={{ fontSize: "0.85rem" }}>
            ဖောက်သည်များကို ထည့်သွင်းခြင်း၊ ပြင်ဆင်ခြင်းနှင့် ဖျက်ခြင်း
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[12px] bg-[#D6B25E] text-white hover:bg-[#C4A24D] transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
          style={{ fontSize: "0.85rem" }}
        >
          <Plus className="w-4 h-4" />
          အသစ် ထည့်ရန်
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          type="text"
          placeholder="ဖောက်သည် ရှာရန်..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
          style={{ fontSize: "0.85rem" }}
        />
      </div>

      {/* Table card */}
      <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 sm:p-7">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-[#9CA3AF]">
            <Loader2 className="w-5 h-5 animate-spin text-[#D6B25E]" />
            ဖောက်သည်များ ခေါ်ယူနေသည်...
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#9CA3AF]">
            <Users className="w-10 h-10 text-[#E8D5A0]" />
            <p>
              {customers.length === 0
                ? "ဖောက်သည် မရှိသေးပါ။ \"အသစ် ထည့်ရန်\" ကို နှိပ်ပါ။"
                : "ရှာဖွေမှုနှင့် ကိုက်ညီသော ဖောက်သည် မတွေ့ပါ။"}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full" style={{ minWidth: "640px" }}>
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    <th
                      className="text-left py-3 px-4 text-[#6B7280]"
                      style={{ fontSize: "0.85rem" }}
                    >
                      အမည်
                    </th>
                    <th
                      className="text-left py-3 px-4 text-[#6B7280]"
                      style={{ fontSize: "0.85rem" }}
                    >
                      ဖုန်းနံပါတ်
                    </th>
                    <th
                      className="text-left py-3 px-4 text-[#6B7280]"
                      style={{ fontSize: "0.85rem" }}
                    >
                      လိပ်စာ
                    </th>
                    <th
                      className="text-left py-3 px-4 text-[#6B7280]"
                      style={{ fontSize: "0.85rem" }}
                    >
                      ဖန်တီးသည့်ရက်
                    </th>
                    <th
                      className="text-right py-3 px-4 text-[#6B7280]"
                      style={{ fontSize: "0.85rem" }}
                    >
                      လုပ်ဆောင်ချက်
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-[#E5E7EB]/60 hover:bg-[#FAF6EC] transition-colors"
                    >
                      <td className="py-3.5 px-4 text-[#1F2937]">{c.name}</td>
                      <td
                        className="py-3.5 px-4 text-[#6B7280]"
                        style={{ fontSize: "0.85rem" }}
                      >
                        {c.phone || "\u2014"}
                      </td>
                      <td
                        className="py-3.5 px-4 text-[#6B7280]"
                        style={{ fontSize: "0.85rem" }}
                      >
                        {c.address || "\u2014"}
                      </td>
                      <td
                        className="py-3.5 px-4 text-[#6B7280]"
                        style={{ fontSize: "0.85rem" }}
                      >
                        {formatDate(c.created_at)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(c)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#B8943C] hover:border-[#D6B25E]/40 transition-all cursor-pointer"
                            style={{ fontSize: "0.8rem" }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            ပြင်ရန်
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(c)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-red-50 hover:text-[#DC2626] hover:border-red-200 transition-all cursor-pointer"
                            style={{ fontSize: "0.8rem" }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            ဖျက်ရန်
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-3">
              {filteredCustomers.map((c) => (
                <div
                  key={c.id}
                  className="border border-[#E5E7EB] rounded-[12px] p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <p
                      className="text-[#1F2937]"
                      style={{ fontSize: "1rem" }}
                    >
                      {c.name}
                    </p>
                    <span
                      className="text-[#9CA3AF] shrink-0 ml-2"
                      style={{ fontSize: "0.7rem" }}
                    >
                      {formatDate(c.created_at)}
                    </span>
                  </div>
                  {(c.phone || c.address) && (
                    <div className="space-y-1 mb-3">
                      {c.phone && (
                        <div className="flex items-center gap-1.5 text-[#6B7280]">
                          <Phone className="w-3.5 h-3.5 text-[#9CA3AF]" />
                          <span style={{ fontSize: "0.8rem" }}>{c.phone}</span>
                        </div>
                      )}
                      {c.address && (
                        <div className="flex items-center gap-1.5 text-[#6B7280]">
                          <MapPin className="w-3.5 h-3.5 text-[#9CA3AF]" />
                          <span style={{ fontSize: "0.8rem" }}>
                            {c.address}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 border-t border-[#E5E7EB]/60 pt-3">
                    <button
                      onClick={() => openEdit(c)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#B8943C] transition-all cursor-pointer"
                      style={{ fontSize: "0.8rem" }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      ပြင်ရန်
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(c)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-red-50 hover:text-[#DC2626] hover:border-red-200 transition-all cursor-pointer"
                      style={{ fontSize: "0.8rem" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      ဖျက်ရန်
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ═══════ Add / Edit Customer Modal ═══════ */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-lg w-full max-w-md p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[#1F2937]">
                {editingCustomer
                  ? "ဖောက်သည် ပြင်ဆင်ရန်"
                  : "ဖောက်သည်အသစ် ထည့်ရန်"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-[#9CA3AF] hover:text-[#6B7280] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p
              className="text-[#9CA3AF] mb-6"
              style={{ fontSize: "0.85rem" }}
            >
              {editingCustomer
                ? "ဖောက်သည် အချက်အလက်များကို ပြင်ဆင်ပါ။"
                : "ဖောက်သည်အသစ်၏ အချက်အလက်များကို ဖြည့်သွင်းပါ။"}
            </p>

            <div className="space-y-4">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-[#6B7280]"
                  style={{ fontSize: "0.75rem" }}
                >
                  ဖောက်သည် အမည် <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="ဥပမာ - Nay La Cafe"
                  className="w-full px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
                  style={{ fontSize: "0.85rem" }}
                />
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-[#6B7280]"
                  style={{ fontSize: "0.75rem" }}
                >
                  ဖုန်းနံပါတ်
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                  placeholder="ဥပမာ - 09451234567"
                  className="w-full px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
                  style={{ fontSize: "0.85rem" }}
                />
              </div>

              {/* Address */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-[#6B7280]"
                  style={{ fontSize: "0.75rem" }}
                >
                  လိပ်စာ
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  placeholder="ဥပမာ - ၃၉ လမ်း၊ မရမ်းကုန်း"
                  className="w-full px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
                  style={{ fontSize: "0.85rem" }}
                />
              </div>

              {formError && (
                <p
                  className="text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-[12px]"
                  style={{ fontSize: "0.85rem" }}
                >
                  {formError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-7">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F7F6F3] transition-all cursor-pointer"
                style={{ fontSize: "0.85rem" }}
              >
                မလုပ်တော့ပါ
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className={`px-5 py-2.5 rounded-[10px] text-white transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.08)] flex items-center gap-2 ${
                  saving || !form.name.trim()
                    ? "bg-[#D6B25E]/60 cursor-not-allowed"
                    : "bg-[#D6B25E] hover:bg-[#C4A24D]"
                }`}
                style={{ fontSize: "0.85rem" }}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingCustomer ? "သိမ်းဆည်းရန်" : "ထည့်သွင်းရန်"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Delete Confirmation ═══════ */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-lg w-full max-w-sm p-7 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-[#DC2626]" />
            </div>
            <h3 className="text-[#1F2937] mb-1">ဖောက်သည် ဖျက်ရန်</h3>
            <p
              className="text-[#9CA3AF] mb-6"
              style={{ fontSize: "0.85rem" }}
            >
              <strong className="text-[#1F2937]">{deleteConfirm.name}</strong>{" "}
              ကို ဖျက်မှာ သေချာပါသလား? ဤလုပ်ဆောင်ချက်ကို ပြန်ပြင်၍ မရပါ။
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
                onClick={handleDelete}
                disabled={deleting}
                className={`px-5 py-2.5 rounded-[10px] text-white transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.08)] flex items-center gap-2 ${
                  deleting
                    ? "bg-[#DC2626]/60 cursor-not-allowed"
                    : "bg-[#DC2626] hover:bg-[#B91C1C]"
                }`}
                style={{ fontSize: "0.85rem" }}
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                ဖျက်မည်
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
