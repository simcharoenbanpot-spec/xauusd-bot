// ─────────────────────────────────────────────────────────────
// src/notifier.js
// Sends formatted signal alerts + news digests to Telegram
// ─────────────────────────────────────────────────────────────

const TG_BASE = () =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

async function send(text) {
  await fetch(`${TG_BASE()}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      chat_id:    process.env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML',
    }),
  })
}

function bkkTime() {
  return new Date().toLocaleString('th-TH', {
    timeZone:     'Asia/Bangkok',
    hour12:       false,
    day:    '2-digit', month: '2-digit', year: 'numeric',
    hour:   '2-digit', minute: '2-digit',
  })
}

function confBar(pct) {
  const filled = Math.round(pct / 10)
  return '█'.repeat(filled) + '░'.repeat(10 - filled)
}

// ── Signal alert (BUY / SELL) ────────────────────────────────
export async function sendSignalAlert(signal, claude) {
  const dir   = claude.final_direction
  const emoji = dir === 'BUY'  ? '🟢' : '🔴'
  const arrow = dir === 'BUY'  ? '📈' : '📉'
  const conf  = claude.confidence

  const confluenceList = (claude.confluences ?? [])
    .map(c => `  • ${c}`).join('\n')

  const missingList = (claude.missing ?? [])
    .map(m => `  • ${m}`).join('\n')

  const msg = `
${emoji} <b>XAUUSD ${dir} SIGNAL</b> ${arrow}
━━━━━━━━━━━━━━━━━━━━━

💰 <b>Entry:</b>  $${signal.price}
🛑 <b>SL:</b>     $${signal.sl}
🎯 <b>TP:</b>     $${signal.tp}
⚖️ <b>R:R:</b>    1:2  |  ATR: ${signal.atr}
📦 <b>Size:</b>   ${claude.position_size?.toUpperCase()}

📊 <b>Confidence:</b> ${conf}%
<code>${confBar(conf)}</code>
🏆 <b>SMC Grade:</b>   ${claude.smc_grade}

📐 <b>Key Levels:</b>
  H1  EMA200: $${signal.h1_ema200}
  H1  VWAP:   $${signal.h1_vwap}
  M15 EMA200: $${signal.m15_ema200}
  M5  EMA200: $${signal.m5_ema200}
  M5  VWAP:   $${signal.m5_vwap}

✅ <b>EMA200:</b> ${claude.ema200_alignment}
✅ <b>VWAP:</b>   ${claude.vwap_alignment}

🔍 <b>Confluences:</b>
${confluenceList || '  • None listed'}
${missingList ? `\n⚠️ <b>Missing:</b>\n${missingList}` : ''}

📰 <b>News:</b> ${claude.news_sentiment?.toUpperCase()} (${claude.news_impact} impact)

🤖 <b>Claude analysis:</b>
<i>${claude.reasoning}</i>
${claude.risk_warning ? `\n🚨 <b>Risk:</b> ${claude.risk_warning}` : ''}

🕐 ${bkkTime()}
━━━━━━━━━━━━━━━━━━━━━
⚠️ <i>Educational only. Manage risk always.</i>`.trim()

  await send(msg)
}

// ── News digest (sent when high-impact news detected) ────────
export async function sendNewsAlert(newsAnalysis, newsItems) {
  const headlines = newsItems.slice(0, 5)
    .map(n => `  • ${n.title}`)
    .join('\n')

  const riskEvents = (newsAnalysis.risk_events ?? [])
    .map(e => `  ⏰ ${e}`).join('\n')

  const emoji = newsAnalysis.sentiment === 'bullish' ? '🟡'
              : newsAnalysis.sentiment === 'bearish'  ? '🟠' : '⚪'

  const msg = `
${emoji} <b>XAUUSD News Alert</b>
━━━━━━━━━━━━━━━━━━━━━
📰 <b>Sentiment:</b> ${newsAnalysis.sentiment?.toUpperCase()} (${newsAnalysis.impact} impact)

<i>${newsAnalysis.summary}</i>

<b>Headlines:</b>
${headlines}
${riskEvents ? `\n<b>Upcoming risk events:</b>\n${riskEvents}` : ''}

🕐 ${bkkTime()}`.trim()

  await send(msg)
}

// ── Simple status ping ───────────────────────────────────────
export async function sendStatus(text) {
  await send(`ℹ️ <b>Bot Status</b>\n${text}\n🕐 ${bkkTime()}`)
}
