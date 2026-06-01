"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ResponsiveContainer, ComposedChart, AreaChart, BarChart,
  Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import { AlertTriangle, Layers, ChevronLeft, ArrowRight } from "lucide-react";
import { T, FONT } from "@/lib/theme";

const YEARS = [2025, 2026, 2027, 2028, 2029, 2030, 2031];

const nfmt = (v: any, d = 0) => v == null || !isFinite(v) ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const money = (v: any, d = 0) => v == null || !isFinite(v) ? "—" : "$" + nfmt(v, d);
const mm = (v: any) => v == null || !isFinite(v) ? "—" : "$" + nfmt(v, 0);
const pct = (v: any, d = 1) => v == null || !isFinite(v) ? "—" : (v * 100).toFixed(d) + "%";
const mult = (v: any) => v == null || !isFinite(v) ? "—" : Number(v).toFixed(1) + "x";

const clampNum = (x: any, fb: number) => (typeof x === "number" && isFinite(x) ? x : fb);
const round1 = (x: number) => Math.round(x * 10) / 10;

function buildInitialModel(d: any) {
  const g = clampNum(d.revenueGrowthRecent, 0.10);
  const decay = (base: number) => { let v = base; return YEARS.map((_, i) => i === 0 ? base : (v = Math.max(0.02, v * 0.92))); };
  const gm = clampNum(d.grossMargin, 0.5), em = clampNum(d.ebitdaMargin, 0.25);
  const om = clampNum(d.operatingMargin, 0.2), nm = clampNum(d.netMargin, 0.15);
  const flat = (x: number) => YEARS.map(() => x);
  const pe = clampNum(d.avgPE5Y, 20), eve = clampNum(d.avgEvEbitda5Y, 14), evf = clampNum(d.avgEvFcf5Y, 22);
  return {
    ticker: d.ticker, companyName: d.companyName, currency: d.currency || "USD",
    price: clampNum(d.price, 0), sharesOut: clampNum(d.sharesOut, 0), marketCap: clampNum(d.marketCap, 0),
    epsLTM: clampNum(d.epsLTM, 0), debt: clampNum(d.totalDebt, 0), cash: clampNum(d.cash, 0),
    securities: clampNum(d.marketableSecurities, 0),
    ltmRevenue: clampNum(d.ltmRevenue, 0), ltmEbitdaM: clampNum(d.ltmEbitdaMargin, em),
    rev2025: clampNum(d.lastFyRevenue, clampNum(d.ltmRevenue, 0)),
    growth: decay(g), grossM: flat(gm), ebitdaM: flat(em), opM: flat(om), netM: flat(nm),
    ydebt: flat(clampNum(d.totalDebt, 0)), ycash: flat(clampNum(d.cash, 0)), ysec: flat(clampNum(d.marketableSecurities, 0)),
    dilution: YEARS.map((_, i) => i === 0 ? 0 : -0.005), shares2025: clampNum(d.sharesOut, 0),
    avgPE: pe, bearPE: round1(pe * 0.72), basePE: round1(pe * 0.95), bullPE: round1(pe * 1.15),
    avgEvE: eve, bearEvE: round1(eve * 0.78), baseEvE: round1(eve * 0.97), bullEvE: round1(eve * 1.18),
    capexPct: flat(clampNum(d.capexPctRevenue, 0.06)),
    daPct: flat(clampNum(d.daPctRevenue, 0.06)),
    taxRate: flat(clampNum(d.effectiveTaxRate, 0.18)),
    avgEvFcf: evf, bearEvFcf: round1(evf * 0.78), baseEvFcf: round1(evf * 0.95), bullEvFcf: round1(evf * 1.2),
    targetYearIdx: 6, mos: 0.30, method: 3,
    bandMethod: d.epsLTM > 0 ? "pe" : (d.lastFyRevenue > 0 ? "eve" : "evf"),
  } as any;
}

function compute(m: any) {
  const n = YEARS.length;
  const safeDiv = (num: number, den: number) => den && isFinite(num) && isFinite(den) ? num / den : NaN;
  const rev: number[] = Array(n), ebitda: number[] = Array(n), np: number[] = Array(n), sh: number[] = Array(n), eps: number[] = Array(n);
  rev[0] = m.rev2025; sh[0] = m.shares2025;
  for (let i = 1; i < n; i++) {
    rev[i] = rev[i - 1] * (1 + (m.growth[i] || 0));
    sh[i] = sh[i - 1] * (1 + (m.dilution[i] || 0));
  }
  for (let i = 0; i < n; i++) {
    ebitda[i] = rev[i] * m.ebitdaM[i];
    np[i] = rev[i] * m.netM[i];
    eps[i] = safeDiv(np[i], sh[i]);
  }
  const capex: number[] = Array(n), da: number[] = Array(n), ebit: number[] = Array(n);
  const taxes: number[] = Array(n), fcf: number[] = Array(n), fcfM: number[] = Array(n);
  for (let i = 0; i < n; i++) {
    capex[i] = rev[i] * m.capexPct[i];
    da[i] = rev[i] * m.daPct[i];
    ebit[i] = ebitda[i] - da[i];
    taxes[i] = ebit[i] * m.taxRate[i];
    fcf[i] = ebitda[i] - capex[i] - taxes[i];
    fcfM[i] = safeDiv(fcf[i], rev[i]);
  }
  const ev = m.marketCap + m.debt - m.cash - m.securities;
  const ltmEbitda = m.ltmRevenue * m.ltmEbitdaM;
  const curPE = safeDiv(m.price, m.epsLTM);
  const curEvE = safeDiv(ev, ltmEbitda);
  const netDebtLtm = m.debt - m.cash - m.securities;
  const curEvFcf = safeDiv(ev, fcf[0]);

  const pe = { bear: Array(n) as number[], base: Array(n) as number[], bull: Array(n) as number[] };
  for (let i = 0; i < n; i++) {
    pe.bear[i] = eps[i] * m.bearPE;
    pe.base[i] = eps[i] * m.basePE;
    pe.bull[i] = eps[i] * m.bullPE;
  }
  const eve = { bear: Array(n) as number[], base: Array(n) as number[], bull: Array(n) as number[] };
  for (let i = 0; i < n; i++) {
    const f = (mu: number) => safeDiv(ebitda[i] * mu - m.ydebt[i] + m.ycash[i] + m.ysec[i], sh[i]);
    eve.bear[i] = f(m.bearEvE);
    eve.base[i] = f(m.baseEvE);
    eve.bull[i] = f(m.bullEvE);
  }
  const evf = { bear: Array(n) as number[], base: Array(n) as number[], bull: Array(n) as number[] };
  for (let i = 0; i < n; i++) {
    const f = (mu: number) => safeDiv(fcf[i] * mu - netDebtLtm, m.sharesOut);
    evf.bear[i] = f(m.bearEvFcf);
    evf.base[i] = f(m.baseEvFcf);
    evf.bull[i] = f(m.bullEvFcf);
  }
  const fcfYield = fcf.map((x) => safeDiv(x, ev));
  const ti = m.targetYearIdx, yearsAhead = ti;
  const baseP_PE = pe.base[ti], baseP_EvE = eve.base[ti];
  const combined = m.method === 1 ? baseP_PE : m.method === 2 ? baseP_EvE : (baseP_PE + baseP_EvE) / 2;
  const buildMethod = (basePrice: number) => {
    if (!isFinite(basePrice) || !isFinite(m.price) || m.price === 0) {
      return { base: NaN, after: NaN, up: NaN, cagr: NaN };
    }
    const after = basePrice * (1 - m.mos);
    return {
      base: basePrice,
      after,
      up: safeDiv(after - m.price, m.price),
      cagr: yearsAhead > 0 ? Math.pow(after / m.price, 1 / yearsAhead) - 1 : NaN,
    };
  };
  const out = { pe: buildMethod(baseP_PE), eve: buildMethod(baseP_EvE), fcf: buildMethod(evf.base[ti]), combined: buildMethod(combined) };
  return { rev, ebitda, np, sh, eps, capex, da, ebit, taxes, fcf, fcfM, fcfYield, ev, ltmEbitda, curPE, curEvE, curEvFcf, netDebtLtm, pe, eve, evf, out, targetYear: YEARS[ti], yearsAhead };
}

const s: any = {
  card: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 20, boxShadow: T.shadow },
  h: { fontFamily: FONT, fontWeight: 700, letterSpacing: "-0.02em" },
  num: { fontFamily: FONT, fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' },
  label: { color: T.dim, fontSize: 12, fontFamily: FONT, fontWeight: 500 },
};

function EditCell({ value, onCommit, kind = "num", w = 78, align = "right" }: any) {
  const fmt = (v: any) => { if (v == null || isNaN(v)) return ""; if (kind === "pct") return String(+(v * 100).toFixed(4)); return String(+(+v).toFixed(4)); };
  const [str, setStr] = useState(fmt(value));
  const ext = useRef(value);
  useEffect(() => { if (value !== ext.current) { ext.current = value; setStr(fmt(value)); } }, [value]);
  const ch = (e: any) => { const raw = e.target.value; setStr(raw); const num = parseFloat(raw.replace(/,/g, "")); if (!isNaN(num)) { const v = kind === "pct" ? num / 100 : num; ext.current = v; onCommit(v); } };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      <input value={str} onChange={ch} inputMode="decimal"
        style={{ width: w, textAlign: align, background: T.violetSoft, border: `1px solid ${T.violetBorder}`, borderRadius: 8, color: T.violetText, padding: "5px 8px", fontSize: 12.5, fontWeight: 600, ...s.num, fontFamily: FONT, outline: "none" }} />
      {kind === "pct" && <span style={{ color: T.faint, fontSize: 11 }}>%</span>}
      {kind === "mult" && <span style={{ color: T.faint, fontSize: 11 }}>x</span>}
    </span>
  );
}
const Calc = ({ children, color = T.text, b = false }: any) => (
  <span style={{ ...s.num, color, fontSize: 12.5, fontWeight: b ? 700 : 500 }}>{children}</span>
);
function Stat({ label, value, sub, color = T.text }: any) {
  return (
    <div style={{ background: T.soft, border: `1px solid ${T.border}`, borderRadius: 14, padding: "13px 15px", flex: 1, minWidth: 120 }}>
      <div style={s.label}>{label}</div>
      <div style={{ ...s.num, color, fontSize: 19, fontWeight: 700, marginTop: 4, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ color: T.faint, fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function SectionTitle({ n, children, hint }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
      <span style={{ ...s.num, color: T.violet, background: T.violetSoft, borderRadius: 8, padding: "3px 8px", fontSize: 12, fontWeight: 700 }}>{n}</span>
      <h2 style={{ ...s.h, color: T.text, fontSize: 18, margin: 0 }}>{children}</h2>
      {hint && <span style={{ color: T.faint, fontSize: 12, marginLeft: "auto", fontWeight: 500 }}>{hint}</span>}
    </div>
  );
}
const Th = ({ children, w }: any) => (
  <th style={{ ...s.num, color: T.faint, fontSize: 11, fontWeight: 600, textAlign: "right", padding: "6px 8px", borderBottom: `1px solid ${T.border}`, width: w }}>{children}</th>
);
const RowLabel = ({ children, edit }: any) => (
  <td style={{ color: edit ? T.text : T.dim, fontSize: 12.5, fontFamily: FONT, fontWeight: edit ? 600 : 500, padding: "5px 12px 5px 4px", whiteSpace: "nowrap", position: "sticky", left: 0, background: T.card }}>{children}</td>
);
const Td = ({ children }: any) => <td style={{ textAlign: "right", padding: "4px 8px" }}>{children}</td>;
function ChartTip({ active, payload, label, fmt }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "9px 13px", boxShadow: T.shadow }}>
      <div style={{ ...s.num, color: T.text, fontSize: 12, marginBottom: 4, fontWeight: 700 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ ...s.num, color: p.color || p.stroke || T.dim, fontSize: 12, fontWeight: 600 }}>
          {p.name}: {fmt ? fmt(p.value) : nfmt(p.value)}
        </div>
      ))}
    </div>
  );
}

export default function Analysis({
  data,
  initialModel,
  onModelChange,
  onBack,
  onContinue,
}: {
  data: any;
  initialModel: any | null;
  onModelChange: (model: any, results: any) => void;
  onBack: () => void;
  onContinue: (info: { ticker: string; companyName: string }) => void;
}) {
  // Resume the prior model if we're navigating back, otherwise build fresh from FMP.
  const [m, setM] = useState<any>(() => initialModel ?? buildInitialModel(data));
  const r = useMemo(() => compute(m), [m]);
  // Surface every change up to App so the Gemini prompt always has the latest.
  useEffect(() => { onModelChange(m, r); }, [m, r, onModelChange]);
  const set = (k: string, v: any) => setM((p: any) => ({ ...p, [k]: v }));
  const setArr = (k: string, i: number, v: any) =>
    setM((p: any) => { const a = [...p[k]]; a[i] = v; return { ...p, [k]: a }; });

  const projData = YEARS.map((y, i) => ({ year: String(y), Revenue: Math.round(r.rev[i]), EBITDA: Math.round(r.ebitda[i]), FCF: Math.round(r.fcf[i]) }));
  const sources: any = { pe: r.pe, eve: r.eve, evf: r.evf };
  const allZero = (arr: number[]) => arr.every((v) => !isFinite(v) || v === 0);
  const chosenBand = sources[m.bandMethod] && !allZero([...sources[m.bandMethod].bear, ...sources[m.bandMethod].base, ...sources[m.bandMethod].bull])
    ? sources[m.bandMethod]
    : Object.values(sources).find((src: any) => !allZero([...src.bear, ...src.base, ...src.bull])) || r.pe;
  const bandData = YEARS.map((y, i) => ({ year: String(y), Bear: +chosenBand.bear[i].toFixed(2), Base: +chosenBand.base[i].toFixed(2), Bull: +chosenBand.bull[i].toFixed(2) }));
  const cmpData = [
    { name: "P/E", Target: +r.out.pe.after.toFixed(2), up: r.out.pe.up },
    { name: "EV/EBITDA", Target: +r.out.eve.after.toFixed(2), up: r.out.eve.up },
    { name: "EV/FCF", Target: +r.out.fcf.after.toFixed(2), up: r.out.fcf.up },
  ];
  const cagrBadge = (c: number) => {
    if (c == null || isNaN(c)) return { t: "—", col: T.faint, bg: T.soft };
    if (c < 0.08) return { t: "Below index", col: T.dim, bg: T.soft2 };
    if (c <= 0.15) return { t: "Beats index", col: T.green, bg: T.greenSoft };
    return { t: "Check assumptions", col: T.peach, bg: T.peachSoft };
  };
  const pill = (active: boolean) => ({
    background: active ? T.violet : T.soft, color: active ? "#fff" : T.dim,
    border: `1px solid ${active ? T.violet : T.border}`, borderRadius: 999, padding: "5px 13px",
    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT, transition: "all .15s",
  });
  const selectStyle: any = { width: "100%", marginTop: 6, background: T.violetSoft, color: T.violetText, border: `1px solid ${T.violetBorder}`, borderRadius: 9, padding: "7px 9px", ...s.num, fontFamily: FONT, fontSize: 13, fontWeight: 600, outline: "none" };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT, color: T.text }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 20px 130px" }}>
        {/* Back + header */}
        <button onClick={onBack} style={{ background: "transparent", border: "none", color: T.dim, fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, marginBottom: 14, padding: 0 }}>
          <ChevronLeft size={16} /> Search a different company
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg,${T.violet},${T.purple})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: T.shadowSm }}>
            <Layers size={17} color="#fff" />
          </div>
          <div style={{ ...s.h, fontSize: 22 }}>{m.ticker}<span style={{ color: T.dim, fontSize: 15, fontWeight: 500, marginLeft: 8 }}>{m.companyName}</span></div>
        </div>
        <div style={{ color: T.violet, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 22, marginLeft: 44 }}>
          STEP 2 — FINANCIAL ANALYSIS
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 18, marginBottom: 18, fontSize: 12, color: T.dim, flexWrap: "wrap", fontWeight: 500 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: T.violetSoft, border: `1px solid ${T.violetBorder}` }} /> You edit (assumptions)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: T.soft, border: `1px solid ${T.border}` }} /> Auto-calculated
          </span>
        </div>

        {/* 01 Basics */}
        <div style={{ ...s.card, marginBottom: 18 }}>
          <SectionTitle n="01" hint="EV = Market Cap + Debt − Cash − Securities">The Basics</SectionTitle>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <Stat label="Share Price" value={money(m.price, 2)} color={T.violet} />
            <Stat label="Market Cap" value={mm(m.marketCap) + "mm"} />
            <Stat label="Enterprise Value" value={mm(r.ev) + "mm"} color={T.green} />
            <Stat label="P/E (LTM)" value={mult(r.curPE)} />
            <Stat label="EV/EBITDA (LTM)" value={mult(r.curEvE)} />
            <Stat label="EV/FCF (LTM)" value={mult(r.curEvFcf)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(185px,1fr))", gap: 11 }}>
            {[
              ["Share Price ($)", "price", "num"], ["Shares Out (mm)", "sharesOut", "num"],
              ["Market Cap ($mm)", "marketCap", "num"], ["EPS — LTM ($)", "epsLTM", "num"],
              ["Total Debt ($mm)", "debt", "num"], ["Cash & Equiv. ($mm)", "cash", "num"],
              ["Marketable Sec. ($mm)", "securities", "num"], ["LTM Revenue ($mm)", "ltmRevenue", "num"],
              ["LTM EBITDA Margin", "ltmEbitdaM", "pct"], ["Last FY Revenue ($mm)", "rev2025", "num"],
            ].map(([lab, key, kind]: any) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.soft, border: `1px solid ${T.border}`, borderRadius: 11, padding: "9px 12px" }}>
                <span style={s.label}>{lab}</span>
                <EditCell value={m[key]} onCommit={(v: any) => set(key, v)} kind={kind} w={kind === "pct" ? 60 : 90} />
              </div>
            ))}
          </div>
        </div>

        {/* 02 Forecast */}
        <div style={{ ...s.card, marginBottom: 18 }}>
          <SectionTitle n="02" hint="violet rows are your assumptions">5-Year Forecast</SectionTitle>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
              <thead><tr><Th w={150}></Th>{YEARS.map((y) => <Th key={y}>{y}</Th>)}<Th>CAGR</Th></tr></thead>
              <tbody>
                <FRow label="Revenue ($mm)" cells={r.rev.map((v: number) => <Calc>{nfmt(v)}</Calc>)} first={<EditCell value={m.rev2025} onCommit={(v: any) => set("rev2025", v)} w={82} />} cagr={<Calc color={T.violet}>{pct(Math.pow(r.rev[6] / r.rev[0], 1 / 6) - 1)}</Calc>} />
                <FRow label="Revenue Growth" edit cells={YEARS.map((_, i) => i === 0 ? <span style={{ color: T.faint, ...s.num, fontSize: 12 }}>base</span> : <EditCell value={m.growth[i]} onCommit={(v: any) => setArr("growth", i, v)} kind="pct" w={50} />)} />
                <FRow label="Gross Margin" edit cells={YEARS.map((_, i) => <EditCell value={m.grossM[i]} onCommit={(v: any) => setArr("grossM", i, v)} kind="pct" w={50} />)} />
                <FRow label="EBITDA Margin" edit cells={YEARS.map((_, i) => <EditCell value={m.ebitdaM[i]} onCommit={(v: any) => setArr("ebitdaM", i, v)} kind="pct" w={50} />)} />
                <FRow label="EBITDA ($mm)" cells={r.ebitda.map((v: number) => <Calc color={T.green}>{nfmt(v)}</Calc>)} />
                <FRow label="Operating Margin" edit cells={YEARS.map((_, i) => <EditCell value={m.opM[i]} onCommit={(v: any) => setArr("opM", i, v)} kind="pct" w={50} />)} />
                <FRow label="Net Margin" edit cells={YEARS.map((_, i) => <EditCell value={m.netM[i]} onCommit={(v: any) => setArr("netM", i, v)} kind="pct" w={50} />)} />
                <FRow label="Net Profit ($mm)" cells={r.np.map((v: number) => <Calc>{nfmt(v)}</Calc>)} />
                <Spacer />
                <FRow label="Total Debt ($mm)" edit cells={YEARS.map((_, i) => <EditCell value={m.ydebt[i]} onCommit={(v: any) => setArr("ydebt", i, v)} w={64} />)} />
                <FRow label="Cash & Equiv. ($mm)" edit cells={YEARS.map((_, i) => <EditCell value={m.ycash[i]} onCommit={(v: any) => setArr("ycash", i, v)} w={64} />)} />
                <FRow label="Marketable Sec. ($mm)" edit cells={YEARS.map((_, i) => <EditCell value={m.ysec[i]} onCommit={(v: any) => setArr("ysec", i, v)} w={64} />)} />
                <FRow label="Share Dilution" edit cells={YEARS.map((_, i) => i === 0 ? <span style={{ color: T.faint, ...s.num, fontSize: 12 }}>base</span> : <EditCell value={m.dilution[i]} onCommit={(v: any) => setArr("dilution", i, v)} kind="pct" w={50} />)} />
                <FRow label="Shares Out (mm)" cells={r.sh.map((v: number) => <Calc>{nfmt(v)}</Calc>)} first={<EditCell value={m.shares2025} onCommit={(v: any) => set("shares2025", v)} w={64} />} />
                <FRow label="EPS ($)" cells={r.eps.map((v: number) => <Calc b>{nfmt(v, 2)}</Calc>)} />
              </tbody>
            </table>
          </div>
          <div style={{ height: 260, marginTop: 18 }}>
            <ResponsiveContainer>
              <ComposedChart data={projData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={T.border} vertical={false} />
                <XAxis dataKey="year" stroke={T.faint} tick={{ fontSize: 11, fontFamily: FONT, fill: T.faint }} />
                <YAxis stroke={T.faint} tick={{ fontSize: 11, fontFamily: FONT, fill: T.faint }} tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                <Tooltip content={<ChartTip fmt={(v: any) => mm(v) + "mm"} />} cursor={{ fill: "rgba(124,92,252,0.05)" }} />
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: FONT }} />
                <Bar dataKey="Revenue" fill={T.blue} radius={[5, 5, 0, 0]} maxBarSize={26} />
                <Bar dataKey="EBITDA" fill={T.green} radius={[5, 5, 0, 0]} maxBarSize={26} />
                <Line dataKey="FCF" stroke={T.violet} strokeWidth={2.5} dot={{ r: 3, fill: T.violet, strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 03 / 04 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(330px,1fr))", gap: 18, marginBottom: 18 }}>
          <ValBox title="P/E Valuation" n="03" current={mult(r.curPE)} avgKey="avgPE"
            rows={[["Bear", "bearPE", r.pe.bear, T.red], ["Base", "basePE", r.pe.base, T.text], ["Bull", "bullPE", r.pe.bull, T.green]]} m={m} set={set} priceFmt={(v: any) => money(v, 0)} />
          <ValBox title="EV/EBITDA Valuation" n="04" current={mult(r.curEvE)} avgKey="avgEvE"
            rows={[["Bear", "bearEvE", r.eve.bear, T.red], ["Base", "baseEvE", r.eve.base, T.text], ["Bull", "bullEvE", r.eve.bull, T.green]]} m={m} set={set} priceFmt={(v: any) => money(v, 0)} />
        </div>

        {/* 05 FCF */}
        <div style={{ ...s.card, marginBottom: 18 }}>
          <SectionTitle n="05" hint="FCF = EBITDA − Capex − Taxes">Free Cash Flow Layer</SectionTitle>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
              <thead><tr><Th w={150}></Th>{YEARS.map((y) => <Th key={y}>{y}</Th>)}<Th>CAGR</Th></tr></thead>
              <tbody>
                <FRow label="EBITDA ($mm)" cells={r.ebitda.map((v: number) => <Calc color={T.green}>{nfmt(v)}</Calc>)} />
                <FRow label="Capex (% rev)" edit cells={YEARS.map((_, i) => <EditCell value={m.capexPct[i]} onCommit={(v: any) => setArr("capexPct", i, v)} kind="pct" w={50} />)} />
                <FRow label="D&A (% rev)" edit cells={YEARS.map((_, i) => <EditCell value={m.daPct[i]} onCommit={(v: any) => setArr("daPct", i, v)} kind="pct" w={50} />)} />
                <FRow label="Tax Rate" edit cells={YEARS.map((_, i) => <EditCell value={m.taxRate[i]} onCommit={(v: any) => setArr("taxRate", i, v)} kind="pct" w={50} />)} />
                <FRow label="Capex ($mm)" cells={r.capex.map((v: number) => <Calc color={T.dim}>{nfmt(v)}</Calc>)} />
                <FRow label="Cash Taxes ($mm)" cells={r.taxes.map((v: number) => <Calc color={T.dim}>{nfmt(v)}</Calc>)} />
                <FRow label="Free Cash Flow ($mm)" cells={r.fcf.map((v: number) => <Calc b color={T.violet}>{nfmt(v)}</Calc>)} cagr={<Calc color={T.violet}>{pct(Math.pow(r.fcf[6] / r.fcf[0], 1 / 6) - 1)}</Calc>} />
                <FRow label="FCF Margin" cells={r.fcfM.map((v: number) => <Calc color={T.dim}>{pct(v)}</Calc>)} />
                <FRow label="FCF Yield (vs EV)" cells={r.fcfYield.map((v: number) => <Calc color={T.dim}>{pct(v)}</Calc>)} />
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 16 }}>
            <ValBox embedded title="EV/FCF Valuation" current={mult(r.curEvFcf)} avgKey="avgEvFcf"
              rows={[["Bear", "bearEvFcf", r.evf.bear, T.red], ["Base", "baseEvFcf", r.evf.base, T.text], ["Bull", "bullEvFcf", r.evf.bull, T.green]]} m={m} set={set} priceFmt={(v: any) => money(v, 0)}
              note="Net Debt (LTM) = Debt − Cash − Securities. Price = (FCF × mult − Net Debt) ÷ Shares." netDebt={r.netDebtLtm} />
          </div>
        </div>

        {/* Price path */}
        <div style={{ ...s.card, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ ...s.h, fontSize: 17, margin: 0 }}>Price Path — Bear / Base / Bull</h2>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {[["pe", "P/E"], ["eve", "EV/EBITDA"], ["evf", "EV/FCF"]].map(([k, lab]) => (
                <button key={k} onClick={() => set("bandMethod", k)} style={pill(m.bandMethod === k)}>{lab}</button>
              ))}
            </div>
          </div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <AreaChart data={bandData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="bandg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.violet} stopOpacity={0.16} />
                    <stop offset="100%" stopColor={T.violet} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={T.border} vertical={false} />
                <XAxis dataKey="year" stroke={T.faint} tick={{ fontSize: 11, fontFamily: FONT, fill: T.faint }} />
                <YAxis stroke={T.faint} tick={{ fontSize: 11, fontFamily: FONT, fill: T.faint }} tickFormatter={(v) => "$" + nfmt(v)} />
                <Tooltip content={<ChartTip fmt={(v: any) => money(v, 0)} />} />
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: FONT }} />
                <ReferenceLine y={m.price} stroke={T.text} strokeDasharray="5 4" label={{ value: "Now " + money(m.price, 0), fill: T.text, fontSize: 11, position: "insideTopRight" }} />
                <Area dataKey="Bull" stroke={T.green} strokeWidth={1.5} fill="url(#bandg)" />
                <Area dataKey="Base" stroke={T.violet} strokeWidth={2.5} fill="none" />
                <Area dataKey="Bear" stroke={T.red} strokeWidth={1.5} fill="#fff" fillOpacity={1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 06 MoS */}
        <div style={{ ...s.card, marginBottom: 18 }}>
          <SectionTitle n="06" hint={`Target year: ${r.targetYear}`}>Margin of Safety & Final Target</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 18 }}>
            <div style={{ background: T.soft, border: `1px solid ${T.border}`, borderRadius: 12, padding: "11px 14px" }}>
              <div style={s.label}>Target Year</div>
              <select value={m.targetYearIdx} onChange={(e) => set("targetYearIdx", +e.target.value)} style={selectStyle}>
                {[1, 2, 3, 4, 5, 6].map((i) => <option key={i} value={i}>{YEARS[i]} ({i}y ahead)</option>)}
              </select>
            </div>
            <div style={{ background: T.soft, border: `1px solid ${T.border}`, borderRadius: 12, padding: "11px 14px" }}>
              <div style={s.label}>Margin of Safety</div>
              <div style={{ marginTop: 7 }}><EditCell value={m.mos} onCommit={(v: any) => set("mos", v)} kind="pct" w={72} align="left" /></div>
            </div>
            <div style={{ background: T.soft, border: `1px solid ${T.border}`, borderRadius: 12, padding: "11px 14px" }}>
              <div style={s.label}>Method</div>
              <select value={m.method} onChange={(e) => set("method", +e.target.value)} style={selectStyle}>
                <option value={1}>P/E only</option><option value={2}>EV/EBITDA only</option><option value={3}>Average (conservative)</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
            <div style={{ flex: 2, minWidth: 260, background: `linear-gradient(135deg,${T.violetSoft},#fff)`, border: `1px solid ${T.violetBorder}`, borderRadius: 16, padding: "20px 22px" }}>
              <div style={s.label}>Buy-below price (combined, after {pct(m.mos, 0)} MoS)</div>
              <div style={{ ...s.num, fontSize: 40, fontWeight: 800, color: T.violet, marginTop: 4, letterSpacing: "-0.03em" }}>{money(r.out.combined.after, 2)}</div>
              <div style={{ color: T.dim, fontSize: 12.5, marginTop: 4, fontWeight: 500 }}>Base target {money(r.out.combined.base, 0)} · current {money(m.price, 2)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 150, background: T.soft, border: `1px solid ${T.border}`, borderRadius: 16, padding: "20px 22px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={s.label}>Potential Upside</div>
              <div style={{ ...s.num, fontSize: 30, fontWeight: 800, color: r.out.combined.up >= 0 ? T.green : T.red, marginTop: 4 }}>{r.out.combined.up >= 0 ? "+" : ""}{pct(r.out.combined.up)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 150, background: T.soft, border: `1px solid ${T.border}`, borderRadius: 16, padding: "20px 22px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={s.label}>Expected CAGR</div>
              <div style={{ ...s.num, fontSize: 30, fontWeight: 800, color: cagrBadge(r.out.combined.cagr).col, marginTop: 4 }}>{pct(r.out.combined.cagr)}</div>
              <span style={{ alignSelf: "flex-start", marginTop: 6, fontSize: 11, fontWeight: 600, color: cagrBadge(r.out.combined.cagr).col, background: cagrBadge(r.out.combined.cagr).bg, borderRadius: 999, padding: "2px 9px" }}>{cagrBadge(r.out.combined.cagr).t}</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
            {[["P/E", r.out.pe], ["EV/EBITDA", r.out.eve], ["EV/FCF", r.out.fcf]].map(([lab, o]: any) => {
              const bb = cagrBadge(o.cagr);
              return (
                <div key={lab} style={{ background: T.soft, border: `1px solid ${T.border}`, borderRadius: 13, padding: "14px 16px" }}>
                  <div style={{ ...s.h, fontSize: 13, color: T.dim }}>{lab}</div>
                  <div style={{ ...s.num, fontSize: 22, fontWeight: 800, color: T.text, marginTop: 5 }}>{money(o.after, 2)}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, ...s.num, fontSize: 12, fontWeight: 600 }}>
                    <span style={{ color: o.up >= 0 ? T.green : T.red }}>{o.up >= 0 ? "+" : ""}{pct(o.up, 0)}</span>
                    <span style={{ color: bb.col }}>{pct(o.cagr, 1)} CAGR</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={cmpData} layout="vertical" margin={{ top: 6, right: 60, left: 10, bottom: 0 }}>
                <CartesianGrid stroke={T.border} horizontal={false} />
                <XAxis type="number" stroke={T.faint} tick={{ fontSize: 11, fontFamily: FONT, fill: T.faint }} tickFormatter={(v) => "$" + nfmt(v)} />
                <YAxis type="category" dataKey="name" stroke={T.faint} tick={{ fontSize: 12, fontFamily: FONT, fill: T.dim }} width={78} />
                <Tooltip content={<ChartTip fmt={(v: any) => money(v, 0)} />} cursor={{ fill: "rgba(124,92,252,0.05)" }} />
                <ReferenceLine x={m.price} stroke={T.text} strokeDasharray="5 4" label={{ value: "Now", fill: T.text, fontSize: 11, position: "top" }} />
                <Bar dataKey="Target" fill={T.violet} radius={[0, 6, 6, 0]} maxBarSize={30} name="Buy-below price" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, color: T.faint, fontSize: 12, lineHeight: 1.6, fontWeight: 500 }}>
          <AlertTriangle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>The model returns a number, not a decision. Bad inputs → bad target. Stay conservative, lean on the Base case, respect the Bear case. Educational use only — not investment advice.</span>
        </div>
      </div>

      {/* Sticky CTA to decision */}
      <div style={{ position: "fixed", bottom: 18, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 50 }}>
        <button
          onClick={() => onContinue({ ticker: m.ticker, companyName: m.companyName })}
          style={{
            pointerEvents: "auto",
            background: `linear-gradient(135deg,${T.violet},${T.purple})`,
            color: "#fff", border: "none", borderRadius: 999, padding: "13px 26px",
            fontWeight: 700, fontSize: 14.5, cursor: "pointer", fontFamily: FONT,
            display: "flex", alignItems: "center", gap: 9,
            boxShadow: "0 10px 36px rgba(124,92,252,0.4)",
          }}
        >
          Continue to decision scorecard <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}

function FRow({ label, cells, edit, first, cagr }: any) {
  return (
    <tr>
      <RowLabel edit={edit}>{label}</RowLabel>
      {cells.map((c: any, i: number) => <Td key={i}>{i === 0 && first ? first : c}</Td>)}
      <Td>{cagr || ""}</Td>
    </tr>
  );
}
function Spacer() { return <tr><td colSpan={9} style={{ height: 9 }} /></tr>; }
function ValBox({ title, n, current, avgKey, rows, m, set, priceFmt, embedded, note, netDebt }: any) {
  return (
    <div style={embedded ? {} : { ...s.card }}>
      {n && <SectionTitle n={n}>{title}</SectionTitle>}
      {embedded && <h3 style={{ ...s.h, fontSize: 15, margin: "0 0 13px", color: T.text }}>{title}</h3>}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ background: T.soft, border: `1px solid ${T.border}`, borderRadius: 11, padding: "7px 13px" }}>
          <span style={s.label}>Current </span><Calc b>{current}</Calc>
        </div>
        <div style={{ background: T.violetSoft, border: `1px solid ${T.violetBorder}`, borderRadius: 11, padding: "7px 13px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={s.label}>5Y Avg</span><EditCell value={m[avgKey]} onCommit={(v: any) => set(avgKey, v)} kind="mult" w={46} />
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 360 }}>
          <thead><tr><Th w={100}>Scenario</Th><Th w={62}>Mult.</Th>{YEARS.slice(1).map((y) => <Th key={y}>{String(y).slice(2)}</Th>)}</tr></thead>
          <tbody>
            {rows.map(([lab, key, prices, col]: any) => (
              <tr key={key}>
                <RowLabel edit><span style={{ color: col }}>{lab}</span></RowLabel>
                <Td><EditCell value={m[key]} onCommit={(v: any) => set(key, v)} kind="mult" w={42} /></Td>
                {prices.slice(1).map((p: number, i: number) => <Td key={i}><Calc color={col === T.text ? T.text : col} b={lab === "Base"}>{priceFmt(p)}</Calc></Td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <div style={{ color: T.faint, fontSize: 11, marginTop: 11, lineHeight: 1.5, fontWeight: 500 }}>{note}{netDebt != null && ` Net Debt (LTM) = ${mm(netDebt)}mm.`}</div>}
    </div>
  );
}
