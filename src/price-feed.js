export async function getXAUUSDPrice() {
  const res  = await fetch('https://data-asg.goldprice.org/dbXRates/USD')
  const data = await res.json()
  const price = data.items[0].xauPrice
  return {
    price,
    prevClose: price,
    change:    '0.00',
    high:      price,
    low:       price,
  }
}

export async function getXAUUSDCandles(interval = '5m', count = 150) {
  const res  = await fetch('https://data-asg.goldprice.org/dbXRates/USD')
  const data = await res.json()
  const price = data.items[0].xauPrice
  const now   = Date.now()
  const candles = Array.from({length: count}, (_, i) => ({
    time:   now - (count - i) * 5 * 60 * 1000,
    open:   price,
    high:   price * 1.001,
    low:    price * 0.999,
    close:  price,
    volume: 1000,
  }))
  return candles
}
