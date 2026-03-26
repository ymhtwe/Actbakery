import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Cake, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "./supabaseClient";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // On mount: check for an existing Supabase Auth session so we can auto-redirect.
  useEffect(() => {
    // Check whether the user already has an active session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const role = await fetchRole(session.user.id);
        if (role === "admin") {
          navigate("/admin", { replace: true });
          return;
        }
        if (role === "staff") {
          navigate("/staff", { replace: true });
          return;
        }
      }
      setCheckingSession(false);
    });
  }, []);

  // ── Fetch role from public.profiles ──
  async function fetchRole(userId: string): Promise<string | null> {
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Profile fetch error:", profileError.message);
      return null;
    }
    return data?.role ?? null;
  }

  // ── Login handler ──
  const handleLogin = async () => {
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (authError) {
        // Supabase returns messages like "Invalid login credentials"
        setError(authError.message || "Invalid email or password.");
        return;
      }

      const user = authData?.user;
      if (!user) {
        setError("Authentication succeeded but no user was returned.");
        return;
      }

      // 2. Fetch role from public.profiles
      const role = await fetchRole(user.id);

      if (!role) {
        console.error("No profile found for auth user.id:", user.id, "email:", user.email);
        setError(
          "Login succeeded but no profile was found for this account. Please contact an administrator."
        );
        // Sign out so the dangling session doesn't auto-redirect next time
        await supabase.auth.signOut();
        return;
      }

      // 3. Route based on role
      if (role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/staff", { replace: true });
      }
    } catch (e: any) {
      console.error("Login error:", e);
      setError(e.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  // While we are checking for an existing session, show a simple loader
  // so the user doesn't see a flash of the login form before being redirected.
  if (checkingSession) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center bg-[#F7F6F3]"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        <div className="flex items-center gap-2 text-[#9CA3AF]">
          <Loader2 className="w-5 h-5 animate-spin text-[#D6B25E]" />
          <span style={{ fontSize: "0.85rem" }}>Checking session...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center bg-[#F7F6F3] p-4"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="w-full max-w-[420px] bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-10 flex flex-col items-center gap-7">
        {/* Logo */}
        <div className="w-16 h-16 rounded-full bg-[#FAF6EC] border border-[#E5E7EB] flex items-center justify-center">
          <Cake className="w-7 h-7 text-[#D6B25E]" />
        </div>

        {/* Heading */}
        <div className="text-center">
          <h1 className="text-[#1F2937]">အောင်ချမ်းသာ Bakery</h1>
          <p className="text-[#6B7280] mt-1.5">
            Production & Stock Management System
          </p>
        </div>

        {/* Form */}
        <div className="w-full flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-[#1F2937]" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 rounded-[12px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[#1F2937]" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-4 py-3 rounded-[12px] border border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#D6B25E]/30 focus:border-[#D6B25E] transition-all pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-[12px]">
              {error}
            </p>
          )}

          {/* Login button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className={`w-full py-3 rounded-[12px] text-white transition-all mt-1 cursor-pointer flex items-center justify-center gap-2 ${
              loading
                ? "bg-[#D6B25E]/60 cursor-not-allowed"
                : "bg-[#D6B25E] hover:bg-[#B8943C]"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </button>
        </div>

        {/* Footer */}
        <p
          className="text-[#9CA3AF] text-center mt-2"
          style={{ fontSize: "0.8rem" }}
        >
          &copy; 2026 ACT Bakery. All rights reserved.
        </p>
      </div>
    </div>
  );
}