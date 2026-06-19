"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCw, ExternalLink, AlertTriangle, Radio,
  TrendingUp, TrendingDown, Minus, FileText, MessageCircle,
  ThumbsUp, Newspaper, BarChart2, Bell, Clock, Shield,
  ChevronDown, ChevronRight, Zap
} from "lucide-react";
import { FONT } from "@/lib/theme";

// ─── Dark theme ───────────────────────────────────────────────────────────────
const D = {
  bg:       "#0b1120",
  card:     "#131d2e",
  card2:    "#1a2540",
  card3:    "#0f1729",
  border:   "rgba(255,255,255,0.07)",
  border2:  "rgba(255,255,255,0.13)",
  text:     "#e2e8f4",
  dim:      "#8896b3",
  faint:    "#4a5568",
  green:    "#10e8a4",
  greenBg:  "rgba(16,232,164,0.1)",
  red:      "#ff5c6e",
  redBg:    "rgba(255,92,110,0.1)",
  orange:   "#f59e0b",
  orangeBg: "rgba(245,158,11,0.1)",
  violet:   "#7c5cfc",
  violetBg: "rgba(124,92,252,0.12)",
  blue:     "#60a5fa",
  blueBg:   "rgba(96,165,250,0.1)",
  critical: "#ff3b30",
  critBg:   "rgba(255,59,48,0.12)",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type SentLabel = "bullish" | "bearish" | "neutral";
type Priority  = "critical" | "high" | "medium" | "low";

interface PulseData {
  ticker: string;
  sentiment: { avg: number; label: SentLabel; trend: string; bullCount: number; bearCount: number; neutralCount: number; total: number };
  mentionVolume: { hour: string; count: number; bullish: number; bearish: number }[];
  alerts: { title: string; type: string; priority: Priority; source: string; link: string; ts: number }[];
  sources: {
    reddit: any[]; yahoo: any[]; google: any[]; sec: any[];
    finviz: any[]; seekingAlpha: any[]; marketwatch: any[];
    analystRatings: { date: string; firm: string; action: string }[];
  };
  totalItems: number;
  ts: number;
}

interface Props {
  holdings: { ticker: string; shares: number; avgPrice: number; livePrice?: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sentColor = (l: SentLabel) => l === "bullish" ? D.green : l === "bearish" ? D.red : D.orange;
const sentBg    = (l: SentLabel) => l === "bullish" ? D.greenBg : l === "bearish" ? D.redBg : D.orangeBg;
const prioColor = (p: Priority)  => p === "critical" ? D.critical : p === "high" ? D.red : p === "medium" ? D.orange : D.dim;
const prioBg    = (p: Priority)  => p === "critical" ? D.critBg   : p === "high" ? D.redBg : p === "medium" ? D.orangeBg : "rgba(255,255,255,0.04)";
const srcColor  = (s: string)    => s === "reddit" ? "#ff4500" : s === "sec" ? "#1a73e8" : s === "yahoo" ? "#720e9e" : s === "finviz" ? "#e8671a" : s === "seekingAlpha" ? "#f59e0b" : D.blue;
const srcIcon   = (s: string)    => s === "reddit" ? "🔶" : s === "sec" ? "🏛" : s === "yahoo" ? "📊" : s === "finviz" ? "📈" : s === "seekingAlpha" ? "🔍" : "📰";
const alertIcon = (t: string)    => ({ earnings:"💰", management:"👤", regulatory:"⚖️", ma:"🤝", guidance:"📋", dividend:"💵", buyback:"🔄", analyst:"📣", distress:"🚨", short:"📉" })[t] ?? "⚡";

function timeAgo(ts: number): string {
  const d = (Date.now() - ts) / 1000;
  if (d < 60)   return `${Math.round(d)}s ago`;
  if (d < 3600) return `${Math.round(d/60)}m ago`;
  if (d < 86400)return `${Math.round(d/3600)}h ago`;
  return `${Math.round(d/86400)}d ago`;
}

// ─── SVG Sentiment Gauge ──────────────────────────────────────────────────────
function SentimentGauge({ score, label, trend }: { score: number; label: SentLabel; trend: string }) {
  const color = sentColor(label);
  const r = 52, sw = 11, cx = 70, cy = 66;
  const circ = Math.PI * r;
  const filled = circ * (score / 100);
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={140} height={78} viewBox="0 0 140 78">
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} strokeLinecap="round" />
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`} style={{ transition: "stroke-dasharray .7s ease", filter: `drop-shadow(0 0 6px ${color}88)` }} />
        <text x={cx} y={cy - 10} textAnchor="middle" fontSize={22} fontWeight={800} fill={color} fontFamily={FONT}>{score}</text>
        <text x={cx} y={cy + 6}  textAnchor="middle" fontSize={10} fontWeight={700} fill={D.dim} fontFamily={FONT}>/ 100</text>
      </svg>
      <div style={{ fontSize: 11, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: -4 }}>
        {label}
      </div>
      <div style={{ fontSize: 10.5, color: D.faint, marginTop: 3 }}>{trend}</div>
    </div>
  );
}

// ─── Volume Heatmap ───────────────────────────────────────────────────────────
function VolumeBar({ data }: { data: { hour: string; count: number; bullish: number; bearish: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  const recent = data.slice(-8); // last 8 hours
  return (
    <div>
      <div style={{ fontSize: 11, color: D.faint, fontWeight: 700, marginBottom: 8, letterSpacing: "0.04em" }}>MENTIONS LAST 8H</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 48 }}>
        {recent.map((d, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 40 }}>
              {d.count > 0 && (
                <div style={{ width: "100%", borderRadius: "3px 3px 0 0", overflow: "hidden" }}>
                  {d.bullish > 0 && <div style={{ height: `${(d.bullish/max)*32}px`, background: D.green, opacity: 0.8 }} />}
                  {d.bearish > 0 && <div style={{ height: `${(d.bearish/max)*32}px`, background: D.red, opacity: 0.8 }} />}
                  {(d.count - d.bullish - d.bearish) > 0 && (
                    <div style={{ height: `${((d.count-d.bullish-d.bearish)/max)*32}px`, background: D.orange, opacity: 0.6 }} />
                  )}
                </div>
              )}
              {d.count === 0 && <div style={{ height: 2, background: "rgba(255,255,255,0.05)", borderRadius: 2 }} />}
            </div>
            <div style={{ fontSize: 8.5, color: D.faint }}>{d.hour}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 9.5, color: D.faint }}>
        <span><span style={{ color: D.green }}>■</span> Bullish</span>
        <span><span style={{ color: D.red }}>■</span> Bearish</span>
        <span><span style={{ color: D.orange }}>■</span> Neutral</span>
      </div>
    </div>
  );
}

// ─── News Item ─────────────────────────────────────────────────────────────────
function NewsItem({ item, showSource = true }: { item: any; showSource?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <a href={item.link} target="_blank" rel="noopener noreferrer"
      style={{ display: "block", textDecoration: "none", color: D.text, padding: "10px 14px",
        borderRadius: 10, background: hov ? "rgba(255,255,255,0.03)" : "transparent",
        transition: "background .1s", marginBottom: 2 }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
        {showSource && (
          <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{srcIcon(item.source)}</span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.45, marginBottom: 5, color: D.text }}>
            {item.title}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 999,
              color: sentColor(item.sentiment.label), background: sentBg(item.sentiment.label),
              display: "flex", alignItems: "center", gap: 3 }}>
              {item.sentiment.label === "bullish" ? <TrendingUp size={9} /> : item.sentiment.label === "bearish" ? <TrendingDown size={9} /> : <Minus size={9} />}
              {item.sentiment.label}
            </span>
            {item.src && <span style={{ fontSize: 10, color: D.faint }}>{item.src}</span>}
            {item.ts && <span style={{ fontSize: 10, color: D.faint }}>· {timeAgo(item.ts)}</span>}
            {item.form && <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 5, background: D.blueBg, color: D.blue }}>{item.form}</span>}
            <ExternalLink size={9} color={D.faint} style={{ marginLeft: "auto" }} />
          </div>
        </div>
      </div>
    </a>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, title, count, color = D.blue }: { icon: React.ReactNode; title: string; count?: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "0 14px" }}>
      <span style={{ color }}>{icon}</span>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: D.text }}>{title}</span>
      {count !== undefined && (
        <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 700, padding: "1px 8px", borderRadius: 999,
          background: "rgba(255,255,255,0.06)", color: D.dim }}>{count} items</span>
      )}
    </div>
  );
}

// ─── Card container ───────────────────────────────────────────────────────────
function PulseCard({ children, style = {} }: { children: React.ReactNode; style?: any }) {
  return (
    <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 14, paddingTop: 14, paddingBottom: 6, ...style }}>
      {children}
    </div>
  );
}

// ─── External tools quick links ───────────────────────────────────────────────
const QUICK_TOOLS = (ticker: string) => [
  { label: "Twitter/X Live",   url: `https://twitter.com/search?q=%24${ticker}&f=live`,           icon: "𝕏",  color: "#fff"    },
  { label: "Reddit",           url: `https://reddit.com/search/?q=${ticker}&sort=new`,            icon: "🔶", color: "#ff4500" },
  { label: "StockTwits",       url: `https://stocktwits.com/symbol/${ticker}`,                     icon: "💬", color: D.blue    },
  { label: "Finviz",           url: `https://finviz.com/quote.ashx?t=${ticker}`,                   icon: "📈", color: "#e8671a" },
  { label: "Seeking Alpha",    url: `https://seekingalpha.com/symbol/${ticker}/news`,              icon: "🔍", color: D.orange  },
  { label: "SEC Filings",      url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker}&type=8-K`, icon: "🏛", color: "#1a73e8" },
  { label: "Earnings History", url: `https://stockanalysis.com/stocks/${ticker.toLowerCase()}/financials/`, icon: "📊", color: D.green  },
  { label: "Insider Trades",   url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker}&type=4`, icon: "👤", color: D.violet },
];

// ─── Main Component ────────────────────────────────────────────────────────────
export default function StockPulse({ holdings }: Props) {
  const [activeTicker, setActiveTicker] = useState(holdings[0]?.ticker ?? "");
  const [pulseData, setPulseData]       = useState<Record<string, PulseData>>({});
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [activeTab, setActiveTab]       = useState<"all" | "alerts" | "reddit" | "sec" | "analyst">("all");
  const [autoRefresh, setAutoRefresh]   = useState(false);
  const [expandedAlerts, setExpandedAlerts] = useState(true);
  const autoRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPulse = useCallback(async (ticker: string) => {
    if (!ticker) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/sentiment?ticker=${ticker}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: PulseData = await res.json();
      setPulseData(prev => ({ ...prev, [ticker]: json }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTicker && !pulseData[activeTicker]) fetchPulse(activeTicker);
  }, [activeTicker, pulseData, fetchPulse]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    if (autoRefresh) {
      autoRef.current = setInterval(() => fetchPulse(activeTicker), 120000);
    } else if (autoRef.current) {
      clearInterval(autoRef.current);
    }
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [autoRefresh, activeTicker, fetchPulse]);

  const pulse = pulseData[activeTicker];
  const tabBtn = (t: typeof activeTab) => ({
    padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
    fontFamily: FONT, border: "none", transition: "all .12s",
    background: activeTab === t ? D.violetBg : "transparent",
    color: activeTab === t ? D.violet : D.dim,
    borderBottom: `2px solid ${activeTab === t ? D.violet : "transparent"}`,
  });

  if (!holdings.length) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: D.faint }}>
        <Radio size={32} style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 15, fontWeight: 700 }}>הוסף חברות לתיק</div>
      </div>
    );
  }

  // Flatten all news for "all" tab
  const allNews = pulse ? [
    ...pulse.sources.yahoo,
    ...pulse.sources.google,
    ...pulse.sources.finviz,
    ...pulse.sources.marketwatch,
    ...pulse.sources.seekingAlpha,
  ].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 20) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: FONT, color: D.text }}>

      {/* ── LIVE HEADER BAR ── */}
      <div style={{
        background: "linear-gradient(135deg,#0f0c29,#302b63,#0b1120)",
        border: `1px solid ${D.border}`, borderRadius: 14, padding: "14px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#22ff88",
            boxShadow: "0 0 10px #22ff88", animation: "pulse-dot 1.4s ease-in-out infinite" }} />
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.05em" }}>LIVE MARKET INTELLIGENCE</span>
          <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", marginLeft: 4 }}>
            7 sources · Reddit, Yahoo, SEC, Finviz, Google News, Seeking Alpha, MarketWatch
          </span>
          {pulse && (
            <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
              {pulse.totalItems} items · {timeAgo(pulse.ts)}
            </span>
          )}
        </div>

        {/* Ticker selector pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {holdings.map((h, i) => {
            const p = pulseData[h.ticker];
            const active = h.ticker === activeTicker;
            const lp = h.livePrice || h.avgPrice;
            const chg = ((lp - h.avgPrice) / h.avgPrice) * 100;
            return (
              <button key={h.ticker} onClick={() => setActiveTicker(h.ticker)}
                style={{
                  padding: "8px 16px", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: FONT,
                  background: active ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
                  color: "#fff", border: `1.5px solid ${active ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.08)"}`,
                  display: "flex", alignItems: "center", gap: 8, transition: "all .15s",
                }}>
                <span>{h.ticker}</span>
                <span style={{ fontSize: 10.5, color: chg >= 0 ? "#22ff88" : "#ff6666", fontVariantNumeric: "tabular-nums" }}>
                  {chg >= 0 ? "+" : ""}{chg.toFixed(1)}%
                </span>
                {p && (
                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 999,
                    background: p.sentiment.label === "bullish" ? "rgba(34,255,136,0.2)" : p.sentiment.label === "bearish" ? "rgba(255,92,110,0.2)" : "rgba(245,158,11,0.2)",
                    color: p.sentiment.label === "bullish" ? "#22ff88" : p.sentiment.label === "bearish" ? "#ff6666" : "#f5a623" }}>
                    {p.sentiment.avg}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => fetchPulse(activeTicker)} disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 8,
              background: D.violetBg, border: `1px solid ${D.violet}44`, color: D.violet,
              fontSize: 12, fontWeight: 700, cursor: loading ? "wait" : "pointer", fontFamily: FONT }}>
            <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            {loading ? "מושך נתונים..." : "Refresh All"}
          </button>
          <button onClick={() => setAutoRefresh(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8,
              background: autoRefresh ? D.greenBg : "rgba(255,255,255,0.05)",
              border: `1px solid ${autoRefresh ? D.green+"44" : D.border}`,
              color: autoRefresh ? D.green : D.dim, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
            <Zap size={12} />
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh"}
          </button>
          {error && (
            <span style={{ fontSize: 11.5, color: D.red, display: "flex", alignItems: "center", gap: 5 }}>
              <AlertTriangle size={12} /> {error}
            </span>
          )}
        </div>
      </div>

      {/* ── MAIN GRID ── */}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>

        {/* ─ LEFT COLUMN: Sentiment + Stats + Tools ─ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Sentiment gauge */}
          <PulseCard>
            <SectionHeader icon={<BarChart2 size={14} />} title={`SENTIMENT — ${activeTicker}`} />
            <div style={{ padding: "0 14px 10px" }}>
              {loading && !pulse ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: D.dim }}>
                  <RefreshCw size={20} color={D.violet} className="spin" style={{ marginBottom: 8, display: "block", margin: "0 auto 8px" }} />
                  <div style={{ fontSize: 12 }}>מושך מ-7 מקורות...</div>
                </div>
              ) : pulse ? (
                <>
                  <SentimentGauge score={pulse.sentiment.avg} label={pulse.sentiment.label} trend={pulse.sentiment.trend} />
                  <div style={{ display: "flex", justifyContent: "space-around", marginTop: 14, paddingTop: 12, borderTop: `1px solid ${D.border}` }}>
                    {[
                      { label: "Bullish", val: pulse.sentiment.bullCount,   color: D.green  },
                      { label: "Neutral", val: pulse.sentiment.neutralCount, color: D.orange },
                      { label: "Bearish", val: pulse.sentiment.bearCount,    color: D.red    },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color }}>{val}</div>
                        <div style={{ fontSize: 9.5, color: D.faint, fontWeight: 600 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <VolumeBar data={pulse.mentionVolume} />
                  </div>
                  <div style={{ marginTop: 10, textAlign: "center", fontSize: 9.5, color: D.faint }}>
                    {pulse.totalItems} items · {timeAgo(pulse.ts)}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "20px 0", fontSize: 12, color: D.faint }}>
                  בחר מניה לטעינה
                </div>
              )}
            </div>
          </PulseCard>

          {/* Quick links */}
          <PulseCard>
            <SectionHeader icon={<ExternalLink size={14} />} title="Quick Access" />
            <div style={{ padding: "0 6px 8px" }}>
              {QUICK_TOOLS(activeTicker).map(({ label, url, icon, color }) => (
                <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 8,
                    textDecoration: "none", color: D.text, transition: "background .1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <span style={{ fontSize: 15 }}>{icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
                  <ExternalLink size={10} color={D.faint} style={{ marginLeft: "auto" }} />
                </a>
              ))}
            </div>
          </PulseCard>
        </div>

        {/* ─ RIGHT COLUMN: Feed ─ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* ALERTS — always show at top if any */}
          {pulse?.alerts && pulse.alerts.length > 0 && (
            <PulseCard style={{ border: `1px solid ${D.red}33` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px", marginBottom: 10, cursor: "pointer" }}
                onClick={() => setExpandedAlerts(v => !v)}>
                <Bell size={14} color={D.red} />
                <span style={{ fontSize: 12.5, fontWeight: 800, color: D.red }}>
                  {pulse.alerts.length} MATERIAL ALERTS
                </span>
                <span style={{ marginLeft: "auto", color: D.faint }}>
                  {expandedAlerts ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
              </div>
              {expandedAlerts && pulse.alerts.map((alert, i) => (
                <a key={i} href={alert.link} target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px", textDecoration: "none",
                    background: prioBg(alert.priority), borderTop: `1px solid ${D.border}` }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{alertIcon(alert.type)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: D.text, lineHeight: 1.4 }}>{alert.title}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 10, color: D.faint, alignItems: "center" }}>
                      <span style={{ padding: "1px 7px", borderRadius: 999, background: prioBg(alert.priority), color: prioColor(alert.priority), fontWeight: 800 }}>
                        {alert.priority.toUpperCase()}
                      </span>
                      <span>{alert.type}</span>
                      <span>· {alert.source}</span>
                    </div>
                  </div>
                  <ExternalLink size={11} color={D.faint} />
                </a>
              ))}
            </PulseCard>
          )}

          {/* Tab bar */}
          <div style={{ display: "flex", gap: 4, background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, padding: 4, flexWrap: "wrap" }}>
            {([
              ["all",     "📰 כל המקורות"],
              ["alerts",  "🚨 SEC Filings"],
              ["reddit",  "🔶 Reddit"],
              ["analyst", "📣 Analysts"],
            ] as [typeof activeTab, string][]).map(([t, label]) => (
              <button key={t} onClick={() => setActiveTab(t)} style={tabBtn(t)}>{label}</button>
            ))}
          </div>

          {/* All news feed */}
          {activeTab === "all" && (
            <PulseCard>
              <SectionHeader icon={<Newspaper size={14} />} title="All Sources Feed" count={allNews.length} />
              {loading && !pulse ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: D.dim }}>
                  <RefreshCw size={18} className="spin" color={D.violet} style={{ display: "block", margin: "0 auto 8px" }} />
                  <div style={{ fontSize: 12 }}>מושך נתונים מ-7 מקורות...</div>
                </div>
              ) : allNews.length ? allNews.map((item, i) => (
                <div key={i} style={{ borderTop: i > 0 ? `1px solid ${D.border}` : "none" }}>
                  <NewsItem item={item} />
                </div>
              )) : (
                <div style={{ textAlign: "center", padding: "30px", color: D.faint, fontSize: 12 }}>
                  {pulse ? "אין נתונים זמינים" : "לחץ Refresh לטעינה"}
                </div>
              )}
            </PulseCard>
          )}

          {/* SEC filings */}
          {activeTab === "alerts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <PulseCard>
                <SectionHeader icon={<Shield size={14} color={D.blue} />} title="SEC EDGAR — Recent Filings" count={pulse?.sources.sec.length} color={D.blue} />
                {pulse?.sources.sec.length ? pulse.sources.sec.map((item, i) => (
                  <div key={i} style={{ borderTop: i > 0 ? `1px solid ${D.border}` : "none" }}>
                    <NewsItem item={item} />
                  </div>
                )) : (
                  <div style={{ textAlign: "center", padding: "24px", color: D.faint, fontSize: 12 }}>
                    {loading ? "מושך ממשרד SEC..." : "אין תיוקים אחרונים"}
                  </div>
                )}
              </PulseCard>
              {/* Yahoo Finance */}
              <PulseCard>
                <SectionHeader icon={<span style={{ fontSize: 14 }}>📊</span>} title="Yahoo Finance News" count={pulse?.sources.yahoo.length} />
                {pulse?.sources.yahoo.length ? pulse.sources.yahoo.map((item, i) => (
                  <div key={i} style={{ borderTop: i > 0 ? `1px solid ${D.border}` : "none" }}>
                    <NewsItem item={item} />
                  </div>
                )) : (
                  <div style={{ textAlign: "center", padding: "24px", color: D.faint, fontSize: 12 }}>
                    {loading ? "מושך מ-Yahoo Finance..." : "אין חדשות"}
                  </div>
                )}
              </PulseCard>
            </div>
          )}

          {/* Reddit */}
          {activeTab === "reddit" && (
            <PulseCard>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 14px", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>🔶</span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: D.text }}>Reddit Feed</span>
                </div>
                <a href={`https://www.reddit.com/search/?q=${activeTicker}&sort=new`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 10.5, color: "#ff4500", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, fontWeight: 700 }}>
                  View all <ExternalLink size={9} />
                </a>
              </div>
              {loading && !pulse ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: D.dim }}>
                  <RefreshCw size={18} className="spin" color={D.violet} style={{ display: "block", margin: "0 auto 8px" }} />
                  <div style={{ fontSize: 12 }}>מושך מ-Reddit...</div>
                </div>
              ) : pulse?.sources.reddit.length ? pulse.sources.reddit.map((post: any, i: number) => (
                <a key={post.id} href={post.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "block", textDecoration: "none", color: D.text, padding: "10px 14px",
                    borderTop: i > 0 ? `1px solid ${D.border}` : "none" }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ textAlign: "center", minWidth: 42, flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: post.score > 50 ? D.green : D.dim }}>
                        {post.score > 999 ? `${(post.score/1000).toFixed(1)}k` : post.score}
                      </div>
                      <div style={{ fontSize: 8.5, color: D.faint }}>votes</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.4, marginBottom: 5 }}>{post.title}</div>
                      <div style={{ display: "flex", gap: 8, fontSize: 10, color: D.faint, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ color: "#ff4500", fontWeight: 700 }}>{post.subreddit}</span>
                        <span>·</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><MessageCircle size={9} /> {post.comments}</span>
                        <span>·</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><ThumbsUp size={9} /> {Math.round(post.upvoteRatio * 100)}%</span>
                        <span>· {timeAgo(post.ts)}</span>
                        <span style={{ marginLeft: "auto", padding: "1px 7px", borderRadius: 999,
                          background: sentBg(post.sentiment.label), color: sentColor(post.sentiment.label), fontWeight: 800, fontSize: 9.5 }}>
                          {post.sentiment.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              )) : (
                <div style={{ textAlign: "center", padding: "30px", color: D.faint, fontSize: 12 }}>
                  {pulse ? "אין פוסטים ב-Reddit" : "לחץ Refresh"}
                </div>
              )}
            </PulseCard>
          )}

          {/* Analyst ratings */}
          {activeTab === "analyst" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Analyst ratings from Finviz */}
              <PulseCard>
                <SectionHeader icon={<span style={{ fontSize: 14 }}>📣</span>} title="Analyst Ratings" count={pulse?.sources.analystRatings?.length} />
                {pulse?.sources.analystRatings?.length ? (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                      <thead>
                        <tr>
                          {["Date","Firm","Action"].map(h => (
                            <th key={h} style={{ padding: "6px 14px", textAlign: "left", color: D.dim, fontWeight: 700, fontSize: 10.5, borderBottom: `1px solid ${D.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pulse.sources.analystRatings.map((r: any, i: number) => {
                          const isUp   = /upgrade|buy|outperform|overweight/i.test(r.action);
                          const isDown = /downgrade|sell|underperform|underweight/i.test(r.action);
                          return (
                            <tr key={i} style={{ borderBottom: `1px solid ${D.border}` }}>
                              <td style={{ padding: "8px 14px", color: D.faint }}>{r.date}</td>
                              <td style={{ padding: "8px 14px", fontWeight: 700, color: D.text }}>{r.firm}</td>
                              <td style={{ padding: "8px 14px" }}>
                                <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                                  background: isUp ? D.greenBg : isDown ? D.redBg : D.orangeBg,
                                  color: isUp ? D.green : isDown ? D.red : D.orange }}>
                                  {r.action}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "24px", color: D.faint, fontSize: 12 }}>
                    {loading ? "מושך מ-Finviz..." : "אין נתוני אנליסטים"}
                  </div>
                )}
              </PulseCard>

              {/* Finviz news */}
              <PulseCard>
                <SectionHeader icon={<span style={{ fontSize: 14 }}>📈</span>} title="Finviz News" count={pulse?.sources.finviz.length} />
                {pulse?.sources.finviz.length ? pulse.sources.finviz.map((item: any, i: number) => (
                  <div key={i} style={{ borderTop: i > 0 ? `1px solid ${D.border}` : "none" }}>
                    <NewsItem item={item} />
                  </div>
                )) : (
                  <div style={{ textAlign: "center", padding: "24px", color: D.faint, fontSize: 12 }}>
                    {loading ? "מושך מ-Finviz..." : "אין נתונים"}
                  </div>
                )}
              </PulseCard>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.6); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
