// ─────────────────────────────────────────────────────────────
// src/analyzer.js
// Two-model Claude analysis:
//   Bot A (Haiku)  — quick news sentiment check every cycle
//   Bot B (Sonnet) — deep signal validation when score ≥ threshold
// ─────────────────────────────────────────────────────────────
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL_CHEAP = process.env.MODEL_CHEAP ?? 'claude-haiku-4-5-20251001'
const MODEL_SMART = process.env.MODEL_SMART ?? 'claude-sonnet-4-6'

// ── Bot A: News sentiment (Haiku — runs every check cycle) ───
export async function analyzeNewsSentiment(newsItems) {
  if (!newsItems.length) return { sentiment: 'neutral', impact: 'low', summary: 'No relevant news.' }

  const headlines = newsItems.slice(0, 8).map(n => `• ${n.title}`).join('\n')

  const res = await client.messages.create({
    model:      MODEL_CHEAP,
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `You are a gold market news analyst. Assess these headlines for XAUUSD impact.
Headlines:
${headlines}

Respond ONLY in JSON (no markdown):
{"sentiment":"bullish"|"bearish"|"neutral","impact":"high"|"medium"|"low","summary":"one sentence","risk_events":["list any scheduled events like FOMC/CPI/NFP or empty array"]}`
    }]
  })

  try {
    const txt = res.content[0].text.replace(/```json|```/g,'').trim(); return JSON.parse(txt)
  } catch {
    return { sentiment: 'neutral', impact: 'low', summary: 'Parse error.', risk_events: [] }
  }
}

// ── Bot B: Full signal validation (Sonnet — runs on signals) ─
export async function analyzeSignalWithClaude(signal, newsItems) {
  const newsText = newsItems.slice(0, 6).map(n => `• ${n.title}`).join('\n')

  const prompt = `You are an expert XAUUSD intraday trader specialising in SMC, EMA200, and VWAP.

SIGNAL: ${signal.direction} @ $${signal.price}
Strategy: ${signal.strategy}
Technical score: ${signal.direction === 'BUY' ? signal.buyScore : signal.sellScore}/${signal.total} conditions met

H1 — BIAS LAYER:
• Price vs EMA200 ($${signal.h1_ema200}): ${signal.h1_aboveEMA200 ? 'ABOVE ✓ (bullish)' : 'BELOW (bearish)'}
• Price vs VWAP  ($${signal.h1_vwap}):   ${signal.h1_aboveVWAP   ? 'ABOVE ✓ (buy side)' : 'BELOW (sell side)'}
• CHoCH: ${signal.h1_choch} | Order Block: ${signal.h1_ob} | FVG: ${signal.h1_fvg}
• Zone: ${signal.h1_discount ? 'Discount ✓' : signal.h1_premium ? 'Premium ✓' : 'Mid-range'}

M15 — ZONE LAYER:
• Price vs EMA200 ($${signal.m15_ema200}): ${signal.m15_aboveEMA200 ? 'ABOVE ✓' : 'BELOW'}
• Price vs VWAP  ($${signal.m15_vwap}):   ${signal.m15_aboveVWAP   ? 'ABOVE ✓' : 'BELOW'}
• Order Block: ${signal.m15_ob} | FVG: ${signal.m15_fvg} | Liq Sweep: ${signal.m15_sweep}

M5 — ENTRY LAYER:
• Price vs EMA200 ($${signal.m5_ema200}): ${signal.m5_aboveEMA200 ? 'ABOVE ✓' : 'BELOW'}
• Price vs VWAP  ($${signal.m5_vwap}):   ${signal.m5_aboveVWAP   ? 'ABOVE ✓' : 'BELOW'}
• EMA 9/21: ${signal.m5_emaBull ? 'Bullish cross ✓' : signal.m5_emaBear ? 'Bearish cross ✓' : 'No cross'}
• RSI: ${signal.m5_rsi} | MACD: ${signal.m5_macdBull ? 'Bullish ✓' : 'Bearish ✓'}
• CHoCH M5: ${signal.m5_choch} | Sweep M5: ${signal.m5_sweep}

RISK MANAGEMENT:
• SL: $${signal.sl} | TP: $${signal.tp} | ATR: ${signal.atr} | R:R 1:2

RECENT NEWS:
${newsText || '• No relevant news found'}

RULES:
1. EMA200 and VWAP are highest-weight confluences — wrong side on H1 = reject
2. All three timeframes must structurally agree
3. News risk events (FOMC/CPI/NFP) within 2 hours = reduce size or reject
4. A+ grade requires: CHoCH + OB + FVG + sweep all present

Respond in JSON only (no markdown):
{
  "validated": true,
  "final_direction": "BUY"|"SELL"|"WAIT",
  "confidence": 0-100,
  "smc_grade": "A+"|"A"|"B"|"C",
  "ema200_alignment": "all 3 TFs"|"2 TFs"|"1 TF"|"none",
  "vwap_alignment":   "all 3 TFs"|"2 TFs"|"1 TF"|"none",
  "news_sentiment": "bullish"|"bearish"|"neutral",
  "news_impact":    "high"|"medium"|"low",
  "confluences":  ["active confirmations list"],
  "missing":      ["what would make it stronger"],
  "reasoning":    "2-3 sentences referencing EMA200, VWAP, and SMC structure",
  "position_size": "full"|"half"|"quarter",
  "risk_warning":  "specific warning or null"
}`

  const res = await client.messages.create({
    model:      MODEL_SMART,
    max_tokens: 600,
    messages:   [{ role: 'user', content: prompt }]
  })

  try {
    const txt = res.content[0].text.replace(/```json|```/g,'').trim(); return JSON.parse(txt)
  } catch {
    return {
      validated: false, final_direction: 'WAIT', confidence: 0,
      smc_grade: 'C', reasoning: 'Parse error — skipping signal.',
      position_size: 'none', risk_warning: null
    }
  }
}
