import { NextRequest, NextResponse } from "next/server";

const UA = "Valuer Research/1.0 (educational project; contact: valuer@example.com)";
const SEC_UA = "Valuer/1.0 valuer-app@example.com";

// ─── Enhanced Sentiment Engine ────────────────────────────────────────────────
const BULLISH_STRONG  = ["beat expectations","raised guidance","record revenue","all-time high","strong buy","upgrade","outperform","accelerating","blowout","record earnings","buyback","initiated buy"];
const BULLISH_WEAK    = ["buy","long","bullish","growth","rally","surge","breakout","beat","strong","raised","upgrade","positive","opportunity","undervalued","accumulate","overweight","🚀","💰"];
const BEARISH_STRONG  = ["missed expectations","lowered guidance","revenue decline","going bankrupt","class action","sec investigation","fraud","layoffs announced","ceo resigned","dividend cut","guidance cut"];
const BEARISH_WEAK    = ["sell","short","bearish","crash","dump","miss","weak","downgrade","risk","overvalued","decline","loss","lawsuit","concern","underperform","underweight","📉","⚠️"];

function scoreSentiment(text: string): { score: number; label: "bullish" | "bearish" | "neutral"; confidence: "high" | "medium" | "low" } {
  const t = text.toLowerCase();
  const bs = BULLISH_STRONG.filter(w => t.includes(w)).length * 3;
  const bw = BULLISH_WEAK.filter(w => t.includes(w)).length;
  const ss = BEARISH_STRONG.filter(w => t.includes(w)).length * 3;
  const sw = BEARISH_WEAK.filter(w => t.includes(w)).length;
  const bull = bs + bw, bear = ss + sw;
  const raw  = bull - bear;
  const total = bull + bear;
  const score = Math.max(0, Math.min(100, 50 + raw * 8));
  const confidence = total >= 3 ? "high" : total >= 1 ? "medium" : "low";
  return { score, label: raw > 0 ? "bullish" : raw < 0 ? "bearish" : "neutral", confidence };
}

// ─── Helper: safe fetch with timeout ─────────────────────────────────────────
async function safeFetch(url: string, opts: RequestInit & { next?: any } = {}, timeoutMs = 5000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ─── 1. Reddit (5 finance subreddits) ────────────────────────────────────────
async function fetchReddit(ticker: string) {
  const subs = "stocks+investing+wallstreetbets+ValueInvesting+SecurityAnalysis+stockmarket+dividends+options";
  const url  = `https://www.reddit.com/r/${subs}/search.json?q=${encodeURIComponent(ticker)}&sort=new&restrict_sr=on&limit=15&type=link`;
  try {
    const res = await safeFetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 90 } });
    if (!res?.ok) return [];
    const json = await res.json();
    return (json?.data?.children ?? []).map((p: any) => {
      const d = p.data;
      return {
        source: "reddit",
        id:          d.id,
        title:       d.title,
        body:        (d.selftext ?? "").slice(0, 200),
        subreddit:   d.subreddit_name_prefixed,
        score:       d.score,
        upvoteRatio: d.upvote_ratio,
        comments:    d.num_comments,
        url:         `https://reddit.com${d.permalink}`,
        ts:          d.created_utc * 1000,
        author:      d.author,
        sentiment:   scoreSentiment(`${d.title} ${d.selftext ?? ""}`),
      };
    });
  } catch { return []; }
}

// ─── 2. Google News RSS ───────────────────────────────────────────────────────
function parseRssItems(xml: string, source: string, limit = 10) {
  const items: any[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  const get = (block: string, tag: string) => {
    const r = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`);
    const match = r.exec(block);
    return match ? (match[1] || match[2] || "").trim() : "";
  };
  while ((m = re.exec(xml)) !== null && items.length < limit) {
    const b     = m[1];
    const title = get(b, "title");
    if (!title) continue;
    const link    = get(b, "link") || get(b, "guid");
    const pubDate = get(b, "pubDate") || get(b, "dc:date") || "";
    const src     = get(b, "source") || source;
    const desc    = get(b, "description");
    const ts      = pubDate ? new Date(pubDate).getTime() : Date.now();
    items.push({ source: "news", id: `${source}-${ts}`, title, link, pubDate, src, desc, ts, sentiment: scoreSentiment(`${title} ${desc}`) });
  }
  return items;
}

async function fetchGoogleNews(ticker: string) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(ticker + " stock")}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const res = await safeFetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 120 } });
    if (!res?.ok) return [];
    return parseRssItems(await res.text(), "Google News");
  } catch { return []; }
}

// ─── 3. Yahoo Finance News (undocumented, high value) ────────────────────────
async function fetchYahooNews(ticker: string) {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=10&quotesCount=0&listsCount=0`;
  try {
    const res = await safeFetch(url, {
      headers: {
        "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept":          "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer":         "https://finance.yahoo.com/",
      },
      next: { revalidate: 90 },
    });
    if (!res?.ok) return [];
    const json = await res.json();
    return (json?.news ?? []).map((n: any) => ({
      source:    "yahoo",
      id:        n.uuid,
      title:     n.title,
      link:      n.link,
      pubDate:   new Date(n.providerPublishTime * 1000).toUTCString(),
      ts:        n.providerPublishTime * 1000,
      src:       n.publisher,
      thumbnail: n.thumbnail?.resolutions?.[0]?.url ?? null,
      sentiment: scoreSentiment(n.title),
    }));
  } catch { return []; }
}

// ─── 4. SEC EDGAR — Recent 8-K filings (material events) ─────────────────────
async function fetchSecFilings(ticker: string) {
  // Step 1: resolve CIK from ticker
  try {
    const tickerUrl = `https://www.sec.gov/files/company_tickers.json`;
    const tickerRes = await safeFetch(tickerUrl, { headers: { "User-Agent": SEC_UA }, next: { revalidate: 86400 } });
    if (!tickerRes?.ok) return [];
    const tickers = await tickerRes.json();
    const entry   = Object.values(tickers as Record<string, any>).find((e: any) => e.ticker?.toUpperCase() === ticker.toUpperCase());
    if (!entry) return [];
    const cik = String(entry.cik_str).padStart(10, "0");

    // Step 2: fetch recent submissions
    const subUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const subRes = await safeFetch(subUrl, { headers: { "User-Agent": SEC_UA }, next: { revalidate: 3600 } });
    if (!subRes?.ok) return [];
    const sub = await subRes.json();
    const filings = sub?.filings?.recent;
    if (!filings) return [];

    const { form, filingDate, accessionNumber, primaryDocument, items } = filings;
    const results: any[] = [];
    for (let i = 0; i < Math.min(form.length, 40) && results.length < 8; i++) {
      if (!["8-K","8-K/A","10-Q","10-K","S-1","S-1/A"].includes(form[i])) continue;
      const acc = accessionNumber[i].replace(/-/g, "");
      const doc = primaryDocument[i];
      const url = `https://www.sec.gov/Archives/edgar/data/${entry.cik_str}/${acc}/${doc}`;
      const itemText = items[i] ? `Items: ${items[i]}` : "";
      const title = `${form[i]} Filing — ${sub.name} (${filingDate[i]}) ${itemText}`;
      results.push({
        source:    "sec",
        id:        acc,
        title,
        link:      url,
        pubDate:   filingDate[i],
        ts:        new Date(filingDate[i]).getTime(),
        src:       "SEC EDGAR",
        form:      form[i],
        cik:       cik,
        sentiment: scoreSentiment(title),
      });
    }
    return results;
  } catch { return []; }
}

// ─── 5. Finviz news scraping ──────────────────────────────────────────────────
async function fetchFinviz(ticker: string) {
  const url = `https://finviz.com/quote.ashx?t=${ticker}&p=d`;
  try {
    const res = await safeFetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept":     "text/html,application/xhtml+xml",
        "Referer":    "https://finviz.com/",
      },
      next: { revalidate: 180 },
    }, 6000);
    if (!res?.ok) return [];
    const html = await res.text();

    // Extract news table rows
    const items: any[] = [];
    // Pattern: <tr><td class="nn-date">DATE TIME</td><td>...<a ...href="URL">TITLE</a>...<span>SOURCE</span>
    const rowRe = /class="[^"]*news[^"]*"[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<span[^>]*>([^<]*)<\/span>/g;
    const dateRe = /<td[^>]*class="[^"]*date[^"]*"[^>]*>([^<]+)<\/td>/g;
    const timeRe = /(\w{3}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?:AM|PM)?)/i;

    let rm;
    while ((rm = rowRe.exec(html)) !== null && items.length < 10) {
      const [, link, title, srcRaw] = rm;
      if (!title || title.length < 5) continue;
      const src = srcRaw.replace(/[\[\]]/g, "").trim() || "Finviz";
      items.push({
        source:    "finviz",
        id:        `fv-${Date.now()}-${items.length}`,
        title:     title.trim(),
        link:      link.startsWith("http") ? link : `https://finviz.com${link}`,
        pubDate:   "",
        ts:        Date.now() - items.length * 60000,
        src,
        sentiment: scoreSentiment(title),
      });
    }

    // Also extract analyst ratings
    const ratingRe = /class="[^"]*analyst[^"]*"[\s\S]*?<td>([^<]+)<\/td>[\s\S]*?<td>([^<]+)<\/td>[\s\S]*?<td>([^<]+)<\/td>/g;
    const ratings: any[] = [];
    let rr;
    while ((rr = ratingRe.exec(html)) !== null && ratings.length < 5) {
      const [, date, firm, action] = rr;
      if (date && firm && action) {
        ratings.push({ date: date.trim(), firm: firm.trim(), action: action.trim() });
      }
    }

    return { news: items, ratings };
  } catch { return { news: [], ratings: [] }; }
}

// ─── 6. MarketWatch RSS ───────────────────────────────────────────────────────
async function fetchMarketWatch(ticker: string) {
  const url = `https://feeds.marketwatch.com/marketwatch/realtimeheadlines/`;
  try {
    const res = await safeFetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 180 } });
    if (!res?.ok) return [];
    const xml = await res.text();
    // Filter by ticker mention
    const allItems = parseRssItems(xml, "MarketWatch", 50);
    return allItems.filter(item =>
      item.title.toLowerCase().includes(ticker.toLowerCase()) ||
      item.desc?.toLowerCase().includes(ticker.toLowerCase())
    ).slice(0, 6);
  } catch { return []; }
}

// ─── 7. Seeking Alpha via topic search RSS ────────────────────────────────────
async function fetchSeekingAlpha(ticker: string) {
  const url = `https://seekingalpha.com/api/sa/combined/${ticker.toLowerCase()}.xml`;
  try {
    const res = await safeFetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://seekingalpha.com/",
      },
      next: { revalidate: 300 },
    }, 4000);
    if (!res?.ok) return [];
    const xml = await res.text();
    return parseRssItems(xml, "Seeking Alpha", 6);
  } catch { return []; }
}

// ─── Aggregate + dedupe ───────────────────────────────────────────────────────
function aggregateSentiment(allItems: any[]) {
  const weighted = allItems.map(item => {
    const weight = item.source === "sec" ? 3 : item.source === "yahoo" ? 2 : item.source === "finviz" ? 2 : 1;
    return { score: item.sentiment.score, weight };
  });
  const totalW = weighted.reduce((s, w) => s + w.weight, 0);
  const avg    = totalW > 0 ? Math.round(weighted.reduce((s, w) => s + w.score * w.weight, 0) / totalW) : 50;
  const bullCount = allItems.filter(i => i.sentiment.label === "bullish").length;
  const bearCount = allItems.filter(i => i.sentiment.label === "bearish").length;
  const trend  = bullCount > bearCount * 2 ? "strongly bullish" : bullCount > bearCount ? "bullish" : bearCount > bullCount * 2 ? "strongly bearish" : bearCount > bullCount ? "bearish" : "neutral";
  return {
    avg,
    label: avg >= 62 ? "bullish" as const : avg <= 38 ? "bearish" as const : "neutral" as const,
    trend,
    bullCount,
    bearCount,
    neutralCount: allItems.length - bullCount - bearCount,
    total: allItems.length,
  };
}

// ─── Mention volume (per-hour buckets, last 24h) ──────────────────────────────
function buildMentionVolume(items: any[]): { hour: string; count: number; bullish: number; bearish: number }[] {
  const now = Date.now();
  const buckets: Record<string, { count: number; bullish: number; bearish: number }> = {};
  for (let h = 23; h >= 0; h--) {
    const d = new Date(now - h * 3600000);
    const key = `${d.getHours().toString().padStart(2,"0")}:00`;
    buckets[key] = { count: 0, bullish: 0, bearish: 0 };
  }
  items.forEach(item => {
    const itemDate = new Date(item.ts);
    const age = now - item.ts;
    if (age > 86400000) return;
    const key = `${itemDate.getHours().toString().padStart(2,"0")}:00`;
    if (buckets[key]) {
      buckets[key].count++;
      if (item.sentiment.label === "bullish") buckets[key].bullish++;
      if (item.sentiment.label === "bearish") buckets[key].bearish++;
    }
  });
  return Object.entries(buckets).map(([hour, v]) => ({ hour, ...v }));
}

// ─── Alert detector ───────────────────────────────────────────────────────────
const ALERT_PATTERNS = [
  { re: /earnings? (beat|miss|surprise)/i,    type: "earnings",  priority: "high"   },
  { re: /(ceo|cfo|cto) (resign|appoint|named)/i, type: "management", priority: "high" },
  { re: /(fda|sec|doj) (approv|investigat|charg)/i, type: "regulatory", priority: "high" },
  { re: /(acquisition|merger|takeover|buyout)/i,   type: "ma",         priority: "high"   },
  { re: /guidance (raised|lowered|cut|increased)/i, type: "guidance",  priority: "high"   },
  { re: /dividend (raised|cut|special|initiat)/i,   type: "dividend",  priority: "medium" },
  { re: /(share buyback|repurchase program)/i,       type: "buyback",   priority: "medium" },
  { re: /analyst (upgrade|downgrade|initiat)/i,      type: "analyst",   priority: "medium" },
  { re: /(bankruptcy|chapter 11|default)/i,          type: "distress",  priority: "critical"},
  { re: /short (seller|report|interest spike)/i,     type: "short",     priority: "high"   },
];

function detectAlerts(items: any[]): { title: string; type: string; priority: string; source: string; link: string; ts: number }[] {
  const alerts: any[] = [];
  items.forEach(item => {
    ALERT_PATTERNS.forEach(({ re, type, priority }) => {
      if (re.test(item.title)) {
        alerts.push({ title: item.title, type, priority, source: item.src || item.source, link: item.link, ts: item.ts });
      }
    });
  });
  return alerts.sort((a, b) => {
    const p = { critical: 0, high: 1, medium: 2, low: 3 };
    return p[a.priority as keyof typeof p] - p[b.priority as keyof typeof p];
  }).slice(0, 5);
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  // Parallel fetch all sources
  const [reddit, googleNews, yahooNews, secFilings, finvizResult, mwNews, saNews] = await Promise.allSettled([
    fetchReddit(ticker),
    fetchGoogleNews(ticker),
    fetchYahooNews(ticker),
    fetchSecFilings(ticker),
    fetchFinviz(ticker),
    fetchMarketWatch(ticker),
    fetchSeekingAlpha(ticker),
  ]);

  const redditItems  = reddit.status      === "fulfilled" ? reddit.value      : [];
  const googleItems  = googleNews.status  === "fulfilled" ? googleNews.value  : [];
  const yahooItems   = yahooNews.status   === "fulfilled" ? yahooNews.value   : [];
  const secItems     = secFilings.status  === "fulfilled" ? secFilings.value  : [];
  const finvizData   = finvizResult.status === "fulfilled" ? finvizResult.value : { news: [], ratings: [] };
  const mwItems      = mwNews.status      === "fulfilled" ? mwNews.value      : [];
  const saItems      = saNews.status      === "fulfilled" ? saNews.value      : [];

  const finvizItems  = (finvizData as any).news  ?? [];
  const finvizRatings= (finvizData as any).ratings ?? [];

  // Combine all news (non-reddit)
  const allNews = [
    ...yahooItems,
    ...googleItems,
    ...finvizItems,
    ...mwItems,
    ...saItems,
    ...secItems,
  ].sort((a, b) => (b.ts || 0) - (a.ts || 0));

  // All items for sentiment
  const allItems = [...redditItems, ...allNews];

  const sentiment    = aggregateSentiment(allItems);
  const mentionVolume = buildMentionVolume(allItems);
  const alerts       = detectAlerts(allItems);

  return NextResponse.json({
    ticker,
    sentiment,
    mentionVolume,
    alerts,
    sources: {
      reddit:   redditItems.slice(0, 8),
      yahoo:    yahooItems.slice(0, 6),
      google:   googleItems.slice(0, 6),
      sec:      secItems.slice(0, 5),
      finviz:   finvizItems.slice(0, 6),
      seekingAlpha: saItems.slice(0, 4),
      marketwatch:  mwItems.slice(0, 4),
      analystRatings: finvizRatings,
    },
    totalItems: allItems.length,
    ts: Date.now(),
  }, {
    headers: { "Cache-Control": "s-maxage=90, stale-while-revalidate=60" },
  });
}
