# XAUUSD Signal Bot
**SMC + EMA200 + VWAP | H1 / M15 / M5 | Claude AI | Telegram**

---

## Project Structure

```
xauusd-bot/
├── src/
│   ├── main.js          ← Standalone bot (no TradingView needed)
│   ├── webhook.js       ← TradingView webhook receiver (recommended)
│   ├── strategy.js      ← SMC + EMA200 + VWAP signal engine
│   ├── indicators.js    ← EMA, RSI, MACD, ATR, BB, VWAP math
│   ├── analyzer.js      ← Claude AI (Haiku news + Sonnet signal)
│   ├── news-fetcher.js  ← RSS feeds (Reuters, Bloomberg, FF)
│   ├── price-feed.js    ← Yahoo Finance OHLCV
│   ├── notifier.js      ← Telegram alerts
│   └── test.js          ← System test
├── pine/
│   └── xauusd_strategy.pine  ← TradingView Pine Script
├── .env.example
├── deploy.sh
└── package.json
```

---

## Step 1 — Clone & Install (Mac Terminal)

```bash
git clone https://github.com/YOUR_USERNAME/xauusd-bot.git
cd xauusd-bot
npm install
cp .env.example .env
```

---

## Step 2 — Fill in .env

```bash
nano .env
```

Fill in:
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `TELEGRAM_BOT_TOKEN` — from @BotFather on Telegram
- `TELEGRAM_CHAT_ID` — from @userinfobot on Telegram

---

## Step 3 — Test Everything

```bash
node src/test.js
```

All 5 checks should be green. Check Telegram for the ping.

---

## Step 4 — Run (choose one mode)

### Mode A: Standalone (no TradingView)
```bash
npm start
# or with PM2:
pm2 start src/main.js --name xauusd-bot
```

### Mode B: TradingView Webhook (recommended)
```bash
npm run webhook
```
Then in TradingView:
1. Paste `pine/xauusd_strategy.pine` into Pine Editor
2. Add to chart (XAUUSD, M5 timeframe)
3. Create Alert → Webhook URL → `http://YOUR_SERVER:3000/webhook`
4. Message: `{{strategy.order.action}}` (Pine handles the JSON)

---

## Step 5 — Deploy to Cloud (24/7)

### Oracle Cloud Free Tier (Singapore region)
1. cloud.oracle.com → Create instance → Always Free → Ubuntu 22.04
2. Download SSH key

```bash
# On your Mac:
chmod 400 ~/Downloads/your-key.pem
ssh -i ~/Downloads/your-key.pem ubuntu@YOUR_SERVER_IP

# On the server:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
sudo npm install -g pm2
git clone https://github.com/YOUR_USERNAME/xauusd-bot.git
cd xauusd-bot && npm install
nano .env          # paste your keys
node src/test.js   # verify
pm2 start src/main.js --name xauusd-bot
pm2 startup && pm2 save
```

### Future deploys from Mac:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## How It Works

### Signal Logic
1. **H1 (Bias)** — Price must be above/below EMA200 + VWAP on H1
2. **M15 (Zone)** — OB or FVG on M15 with EMA200 + VWAP aligned
3. **M5 (Entry)** — CHoCH or sweep on M5 with indicators confirming
4. **Claude Haiku** — News sentiment check (every cycle, cheap)
5. **Claude Sonnet** — Deep signal validation with SMC grading
6. **Telegram** — Signal sent only if confidence ≥ 70%

### SMC Grades
| Grade | Confluences |
|-------|-------------|
| A+    | CHoCH + OB + FVG + Sweep + Discount/Premium |
| A     | CHoCH + OB + one of FVG/Sweep |
| B     | BOS + OB or FVG |
| C     | Single confluence — auto-rejected |

### Signals Per Day
- Expect 1–3 high-quality signals during London/NY session
- Bangkok session window: 14:00–22:00

---

## Monthly Cost Estimate

| Item | Cost |
|------|------|
| Claude API (Haiku + Sonnet hybrid) | ~$5–8/mo |
| Oracle Cloud VPS | Free |
| All data feeds | Free |
| Telegram | Free |
| TradingView Pro (optional) | $15/mo |
| **Total** | **$5–23/mo** |

---

## PM2 Commands (on server)

```bash
pm2 status                        # check running
pm2 logs xauusd-bot               # live logs
pm2 logs xauusd-bot --lines 50    # last 50 lines
pm2 restart xauusd-bot            # restart
pm2 monit                         # dashboard
```

---

## Manual Endpoints (webhook mode)

```bash
# Health check
curl http://YOUR_SERVER:3000/

# Force news analysis + Telegram alert
curl http://YOUR_SERVER:3000/news
```

---

⚠️ **This is for educational purposes. Always manage risk. Never risk more than you can afford to lose.**
