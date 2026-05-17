// ─────────────────────────────────────────────────────────────
// src/indicators.js
// Pure indicator math — EMA, RSI, MACD, ATR, BB, VWAP
// Used by strategy.js to score candle arrays
// ─────────────────────────────────────────────────────────────

export function calcEMA(closes, period) {
  const k = 2 / (period + 1)
  let ema  = closes[0]
  for (let i = 1; i < closes.length; i++)
    ema = closes[i] * k + ema * (1 - k)
  return ema
}

export function calcRSI(closes, period = 14) {
  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1]
    d >= 0 ? (gains += d) : (losses -= d)
  }
  let avgG = gains / period
  let avgL = losses / period
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    avgG = (avgG * (period - 1) + Math.max(d,  0)) / period
    avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period
  }
  return avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL)
}

export function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
  const ema12 = closes.map((_, i, a) => calcEMA(a.slice(0, i + 1), fast))
  const ema26 = closes.map((_, i, a) => calcEMA(a.slice(0, i + 1), slow))
  const macdSeries = ema12.map((v, i) => v - ema26[i])
  const signalLine = calcEMA(macdSeries, signal)
  const macdLine   = macdSeries.at(-1)
  return { macdLine, signalLine, histogram: macdLine - signalLine }
}

export function calcATR(highs, lows, closes, period = 14) {
  const tr = highs.map((h, i) => {
    if (i === 0) return h - lows[i]
    return Math.max(
      h - lows[i],
      Math.abs(h   - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    )
  })
  return tr.slice(-period).reduce((s, v) => s + v, 0) / period
}

export function calcBB(closes, period = 20, mult = 2) {
  const slice  = closes.slice(-period)
  const middle = slice.reduce((s, v) => s + v, 0) / period
  const std    = Math.sqrt(slice.reduce((s, v) => s + (v - middle) ** 2, 0) / period)
  return { upper: middle + mult * std, lower: middle - mult * std, middle }
}

// VWAP: cumulative (HLC/3 × volume) / cumulative volume
// Resets each day — pass only today's candles
export function calcVWAP(candles) {
  let cumPV  = 0
  let cumVol = 0
  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3
    cumPV  += typical * (c.volume || 1)
    cumVol += (c.volume || 1)
  }
  return cumPV / cumVol
}

// Filter candles to today only (for VWAP reset)
export function todayCandles(candles) {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  return candles.filter(c => c.time >= todayStart.getTime())
}
