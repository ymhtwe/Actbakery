import { useState } from "react";
import { Eye, EyeOff, X, Loader2, Info } from "lucide-react";
import { supabase } from "./supabaseClient";
import { useNavigate } from "react-router";
import { toast } from "sonner";

interface ChangePasswordProps {
  onClose: () => void;
}

export function ChangePassword({ onClose }: ChangePasswordProps) {
  const navigate = useNavigate();

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ current?: string; newPw?: string; confirm?: string; general?: string }>({});
  const [touched, setTouched] = useState(false);

  function validate() {
    const e: typeof errors = {};
    if (!currentPw) e.current = "လက်ရှိ စကားဝှက် ထည့်သွင်းပါ။";
    if (!newPw) {
      e.newPw = "စကားဝှက်အသစ် ထည့်သွင်းပါ။";
    } else if (newPw.length < 8) {
      e.newPw = "စကားဝှက် အနည်းဆုံး ၈ လုံး ရှိရပါမည်။";
    }
    if (!confirmPw) {
      e.confirm = "စကားဝှက်အသစ် အတည်ပြုရန် ထည့်သွင်းပါ။";
    } else if (newPw && confirmPw !== newPw) {
      e.confirm = "စကားဝှက်များ တူညီမှုမရှိပါ။";
    }
    return e;
  }

  const liveErrors = touched ? validate() : {};

  async function handleSubmit() {
    setTouched(true);
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setErrors({ general: "Session မရှိပါ။ ပြန်လည်ဝင်ရောက်ပါ။" });
        setTimeout(() => navigate("/"), 2000);
        return;
      }

      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: session.user.email!,
        password: currentPw,
      });
      if (signInError) {
        setErrors({ current: "လက်ရှိ စကားဝှက် မှားယွင်းနေပါသည်။" });
        setSaving(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPw });
      if (updateError) {
        setErrors({ general: `စကားဝှက် ပြောင်းလဲရာတွင် အမှားရှိပါသည်: ${updateError.message}` });
        setSaving(false);
        return;
      }

      toast.success("စကားဝှက် ပြောင်းလဲပြီးပါပြီ။", {
        style: {
          background: "#F0FDF4",
          border: "1px solid #BBF7D0",
          color: "#166534",
          borderRadius: "12px",
        },
      });
      onClose();
    } catch (e: any) {
      console.error("Change password error:", e);
      setErrors({ general: e.message || "စကားဝှက် ပြောင်းလဲရာတွင် အမှားရှိပါသည်။" });
    } finally {
      setSaving(false);
    }
  }

  // Password strength
  function getStrength(pw: string) {
    if (!pw) return null;
    if (pw.length < 8) return { label: "အားနည်းသည်", color: "text-red-500", bg: "bg-red-500", width: "w-1/4" };
    const hasUpper = /[A-Z]/.test(pw);
    const hasLower = /[a-z]/.test(pw);
    const hasDigit = /\d/.test(pw);
    const hasSpecial = /[^A-Za-z0-9]/.test(pw);
    const score = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;
    if (score <= 1) return { label: "အားနည်းသည်", color: "text-red-500", bg: "bg-red-500", width: "w-1/4" };
    if (score === 2) return { label: "သင့်တင့်သည်", color: "text-amber-500", bg: "bg-amber-500", width: "w-2/4" };
    if (score === 3) return { label: "ကောင်းသည်", color: "text-blue-500", bg: "bg-blue-500", width: "w-3/4" };
    return { label: "အားကောင်းသည်", color: "text-green-600", bg: "bg-green-600", width: "w-full" };
  }

  const strength = getStrength(newPw);

  const inputBase = "w-full px-4 py-2.5 pr-11 rounded-[10px] border bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all";
  const inputErr = "border-red-300 focus:ring-red-200 focus:border-red-400";
  const inputOk = "border-[#E5E7EB]";

  return (
    <div
      className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-lg w-full max-w-md p-7"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[#1F2937]">စကားဝှက်ပြောင်းရန်</h3>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#6B7280] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[#9CA3AF] mb-6" style={{ fontSize: "0.85rem" }}>
          သင့်အကောင့်၏ စကားဝှက်ကို ပြောင်းလဲသတ်မှတ်ရန်
        </p>

        <div className="space-y-4">
          {/* General error */}
          {errors.general && (
            <p className="text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-[12px]" style={{ fontSize: "0.85rem" }}>
              {errors.general}
            </p>
          )}

          {/* Current Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
              လက်ရှိ စကားဝှက်
            </label>
            <div className="relative">
              <input
                type={showCurrentPw ? "text" : "password"}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="လက်ရှိ စကားဝှက် ထည့်ပါ"
                className={`${inputBase} ${liveErrors.current || errors.current ? inputErr : inputOk}`}
                style={{ fontSize: "0.85rem" }}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#D6B25E] cursor-pointer"
              >
                {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {(liveErrors.current || errors.current) && (
              <p className="text-red-500" style={{ fontSize: "0.75rem" }}>
                {liveErrors.current || errors.current}
              </p>
            )}
          </div>

          {/* New Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
              စကားဝှက်အသစ်
            </label>
            <div className="relative">
              <input
                type={showNewPw ? "text" : "password"}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="စကားဝှက်အသစ် ထည့်ပါ"
                className={`${inputBase} ${liveErrors.newPw ? inputErr : inputOk}`}
                style={{ fontSize: "0.85rem" }}
              />
              <button
                type="button"
                onClick={() => setShowNewPw(!showNewPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#D6B25E] cursor-pointer"
              >
                {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Strength bar */}
            {newPw && strength && (
              <div className="space-y-1 mt-0.5">
                <div className="w-full h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${strength.bg} ${strength.width}`} />
                </div>
                <p className={strength.color} style={{ fontSize: "0.7rem" }}>
                  အားအဆင့် - {strength.label}
                </p>
              </div>
            )}
            {!newPw && (
              <p className="text-[#9CA3AF]" style={{ fontSize: "0.7rem" }}>
                အနည်းဆုံး ၈ လုံး၊ စာလုံးအကြီးအသေး၊ ဂဏန်း၊ အထူးသင်္ကေတ ပါဝင်သင့်ပါသည်။
              </p>
            )}
            {liveErrors.newPw && (
              <p className="text-red-500" style={{ fontSize: "0.75rem" }}>{liveErrors.newPw}</p>
            )}
          </div>

          {/* Confirm New Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
              စကားဝှက်အသစ် အတည်ပြုရန်
            </label>
            <div className="relative">
              <input
                type={showConfirmPw ? "text" : "password"}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="စကားဝှက်အသစ် ထပ်မံထည့်ပါ"
                className={`${inputBase} ${liveErrors.confirm ? inputErr : inputOk}`}
                style={{ fontSize: "0.85rem" }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw(!showConfirmPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#D6B25E] cursor-pointer"
              >
                {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {liveErrors.confirm && (
              <p className="text-red-500" style={{ fontSize: "0.75rem" }}>{liveErrors.confirm}</p>
            )}
          </div>
        </div>

        {/* Info text */}
        <div className="flex items-start gap-2 mt-5 mb-5">
          <Info className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0 mt-0.5" />
          <p className="text-[#9CA3AF]" style={{ fontSize: "0.7rem" }}>
            ဝင်ရောက်ထားသော Admin အကောင့်၏ စကားဝှက်ကိုသာ ပြောင်းလဲနိုင်ပါသည်။
          </p>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F7F6F3] transition-all cursor-pointer"
            style={{ fontSize: "0.85rem" }}
          >
            ပယ်ဖျက်မည်
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className={`px-5 py-2.5 rounded-[10px] text-white transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.08)] flex items-center gap-2 ${
              saving ? "bg-[#D6B25E]/60 cursor-not-allowed" : "bg-[#D6B25E] hover:bg-[#C4A24D]"
            }`}
            style={{ fontSize: "0.85rem" }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            စကားဝှက်ပြောင်းမည်
          </button>
        </div>
      </div>
    </div>
  );
}
