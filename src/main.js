// ─────────────────────────────────────────────────────────────
// src/main.js
// Standalone monitor — no TradingView needed
// Runs every 5 min, calculates everything internally
// Use this if you don't have TradingView Pro
// ─────────────────────────────────────────────────────────────
import 'dotenv/config'
import { getXAUUSDCandles }                  from './price-feed.js'
import { fetchRelevantNews }                 from './news-fetcher.js'
import { calculateSignals }                  from './strategy.js'
import { analyzeNewsSentiment,
         analyzeSignalWithClaude }           from './analyzer.js'
import { sendSignalAlert,
         sendNewsAlert,
         sendStatus }                        from './notifier.js'

const CHECK_INTERVAL_MS  = 5 * 60 * 1000         // every 5 min
const COOLDOWN_MS        = parseInt(process.env.COOLDOWN_MINUTES ?? '30') * 60 * 1000
const CONFIDENCE_THRESHOLD = parseInt(process.env.CONFIDENCE_THRESHOLD ?? '70')

let lastSignalTime = 0
let lastDirection  = null
let lastNewsTime   = 0
const NEWS_COOLDOWN = 60 * 60 * 1000              // news alert max once/hour

async function runCheck() {
  const now = Date.now()
  const ts  = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })
  console.log(`\n[${ts}] 🔍 Running check...`)

  try {
    // ── 1. Fetch all data in parallel ──────────────────────
    const [h1, m15, m5, news] = await Promise.all([
      getXAUUSDCandles('1h',  200),
      getXAUUSDCandles('15m', 200),
      getXAUUSDCandles('5m',  200),
      fetchRelevantNews(),
    ])

    // ── 2. News sentiment (Haiku — cheap, every cycle) ─────
    const newsAnalysis = await analyzeNewsSentiment(news)
    console.log(`   📰 News: ${newsAnalysis.sentiment} (${newsAnalysis.impact})`)

    // Send news alert if high impact and not sent recently
    if (newsAnalysis.impact === 'high' && now - lastNewsTime > NEWS_COOLDOWN) {
      await sendNewsAlert(newsAnalysis, news)
      lastNewsTime = now
      console.log('   📲 News alert sent')
    }

    // ── 3. Calculate technical signals ─────────────────────
    const signal = calculateSignals({ h1, m15, m5 })
    console.log(`   📊 Direction: ${signal.direction} | Score: ${signal.direction === 'BUY' ? signal.buyScore : signal.sellScore}/${signal.total}`)

    if (signal.direction === 'WAIT') {
      console.log('   ⏸️  No confluence — waiting')
      return
    }

    // ── 4. Cooldown — avoid repeat alerts ──────────────────
    if (now - lastSignalTime < COOLDOWN_MS && lastDirection === signal.direction) {
      console.log('   🔄 Same signal in cooldown window — skipping')
      return
    }

    // ── 5. Claude validates (Sonnet — only on real signals) ─
    console.log('   🤖 Sending to Claude for validation...')
    const claude = await analyzeSignalWithClaude(signal, news)
    console.log(`   ✅ Claude: ${claude.final_direction} | ${claude.confidence}% | Grade: ${claude.smc_grade}`)

    // ── 6. Fire if confidence meets threshold ──────────────
    if (claude.validated && claude.confidence >= CONFIDENCE_THRESHOLD) {
      await sendSignalAlert(signal, claude)
      lastSignalTime = now
      lastDirection  = claude.final_direction
      console.log('   📲 Signal sent to Telegram!')
    } else {
      console.log(`   ❌ Below threshold (${claude.confidence}% < ${CONFIDENCE_THRESHOLD}%) — not sent`)
    }

  } catch (err) {
    console.error('   ❗ Error:', err.message)
  }
}

// ── Startup ─────────────────────────────────────────────────
await sendStatus('🟢 Standalone monitor started\nChecking every 5 min\nSession: 14:00–22:00 BKK')
console.log('🟢 XAUUSD Bot started — standalone mode (no TradingView)')
console.log(`   Confidence threshold: ${CONFIDENCE_THRESHOLD}%`)
console.log(`   Cooldown: ${process.env.COOLDOWN_MINUTES ?? 30} min\n`)

runCheck()
setInterval(runCheck, CHECK_INTERVAL_MS)
