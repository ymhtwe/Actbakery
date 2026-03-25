import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();
app.use('*', logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const P = "/make-server-e6160feb";

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

// ── Health ──
app.get(`${P}/health`, (c) => c.json({ status: "ok" }));

// ══════════════════════════════════════════════════════════════
//  AUTH & USER MANAGEMENT (requires SUPABASE_SERVICE_ROLE_KEY)
// ══════════════════════════════════════════════════════════════

// ── Signup (creates Supabase Auth user + profiles row) ──
app.post(`${P}/api/signup`, async (c) => {
  try {
    const { email, password, role, display_name } = await c.req.json();
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }
    const validRole = role === "admin" ? "admin" : "staff";

    const supabase = getSupabase();

    // Create auth user with email_confirm: true (no email server configured)
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { display_name: display_name || email, role: validRole },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true,
    });

    if (createError) {
      console.log("Signup createUser error:", createError.message);
      return c.json({ error: `Failed to create user: ${createError.message}` }, 400);
    }

    // Insert matching row into public.profiles
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: userData.user.id,
        role: validRole,
        display_name: display_name || email,
      });

    if (profileError) {
      console.log("Signup profile insert error:", profileError.message);
      return c.json({ error: `User created but profile insert failed: ${profileError.message}` }, 500);
    }

    return c.json({
      success: true,
      user_id: userData.user.id,
      email: userData.user.email,
      role: validRole,
    });
  } catch (e: any) {
    console.log("Signup error:", e.message);
    return c.json({ error: `Signup error: ${e.message}` }, 500);
  }
});

// ── List Users (merges Supabase Auth emails with profiles data) ──
app.get(`${P}/api/users`, async (c) => {
  try {
    const supabase = getSupabase();

    // Fetch all auth users (contains email)
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      console.log("List auth users error:", authError.message);
      return c.json({ error: `Failed to list auth users: ${authError.message}` }, 500);
    }

    // Fetch all profiles (contains role, display_name)
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, role, created_at")
      .order("created_at", { ascending: true });

    if (profileError) {
      console.log("List profiles error:", profileError.message);
      return c.json({ error: `Failed to list profiles: ${profileError.message}` }, 500);
    }

    // Build lookup maps
    const authMap = new Map<string, any>();
    for (const u of (authData?.users || [])) {
      authMap.set(u.id, u);
    }
    const profileMap = new Map<string, any>();
    for (const p of (profiles || [])) {
      profileMap.set(p.id, p);
    }

    // Merge: profiles as base, enrich with email from auth
    const users = (profiles || []).map((p: any) => {
      const authUser = authMap.get(p.id);
      return {
        id: p.id,
        display_name: p.display_name || authUser?.user_metadata?.display_name || "—",
        email: authUser?.email || "—",
        role: p.role || "staff",
        status: "Active",
        created_at: p.created_at || authUser?.created_at || "",
      };
    });

    // Also include auth users that have no matching profile row
    for (const u of (authData?.users || [])) {
      if (!profileMap.has(u.id)) {
        users.push({
          id: u.id,
          display_name: u.user_metadata?.display_name || u.email || "—",
          email: u.email || "—",
          role: u.user_metadata?.role || "staff",
          status: "Active",
          created_at: u.created_at || "",
        });
      }
    }

    return c.json(users);
  } catch (e: any) {
    console.log("List users error:", e.message);
    return c.json({ error: `List users error: ${e.message}` }, 500);
  }
});

// ── Reset Password (admin resets a user's password) ──
app.post(`${P}/api/reset-password`, async (c) => {
  try {
    const { user_id, new_password } = await c.req.json();
    if (!user_id || !new_password) {
      return c.json({ error: "user_id and new_password are required" }, 400);
    }
    if (new_password.length < 6) {
      return c.json({ error: "Password must be at least 6 characters" }, 400);
    }

    const supabase = getSupabase();

    const { data, error } = await supabase.auth.admin.updateUserById(user_id, {
      password: new_password,
    });

    if (error) {
      console.log("Reset password error:", error.message);
      return c.json({ error: `Failed to reset password: ${error.message}` }, 400);
    }

    return c.json({
      success: true,
      user_id: data.user.id,
      message: "Password reset successfully",
    });
  } catch (e: any) {
    console.log("Reset password error:", e.message);
    return c.json({ error: `Reset password error: ${e.message}` }, 500);
  }
});

Deno.serve(app.fetch);