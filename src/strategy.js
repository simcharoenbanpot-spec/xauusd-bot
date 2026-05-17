// ─────────────────────────────────────────────────────────────
// src/strategy.js
// Full SMC + EMA200 + VWAP scoring across H1 / M15 / M5
// Used when bot runs standalone (no TradingView webhook)
// ─────────────────────────────────────────────────────────────
import {
  calcEMA, calcRSI, calcMACD, calcATR, calcBB, calcVWAP, todayCandles
} from './indicators.js'

// ── Swing high / low detection ───────────────────────────────
function swingHighs(candles, left = 5) {
  const result = []
  for (let i = left; i < candles.length - left; i++) {
    const pivot = candles[i].high
    const isHigh = candles.slice(i - left, i).every(c => c.high < pivot)
                && candles.slice(i + 1, i + left + 1).every(c => c.high < pivot)
    if (isHigh) result.push({ index: i, price: pivot })
  }
  return result
}

function swingLows(candles, left = 5) {
  const result = []
  for (let i = left; i < candles.length - left; i++) {
    const pivot = candles[i].low
    const isLow = candles.slice(i - left, i).every(c => c.low > pivot)
               && candles.slice(i + 1, i + left + 1).every(c => c.low > pivot)
    if (isLow) result.push({ index: i, price: pivot })
  }
  return result
}

// ── SMC: detect CHoCH + BOS ───────────────────────────────────
function detectStructure(candles, swingPeriod = 5) {
  const highs = swingHighs(candles, swingPeriod)
  const lows  = swingLows(candles,  swingPeriod)

  const lastHigh = highs.at(-1)?.price ?? null
  const lastLow  = lows.at(-1)?.price  ?? null
  const price    = candles.at(-1).close

  const bosUp   = lastHigh && price > lastHigh
  const bosDown = lastLow  && price < lastLow

  // CHoCH = BOS against the prior trend
  const prevHigh = highs.at(-2)?.price ?? null
  const prevLow  = lows.at(-2)?.price  ?? null
  const wasBull  = prevHigh && prevLow && prevHigh > highs.at(-3)?.price
  const wasBear  = prevHigh && prevLow && prevLow  < lows.at(-3)?.price

  return {
    lastHigh, lastLow, bosUp, bosDown,
    chochBull: wasBear && bosUp,
    chochBear: wasBull && bosDown,
  }
}

// ── SMC: Order Block ─────────────────────────────────────────
function detectOrderBlock(candles) {
  const len = candles.length
  if (len < 3) return { bullOB: false, bearOB: false, obTop: null, obBot: null }

  const prev  = candles[len - 2]
  const curr  = candles[len - 1]

  // Bullish OB: previous candle was bearish, current engulfs it upward
  const bullOB = prev.close < prev.open && curr.close > prev.high
  // Bearish OB: previous candle was bullish, current engulfs it downward
  const bearOB = prev.close > prev.open && curr.close < prev.low

  return {
    bullOB,
    bearOB,
    obTop: bullOB || bearOB ? prev.high : null,
    obBot: bullOB || bearOB ? prev.low  : null,
  }
}

// ── SMC: Fair Value Gap ──────────────────────────────────────
function detectFVG(candles) {
  const len = candles.length
  if (len < 3) return { bullFVG: false, bearFVG: false }
  const c0 = candles[len - 1]
  const c2 = candles[len - 3]
  return {
    bullFVG: c0.low  > c2.high,   // gap up
    bearFVG: c0.high < c2.low,    // gap down
  }
}

// ── SMC: Liquidity Sweep ─────────────────────────────────────
function detectLiqSweep(candles, lookback = 10) {
  const recent  = candles.slice(-lookback - 1, -1)
  const current = candles.at(-1)
  const rHigh   = Math.max(...recent.map(c => c.high))
  const rLow    = Math.min(...recent.map(c => c.low))

  return {
    sweepHigh: current.high > rHigh && current.close < rHigh,
    sweepLow:  current.low  < rLow  && current.close > rLow,
    recentHigh: rHigh,
    recentLow:  rLow,
  }
}

// ── Session filter (Bangkok UTC+7) ───────────────────────────
function inTradingSession() {
  const startHour = parseInt(process.env.SESSION_START_HOUR ?? '14')
  const endHour   = parseInt(process.env.SESSION_END_HOUR   ?? '22')
  const bkkHour   = (new Date().getUTCHours() + 7) % 24
  return bkkHour >= startHour && bkkHour < endHour
}

// ── MAIN: score all three timeframes ────────────────────────
// candles = { h1: [...], m15: [...], m5: [...] }
export function calculateSignals({ h1, m15, m5 }) {

  // ── H1 layer ─────────────────────────────────────────────
  const h1_closes  = h1.map(c => c.close)
  const h1_ema200  = calcEMA(h1_closes, 200)
  const h1_ema50   = calcEMA(h1_closes, 50)
  const h1_vwap    = calcVWAP(todayCandles(h1))
  const h1_struct  = detectStructure(h1, 5)
  const h1_ob      = detectOrderBlock(h1)
  const h1_fvg     = detectFVG(h1)
  const h1_price   = h1.at(-1).close
  const h1_mid     = (h1_struct.lastHigh + h1_struct.lastLow) / 2
  const h1_discount = h1_price < h1_mid
  const h1_premium  = h1_price > h1_mid
  const h1_aboveEMA200 = h1_price > h1_ema200
  const h1_aboveVWAP   = h1_price > h1_vwap

  // ── M15 layer ────────────────────────────────────────────
  const m15_closes  = m15.map(c => c.close)
  const m15_ema200  = calcEMA(m15_closes, 200)
  const m15_vwap    = calcVWAP(todayCandles(m15))
  const m15_struct  = detectStructure(m15, 4)
  const m15_ob      = detectOrderBlock(m15)
  const m15_fvg     = detectFVG(m15)
  const m15_sweep   = detectLiqSweep(m15, 10)
  const m15_price   = m15.at(-1).close
  const m15_aboveEMA200 = m15_price > m15_ema200
  const m15_aboveVWAP   = m15_price > m15_vwap
  const m15_vwapBullBounce = m15.at(-2)?.low < m15_vwap && m15_price > m15_vwap
  const m15_vwapBearBounce = m15.at(-2)?.high > m15_vwap && m15_price < m15_vwap

  // ── M5 layer ─────────────────────────────────────────────
  const m5_closes  = m5.map(c => c.close)
  const m5_highs   = m5.map(c => c.high)
  const m5_lows    = m5.map(c => c.low)
  const m5_ema9    = calcEMA(m5_closes, 9)
  const m5_ema21   = calcEMA(m5_closes, 21)
  const m5_ema200  = calcEMA(m5_closes, 200)
  const m5_vwap    = calcVWAP(todayCandles(m5))
  const m5_rsi     = calcRSI(m5_closes, 14)
  const { macdLine, signalLine, histogram } = calcMACD(m5_closes)
  const m5_atr     = calcATR(m5_highs, m5_lows, m5_closes, 14)
  const m5_struct  = detectStructure(m5, 3)
  const m5_sweep   = detectLiqSweep(m5, 8)
  const m5_price   = m5.at(-1).close
  const m5_aboveEMA200 = m5_price > m5_ema200
  const m5_aboveVWAP   = m5_price > m5_vwap
  const m5_vwapBull    = m5.at(-2)?.low < m5_vwap && m5_price > m5_vwap
  const m5_vwapBear    = m5.at(-2)?.high > m5_vwap && m5_price < m5_vwap
  const m5_emaBull     = m5_ema9 > m5_ema21
  const m5_emaBear     = m5_ema9 < m5_ema21
  const inSession      = inTradingSession()

  // ── BUY confluence ───────────────────────────────────────
  const buyConditions = {
    h1_aboveEMA200,
    h1_aboveVWAP,
    h1_smcOk:    h1_struct.chochBull || h1_ob.bullOB || h1_fvg.bullFVG,
    h1_discount,
    m15_aboveEMA200,
    m15_vwapOk:  m15_aboveVWAP || m15_vwapBullBounce,
    m15_smcOk:   m15_ob.bullOB || m15_fvg.bullFVG || m15_sweep.sweepLow,
    m5_chochOrSweep: m5_struct.chochBull || m5_sweep.sweepLow,
    m5_aboveEMA200,
    m5_vwapOk:   m5_aboveVWAP || m5_vwapBull,
    m5_emaBull,
    m5_rsiOk:    m5_rsi > 45 && m5_rsi < 72,
    m5_macdBull: histogram > 0,
    inSession,
  }

  // ── SELL confluence ──────────────────────────────────────
  const sellConditions = {
    h1_belowEMA200:  !h1_aboveEMA200,
    h1_belowVWAP:    !h1_aboveVWAP,
    h1_smcOk:        h1_struct.chochBear || h1_ob.bearOB || h1_fvg.bearFVG,
    h1_premium,
    m15_belowEMA200: !m15_aboveEMA200,
    m15_vwapOk:      !m15_aboveVWAP || m15_vwapBearBounce,
    m15_smcOk:       m15_ob.bearOB || m15_fvg.bearFVG || m15_sweep.sweepHigh,
    m5_chochOrSweep: m5_struct.chochBear || m5_sweep.sweepHigh,
    m5_belowEMA200:  !m5_aboveEMA200,
    m5_vwapOk:       !m5_aboveVWAP || m5_vwapBear,
    m5_emaBear,
    m5_rsiOk:        m5_rsi < 55 && m5_rsi > 28,
    m5_macdBear:     histogram < 0,
    inSession,
  }

  const buyScore  = Object.values(buyConditions).filter(Boolean).length
  const sellScore = Object.values(sellConditions).filter(Boolean).length
  const total     = Object.keys(buyConditions).length  // 14

  // Need at least 11/14 conditions for a valid signal
  let direction   = 'WAIT'
  let confidence  = 0

  if (buyScore >= 11 && buyScore > sellScore) {
    direction  = 'BUY'
    confidence = Math.round((buyScore / total) * 100)
  } else if (sellScore >= 11 && sellScore > buyScore) {
    direction  = 'SELL'
    confidence = Math.round((sellScore / total) * 100)
  }

  // SL/TP — place SL below/above M15 OB if present, else 1.5× ATR
  const slBuy  = m15_ob.bullOB
    ? m15_ob.obBot - m5_atr * 0.3
    : m5_price - m5_atr * 1.5
  const tpBuy  = m5_price + (m5_price - slBuy) * 2.0

  const slSell = m15_ob.bearOB
    ? m15_ob.obTop + m5_atr * 0.3
    : m5_price + m5_atr * 1.5
  const tpSell = m5_price - (slSell - m5_price) * 2.0

  return {
    direction, confidence,
    price:    +m5_price.toFixed(2),
    sl:       direction === 'BUY'  ? +slBuy.toFixed(2)  : +slSell.toFixed(2),
    tp:       direction === 'BUY'  ? +tpBuy.toFixed(2)  : +tpSell.toFixed(2),
    atr:      +m5_atr.toFixed(2),
    strategy: 'H1-M15-M5-EMA200-VWAP',

    // Full context for Claude prompt
    h1_ema200:      +h1_ema200.toFixed(2),
    h1_vwap:        +h1_vwap.toFixed(2),
    h1_aboveEMA200, h1_aboveVWAP,
    h1_choch:       h1_struct.chochBull || h1_struct.chochBear,
    h1_ob:          h1_ob.bullOB || h1_ob.bearOB,
    h1_fvg:         h1_fvg.bullFVG || h1_fvg.bearFVG,
    h1_discount, h1_premium,

    m15_ema200:      +m15_ema200.toFixed(2),
    m15_vwap:        +m15_vwap.toFixed(2),
    m15_aboveEMA200, m15_aboveVWAP,
    m15_ob:          m15_ob.bullOB || m15_ob.bearOB,
    m15_fvg:         m15_fvg.bullFVG || m15_fvg.bearFVG,
    m15_sweep:       m15_sweep.sweepLow || m15_sweep.sweepHigh,

    m5_ema200:   +m5_ema200.toFixed(2),
    m5_vwap:     +m5_vwap.toFixed(2),
    m5_aboveEMA200, m5_aboveVWAP,
    m5_rsi:      +m5_rsi.toFixed(1),
    m5_macdBull: histogram > 0,
    m5_emaBull, m5_emaBear,
    m5_choch:    m5_struct.chochBull || m5_struct.chochBear,
    m5_sweep:    m5_sweep.sweepLow || m5_sweep.sweepHigh,
    inSession,
    buyScore, sellScore, total,
  }
}
