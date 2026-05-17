#!/bin/bash
# ─────────────────────────────────────────────────────────────
# deploy.sh — Run on your Mac to push updates to cloud server
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
# ─────────────────────────────────────────────────────────────

KEY="$HOME/Downloads/your-key.pem"      # ← change to your key path
SERVER="ubuntu@YOUR_SERVER_IP"          # ← change to your server IP
REMOTE_DIR="~/xauusd-bot"

echo "🚀 Deploying XAUUSD bot to cloud server..."

# Push latest code
git add .
git commit -m "deploy $(date '+%Y-%m-%d %H:%M')" --allow-empty
git push

# Pull on server, install deps, restart bot
ssh -i "$KEY" "$SERVER" << 'EOF'
  cd ~/xauusd-bot
  git pull
  npm install --omit=dev
  pm2 restart xauusd-bot 2>/dev/null || pm2 start src/main.js --name xauusd-bot
  pm2 save
  echo "✅ Bot restarted"
  pm2 logs xauusd-bot --lines 10 --nostream
EOF

echo "✅ Deploy complete!"
