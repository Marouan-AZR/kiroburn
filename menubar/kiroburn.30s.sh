#!/bin/bash
# <swiftbar.hideAbout>true</swiftbar.hideAbout>
# <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>
# <swiftbar.hideDisablePlugin>true</swiftbar.hideDisablePlugin>

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
KIROBURN="$HOME/Documents/kiroburn/dist/cli.js"

# Get today's data
TODAY=$(node "$KIROBURN" report -p today --format json 2>/dev/null)
WEEK=$(node "$KIROBURN" report -p 7days --format json 2>/dev/null)

TODAY_COST=$(echo "$TODAY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"\${d['overview']['totalCost']:.2f}\")" 2>/dev/null || echo "\$0.00")
WEEK_COST=$(echo "$WEEK" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"\${d['overview']['totalCost']:.2f}\")" 2>/dev/null || echo "\$0.00")
TODAY_SESSIONS=$(echo "$TODAY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['overview']['totalSessions'])" 2>/dev/null || echo "0")
WEEK_SESSIONS=$(echo "$WEEK" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['overview']['totalSessions'])" 2>/dev/null || echo "0")
TODAY_TOOLS=$(echo "$TODAY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['overview']['totalToolUses'])" 2>/dev/null || echo "0")

# Menu bar title
echo "🔥 $TODAY_COST"
echo "---"
echo "KiroBurn — Kiro CLI Cost Tracker | size=14"
echo "---"
echo "Today: $TODAY_COST ($TODAY_SESSIONS sessions, $TODAY_TOOLS tools) | font=Menlo"
echo "7 Days: $WEEK_COST ($WEEK_SESSIONS sessions) | font=Menlo"
echo "---"

# Daily breakdown from week data
echo "📊 Daily | size=13"
echo "$WEEK" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    for day in d['daily'][-7:]:
        print(f\"  {day['date']}: \${day['cost']:.2f} ({day['sessions']}s) | font=Menlo\")
except: pass
" 2>/dev/null

echo "---"
echo "Open Dashboard | bash=node param1=$KIROBURN terminal=true"
echo "Refresh | refresh=true"
