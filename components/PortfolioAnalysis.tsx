"use client";

import React, { useState, useMemo } from "react";
import {
  AlertTriangle, CheckCircle2, TrendingUp, TrendingDown,
  Activity, ChevronDown, ChevronUp
} from "lucide-react";
import { T, FONT } from "@/lib/theme";

// ─── Types (mirrored from Portfolio.tsx) ─────────────────────────────────────
type Holding = {
  ticker: string;
  shares: number;
  avgPrice: number;
  livePrice?: number;
  targetPct?: number;
};

type Checklist = {
  buy: Record<string, boolean>;
  sell: Record<string, boolean>;
};

const BUY_CRITERIA_IDS = ["buy_understand","buy_pricing","buy_mgmt","buy_value","buy_growth"];
const SELL_CRITERIA_IDS = ["sell_dont_understand","sell_valuation","sell_better_opp","sell_thesis_broken","sell_allocation"];

interface Props {
  holdings: Holding[];
  checklists: Record<string, Checklist>;
  totalValue: number;
}

const fmt$ = (v: number, d = 0) =>
  "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

// ─── Micro bar ───────────────────────────────────────────────────────────────
function MiniBar({ value, max, color, height = 8 }: { value: number; max: number; color: string; height?: number }) {
  return (
    <div style={{ height, background: T.soft2, borderRadius: height, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, max > 0 ? (value / max) * 100 : 0)}%`, background: color, borderRadius: height, transition: "width .4s ease" }} />
    </div>
  );
}

// ─── Conviction Gauge (SVG arc) ──────────────────────────────────────────────
function ConvictionGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? T.green : score >= 50 ? T.peach : T.red;
  const r = 28, stroke = 6, circ = 2 * Math.PI * r;
  const filled = circ * (score / 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={70} height={70} viewBox="0 0 70 70">
        <circle cx={35} cy={35} r={r} fill="none" stroke={T.soft2} strokeWidth={stroke} />
        <circle cx={35} cy={35} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 35 35)" style={{ transition: "stroke-dasharray .5s ease" }} />
        <text x={35} y={39} textAnchor="middle" fontSize={14} fontWeight={800} fill={color} fontFamily={FONT}>
          {score}
        </text>
      </svg>
      <span style={{ fontSize: 11, fontWeight: 700, color: T.dim, textAlign: "center", maxWidth: 70 }}>{label}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PortfolioAnalysis({ holdings, checklists, totalValue }: Props) {
  const [whatIfDropPct, setWhatIfDropPct] = useState(20);
  const [whatIfTicker, setWhatIfTicker] = useState(holdings[0]?.ticker ?? "");
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  // ── Derived per-holding metrics ───────────────────────────────────────────
  const rows = useMemo(() => {
    return holdings.map(h => {
      const lp = h.livePrice || h.avgPrice;
      const value = h.shares * lp;
      const cost = h.shares * h.avgPrice;
      const allocPct = totalValue > 0 ? value / totalValue : 0;
      const returnPct = cost > 0 ? (value - cost) / cost : 0;
      const cl = checklists[h.ticker] || { buy: {}, sell: {} };
      const buyScore  = BUY_CRITERIA_IDS.filter(id => cl.buy?.[id]).length;
      const sellFlags = SELL_CRITERIA_IDS.filter(id => cl.sell?.[id]).length;
      const rawConviction = Math.round((buyScore / BUY_CRITERIA_IDS.length) * 100 - sellFlags * 20);
      const convictionScore = Math.max(0, Math.min(100, rawConviction));
      const verdict =
        sellFlags > 0
          ? { label: "Sell Alert", color: T.red,    bg: T.redSoft   }
          : buyScore === BUY_CRITERIA_IDS.length
          ? { label: "Strong Buy", color: T.green,  bg: T.greenSoft }
          : buyScore >= 3
          ? { label: "Hold+",      color: T.teal,   bg: "#e6f9f7"   }
          : { label: "Hold",       color: T.peach,  bg: T.peachSoft };
      return { ...h, lp, value, cost, allocPct, returnPct, buyScore, sellFlags, convictionScore, verdict };
    });
  }, [holdings, checklists, totalValue]);

  // ── Portfolio-level aggregates ────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!rows.length) return null;
    const weightedReturn  = rows.reduce((s, r) => s + r.returnPct * r.allocPct, 0);
    const totalGain       = rows.reduce((s, r) => s + (r.value - r.cost), 0);
    const totalCost       = rows.reduce((s, r) => s + r.cost, 0);
    const winnerCount     = rows.filter(r => r.returnPct > 0).length;
    const loserCount      = rows.filter(r => r.returnPct < 0).length;
    const strongConviction = rows.filter(r => r.convictionScore >= 80).length;
    const atRisk          = rows.filter(r => r.sellFlags > 0).length;
    const sorted          = [...rows].sort((a, b) => b.returnPct - a.returnPct);
    return { weightedReturn, totalGain, totalCost, winnerCount, loserCount, strongConviction, atRisk, biggestWinner: sorted[0], biggestLoser: sorted[sorted.length - 1] };
  }, [rows]);

  // ── What-if result ────────────────────────────────────────────────────────
  const whatIfResult = useMemo(() => {
    const h = rows.find(r => r.ticker === whatIfTicker);
    if (!h) return null;
    const dropValue       = h.value * (whatIfDropPct / 100);
    const newTotalValue   = totalValue - dropValue;
    const portfolioImpact = totalValue > 0 ? -dropValue / totalValue : 0;
    const newAlloc        = newTotalValue > 0 ? (h.value - dropValue) / newTotalValue : 0;
    const recommendation  =
      whatIfDropPct >= 30 ? `הכפל פוזיציה ב-${h.ticker} אם התזה לא השתנתה` :
      whatIfDropPct >= 20 ? `הוסף 50–100% מהפוזיציה הרגילה ב-${h.ticker}` :
      whatIfDropPct >= 10 ? `הוסף 25% מהפוזיציה ב-${h.ticker}` :
      "טלטלה קצרת-טווח — עקוב בלבד";
    return { h, dropValue, newTotalValue, portfolioImpact, newAlloc, recommendation };
  }, [whatIfTicker, whatIfDropPct, rows, totalValue]);

  const card: any = {
    background: T.card, border: `1px solid ${T.border}`,
    borderRadius: 18, padding: 22, boxShadow: T.shadow,
  };

  if (!holdings.length) {
    return (
      <div style={{ ...card, textAlign: "center", padding: "50px 20px", color: T.dim }}>
        <Activity size={30} color={T.faint} style={{ marginBottom: 10 }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>אין נתונים לניתוח</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>הוסף חברות בלשונית "פוזיציות &amp; סקירה"</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── 1. KPI Strip ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 13 }}>
        {[
          {
            label: "תשואה משוקללת",
            value: `${stats!.weightedReturn >= 0 ? "+" : ""}${(stats!.weightedReturn * 100).toFixed(1)}%`,
            color: stats!.weightedReturn >= 0 ? T.green : T.red,
            sub: "ממוצע לפי גודל פוזיציה",
          },
          {
            label: "רווח / הפסד כולל",
            value: `${stats!.totalGain >= 0 ? "+" : ""}${fmt$(stats!.totalGain)}`,
            color: stats!.totalGain >= 0 ? T.green : T.red,
            sub: `עלות בסיס: ${fmt$(stats!.totalCost)}`,
          },
          {
            label: "מנצחים / מפסידים",
            value: `${stats!.winnerCount} / ${stats!.loserCount}`,
            color: T.text,
            sub: `מתוך ${rows.length} פוזיציות`,
          },
          {
            label: "Conviction גבוה",
            value: String(stats!.strongConviction),
            color: T.violet,
            sub: "ציון ≥80 (אחזקות בטוחות)",
          },
          {
            label: "בסיכון מכירה",
            value: String(stats!.atRisk),
            color: stats!.atRisk > 0 ? T.red : T.green,
            sub: stats!.atRisk > 0 ? "יש אותות מכירה" : "ללא אותות שליליים",
          },
        ].map(({ label, value, color, sub }, i) => (
          <div key={i} style={card}>
            <div style={{ fontSize: 11, color: T.faint, fontWeight: 700, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 10.5, color: T.dim, marginTop: 3 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── 2. Conviction gauges + What-if simulator ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>

        {/* Conviction panel */}
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>ציוני Conviction</div>
          <div style={{ fontSize: 12, color: T.dim, marginBottom: 18 }}>
            כמה קריטריוני רכישה עומדים לכל חברה — נמדד לפי הרשימות שמילאת
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
            {rows.map(r => <ConvictionGauge key={r.ticker} score={r.convictionScore} label={r.ticker} />)}
          </div>

          {/* Best & Worst */}
          {stats && (
            <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: T.greenSoft, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 10.5, color: T.dim, fontWeight: 700, marginBottom: 4 }}>🏆 הכי מרוויח</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.green }}>{stats.biggestWinner.ticker}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.green }}>
                  +{(stats.biggestWinner.returnPct * 100).toFixed(1)}%
                </div>
              </div>
              <div style={{ background: T.redSoft, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 10.5, color: T.dim, fontWeight: 700, marginBottom: 4 }}>📉 הכי מפסיד</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.red }}>{stats.biggestLoser.ticker}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.red }}>
                  {(stats.biggestLoser.returnPct * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* What-if simulator */}
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>🔮 סימולטור "מה אם..."</div>
          <div style={{ fontSize: 12, color: T.dim, marginBottom: 16 }}>
            מה יקרה לתיק אם מניה תרד? מתי לפעול?
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Ticker buttons */}
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: T.dim, marginBottom: 7 }}>בחר מניה</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {holdings.map(h => (
                  <button key={h.ticker} onClick={() => setWhatIfTicker(h.ticker)}
                    style={{ padding: "6px 13px", borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FONT,
                      background: whatIfTicker === h.ticker ? T.violet : T.soft,
                      color: whatIfTicker === h.ticker ? "#fff" : T.dim,
                      border: `1.5px solid ${whatIfTicker === h.ticker ? T.violet : T.border}` }}>
                    {h.ticker}
                  </button>
                ))}
              </div>
            </div>

            {/* Slider */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 700, color: T.dim, marginBottom: 6 }}>
                <span>ירידה במחיר</span>
                <span style={{ color: T.red, fontSize: 18, fontWeight: 800 }}>−{whatIfDropPct}%</span>
              </div>
              <input type="range" min={5} max={60} step={5} value={whatIfDropPct}
                onChange={e => setWhatIfDropPct(Number(e.target.value))}
                style={{ width: "100%", accentColor: T.violet, cursor: "pointer" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.faint, marginTop: 2 }}>
                <span>5%</span><span>30%</span><span>60%</span>
              </div>
            </div>

            {/* Result */}
            {whatIfResult && (
              <div style={{ background: T.soft, borderRadius: 13, padding: "14px 16px", border: `1px solid ${T.border}` }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  {[
                    { label: "ירידה בשווי",      val: `−${fmt$(whatIfResult.dropValue)}`,             color: T.red  },
                    { label: "השפעה על תיק",     val: `${(whatIfResult.portfolioImpact * 100).toFixed(1)}%`, color: T.red  },
                    { label: "שווי תיק אחרי",   val: fmt$(whatIfResult.newTotalValue),               color: T.text },
                    { label: "אחוז חדש בתיק",   val: `${(whatIfResult.newAlloc * 100).toFixed(1)}%`, color: T.text },
                  ].map(({ label, val, color }, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 10.5, color: T.faint, fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{
                  background: whatIfDropPct >= 20 ? T.greenSoft : T.peachSoft,
                  border: `1px solid ${whatIfDropPct >= 20 ? T.green + "44" : T.peach + "44"}`,
                  borderRadius: 10, padding: "10px 12px",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: whatIfDropPct >= 20 ? T.green : T.peach, marginBottom: 3 }}>
                    💡 המלצה:
                  </div>
                  <div style={{ fontSize: 12.5, color: T.text, fontWeight: 600, lineHeight: 1.5 }}>
                    {whatIfResult.recommendation}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Expanded holding table ── */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>ניתוח מעמיק לכל פוזיציה</div>
        <div style={{ fontSize: 12, color: T.dim, marginBottom: 16 }}>לחץ על שורה לפרטים מלאים ותרחישי ירידה</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                {["מניה","שווי","תשואה","% תיק","Conviction","Buy ✓","Sell ⚠","המלצה",""].map((h, i) =>
                  <th key={i} style={{ padding: "9px 10px", fontSize: 11, color: T.faint, fontWeight: 700, textAlign: i === 0 ? "left" : "right" }}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <React.Fragment key={r.ticker}>
                  <tr
                    onClick={() => setExpandedTicker(expandedTicker === r.ticker ? null : r.ticker)}
                    style={{ borderBottom: `1px solid ${T.border}`, cursor: "pointer", transition: "background .12s",
                      background: expandedTicker === r.ticker ? T.violetSoft : "transparent" }}>
                    <td style={{ padding: "12px 10px", fontWeight: 800, color: T.violetText }}>{r.ticker}</td>
                    <td style={{ padding: "12px 10px", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmt$(r.value)}</td>
                    <td style={{ padding: "12px 10px", textAlign: "right", fontWeight: 700, color: r.returnPct >= 0 ? T.green : T.red }}>
                      {r.returnPct >= 0 ? "+" : ""}{(r.returnPct * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: "12px 10px", textAlign: "right" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: r.allocPct > 0.20 ? T.red : T.text }}>
                          {(r.allocPct * 100).toFixed(1)}%{r.allocPct > 0.20 ? " ⚠" : ""}
                        </span>
                        <MiniBar value={r.allocPct * 100} max={30} color={r.allocPct > 0.20 ? T.red : T.violet} height={5} />
                      </div>
                    </td>
                    <td style={{ padding: "12px 10px", textAlign: "right" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 800,
                          color: r.convictionScore >= 80 ? T.green : r.convictionScore >= 50 ? T.peach : T.red }}>
                          {r.convictionScore}
                        </span>
                        <MiniBar value={r.convictionScore} max={100}
                          color={r.convictionScore >= 80 ? T.green : r.convictionScore >= 50 ? T.peach : T.red} height={5} />
                      </div>
                    </td>
                    <td style={{ padding: "12px 10px", textAlign: "right" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.green, background: T.greenSoft, padding: "2px 8px", borderRadius: 999 }}>
                        {r.buyScore}/{BUY_CRITERIA_IDS.length}
                      </span>
                    </td>
                    <td style={{ padding: "12px 10px", textAlign: "right" }}>
                      <span style={{ fontSize: 11, fontWeight: 700,
                        color: r.sellFlags > 0 ? T.red : T.faint,
                        background: r.sellFlags > 0 ? T.redSoft : T.soft,
                        padding: "2px 8px", borderRadius: 999 }}>
                        {r.sellFlags > 0 ? `⚠ ${r.sellFlags}` : "—"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 10px", textAlign: "right" }}>
                      <span style={{ fontSize: 11, fontWeight: 700,
                        color: r.verdict.color, background: r.verdict.bg,
                        padding: "2px 10px", borderRadius: 999 }}>
                        {r.verdict.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 10px", color: T.faint }}>
                      {expandedTicker === r.ticker ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </td>
                  </tr>

                  {/* Expanded row detail */}
                  {expandedTicker === r.ticker && (
                    <tr style={{ background: T.soft }}>
                      <td colSpan={9} style={{ padding: "14px 18px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, direction: "rtl" }}>
                          {/* Financial breakdown */}
                          <div style={{ background: T.card, borderRadius: 12, padding: "12px 14px", border: `1px solid ${T.border}` }}>
                            <div style={{ fontSize: 11, color: T.faint, fontWeight: 700, marginBottom: 8 }}>📊 פירוט כספי</div>
                            {[
                              { label: "מחיר ממוצע",  val: `$${r.avgPrice.toFixed(2)}` },
                              { label: "מחיר שוק",    val: `$${r.lp.toFixed(2)}` },
                              { label: "כמות מניות",  val: String(r.shares) },
                              { label: "עלות כוללת",  val: fmt$(r.cost) },
                              { label: "שווי כיום",   val: fmt$(r.value) },
                              { label: "רווח/הפסד",   val: `${r.value - r.cost >= 0 ? "+" : ""}${fmt$(r.value - r.cost)}` },
                            ].map(({ label, val }, i) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0",
                                borderBottom: i < 5 ? `1px solid ${T.soft2}` : "none" }}>
                                <span style={{ color: T.dim }}>{label}</span>
                                <span style={{ fontWeight: 700 }}>{val}</span>
                              </div>
                            ))}
                          </div>

                          {/* Drop scenarios */}
                          <div style={{ background: T.card, borderRadius: 12, padding: "12px 14px", border: `1px solid ${T.border}` }}>
                            <div style={{ fontSize: 11, color: T.faint, fontWeight: 700, marginBottom: 8 }}>🎯 תרחישי ירידה</div>
                            {[10, 20, 30, 40].map(pct => {
                              const dropV = r.value * (pct / 100);
                              const impact = totalValue > 0 ? dropV / totalValue : 0;
                              return (
                                <div key={pct} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, padding: "4px 0", borderBottom: `1px solid ${T.soft2}` }}>
                                  <span style={{ color: T.dim }}>ירידה {pct}%</span>
                                  <div style={{ textAlign: "right" }}>
                                    <span style={{ fontWeight: 700, color: T.red }}>−{fmt$(dropV)}</span>
                                    <span style={{ color: T.faint, fontSize: 10, marginRight: 5 }}>({(impact * 100).toFixed(1)}% תיק)</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Recommended action */}
                          <div style={{ background: T.card, borderRadius: 12, padding: "12px 14px", border: `1px solid ${T.border}` }}>
                            <div style={{ fontSize: 11, color: T.faint, fontWeight: 700, marginBottom: 8 }}>💡 פעולה מוצעת</div>
                            <div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.6, fontWeight: 500 }}>
                              {r.sellFlags > 0
                                ? "⚠ יש אותות מכירה. בדוק האם התזה המקורית עדיין תקפה לפני כל פעולה."
                                : r.convictionScore >= 80
                                ? "✓ Conviction גבוה. שמור על הפוזיציה ושקול הגדלה בירידות משמעותיות."
                                : r.convictionScore >= 50
                                ? "מלא את שאר קריטריוני הרכישה לפני הגדלת הפוזיציה."
                                : "Conviction נמוך — אל תגדיל עד שתוכל לסמן יותר קריטריונים."
                              }
                            </div>
                            {r.targetPct && r.targetPct > 0 && (
                              <div style={{ marginTop: 10, fontSize: 12, color: T.violet, fontWeight: 700 }}>
                                יעד: {r.targetPct}% | נוכחי: {(r.allocPct * 100).toFixed(1)}%
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4. Buffett Principles ── */}
      <div style={{ ...card, background: `linear-gradient(135deg,${T.violetSoft},#f9f8ff 70%)`, direction: "rtl", border: `1.5px solid ${T.violetBorder}` }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: T.violetText, marginBottom: 12 }}>
          📚 עקרונות ניהול תיק לפי באפט
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          {[
            { icon: "🎯", title: "Circle of Competence",       desc: "השקע רק במה שאתה מבין לעומקך. אם לא תוכל להסביר את המודל העסקי — אל תקנה." },
            { icon: "🏰", title: "Economic Moat",               desc: "חפש חפיר כלכלי: מותג, יתרון לגודל, עלות מעבר גבוהה. בלי מוט — אין משמעות לצמיחה." },
            { icon: "⏳", title: "Time Horizon",                desc: "קנה רק מה שתרצה להחזיק 10 שנים לפחות. טלטלה שנתית היא רעש — לא סיגנל." },
            { icon: "🧮", title: "Margin of Safety",            desc: "קנה בהנחה לשווי הפנימי. שאל: מה המחיר שבו גם אם טעיתי, לא אפסיד?" },
            { icon: "💪", title: "Concentrate on Best Ideas",   desc: "7–10 חברות מעולות עדיפות על 40 ממוצעות. פיזור יתר הוא הגנה מפני בורות." },
            { icon: "📉", title: "Be Greedy When Others Fear",  desc: "ירידות הן מכירה. הוסף בהדרגה בירידות של 10/20/30% — לא מכור בפאניקה." },
          ].map(({ icon, title, desc }, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", border: `1px solid ${T.violetBorder}` }}>
              <div style={{ fontSize: 18, marginBottom: 5 }}>{icon}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.violetText, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 11.5, color: T.dim, lineHeight: 1.6, fontWeight: 500 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
