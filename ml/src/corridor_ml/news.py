"""Incremental RSS/Atom metadata inbox. It never manufactures training events."""
from __future__ import annotations

from datetime import datetime, timezone
from contextlib import contextmanager
import hashlib
import html
import ipaddress
import json
from pathlib import Path
import re
import socket
import sqlite3
from urllib.error import HTTPError
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from defusedxml import ElementTree

from .data import DataError


def canonical_url(value: str) -> str:
    parts = urlsplit(value.strip())
    if parts.scheme not in ("https", "http") or not parts.hostname or parts.username or parts.password:
        raise DataError("Article URL must be an HTTP(S) URL without credentials.")
    query = sorted((k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if not k.lower().startswith("utm_") and k.lower() not in ("fbclid", "gclid"))
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path or "/", urlencode(query), ""))


def public_feed_url(value: str) -> str:
    url = canonical_url(value)
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.port not in (None, 443):
        raise DataError("Feeds must use public HTTPS on the default port.")
    addresses = socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
        raise DataError("Local/private feed endpoints are not supported.")
    return url


class PublicRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        public_feed_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


@contextmanager
def connect(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.executescript("""
        CREATE TABLE IF NOT EXISTS feeds (url TEXT PRIMARY KEY, etag TEXT, modified TEXT, fetched_at TEXT, last_error TEXT);
        CREATE TABLE IF NOT EXISTS articles (id TEXT PRIMARY KEY, url TEXT UNIQUE NOT NULL, title TEXT NOT NULL, published_at TEXT, first_seen_at TEXT NOT NULL, feed_url TEXT NOT NULL, duplicate_group TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unreviewed', case_id TEXT, evidence_ref TEXT);
        CREATE TABLE IF NOT EXISTS news_reviews (id INTEGER PRIMARY KEY, article_id TEXT NOT NULL, decision TEXT NOT NULL, case_id TEXT, evidence_ref TEXT, reviewed_at TEXT NOT NULL);
    """)
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def parse_feed(raw: bytes) -> list[dict]:
    if len(raw) > 2_000_000:
        raise DataError("Feed exceeds 2 MB.")
    root = ElementTree.fromstring(raw)
    items = root.findall(".//item")
    atom = "{http://www.w3.org/2005/Atom}"
    items += root.findall(f"{atom}entry")
    result = []
    for item in items[:500]:
        title = item.findtext("title") or item.findtext(f"{atom}title") or ""
        title = html.unescape(re.sub("<[^>]+>", "", title)).strip()[:500]
        link = item.findtext("link")
        if not link:
            links = item.findall(f"{atom}link")
            link = next((e.get("href") for e in links if e.get("rel", "alternate") == "alternate"), None)
        if not title or not link:
            continue
        try:
            url = canonical_url(link)
        except DataError:
            continue
        fingerprint = hashlib.sha256(re.sub(r"[^\w]+", " ", title.casefold()).encode()).hexdigest()
        result.append({"id": hashlib.sha256(url.encode()).hexdigest()[:24], "url": url, "title": title, "published_at": (item.findtext("pubDate") or item.findtext(f"{atom}published") or item.findtext(f"{atom}updated") or "")[:100], "duplicate_group": fingerprint})
    return result


def ingest_feed(db: sqlite3.Connection, url: str, raw: bytes, fetched_at: str) -> int:
    inserted = 0
    with db:
        for item in parse_feed(raw):
            before = db.total_changes
            db.execute("INSERT OR IGNORE INTO articles(id,url,title,published_at,first_seen_at,feed_url,duplicate_group) VALUES (?,?,?,?,?,?,?)", (item["id"], item["url"], item["title"], item["published_at"], fetched_at, url, item["duplicate_group"]))
            inserted += db.total_changes - before
    return inserted


def fetch_news(config_path: Path, database: Path) -> list[dict]:
    config = json.loads(config_path.read_text())
    urls = config.get("feeds")
    if not isinstance(urls, list) or len(urls) > 20 or any(not isinstance(x, str) for x in urls):
        raise DataError("feeds.json needs a feeds list of at most 20 authorized RSS/Atom URLs.")
    results = []
    with connect(database) as db:
        for value in urls:
            now = datetime.now(timezone.utc).isoformat()
            try:
                url = public_feed_url(value)
                previous = db.execute("SELECT * FROM feeds WHERE url=?", (url,)).fetchone()
                headers = {"User-Agent": "CorridorResearchPrototype/0.1 (+https://github.com/MaenExists/hackathon)", "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml"}
                if previous and previous["etag"]:
                    headers["If-None-Match"] = previous["etag"]
                if previous and previous["modified"]:
                    headers["If-Modified-Since"] = previous["modified"]
                try:
                    with build_opener(PublicRedirects()).open(Request(url, headers=headers), timeout=15) as response:
                        raw = response.read(2_000_001)
                        count = ingest_feed(db, url, raw, now)
                        db.execute("INSERT INTO feeds(url,etag,modified,fetched_at,last_error) VALUES (?,?,?,?,NULL) ON CONFLICT(url) DO UPDATE SET etag=excluded.etag,modified=excluded.modified,fetched_at=excluded.fetched_at,last_error=NULL", (url, response.headers.get("ETag"), response.headers.get("Last-Modified"), now))
                    results.append({"feed": url, "new_articles": count})
                except HTTPError as e:
                    if e.code != 304:
                        raise
                    db.execute("UPDATE feeds SET fetched_at=?,last_error=NULL WHERE url=?", (now, url))
                    results.append({"feed": url, "new_articles": 0, "unchanged": True})
                db.commit()
            except Exception as e:
                error = type(e).__name__ + ": " + str(e)[:200]
                db.execute("INSERT INTO feeds(url,fetched_at,last_error) VALUES (?,?,?) ON CONFLICT(url) DO UPDATE SET fetched_at=excluded.fetched_at,last_error=excluded.last_error", (value, now, error))
                db.commit()
                results.append({"feed": value, "error": error})
    return results


def review(database: Path, article_id: str, decision: str, case_id: str = "", evidence_ref: str = "") -> None:
    if decision not in ("corroborated", "rejected"):
        raise DataError("Review decision must be corroborated or rejected.")
    if decision == "corroborated" and (not case_id.strip() or not evidence_ref.strip()):
        raise DataError("Corroboration requires a canonical case ID and an independent evidence reference.")
    with connect(database) as db:
        article = db.execute("SELECT url FROM articles WHERE id=?", (article_id,)).fetchone()
        if not article:
            raise DataError("Unknown article ID.")
        if decision == "corroborated" and evidence_ref.strip() == article["url"]:
            raise DataError("Independent evidence must differ from the original article.")
        db.execute("UPDATE articles SET status=?,case_id=?,evidence_ref=? WHERE id=?", (decision, case_id, evidence_ref, article_id))
        db.execute("INSERT INTO news_reviews(article_id,decision,case_id,evidence_ref,reviewed_at) VALUES (?,?,?,?,?)", (article_id, decision, case_id, evidence_ref, datetime.now(timezone.utc).isoformat()))
