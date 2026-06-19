export type BuffettPillar = {
  title: string;
  verdict: "strong" | "neutral" | "warning";
  text: string;
};

export type BuffettSummary = {
  overallVerdict: string;
  circleOfCompetence: BuffettPillar;
  economicMoat: BuffettPillar;
  financialDurability: BuffettPillar;
  filingInsight: BuffettPillar;
};

export function generateBuffettSummary(f: {
  ticker: string;
  companyName: string;
  description: string;
  grossMargin: number;
  netMargin: number;
  ebitdaMargin: number;
  totalDebt: number;
  cash: number;
  marketableSecurities: number;
  capexPctRevenue: number;
  revenueGrowthRecent: number;
  secInfo: any;
}): BuffettSummary {
  const gm = (f.grossMargin * 100).toFixed(0);
  const nm = (f.netMargin * 100).toFixed(0);
  
  // 1. Circle of Competence (הבנת העסק)
  let circleVerdict: "strong" | "neutral" | "warning" = "strong";
  let circleText = `החברה פועלת בתחום הפיננסי/תעשייתי. מודל העסק מבוסס על שירותים או מוצרים בסקטור זה.`;
  
  if (f.description) {
    const descLower = f.description.toLowerCase();
    if (descLower.includes("software") || descLower.includes("cloud") || descLower.includes("platform")) {
      circleText = `עסק טכנולוגי (תוכנה/ענן). מודלים של תוכנה כשירות (SaaS) הם בעלי פוטנציאל הרחבה עצום אך דורשים הבנה במחזוריות הטכנולוגית המהירה ורמת התחרות הגבוהה.`;
      circleVerdict = "neutral";
    } else if (descLower.includes("retail") || descLower.includes("consumer") || descLower.includes("beverage") || descLower.includes("food")) {
      circleText = `מוצרי צריכה או קמעונאות. מודל פשוט של מכירה ישירה לצרכן או רשת חנויות. קל להבנה ומעקב אחר העדפות הצרכנים - סקטור מועדף על באפט בשל הפשטות שלו.`;
      circleVerdict = "strong";
    } else if (descLower.includes("semiconductor") || descLower.includes("hardware") || descLower.includes("chip")) {
      circleText = `חומרת מחשבים או שבבים. עסק מורכב ביותר הדורש השקעות עתק במחקר ופיתוח ופגיע למחזוריות ביקוש ושרשראות אספקה. מחוץ ל'אזור הנוחות' הפשוט של באפט.`;
      circleVerdict = "warning";
    } else {
      // General description snippet
      const sentences = f.description.split(/[.!?]/).filter(Boolean);
      const briefDesc = sentences.slice(0, 2).join(". ") + ".";
      circleText = `החברה מדווחת: "${briefDesc}" מודל העסק מבוסס על שירותים ומוצרים אלו. מומלץ לוודא שהבנת כיצד החברה מייצרת מזומן והאם המוצר שלה מובן לך לחלוטין.`;
      circleVerdict = "neutral";
    }
  }

  // 2. Economic Moat (חפיר כלכלי)
  let moatVerdict: "strong" | "neutral" | "warning" = "neutral";
  let moatText = "";
  
  if (f.grossMargin > 0.55) {
    moatVerdict = "strong";
    moatText = `שולי רווח גולמי מעולים של ${gm}% מעידים על כוח תמחור חזק, מותג יציב או יתרון לגודל מובהק. זהו סימן ברור לקיומו של חפיר כלכלי רחב המגן על החברה מפני לחצי תחרות ומאפשר שמירה על רווחיות גבוהה.`;
  } else if (f.grossMargin >= 0.35) {
    moatVerdict = "neutral";
    moatText = `שולי רווח גולמי בינוניים של ${gm}%. יש לחברה בידול מסוים אך היא פועלת בסביבה תחרותית שמונעת ממנה כוח תמחור מוחלט. החפיר הכלכלי קיים אך דורש מעקב.`;
  } else {
    moatVerdict = "warning";
    moatText = `שולי רווח גולמי נמוכים של ${gm}% מעידים על עסק קומודיטי (מוצר בסיסי ללא בידול) שמתחרה בעיקר על מחיר. מודל כזה פגיע לעליית עלויות הייצור ומתקשה לשמר חפיר כלכלי לאורך זמן.`;
  }

  if (f.netMargin > 0.15) {
    moatText += ` בנוסף, שולי רווח נקי גבוהים של ${nm}% מעידים על יעילות תפעולית יוצאת מן הכלל ויכולת להשאיר הון משמעותי בידי בעלי המניות.`;
  } else if (f.netMargin < 0.05) {
    moatText += ` שולי רווח נקי נמוכים במיוחד של ${nm}% מצביעים על עסק פגיע מאוד שכל פגיעה קלה בהכנסותיו עלולה להעביר אותו להפסד.`;
    if (moatVerdict === "neutral") moatVerdict = "warning";
  }

  // 3. Financial Durability (חוסן פיננסי)
  let finVerdict: "strong" | "neutral" | "warning" = "neutral";
  let finText = "";
  
  const totalCash = f.cash + f.marketableSecurities;
  const netDebt = f.totalDebt - totalCash;
  
  if (f.totalDebt === 0 || netDebt < 0) {
    finVerdict = "strong";
    finText = `חוסן פיננסי יוצא מן הכלל (עודף מזומנים). לחברה יש מאזן נקי מחובות (מזומנים וניירות ערך בסך $${totalCash.toFixed(1)} מיליון מול חוב של $${f.totalDebt.toFixed(1)} מיליון). זהו המצב המועדף על באפט, המעיד על שמרנות פיננסית קיצונית ומבטיח שהחברה אינה תלויה בחסדי הבנקים או שוקי האשראי.`;
  } else {
    // We estimate debt to EBITDA using the static numbers
    const estEbitda = f.ebitdaMargin * (f.cash + f.totalDebt + 10); // rough ebitda scale
    const debtToEbitda = estEbitda > 0 ? f.totalDebt / estEbitda : 3;
    
    if (debtToEbitda < 2.0) {
      finVerdict = "strong";
      finText = `יחס חוב מנוהל היטב. החוב הכולל עומד על $${f.totalDebt.toFixed(1)} מיליון מול מזומנים של $${totalCash.toFixed(1)} מיליון. החברה מציגה רמת מינוף נמוכה יחסית לרווחיה, מה שמעניק לה יציבות גבוהה ושומר על דירוג אשראי חזק.`;
    } else if (debtToEbitda >= 3.5) {
      finVerdict = "warning";
      finText = `מינוף גבוה יחסית. החוב הכולל עומד על $${f.totalDebt.toFixed(1)} מיליון (עודף חוב של $${netDebt.toFixed(1)} מיליון על מזומנים). חובות גבוהים מכבידים על תזרים המזומנים ומקטינים את המרווח התפעולי של החברה במקרה של האטה כלכלית או עליית ריבית.`;
    } else {
      finVerdict = "neutral";
      finText = `מבנה הון מאוזן. החוב הכולל עומד על $${f.totalDebt.toFixed(1)} מיליון ומאוזן בחלקו על ידי מזומנים של $${totalCash.toFixed(1)} מיליון. המינוף סביר אך יש לעקוב אחר קצב פירעון החובות.`;
    }
  }

  // Reinvestment requirements (Capex)
  if (f.capexPctRevenue < 0.04) {
    finText += ` החברה מציגה הוצאות הון נמוכות של ${(f.capexPctRevenue * 100).toFixed(1)}% מההכנסות, דבר המעיד על עסק קל-הון (Capital-Light) שאינו דורש רכישת ציוד כבד או נדל"ן רק כדי לשמר את רווחיו.`;
  } else if (f.capexPctRevenue > 0.10) {
    finText += ` הוצאות ההון משמעותיות (${(f.capexPctRevenue * 100).toFixed(1)}% מההכנסות). החברה עתירת-הון ונדרשת להשקיע מחדש אחוז ניכר מרווחיה בציוד או פיתוח כדי להישאר תחרותית.`;
    if (finVerdict === "strong") finVerdict = "neutral";
  }

  // 4. Filing Insight (תובנת דיווחים - S-1 מול 10-K)
  let filingVerdict: "strong" | "neutral" | "warning" = "neutral";
  let filingText = "";
  
  const sec = f.secInfo;
  if (sec && sec.latest10K) {
    const k10Date = sec.latest10K.filingDate;
    if (sec.s1) {
      const s1Date = sec.s1.filingDate;
      filingVerdict = "warning";
      filingText = `אזהרת הנפקה (Form S-1): החברה הגישה לאחרונה תשקיף רישום (S-1) בתאריך ${s1Date}. באפט מזהיר בעקביות מרכישת חברות חדשות בשוק (IPOs). לטענתו, המחיר נקבע על ידי המוכרים שמנסים למקסם את השווי עבור עצמם, ואין לחברה עדיין היסטוריה ציבורית ממושכת מספיק כדי לבחון את עקביות רווחיה ותפקוד הנהלתה לאורך מחזור עסקים מלא.`;
    } else {
      filingVerdict = "strong";
      filingText = `סטטוס דיווחים יציב (10-K): החברה היא ישות ציבורית מבוססת. הדו"ח השנתי המקיף האחרון שלה (10-K) הוגש ב-${k10Date}. היסטוריה ציבורית ארוכה ללא הנפקות מניות מסיביות (דלילה) מאפשרת לבחון את עקביות התשואות על ההון והרווחים למניה לאורך זמן, בהתאם לסטנדרטים של וורן באפט.`;
    }
  } else {
    filingVerdict = "neutral";
    filingText = `לא נמצאו נתוני דיווחים עדכניים מה-SEC EDGAR. מומלץ לבדוק את הסטטוס הרשמי של החברה ומתי הוגשו הדו"חות השנתיים האחרונים שלה.`;
  }

  // Overall Verdict (Hebrew)
  let overall = "חברה בעלת מאפיינים מעורבים.";
  if (circleVerdict === "strong" && moatVerdict === "strong" && finVerdict === "strong" && filingVerdict === "strong") {
    overall = "חברת איכות יוצאת דופן העונה על רוב עקרונות באפט: מודל פשוט, חפיר כלכלי רחב, חוסן פיננסי מעולה ודיווחים יציבים.";
  } else if (moatVerdict === "strong" && finVerdict === "strong") {
    overall = "חברה בעלת יסודות חזקים במיוחד עם רווחיות גבוהה ומאזן שמרני, המתאימה לניתוח ערך מעמיק.";
  } else if (moatVerdict === "warning" || finVerdict === "warning") {
    overall = "חברה בעלת סימני אזהרה פיננסיים או תחרותיים. שולי רווח נמוכים או חובות גבוהים מקשים על הגדרתה כחברה בעלת חפיר כלכלי.";
  }

  return {
    overallVerdict: overall,
    circleOfCompetence: {
      title: "הבנת העסק (Circle of Competence)",
      verdict: circleVerdict,
      text: circleText,
    },
    economicMoat: {
      title: "חפיר כלכלי ורווחיות (Economic Moat)",
      verdict: moatVerdict,
      text: moatText,
    },
    financialDurability: {
      title: "חוסן פיננסי ומבנה הון (Financial Durability)",
      verdict: finVerdict,
      text: finText,
    },
    filingInsight: {
      title: "סטטוס דיווחים והנפקות (SEC Filing Insight)",
      verdict: filingVerdict,
      text: filingText,
    },
  };
}
