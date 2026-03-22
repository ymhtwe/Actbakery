/**
 * Server-side API calls — only for operations requiring SUPABASE_SERVICE_ROLE_KEY.
 * All data operations (items, stock, production, sales, customers) use db.tsx directly.
 */
import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e6160feb/api`;

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
});

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers(), ...options?.headers },
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`API error ${res.status} on ${path}:`, data);
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data;
}

// ── Auth (requires service role key on server) ──
export const signup = (email: string, password: string, role: string, display_name?: string) =>
  request("/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, role, display_name }),
  });

// ── Users (requires service role key to list auth users) ──
export const getUsers = () => request("/users");

// ── Reset Password (requires service role key) ──
export const resetPassword = (user_id: string, new_password: string) =>
  request("/reset-password", {
    method: "POST",
    body: JSON.stringify({ user_id, new_password }),
  });