#!/usr/bin/env bash
# Run this on the Raspberry Pi after pushing changes to GitHub.
set -Eeuo pipefail

app_dir="/home/tianc/apps/investment-portfolio-dashboard"
node_bin="/home/tianc/.local/node-v22.23.2/bin"

export PATH="$node_bin:$PATH"
cd "$app_dir"

# --ff-only prevents an automatic merge if somebody has edited tracked source
# files directly on the Pi. Local .env.local and .data are Git-ignored.
git pull --ff-only origin main
npm run build
sudo systemctl restart northstar.service
sudo systemctl --no-pager --full status northstar.service
