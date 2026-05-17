import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL_CHEAP = process.env.MODEL_CHEAP ?? 'claude-haiku-4-5-20251001'
const MODEL_SMART = process.env.MODEL_SMART ?? 'claude-sonnet-4-6'

export async function analyzeNewsSentiment(newsItems) {
  if (!newsItems.length) return { sentiment: 'neutral', impact: 'low', summary: 'No relevant news.', risk_events: [] }
  const headlines = newsItems.slice(0, 8).map(n => `• ${n.title}`).join('\n')
  const res = await client.messages.create({
    model: MODEL_CHEAP,
    max_tokens: 200,
    messages: [{ role: 'user', content: `Analyze these headlines for XAUUSD gold market impact. Headlines:\n${headlines}\n\nRespond ONLY in JSON with no markdown:\n{"sentiment":"bullish","impact":"high","summary":"one sentence","risk_events":[]}` }]
  })
  try {
    const text = res.content[0].text.replace(/```json|```/g,'').trim()
    return JSON.parse(text)
  } catch {
    return { sentiment: 'neutral', impact: 'low', summary: 'Parse error.', risk_events: [] }
  }
}

export async function analyzeSignalWithClaude(signal, newsItems) {
  const newsText = newsItems.slice(0, 6).map(n => `• ${n.title}`).join('\n')
  const prompt = `You are an expert XAUUSD trader. Analyze this signal and respond ONLY in JSON with no markdown backticks.

SIGNAL: ${signal.direction} @ $${signal.price}
H1: aboveEMA200=${signal.h1_aboveEMA200}, aboveVWAP=${signal.h1_aboveVWAP}, ema200=$${signal.h1_ema200}, vwap=$${signal.h1_vwap}
M15: aboveEMA200=${signal.m15_aboveEMA200}, vwap_ok=${signal.m15_vwap_ok}, ob=${signal.m15_ob}, fvg=${signal.m15_fvg}, sweep=${signal.m15_sweep}
M5: aboveEMA200=${signal.m5_aboveEMA200}, vwap_ok=${signal.m5_vwap_ok}, choch=${signal.m5_choch}, sweep=${signal.m5_sweep}, rsi=${signal.rsi}, macd=${signal.macd_bull ?? signal.macd_bear}
SL=$${signal.sl} TP=$${signal.tp} ATR=${signal.atr}

NEWS:
${newsText || 'No news'}

Respond with this exact JSON structure:
{"validated":true,"final_direction":"BUY","confidence":75,"smc_grade":"A","ema200_alignment":"all 3 TFs","vwap_alignment":"all 3 TFs","news_sentiment":"neutral","news_impact":"low","confluences":["EMA200 aligned","VWAP confirmed"],"missing":[],"reasoning":"Price shows strong bullish confluence across all timeframes.","position_size":"half","risk_warning":null}`

  const res = await client.messages.create({
    model: MODEL_SMART,
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }]
  })
  try {
    const text = res.content[0].text.replace(/```json|```/g,'').trim()
    return JSON.parse(text)
  } catch(e) {
    console.error('Parse error:', res.content[0].text)
    return { validated: false, final_direction: 'WAIT', confidence: 0, smc_grade: 'C', ema200_alignment: 'none', vwap_alignment: 'none', news_sentiment: 'neutral', news_impact: 'low', confluences: [], missing: [], reasoning: 'Analysis failed.', position_size: 'none', risk_warning: null }
  }
}
