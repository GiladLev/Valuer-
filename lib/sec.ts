// SEC EDGAR client. Pulls fundamentals from the XBRL companyfacts API — free, official,
// no key, US filers only. Runs server-side. EDGAR has no live price, so price/market cap
// come from FMP's free /profile endpoint (see lib/fmp.ts); EDGAR supplies every statement line.
//
// SEC requires a User-Agent in the form "Name email" — www.sec.gov returns 403 without a
// contact address. Set SEC_USER_AGENT to your own to be a good citizen on the SEC's API.
const UA = process.env.SEC_USER_AGENT || "Valuer/1.0 valuer-app@example.com";

async function secGet<T>(url: string, revalidate: number): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, next: { revalidate } });
  if (!res.ok) throw new Error(`SEC ${res.status} ${res.statusText} on ${url}`);
  return (await res.json()) as T;
}

// ---- ticker -> CIK -------------------------------------------------------
type TickerRow = { cik_str: number; ticker: string; title: string };

let cikCache: Record<string, string> | null = null;
async function tickerMap(): Promise<Record<string, string>> {
  if (cikCache) return cikCache;
  const raw = await secGet<Record<string, TickerRow>>("https://www.sec.gov/files/company_tickers.json", 604800);
  const map: Record<string, string> = {};
  for (const k of Object.keys(raw)) {
    const row = raw[k];
    map[row.ticker.toUpperCase()] = String(row.cik_str).padStart(10, "0");
  }
  cikCache = map;
  return map;
}

// ---- companyfacts --------------------------------------------------------
type Fact = { start?: string; end: string; val: number; fy?: number; fp?: string; form?: string };
type Concept = { units: Record<string, Fact[]> };
type CompanyFacts = { cik: number; entityName: string; facts: { "us-gaap"?: Record<string, Concept>; dei?: Record<string, Concept> } };

const dayDiff = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86400000;

// Latest fiscal-year datapoints for the first tag that has data, newest first.
// Flow items (revenue, net income) are filtered to ~full-year periods; instant items
// (balance-sheet lines) are point-in-time. Only 10-K filings are considered.
function annual(facts: CompanyFacts["facts"], tags: readonly string[], instant = false): { end: string; val: number }[] {
  for (const tag of tags) {
    const node = facts["us-gaap"]?.[tag] ?? facts.dei?.[tag];
    if (!node) continue;
    const unit = Object.keys(node.units)[0];
    if (!unit) continue;
    const picked: Record<string, number> = {};
    for (const r of node.units[unit]) {
      if (r.form !== "10-K" && r.form !== "10-K/A") continue;
      if (!instant) {
        if (!r.start) continue;
        const d = dayDiff(r.start, r.end);
        if (d < 350 || d > 380) continue;
      }
      picked[r.end] = r.val; // later filings overwrite restated values
    }
    const ends = Object.keys(picked).sort().reverse();
    if (ends.length) return ends.map((e) => ({ end: e, val: picked[e] }));
  }
  return [];
}

const latest = (rows: { end: string; val: number }[]) => (rows.length ? rows[0].val : 0);

// US-GAAP tags vary by filer, so each line carries a fallback chain.
const TAGS = {
  revenue: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet", "RevenueFromContractWithCustomerIncludingAssessedTax"],
  grossProfit: ["GrossProfit"],
  costOfRevenue: ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold"],
  operatingIncome: ["OperatingIncomeLoss"],
  netIncome: ["NetIncomeLoss", "ProfitLoss"],
  tax: ["IncomeTaxExpenseBenefit"],
  da: ["DepreciationDepletionAndAmortization", "DepreciationAmortizationAndAccretionNet", "DepreciationAndAmortization", "Depreciation"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
  ocf: ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
  eps: ["EarningsPerShareDiluted", "EarningsPerShareBasicAndDiluted"],
  dilutedShares: ["WeightedAverageNumberOfDilutedSharesOutstanding", "WeightedAverageNumberOfShareOutstandingBasicAndDiluted"],
  cash: ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
  shortTermInv: ["ShortTermInvestments", "AvailableForSaleSecuritiesCurrent", "MarketableSecuritiesCurrent"],
  longTermInv: ["LongTermInvestments", "MarketableSecuritiesNoncurrent"],
  longTermDebt: ["LongTermDebt"],
  longTermDebtNC: ["LongTermDebtNoncurrent"],
  longTermDebtCur: ["LongTermDebtCurrent"],
  shortTermDebt: ["DebtCurrent", "ShortTermBorrowings"],
  sharesOut: ["EntityCommonStockSharesOutstanding"],
} as const;

export type SecFundamentals = {
  entityName: string;
  revenue: number; revenuePrev: number;
  grossProfit: number; operatingIncome: number; netIncome: number;
  ebitda: number; da: number; tax: number; effectiveTaxRate: number;
  capex: number; ocf: number; fcf: number;
  cash: number; shortTermInv: number; longTermInv: number; totalDebt: number;
  epsDiluted: number; sharesOutstanding: number;
};

// All figures in raw dollars / raw share counts (caller scales to millions).
export async function getSecFundamentals(rawTicker: string): Promise<SecFundamentals> {
  const ticker = rawTicker.trim().toUpperCase();
  const cik = (await tickerMap())[ticker];
  if (!cik) {
    throw new Error(`${ticker} is not an SEC filer — EDGAR covers US-listed companies that file 10-Ks`);
  }
  const data = await secGet<CompanyFacts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, 86400);
  const f = data.facts;

  const revRows = annual(f, TAGS.revenue);
  const revenue = latest(revRows);
  const revenuePrev = revRows.length > 1 ? revRows[1].val : 0;
  if (!revenue) throw new Error(`No annual revenue found in EDGAR filings for ${ticker}`);

  const operatingIncome = latest(annual(f, TAGS.operatingIncome));
  const netIncome = latest(annual(f, TAGS.netIncome));
  const tax = latest(annual(f, TAGS.tax));
  const da = latest(annual(f, TAGS.da));
  const capex = Math.abs(latest(annual(f, TAGS.capex)));
  const ocf = latest(annual(f, TAGS.ocf));

  let grossProfit = latest(annual(f, TAGS.grossProfit));
  if (!grossProfit) {
    const cor = latest(annual(f, TAGS.costOfRevenue));
    if (cor) grossProfit = revenue - cor;
  }

  const cash = latest(annual(f, TAGS.cash, true));
  const shortTermInv = latest(annual(f, TAGS.shortTermInv, true));
  const longTermInv = latest(annual(f, TAGS.longTermInv, true));

  // Prefer the aggregate LongTermDebt tag; otherwise sum the components.
  let totalDebt = latest(annual(f, TAGS.longTermDebt, true));
  if (!totalDebt) {
    totalDebt =
      latest(annual(f, TAGS.longTermDebtNC, true)) +
      latest(annual(f, TAGS.longTermDebtCur, true)) +
      latest(annual(f, TAGS.shortTermDebt, true));
  }

  const epsDiluted = latest(annual(f, TAGS.eps));
  const sharesOutstanding = latest(annual(f, TAGS.sharesOut, true)) || latest(annual(f, TAGS.dilutedShares));

  // EBITDA = operating income + D&A. Derive effective tax from tax / pre-tax, where
  // pre-tax = net income + tax (robust across filers whose pre-tax tag varies/lapses).
  const ebitda = operatingIncome + da;
  const ebt = netIncome + tax;
  const effectiveTaxRate = ebt > 0 ? tax / ebt : 0.18;
  const fcf = ocf ? ocf - capex : ebitda - capex - tax;

  return {
    entityName: data.entityName,
    revenue, revenuePrev, grossProfit, operatingIncome, netIncome,
    ebitda, da, tax, effectiveTaxRate, capex, ocf, fcf,
    cash, shortTermInv, longTermInv, totalDebt,
    epsDiluted, sharesOutstanding,
  };
}

export type SecFilingInfo = {
  form: string;
  filingDate: string;
  reportDate: string;
  primaryDocument: string;
  accessionNumber: string;
  url: string;
};

export type SecCompanyInfo = {
  cik: string;
  name: string;
  sic: string;
  sicDescription: string;
  tickers: string[];
  exchanges: string[];
  fiscalYearEnd: string;
  latest10K: SecFilingInfo | null;
  latest10Q: SecFilingInfo | null;
  s1: SecFilingInfo | null;
};

export function getSecFilingUrl(cik: string, accessionNumber: string, primaryDocument: string): string {
  const cleanAcc = accessionNumber.replace(/-/g, "");
  const cleanCik = String(Number(cik));
  return `https://www.sec.gov/ix?doc=/Archives/edgar/data/${cleanCik}/${cleanAcc}/${primaryDocument}`;
}

export async function getSecCompanyInfo(rawTicker: string): Promise<SecCompanyInfo | null> {
  const ticker = rawTicker.trim().toUpperCase();
  const cik = (await tickerMap())[ticker];
  if (!cik) return null;

  try {
    const data = await secGet<any>(`https://data.sec.gov/submissions/CIK${cik}.json`, 86400);
    const recent = data.filings?.recent;
    if (!recent) return null;

    let latest10K: SecFilingInfo | null = null;
    let latest10Q: SecFilingInfo | null = null;
    let s1: SecFilingInfo | null = null;

    const forms = recent.form || [];
    const dates = recent.filingDate || [];
    const reportDates = recent.reportDate || [];
    const docs = recent.primaryDocument || [];
    const accs = recent.accessionNumber || [];

    for (let i = 0; i < forms.length; i++) {
      const f = forms[i];
      if (!latest10K && f === "10-K") {
        latest10K = {
          form: f,
          filingDate: dates[i],
          reportDate: reportDates[i],
          primaryDocument: docs[i],
          accessionNumber: accs[i],
          url: getSecFilingUrl(cik, accs[i], docs[i]),
        };
      }
      if (!latest10Q && f === "10-Q") {
        latest10Q = {
          form: f,
          filingDate: dates[i],
          reportDate: reportDates[i],
          primaryDocument: docs[i],
          accessionNumber: accs[i],
          url: getSecFilingUrl(cik, accs[i], docs[i]),
        };
      }
      if (!s1 && (f === "S-1" || f === "S-1/A")) {
        s1 = {
          form: f,
          filingDate: dates[i],
          reportDate: reportDates[i],
          primaryDocument: docs[i],
          accessionNumber: accs[i],
          url: getSecFilingUrl(cik, accs[i], docs[i]),
        };
      }
      if (latest10K && latest10Q && s1) break;
    }

    return {
      cik,
      name: data.name || data.entityName || "",
      sic: data.sic || "",
      sicDescription: data.sicDescription || "",
      tickers: data.tickers || [],
      exchanges: data.exchanges || [],
      fiscalYearEnd: data.fiscalYearEnd || "",
      latest10K,
      latest10Q,
      s1,
    };
  } catch (e) {
    console.error(`Failed to fetch SEC submissions for CIK ${cik}:`, e);
    return null;
  }
}

