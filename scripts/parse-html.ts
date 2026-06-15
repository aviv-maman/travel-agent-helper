/** Runs the extractor and writes data/seed.json + prints a summary. */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { extractSeed } from "./extract";

const data = extractSeed();

mkdirSync(join(process.cwd(), "data"), { recursive: true });
const out = join(process.cwd(), "data", "seed.json");
writeFileSync(out, JSON.stringify(data, null, 2), "utf8");

let hotelCount = 0;
let distCount = 0;
let featCount = 0;
console.log("Destinations:");
for (const d of data) {
  hotelCount += d.hotels.length;
  d.hotels.forEach((h) => {
    distCount += h.distances.length;
    featCount += h.features.length;
  });
  console.log(
    `  ${d.iata.padEnd(4)} ${(d.name.en ?? "").padEnd(13)} hotels=${String(
      d.hotels.length,
    ).padStart(3)}  landmarks=${d.landmarks.length}`,
  );
}
console.log(
  `\nTotals: ${data.length} destinations, ${hotelCount} hotels, ${featCount} features, ${distCount} distances`,
);
console.log(`Wrote ${out}`);
