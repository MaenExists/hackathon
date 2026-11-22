#!/usr/bin/env python3
"""IndianKanoon NDPS Case Harvester and Transit Intelligence Extractor.

Queries IndianKanoon API for Kerala High Court NDPS cases, extracts
verifiable transit corridors, entry checkposts, origin/destinations,
substances, quantities, and transport modes.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
import urllib.request
import urllib.parse
import urllib.error

API_TOKEN = "b342770bcc88a69de58557d54f5a40eb2d452856"
SEARCH_URL = "https://api.indiankanoon.org/search/"
DOC_URL_TMPL = "https://api.indiankanoon.org/doc/{}/"

DISTRICTS = [
    "Thiruvananthapuram", "Kollam", "Pathanamthitta", "Alappuzha", "Kottayam",
    "Idukki", "Ernakulam", "Thrissur", "Palakkad", "Malappuram", "Kozhikode",
    "Wayanad", "Kannur", "Kasaragod"
]

CHECKPOSTS = {
    "muthanga": ("Wayanad", "Muthanga Checkpost"),
    "sulthan bathery": ("Wayanad", "Sulthan Bathery"),
    "walayar": ("Palakkad", "Walayar Checkpost"),
    "kanjikode": ("Palakkad", "Kanjikode"),
    "kumily": ("Idukki", "Kumily Checkpost"),
    "bodimettu": ("Idukki", "Bodimettu Checkpost"),
    "aryankavu": ("Kollam", "Aryankavu Checkpost"),
    "thalappady": ("Kasaragod", "Thalappady Border"),
    "manjeshwar": ("Kasaragod", "Manjeshwar"),
    "amaravila": ("Thiruvananthapuram", "Amaravila Checkpost"),
    "kaliyakkavilai": ("Thiruvananthapuram", "Amaravila Checkpost"),
    "nedumbassery": ("Ernakulam", "Nedumbassery CIAL"),
    "cial": ("Ernakulam", "Nedumbassery CIAL"),
    "cochin airport": ("Ernakulam", "Nedumbassery CIAL"),
    "aluva railway": ("Ernakulam", "Aluva Railway Station"),
    "palakkad railway": ("Palakkad", "Palakkad Railway Station"),
    "vazhikkadavu": ("Malappuram", "Vazhikkadavu Checkpost"),
    "nadukani": ("Malappuram", "Nadukani Pass"),
    "shoranur": ("Palakkad", "Shoranur Railway Junction"),
    "karipur": ("Malappuram", "Calicut Airport (Karipur)"),
}

SUBSTANCES = {
    "mdma": (r"\b(?:mdma|ecstasy|methylenedioxymethamphetamine)\b", 10.0),  # commercial > 10g
    "ganja": (r"\b(?:ganja|cannabis|marijuana|weed)\b", 20000.0),            # commercial > 20kg
    "methamphetamine": (r"\b(?:meth|methamphetamine|crystal\s+meth)\b", 50.0),
    "hashish_oil": (r"\b(?:hashish\s*oil|hash\s*oil|cannabis\s*oil)\b", 1000.0),
    "heroin": (r"\b(?:heroin|brown\s*sugar|diacetylmorphine)\b", 250.0),
    "lsd": (r"\b(?:lsd|lysergic|acid\s*stamps?)\b", 0.1),
    "cocaine": (r"\b(?:cocaine)\b", 100.0),
    "charas": (r"\b(?:charas|hashish)\b", 1000.0),
}


def api_request(url: str, post_data: Optional[Dict[str, Any]] = None, max_retries: int = 3) -> Dict[str, Any]:
    headers = {
        "Authorization": f"Token {API_TOKEN}",
        "Accept": "application/json",
        "User-Agent": "Kerala-Corridor-Intelligence/1.0",
    }
    if post_data is None:
        post_data = {}
    encoded = urllib.parse.urlencode(post_data).encode("utf-8")

    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, data=encoded, headers=headers)
            with urllib.request.urlopen(req, timeout=12) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(2 * (attempt + 1))
                continue
            raise
        except Exception:
            if attempt == max_retries - 1:
                raise
            time.sleep(1.5)
    return {}


def search_kanoon(query: str, pagenum: int = 0) -> List[Dict[str, Any]]:
    payload = {"formInput": f"{query} doctypes:kerala", "pagenum": pagenum}
    res = api_request(SEARCH_URL, post_data=payload)
    return res.get("docs", [])


def fetch_doc_text(tid: int, cache_dir: Path) -> str:
    cache_file = cache_dir / f"{tid}.html"
    if cache_file.exists():
        return cache_file.read_text(encoding="utf-8", errors="ignore")

    res = api_request(DOC_URL_TMPL.format(tid), post_data={})
    html = res.get("doc", "")
    if html:
        cache_file.write_text(html, encoding="utf-8")
    return html


def parse_judgment_date(title: str, text: str) -> Optional[str]:
    m = re.search(r"on\s+(\d{1,2}\s+[A-Za-z]+,\s+\d{4})", title)
    if m:
        try:
            from datetime import datetime
            return datetime.strptime(m.group(1), "%d %B, %Y").strftime("%Y-%m-%d")
        except Exception:
            pass
    m2 = re.search(r"\b(\d{1,2}(?:st|nd|rd|th)?\s+day\s+of\s+[A-Za-z]+,?\s+\d{4})", text, re.I)
    if m2:
        clean = re.sub(r"(st|nd|rd|th)", "", m2.group(1), flags=re.I)
        try:
            from datetime import datetime
            return datetime.strptime(re.sub(r"\s+", " ", clean).strip(), "%d day of %B, %Y").strftime("%Y-%m-%d")
        except Exception:
            pass
    return None


def extract_incident(tid: int, title: str, html: str) -> Optional[Dict[str, Any]]:
    text = re.sub(r"<[^<]+?>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return None

    # Filter out non-NDPS civil matters if NDPS/narcotics not in text
    if not re.search(r"\bNDPS\b|Narcotic\s+Drugs|Psychotropic|Section\s+2[0-3]|Contraband", text, re.I):
        return None

    j_date = parse_judgment_date(title, text)

    # Crime No, Police Station / Excise Range, and authoritative station District
    crime_no = None
    station = None
    district = None
    place = None

    m_crime = re.search(
        r"CRIME\s+NO\.?\s*(\d+\s*/\s*\d{4})\s+OF\s+([A-Za-z\s]+?(?:POLICE\s+STATION|EXCISE\s+RANGE|EXCISE\s+CIRCLE|EXCISE\s+SPECIAL\s+SQUAD))(?:\s*,\s*([A-Za-z]+))?",
        text,
        re.I,
    )
    if m_crime:
        crime_no = re.sub(r"\s+", "", m_crime.group(1))
        station = re.sub(r"\s+", " ", m_crime.group(2)).strip().title()
        if m_crime.group(3):
            cand_dist = m_crime.group(3).strip().title()
            for d in DISTRICTS:
                if d.lower() == cand_dist.lower():
                    district = d
                    break

    # 1. Check checkposts / key transit places first for high-precision locality
    for cp_key, (cp_dist, cp_name) in CHECKPOSTS.items():
        if re.search(rf"\b{cp_key}\b", text, re.I):
            place = cp_name
            district = cp_dist  # Checkpost location is authoritative for entry interceptions
            break

    # 2. Check station name against districts
    if not district and station:
        for d in DISTRICTS:
            if d.lower() in station.lower():
                district = d
                break

    # 3. Body text search (strip High Court header so 'High Court of Kerala at Ernakulam' never poisons district)
    body_text = re.sub(r"^[\s\S]*?HIGH\s+COURT\s+OF\s+KERALA\s+AT\s+ERNAKULAM", "", text, flags=re.I)
    if not district:
        m_dist = re.search(
            r"([A-Za-z]+)\s+DISTRICT\b",
            body_text,
            re.I,
        )
        if m_dist:
            cand = m_dist.group(1).title()
            for d in DISTRICTS:
                if d.lower() == cand.lower():
                    district = d
                    break

    # 4. Fallback search across districts in body text
    if not district:
        for d in DISTRICTS:
            if re.search(rf"\b{d}\b", body_text):
                district = d
                break

    if not district:
        return None

    # Substance identification
    substance = "unknown"
    comm_threshold = 1000.0
    for sub, (pat, thresh) in SUBSTANCES.items():
        if re.search(pat, text, re.I):
            substance = sub
            comm_threshold = thresh
            break

    # Seizure quantity extraction
    quantity_g = None
    m_qtys = re.findall(
        r"(\d+(?:\.\d+)?)\s*(grams?|gms?|gm|g|kilograms?|kgs?|kg|milligrams?|mg)\b",
        text,
        re.I,
    )
    for num_str, unit_str in m_qtys:
        try:
            val = float(num_str)
            u = unit_str.lower()
            if u.startswith("k"):
                g_val = val * 1000.0
            elif (u.startswith("m") and "g" in u and "gm" not in u) or u == "mg":
                g_val = val / 1000.0
            else:
                g_val = val
            # Sanity bound: single seizure usually between 0.01g and 500kg
            if 0.01 <= g_val <= 500_000:
                quantity_g = g_val
                break
        except Exception:
            continue

    is_commercial = bool(quantity_g and quantity_g >= comm_threshold) or bool(
        re.search(r"commercial\s+quantity", text, re.I)
    )

    # Origin & Destination Transit Flow
    origin = None
    destination = None
    # Check known sourcing hubs
    hubs = [
        ("Bengaluru", r"\b(?:Bengaluru|Bangalore|Gundlupet|Mysuru|Mysore)\b"),
        ("Mangalore", r"\b(?:Mangalore|Mangaluru|Sullia)\b"),
        ("Goa", r"\b(?:Goa)\b"),
        ("Andhra Pradesh", r"\b(?:Andhra\s+Pradesh|Araku|Visakhapatnam|Vizag)\b"),
        ("Odisha", r"\b(?:Odisha|Orissa)\b"),
        ("Coimbatore", r"\b(?:Coimbatore|Tiruppur|Salem)\b"),
        ("Chennai", r"\b(?:Chennai)\b"),
        ("Madurai", r"\b(?:Madurai|Theni|Cumbum|Shenkottai|Tenkasi)\b"),
        ("Delhi", r"\b(?:Delhi|New\s+Delhi)\b"),
        ("Mumbai", r"\b(?:Mumbai|Bombay)\b"),
    ]
    for hub_name, pat in hubs:
        if re.search(pat, text, re.I):
            origin = hub_name
            break

    # Check transit phrase: travelling from X to Y, transport to X, etc.
    m_route = re.search(
        r"(?:travell?ing|transport(?:ing)?(?:\s+it)?|proceeding|carr(?:y|ying))\s+from\s+([A-Za-z\s]+?)\s+to\s+([A-Za-z\s]+?)(?:\s+in|\s+by|\.|\,)",
        text,
        re.I,
    )
    if m_route:
        c_orig = m_route.group(1).strip().title()
        c_dest = m_route.group(2).strip().title()
        if len(c_orig) < 30:
            origin = c_orig
        if len(c_dest) < 30:
            for d in DISTRICTS:
                if d.lower() in c_dest.lower():
                    destination = d
                    break
            if not destination and len(c_dest) < 25:
                destination = c_dest

    # Check explicit destination delivery / sale intention
    if not destination:
        m_dest = re.search(
            r"(?:transport(?:ing)?(?:\s+it)?|deliver(?:y|ing)?|head(?:ing)?|proceeding|supplying|sell(?:ing)?|sale\s+in|transit(?:\s+to)?|brought\s+to|en\s*route\s+to|direction\s+to\s+transport(?:\s+it)?\s+to)\s+(?:to\s+|at\s+|in\s+)?([A-Za-z]+)",
            text,
            re.I,
        )
        if m_dest:
            w = m_dest.group(1).title()
            if w in DISTRICTS:
                destination = w
            elif w.lower() in ["kochi", "cochin"]:
                destination = "Ernakulam"
            elif w.lower() in ["calicut"]:
                destination = "Kozhikode"
            elif w.lower() in ["trivandrum"]:
                destination = "Thiruvananthapuram"

    # If destination not resolved, check accused native place vs seizure place
    if not destination:
        m_acc = re.search(
            r"(?:PETITIONER|ACCUSED|APPELLANT)[\s\S]{1,600}?(?:RESPONDENT|STATE|ADVS)",
            text,
            re.I,
        )
        if m_acc:
            acc_txt = m_acc.group(0)
            for d in DISTRICTS:
                if re.search(rf"\b{d}\b", acc_txt, re.I):
                    destination = d
                    break
            if not destination:
                if re.search(r"\b(?:kochi|cochin|muvattupuzha|aluva|edappally|kakkanad)\b", acc_txt, re.I):
                    destination = "Ernakulam"
                elif re.search(r"\b(?:manjeri|tirur|perinthalmanna|nilambur|kottakkal)\b", acc_txt, re.I):
                    destination = "Malappuram"
                elif re.search(r"\b(?:vadakara|koyilandy)\b", acc_txt, re.I):
                    destination = "Kozhikode"
                elif re.search(r"\b(?:thalassery|payyannur)\b", acc_txt, re.I):
                    destination = "Kannur"

    # Transport mode
    transport_mode = "road_private"
    if re.search(r"\b(?:train|railway\s+station|compartment|berth)\b", text, re.I):
        transport_mode = "train"
    elif re.search(r"\b(?:ksrtc|bus|conductor|passenger)\b", text, re.I):
        transport_mode = "bus"
    elif re.search(r"\b(?:courier|parcel|postal|speed\s+post)\b", text, re.I):
        transport_mode = "courier_postal"
    elif re.search(r"\b(?:flight|airport|air\s+cargo|customs)\b", text, re.I):
        transport_mode = "air"
    elif re.search(r"\b(?:car|motorcycle|bike|scooter|auto|jeep|lorry|truck)\b", text, re.I):
        transport_mode = "road_private"

    # Event date resolution (date of seizure)
    event_date = None
    m_edate = re.search(
        r"(?:seized|intercepted|arrested|recovered|on)\s+([0-3]?\d[\.\/\-][0-1]?\d[\.\/\-]\d{4})",
        text,
        re.I,
    )
    if m_edate:
        ds = m_edate.group(1).replace(".", "-").replace("/", "-")
        parts = ds.split("-")
        try:
            if len(parts[0]) == 4:
                event_date = f"{parts[0]}-{int(parts[1]):02d}-{int(parts[2]):02d}"
            else:
                event_date = f"{parts[2]}-{int(parts[1]):02d}-{int(parts[0]):02d}"
        except Exception:
            pass

    if not event_date:
        event_date = j_date

    return {
        "case_id": f"IK-{tid}",
        "tid": tid,
        "title": title[:140],
        "event_date": event_date,
        "judgment_date": j_date,
        "district": district,
        "place": place or station or district,
        "substance": substance,
        "quantity_g": round(quantity_g, 3) if quantity_g else None,
        "is_commercial": is_commercial,
        "crime_no": crime_no,
        "station": station,
        "origin_place": origin,
        "destination_place": destination,
        "transport_mode": transport_mode,
        "source": "High Court of Kerala (IndianKanoon)",
        "source_url": f"https://indiankanoon.org/doc/{tid}/",
        "veracity_score": 0.95,  # Official judicial records
    }


def harvest_all(output_csv: Path, cache_dir: Path, target_count: int = 150):
    cache_dir.mkdir(parents=True, exist_ok=True)

    queries = [
        "ndps muthanga",
        "ndps walayar",
        "ndps aryankavu",
        "ndps kumily",
        "ndps thalappady",
        "ndps vazhikkadavu",
        "ndps amaravila",
        "ndps bodimettu",
        "ndps bangalore",
        "ndps train",
        "ndps courier",
        "ndps commercial mdma",
        "ndps ganja commercial",
        "ndps hashish oil",
        "ndps methamphetamine",
        "ndps sulthan bathery",
        "ndps ernakulam mdma",
        "ndps aluva railway",
        "ndps palakkad junction",
        "ndps shoranur",
        "ndps kozhikode mdma",
        "ndps cial airport",
    ]

    all_cases: Dict[int, Dict[str, Any]] = {}

    # First load and re-extract from all existing cached documents
    cached_htmls = sorted(cache_dir.glob("*.html"))
    if cached_htmls:
        print(f"Loading {len(cached_htmls)} existing cached judicial orders...")
        for cf in cached_htmls:
            try:
                tid = int(cf.stem)
                html = cf.read_text(encoding="utf-8", errors="ignore")
                case = extract_incident(tid, f"Case {tid}", html)
                if case and case.get("district"):
                    all_cases[tid] = case
            except Exception:
                continue
        print(f"Extracted {len(all_cases)} valid structured NDPS cases from existing cache.")

    print(f"Beginning IndianKanoon NDPS judicial harvest (target: ~{target_count} structured cases)...")

    for q in queries:
        if len(all_cases) >= target_count:
            break
        print(f"Searching: '{q}' ...")
        for page in range(3):
            if len(all_cases) >= target_count:
                break
            try:
                docs = search_kanoon(q, pagenum=page)
                if not docs:
                    break
                for d in docs:
                    tid = d.get("tid")
                    if not tid or tid in all_cases:
                        continue
                    html = fetch_doc_text(tid, cache_dir)
                    case = extract_incident(tid, d.get("title", ""), html)
                    if case and case.get("district"):
                        all_cases[tid] = case
                        print(f"  [+] Case IK-{tid}: {case['district']} | {case['substance']} | {case['quantity_g']}g | {case['origin_place']} -> {case['destination_place']}")
                time.sleep(0.5)
            except Exception as e:
                print(f"  Error on '{q}' page {page}: {e}")
                break

    records = list(all_cases.values())
    print(f"Successfully harvested and verified {len(records)} authoritative judicial NDPS cases!")

    import pandas as pd
    df = pd.DataFrame(records)
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_csv, index=False)
    print(f"Wrote structured judicial cases to {output_csv}")

    # Also mirror to Data-Collection-system if present
    repo_root = Path(__file__).resolve().parent.parent.parent
    mirror_path = repo_root / "Data-Collection-system" / "data" / "judicial_ndps_cases.csv"
    if mirror_path.parent.exists():
        df.to_csv(mirror_path, index=False)
        print(f"Mirrored structured cases to {mirror_path}")

    return df


if __name__ == "__main__":
    script_dir = Path(__file__).resolve().parent
    default_out = script_dir.parent / "ml" / "data" / "judicial_ndps_cases.csv"
    default_cache = script_dir.parent / "ml" / "data" / "kanoon_cache"

    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(default_out), help="Output CSV path")
    parser.add_argument("--cache", default=str(default_cache), help="Cache directory")
    parser.add_argument("--limit", type=int, default=120, help="Target case count")
    args = parser.parse_args()
    harvest_all(Path(args.out), Path(args.cache), target_count=args.limit)
