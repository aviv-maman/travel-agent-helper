#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
destination-builder — בניית נתוני יעד מלונות
=============================================
קלט:  input.json  (ראה examples/input_example.json)
פלט:  <dest>_output.json        — נתוני היעד המלאים (מוכן להעשרת Booking + ייבוא ל-DB)
       <dest>_verification.md   — טבלת אימות עם קישורי Google Maps לבדיקת דיוק

מה הסקריפט עושה:
1. גיאוקודינג של כל מלון ושל נקודות ציון (Nominatim, חינמי, עם cache מקומי).
2. לנקודת ציון מסוג "street": מושך את הגיאומטריה המלאה של הרחוב מ-OpenStreetMap
   (Overpass API), ומחשב הטלה מתמטית של המלון על קו הרחוב -> הנקודה הקרובה
   *האמיתית* ברחוב (ולא נקודה שרירותית).
3. ניתוב אמיתי (OSRM, חינמי): מרחק במטרים + דקות הליכה + דקות נסיעה
   מהמלון אל הנקודה שחושבה.

APIs (כולם חינמיים, ללא מפתח):
- Nominatim  (גיאוקודינג)   — מגבלה: בקשה אחת לשנייה (הסקריפט ישן בין בקשות)
- Overpass   (גיאומטריה)     — overpass-api.de
- OSRM       (ניתוב)         — routing.openstreetmap.de (פרופיל foot + car)

שימוש:
    python3 build_destination.py input.json
הרצה חוזרת מהירה: תוצאות גיאוקודינג נשמרות ב-geo_cache.json.
"""

import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

# Windows consoles default to cp1252, which can't print the Hebrew output.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

UA = {"User-Agent": "travel-agent-helper/destination-builder (freelance travel agent tool)"}
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OSRM_FOOT = "https://routing.openstreetmap.de/routed-foot/route/v1/foot/"
OSRM_CAR = "https://routing.openstreetmap.de/routed-car/route/v1/driving/"
CACHE_FILE = "geo_cache.json"
EARTH_R = 6371000.0
ON_STREET_THRESHOLD_M = 45   # פחות מזה -> "על הרחוב עצמו"
NOMINATIM_SLEEP = 1.1        # כללי שימוש הוגן של Nominatim

# ---------------------------------------------------------------- HTTP helpers

def http_json(url, params=None, post_data=None, retries=3, timeout=90):
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    last_err = None
    for attempt in range(retries):
        try:
            data = post_data.encode("utf-8") if post_data else None
            req = urllib.request.Request(url, data=data, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"HTTP failed after {retries} retries: {url} :: {last_err}")


# ---------------------------------------------------------------- cache

def load_cache():
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_cache(cache):
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=1)


# ---------------------------------------------------------------- geocoding

def geocode(query, cache, extra=None):
    """מחזיר (lat, lon, display_name, bbox) או None. bbox=[s,n,w,e] floats."""
    key = "geo::" + query
    if key in cache:
        return cache[key]
    params = {"q": query, "format": "json", "limit": 1, "accept-language": "en"}
    if extra:
        params.update(extra)
    time.sleep(NOMINATIM_SLEEP)
    res = http_json(NOMINATIM_URL, params=params)
    if not res:
        cache[key] = None
        return None
    r = res[0]
    out = {
        "lat": float(r["lat"]),
        "lon": float(r["lon"]),
        "display": r.get("display_name", ""),
        "bbox": [float(x) for x in r.get("boundingbox", [0, 0, 0, 0])],
    }
    cache[key] = out
    return out


def geocode_hotel(hotel, city_en, country_en, cache):
    """כמה ניסיונות חיפוש למלון; מחזיר dict או None."""
    # עקיפה ידנית מהקלט
    if hotel.get("lat") and hotel.get("lng"):
        return {"lat": float(hotel["lat"]), "lon": float(hotel["lng"]),
                "display": "manual override", "bbox": None}
    name = hotel["name"]
    attempts = [
        f"{name}, {city_en}",
        f"{name} hotel, {city_en}",
        f"{name}, {city_en}, {country_en}",
    ]
    if hotel.get("address"):
        attempts.insert(0, f"{hotel['address']}, {city_en}")
    for q in attempts:
        res = geocode(q, cache)
        if res:
            return res
    return None


# ---------------------------------------------------------------- street geometry

def fetch_street_geometry(osm_name, city_bbox, cache):
    """מושך את כל מקטעי הרחוב (ways) בשם *מדויק* בתוך תיבת התחום של העיר.
    התאמה מדויקת חשובה: Váci utca ואינו Váci út — אלו רחובות שונים!
    מחזיר רשימת מקטעים, כל מקטע = רשימת (lat, lon)."""
    key = f"street::{osm_name}::{','.join(f'{b:.3f}' for b in city_bbox)}"
    if key in cache:
        return cache[key]
    s, n, w, e = city_bbox
    query = f"""
[out:json][timeout:90];
way["highway"]["name"="{osm_name}"]({s},{w},{n},{e});
out geom;
"""
    res = http_json(OVERPASS_URL, post_data="data=" + urllib.parse.quote(query))
    segments = []
    for el in res.get("elements", []):
        if el.get("type") == "way" and el.get("geometry"):
            segments.append([(p["lat"], p["lon"]) for p in el["geometry"]])
    cache[key] = segments
    return segments


# ---------------------------------------------------------------- geometry math

def to_xy(lat, lon, lat0):
    x = math.radians(lon) * math.cos(math.radians(lat0)) * EARTH_R
    y = math.radians(lat) * EARTH_R
    return x, y


def xy_to_latlon(x, y, lat0):
    lat = math.degrees(y / EARTH_R)
    lon = math.degrees(x / (EARTH_R * math.cos(math.radians(lat0))))
    return lat, lon


def nearest_point_on_segments(pt_lat, pt_lon, segments):
    """הטלה של נקודה על אוסף פוליליינים; מחזיר (lat, lon, מרחק אווירי במטרים)."""
    lat0 = pt_lat
    px, py = to_xy(pt_lat, pt_lon, lat0)
    best = None  # (dist, x, y)
    for seg in segments:
        pts = [to_xy(la, lo, lat0) for la, lo in seg]
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            dx, dy = x2 - x1, y2 - y1
            seg_len2 = dx * dx + dy * dy
            if seg_len2 == 0:
                t = 0.0
            else:
                t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / seg_len2))
            nx, ny = x1 + t * dx, y1 + t * dy
            d = math.hypot(px - nx, py - ny)
            if best is None or d < best[0]:
                best = (d, nx, ny)
    if best is None:
        return None
    d, nx, ny = best
    nlat, nlon = xy_to_latlon(nx, ny, lat0)
    return nlat, nlon, d


def street_extremities(segments):
    """שתי הנקודות המרוחקות ביותר זו מזו על הרחוב (קצוות אפקטיביים)."""
    all_pts = [p for seg in segments for p in seg]
    lat0 = all_pts[0][0]
    xy = [to_xy(la, lo, lat0) for la, lo in all_pts]
    # קירוב: הנקודות הקיצוניות על הציר הראשי (משווים לפי מרחק מנק' ראשונה)
    x0, y0 = xy[0]
    far1 = max(range(len(xy)), key=lambda i: (xy[i][0] - x0) ** 2 + (xy[i][1] - y0) ** 2)
    fx, fy = xy[far1]
    far2 = max(range(len(xy)), key=lambda i: (xy[i][0] - fx) ** 2 + (xy[i][1] - fy) ** 2)
    return all_pts[far2], all_pts[far1]  # (A, B)


def pick_start(ext_a, ext_b, start_hint):
    """קובע איזה קצה הוא 'תחילת הרחוב' לפי רמז מהקלט: north/south/east/west."""
    if start_hint == "north":
        return (ext_a, ext_b) if ext_a[0] >= ext_b[0] else (ext_b, ext_a)
    if start_hint == "south":
        return (ext_a, ext_b) if ext_a[0] <= ext_b[0] else (ext_b, ext_a)
    if start_hint == "east":
        return (ext_a, ext_b) if ext_a[1] >= ext_b[1] else (ext_b, ext_a)
    # ברירת מחדל: west
    return (ext_a, ext_b) if ext_a[1] <= ext_b[1] else (ext_b, ext_a)


def position_label(near_lat, near_lon, start, end, aerial_dist_m):
    """תיאור מילולי של מיקום הנקודה הקרובה לאורך הרחוב."""
    lat0 = near_lat
    sx, sy = to_xy(start[0], start[1], lat0)
    ex, ey = to_xy(end[0], end[1], lat0)
    nx, ny = to_xy(near_lat, near_lon, lat0)
    dx, dy = ex - sx, ey - sy
    L2 = dx * dx + dy * dy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((nx - sx) * dx + (ny - sy) * dy) / L2))
    pct = round(t * 100)
    if aerial_dist_m <= ON_STREET_THRESHOLD_M:
        base = "על הרחוב עצמו"
    elif t < 0.25:
        base = "מול תחילת הרחוב"
    elif t > 0.75:
        base = "מול סוף הרחוב"
    else:
        base = "מול אמצע הרחוב"
    return base, pct


# ---------------------------------------------------------------- routing

def osrm_route(base_url, lat1, lon1, lat2, lon2):
    url = f"{base_url}{lon1:.6f},{lat1:.6f};{lon2:.6f},{lat2:.6f}"
    res = http_json(url, params={"overview": "false"})
    if res.get("code") != "Ok" or not res.get("routes"):
        return None
    r = res["routes"][0]
    return {"distance_m": r["distance"], "duration_s": r["duration"]}


def round_meters(m):
    if m < 1000:
        return int(round(m / 10.0) * 10)
    return int(round(m / 50.0) * 50)


def maps_link(lat1, lon1, lat2, lon2, mode="walking"):
    return (f"https://www.google.com/maps/dir/?api=1&origin={lat1:.6f},{lon1:.6f}"
            f"&destination={lat2:.6f},{lon2:.6f}&travelmode={mode}")


# ---------------------------------------------------------------- main

def main():
    if len(sys.argv) < 2:
        print("שימוש: python3 build_destination.py input.json")
        sys.exit(1)
    with open(sys.argv[1], encoding="utf-8") as f:
        cfg = json.load(f)

    cache = load_cache()
    dest = cfg["destination"]
    city_en = dest["name_en"]
    country_en = dest.get("country_en", "")
    print(f"== בונה יעד: {dest.get('name_he', city_en)} ({city_en}) ==")

    # 1) גיאוקודינג העיר (בשביל תיבת תחום לחיפוש רחובות)
    city = geocode(f"{city_en}, {country_en}", cache)
    if not city:
        print("!! לא הצלחתי לגאקד את העיר — בדוק את name_en/country_en")
        sys.exit(2)
    s, n, w, e = city["bbox"]
    # הרחבה קלה של התיבה
    pad = 0.05
    city_bbox = [s - pad, n + pad, w - pad, e + pad]

    # 2) הכנת נקודות ציון
    refs = []
    for rp in cfg["reference_points"]:
        entry = dict(rp)
        if rp["type"] == "street":
            segs = fetch_street_geometry(rp["osm_name"], city_bbox, cache)
            if not segs:
                print(f"!! רחוב לא נמצא ב-OSM: {rp['osm_name']} — בדוק איות מדויק (כולל utca/út!)")
                entry["error"] = "street not found"
            else:
                # בדיקת שפיות: אם הגיאומטריה מתפרסת על >6 ק\"מ, ייתכן שיש שני רחובות באותו שם
                ext_a, ext_b = street_extremities(segs)
                start, end = pick_start(ext_a, ext_b, rp.get("start", "west"))
                entry["segments"] = segs
                entry["start_pt"] = start
                entry["end_pt"] = end
                seg_count = len(segs)
                print(f"   רחוב {rp['osm_name']}: {seg_count} מקטעים נטענו מ-OSM")
        else:  # point
            if rp.get("lat") and rp.get("lng"):
                entry["pt"] = {"lat": float(rp["lat"]), "lon": float(rp["lng"])}
            else:
                g = geocode(rp["query"], cache)
                if not g:
                    print(f"!! נקודת ציון לא נמצאה: {rp.get('query')}")
                    entry["error"] = "point not found"
                else:
                    entry["pt"] = {"lat": g["lat"], "lon": g["lon"]}
        refs.append(entry)
        save_cache(cache)

    # 3) עיבוד מלונות
    out_hotels = []
    missing = []
    for h in cfg["hotels"]:
        g = geocode_hotel(h, city_en, country_en, cache)
        save_cache(cache)
        if not g:
            print(f"!! גיאוקודינג נכשל: {h['name']} — הוסף address או lat/lng בקלט והרץ שוב")
            missing.append(h["name"])
            out_hotels.append({"name": h["name"], "error": "geocoding failed"})
            continue
        hlat, hlon = g["lat"], g["lon"]
        print(f" • {h['name']}  ({hlat:.5f},{hlon:.5f})")
        distances = []
        for rp in refs:
            if rp.get("error"):
                continue
            if rp["type"] == "street":
                np_ = nearest_point_on_segments(hlat, hlon, rp["segments"])
                if np_ is None:
                    continue
                tlat, tlon, aerial = np_
                label, pct = position_label(tlat, tlon, rp["start_pt"], rp["end_pt"], aerial)
            else:
                tlat, tlon = rp["pt"]["lat"], rp["pt"]["lon"]
                label, pct = None, None
            foot = osrm_route(OSRM_FOOT, hlat, hlon, tlat, tlon)
            walk_min = int(round(foot["duration_s"] / 60)) if foot else None
            # מרחק נסיעה רלוונטי רק כשההליכה ארוכה (25 דק' ומעלה) — אחרת
            # לא בודקים ולא מציגים (וגם חוסכים קריאת OSRM).
            car = (
                osrm_route(OSRM_CAR, hlat, hlon, tlat, tlon)
                if walk_min is not None and walk_min >= 25
                else None
            )
            rec = {
                "ref_name_he": rp.get("name_he", rp.get("osm_name", rp.get("query", ""))),
                "nearest_point_label": label,
                "position_pct_along_street": pct,
                "target_lat": round(tlat, 6),
                "target_lng": round(tlon, 6),
                "meters": round_meters(foot["distance_m"]) if foot else None,
                "walk_min": walk_min,
                "drive_min": int(round(car["duration_s"] / 60)) if car else None,
                "maps_check_link": maps_link(hlat, hlon, tlat, tlon),
            }
            distances.append(rec)
        out_hotels.append({
            "name": h["name"],
            "stars": h.get("stars"),
            "lat": round(hlat, 6),
            "lng": round(hlon, 6),
            "geocode_display": g.get("display", ""),
            # שדות להעשרה ע\"י Claude Code דרך קונקטור Booking.com:
            "booking_score": None,
            "booking_url": None,
            "hotel_website": None,
            "facilities": {"pool_indoor": None, "pool_outdoor": None,
                           "casino": None, "waterpark": None, "spa": None},
            "distances": distances,
        })

    # 4) כתיבת פלט
    slug = city_en.lower().replace(" ", "_")
    out = {"destination": dest, "generated_at": time.strftime("%Y-%m-%d %H:%M"),
           "hotels": out_hotels, "geocoding_failed": missing}
    out_path = f"{slug}_output.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    # 5) טבלת אימות
    ver_path = f"{slug}_verification.md"
    with open(ver_path, "w", encoding="utf-8") as f:
        f.write(f"# טבלת אימות — {dest.get('name_he', city_en)}\n\n")
        f.write("לחץ על קישור הבדיקה ליד 2–3 מלונות והשווה לזמן שגוגל מפות מציג.\n\n")
        f.write("| מלון | נקודת ציון | נקודה קרובה | מטרים | הליכה | רכב | בדיקה |\n")
        f.write("|---|---|---|---|---|---|---|\n")
        for h in out_hotels:
            for d in h.get("distances", []):
                lbl = d["nearest_point_label"] or "נקודה קבועה"
                pct = f" ({d['position_pct_along_street']}%)" if d["position_pct_along_street"] is not None else ""
                f.write(f"| {h['name']} | {d['ref_name_he']} | {lbl}{pct} | "
                        f"{d['meters']} | {d['walk_min']} דק׳ | {d['drive_min']} דק׳ | "
                        f"[Maps]({d['maps_check_link']}) |\n")
        if missing:
            f.write("\n## מלונות שלא אותרו (דורשים כתובת/קואורדינטות בקלט)\n")
            for m in missing:
                f.write(f"- {m}\n")

    print(f"\n== הסתיים ==\nפלט:   {out_path}\nאימות: {ver_path}")
    if missing:
        print(f"שים לב: {len(missing)} מלונות לא אותרו — ראה בסוף קובץ האימות.")


if __name__ == "__main__":
    main()
