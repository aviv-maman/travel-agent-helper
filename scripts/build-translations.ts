/**
 * Builds data/translations.json — a Hebrew → English map for the editorial
 * strings that come from the (Hebrew-only) source HTML. Keys are taken straight
 * from the data so they always match exactly; the English values below are in
 * the same order the unique Hebrew strings first appear in data/seed.json.
 *
 * Run with: `bun run build:translations` (then `bun run parse`).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const EN: string[] = [
  // Batumi
  "⚠️ Important note: When entering Georgia, travelers are required to present medical insurance in English.",
  "Batumi is a port city on Georgia's Black Sea coast, the capital of Adjara. The city blends Soviet and modern architecture, casinos, a long seaside promenade and a Mediterranean atmosphere.",
  "🏰 Main sights: Seaside Boulevard · Piazza · Love Bridge · Botanical Garden · Georgian Alphabet Tower",
  "Local currency: Georgian Lari (GEL) · Approx. rate: 1 Lari ≈ ₪1.09",
  "📍 Points of interest: 🏛 Europe Square — the historic city axis, museum and cultural sites ✡ Chabad House Batumi — a landmark for Israeli visitors",
  "✈ Airport — BUS (Aleksandre Kartveli)",
  "Distance: ~2 km from the city center · Travel time: 5–10 minutes",
  "Bus line 10",
  "Rustaveli Street · Nominal fare",
  "Bolt",
  "To the city center",
  "Taxi / GoTrip.ge",
  "Fixed price per car, arranged in advance",
  "Info per the official Marriott site",
  "Double — city or sea view",
  "Double — high floors, includes Club Lounge",
  "Triple",
  "Info per Booking and J2Ski",
  "Double — king bed",
  "Double — two separate beds",
  "Triple — 3 beds",
  "Info per the official Radisson site and locahotels",
  "Double",
  "Double — city view",
  "Double / triple + child",
  "Double — more spacious than Superior",
  "Info per Marriott, Holidify and Travelated (388–818 sq ft)",
  "Double — City View",
  "Double — City/Sea View + balcony",
  "Double / triple — Sea View + balcony",
  "Info per the Marriott site and Booking",
  "Triple/family — sea view + balcony",
  "Info per J2Ski and Booking",
  "Double — two beds, City View",
  "Double — includes a fireplace in the room",
  "Info per the official Wyndham site",
  "Double — more spacious",
  "Info per Trip.com and Booking — especially spacious rooms",
  // Budapest
  "Budapest is divided into two cities: Buda (the hilly, western side — palace, citadel, quiet neighborhoods) and Pest (the flat, eastern side — commerce, nightlife, the main tourist attractions). Most hotels for travelers are in Pest.",
  "🏛 Main sights: The Hungarian Parliament · Chain Bridge · Buda Castle · Dohány Street Synagogue (the largest in Europe) · the Baroque buildings of Andrássy út · the thermal baths (Széchenyi, Gellért)",
  "Local currency: Hungarian Forint (HUF) · Approx. rate: ₪1 ≈ 107 Forint",
  "✈ Airport — BUD (Ferenc Liszt)",
  "Distance: ~24 km from the city center · Travel time: 30–45 minutes",
  "Line 100E",
  "To Deák Ferenc tér · ~40 min",
  "FőTaxi",
  "Official · ~30 min · credit card",
  "Bolt / Uber",
  "~25–30 min · pickup outside the airport",
  // Athens
  "Athens is the capital of Greece and one of Europe's most important historic cities. The tourist center is very walkable and centers around Syntagma, Plaka, Monastiraki and Ermou Street — an area of shopping, restaurants, classical sites and city life.",
  "🏰 Main sights: The Acropolis · Plaka · Ermou Street · Syntagma Square · Omonia Square",
  "Local currency: Euro (EUR) · Approx. rate: 1 Euro ≈ ₪3.38",
  "📍 Points of interest: 🏛 Syntagma Square — the heart of the city: transport, shopping and central hotels 🚶 Ermou Street — the main pedestrian shopping street 🏛️ Plaka — the old, picturesque area below the Acropolis 📍 Omonia Square — a northern reference point to the center",
  "✈ Airport — ATH (Eleftherios Venizelos)",
  "Distance: ~35 km from the city center · Travel time: 35–50 minutes",
  "Metro / train",
  "To Syntagma / Monastiraki",
  "Bus X95",
  "To Syntagma Square · approx. 50–60 min",
  "Taxi / Uber",
  // Thessaloniki
  "Thessaloniki is a major port city in northern Greece, with a long promenade, good food, nightlife, Jewish history and points of interest within easy walking distance in the city center.",
  "🏰 Main sights: Aristotelous Square · Ladadika district · the White Tower · the promenade · Modiano Market",
  "📍 Points of interest: 🏛 Aristotelous Square — the heart of the tourist center, on the city's main axis 🏙 Ladadika district — an area of entertainment, restaurants and nightlife",
  "✈ Airport — SKG (Makedonia)",
  "Distance: ~15–17 km from the city center · Travel time: 20–30 minutes",
  "Bus 01X/01N",
  "To the city center · approx. 40–50 min",
  "Taxi",
  "Bolt / private transfer",
  // Tbilisi
  "Tbilisi is the capital of Georgia and the country's central city. It blends an old town, sulfur baths, wide boulevards, cafés, restaurants and lookout points above the Kura River.",
  "🏰 Main sights: Freedom Square · Meidan Square · Rustaveli Avenue · the Old Town · the sulfur baths · Narikala Fortress",
  "📍 Points of interest: 🏛 Freedom Square — the heart of the tourist and business center 📍 Meidan Square — the gateway to the Old Town and the entertainment area 🚶 Rustaveli Avenue — a central avenue with museums, shops and hotels ✡ Chabad House Tbilisi — a landmark for Israeli visitors",
  "✈ Airport — TBS (Shota Rustaveli)",
  "Distance: ~17 km from the city center · Travel time: 20–30 minutes",
  "City bus",
  "To the city center · approx. 45–60 min",
  // Sofia
  "Sofia is the capital of Bulgaria and the country's central city. It blends shopping boulevards, historic squares, churches and cathedrals, cafés, restaurants and hotels in the city center.",
  "🏰 Main sights: Vitosha Blvd · Alexander Nevsky Cathedral · the Serdika area · the Sofia Synagogue · the Central Market",
  "Local currency: Bulgarian Lev (BGN) · Approx. rate: 1 Lev ≈ ₪1.72",
  "📍 Points of interest: 🚶 Vitosha Blvd — the main shopping and entertainment area ✡ Synagogue / Market — a central area near Serdika and the Central Market ⛪ Alexander Nevsky Cathedral — one of Sofia's main landmarks",
  "✈ Airport — SOF (Sofia Airport)",
  "Distance: ~10 km from the city center · Travel time: ~20–30 minutes, depending on traffic",
  "Metro",
  "Toward the city center / Serdika",
  "Taxi app",
  "Official taxi",
  "Recommended to confirm the price/meter before the ride",
  // Bucharest
  "Bucharest is the capital of Romania and one of the major cities of Eastern Europe. The main tourist area stretches between Victoriei Avenue, the Old Town, Revolution Square, the Romanian Athenaeum and the Palace of Parliament area.",
  "🏰 Main sights: Calea Victoriei · the Old Town (Lipscani) · the Romanian Athenaeum · Revolution Square · the Palace of Parliament",
  "Local currency: Romanian Leu (RON) · Approx. rate: ₪1 ≈ 1.56 Lei",
  "📍 Points of interest: 🚶 Calea Victoriei — an avenue of hotels, shopping, culture and historic buildings 🏛 the Old Town (Lipscani) — an area of entertainment, restaurants, bars and historic alleys",
  "✈ Airport — OTP (Henri Coandă)",
  "Distance: ~17 km from the city center · Travel time: usually ~25–45 minutes, depending on traffic and hotel location",
  "Train",
  "From the airport toward Gara de Nord, then continue to the center",
  "Uber / Bolt",
  "Convenient for hotels in the city center and the Old Town",
  "Recommended to book from the official stand or confirm the price/meter",
];

type Loc = { he?: string };
function collectHebrew(): string[] {
  const seed = JSON.parse(
    readFileSync(join(process.cwd(), "data", "seed.json"), "utf8"),
  );
  const seen = new Set<string>();
  const order: string[] = [];
  const add = (v: Loc | null | undefined) => {
    if (v && v.he && !seen.has(v.he)) {
      seen.add(v.he);
      order.push(v.he);
    }
  };
  for (const dest of seed) {
    const info = dest.info ?? {};
    (info.warnings ?? []).forEach(add);
    add(info.about);
    add(info.attractions);
    add(info.currencyNote);
    add(info.landmarks);
    if (info.airport) {
      add(info.airport.title);
      add(info.airport.note);
    }
    (info.transport ?? []).forEach((r: { mode?: Loc; detail?: Loc }) => {
      add(r.mode);
      add(r.detail);
    });
    for (const h of dest.hotels) {
      add(h.roomsNote);
      for (const r of h.rooms) add(r.occupancy);
    }
  }
  return order;
}

const he = collectHebrew();
if (he.length !== EN.length) {
  console.error(
    `Translation count mismatch: ${he.length} Hebrew strings but ${EN.length} English. ` +
      `Re-run after syncing the EN array with the data order.`,
  );
  process.exit(1);
}

const map: Record<string, string> = {};
he.forEach((h, i) => {
  map[h] = EN[i];
});

const out = join(process.cwd(), "data", "translations.json");
writeFileSync(out, JSON.stringify(map, null, 2) + "\n", "utf8");
console.log(`Wrote ${he.length} translations → ${out}`);
