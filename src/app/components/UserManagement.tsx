import { useState, useEffect } from "react";
import {
  Plus,
  Pencil,
  ShieldOff,
  Loader2,
  Users,
  ShieldCheck,
  X,
  KeyRound,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";
import { supabase } from "./supabaseClient";
import * as api from "./api";
import { ChangePassword } from "./ChangePassword";

const SUPER_ADMIN_EMAIL = "redspot604@gmail.com";

interface UserRow {
  id: string;
  display_name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

// Role badge config
function roleBadge(role: string, email: string) {
  if (email === SUPER_ADMIN_EMAIL) {
    return {
      label: "Super Admin",
      bg: "bg-[#FAF6EC]",
      text: "text-[#8B6914]",
      border: "border-[#D6B25E]/50",
    };
  }
  if (role === "admin") {
    return {
      label: "Admin",
      bg: "bg-blue-50",
      text: "text-blue-600",
      border: "border-blue-200",
    };
  }
  return {
    label: "Staff",
    bg: "bg-gray-50",
    text: "text-[#6B7280]",
    border: "border-[#E5E7EB]",
  };
}

export function UserManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState("");

  // Create-user modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "staff",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Edit-user modal
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editRole, setEditRole] = useState("staff");
  const [editSaving, setEditSaving] = useState(false);

  // Reset password modal
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  // Change own password modal
  const [showChangePw, setShowChangePw] = useState(false);

  // Fetch current user + users list
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);

        await Promise.all([
          loadCurrentUser(),
          loadUsers(),
        ]);
      } catch (e) {
        console.error("User management init error:", e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function loadCurrentUser() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUserEmail(session.user.email || "");
        // fetch role
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();
        setCurrentUserRole(data?.role || "staff");
      }
    } catch (e) {
      console.error("Failed to load current user:", e);
    }
  }

  async function loadUsers() {
    try {
      const data = await api.getUsers();
      const rows: UserRow[] = (data || []).map((u: any) => ({
        id: u.id,
        display_name: u.display_name || "—",
        email: u.email || "—",
        role: u.role || "staff",
        status: u.status || "Active",
        created_at: u.created_at || "",
      }));
      setUsers(rows);
    } catch (e: any) {
      console.error("Load users error:", e);
      setUsers([]);
    }
  }

  // Determine if current user is super admin
  const isSuperAdmin = currentUserEmail === SUPER_ADMIN_EMAIL;

  // Allowed roles for the create/edit dropdown
  const allowedRoles = isSuperAdmin
    ? ["admin", "staff"]
    : ["staff"];

  // ── Create User ──
  async function handleCreate() {
    setFormError("");
    if (!form.name.trim()) {
      setFormError("အမည် ထည့်သွင်းရန် လိုအပ်ပါသည်။");
      return;
    }
    if (!form.email.trim()) {
      setFormError("အီးမေးလ် ထည့်သွင်းရန် လိုအပ်ပါသည်။");
      return;
    }
    if (!form.password || form.password.length < 6) {
      setFormError("စကားဝှက် အနည်းဆုံး ၆ လုံး ထည့်ပါ။");
      return;
    }
    setSaving(true);
    try {
      await api.signup(form.email.trim(), form.password, form.role, form.name.trim());
      setShowModal(false);
      setForm({ name: "", email: "", password: "", role: "staff" });
      await loadUsers();
    } catch (e: any) {
      setFormError(e.message || "Failed to create user.");
    } finally {
      setSaving(false);
    }
  }

  // ── Edit User role (UI-only placeholder for now) ──
  async function handleEditSave() {
    if (!editUser) return;
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: editRole })
        .eq("id", editUser.id);
      if (error) throw new Error(error.message);
      setEditUser(null);
      await loadUsers();
    } catch (e: any) {
      console.error("Edit user error:", e);
      alert(`Failed to update role: ${e.message}`);
    } finally {
      setEditSaving(false);
    }
  }

  // ── Reset User Password ──
  async function handleResetSave() {
    if (!resetUser) return;
    setResetError("");
    setResetSuccess(false);

    if (!newPassword || newPassword.length < 6) {
      setResetError("စကားဝှက် အနည်းဆုံး ၆ လုံး ထည့်ပါ။");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("စကားဝှက်များ တူညီမှုမရှိပါ။");
      return;
    }

    setResetSaving(true);
    try {
      await api.resetPassword(resetUser.id, newPassword);
      setResetSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      // Auto-close after a brief delay
      setTimeout(() => {
        setResetUser(null);
        setResetSuccess(false);
      }, 1500);
    } catch (e: any) {
      console.error("Reset password error:", e);
      setResetError(e.message || "စကားဝှက် ပြန်သတ်မှတ်ရာတွင် အမှားရှိပါသည်။");
    } finally {
      setResetSaving(false);
    }
  }

  function formatDate(iso: string) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-[#1F2937]">အသုံးပြုသူ စီမံခန့်ခွဲမှု</h3>
          <p className="text-[#9CA3AF]" style={{ fontSize: "0.85rem" }}>
            ဝန်ထမ်းနှင့် Admin အကောင့်များ စီမံခန့်ခွဲရန်
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowChangePw(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[12px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#B8943C] hover:border-[#D6B25E]/40 transition-all cursor-pointer"
            style={{ fontSize: "0.85rem" }}
          >
            <KeyRound className="w-4 h-4" />
            စကားဝှက်ပြောင်းမည်
          </button>
          <button
            onClick={() => {
              setForm({ name: "", email: "", password: "", role: "staff" });
              setFormError("");
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[12px] bg-[#D6B25E] text-white hover:bg-[#C4A24D] transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
            style={{ fontSize: "0.85rem" }}
          >
            <Plus className="w-4 h-4" />
            အသစ် ထည့်ရန်
          </button>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 sm:p-7">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-[#9CA3AF]">
            <Loader2 className="w-5 h-5 animate-spin text-[#D6B25E]" />
            အသုံးပြုသူများ ခေါ်ယူနေသည်...
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#9CA3AF]">
            <Users className="w-10 h-10 text-[#E8D5A0]" />
            <p>အသုံးပြုသူ မတွေ့ပါ။</p>
          </div>
        ) : (
          <>
            {/* ── Desktop Table ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full" style={{ minWidth: "700px" }}>
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
                      အီးမေးလ်
                    </th>
                    <th
                      className="text-left py-3 px-4 text-[#6B7280]"
                      style={{ fontSize: "0.85rem" }}
                    >
                      ရာထူး
                    </th>
                    <th
                      className="text-left py-3 px-4 text-[#6B7280]"
                      style={{ fontSize: "0.85rem" }}
                    >
                      အခြေအနေ
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
                  {users.map((u) => {
                    const rb = roleBadge(u.role, u.email);
                    const isSA = u.email === SUPER_ADMIN_EMAIL;
                    return (
                      <tr
                        key={u.id}
                        className="border-b border-[#E5E7EB]/60 hover:bg-[#FAF6EC] transition-colors"
                      >
                        <td className="py-3.5 px-4 text-[#1F2937]">
                          {u.display_name}
                        </td>
                        <td
                          className="py-3.5 px-4 text-[#6B7280]"
                          style={{ fontSize: "0.85rem" }}
                        >
                          {u.email}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${rb.bg} ${rb.text} ${rb.border}`}
                            style={{ fontSize: "0.8rem" }}
                          >
                            {isSA && (
                              <ShieldCheck className="w-3.5 h-3.5" />
                            )}
                            {rb.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border bg-green-50 text-[#16A34A] border-green-200"
                            style={{ fontSize: "0.8rem" }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                            အသုံးပြုနေဆဲ
                          </span>
                        </td>
                        <td
                          className="py-3.5 px-4 text-[#6B7280]"
                          style={{ fontSize: "0.85rem" }}
                        >
                          {formatDate(u.created_at)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {isSA ? (
                            <span
                              className="text-[#9CA3AF]"
                              style={{ fontSize: "0.8rem" }}
                            >
                              —
                            </span>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditUser(u);
                                  setEditRole(u.role);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#B8943C] hover:border-[#D6B25E]/40 transition-all cursor-pointer"
                                style={{ fontSize: "0.8rem" }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                ပြင်ရန်
                              </button>
                              <button
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-red-50 hover:text-[#DC2626] hover:border-red-200 transition-all cursor-pointer"
                                style={{ fontSize: "0.8rem" }}
                              >
                                <ShieldOff className="w-3.5 h-3.5" />
                                ပိတ်ရန်
                              </button>
                              <button
                                onClick={() => {
                                  setResetUser(u);
                                  setNewPassword("");
                                  setConfirmPassword("");
                                  setResetError("");
                                  setResetSuccess(false);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#B8943C] hover:border-[#D6B25E]/40 transition-all cursor-pointer"
                                style={{ fontSize: "0.8rem" }}
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                                စကားဝှက် ပြန်သတ်မှတ်ရန်
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Mobile Card List ── */}
            <div className="md:hidden space-y-3">
              {users.map((u) => {
                const rb = roleBadge(u.role, u.email);
                const isSA = u.email === SUPER_ADMIN_EMAIL;
                return (
                  <div
                    key={u.id}
                    className="border border-[#E5E7EB] rounded-[12px] p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-[#1F2937] truncate"
                          style={{ fontSize: "1rem" }}
                        >
                          {u.display_name}
                        </p>
                        <p
                          className="text-[#9CA3AF] truncate"
                          style={{ fontSize: "0.8rem" }}
                        >
                          {u.email}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border ${rb.bg} ${rb.text} ${rb.border} shrink-0 ml-2`}
                        style={{ fontSize: "0.7rem" }}
                      >
                        {isSA && <ShieldCheck className="w-3 h-3" />}
                        {rb.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p
                          className="text-[#9CA3AF]"
                          style={{ fontSize: "0.7rem" }}
                        >
                          အခြေအနေ
                        </p>
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border bg-green-50 text-[#16A34A] border-green-200 mt-0.5"
                          style={{ fontSize: "0.7rem" }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                          အသုံးပြုနေဆဲ
                        </span>
                      </div>
                      <div className="text-right">
                        <p
                          className="text-[#9CA3AF]"
                          style={{ fontSize: "0.7rem" }}
                        >
                          ဖန်တီးသည့်ရက်
                        </p>
                        <p
                          className="text-[#6B7280] mt-0.5"
                          style={{ fontSize: "0.85rem" }}
                        >
                          {formatDate(u.created_at)}
                        </p>
                      </div>
                    </div>
                    {!isSA && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditUser(u);
                              setEditRole(u.role);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#B8943C] transition-all cursor-pointer"
                            style={{ fontSize: "0.8rem" }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            ပြင်ရန်
                          </button>
                          <button
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-red-50 hover:text-[#DC2626] hover:border-red-200 transition-all cursor-pointer"
                            style={{ fontSize: "0.8rem" }}
                          >
                            <ShieldOff className="w-3.5 h-3.5" />
                            ပိတ်ရန်
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            setResetUser(u);
                            setNewPassword("");
                            setConfirmPassword("");
                            setResetError("");
                            setResetSuccess(false);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#FAF6EC] hover:text-[#B8943C] hover:border-[#D6B25E]/40 transition-all cursor-pointer whitespace-nowrap"
                          style={{ fontSize: "0.8rem" }}
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          စကားဝှက် ပြန်သတ်မှတ်ရန်
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ═══════ Create User Modal ═══════ */}
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
              <h3 className="text-[#1F2937]">အသုံးပြုသူအသစ် ထည့်ရန်</h3>
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
              အသုံးပြုသူ အကောင့်အသစ် ထည့်သွင်းရန်။
            </p>

            <div className="space-y-4">
              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-[#6B7280]"
                  style={{ fontSize: "0.75rem" }}
                >
                  အမည်
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="ဥပမာ - ကိုမင်းသန့်"
                  className="w-full px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
                  style={{ fontSize: "0.85rem" }}
                />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-[#6B7280]"
                  style={{ fontSize: "0.75rem" }}
                >
                  အီးမေးလ်
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  placeholder="email@example.com"
                  className="w-full px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
                  style={{ fontSize: "0.85rem" }}
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-[#6B7280]"
                  style={{ fontSize: "0.75rem" }}
                >
                  စကားဝှက်
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="အနည်းဆုံး ၆ လုံး"
                  className="w-full px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
                  style={{ fontSize: "0.85rem" }}
                />
              </div>

              {/* Role */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-[#6B7280]"
                  style={{ fontSize: "0.75rem" }}
                >
                  ရာထူး
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all appearance-none cursor-pointer"
                  style={{ fontSize: "0.85rem" }}
                >
                  {allowedRoles.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {formError && (
                <p className="text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-[12px]" style={{ fontSize: "0.85rem" }}>
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
                onClick={handleCreate}
                disabled={saving}
                className={`px-5 py-2.5 rounded-[10px] text-white transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.08)] flex items-center gap-2 ${
                  saving
                    ? "bg-[#D6B25E]/60 cursor-not-allowed"
                    : "bg-[#D6B25E] hover:bg-[#C4A24D]"
                }`}
                style={{ fontSize: "0.85rem" }}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                အကောင့် ဖန်တီးရန်
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Edit User Modal ═══════ */}
      {editUser && (
        <div
          className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4"
          onClick={() => setEditUser(null)}
        >
          <div
            className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-lg w-full max-w-sm p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[#1F2937]">အသုံးပြုသူ ပြင်ဆင်ရန်</h3>
              <button
                onClick={() => setEditUser(null)}
                className="text-[#9CA3AF] hover:text-[#6B7280] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p
              className="text-[#9CA3AF] mb-6"
              style={{ fontSize: "0.85rem" }}
            >
              <strong className="text-[#1F2937]">
                {editUser.display_name}
              </strong>{" "}
              ၏ ရာထူးကို ပြောင်းလဲရန်
            </p>

            <div className="flex flex-col gap-1.5 mb-6">
              <label
                className="text-[#6B7280]"
                style={{ fontSize: "0.75rem" }}
              >
                ရာထူး
              </label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all appearance-none cursor-pointer"
                style={{ fontSize: "0.85rem" }}
              >
                {allowedRoles.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEditUser(null)}
                className="px-5 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F7F6F3] transition-all cursor-pointer"
                style={{ fontSize: "0.85rem" }}
              >
                မလုပ်တော့ပါ
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                className={`px-5 py-2.5 rounded-[10px] text-white transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.08)] flex items-center gap-2 ${
                  editSaving
                    ? "bg-[#D6B25E]/60 cursor-not-allowed"
                    : "bg-[#D6B25E] hover:bg-[#C4A24D]"
                }`}
                style={{ fontSize: "0.85rem" }}
              >
                {editSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                သိမ်းဆည်းရန်
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Reset Password Modal ═══════ */}
      {resetUser && (
        <div
          className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4"
          onClick={() => setResetUser(null)}
        >
          <div
            className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-lg w-full max-w-sm p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[#1F2937]">စကားဝှက် ပြန်သတ်မှတ်ရန်</h3>
              <button
                onClick={() => setResetUser(null)}
                className="text-[#9CA3AF] hover:text-[#6B7280] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p
              className="text-[#9CA3AF] mb-6"
              style={{ fontSize: "0.85rem" }}
            >
              <strong className="text-[#1F2937]">
                {resetUser.display_name}
              </strong>{" "}
              ၏ စကားဝှက်ကို ပြန်သတ်မှတ်ရန်
            </p>

            <div className="space-y-4">
              {/* New Password */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-[#6B7280]"
                  style={{ fontSize: "0.75rem" }}
                >
                  စကားဝှက်အသစ်
                </label>
                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="အနည်းဆုံး ၆ လုံး"
                    className="w-full px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
                    style={{ fontSize: "0.85rem" }}
                  />
                  <button
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6B7280] hover:text-[#D6B25E] cursor-pointer"
                  >
                    {showNewPw ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-[#6B7280]"
                  style={{ fontSize: "0.75rem" }}
                >
                  စကားဝှက်အတည်ပြုရန်
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="အနည်းဆုံး ၆ လုံး"
                    className="w-full px-4 py-2.5 rounded-[10px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
                    style={{ fontSize: "0.85rem" }}
                  />
                  <button
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6B7280] hover:text-[#D6B25E] cursor-pointer"
                  >
                    {showConfirmPw ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {resetError && (
                <p className="text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-[12px]" style={{ fontSize: "0.85rem" }}>
                  {resetError}
                </p>
              )}
              {resetSuccess && (
                <p className="text-green-600 bg-green-50 border border-green-100 px-3 py-2.5 rounded-[12px] flex items-center gap-2" style={{ fontSize: "0.85rem" }}>
                  <Check className="w-4 h-4" />
                  စကားဝှက် ပြန်သတ်မှတ်ပြီးပါပြီ။
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setResetUser(null)}
                className="px-5 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F7F6F3] transition-all cursor-pointer"
                style={{ fontSize: "0.85rem" }}
              >
                မလုပ်တော့ပါ
              </button>
              <button
                onClick={handleResetSave}
                disabled={resetSaving}
                className={`px-5 py-2.5 rounded-[10px] text-white transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.08)] flex items-center gap-2 ${
                  resetSaving
                    ? "bg-[#D6B25E]/60 cursor-not-allowed"
                    : "bg-[#D6B25E] hover:bg-[#C4A24D]"
                }`}
                style={{ fontSize: "0.85rem" }}
              >
                {resetSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                သိမ်းဆည်းရန်
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Change Own Password Modal ═══════ */}
      {showChangePw && <ChangePassword onClose={() => setShowChangePw(false)} />}
    </div>
  );
}