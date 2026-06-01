"use client";

import { useState, useMemo } from "react";
import { CheckCircle2, AlertTriangle, XCircle, ChevronLeft, ChevronRight, Info, ArrowRight } from "lucide-react";
import { T, FONT } from "@/lib/theme";
import { QUESTIONS, bucket } from "@/lib/scorecard";
import AIBrief from "./AIBrief";

export default function Scorecard({
  ticker,
  companyName,
  model,
  results,
  onBack,
}: {
  ticker: string;
  companyName: string;
  model: any;
  results: any;
  onBack: () => void;
}) {
  const [scores, setScores] = useState<Record<number, number | undefined>>({});
  const [showResult, setShowResult] = useState(false);

  const total = useMemo(
    () => QUESTIONS.reduce((sum, q) => sum + (scores[q.id] ?? 0), 0),
    [scores]
  );
  const answered = QUESTIONS.filter((q) => scores[q.id] !== undefined).length;
  const allAnswered = answered === QUESTIONS.length;
  const verdict = bucket(total);

  function setScore(id: number, val: number) {
    setScores((p) => ({ ...p, [id]: val }));
  }

  const card: any = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 22, boxShadow: T.shadow };
  const SCORE_OPTS: { v: number; label: string; col: string; bg: string }[] = [
    { v: 0, label: "Weak", col: T.red, bg: T.redSoft },
    { v: 1, label: "Partial", col: T.peach, bg: T.peachSoft },
    { v: 2, label: "Strong", col: T.green, bg: T.greenSoft },
  ];

  // RESULT VIEW
  if (showResult && allAnswered) {
    const toneCol = verdict.tone === "green" ? T.green : verdict.tone === "amber" ? T.peach : T.red;
    const toneBg = verdict.tone === "green" ? T.greenSoft : verdict.tone === "amber" ? T.peachSoft : T.redSoft;
    const toneIcon = verdict.tone === "green" ? CheckCircle2 : verdict.tone === "amber" ? AlertTriangle : XCircle;
    const Icon = toneIcon;

    const weak = QUESTIONS.filter((q) => (scores[q.id] ?? 0) === 0);
    const partial = QUESTIONS.filter((q) => (scores[q.id] ?? 0) === 1);

    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT, color: T.text }}>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 22px 80px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
            <button onClick={() => setShowResult(false)} style={{ background: "transparent", border: "none", color: T.dim, fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <ChevronLeft size={16} /> Back to questions
            </button>
          </div>

          {/* Verdict hero */}
          <div style={{ ...card, padding: 30, background: `linear-gradient(135deg,${toneBg},#fff 60%)`, borderColor: toneCol + "33" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: toneCol, marginBottom: 14 }}>
              <Icon size={28} strokeWidth={2.2} />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>FINAL VERDICT — {ticker}</span>
            </div>
            <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.03em", color: T.text, lineHeight: 1.1, marginBottom: 10 }}>
              {verdict.label}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: toneCol, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.04em" }}>
                {total}
              </div>
              <div style={{ color: T.dim, fontSize: 16, fontWeight: 600 }}>/ 20 points</div>
            </div>
            <div style={{ color: T.dim, fontSize: 14, lineHeight: 1.6, fontWeight: 500, maxWidth: 620 }}>
              {verdict.detail}
            </div>
          </div>

          {/* Buckets */}
          <div style={{ ...card, marginTop: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.dim, letterSpacing: "0.05em", margin: "0 0 14px" }}>SCORE LEGEND</h3>
            {[
              ["16–20", "Worth deep research", T.green, T.greenSoft],
              ["11–15", "Proceed carefully", T.peach, T.peachSoft],
              ["0–10", "Reject", T.red, T.redSoft],
            ].map(([range, lab, c, bg]) => {
              const active =
                (verdict.tone === "green" && range === "16–20") ||
                (verdict.tone === "amber" && range === "11–15") ||
                (verdict.tone === "red" && range === "0–10");
              return (
                <div key={range as string} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 13px", marginBottom: 6, background: active ? (bg as string) : "transparent", border: `1px solid ${active ? c + "44" : T.border}`, borderRadius: 11 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c as string, fontVariantNumeric: "tabular-nums", minWidth: 60 }}>{range as string}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>{lab as string}</div>
                </div>
              );
            })}
          </div>

          {/* Weak areas */}
          {(weak.length > 0 || partial.length > 0) && (
            <div style={{ ...card, marginTop: 18 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: "0 0 14px" }}>
                Where to focus your next research
              </h3>
              {weak.map((q) => (
                <WeakItem key={q.id} q={q} tone="red" />
              ))}
              {partial.map((q) => (
                <WeakItem key={q.id} q={q} tone="amber" />
              ))}
            </div>
          )}

          {/* AI research brief — sends everything to Gemini for a second opinion */}
          {model && results && (
            <AIBrief
              ticker={ticker}
              companyName={companyName}
              scores={scores}
              total={total}
              model={model}
              results={results}
            />
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onBack} style={btnSecondary}>
              <ChevronLeft size={15} /> Back to valuation
            </button>
            <button onClick={() => { setScores({}); setShowResult(false); }} style={btnPrimary}>
              Retake the scorecard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // QUESTIONS VIEW
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT, color: T.text }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "32px 22px 60px" }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", color: T.dim, fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, marginBottom: 14, padding: 0 }}>
          <ChevronLeft size={16} /> Back to valuation
        </button>

        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: T.violet, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6 }}>
            STEP 3 — DECISION SCORECARD
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 8px", lineHeight: 1.15 }}>
            Should you buy {companyName || ticker}?
          </h1>
          <p style={{ color: T.dim, fontSize: 14.5, margin: 0, fontWeight: 500, lineHeight: 1.55 }}>
            Ten questions that decide if you've earned the right to own this business.
            Score each: <strong style={{ color: T.red }}>0 weak</strong>,{" "}
            <strong style={{ color: T.peach }}>1 partial</strong>,{" "}
            <strong style={{ color: T.green }}>2 strong</strong>. Be honest — lying to yourself here costs real money.
          </p>
        </div>

        {/* Progress */}
        <div style={{ ...card, marginBottom: 18, padding: "14px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: T.dim }}>
              {answered} of {QUESTIONS.length} answered
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 14, fontWeight: 700, color: T.violet }}>
              {total} <span style={{ color: T.faint, fontWeight: 500 }}>/ 20</span>
            </span>
          </div>
          <div style={{ height: 7, background: T.soft2, borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(answered / QUESTIONS.length) * 100}%`, background: `linear-gradient(90deg,${T.violet},${T.purple})`, transition: "width .25s", borderRadius: 999 }} />
          </div>
        </div>

        {/* Questions */}
        {QUESTIONS.map((q) => {
          const score = scores[q.id];
          return (
            <div key={q.id} style={{ ...card, marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
                <div style={{ minWidth: 36, height: 36, borderRadius: 10, background: score !== undefined ? T.violet : T.soft2, color: score !== undefined ? "#fff" : T.dim, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
                  {String(q.id).padStart(2, "0")}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.text, lineHeight: 1.35, marginBottom: 4 }}>
                    {q.title}
                  </div>
                  <div style={{ color: T.dim, fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}>{q.sub}</div>
                </div>
              </div>

              {/* Score buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
                {SCORE_OPTS.map((opt) => {
                  const active = score === opt.v;
                  return (
                    <button
                      key={opt.v}
                      onClick={() => setScore(q.id, opt.v)}
                      style={{
                        background: active ? opt.bg : T.soft,
                        color: active ? opt.col : T.dim,
                        border: `1.5px solid ${active ? opt.col : T.border}`,
                        borderRadius: 11, padding: "9px 10px", fontSize: 13, fontWeight: 700,
                        cursor: "pointer", fontFamily: FONT, fontVariantNumeric: "tabular-nums",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "all .15s",
                      }}
                    >
                      <span style={{ fontSize: 15 }}>{opt.v}</span>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tip / red flag — only after they answer */}
              {score !== undefined && (
                <div style={{ background: T.soft, border: `1px solid ${T.border}`, borderRadius: 11, padding: "11px 13px", display: "flex", gap: 9 }}>
                  <Info size={15} color={T.violet} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ fontSize: 12.5, lineHeight: 1.6, color: T.dim, fontWeight: 500 }}>
                    {score === 0 ? (
                      <><strong style={{ color: T.red }}>Red flag:</strong> {q.redFlag} <span style={{ display: "block", marginTop: 4, color: T.dim }}><strong style={{ color: T.text }}>Where to look:</strong> {q.tip}</span></>
                    ) : (
                      <><strong style={{ color: T.text }}>Research tip:</strong> {q.tip}</>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* CTA */}
        <div style={{ position: "sticky", bottom: 14, marginTop: 22, display: "flex", justifyContent: "center" }}>
          <button
            onClick={() => setShowResult(true)}
            disabled={!allAnswered}
            style={{
              background: allAnswered ? `linear-gradient(135deg,${T.violet},${T.purple})` : T.soft2,
              color: allAnswered ? "#fff" : T.faint,
              border: "none", borderRadius: 14, padding: "15px 30px", fontWeight: 700, fontSize: 15,
              cursor: allAnswered ? "pointer" : "not-allowed", fontFamily: FONT,
              display: "flex", alignItems: "center", gap: 9,
              boxShadow: allAnswered ? "0 8px 30px rgba(124,92,252,0.35)" : "none",
            }}
          >
            {allAnswered ? "See my verdict" : `Answer ${QUESTIONS.length - answered} more question${QUESTIONS.length - answered === 1 ? "" : "s"}`}
            {allAnswered && <ArrowRight size={17} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function WeakItem({ q, tone }: { q: any; tone: "red" | "amber" }) {
  const col = tone === "red" ? T.red : T.peach;
  const bg = tone === "red" ? T.redSoft : T.peachSoft;
  const lab = tone === "red" ? "WEAK" : "PARTIAL";
  return (
    <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 0", display: "flex", gap: 12 }}>
      <div style={{ minWidth: 56 }}>
        <span style={{ background: bg, color: col, borderRadius: 999, padding: "2px 9px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em" }}>{lab}</span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, marginBottom: 4 }}>{q.title}</div>
        <div style={{ color: T.dim, fontSize: 12.5, lineHeight: 1.55, fontWeight: 500 }}>{q.tip}</div>
      </div>
    </div>
  );
}

const btnPrimary: any = {
  background: `linear-gradient(135deg,${T.violet},${T.purple})`,
  color: "#fff", border: "none", borderRadius: 12, padding: "11px 20px",
  fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT,
};
const btnSecondary: any = {
  background: T.card, color: T.text, border: `1px solid ${T.border}`,
  borderRadius: 12, padding: "11px 20px", fontWeight: 700, fontSize: 14,
  cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 6,
  boxShadow: T.shadowSm,
};
