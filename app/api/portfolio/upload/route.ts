import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get("x-gemini-key") || "";
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Default mock fallback in case of no API key or API failure
    const mockHoldings = [
      { ticker: "AAPL", shares: 45, avgPrice: 182.50 },
      { ticker: "NVDA", shares: 80, avgPrice: 112.20 },
      { ticker: "TSLA", shares: 25, avgPrice: 178.90 },
      { ticker: "MSFT", shares: 15, avgPrice: 415.40 },
    ];

    if (!apiKey) {
      return NextResponse.json({
        holdings: mockHoldings,
        isDemo: true,
        message: "No Gemini API Key supplied. Using demo holdings. Paste your key in the settings to parse your actual screenshot.",
      });
    }

    // Convert file to Base64
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString("base64");
    const mimeType = file.type || "image/png";

    // Call the official Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const promptText = `
Analyze this screenshot of an investment portfolio/brokerage account.
Extract all holdings/stocks listing:
- Ticker symbol (e.g. AAPL, MSFT, NVDA)
- Number of shares owned (quantity)
- Average buy price per share (cost basis)

Return a JSON object matching this TypeScript structure:
{
  "holdings": Array<{
    "ticker": string,
    "shares": number,
    "avgPrice": number
  }>
}

Only return the JSON object. Do not wrap it in markdown code blocks or add any other text.
`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", errText);
      return NextResponse.json({
        holdings: mockHoldings,
        isDemo: true,
        message: `Gemini API returned HTTP ${response.status}. Falling back to demo holdings.`,
      });
    }

    const resultJson = await response.json();
    const textOutput = resultJson.candidates?.[0]?.content?.parts?.[0]?.text || "";

    try {
      // Clean up the text response (sometimes LLMs wrap JSON in ```json ... ```)
      const cleanJson = textOutput.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed && Array.isArray(parsed.holdings)) {
        return NextResponse.json({
          holdings: parsed.holdings,
          isDemo: false,
        });
      }
    } catch (parseErr) {
      console.error("Failed to parse Gemini output:", textOutput, parseErr);
    }

    // Fallback if parsing failed
    return NextResponse.json({
      holdings: mockHoldings,
      isDemo: true,
      message: "Could not parse holdings from screenshot. Check the layout or edit manually.",
    });

  } catch (e: any) {
    console.error("Upload error:", e);
    return NextResponse.json({ error: e?.message || "Upload failed" }, { status: 500 });
  }
}
