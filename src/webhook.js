// ─────────────────────────────────────────────────────────────
// src/webhook.js
// TradingView webhook receiver
// TradingView fires → this server → Claude validates → Telegram
// Use this if you have TradingView Pro (recommended)
// Run: node src/webhook.js
// ─────────────────────────────────────────────────────────────
import 'dotenv/config'
import express                               from 'express'
import { fetchRelevantNews }                 from './news-fetcher.js'
import { analyzeNewsSentiment,
         analyzeSignalWithClaude }           from './analyzer.js'
import { sendSignalAlert,
         sendNewsAlert,
         sendStatus }                        from './notifier.js'

const app  = express()
const PORT = parseInt(process.env.WEBHOOK_PORT ?? '3000')

app.use(express.json())

const CONFIDENCE_THRESHOLD = parseInt(process.env.CONFIDENCE_THRESHOLD ?? '70')
const COOLDOWN_MS          = parseInt(process.env.COOLDOWN_MINUTES ?? '30') * 60 * 1000

let lastSignalTime = 0
let lastDirection  = null

// ── Health check endpoint ────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'online', bot: 'XAUUSD Signal Bot', time: new Date().toISOString() })
})

// ── TradingView webhook endpoint ─────────────────────────────
// Set this URL in TradingView alert: http://YOUR_SERVER_IP:3000/webhook
app.post('/webhook', async (req, res) => {
  // Always acknowledge TradingView immediately (it times out quickly)
  res.sendStatus(200)

  const raw = req.body
  const ts  = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })
  console.log(`\n[${ts}] 📡 TradingView signal received:`, raw)

  try {
    const now = Date.now()

    // Parse the signal from TradingView Pine Script JSON
    const signal = {
      direction: raw.direction,         // "BUY" or "SELL"
      price:     raw.price,
      strategy:  raw.strategy ?? 'H1-M15-M5-EMA200-VWAP',

      // H1 layer
      h1_aboveEMA200: raw.h1_aboveEMA200,
      h1_aboveVWAP:   raw.h1_aboveVWAP,
      h1_ema200:      raw.h1_ema200,
      h1_vwap:        raw.h1_vwap,
      h1_choch:       raw.h1_choch,
      h1_ob:          raw.h1_ob,
      h1_fvg:         raw.h1_fvg,
      h1_discount:    raw.h1_discount,
      h1_premium:     raw.h1_premium,

      // M15 layer
      m15_aboveEMA200: raw.m15_aboveEMA200,
      m15_vwap:        raw.m15_vwap,
      m15_ema200:      raw.m15_ema200,
      m15_aboveVWAP:   raw.m15_vwap_ok,
      m15_ob:          raw.m15_ob,
      m15_fvg:         raw.m15_fvg,
      m15_sweep:       raw.m15_sweep,

      // M5 layer
      m5_aboveEMA200: raw.m5_aboveEMA200,
      m5_vwap:        raw.m5_vwap,
      m5_ema200:      raw.m5_ema200,
      m5_aboveVWAP:   raw.m5_vwap_ok,
      m5_choch:       raw.m5_choch,
      m5_sweep:       raw.m5_sweep,
      m5_rsi:         raw.rsi,
      m5_macdBull:    raw.macd_bull,
      m5_emaBull:     raw.ema_bull,
      m5_emaBear:     raw.ema_bear,

      // Risk
      sl:  raw.sl,
      tp:  raw.tp,
      atr: raw.atr,

      // Score placeholders (TradingView already filtered)
      buyScore:  11, sellScore: 11, total: 14,
    }

    // Cooldown check
    if (now - lastSignalTime < COOLDOWN_MS && lastDirection === signal.direction) {
      console.log('   🔄 Cooldown active — skipping')
      return
    }

    // Fetch news
    const news         = await fetchRelevantNews()
    const newsAnalysis = await analyzeNewsSentiment(news)
    console.log(`   📰 News: ${newsAnalysis.sentiment} (${newsAnalysis.impact})`)

    // Claude deep validation (Sonnet)
    console.log('   🤖 Sending to Claude for validation...')
    const claude = await analyzeSignalWithClaude(signal, news)
    console.log(`   ✅ Claude: ${claude.final_direction} | ${claude.confidence}% | Grade: ${claude.smc_grade}`)

    if (claude.validated && claude.confidence >= CONFIDENCE_THRESHOLD) {
      await sendSignalAlert(signal, claude)
      lastSignalTime = now
      lastDirection  = claude.final_direction
      console.log('   📲 Signal sent to Telegram!')
    } else {
      console.log(`   ❌ Claude rejected: ${claude.confidence}% confidence — not sent`)
    }

  } catch (err) {
    console.error('   ❗ Webhook error:', err.message)
  }
})

// ── Manual news check endpoint ───────────────────────────────
// Hit this anytime: curl http://YOUR_SERVER:3000/news
app.get('/news', async (req, res) => {
  try {
    const news    = await fetchRelevantNews()
    const analysis = await analyzeNewsSentiment(news)
    await sendNewsAlert(analysis, news)
    res.json({ sent: true, sentiment: analysis.sentiment, impact: analysis.impact })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`🟢 Webhook server running on port ${PORT}`)
  console.log(`   TradingView URL: http://YOUR_SERVER_IP:${PORT}/webhook`)
  console.log(`   Health check:    http://YOUR_SERVER_IP:${PORT}/`)
  console.log(`   Manual news:     http://YOUR_SERVER_IP:${PORT}/news`)
  await sendStatus(`🟢 Webhook server online on port ${PORT}\nAwaiting TradingView signals...`)
})
