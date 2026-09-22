import type { ClinicSearchProvider } from "./types";
import { nppes } from "./nppes";

// NPPES is the supported live source because every result includes a stable NPI and
// exact practice location. Web-search snippets cannot safely enter the call-log flow.
export function getSearchProvider(): ClinicSearchProvider {
  return nppes;
}
