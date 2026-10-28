#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
trap 'echo "Build stopped. Read the error above."; read -r -p "Press Return to close."' ERR
missing=0
command -v node >/dev/null || { echo 'Missing Node.js 22.12 or later.'; missing=1; }
command -v npm >/dev/null || { echo 'Missing npm (included with Node.js).'; missing=1; }
xcrun --find swiftc >/dev/null 2>&1 || { echo 'Missing Xcode command line tools: run xcode-select --install'; missing=1; }
[ "$missing" = 0 ] || exit 1
npm ci --no-audit --no-fund
npm run typecheck
npm test
npm run package -- --mac
open release
