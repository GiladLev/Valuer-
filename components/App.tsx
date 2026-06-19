"use client";

import { useState } from "react";
import Home from "./Home";
import Analysis from "./Analysis";
import Scorecard from "./Scorecard";
import Portfolio from "./Portfolio";
import { T, FONT } from "@/lib/theme";
import { Layers, TrendingUp, Briefcase } from "lucide-react";

type Tab = "valuation" | "portfolio";
type Stage = "home" | "analysis" | "scorecard";

export default function App() {
  const [tab, setTab] = useState<Tab>("valuation");
  const [stage, setStage] = useState<Stage>("home");
  const [data, setData] = useState<any>(null);
  const [meta, setMeta] = useState<{ ticker: string; companyName: string }>({ ticker: "", companyName: "" });

  // Lifted state — the valuation model and its computed results live here so the
  // Scorecard can hand them off to Gemini, even when the user navigates back.
  const [model, setModel] = useState<any>(null);
  const [results, setResults] = useState<any>(null);

  const tabStyle = (active: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    background: active ? T.violetSoft : "transparent",
    color: active ? T.violetText : T.dim,
    border: `1.5px solid ${active ? T.violetText + "22" : "transparent"}`,
    transition: "all 0.15s",
    fontFamily: FONT,
  });

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column" }}>
      {/* Sticky Global Top Navigation */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.border}`, padding: "10px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
      }}>
        {/* Brand */}
        <div 
          onClick={() => { setTab("valuation"); setStage("home"); }}
          style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: `linear-gradient(135deg,${T.violet},${T.purple})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: T.shadowSm
          }}>
            <Layers size={16} color="#fff" />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: FONT, letterSpacing: "-0.02em" }}>
            Valuer
          </span>
        </div>

        {/* Tab Controls */}
        <nav style={{ display: "flex", gap: 8 }}>
          <button 
            onClick={() => setTab("valuation")} 
            style={tabStyle(tab === "valuation")}
          >
            <TrendingUp size={15} />
            Valuation Tool
          </button>
          <button 
            onClick={() => setTab("portfolio")} 
            style={tabStyle(tab === "portfolio")}
          >
            <Briefcase size={15} />
            My Portfolio
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {tab === "portfolio" ? (
          <Portfolio />
        ) : (
          stage === "home" ? (
            <Home
              onLoaded={(d) => {
                setData(d);
                setMeta({ ticker: d.ticker, companyName: d.companyName });
                setModel(null);
                setResults(null);
                setStage("analysis");
                window.scrollTo({ top: 0 });
              }}
            />
          ) : stage === "analysis" && data ? (
            <Analysis
              data={data}
              initialModel={model}
              onModelChange={(m, r) => { setModel(m); setResults(r); }}
              onBack={() => { setStage("home"); window.scrollTo({ top: 0 }); }}
              onContinue={(info) => { setMeta(info); setStage("scorecard"); window.scrollTo({ top: 0 }); }}
            />
          ) : stage === "scorecard" ? (
            <Scorecard
              ticker={meta.ticker}
              companyName={meta.companyName}
              model={model}
              results={results}
              onBack={() => { setStage("analysis"); window.scrollTo({ top: 0 }); }}
            />
          ) : null
        )}
      </main>
    </div>
  );
}

