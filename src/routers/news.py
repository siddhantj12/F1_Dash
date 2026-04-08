import httpx
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from fastapi import APIRouter
from src.utils.logger import logger

router = APIRouter()

# In-memory cache: { "articles": [...], "fetched_at": timestamp }
_NEWS_CACHE: dict = {}
_CACHE_TTL = 600  # 10 minutes

RSS_FEEDS = [
    {
        "url": "https://www.motorsport.com/rss/f1/news/",
        "source": "Motorsport.com",
        "source_icon": "fa-solid fa-flag-checkered",
    },
    {
        "url": "https://www.autosport.com/rss/f1",
        "source": "Autosport",
        "source_icon": "fa-solid fa-trophy",
    },
    {
        "url": "https://www.planetf1.com/feed",
        "source": "PlanetF1",
        "source_icon": "fa-solid fa-globe",
    },
    {
        "url": "https://the-race.com/feed/",
        "source": "The Race",
        "source_icon": "fa-solid fa-bolt",
    },
    {
        "url": "https://racingnews365.com/feed",
        "source": "RacingNews365",
        "source_icon": "fa-solid fa-newspaper",
    },
]

TEAM_KEYWORDS = {
    "Red Bull": {"keywords": ["red bull", "verstappen", "perez", "newey", "horner", "lawson", "tsunoda", "rb "], "color": "#3671C6"},
    "Ferrari": {"keywords": ["ferrari", "leclerc", "hamilton", "sainz", "vasseur", "maranello"], "color": "#F91536"},
    "Mercedes": {"keywords": ["mercedes", "russell", "antonelli", "wolff", "brackley"], "color": "#6CD3BF"},
    "McLaren": {"keywords": ["mclaren", "norris", "piastri", "stella", "woking"], "color": "#FF8000"},
    "Aston Martin": {"keywords": ["aston martin", "alonso", "stroll", "krack", "silverstone"], "color": "#358C75"},
    "Alpine": {"keywords": ["alpine", "gasly", "doohan", "enstone"], "color": "#FF87BC"},
    "Williams": {"keywords": ["williams", "albon", "colapinto", "grove"], "color": "#64C4FF"},
    "Haas": {"keywords": ["haas", "bearman", "ocon", "kannapolis"], "color": "#B6BABD"},
    "Sauber": {"keywords": ["sauber", "audi", "bottas", "hulkenberg", "bortoleto"], "color": "#52E252"},
    "Racing Bulls": {"keywords": ["racing bulls", "vcarb", "ricciardo", "hadjar"], "color": "#6692FF"},
}

CATEGORY_KEYWORDS = {
    "Technical": ["upgrade", "floor", "sidepod", "wing", "aero", "engine", "power unit", "pu", "diffuser", "suspension", "brake"],
    "Race Weekend": ["qualifying", "sprint", "practice", "fp1", "fp2", "fp3", "race result", "grand prix", "pole"],
    "Transfer": ["contract", "sign", "seat", "replace", "join", "leave", "2025", "2026", "move"],
    "Regulation": ["fia", "regulation", "rule", "penalty", "steward", "ban", "budget cap"],
    "Strategy": ["strategy", "pit stop", "undercut", "overcut", "tyre", "tire", "compound", "deg"],
}


def _detect_team(title: str, desc: str) -> dict | None:
    text = (title + " " + desc).lower()
    for team, info in TEAM_KEYWORDS.items():
        if any(kw in text for kw in info["keywords"]):
            return {"name": team, "color": info["color"]}
    return None


def _detect_category(title: str, desc: str) -> str:
    text = (title + " " + desc).lower()
    for cat, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            return cat
    return "News"


def _parse_pub_date(date_str: str) -> str:
    if not date_str:
        return ""
    for fmt in (
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
    ):
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            return dt.isoformat()
        except ValueError:
            continue
    return date_str


def _time_ago(iso_str: str) -> str:
    if not iso_str:
        return ""
    try:
        dt = datetime.fromisoformat(iso_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        diff = datetime.now(timezone.utc) - dt
        minutes = int(diff.total_seconds() / 60)
        if minutes < 1:
            return "just now"
        if minutes < 60:
            return f"{minutes}m ago"
        hours = minutes // 60
        if hours < 24:
            return f"{hours}h ago"
        days = hours // 24
        if days == 1:
            return "yesterday"
        return f"{days}d ago"
    except Exception:
        return ""


def _strip_html(text: str) -> str:
    if not text:
        return ""
    import re
    clean = re.sub(r'<[^>]+>', '', text)
    clean = clean.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&#8217;', "'").replace('&#8216;', "'").replace('&#8220;', '"').replace('&#8221;', '"').replace('&nbsp;', ' ')
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean[:300]


def _get_text(el, tag: str) -> str:
    child = el.find(tag)
    if child is not None and child.text:
        return child.text.strip()
    # Try with namespace for Atom feeds
    for ns in ["{http://www.w3.org/2005/Atom}", "{http://purl.org/dc/elements/1.1/}"]:
        child = el.find(ns + tag)
        if child is not None and child.text:
            return child.text.strip()
    return ""


def _extract_image(item) -> str:
    # Try media:content, media:thumbnail, enclosure
    for ns in ["{http://search.yahoo.com/mrss/}", "{http://www.w3.org/2005/Atom}"]:
        for tag in ["content", "thumbnail"]:
            media = item.find(ns + tag)
            if media is not None:
                url = media.get("url", "")
                if url:
                    return url
    enclosure = item.find("enclosure")
    if enclosure is not None:
        enc_type = enclosure.get("type", "")
        if "image" in enc_type:
            return enclosure.get("url", "")
    return ""


async def _fetch_feed(client: httpx.AsyncClient, feed: dict) -> list:
    articles = []
    try:
        resp = await client.get(feed["url"], timeout=8.0, follow_redirects=True)
        if resp.status_code != 200:
            logger.warning(f"News RSS {feed['source']} returned {resp.status_code}")
            return []

        root = ET.fromstring(resp.text)
        items = root.findall(".//item") or root.findall(".//{http://www.w3.org/2005/Atom}entry")

        for item in items[:15]:
            title = _get_text(item, "title")
            link = _get_text(item, "link")
            if not link:
                link_el = item.find("{http://www.w3.org/2005/Atom}link")
                if link_el is not None:
                    link = link_el.get("href", "")

            raw_desc = _get_text(item, "description") or _get_text(item, "summary") or _get_text(item, "content")
            description = _strip_html(raw_desc)
            pub_date = _parse_pub_date(
                _get_text(item, "pubDate") or _get_text(item, "published") or _get_text(item, "date")
            )
            image = _extract_image(item)
            team = _detect_team(title, description)
            category = _detect_category(title, description)

            if title:
                articles.append({
                    "title": title,
                    "description": description,
                    "url": link,
                    "image": image,
                    "published": pub_date,
                    "time_ago": _time_ago(pub_date),
                    "source": feed["source"],
                    "source_icon": feed["source_icon"],
                    "team": team,
                    "category": category,
                })
    except Exception as e:
        logger.warning(f"News RSS {feed['source']} error: {e}")
    return articles


async def _fetch_all_news() -> list:
    now = time.time()
    if _NEWS_CACHE.get("articles") and (now - _NEWS_CACHE.get("fetched_at", 0)) < _CACHE_TTL:
        return _NEWS_CACHE["articles"]

    async with httpx.AsyncClient(
        headers={"User-Agent": "F1Dash/1.0 (news aggregator)"},
    ) as client:
        import asyncio
        results = await asyncio.gather(*[_fetch_feed(client, f) for f in RSS_FEEDS], return_exceptions=True)

    articles = []
    for r in results:
        if isinstance(r, list):
            articles.extend(r)

    # Sort by publish date (newest first), deduplicate by title similarity
    articles.sort(key=lambda a: a.get("published", ""), reverse=True)

    seen_titles = set()
    unique = []
    for a in articles:
        # Simple dedup: lowercase first 40 chars of title
        key = a["title"].lower()[:40]
        if key not in seen_titles:
            seen_titles.add(key)
            unique.append(a)

    _NEWS_CACHE["articles"] = unique
    _NEWS_CACHE["fetched_at"] = now
    logger.info(f"News: fetched {len(unique)} unique articles from {len(RSS_FEEDS)} feeds")
    return unique


@router.get("/news")
async def get_news(limit: int = 30, category: str = ""):
    articles = await _fetch_all_news()
    if category:
        articles = [a for a in articles if a["category"].lower() == category.lower()]
    return {"articles": articles[:limit], "total": len(articles)}


@router.get("/news/headlines")
async def get_headlines(limit: int = 8):
    """Top headlines for the marquee ribbon."""
    articles = await _fetch_all_news()
    return [{"title": a["title"], "source": a["source"], "time_ago": a["time_ago"]} for a in articles[:limit]]
