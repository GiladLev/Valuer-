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

  if (stage === "home") {
    return (
      <Home
        onLoaded={(d) => {
          setData(d);
          setMeta({ ticker: d.ticker, companyName: d.companyName });
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
        onBack={() => { setStage("analysis"); window.scrollTo({ top: 0 }); }}
      />
    );
  }

  return null;
}
