// The StockTalks Rejection Scorecard, trimmed to 5 Buffett-style essentials. Each question
// folds in several of the original ten so nothing important is lost — the management,
// momentum and risk angles are merged into the question they belong to. Score each
// 0 (weak) / 1 (partial) / 2 (strong). Buckets scale with the question count (see bucket()).
export type Question = { id: number; title: string; sub: string; redFlag: string; tip: string };

export const QUESTIONS: Question[] = [
  {
    id: 1,
    title: "Do I understand the business and its market?",
    sub: "Can I explain in one paragraph how it makes money and every revenue stream — and is the market it serves large and still relevant in 10 years?",
    redFlag:
      "If you can't articulate how the company earns its revenue, or its market is shrinking, the business isn't understood well enough — move on.",
    tip: "Read Item 1 (Business) and Item 7 (MD&A) of the 10-K for the revenue split by segment and geography; cross-check any TAM claims against independent industry reports.",
  },
  {
    id: 2,
    title: "Does it have a durable competitive advantage?",
    sub: "What stops competitors from copying it? Does it have pricing power — and is that edge actually showing up as improving margins and cash flow?",
    redFlag:
      "If the only edge is being cheaper, that's not a moat. Stalled or shrinking margins suggest the advantage is eroding.",
    tip: "Read 'Risk Factors' (Item 1A). Compare operating and net margins to direct peers and across 3–5 years — a real moat widens margins over time, it doesn't compress them.",
  },
  {
    id: 3,
    title: "Is management high-quality and aligned with shareholders?",
    sub: "Do executives own meaningful stock, allocate capital at attractive ROIC, and avoid chronic dilution or buybacks at silly prices?",
    redFlag:
      "Tiny insider ownership, value-destroying acquisitions, or relentless share issuance all mean management may not be working in your interest.",
    tip: "Proxy (DEF 14A) for insider ownership; cash-flow-from-investing for acquisitions and capex; track diluted share count and stock-based comp vs free cash flow year over year.",
  },
  {
    id: 4,
    title: "Is the balance sheet strong and the business low-risk?",
    sub: "Enough liquidity to survive a downturn without dilutive raises — and is revenue free of dangerous customer concentration or regulatory threats?",
    redFlag:
      "High leverage with near-term maturities and thin cash — or revenue hostage to one customer or regulator — can sink an otherwise good business.",
    tip: "Compare cash + short-term investments to total debt and current liabilities. The SEC requires disclosing any customer >10% of revenue (Item 1); read Item 1A for regulatory risk.",
  },
  {
    id: 5,
    title: "Does today's price offer a margin of safety?",
    sub: "Does the current price reflect business reality, or has the market already priced in every piece of good news?",
    redFlag:
      "A great company at a stretched multiple can still deliver poor stock returns — expectations are already in the price.",
    tip: "Compare current P/E, EV/FCF and EV/EBITDA to the company's own historical average AND sector peers. Don't overpay for growth that may never arrive.",
  },
];

// Max points and verdict thresholds scale with the number of questions (2 pts each).
export const MAX_SCORE = QUESTIONS.length * 2;
const GREEN = Math.round(MAX_SCORE * 0.8); // 80% → worth deeper research
const AMBER = Math.round(MAX_SCORE * 0.5); // 50% → proceed carefully

export const LEGEND = [
  { range: `${GREEN}–${MAX_SCORE}`, label: "Worth deep research", tone: "green" as const },
  { range: `${AMBER}–${GREEN - 1}`, label: "Proceed carefully", tone: "amber" as const },
  { range: `0–${AMBER - 1}`, label: "Reject", tone: "red" as const },
];

export function bucket(total: number) {
  if (total >= GREEN)
    return {
      label: "Worth deeper research",
      tone: "green" as const,
      detail:
        "The fundamentals check out and you've demonstrated real understanding. Move on to deep dive — read filings, build the valuation, watch for price.",
    };
  if (total >= AMBER)
    return {
      label: "Partial knowledge — proceed carefully",
      tone: "amber" as const,
      detail:
        "Some pillars are weak. Identify the questions you scored 0 or 1 on and do the research before committing capital.",
    };
  return {
    label: "Reject — not enough conviction",
    tone: "red" as const,
    detail:
      "Either you don't understand this business well enough yet, or the fundamentals don't support a position. Better opportunities exist.",
  };
}
