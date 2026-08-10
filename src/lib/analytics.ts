import posthog from "posthog-js";

// Typed event catalog — event names + property shapes live in one place (no magic
// strings in components). `posthog` is a no-op singleton until init() runs in
// providers.tsx, which only happens when NEXT_PUBLIC_POSTHOG_KEY is set — so every
// track() call is safe/silent when analytics is off (app still ships on $0).
type EventMap = {
  clinic_searched: {
    city: string;
    state: string;
    specialty: string | null;
    result_count: number;
  };
  call_logged: {
    clinic_id: string;
    outcome: string;
    resulting_status: string;
    has_provider: boolean;
  };
  clinic_added: {
    outcome: string;
    state: string;
    has_npi: boolean;
  };
};

export function track<K extends keyof EventMap>(event: K, props: EventMap[K]) {
  posthog.capture(event, props);
}
