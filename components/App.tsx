"use client";

import { useState } from "react";
import Home from "./Home";
import Analysis from "./Analysis";
import Scorecard from "./Scorecard";

type Stage = "home" | "analysis" | "scorecard";

export default function App() {
  const [stage, setStage] = useState<Stage>("home");
  const [data, setData] = useState<any>(null);
  const [meta, setMeta] = useState<{ ticker: string; companyName: string }>({ ticker: "", companyName: "" });

  // Lifted state — the valuation model and its computed results live here so the
  // Scorecard can hand them off to Gemini, even when the user navigates back.
  const [model, setModel] = useState<any>(null);
  const [results, setResults] = useState<any>(null);

  if (stage === "home") {
    return (
      <Home
        onLoaded={(d) => {
          setData(d);
          setMeta({ ticker: d.ticker, companyName: d.companyName });
          // Reset the model so the next ticker rebuilds from scratch
          setModel(null);
          setResults(null);
          setStage("analysis");
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  if (stage === "analysis" && data) {
    return (
      <Analysis
        data={data}
        initialModel={model}
        onModelChange={(m, r) => { setModel(m); setResults(r); }}
        onBack={() => { setStage("home"); window.scrollTo({ top: 0 }); }}
        onContinue={(info) => { setMeta(info); setStage("scorecard"); window.scrollTo({ top: 0 }); }}
      />
    );
  }

  if (stage === "scorecard") {
    return (
      <Scorecard
        ticker={meta.ticker}
        companyName={meta.companyName}
        model={model}
        results={results}
        onBack={() => { setStage("analysis"); window.scrollTo({ top: 0 }); }}
      />
    );
  }

  return null;
}
