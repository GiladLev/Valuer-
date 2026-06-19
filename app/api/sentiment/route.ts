import { NextRequest, NextResponse } from "next/server";

const UA = "Valuer/1.0 (valuer-app; educational)";

// ── Sentiment keywords ──────────────────────────────────────────────────────
const BULLISH = ["buy","long","calls","moon","ath","breakout","bullish","strong","beat","growth","rally","surge","outperform","upgrade","raised","record","milestone","🚀","💰","🟢"];
const BEARISH  = ["sell","short","puts","crash","dump","bearish","miss","weak","overvalued","bubble","downgrade","cut","layoffs","lawsuit","fraud","loss","decline","risk","⚠️","🔴","📉"];

function scoreSentiment(text: string): { score: number; label: "bullish" | "bearish" | "neutral" } {
  const t = text.toLowerCase();
  const b = BULLISH.filter(w => t.includes(w)).length;
  const s = BEARISH.filter(w => t.includes(w)).length;
  const raw = b - s;
  const score = Math.max(0, Math.min(100, 50 + raw * 12));
  return { score, label: raw > 0 ? "bullish" : raw < 0 ? "bearish" : "neutral" };
}

// ── Reddit ──────────────────────────────────────────────────────────────────
async function fetchReddit(ticker: string) {
  const subs = "stocks+investing+wallstreetbets+ValueInvesting+SecurityAnalysis+SecurityAnalysis+stockmarket";
  const url = `https://www.reddit.com/r/${subs}/search.json?q=${encodeURIComponent(ticker)}&sort=new&restrict_sr=on&limit=12&type=link`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 120 }, // cache 2 min
    });
    if (!res.ok) return [];
    const json = await res.json();
    const posts = json?.data?.children ?? [];
    return posts.map((p: any) => {
      const d = p.data;
      const sentiment = scoreSentiment(`${d.title} ${d.selftext ?? ""}`);
      return {
        id: d.id,
        title: d.title,
        subreddit: d.subreddit_name_prefixed,
        score: d.score,
        upvoteRatio: d.upvote_ratio,
        numComments: d.num_comments,
        url: `https://reddit.com${d.permalink}`,
        created: d.created_utc,
        sentiment,
        author: d.author,
      };
    });
  } catch {
    return [];
  }
}

// ── Google News RSS ─────────────────────────────────────────────────────────
async function fetchNews(ticker: string) {
  const query = encodeURIComponent(`${ticker} stock`);
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 180 },
    });
    if (!res.ok) return [];
    const xml = await res.text();

    // Lightweight XML parse — extract <item> blocks
    const items: any[] = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = itemRe.exec(xml)) !== null && items.length < 12) {
      const block = m[1];
      const get = (tag: string) => {
        const r = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`);
        const match = r.exec(block);
        return match ? (match[1] || match[2] || "").trim() : "";
      };
      const title   = get("title");
      const link    = get("link");
      const pubDate = get("pubDate");
      const source  = get("source") || "News";
      if (!title) continue;
      const sentiment = scoreSentiment(title);
      items.push({ title, link, pubDate, source, sentiment, ts: new Date(pubDate).getTime() });
    }
    return items;
  } catch {
    return [];
  }
}

// ── Aggregate sentiment ─────────────────────────────────────────────────────
function aggregateSentiment(reddit: any[], news: any[]) {
  const all = [...reddit.map(r => r.sentiment.score), ...news.map(n => n.sentiment.score)];
  if (!all.length) return { avg: 50, label: "neutral" as const };
  const avg = Math.round(all.reduce((s, v) => s + v, 0) / all.length);
  return { avg, label: avg >= 60 ? "bullish" as const : avg <= 40 ? "bearish" as const : "neutral" as const };
}

// ── Route handler ───────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const [reddit, news] = await Promise.all([fetchReddit(ticker), fetchNews(ticker)]);
  const sentiment = aggregateSentiment(reddit, news);

  return NextResponse.json({
    ticker,
    sentiment,
    reddit: reddit.slice(0, 8),
    news: news.slice(0, 8),
    ts: Date.now(),
  });
}
