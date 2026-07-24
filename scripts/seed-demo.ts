/**
 * scripts/seed-demo.ts — inserts ~8 demo clinics so the map renders before the real
 * NPPES seed pipeline exists (that's scripts/seed-nppes.ts, still a stub — see SPEC.md §Seed).
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS) — server-only, never client-imported.
 * Idempotent: deletes any prior source='demo' rows, then re-inserts.
 *
 * Run:  npm run seed:demo
 *
 * The 8 rows deliberately span both axes (MIGRATION.md §0.1):
 *   colour   = call outcome (green/red/yellow/gray)
 *   verified = trust (true = AP MED team-checked; false = crowdsourced/uncalled)
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing env. Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

type Provider = { name: string; response: "yes" | "no" };

interface DemoClinic {
  name: string;
  address: string;
  city: string;
  state: "NJ" | "NY";
  zip: string;
  lat: number;
  lng: number;
  phone: string | null;
  status: "unknown" | "verified_yes" | "verified_no" | "call_back";
  provider_count: number;
  specialties: string[];
  providers: Provider[];
  contact_email: string | null;
  npi: string | null;
  verified: boolean;
  last_verified: string | null;
  verified_by: string | null;
  notes: string | null;
  source: string;
}

// Phone numbers use the reserved 555-01xx fictional range on purpose — no real offices.
const DEMO: DemoClinic[] = [
  {
    name: "Broad Street Family Medicine",
    address: "744 Broad St",
    city: "Newark",
    state: "NJ",
    zip: "07102",
    lat: 40.7357,
    lng: -74.1724,
    phone: "(973) 555-0142",
    status: "verified_yes",
    provider_count: 4,
    specialties: ["Family Medicine"],
    providers: [{ name: "Dr. Alvarez", response: "yes" }],
    contact_email: "frontdesk@example.com",
    npi: null,
    verified: true,
    last_verified: "2026-07-15",
    verified_by: "Andrew",
    notes: null,
    source: "demo",
  },
  {
    name: "Grove Pediatrics",
    address: "110 Christopher Columbus Dr",
    city: "Jersey City",
    state: "NJ",
    zip: "07302",
    lat: 40.7178,
    lng: -74.0431,
    phone: "(201) 555-0173",
    status: "verified_yes",
    provider_count: 3,
    specialties: ["Pediatrics"],
    providers: [{ name: "Dr. Osei", response: "yes" }],
    contact_email: null,
    npi: null,
    verified: false, // crowdsourced green — a student logged the yes, pending team review
    last_verified: "2026-07-20",
    verified_by: "student",
    notes: null,
    source: "demo",
  },
  {
    name: "Hudson Internal Medicine",
    address: "79 Hudson St",
    city: "Hoboken",
    state: "NJ",
    zip: "07030",
    lat: 40.7439,
    lng: -74.0324,
    phone: "(201) 555-0128",
    status: "verified_no",
    provider_count: 2,
    specialties: ["Internal Medicine"],
    providers: [],
    contact_email: null,
    npi: null,
    verified: true,
    last_verified: "2026-07-16",
    verified_by: "Andrew",
    notes: "Not taking students this year.",
    source: "demo",
  },
  {
    name: "Montclair Community Health",
    address: "29 Park St",
    city: "Montclair",
    state: "NJ",
    zip: "07042",
    lat: 40.8259,
    lng: -74.209,
    phone: "(973) 555-0119",
    status: "verified_no",
    provider_count: 5,
    specialties: ["Family Medicine", "Pediatrics"],
    providers: [],
    contact_email: null,
    npi: null,
    verified: false, // crowdsourced red
    last_verified: "2026-07-21",
    verified_by: "student",
    notes: null,
    source: "demo",
  },
  {
    name: "Murray Hill Primary Care",
    address: "215 Lexington Ave",
    city: "New York",
    state: "NY",
    zip: "10016",
    lat: 40.7459,
    lng: -73.9777,
    phone: "(212) 555-0155",
    status: "call_back",
    provider_count: 6,
    specialties: ["Internal Medicine"],
    providers: [],
    contact_email: null,
    npi: null,
    verified: false,
    last_verified: "2026-07-22",
    verified_by: "student",
    notes: "Asked us to call back after Labor Day.",
    source: "demo",
  },
  {
    name: "East Orange Health Center",
    address: "300 Central Ave",
    city: "East Orange",
    state: "NJ",
    zip: "07017",
    lat: 40.7673,
    lng: -74.2049,
    phone: "(973) 555-0188",
    status: "unknown",
    provider_count: 8,
    specialties: ["Family Medicine"],
    providers: [],
    contact_email: null,
    npi: null,
    verified: false, // not yet called — gray, shows only under "All"
    last_verified: null,
    verified_by: null,
    notes: null,
    source: "demo",
  },
  {
    name: "Lenox Hill Family Practice",
    address: "170 E 77th St",
    city: "New York",
    state: "NY",
    zip: "10021",
    lat: 40.769,
    lng: -73.959,
    phone: "(212) 555-0164",
    status: "verified_yes",
    provider_count: 7,
    specialties: ["Family Medicine", "Internal Medicine"],
    providers: [
      { name: "Dr. Feldman", response: "yes" },
      { name: "Dr. Park", response: "no" },
    ],
    contact_email: "shadowing@example.com",
    npi: null,
    verified: true,
    last_verified: "2026-07-14",
    verified_by: "Andrew",
    notes: null,
    source: "demo",
  },
  {
    name: "Bayonne Medical Associates",
    address: "519 Broadway",
    city: "Bayonne",
    state: "NJ",
    zip: "07002",
    lat: 40.6687,
    lng: -74.1143,
    phone: "(201) 555-0137",
    status: "unknown",
    provider_count: 3,
    specialties: ["Pediatrics"],
    providers: [],
    contact_email: null,
    npi: null,
    verified: false, // not yet called — gray
    last_verified: null,
    verified_by: null,
    notes: null,
    source: "demo",
  },
];

async function main() {
  const { error: delError } = await supabase
    .from("clinics")
    .delete()
    .eq("source", "demo");
  if (delError) {
    console.error("Failed clearing old demo rows:", delError.message);
    process.exit(1);
  }

  const { data, error } = await supabase
    .from("clinics")
    .insert(DEMO)
    .select("id");
  if (error) {
    console.error("Insert failed:", error.message);
    process.exit(1);
  }

  console.log(`Seeded ${data?.length ?? 0} demo clinics.`);
  const byBucket = {
    verified: DEMO.filter((c) => c.verified).length,
    crowdsourced: DEMO.filter(
      (c) => !c.verified && (c.status !== "unknown" || c.providers.length > 0),
    ).length,
    uncalled: DEMO.filter((c) => !c.verified && c.status === "unknown").length,
  };
  console.log("Buckets:", byBucket);
}

main();
