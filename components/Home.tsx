"use client";

import { useState } from "react";
import { Search, Loader2, TrendingUp, AlertTriangle, Layers, ArrowRight } from "lucide-react";
import { T, FONT } from "@/lib/theme";

const POPULAR = ["AAPL", "NVDA", "GOOGL", "META", "MSFT", "TSLA", "AMZN", "NFLX"];

export default function Home({ onLoaded }: { onLoaded: (data: any) => void }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(rawTicker?: string) {
    const tk = (rawTicker ?? query).trim().toUpperCase();
    if (!tk) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/fundamentals?ticker=${encodeURIComponent(tk)}`);
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || `Request failed: HTTP ${resp.status}`);
      }
      const d = await resp.json();
      onLoaded(d);
    } catch (e: any) {
      setError(e?.message || "Couldn't reach the data feed");
      setLoading(false);
    }
  }

  const card: any = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 22, padding: 28, boxShadow: T.shadow };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT, color: T.text }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "92px 22px 80px" }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 30, justifyContent: "center" }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg,${T.violet},${T.purple})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: T.shadow }}>
            <Layers size={20} color="#fff" />
          </div>
          <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-0.025em" }}>
            Valuer
          </div>
        </div>

        <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.035em", textAlign: "center", margin: "0 0 12px", lineHeight: 1.1 }}>
          Should you buy this stock?
        </h1>
        <p style={{ color: T.dim, fontSize: 16, textAlign: "center", margin: "0 0 36px", fontWeight: 500, lineHeight: 1.55 }}>
          Enter a ticker. We pull the live financials, run a P/E + EV/EBITDA + FCF valuation,
          then walk you through the 10 questions that decide whether it's worth your money.
        </p>

        {/* Search card */}
        <div style={card}>
          <div style={{ color: T.dim, fontSize: 13, fontWeight: 600, marginBottom: 9 }}>STEP 1 — Enter a company</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
              <Search size={18} color={T.faint} style={{ position: "absolute", left: 16, top: 16 }} />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value.toUpperCase()); setError(null); }}
                onKeyDown={(e) => e.key === "Enter" && go()}
                placeholder="AAPL, NVDA, GOOGL…"
                autoFocus
                disabled={loading}
                style={{
                  width: "100%", boxSizing: "border-box", background: T.soft, border: `1px solid ${T.border}`,
                  borderRadius: 13, color: T.text, padding: "15px 16px 15px 46px", fontSize: 16, fontWeight: 600,
                  fontFamily: FONT, fontVariantNumeric: "tabular-nums", outline: "none", letterSpacing: "0.02em",
                }}
              />
            </div>
            <button
              onClick={() => go()}
              disabled={loading || !query.trim()}
              style={{
                background: loading || !query.trim() ? T.soft2 : `linear-gradient(135deg,${T.violet},${T.purple})`,
                color: loading || !query.trim() ? T.faint : "#fff",
                border: "none", borderRadius: 13, padding: "0 26px", fontWeight: 700, fontSize: 15,
                cursor: loading || !query.trim() ? "not-allowed" : "pointer",
                fontFamily: FONT, display: "flex", alignItems: "center", gap: 9, boxShadow: T.shadowSm,
              }}
            >
              {loading ? <Loader2 size={17} className="spin" /> : <TrendingUp size={17} />}
              {loading ? "Loading…" : "Analyze"}
            </button>
          </div>

          {error && (
            <div style={{ marginTop: 14, display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 14px", background: T.peachSoft, border: `1px solid ${T.border}`, borderRadius: 11, color: T.peach, fontSize: 13, fontWeight: 500 }}>
              <AlertTriangle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>{error}. The FMP free tier covers US listings — check the ticker spelling or try again.</span>
            </div>
          )}

          {/* Popular tickers */}
          <div style={{ marginTop: 20 }}>
            <div style={{ color: T.faint, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", marginBottom: 9 }}>OR PICK ONE</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {POPULAR.map((t) => (
                <button
                  key={t}
                  onClick={() => { setQuery(t); go(t); }}
                  disabled={loading}
                  style={{
                    background: T.soft, color: T.text, border: `1px solid ${T.border}`,
                    borderRadius: 999, padding: "6px 13px", fontSize: 12.5, fontWeight: 600,
                    cursor: loading ? "wait" : "pointer", fontFamily: FONT, fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Flow */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginTop: 22 }}>
          {[
            ["01", "Live Financials", "Income, balance, cash flow — pulled from Financial Modeling Prep."],
            ["02", "Valuation Model", "P/E, EV/EBITDA, and EV/FCF across Bear / Base / Bull scenarios."],
            ["03", "The Decision", "10 rejection questions that decide if you have enough conviction."],
          ].map(([n, lab, desc]) => (
            <div key={n} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "13px 15px", boxShadow: T.shadowSm }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ color: T.violet, background: T.violetSoft, borderRadius: 7, padding: "2px 7px", fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{n}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{lab}</span>
              </div>
              <div style={{ color: T.dim, fontSize: 12.5, lineHeight: 1.5, fontWeight: 500 }}>{desc}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, textAlign: "center", color: T.faint, fontSize: 11.5, fontWeight: 500, lineHeight: 1.55 }}>
          Educational use only — not investment advice.
          <br />
          Methodology adapted from the StockTalks valuation framework.
        </div>
      </div>
    </div>
  );
}
