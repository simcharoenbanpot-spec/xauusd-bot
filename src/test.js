// ─────────────────────────────────────────────────────────────
// src/test.js
// Run this first to verify everything is connected correctly
// node src/test.js
// ─────────────────────────────────────────────────────────────
import 'dotenv/config'
import { getXAUUSDPrice, getXAUUSDCandles } from './price-feed.js'
import { fetchRelevantNews }                from './news-fetcher.js'
import { analyzeNewsSentiment }             from './analyzer.js'
import { sendStatus }                       from './notifier.js'

console.log('🧪 Running system test...\n')

// 1. Price feed
process.stdout.write('1. Price feed (Yahoo Finance)... ')
try {
  const p = await getXAUUSDPrice()
  console.log(`✅  XAUUSD = $${p.price} (${p.change}%)`)
} catch (e) { console.log('❌ ', e.message) }

// 2. Candles
process.stdout.write('2. Candles (H1 / M15 / M5)... ')
try {
  const [h1, m15, m5] = await Promise.all([
    getXAUUSDCandles('1h',  10),
    getXAUUSDCandles('15m', 10),
    getXAUUSDCandles('5m',  10),
  ])
  console.log(`✅  H1:${h1.length} M15:${m15.length} M5:${m5.length} candles`)
} catch (e) { console.log('❌ ', e.message) }

// 3. News feeds
process.stdout.write('3. News feeds (RSS)... ')
try {
  const news = await fetchRelevantNews()
  console.log(`✅  ${news.length} relevant articles`)
  if (news.length) console.log(`   Latest: "${news[0].title}"`)
} catch (e) { console.log('❌ ', e.message) }

// 4. Claude API (Haiku)
process.stdout.write('4. Claude API (Haiku news check)... ')
try {
  const news = await fetchRelevantNews()
  const res  = await analyzeNewsSentiment(news)
  console.log(`✅  Sentiment: ${res.sentiment} | Impact: ${res.impact}`)
} catch (e) { console.log('❌ ', e.message) }

// 5. Telegram
process.stdout.write('5. Telegram bot... ')
try {
  await sendStatus('🧪 Test ping from XAUUSD bot — all systems online!')
  console.log('✅  Message sent to Telegram')
} catch (e) { console.log('❌ ', e.message) }

console.log('\n✅ Test complete. Check your Telegram for the ping message.')
console.log('   If all green → run:  npm start  (standalone)')
console.log('   Or:               npm run webhook  (TradingView mode)')
