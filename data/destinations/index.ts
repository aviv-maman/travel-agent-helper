import type { SeedDestination } from "../../scripts/extract";

/**
 * Add-on destinations built by the `add-destination` skill — one JSON file per
 * city, in the same `SeedDestination` shape as `data/seed.json` entries.
 *
 * They live OUTSIDE seed.json on purpose: `bun run parse` regenerates that
 * file from the legacy HTML and would wipe anything appended to it. Files here
 * are committed to git (reviewable diffs, backups) and seeded through the same
 * idempotent path as the legacy destinations.
 *
 * To add a city: drop `<code>.json` in this directory and add its import +
 * array entry below (the skill does both).
 */

import prg from "./prg.json";

export const EXTRA_DESTINATIONS: SeedDestination[] = [
  prg as SeedDestination,
];
