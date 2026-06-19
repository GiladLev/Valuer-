// Financial Modeling Prep client. Runs server-side only; key never leaves the server.
// FMP's free tier no longer exposes /quote or any statement endpoint (they return 402
// "Premium / Special Endpoint"). The only data endpoint still free is /profile, which we
// use purely for the live share price, market cap and company metadata. All financial
// statements come from SEC EDGAR instead — see lib/sec.ts.
import { getSecFundamentals, getSecCompanyInfo } from "@/lib/sec";
import { generateBuffettSummary } from "@/lib/buffett";

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

// /profile is the one endpoint the FMP free tier still serves. It carries price + marketCap
// plus the metadata we surface in the UI.
export type Profile = {
  symbol: string; companyName: string; currency: string; industry: string;
  sector: string; description: string; image: string; website: string;
  price: number; marketCap: number; beta: number; exchange: string;
};

export async function getProfile(ticker: string): Promise<Profile | null> {
  const arr = await get<Profile[]>(`${BASE}/profile?symbol=${ticker}`);
  return arr?.[0] ?? null;
}

// Clamp a market multiple to a sane band, else fall back to a generic default.
const clampMult = (x: number, lo: number, hi: number, fb: number) =>
  isFinite(x) && x >= lo && x <= hi ? x : fb;

// Build the full Valuer payload. Statements come from EDGAR (lib/sec.ts); price/market cap
// and metadata come from FMP /profile. The returned shape is what Analysis.tsx consumes.
export async function buildFundamentals(rawTicker: string) {
  const ticker = rawTicker.trim().toUpperCase();
  const [profile, sec, secInfo] = await Promise.all([
    getProfile(ticker),
    getSecFundamentals(ticker),
    getSecCompanyInfo(ticker),
  ]);

  const price = Number(profile?.price || 0);
  const marketCap = Number(profile?.marketCap || 0) / 1e6; // mm

  // Statement lines from EDGAR, scaled to millions.
  const revenue = sec.revenue / 1e6;
  const ebitda = sec.ebitda / 1e6;
  const grossProfit = sec.grossProfit / 1e6;
  const operatingIncome = sec.operatingIncome / 1e6;
  const netIncome = sec.netIncome / 1e6;
  const da = sec.da / 1e6;
  const capex = sec.capex / 1e6;
  const fcf = sec.fcf / 1e6;

  const totalDebt = sec.totalDebt / 1e6;
  const cash = sec.cash / 1e6;
  const marketableSecurities = (sec.shortTermInv + sec.longTermInv) / 1e6;

  // Shares outstanding: derive from the live market cap/price (most current), else fall
  // back to EDGAR's reported share count.
  let sharesOut = price > 0 && marketCap > 0 ? (marketCap * 1e6) / price / 1e6 : 0;
  if (!sharesOut) sharesOut = sec.sharesOutstanding / 1e6;

  const recentGrowth = sec.revenuePrev > 0 ? sec.revenue / sec.revenuePrev - 1 : 0.1;

  // No free source carries 5Y price history, so the "5Y average" multiples are seeded from
  // the current market multiple (a defensible, company-specific neutral anchor) and clamped
  // to sane bands; the user can override every one of these in the model.
  const epsLTM = Number(sec.epsDiluted || (sharesOut ? netIncome / sharesOut : 0));
  const ev = marketCap + totalDebt - cash - marketableSecurities;
  const avgPE5Y = clampMult(epsLTM > 0 ? price / epsLTM : 0, 5, 60, 20);
  const avgEvEbitda5Y = clampMult(ebitda > 0 ? ev / ebitda : 0, 4, 40, 14);
  const avgEvFcf5Y = clampMult(fcf > 0 ? ev / fcf : 0, 5, 60, 22);

  const payloadBase = {
    ticker,
    companyName: profile?.companyName || sec.entityName || ticker,
    currency: profile?.currency || "USD",
    price,
    sharesOut,
    marketCap,
    epsLTM,
    totalDebt,
    cash,
    marketableSecurities,
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
    effectiveTaxRate: sec.effectiveTaxRate,
    avgPE5Y,
    avgEvEbitda5Y,
    avgEvFcf5Y,
    secInfo,
    description: profile?.description || "",
  };

  const buffettSummary = generateBuffettSummary(payloadBase);

  return {
    ...payloadBase,
    buffettSummary,
  };
}
