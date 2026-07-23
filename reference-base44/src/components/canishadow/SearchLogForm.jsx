import React, { useState } from "react";
import moment from "moment";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";

const OUTCOMES = [
  { key: "yes", label: "Said yes" },
  { key: "no", label: "Said no" },
  { key: "call_back", label: "Call back later" },
];
const STATUS_FOR = { yes: "verified_yes", no: "verified_no", call_back: "call_back" };

export default function SearchLogForm({ result }) {
  const [form, setForm] = useState({
    name: result.title, phone: result.phones[0] || "", address: "", city: "",
    state: "NJ", zip: "", outcome: "yes", yourName: "", contactEmail: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedId, setSavedId] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const inputClass =
    "w-full rounded-pill border border-line bg-paper px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink";

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const geo = await base44.functions.invoke("geocodeAddress", {
      address: form.address, city: form.city, state: form.state, zip: form.zip,
    });
    if (!geo.data?.matched) {
      setSaving(false);
      setError("Couldn't locate that address — check the street, city and zip.");
      return;
    }
    const clinic = await base44.entities.Clinic.create({
      name: form.name, address: form.address, city: form.city, state: form.state,
      zip: form.zip, lat: geo.data.lat, lng: geo.data.lng, phone: form.phone,
      status: STATUS_FOR[form.outcome], provider_count: 1, specialties: [],
      contact_email: form.contactEmail || undefined,
      last_verified: moment().format("YYYY-MM-DD"),
      verified_by: form.yourName || "student", source: "student_search",
    });
    await base44.entities.ContactLog.create({
      clinic_id: clinic.id, outcome: form.outcome, notes: form.notes,
      logged_by: form.yourName, contact_email: form.contactEmail,
    });
    setSaving(false);
    setSavedId(clinic.id);
  };

  if (savedId) {
    return (
      <div className="mt-3 rounded-sheet bg-verified-tint p-4">
        <p className="text-[13px] font-medium text-verified">Logged — the clinic is now on the map.</p>
        <Link to={`/?clinic=${savedId}`} className="mt-1 inline-block text-[13px] font-medium text-ink underline">
          View on map
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2.5 rounded-sheet bg-paper-2 p-4">
      <div className="flex flex-wrap gap-1.5">
        {OUTCOMES.map((o) => (
          <button key={o.key} type="button" onClick={() => setForm({ ...form, outcome: o.key })}
            className={`min-h-[36px] rounded-pill px-3.5 text-[13px] font-medium ${form.outcome === o.key ? "bg-ink text-paper" : "bg-paper text-ink-2"}`}>
            {o.label}
          </button>
        ))}
      </div>
      <input value={form.name} onChange={set("name")} placeholder="Clinic name" required className={inputClass} />
      <input value={form.phone} onChange={set("phone")} placeholder="Phone" className={inputClass} />
      <input value={form.address} onChange={set("address")} placeholder="Street address" required className={inputClass} />
      <div className="flex gap-2">
        <input value={form.city} onChange={set("city")} placeholder="City" required className={inputClass} />
        <select value={form.state} onChange={set("state")} className="rounded-pill border border-line bg-paper px-3 text-[13px] text-ink">
          <option value="NJ">NJ</option>
          <option value="NY">NY</option>
        </select>
        <input value={form.zip} onChange={set("zip")} placeholder="Zip" required className={`${inputClass} max-w-[100px]`} />
      </div>
      <input value={form.yourName} onChange={set("yourName")} placeholder="Your name" className={inputClass} />
      <input value={form.contactEmail} onChange={set("contactEmail")} type="email" placeholder="Clinic contact email — optional" className={inputClass} />
      <textarea value={form.notes} onChange={set("notes")} placeholder="Notes" rows={2}
        className="w-full rounded-sheet border border-line bg-paper px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink" />
      {error && <p className="text-[13px] text-declined">{error}</p>}
      <button type="submit" disabled={saving} className="min-h-[44px] w-full rounded-pill bg-ink text-[13px] font-medium text-paper disabled:opacity-60">
        {saving ? "Saving…" : "Add to map & log call"}
      </button>
    </form>
  );
}