#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "[Deploy] $(date) - Pulling latest changes..."
git pull origin main

echo "[Deploy] Installing dependencies..."
npm install --production

echo "[Deploy] Restarting app..."
pm2 restart ecosystem.config.js

echo "[Deploy] Done."
