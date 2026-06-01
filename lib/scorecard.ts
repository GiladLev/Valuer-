// The 10 StockTalks Rejection Scorecard questions. Each: 0 (weak) / 1 (partial) / 2 (strong).
// Final score buckets: >=16 deep research, 11-15 partial knowledge, <11 reject.
export type Question = { id: number; title: string; sub: string; redFlag: string; tip: string };

export const QUESTIONS: Question[] = [
  {
    id: 1,
    title: "Do I understand how the business makes money?",
    sub: "Can I explain the business model in one paragraph and identify every revenue stream?",
    redFlag:
      "If you can't articulate clearly how the company generates revenue, the business isn't understood well enough — move on.",
    tip: "Open the annual 10-K. Read Item 1 (Business) and Item 7 (MD&A) for revenue split by segment and geography.",
  },
  {
    id: 2,
    title: "Is the target market large and growing?",
    sub: "Is this industry expanding, and will it still matter in 10 years?",
    redFlag:
      "A great company in a shrinking market is rarely a great investment.",
    tip: "Look at investor presentations for TAM slides; cross-check the numbers against independent industry reports.",
  },
  {
    id: 3,
    title: "Does the company have a competitive advantage?",
    sub: "What makes it different? Why can't competitors copy it easily? Does it have pricing power?",
    redFlag:
      "If the only edge is being cheaper, that's not a real moat — low price alone rarely creates durable economics.",
    tip: "Read 'Risk Factors' in the 10-K (Item 1A). Compare operating margins against direct competitors to see real pricing power.",
  },
  {
    id: 4,
    title: "Is management aligned with shareholders?",
    sub: "Do executives own meaningful stock? Do they win when shareholders win? Is there a track record of value creation?",
    redFlag:
      "Tiny insider ownership creates misaligned incentives — they may not act in your interest.",
    tip: "Read the Proxy Statement (DEF 14A) — look for 'Security Ownership of Certain Beneficial Owners and Management'.",
  },
  {
    id: 5,
    title: "Does management allocate capital well?",
    sub: "Is ROIC attractive? Did past acquisitions create value? Are retained earnings generating returns?",
    redFlag: "Growth without return on invested capital is value destruction.",
    tip: "Cash flow from investing reveals acquisitions and capex. Check whether they translated into sustained operating-income growth in subsequent years.",
  },
  {
    id: 6,
    title: "Does management create or destroy shareholder value?",
    sub: "Is share count rising or falling? Is SBC excessive? Do buybacks happen at sensible prices?",
    redFlag:
      "Chronic dilution is a silent tax — your ownership shrinks year after year.",
    tip: "Track diluted weighted-average shares year over year. Compare stock-based compensation to free cash flow.",
  },
  {
    id: 7,
    title: "Is the business actually improving?",
    sub: "Are revenue, margins, and FCF trending up? Is earnings growth accelerating?",
    redFlag:
      "Stalled growth, margins, and cash flow → there are usually better opportunities elsewhere.",
    tip: "Compare 3–5 years of 10-Ks side by side. Don't just track revenue — verify that operating and net margins expand, not contract.",
  },
  {
    id: 8,
    title: "Is the balance sheet strong enough to survive a downturn?",
    sub: "Enough liquidity, or drowning in debt that becomes painful in a high-rate or recession environment?",
    redFlag:
      "Highly levered + near-term maturities + thin cash → forced dilutive raises or worse.",
    tip: "Compare cash + short-term investments to short-term and long-term debt. Current assets should comfortably cover current liabilities.",
  },
  {
    id: 9,
    title: "Customer concentration or heavy regulatory risk?",
    sub: "Does revenue depend on a few large customers? Does regulation threaten the core business?",
    redFlag:
      "The more revenue tied to one customer, the larger the blow if they leave.",
    tip: "SEC requires disclosure for any customer >10% of revenue — often in Item 1 of the 10-K. Read Item 1A carefully for regulatory risk.",
  },
  {
    id: 10,
    title: "Does today's price offer a margin of safety?",
    sub: "Does the current price reflect business reality, or has the market priced in every piece of good news?",
    redFlag:
      "A great company at a stretched multiple can still deliver poor stock returns — expectations are already in the price.",
    tip: "Compare current P/E, EV/FCF, EV/EBIT vs the company's own historical average AND sector peers. Don't overpay for growth that may never arrive.",
  },
];

export function bucket(total: number) {
  if (total >= 16)
    return {
      label: "Worth deeper research",
      tone: "green" as const,
      detail:
        "The fundamentals check out and you've demonstrated real understanding. Move on to deep dive — read filings, build the valuation, watch for price.",
    };
  if (total >= 11)
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
