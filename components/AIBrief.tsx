"use client";

import { useState, useMemo, type CSSProperties } from "react";
import { Sparkles, Copy, Check, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { T, FONT } from "@/lib/theme";
import { QUESTIONS, bucket, MAX_SCORE } from "@/lib/scorecard";

type Props = {
  ticker: string;
  companyName: string;
  scores: Record<number, number | undefined>;
  total: number;
  model: any;   // the valuation model (assumptions)
  results: any; // the compute() output (price targets, multiples, FCF...)
};

const pct = (v: any, d = 1) => (v == null || isNaN(v) ? "—" : (v * 100).toFixed(d) + "%");
const money = (v: any, d = 0) => (v == null || isNaN(v) ? "—" : "$" + Number(v).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }));
const mult = (v: any) => (v == null || isNaN(v) ? "—" : Number(v).toFixed(1) + "x");
const mm = (v: any) => (v == null || isNaN(v) ? "—" : "$" + Math.round(v).toLocaleString("en-US") + "mm");

const kbd: CSSProperties = {
  fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace", fontSize: 11, fontWeight: 700,
  background: "#fff", border: `1px solid ${T.green}55`, borderRadius: 5, padding: "1px 5px", margin: "0 1px",
};

function buildPrompt({ ticker, companyName, scores, total, model, results }: Props): string {
  const v = bucket(total);
  const weak = QUESTIONS.filter((q) => (scores[q.id] ?? 0) === 0);
  const partial = QUESTIONS.filter((q) => (scores[q.id] ?? 0) === 1);
  const strong = QUESTIONS.filter((q) => (scores[q.id] ?? 0) === 2);

  const list = (qs: typeof QUESTIONS) =>
    qs.length ? qs.map((q) => `   - Q${q.id}: ${q.title}`).join("\n") : "   - (none)";

  const ti = model.targetYearIdx;
  const targetYear = 2025 + ti;
  const ytable = (label: string, arr: number[], fmt: (n: number) => string) =>
    `   ${label}: ${arr.map((n, i) => `${2025 + i}=${fmt(n)}`).join("  ")}`;

  return `You are a senior equity research analyst. I've completed a full quantitative valuation of ${companyName} (ticker: ${ticker}) and a self-assessment scorecard. I need your help turning this into a real investment decision.

CRITICAL INSTRUCTIONS:
1. Use web search aggressively. Pull the latest 10-K, the most recent 10-Q, the latest earnings call transcript, recent management interviews, competitor filings, and credible analyst notes. Today's facts beat my assumptions.
2. Where my data is stale or wrong, say so explicitly and tell me what the current figure is. Cite the source.
3. Do not flatter me. If my assumptions are aggressive, push back with specifics.
4. End with a clear recommendation: BUY / HOLD / PASS, the price level at which your recommendation would change, and the three specific things you'd watch over the next two quarters.

==============================
A. THE COMPANY (as I currently understand it)
==============================
• Ticker: ${ticker}
• Name: ${companyName}
• Current price: ${money(model.price, 2)}
• Market cap: ${mm(model.marketCap)}
• Enterprise value (LTM): ${mm(results.ev)}
• Net debt (LTM): ${mm(results.netDebtLtm)}
• LTM revenue: ${mm(model.ltmRevenue)}
• LTM EBITDA margin: ${pct(model.ltmEbitdaM)}
• Current P/E (LTM): ${mult(results.curPE)}
• Current EV/EBITDA (LTM): ${mult(results.curEvE)}
• Current EV/FCF (LTM): ${mult(results.curEvFcf)}

==============================
B. MY 6-YEAR FORECAST (assumptions)
==============================
${ytable("Revenue growth", model.growth, (n) => pct(n, 0))}
${ytable("Gross margin", model.grossM, (n) => pct(n, 0))}
${ytable("EBITDA margin", model.ebitdaM, (n) => pct(n, 0))}
${ytable("Operating margin", model.opM, (n) => pct(n, 0))}
${ytable("Net margin", model.netM, (n) => pct(n, 0))}
${ytable("Capex (% rev)", model.capexPct, (n) => pct(n, 0))}
${ytable("D&A (% rev)", model.daPct, (n) => pct(n, 0))}
${ytable("Tax rate", model.taxRate, (n) => pct(n, 0))}
${ytable("Share dilution", model.dilution, (n) => pct(n, 1))}

Projected revenue ${targetYear}: ${mm(results.rev[ti])}
Projected EBITDA ${targetYear}: ${mm(results.ebitda[ti])}
Projected FCF ${targetYear}: ${mm(results.fcf[ti])}
Projected EPS ${targetYear}: $${results.eps[ti].toFixed(2)}

==============================
C. MULTIPLES CHOSEN (Bear / Base / Bull)
==============================
• P/E:        Bear ${model.bearPE}x  ·  Base ${model.basePE}x  ·  Bull ${model.bullPE}x  (5Y avg ${model.avgPE}x)
• EV/EBITDA:  Bear ${model.bearEvE}x  ·  Base ${model.baseEvE}x  ·  Bull ${model.bullEvE}x  (5Y avg ${model.avgEvE}x)
• EV/FCF:     Bear ${model.bearEvFcf}x  ·  Base ${model.baseEvFcf}x  ·  Bull ${model.bullEvFcf}x  (5Y avg ${model.avgEvFcf}x)

==============================
D. RESULTING TARGET PRICES (year ${targetYear}, after ${pct(model.mos, 0)} margin of safety)
==============================
• P/E method:        ${money(results.out.pe.after, 2)}    → ${results.out.pe.up >= 0 ? "+" : ""}${pct(results.out.pe.up)} upside  ·  ${pct(results.out.pe.cagr)} CAGR
• EV/EBITDA method:  ${money(results.out.eve.after, 2)}    → ${results.out.eve.up >= 0 ? "+" : ""}${pct(results.out.eve.up)} upside  ·  ${pct(results.out.eve.cagr)} CAGR
• EV/FCF method:     ${money(results.out.fcf.after, 2)}    → ${results.out.fcf.up >= 0 ? "+" : ""}${pct(results.out.fcf.up)} upside  ·  ${pct(results.out.fcf.cagr)} CAGR
• Combined (Buy-below): ${money(results.out.combined.after, 2)}    → ${results.out.combined.up >= 0 ? "+" : ""}${pct(results.out.combined.up)} upside  ·  ${pct(results.out.combined.cagr)} expected CAGR

==============================
E. MY QUALITATIVE SCORECARD (${QUESTIONS.length} questions, 0/1/2 each)
==============================
Total: ${total}/${MAX_SCORE}  →  Verdict: ${v.label}

STRONG (scored 2):
${list(strong)}

PARTIAL (scored 1):
${list(partial)}

WEAK (scored 0):
${list(weak)}

==============================
F. WHAT I NEED FROM YOU
==============================
1. **Sanity-check my data.** Are my current price, market cap, debt, cash, and LTM figures still accurate today? If not, what are the correct numbers and what changed?

2. **Stress-test my assumptions.** For each forecast line (growth, margins, capex, dilution), tell me whether my numbers are aggressive, conservative, or in line — with a specific reference point (management guidance, sell-side consensus, recent quarters, peer comparisons).

3. **Address my weak scorecard items.** For each WEAK and PARTIAL question above, do focused research and give me what I'm missing: business model, moat, management alignment, capital allocation, balance sheet, concentration risk. Be specific — name customers, name competitors, cite filings.

4. **Multiples reasonableness.** Are my Bear/Base/Bull multiples sane vs the company's history AND vs direct peers? Who are the right peers?

5. **The three biggest risks** I'm probably not pricing in.

6. **Final call:**
   - BUY / HOLD / PASS
   - The price at which your call flips
   - 3 things to watch over the next two quarters
   - One thing you'd verify with the 10-K before pulling the trigger

Be direct. I'd rather be told I'm wrong now than learn it from the market later.`;
}

export default function AIBrief(props: Props) {
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [open, setOpen] = useState(false);
  const prompt = useMemo(() => buildPrompt(props), [props]);

  function copy() {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function openInGemini() {
    // Gemini has no native way to prefill a prompt from a link — only the "Gemini URL Prompt"
    // browser extension reads ?q=, and this brief is far longer than any URL could carry. So we
    // open Gemini AND copy the brief to the clipboard in the same click, making it a single
    // Ctrl/Cmd+V away. We open the window first (synchronously, so popup blockers don't fire and
    // the click gesture is preserved), then copy. ?q= stays for anyone who has the extension.
    const url = `https://gemini.google.com/app?q=${encodeURIComponent(prompt)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    navigator.clipboard.writeText(prompt).then(() => {
      setSent(true);
      setTimeout(() => setSent(false), 8000);
    }).catch(() => {});
  }

  return (
    <div style={{
      background: `linear-gradient(135deg, ${T.violetSoft} 0%, #fff 60%)`,
      border: `1px solid ${T.violetBorder}`,
      borderRadius: 18, padding: 22, marginTop: 18, boxShadow: T.shadow,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${T.violet}, ${T.purple})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 14px rgba(124,92,252,0.35)", flexShrink: 0,
        }}>
          <Sparkles size={18} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text, letterSpacing: "-0.02em", marginBottom: 4 }}>
            Get a second opinion from Gemini
          </div>
          <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.55, fontWeight: 500 }}>
            We've packaged every number, assumption, and weak spot from your analysis into a research brief.
            Gemini will pull the latest filings, stress-test your assumptions, and give you a directional call.
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 14 }}>
        <button
          onClick={openInGemini}
          style={{
            background: `linear-gradient(135deg,${T.violet},${T.purple})`,
            color: "#fff", border: "none", borderRadius: 12,
            padding: "11px 18px", fontWeight: 700, fontSize: 14,
            cursor: "pointer", fontFamily: FONT,
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 6px 20px rgba(124,92,252,0.32)",
          }}
        >
          <Sparkles size={16} />
          Open in Gemini
          <ExternalLink size={14} style={{ opacity: 0.85 }} />
        </button>
        <button
          onClick={copy}
          style={{
            background: T.card, color: T.text, border: `1px solid ${T.border}`,
            borderRadius: 12, padding: "11px 18px", fontWeight: 700, fontSize: 14,
            cursor: "pointer", fontFamily: FONT,
            display: "flex", alignItems: "center", gap: 8, boxShadow: T.shadowSm,
          }}
        >
          {copied ? <Check size={16} color={T.green} /> : <Copy size={16} />}
          {copied ? "Copied!" : "Copy prompt"}
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            background: "transparent", color: T.dim, border: "none",
            padding: "11px 4px", fontWeight: 600, fontSize: 13,
            cursor: "pointer", fontFamily: FONT,
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          {open ? "Hide preview" : "Preview the prompt"}
        </button>
      </div>

      {sent && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
          fontSize: 12.5, fontWeight: 600, color: T.green,
          background: T.greenSoft, border: `1px solid ${T.green}33`, borderRadius: 10,
          padding: "10px 13px",
        }}>
          <Check size={15} />
          Prompt copied to your clipboard — paste it into Gemini with <kbd style={kbd}>Ctrl/⌘</kbd>+<kbd style={kbd}>V</kbd>.
        </div>
      )}

      <div style={{
        fontSize: 11.5, color: T.faint, fontWeight: 500,
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
        padding: "9px 13px", lineHeight: 1.5,
      }}>
        <strong style={{ color: T.dim }}>Pro tip:</strong> Gemini can't be pre-filled by a link, so we copy the brief
        to your clipboard when you open it — just <strong style={{ color: T.text }}>paste</strong> it in. Then toggle on{" "}
        <strong style={{ color: T.text }}>Deep Research</strong> and it'll spend 5–10 minutes pulling filings
        and writing a real report instead of a quick reply.
      </div>

      {/* Preview */}
      {open && (
        <pre style={{
          marginTop: 14, background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 12, padding: 16, fontSize: 11.5, lineHeight: 1.6,
          color: T.text, overflowX: "auto", maxHeight: 420, overflowY: "auto",
          fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
          fontVariantNumeric: "tabular-nums", whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {prompt}
        </pre>
      )}
    </div>
  );
}
