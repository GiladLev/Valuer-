"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Upload, Trash2, Plus, Key, RefreshCw, X, Check,
  BarChart2, Sliders, Activity, Radio, Search, ChevronDown,
  TrendingUp, TrendingDown, Star, Settings, Eye
} from "lucide-react";
import { FONT } from "@/lib/theme";
import PortfolioAnalysis from "./PortfolioAnalysis";
import StockPulse from "./StockPulse";

// ─── Dark theme tokens ────────────────────────────────────────────────────────
const D = {
  bg:       "#0b1120",
  bg2:      "#0f1729",
  card:     "#131d2e",
  card2:    "#1a2540",
  border:   "rgba(255,255,255,0.07)",
  border2:  "rgba(255,255,255,0.12)",
  text:     "#e2e8f4",
  dim:      "#8896b3",
  faint:    "#4a5568",
  green:    "#10e8a4",
  greenBg:  "rgba(16,232,164,0.12)",
  red:      "#ff5c6e",
  redBg:    "rgba(255,92,110,0.12)",
  gold:     "#f5a623",
  goldBg:   "rgba(245,166,35,0.15)",
  violet:   "#7c5cfc",
  violetBg: "rgba(124,92,252,0.15)",
  blue:     "#4a90e2",
  teal:     "#2dd4bf",
};

// Pie slice colors
const PIE_COLORS = ["#7c5cfc","#10e8a4","#4a90e2","#f5a623","#ff5c6e","#2dd4bf","#a78bfa","#fb7185","#34d399","#60a5fa"];

// ─── Types ────────────────────────────────────────────────────────────────────
type Holding = { ticker: string; shares: number; avgPrice: number; livePrice?: number; targetPct?: number };
type Checklist = { buy: Record<string,boolean>; sell: Record<string,boolean> };
type Tab = "holdings" | "analysis" | "allocation" | "rebalance" | "pulse";

// ─── Formatting ───────────────────────────────────────────────────────────────
const f$ = (v: number, d = 2) => "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const f$K = (v: number) => {
  const a = Math.abs(v);
  return (v < 0 ? "-" : "") + (a >= 1e6 ? "$" + (a/1e6).toFixed(2) + "M" : a >= 1e3 ? "$" + (a/1e3).toFixed(1) + "K" : "$" + a.toFixed(2));
};

// ─── SVG Donut Chart ──────────────────────────────────────────────────────────
function polarToCart(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polarToCart(cx, cy, r, start);
  const e = polarToCart(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

function DonutChart({ holdings, totalValue }: { holdings: Holding[]; totalValue: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const cx = 110, cy = 110, ro = 90, ri = 52;
  let startAngle = 0;
  const slices = holdings.map((h, i) => {
    const lp = h.livePrice || h.avgPrice;
    const val = h.shares * lp;
    const pct = totalValue > 0 ? val / totalValue : 0;
    const angle = pct * 360;
    const slice = { ticker: h.ticker, val, pct, start: startAngle, end: startAngle + angle, color: PIE_COLORS[i % PIE_COLORS.length], i };
    startAngle += angle;
    return slice;
  });

  return (
    <div style={{ position: "relative", width: 220, height: 220, flexShrink: 0 }}>
      <svg width={220} height={220} viewBox="0 0 220 220">
        {slices.map((s) => {
          const isHov = hovered === s.i;
          const path1 = arcPath(cx, cy, ro, s.start, s.end);
          const path2 = arcPath(cx, cy, ri, s.end, s.start);
          return (
            <path key={s.ticker}
              d={`${path1} L ${polarToCart(cx, cy, ri, s.end).x} ${polarToCart(cx, cy, ri, s.end).y} ${path2} Z`}
              fill={s.color}
              opacity={hovered === null || isHov ? 1 : 0.45}
              stroke={D.bg} strokeWidth={2}
              style={{ cursor: "pointer", transition: "opacity .15s", transform: isHov ? `scale(1.04)` : "scale(1)", transformOrigin: "110px 110px" }}
              onMouseEnter={() => setHovered(s.i)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
        {/* Center text */}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize={11} fill={D.dim} fontFamily={FONT} fontWeight={600}>
          {hovered !== null ? slices[hovered].ticker : "Total"}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={14} fill={D.text} fontFamily={FONT} fontWeight={800}>
          {hovered !== null ? (slices[hovered].pct * 100).toFixed(1) + "%" : f$K(totalValue)}
        </text>
      </svg>
    </div>
  );
}

// ─── Buy/Sell criteria ────────────────────────────────────────────────────────
const BUY_CRITERIA  = [
  { id: "buy_understand", text: "Circle of Competence — מבינים את העסק" },
  { id: "buy_pricing",    text: "כוח תמחור — שולי רווח יציבים/עולים" },
  { id: "buy_mgmt",       text: "הנהלה — הקצאת הון לטובת בעלי מניות" },
  { id: "buy_value",      text: "תמחור אטרקטיבי לעומת ממוצע היסטורי" },
  { id: "buy_growth",     text: "צמיחה בריאה ללא דלילת מניות" },
];
const SELL_CRITERIA = [
  { id: "sell_dont_understand", text: "לא מצליחים להסביר את המודל העסקי" },
  { id: "sell_valuation",       text: "תמחור בועתי — יקר מהותית" },
  { id: "sell_better_opp",      text: "הזדמנות טובה יותר קיימת בשוק" },
  { id: "sell_thesis_broken",   text: "התזה המקורית נשברה — פגיעה תחרותית" },
  { id: "sell_allocation",      text: "הפוזיציה חורגת מהאלוקציה המאוזנת" },
];

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Portfolio() {
  const [holdings, setHoldings]     = useState<Holding[]>([]);
  const [checklists, setChecklists] = useState<Record<string, Checklist>>({});
  const [tab, setTab]               = useState<Tab>("holdings");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [geminiKey, setGeminiKey]   = useState("");
  const [showKey, setShowKey]       = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusMsg, setStatusMsg]   = useState<{ type: "ok"|"err"|"info"; text: string }|null>(null);
  const [newTicker, setNewTicker]   = useState("");
  const [newShares, setNewShares]   = useState("");
  const [newPrice, setNewPrice]     = useState("");
  const [addOpen, setAddOpen]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const h = localStorage.getItem("valuer_holdings");
      if (h) setHoldings(JSON.parse(h));
      else {
        const demo: Holding[] = [
          { ticker: "AAPL",  shares: 32900, avgPrice: 141.0,  livePrice: 187.9,  targetPct: 25 },
          { ticker: "ZNKL",  shares: 1000,  avgPrice: 4.304,  livePrice: 4.579,  targetPct: 16 },
          { ticker: "OPCE",  shares: 256,   avgPrice: 7.862,  livePrice: 19.960, targetPct: 12 },
          { ticker: "NTML",  shares: 200,   avgPrice: 15.510, livePrice: 15.950, targetPct: 13 },
          { ticker: "RMLI",  shares: 82,    avgPrice: 36.400, livePrice: 37.270, targetPct: 10 },
          { ticker: "POLI",  shares: 400,   avgPrice: 7.524,  livePrice: 12.300, targetPct: 12 },
          { ticker: "SOFW",  shares: 611,   avgPrice: 2752.0, livePrice: 3837.0, targetPct: 12 },
        ];
        setHoldings(demo);
        localStorage.setItem("valuer_holdings", JSON.stringify(demo));
      }
      const c = localStorage.getItem("valuer_checklists");
      if (c) setChecklists(JSON.parse(c));
      const k = localStorage.getItem("valuer_gemini_key");
      if (k) setGeminiKey(k);
    } catch {}
  }, []);

  const save = (h: Holding[]) => { setHoldings(h); localStorage.setItem("valuer_holdings", JSON.stringify(h)); };
  const saveCL = (c: Record<string, Checklist>) => { setChecklists(c); localStorage.setItem("valuer_checklists", JSON.stringify(c)); };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let mktVal = 0, cost = 0, dailyPL = 0;
    holdings.forEach(h => {
      const lp = h.livePrice || h.avgPrice;
      mktVal += h.shares * lp;
      cost   += h.shares * h.avgPrice;
      dailyPL += h.shares * lp * 0.0012; // placeholder daily move
    });
    return { mktVal, cost, openPL: mktVal - cost, openPLPct: cost > 0 ? (mktVal - cost)/cost : 0, dailyPL, dailyPLPct: mktVal > 0 ? dailyPL/mktVal : 0 };
  }, [holdings]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const refreshPrices = async () => {
    setRefreshing(true);
    const updated = [...holdings];
    await Promise.all(updated.map(async (h, i) => {
      try {
        const res = await fetch(`/api/fundamentals?ticker=${h.ticker}`);
        if (res.ok) { const d = await res.json(); if (d.price) updated[i] = { ...h, livePrice: d.price }; }
      } catch {}
    }));
    save(updated);
    setRefreshing(false);
  };

  const uploadFile = async (file: File) => {
    setUploading(true); setStatusMsg(null);
    const fd = new FormData(); fd.append("file", file);
    try {
      const res = await fetch("/api/portfolio/upload", { method: "POST", headers: { "x-gemini-key": geminiKey }, body: fd });
      const json = await res.json();
      if (json.holdings) {
        const parsed: Holding[] = json.holdings.map((h: any) => ({ ticker: h.ticker.toUpperCase(), shares: Number(h.shares), avgPrice: Number(h.avgPrice), livePrice: Number(h.avgPrice), targetPct: 0 }));
        save(parsed);
        refreshPrices();
        setStatusMsg({ type: json.isDemo ? "info" : "ok", text: json.isDemo ? "מצב דמו — הוזן תיק לדוגמה" : "צילום המסך פוענח!" });
      }
    } catch (e: any) { setStatusMsg({ type: "err", text: e.message }); }
    finally { setUploading(false); }
  };

  const addHolding = (e: React.FormEvent) => {
    e.preventDefault();
    const tk = newTicker.trim().toUpperCase();
    const sh = parseFloat(newShares), pr = parseFloat(newPrice);
    if (!tk || isNaN(sh) || isNaN(pr)) return;
    const idx = holdings.findIndex(h => h.ticker === tk);
    const updated = [...holdings];
    if (idx !== -1) updated[idx] = { ...updated[idx], shares: sh, avgPrice: pr };
    else updated.push({ ticker: tk, shares: sh, avgPrice: pr, livePrice: pr, targetPct: 0 });
    save(updated);
    setNewTicker(""); setNewShares(""); setNewPrice(""); setAddOpen(false);
    refreshPrices();
  };

  const toggleCL = (ticker: string, type: "buy"|"sell", id: string) => {
    const cur = checklists[ticker] || { buy: {}, sell: {} };
    saveCL({ ...checklists, [ticker]: { ...cur, [type]: { ...cur[type], [id]: !cur[type][id] } } });
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const tabBtn = (active: boolean) => ({
    padding: "7px 18px", borderRadius: 0, fontSize: 13, fontWeight: 600, cursor: "pointer",
    background: "transparent", fontFamily: FONT, whiteSpace: "nowrap" as const,
    color: active ? "#fff" : D.dim,
    borderBottom: `2px solid ${active ? D.gold : "transparent"}`,
    border: "none", borderBottomWidth: 2, borderBottomStyle: "solid" as const,
    borderBottomColor: active ? D.gold : "transparent",
    transition: "all .15s",
  });

  const inp = {
    padding: "8px 12px", borderRadius: 8, background: D.card2, border: `1px solid ${D.border2}`,
    color: D.text, fontSize: 13, fontFamily: FONT, outline: "none", width: "100%",
  };

  return (
    <div style={{ minHeight: "100vh", background: D.bg, fontFamily: FONT, color: D.text }}>

      {/* ══════════════════════════════════════════
          HEADER — Market value + P/L strip
          ══════════════════════════════════════════ */}
      <div style={{ background: D.bg2, borderBottom: `1px solid ${D.border}`, padding: "14px 24px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>

            {/* Market Value */}
            <div>
              <div style={{ fontSize: 10.5, color: D.dim, fontWeight: 600, marginBottom: 3, letterSpacing: "0.05em" }}>MARKET VALUE</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
                {f$K(stats.mktVal)}
              </div>
            </div>

            <div style={{ width: 1, height: 36, background: D.border }} />

            {/* Open P/L */}
            <div>
              <div style={{ fontSize: 10.5, color: D.dim, fontWeight: 600, marginBottom: 3, letterSpacing: "0.05em" }}>OPEN P/L</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: stats.openPL >= 0 ? D.green : D.red }}>
                {stats.openPL >= 0 ? "+" : ""}{f$K(stats.openPL)}{" "}
                <span style={{ fontSize: 13 }}>/ {stats.openPL >= 0 ? "+" : ""}{(stats.openPLPct * 100).toFixed(2)}%</span>
              </div>
            </div>

            <div style={{ width: 1, height: 36, background: D.border }} />

            {/* Daily P/L */}
            <div>
              <div style={{ fontSize: 10.5, color: D.dim, fontWeight: 600, marginBottom: 3, letterSpacing: "0.05em" }}>DAILY P/L</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: stats.dailyPL >= 0 ? D.green : D.red }}>
                {stats.dailyPL >= 0 ? "+" : ""}{f$K(stats.dailyPL)}{" "}
                <span style={{ fontSize: 13 }}>/ {(stats.dailyPLPct * 100).toFixed(2)}%</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ marginLeft: "auto", display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={() => setAddOpen(v => !v)}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 8,
                  background: D.violetBg, border: `1px solid ${D.violet}44`, color: D.violet,
                  fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                <Plus size={14} /> Add Position
              </button>
              <button onClick={() => fileRef.current?.click()}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 8,
                  background: D.goldBg, border: `1px solid ${D.gold}55`, color: D.gold,
                  fontSize: 12.5, fontWeight: 700, cursor: uploading ? "wait" : "pointer", fontFamily: FONT }}>
                {uploading ? <RefreshCw size={14} className="spin" /> : <Upload size={14} />}
                {uploading ? "מפענח..." : "Advanced Watchlist 📸"}
              </button>
              <input type="file" accept="image/*" ref={fileRef} style={{ display: "none" }} onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />
              <button onClick={refreshPrices} disabled={refreshing}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
                  background: D.card2, border: `1px solid ${D.border2}`, color: D.dim,
                  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
              </button>
              <button onClick={() => setShowKey(v => !v)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
                  background: geminiKey ? D.greenBg : D.card2, border: `1px solid ${geminiKey ? D.green + "44" : D.border2}`,
                  color: geminiKey ? D.green : D.dim, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                <Key size={13} />
              </button>
            </div>
          </div>

          {/* Add position form */}
          {addOpen && (
            <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <form onSubmit={addHolding} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input value={newTicker} onChange={e => setNewTicker(e.target.value.toUpperCase())} placeholder="Ticker (AAPL)" style={{ ...inp, width: 100 }} required />
                <input type="number" step="any" value={newShares} onChange={e => setNewShares(e.target.value)} placeholder="Shares" style={{ ...inp, width: 100 }} required />
                <input type="number" step="any" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="Avg Price" style={{ ...inp, width: 110 }} required />
                <button type="submit" style={{ padding: "8px 18px", borderRadius: 8, background: D.violet, color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>Add</button>
                <button type="button" onClick={() => setAddOpen(false)} style={{ padding: "8px 12px", borderRadius: 8, background: D.card2, color: D.dim, border: `1px solid ${D.border}`, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}><X size={14} /></button>
              </form>
            </div>
          )}

          {/* Gemini key */}
          {showKey && (
            <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
              <input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder="AIzaSy... (Gemini API Key)" style={{ ...inp, maxWidth: 340 }} />
              <button onClick={() => { localStorage.setItem("valuer_gemini_key", geminiKey); setShowKey(false); }}
                style={{ padding: "8px 16px", borderRadius: 8, background: D.violet, color: "#fff", border: "none", fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>שמור</button>
            </div>
          )}

          {/* Status */}
          {statusMsg && (
            <div style={{ marginTop: 10, padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
              background: statusMsg.type === "ok" ? D.greenBg : statusMsg.type === "err" ? D.redBg : D.goldBg,
              color: statusMsg.type === "ok" ? D.green : statusMsg.type === "err" ? D.red : D.gold,
              border: `1px solid ${statusMsg.type === "ok" ? D.green : statusMsg.type === "err" ? D.red : D.gold}33`,
              display: "flex", gap: 8, alignItems: "center" }}>
              {statusMsg.text}
              <button onClick={() => setStatusMsg(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}><X size={12} /></button>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          TAB NAV
          ══════════════════════════════════════════ */}
      <div style={{ background: D.bg2, borderBottom: `1px solid ${D.border}` }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", overflowX: "auto" }}>
          {([
            ["holdings",   <BarChart2 size={13}/>, "Holdings"],
            ["analysis",   <Activity size={13}/>,  "ניתוח תיק"],
            ["allocation", <Eye size={13}/>,        "Allocation"],
            ["rebalance",  <Sliders size={13}/>,    "Rebalance"],
            ["pulse",      <Radio size={13}/>,      "Live Pulse"],
          ] as [Tab, React.ReactNode, string][]).map(([t, icon, label]) => (
            <button key={t} onClick={() => setTab(t)} style={tabBtn(tab === t)}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{icon} {label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          MAIN CONTENT
          ══════════════════════════════════════════ */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 24px 80px" }}>

        {/* ──────── TAB: HOLDINGS ──────── */}
        {tab === "holdings" && (
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "start" }}>

            {/* Left: Allocation pie */}
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, padding: 20, minWidth: 280 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: D.dim, marginBottom: 4, letterSpacing: "0.04em" }}>Asset Allocation</div>
              <div style={{ fontSize: 10.5, color: D.faint, marginBottom: 16 }}>Gross market value by asset</div>

              <DonutChart holdings={holdings} totalValue={stats.mktVal} />

              {/* Legend */}
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 7 }}>
                {holdings.map((h, i) => {
                  const lp = h.livePrice || h.avgPrice;
                  const val = h.shares * lp;
                  const pct = stats.mktVal > 0 ? val / stats.mktVal : 0;
                  return (
                    <div key={h.ticker} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                      onClick={() => setSelectedTicker(selectedTicker === h.ticker ? null : h.ticker)}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: D.text, flex: 1 }}>{h.ticker}</span>
                      <span style={{ fontSize: 11.5, color: D.dim, fontVariantNumeric: "tabular-nums" }}>
                        {(pct * 100).toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Holdings table */}
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, overflow: "hidden" }}>
              {/* Table header */}
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${D.border}`, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ position: "relative" }}>
                  <Search size={13} color={D.faint} style={{ position: "absolute", left: 10, top: 10 }} />
                  <input placeholder="EUR/USD or AAPL" style={{ ...inp, paddingLeft: 30, width: 200, fontSize: 12 }} />
                </div>
                <span style={{ fontSize: 11, color: D.faint }}>or pick below</span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 860 }}>
                  <thead>
                    <tr style={{ background: D.card2 }}>
                      {["Name ↕","Symbol ↕","Type","Amount","Avg Price","Current Price","Market Value","Daily P/L","Net P/L %","Net P/L",""].map((h,i) => (
                        <th key={i} style={{ padding: "9px 12px", fontSize: 10.5, color: D.dim, fontWeight: 700,
                          textAlign: i === 0 ? "left" : "right", borderBottom: `1px solid ${D.border}`,
                          whiteSpace: "nowrap", letterSpacing: "0.03em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.length === 0 ? (
                      <tr><td colSpan={11} style={{ textAlign: "center", padding: "40px", color: D.faint, fontSize: 13 }}>
                        הוסף פוזיציה ראשונה או העלה צילום מסך
                      </td></tr>
                    ) : holdings.map((h, idx) => {
                      const lp = h.livePrice || h.avgPrice;
                      const mkt = h.shares * lp;
                      const netPL = mkt - h.shares * h.avgPrice;
                      const netPLPct = h.avgPrice > 0 ? (lp - h.avgPrice) / h.avgPrice : 0;
                      const dailyPL = mkt * 0.0012; // placeholder
                      const isSelected = selectedTicker === h.ticker;
                      const positive = netPL >= 0;

                      return (
                        <tr key={h.ticker} onClick={() => setSelectedTicker(isSelected ? null : h.ticker)}
                          style={{ cursor: "pointer", background: isSelected ? "rgba(124,92,252,0.08)" : "transparent",
                            borderBottom: `1px solid ${D.border}`, transition: "background .12s" }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "rgba(124,92,252,0.08)" : "transparent"; }}>

                          {/* Name */}
                          <td style={{ padding: "11px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 4, height: 28, borderRadius: 2, background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: D.text }}>{h.ticker} Corp</div>
                                <div style={{ fontSize: 10.5, color: D.faint }}>NASDAQ</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "11px 12px", textAlign: "right", fontWeight: 800, color: "#60a5fa", fontSize: 13 }}>{h.ticker}</td>
                          <td style={{ padding: "11px 12px", textAlign: "right" }}>
                            <span style={{ background: D.violetBg, color: D.violet, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 4 }}>BUY</span>
                          </td>
                          <td style={{ padding: "11px 12px", textAlign: "right", color: D.dim, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                            {h.shares.toLocaleString()}
                          </td>
                          <td style={{ padding: "11px 12px", textAlign: "right", color: D.dim, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                            {f$(h.avgPrice, 3)}
                          </td>
                          <td style={{ padding: "11px 12px", textAlign: "right", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                            {f$(lp, 2)}
                          </td>
                          <td style={{ padding: "11px 12px", textAlign: "right", fontWeight: 700, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                            {f$K(mkt)}
                          </td>
                          {/* Daily P/L */}
                          <td style={{ padding: "11px 12px", textAlign: "right" }}>
                            <div style={{ background: D.greenBg, borderRadius: 6, padding: "3px 8px", display: "inline-block" }}>
                              <span style={{ color: D.green, fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                                +{f$K(dailyPL)}
                              </span>
                            </div>
                          </td>
                          {/* Net P/L % */}
                          <td style={{ padding: "11px 12px", textAlign: "right" }}>
                            <div style={{ background: positive ? D.greenBg : D.redBg, borderRadius: 6, padding: "3px 8px", display: "inline-block" }}>
                              <span style={{ color: positive ? D.green : D.red, fontSize: 12.5, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                                {positive ? "+" : ""}{(netPLPct * 100).toFixed(2)}%
                              </span>
                            </div>
                          </td>
                          {/* Net P/L $ */}
                          <td style={{ padding: "11px 12px", textAlign: "right" }}>
                            <span style={{ color: positive ? D.green : D.red, fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                              {positive ? "+" : "-"}{f$K(Math.abs(netPL))}
                            </span>
                          </td>
                          <td style={{ padding: "11px 12px", textAlign: "right" }}>
                            <button onClick={e => { e.stopPropagation(); save(holdings.filter(x => x.ticker !== h.ticker)); if (selectedTicker === h.ticker) setSelectedTicker(null); }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: D.faint, padding: 4 }}>
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Totals row */}
                  {holdings.length > 0 && (
                    <tfoot>
                      <tr style={{ background: D.card2, borderTop: `2px solid ${D.border2}` }}>
                        <td colSpan={6} style={{ padding: "10px 12px", fontWeight: 800, fontSize: 13, color: D.dim }}>TOTAL</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, fontSize: 14 }}>{f$K(stats.mktVal)}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          <span style={{ color: D.green, fontWeight: 800 }}>+{f$K(stats.dailyPL)}</span>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          <span style={{ color: stats.openPL >= 0 ? D.green : D.red, fontWeight: 800 }}>
                            {stats.openPL >= 0 ? "+" : ""}{(stats.openPLPct * 100).toFixed(2)}%
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          <span style={{ color: stats.openPL >= 0 ? D.green : D.red, fontWeight: 800 }}>
                            {stats.openPL >= 0 ? "+" : "-"}{f$K(Math.abs(stats.openPL))}
                          </span>
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Checklist panel for selected ticker */}
              {selectedTicker && (
                <div style={{ padding: "16px 20px", borderTop: `1px solid ${D.border}`, background: D.bg2 }}>
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: D.green, letterSpacing: "0.06em", marginBottom: 9 }}>✓ BUY CRITERIA — {selectedTicker}</div>
                      {BUY_CRITERIA.map(c => {
                        const checked = checklists[selectedTicker]?.buy?.[c.id] || false;
                        return (
                          <div key={c.id} onClick={() => toggleCL(selectedTicker, "buy", c.id)}
                            style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", cursor: "pointer", borderBottom: `1px solid ${D.border}` }}>
                            <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${checked ? D.green : D.faint}`,
                              background: checked ? D.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {checked && <Check size={10} color={D.bg} strokeWidth={3} />}
                            </div>
                            <span style={{ fontSize: 12, color: checked ? D.text : D.dim, fontWeight: checked ? 700 : 400 }}>{c.text}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: D.red, letterSpacing: "0.06em", marginBottom: 9 }}>⚠ SELL CRITERIA — {selectedTicker}</div>
                      {SELL_CRITERIA.map(c => {
                        const checked = checklists[selectedTicker]?.sell?.[c.id] || false;
                        return (
                          <div key={c.id} onClick={() => toggleCL(selectedTicker, "sell", c.id)}
                            style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", cursor: "pointer", borderBottom: `1px solid ${D.border}` }}>
                            <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${checked ? D.red : D.faint}`,
                              background: checked ? D.red : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {checked && <Check size={10} color="#fff" strokeWidth={3} />}
                            </div>
                            <span style={{ fontSize: 12, color: checked ? D.text : D.dim, fontWeight: checked ? 700 : 400 }}>{c.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ──────── TAB: ANALYSIS ──────── */}
        {tab === "analysis" && (
          <PortfolioAnalysis holdings={holdings} checklists={checklists} totalValue={stats.mktVal} />
        )}

        {/* ──────── TAB: ALLOCATION ──────── */}
        {tab === "allocation" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 18 }}>
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, padding: 22 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Target Allocation</div>
              {holdings.map((h, i) => {
                const lp = h.livePrice || h.avgPrice;
                const cur = stats.mktVal > 0 ? (h.shares * lp) / stats.mktVal * 100 : 0;
                const tgt = h.targetPct ?? 0;
                const over = tgt > 20;
                return (
                  <div key={h.ticker} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                      <span style={{ fontWeight: 800, color: PIE_COLORS[i % PIE_COLORS.length] }}>{h.ticker}</span>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ color: D.dim }}>cur: <b style={{ color: D.text }}>{cur.toFixed(1)}%</b></span>
                        <span style={{ color: D.dim }}>tgt:</span>
                        <input type="number" min={0} max={100} step={0.5} value={tgt}
                          onChange={e => { const u = holdings.map(x => x.ticker === h.ticker ? { ...x, targetPct: Number(e.target.value) } : x); save(u); }}
                          style={{ width: 52, padding: "3px 7px", borderRadius: 6, background: D.card2, border: `1px solid ${over ? D.red+"88" : D.border2}`, color: D.text, fontSize: 12, fontWeight: 700, textAlign: "center", outline: "none" }} />
                        <span style={{ color: D.dim, fontSize: 12 }}>%</span>
                      </div>
                    </div>
                    <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, cur)}%`, background: PIE_COLORS[i % PIE_COLORS.length], borderRadius: 4, opacity: 0.8, transition: "width .3s" }} />
                      {tgt > 0 && <div style={{ position: "absolute", top: 0, left: `${Math.min(100, tgt)}%`, width: 2, height: "100%", background: "#fff", opacity: 0.5 }} />}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, padding: 22 }}>
              <DonutChart holdings={holdings} totalValue={stats.mktVal} />
            </div>
          </div>
        )}

        {/* ──────── TAB: REBALANCE ──────── */}
        {tab === "rebalance" && (
          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "16px 22px", borderBottom: `1px solid ${D.border}` }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Rebalancing Calculator</div>
              <div style={{ fontSize: 12, color: D.dim, marginTop: 3 }}>כמה לקנות/למכור להגיע לאלוקציית יעד</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 680 }}>
                <thead>
                  <tr style={{ background: D.card2 }}>
                    {["Symbol","Current $","Current %","Target %","Target $","Action","Shares","Cost"].map((h,i) =>
                      <th key={i} style={{ padding: "9px 14px", fontSize: 11, color: D.dim, fontWeight: 700, textAlign: i===0?"left":"right", borderBottom: `1px solid ${D.border}` }}>{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {holdings.map(h => {
                    const lp = h.livePrice || h.avgPrice;
                    const cur = h.shares * lp;
                    const curPct = stats.mktVal > 0 ? cur / stats.mktVal : 0;
                    const tgt = (h.targetPct ?? 0) / 100;
                    const tgtVal = stats.mktVal * tgt;
                    const diff = tgtVal - cur;
                    const diffSh = lp > 0 ? diff / lp : 0;
                    const action = diff > 500 ? "BUY" : diff < -500 ? "SELL" : "HOLD";
                    const actionColor = action === "BUY" ? D.green : action === "SELL" ? D.red : D.dim;
                    const actionBg   = action === "BUY" ? D.greenBg : action === "SELL" ? D.redBg : "rgba(255,255,255,0.05)";
                    return (
                      <tr key={h.ticker} style={{ borderBottom: `1px solid ${D.border}` }}>
                        <td style={{ padding: "12px 14px", fontWeight: 800, color: "#60a5fa" }}>{h.ticker}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f$K(cur)}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: curPct > 0.20 ? D.red : D.dim }}>{(curPct*100).toFixed(1)}%{curPct > 0.20 ? " ⚠" : ""}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: D.dim }}>{tgt > 0 ? (tgt*100).toFixed(1)+"%" : "—"}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: D.dim, fontVariantNumeric: "tabular-nums" }}>{tgt > 0 ? f$K(tgtVal) : "—"}</td>
                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          {tgt > 0 ? <span style={{ padding: "3px 10px", borderRadius: 6, background: actionBg, color: actionColor, fontSize: 11.5, fontWeight: 800 }}>{action}</span> : <span style={{ color: D.faint, fontSize: 12 }}>Set target</span>}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: actionColor, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                          {tgt > 0 && Math.abs(diff) > 500 ? `${diffSh > 0 ? "+" : ""}${diffSh.toFixed(2)}` : "—"}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", color: actionColor, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                          {tgt > 0 && Math.abs(diff) > 500 ? `${diff > 0 ? "+" : ""}${f$K(Math.abs(diff))}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ──────── TAB: LIVE PULSE ──────── */}
        {tab === "pulse" && <StockPulse holdings={holdings} />}

      </div>

      {/* Global spin animation for dark theme */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
