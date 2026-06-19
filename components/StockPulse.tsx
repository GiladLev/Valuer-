"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, ExternalLink, MessageCircle, ThumbsUp,
  Newspaper, TrendingUp, TrendingDown, Minus,
  Twitter, AlertCircle, Radio
} from "lucide-react";
import { T, FONT } from "@/lib/theme";

// ── Types ────────────────────────────────────────────────────────────────────
type Sentiment = { score: number; label: "bullish" | "bearish" | "neutral" };
type RedditPost = {
  id: string; title: string; subreddit: string; score: number;
  upvoteRatio: number; numComments: number; url: string;
  created: number; sentiment: Sentiment; author: string;
};
type NewsItem = {
  title: string; link: string; pubDate: string;
  source: string; sentiment: Sentiment; ts: number;
};
type PulseData = {
  ticker: string;
  sentiment: { avg: number; label: "bullish" | "bearish" | "neutral" };
  reddit: RedditPost[];
  news: NewsItem[];
  ts: number;
};

interface Props {
  holdings: { ticker: string; shares: number; avgPrice: number; livePrice?: number }[];
}

// ── External tool links ──────────────────────────────────────────────────────
const TOOLS = (ticker: string) => [
  { name: "Twitter/X", icon: "𝕏", url: `https://twitter.com/search?q=%24${ticker}&src=typed_query&f=live`, color: "#000" },
  { name: "Reddit",     icon: "🔶", url: `https://www.reddit.com/search/?q=${ticker}&sort=new`, color: "#FF4500" },
  { name: "StockTwits", icon: "💬", url: `https://stocktwits.com/symbol/${ticker}`, color: T.blue },
  { name: "DeepValue",  icon: "📊", url: `https://deepvalue.io/stock/${ticker}`, color: T.violet },
  { name: "Yahoo News", icon: "📰", url: `https://finance.yahoo.com/quote/${ticker}/news`, color: "#720e9e" },
  { name: "SEC Edgar",  icon: "🏛",  url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${ticker}&type=10-K&dateb=&owner=include&count=10`, color: T.dim },
];

// ── Key parameters to track per business ─────────────────────────────────────
const KEY_PARAMS = [
  { icon: "📈", label: "Revenue Growth", desc: "האם ההכנסות ממשיכות לצמוח ברבעון?" },
  { icon: "💰", label: "Free Cash Flow", desc: "האם FCF חיובי וגדל?" },
  { icon: "🏰", label: "Moat Signals",   desc: "מה ניתנות תחרותיות ורמת מעבר לקוחות?" },
  { icon: "👥", label: "Mgmt Actions",   desc: "האם ההנהלה קונה מניות? buybacks?" },
  { icon: "📋", label: "Guidance",       desc: "האם הנהלה העלתה / הורידה תחזיות?" },
  { icon: "⚠️", label: "Risk Flags",     desc: "תביעות, רגולציה, ירידה בשוק?" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const sentimentColor = (s: Sentiment["label"]) =>
  s === "bullish" ? T.green : s === "bearish" ? T.red : T.peach;
const sentimentBg = (s: Sentiment["label"]) =>
  s === "bullish" ? T.greenSoft : s === "bearish" ? T.redSoft : T.peachSoft;
const SentIcon = ({ l }: { l: Sentiment["label"] }) =>
  l === "bullish" ? <TrendingUp size={13} /> : l === "bearish" ? <TrendingDown size={13} /> : <Minus size={13} />;

function timeAgo(ts: number): string {
  const d = (Date.now() / 1000 - ts);
  if (d < 3600)  return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}
function newsAgo(pubDate: string): string {
  const d = (Date.now() - new Date(pubDate).getTime()) / 1000;
  if (d < 3600)  return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}

// ── Sentiment Arc (SVG) ───────────────────────────────────────────────────────
function SentimentArc({ score, label }: { score: number; label: Sentiment["label"] }) {
  const color = sentimentColor(label);
  const pct = score / 100;
  // Half-circle arc
  const r = 44, stroke = 10;
  const circ = Math.PI * r; // half circumference
  const filled = circ * pct;
  const startX = 8, endX = 96;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={104} height={60} viewBox="0 0 104 60">
        {/* Track */}
        <path d={`M ${startX} 54 A ${r} ${r} 0 0 1 ${endX} 54`}
          fill="none" stroke={T.soft2} strokeWidth={stroke} strokeLinecap="round" />
        {/* Fill */}
        <path d={`M ${startX} 54 A ${r} ${r} 0 0 1 ${endX} 54`}
          fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }} />
        <text x={52} y={52} textAnchor="middle" fontSize={18} fontWeight={800} fill={color} fontFamily={FONT}>
          {score}
        </text>
      </svg>
      <span style={{ fontSize: 11, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: -4 }}>
        {label}
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StockPulse({ holdings }: Props) {
  const [activeTicker, setActiveTicker] = useState(holdings[0]?.ticker ?? "");
  const [data, setData] = useState<Record<string, PulseData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"reddit" | "news" | "params">("news");

  const fetch_ = useCallback(async (ticker: string) => {
    if (!ticker) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/sentiment?ticker=${ticker}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: PulseData = await res.json();
      setData(prev => ({ ...prev, [ticker]: json }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on ticker change
  useEffect(() => {
    if (activeTicker && !data[activeTicker]) fetch_(activeTicker);
  }, [activeTicker, data, fetch_]);

  const pulse = data[activeTicker];
  const card: any = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 22, boxShadow: T.shadow };
  const sectionBtn = (s: typeof activeSection) => ({
    padding: "7px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
    background: activeSection === s ? T.violet : T.soft,
    color: activeSection === s ? "#fff" : T.dim,
    border: `1.5px solid ${activeSection === s ? T.violet : T.border}`,
  });

  if (!holdings.length) {
    return (
      <div style={{ ...card, textAlign: "center", padding: "50px 20px" }}>
        <Radio size={28} color={T.faint} style={{ marginBottom: 10 }} />
        <div style={{ fontSize: 15, fontWeight: 700 }}>הוסף חברות לתיק תחילה</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, fontFamily: FONT, color: T.text }}>

      {/* ── Header strip ── */}
      <div style={{ ...card, padding: "16px 22px", background: `linear-gradient(135deg,#0f0c29,#302b63,#24243e)`, color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22ff88", boxShadow: "0 0 8px #22ff88", animation: "pulse-dot 1.4s ease-in-out infinite" }} />
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.04em", color: "#fff" }}>LIVE MARKET PULSE</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Reddit · News · Sentiment</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {holdings.map(h => {
            const p = data[h.ticker];
            const active = h.ticker === activeTicker;
            const sent = p?.sentiment;
            return (
              <button key={h.ticker} onClick={() => setActiveTicker(h.ticker)}
                style={{
                  padding: "8px 16px", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: FONT,
                  background: active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)",
                  color: "#fff", border: `1.5px solid ${active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.12)"}`,
                  display: "flex", alignItems: "center", gap: 7, transition: "all .15s",
                }}>
                {h.ticker}
                {sent && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 999,
                    background: sent.label === "bullish" ? "#22ff8833" : sent.label === "bearish" ? "#ff444433" : "#ffaa0033",
                    color: sent.label === "bullish" ? "#22ff88" : sent.label === "bearish" ? "#ff6666" : "#ffcc55" }}>
                    {sent.avg}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main panel ── */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 18, alignItems: "start" }}>

        {/* ─ Left: Sentiment + Tools ─ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Sentiment card */}
          <div style={{ ...card, textAlign: "center", padding: "20px 16px" }}>
            <div style={{ fontSize: 11.5, color: T.faint, fontWeight: 700, marginBottom: 12, letterSpacing: "0.05em" }}>
              SENTIMENT SCORE — {activeTicker}
            </div>
            {loading && !pulse ? (
              <div style={{ padding: "20px 0", color: T.dim, fontSize: 13 }}>
                <RefreshCw size={20} color={T.violet} className="spin" style={{ marginBottom: 8 }} />
                <div>מושך נתוני סנטימנט...</div>
              </div>
            ) : pulse ? (
              <>
                <SentimentArc score={pulse.sentiment.avg} label={pulse.sentiment.label} />
                <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center" }}>
                  {(["bullish","neutral","bearish"] as const).map(l => {
                    const count = [...pulse.reddit, ...pulse.news].filter(x => x.sentiment.label === l).length;
                    return (
                      <div key={l} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: sentimentColor(l) }}>{count}</div>
                        <div style={{ fontSize: 10, color: T.faint, fontWeight: 600, textTransform: "capitalize" }}>{l}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 12, fontSize: 10, color: T.faint }}>
                  עודכן {new Date(pulse.ts).toLocaleTimeString("he-IL")}
                </div>
                <button onClick={() => fetch_(activeTicker)} disabled={loading}
                  style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9,
                    background: T.soft, border: `1px solid ${T.border}`, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    fontFamily: FONT, color: T.dim, margin: "10px auto 0" }}>
                  <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
                  רענן
                </button>
              </>
            ) : (
              <div style={{ color: T.dim, fontSize: 12.5, padding: "10px 0" }}>בוחר מניה...</div>
            )}
          </div>

          {/* External tools */}
          <div style={card}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: T.faint, letterSpacing: "0.05em", marginBottom: 12 }}>
              כלי מעקב חיצוניים
            </div>
            {TOOLS(activeTicker).map(({ name, icon, url, color }) => (
              <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 10,
                  textDecoration: "none", color: T.text, marginBottom: 4, transition: "background .12s" }}
                onMouseEnter={e => (e.currentTarget.style.background = T.soft)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color }}>{name}</span>
                <ExternalLink size={11} color={T.faint} style={{ marginLeft: "auto" }} />
              </a>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{ ...card, background: T.redSoft, border: `1px solid ${T.red}44`, direction: "rtl" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: T.red, fontWeight: 600 }}>
                <AlertCircle size={14} /> {error}
              </div>
              <div style={{ fontSize: 11, color: T.dim, marginTop: 6 }}>
                נסה שוב — ייתכן שיש בעיה עם חיבור לשרתי Reddit/News
              </div>
            </div>
          )}
        </div>

        {/* ─ Right: Feed ─ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Section selector */}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={sectionBtn("news")}    onClick={() => setActiveSection("news")}>
              📰 חדשות
            </button>
            <button style={sectionBtn("reddit")}  onClick={() => setActiveSection("reddit")}>
              🔶 Reddit
            </button>
            <button style={sectionBtn("params")}  onClick={() => setActiveSection("params")}>
              📋 מה לעקוב
            </button>
          </div>

          {/* News feed */}
          {activeSection === "news" && (
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>
                📰 חדשות אחרונות — {activeTicker}
              </div>
              {loading && !pulse ? (
                <div style={{ color: T.dim, textAlign: "center", padding: "30px 0" }}>
                  <RefreshCw size={18} className="spin" color={T.violet} />
                  <div style={{ marginTop: 8, fontSize: 13 }}>מושך כותרות...</div>
                </div>
              ) : pulse?.news.length ? pulse.news.map((item, i) => (
                <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                  style={{ display: "block", textDecoration: "none", color: T.text, padding: "12px 0",
                    borderBottom: i < pulse.news.length - 1 ? `1px solid ${T.border}` : "none" }}
                  onMouseEnter={e => (e.currentTarget.style.background = T.soft + "66")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, flexShrink: 0, marginTop: 1,
                      color: sentimentColor(item.sentiment.label),
                      background: sentimentBg(item.sentiment.label),
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      <SentIcon l={item.sentiment.label} />
                      {item.sentiment.label}
                    </span>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.4, marginBottom: 4 }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 11, color: T.faint, display: "flex", gap: 10 }}>
                        <span>{item.source}</span>
                        <span>·</span>
                        <span>{newsAgo(item.pubDate)}</span>
                        <ExternalLink size={10} style={{ marginLeft: 2 }} />
                      </div>
                    </div>
                  </div>
                </a>
              )) : (
                <div style={{ color: T.dim, textAlign: "center", padding: "30px 0", fontSize: 13 }}>
                  {pulse ? "אין כותרות זמינות כרגע" : "לחץ רענן לטעינת נתונים"}
                </div>
              )}
            </div>
          )}

          {/* Reddit feed */}
          {activeSection === "reddit" && (
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>🔶 Reddit — r/stocks & r/investing</span>
                <a href={`https://www.reddit.com/search/?q=${activeTicker}&sort=new`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: T.violet, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                  פתח Reddit <ExternalLink size={10} />
                </a>
              </div>
              {loading && !pulse ? (
                <div style={{ color: T.dim, textAlign: "center", padding: "30px 0" }}>
                  <RefreshCw size={18} className="spin" color={T.violet} />
                  <div style={{ marginTop: 8, fontSize: 13 }}>מושך פוסטים מ-Reddit...</div>
                </div>
              ) : pulse?.reddit.length ? pulse.reddit.map((post, i) => (
                <a key={post.id} href={post.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "block", textDecoration: "none", color: T.text, padding: "12px 0",
                    borderBottom: i < pulse.reddit.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    {/* Vote score */}
                    <div style={{ textAlign: "center", minWidth: 40, flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: post.score > 100 ? T.green : T.dim }}>
                        {post.score > 1000 ? `${(post.score/1000).toFixed(1)}k` : post.score}
                      </div>
                      <div style={{ fontSize: 9, color: T.faint, fontWeight: 600 }}>votes</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.4, marginBottom: 5 }}>
                        {post.title}
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: T.faint, alignItems: "center" }}>
                        <span style={{ color: "#FF4500", fontWeight: 700 }}>{post.subreddit}</span>
                        <span>·</span>
                        <span>{timeAgo(post.created)}</span>
                        <span>·</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <MessageCircle size={10} /> {post.numComments}
                        </span>
                        <span>·</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <ThumbsUp size={10} /> {Math.round(post.upvoteRatio * 100)}%
                        </span>
                        <span style={{ marginLeft: "auto",
                          color: sentimentColor(post.sentiment.label),
                          background: sentimentBg(post.sentiment.label),
                          padding: "1px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700,
                          display: "flex", alignItems: "center", gap: 3 }}>
                          <SentIcon l={post.sentiment.label} /> {post.sentiment.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              )) : (
                <div style={{ color: T.dim, textAlign: "center", padding: "30px 0", fontSize: 13 }}>
                  {pulse ? "אין פוסטים זמינים ב-Reddit כרגע" : "לחץ על שם המניה לטעינה"}
                </div>
              )}
            </div>
          )}

          {/* Key parameters to track */}
          {activeSection === "params" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ ...card, background: `linear-gradient(135deg,#0f0c29,#302b63)`, color: "#fff", padding: "20px 22px" }}>
                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>📋 מה לעקוב לכל עסק?</div>
                <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
                  לפי גישת "סטוק פיקינג" — מעקב אחרי פרמטרים קריטיים, לא רק מחיר המניה
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {KEY_PARAMS.map(({ icon, label, desc }, i) => (
                  <div key={i} style={{ ...card, padding: "14px 16px" }}>
                    <div style={{ fontSize: 20, marginBottom: 7 }}>{icon}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 5, color: T.violetText }}>{label}</div>
                    <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.55, direction: "rtl", fontWeight: 500 }}>{desc}</div>
                  </div>
                ))}
              </div>

              {/* Twitter/X Search widget */}
              <div style={{ ...card, direction: "rtl" }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>🐦 חיפוש מהיר ב-Twitter/X</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    `$${activeTicker}`, `${activeTicker} earnings`, `${activeTicker} stock`,
                    `${activeTicker} guidance`, `${activeTicker} Q1 2025`,
                  ].map(q => (
                    <a key={q} href={`https://twitter.com/search?q=${encodeURIComponent(q)}&f=live`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 9,
                        background: T.soft, border: `1px solid ${T.border}`, fontSize: 12.5, fontWeight: 700,
                        color: T.text, textDecoration: "none" }}
                      onMouseEnter={e => (e.currentTarget.style.background = T.violetSoft)}
                      onMouseLeave={e => (e.currentTarget.style.background = T.soft)}>
                      {q} <ExternalLink size={10} color={T.faint} />
                    </a>
                  ))}
                </div>
              </div>

              {/* DeepValue / Maya links */}
              <div style={{ ...card, direction: "rtl" }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>🔗 מקורות מעמיקים ל-{activeTicker}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { name: "10-K SEC Filings", url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${activeTicker}&type=10-K`, desc: "דוחות שנתיים", icon: "🏛" },
                    { name: "Earnings Transcripts", url: `https://seekingalpha.com/symbol/${activeTicker}/earnings/transcripts`, desc: "שיחות ועידה", icon: "🎙" },
                    { name: "Insider Trades", url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${activeTicker}&type=4`, desc: "מסחר פנים", icon: "👤" },
                    { name: "Short Interest", url: `https://finviz.com/quote.ashx?t=${activeTicker}`, desc: "שורטים ותחזיות", icon: "📉" },
                  ].map(({ name, url, desc, icon }) => (
                    <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                      style={{ display: "flex", gap: 10, padding: "10px 12px", borderRadius: 12,
                        background: T.soft, border: `1px solid ${T.border}`, textDecoration: "none",
                        color: T.text, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 20 }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: T.violetText }}>{name}</div>
                        <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>{desc}</div>
                      </div>
                      <ExternalLink size={11} color={T.faint} style={{ marginLeft: "auto", flexShrink: 0, marginTop: 2 }} />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CSS for pulse dot animation */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
}
