#!/bin/bash
# ADWO 2.0 Orchestrator SessionStart Hook
set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
STATE_FILE="$PROJECT_DIR/_bmad/orchestrator-state.json"
AUTO_MODE_FILE="$PROJECT_DIR/.bmad/AUTO_MODE"

if [ -f "$STATE_FILE" ]; then
    PHASE=$(cat "$STATE_FILE" | jq -r '.phase // "idle"')
    CURRENT_EPIC=$(cat "$STATE_FILE" | jq -r '.current_epic // 1')
    CURRENT_STORY=$(cat "$STATE_FILE" | jq -r '.current_story // "none"')
    ACTIVE_AGENTS=$(cat "$STATE_FILE" | jq -r '.active_agents | length // 0')
    COMPLETED=$(cat "$STATE_FILE" | jq -r '.completed_stories | length // 0')
else
    PHASE="idle"; CURRENT_EPIC="1"; CURRENT_STORY="none"; ACTIVE_AGENTS="0"; COMPLETED="0"
fi

if [ -f "$AUTO_MODE_FILE" ] && grep -q "ENABLED" "$AUTO_MODE_FILE" 2>/dev/null; then
    AUTO_MODE="ENABLED"
else
    AUTO_MODE="DISABLED"
fi

read -r -d '' CONTEXT << 'RULES' || true
⛔⛔⛔ ADWO 2.0 ORCHESTRATOR - ABSOLUTE RULES ⛔⛔⛔

1️⃣ DU SCHREIBST NIEMALS CODE - Spawn Agent via Conduit bei Bugs
2️⃣ NUR CONDUIT CLI FÜR AGENTS - NICHT das Task tool
3️⃣ NIEMALS BASH SLEEP - Nutze: conduit terminal-wait -p <pane-id> -t 1800
4️⃣ AUTO-MODE AKTIV - NIEMALS AskUserQuestion, bei Roadblocks: SKIP + log + continue

PROJEKT: https://github.com/buri1/adwo-2 | Issues #1-#15
DOCS: docs/EPICS.md, docs/ORCHESTRATOR-HANDOFF.md
RULES

CONTEXT="$CONTEXT

STATE: Phase=$PHASE | Epic=$CURRENT_EPIC | Story=$CURRENT_STORY | Agents=$ACTIVE_AGENTS | Done=$COMPLETED | AUTO=$AUTO_MODE

Wenn Phase != idle: Prüfe Panes mit 'conduit pane-list' und setze Arbeit fort!"

ESCAPED_CONTEXT=$(echo "$CONTEXT" | jq -Rs .)
echo "{\"additionalContext\": $ESCAPED_CONTEXT}"
