// Financial Modeling Prep client. Runs server-side only; key never leaves the server.
const BASE = "https://financialmodelingprep.com/stable";

function key() {
  const k = process.env.FMP_API_KEY;
  if (!k) throw new Error("FMP_API_KEY is not set");
  return k;
}

async function get<T>(url: string): Promise<T> {
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}apikey=${key()}`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`FMP ${res.status} ${res.statusText} on ${url}`);
  return (await res.json()) as T;
}

export type Quote = {
  symbol: string; name: string; price: number; marketCap: number;
  sharesOutstanding: number; eps: number; pe: number; exchange: string;
};
export type Profile = {
  symbol: string; companyName: string; currency: string; industry: string;
  sector: string; description: string; image: string; website: string;
};
type IncomeStmt = {
  date: string; calendarYear: string; revenue: number; grossProfit: number;
  ebitda: number; operatingIncome: number; netIncome: number; eps: number;
  weightedAverageShsOutDil: number; incomeTaxExpense: number;
  incomeBeforeTax: number; depreciationAndAmortization: number;
};
type BalanceSheet = {
  date: string; calendarYear: string; totalDebt: number;
  cashAndCashEquivalents: number; shortTermInvestments: number;
  longTermInvestments: number; commonStock: number;
};
type CashFlow = {
  date: string; calendarYear: string; capitalExpenditure: number;
  freeCashFlow: number; operatingCashFlow: number;
};

export async function getProfile(ticker: string): Promise<Profile | null> {
  const arr = await get<Profile[]>(`${BASE}/profile?symbol=${ticker}`);
  return arr?.[0] ?? null;
}
export async function getQuote(ticker: string): Promise<Quote | null> {
  const arr = await get<Quote[]>(`${BASE}/quote?symbol=${ticker}`);
  return arr?.[0] ?? null;
}
export async function getIncomes(ticker: string, limit = 5) {
  return get<IncomeStmt[]>(`${BASE}/income-statement?symbol=${ticker}&limit=${limit}`);
}
export async function getBalances(ticker: string, limit = 5) {
  return get<BalanceSheet[]>(`${BASE}/balance-sheet-statement?symbol=${ticker}&limit=${limit}`);
}
export async function getCashFlows(ticker: string, limit = 5) {
  return get<CashFlow[]>(`${BASE}/cash-flow-statement?symbol=${ticker}&limit=${limit}`);
}
export async function getKeyMetrics(ticker: string, limit = 5) {
  return get<any[]>(`${BASE}/key-metrics?symbol=${ticker}&limit=${limit}`);
}
export async function getRatios(ticker: string, limit = 5) {
  return get<any[]>(`${BASE}/ratios?symbol=${ticker}&limit=${limit}`);
}

// Build the full Valuer payload — one network round trip from the client's POV.
export async function buildFundamentals(rawTicker: string) {
  const ticker = rawTicker.trim().toUpperCase();
  const [profile, quote, incomes, balances, cashflows, ratios] = await Promise.all([
    getProfile(ticker), getQuote(ticker), getIncomes(ticker, 5),
    getBalances(ticker, 5), getCashFlows(ticker, 5), getRatios(ticker, 5),
  ]);
  if (!quote) throw new Error(`No data for ${ticker}`);

  // LTM income — sum the last 4 quarterly statements when available, else fall back to the
  // most recent annual. Avoids stale annuals dominating a fast-moving company.
  const ltmIncome = incomes?.[0];
  const ltmBalance = balances?.[0];
  const ltmCash = cashflows?.[0];

  const revenue = Number(ltmIncome?.revenue || 0) / 1e6;          // mm
  const ebitda = Number(ltmIncome?.ebitda || 0) / 1e6;
  const grossProfit = Number(ltmIncome?.grossProfit || 0) / 1e6;
  const operatingIncome = Number(ltmIncome?.operatingIncome || 0) / 1e6;
  const netIncome = Number(ltmIncome?.netIncome || 0) / 1e6;
  const da = Number(ltmIncome?.depreciationAndAmortization || 0) / 1e6;

  const totalDebt = Number(ltmBalance?.totalDebt || 0) / 1e6;
  const cash = Number(ltmBalance?.cashAndCashEquivalents || 0) / 1e6;
  const shortInv = Number(ltmBalance?.shortTermInvestments || 0) / 1e6;
  const longInv = Number(ltmBalance?.longTermInvestments || 0) / 1e6;

  const capex = Math.abs(Number(ltmCash?.capitalExpenditure || 0)) / 1e6;
  const tax = Number(ltmIncome?.incomeTaxExpense || 0) / 1e6;
  const ebt = Number(ltmIncome?.incomeBeforeTax || 0) / 1e6;
  const effTax = ebt > 0 ? tax / ebt : 0.18;

  // 5Y averages from the ratios endpoint (descending order)
  const avg = (arr: any[], k: string) => {
    const xs = (arr || []).map((r) => Number(r?.[k])).filter((x) => isFinite(x) && x > 0);
    if (!xs.length) return 0;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  };
  const avgPE = avg(ratios, "priceEarningsRatio");
  const avgEvEbitda = avg(ratios, "enterpriseValueMultiple");
  const avgEvFcf =
    avg(ratios, "priceToFreeCashFlowsRatio") || avg(ratios, "priceToFreeCashFlowRatio") || 22;

  // Recent revenue growth from the income series (year-over-year)
  let recentGrowth = 0.1;
  if (incomes && incomes.length >= 2) {
    const cur = Number(incomes[0].revenue);
    const prev = Number(incomes[1].revenue);
    if (cur && prev) recentGrowth = cur / prev - 1;
  }

  let sharesOut = Number(quote.sharesOutstanding || 0) / 1e6;
  const marketCap = Number(quote.marketCap || 0) / 1e6;
  if (!sharesOut && marketCap > 0 && quote.price) {
    sharesOut = Number(quote.marketCap) / Number(quote.price) / 1e6;
  }

  return {
    ticker,
    companyName: profile?.companyName || quote.name || ticker,
    currency: profile?.currency || "USD",
    price: Number(quote.price || 0),
    sharesOut,
    marketCap,
    epsLTM: Number(quote.eps || ltmIncome?.eps || 0),
    totalDebt,
    cash,
    marketableSecurities: shortInv + longInv,
    ltmRevenue: revenue,
    ltmEbitdaMargin: revenue > 0 ? ebitda / revenue : 0,
    lastFyRevenue: revenue,
    grossMargin: revenue > 0 ? grossProfit / revenue : 0,
    ebitdaMargin: revenue > 0 ? ebitda / revenue : 0,
    operatingMargin: revenue > 0 ? operatingIncome / revenue : 0,
    netMargin: revenue > 0 ? netIncome / revenue : 0,
    revenueGrowthRecent: recentGrowth,
    capexPctRevenue: revenue > 0 ? capex / revenue : 0.06,
    daPctRevenue: revenue > 0 ? da / revenue : 0.06,
    effectiveTaxRate: effTax,
    avgPE5Y: avgPE || 20,
    avgEvEbitda5Y: avgEvEbitda || 14,
    avgEvFcf5Y: avgEvFcf || 22,
  };
}
