# Valuer

A three-step stock valuation studio:

1. **Home** — type a ticker, hit Analyze
2. **Analysis** — live financials pulled from Financial Modeling Prep, then a fully editable P/E + EV/EBITDA + EV/FCF valuation across Bear / Base / Bull, with margin of safety
3. **Decision Scorecard** — 10 rejection questions that decide whether the company deserves your money

Built on the StockTalks valuation framework — the multiples model, FCF layer, and 10-question rejection scorecard are translated directly from the original Excel and PDF guide.

---

## Tech stack

- **Next.js 15** (App Router) — server routes hide the API key
- **React 19** + **TypeScript**
- **Recharts** for charts, **lucide-react** for icons
- **Plus Jakarta Sans** for the typography
- Data: **Financial Modeling Prep** (free tier covers US listings)

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

The free tier returns annual statements for US-listed companies and is enough for everything Valuer does.

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
│   │   └── fundamentals/route.ts   # server route — calls FMP, returns JSON
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── App.tsx                     # 3-screen router
│   ├── Home.tsx                    # ticker entry
│   ├── Analysis.tsx                # the valuation model
│   └── Scorecard.tsx               # 10-question decision flow
├── lib/
│   ├── fmp.ts                      # FMP client (server-side)
│   ├── scorecard.ts                # the 10 rejection questions
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

10 questions, each scored 0 (weak) / 1 (partial) / 2 (strong):

- **16–20** → Worth deeper research
- **11–15** → Partial knowledge, proceed carefully
- **0–10** → Reject

The questions cover business understanding, market, moat, management alignment, capital allocation, shareholder value, business momentum, balance sheet, concentration risk, and valuation.

---

## Disclaimer

Educational use only. Not investment advice. The model returns a number, not a decision. Verify the figures against the filings and consult a licensed advisor before committing capital.
# Valuer-
