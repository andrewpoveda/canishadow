import { createClient } from "@supabase/supabase-js";

// Anon client (same pattern as AP MED). Used both server-side (page.tsx fetch under
// RLS "public read") and client-side (public INSERT on contact_logs / controlled UPDATE
// on clinics — MIGRATION.md §2). The anon key is public by design; the service-role key
// is NEVER imported here — it lives only in scripts/ (see scripts/seed-demo.ts).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing Supabase env vars: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
  );
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});
