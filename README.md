# Valuer

A three-step stock valuation studio:

1. **Home** — type a ticker, hit Analyze
2. **Analysis** — financial statements pulled from SEC EDGAR and live price/market cap from Financial Modeling Prep, then a fully editable P/E + EV/EBITDA + EV/FCF valuation across Bear / Base / Bull, with margin of safety
3. **Decision Scorecard** — 5 rejection questions that decide whether the company deserves your money, then a one-click handoff to Gemini Deep Research with every number you generated pre-loaded as a structured analyst brief

Built on the StockTalks valuation framework — the multiples model, FCF layer, and rejection scorecard are translated directly from the original Excel and PDF guide.

---

## Tech stack

- **Next.js 15** (App Router) — server routes hide the API key
- **React 19** + **TypeScript**
- **Recharts** for charts, **lucide-react** for icons
- **Plus Jakarta Sans** for the typography
- Data: **SEC EDGAR** for financial statements (free, official, US filers) + **Financial Modeling Prep** `/profile` for live price & market cap

---

## Local setup

```bash
git clone https://github.com/GiladLev/Valuer-.git
cd Valuer-
npm install
cp .env.example .env.local
# Open .env.local and paste your FMP key
npm run dev
```

Open <http://localhost:3000>.

### Getting an FMP key

1. Sign up at <https://site.financialmodelingprep.com/developer/docs>
2. Copy the API key from your dashboard
3. Paste it into `.env.local`:

```env
FMP_API_KEY=your_key_here
```

FMP's free tier no longer exposes `/quote` or any statement endpoint (they return `402 Payment Required`), so Valuer only uses the still-free `/profile` endpoint for live price and market cap. All financial statements come from **SEC EDGAR**, which is free, needs no key, and covers any US company that files a 10-K. EDGAR asks callers to send a contact email in the `User-Agent`; set your own with `SEC_USER_AGENT="Your Name your@email.com"` in `.env.local` (a default is provided).

---

## Deploy to Vercel

1. Push the repo to GitHub (instructions below).
2. Go to <https://vercel.com/new>, import the `Valuer-` repository.
3. In **Environment Variables**, add `FMP_API_KEY` with your key. Make sure it's enabled for **Production**, **Preview**, and **Development**.
4. Click **Deploy**. That's it.

Re-deploying after a code change is a `git push` away — Vercel rebuilds automatically.

---

## Pushing to GitHub for the first time

From the project root:

```bash
git init
git add .
git commit -m "Valuer — initial commit"
git branch -M main
git remote add origin git@github.com:GiladLev/Valuer-.git
git push -u origin main
```

If `.env.local` exists, it stays untracked (`.gitignore` covers it). **Never commit the API key.**

---

## Project layout

```
valuer/
├── app/
│   ├── api/
│   │   └── fundamentals/route.ts   # server route — calls EDGAR + FMP, returns JSON
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── App.tsx                     # 3-screen router
│   ├── Home.tsx                    # ticker entry
│   ├── Analysis.tsx                # the valuation model
│   ├── Scorecard.tsx               # 5-question decision flow
│   └── AIBrief.tsx                 # Gemini handoff prompt builder
├── lib/
│   ├── fmp.ts                      # FMP /profile client + buildFundamentals orchestrator
│   ├── sec.ts                      # SEC EDGAR companyfacts client (financial statements)
│   ├── scorecard.ts                # the 5 rejection questions
│   └── theme.ts                    # shared design tokens
├── .env.example
└── package.json
```

---

## How the valuation works

**Enterprise Value (LTM)**
`EV = Market Cap + Total Debt − Cash − Marketable Securities`

**P/E target price (per scenario)**
`Price_t = EPS_t × Multiple`

**EV/EBITDA target price (per scenario)**
`Price_t = (EBITDA_t × Multiple − Debt_t + Cash_t + Securities_t) ÷ Shares_t`

**Free Cash Flow**
`FCF = EBITDA − Capex − Taxes` where `Taxes = (EBITDA − D&A) × tax rate`

**EV/FCF target price (per scenario)**
`Price_t = (FCF_t × Multiple − Net Debt_LTM) ÷ Shares_LTM`

**Final buy-below price**
`Buy-below = Base Case × (1 − Margin of Safety)`

The combined case averages P/E and EV/EBITDA by default — switch to either in isolation from the Method dropdown.

---

## How the scorecard works

5 questions, each scored 0 (weak) / 1 (partial) / 2 (strong) — max 10 points:

- **8–10** → Worth deeper research
- **5–7** → Partial knowledge, proceed carefully
- **0–4** → Reject

The five questions distil the original ten: (1) understanding the business and its market, (2) durable competitive advantage and momentum, (3) management quality, alignment and capital allocation, (4) balance-sheet strength and concentration/regulatory risk, and (5) valuation / margin of safety.

---

## The Gemini handoff

After the verdict, Valuer builds a **research brief** containing every assumption you made, every price target, current LTM figures, and every weak/partial scorecard answer. One click opens Gemini in a new tab with the prompt pre-seeded; **Copy prompt** falls back if the deep-link parameter ever changes.

The brief explicitly asks Gemini to:

1. Sanity-check your numbers against the latest filings
2. Stress-test each assumption with concrete reference points
3. Address every WEAK/PARTIAL scorecard item with focused research
4. Validate Bear/Base/Bull multiples against history and peers
5. Surface the three biggest risks you're probably not pricing in
6. Return a BUY / HOLD / PASS call, the price level that flips it, and three quarterly watch items

**Pro tip:** toggle Deep Research on inside Gemini before sending — it'll spend 5–10 minutes pulling real filings instead of a quick reply.

---

## Disclaimer

Educational use only. Not investment advice. The model returns a number, not a decision. Verify the figures against the filings and consult a licensed advisor before committing capital.
