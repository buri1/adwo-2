#!/bin/bash
# ADWO 2.0 PreCompact Hook - Saves state before compaction
set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
STATE_FILE="$PROJECT_DIR/_bmad/orchestrator-state.json"

if [ ! -f "$STATE_FILE" ]; then
    mkdir -p "$(dirname "$STATE_FILE")"
    echo '{"phase":"implementation","current_epic":1,"current_story":"1.1","active_agents":[],"completed_stories":[]}' > "$STATE_FILE"
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TMP_FILE=$(mktemp)
jq --arg ts "$TIMESTAMP" '.last_compaction = $ts' "$STATE_FILE" > "$TMP_FILE" && mv "$TMP_FILE" "$STATE_FILE"

echo "{\"status\": \"state_saved\", \"timestamp\": \"$TIMESTAMP\"}"
