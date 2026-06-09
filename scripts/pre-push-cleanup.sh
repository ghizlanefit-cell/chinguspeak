#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# pre-push-cleanup.sh
#
# Flip the Emergent web-preview workspace back to its production configuration
# BEFORE running "Save to GitHub". Run from anywhere:
#
#     bash /app/scripts/pre-push-cleanup.sh
#
# What this script does (idempotent):
#   1. Restores  experiments.baseUrl = "/mobile"  in chinguspeak-app/frontend/app.json
#      (required so the Hostinger /mobile/ subpath build works.)
#   2. Sets EXPO_PUBLIC_MOCK_API=0 in chinguspeak-app/frontend/.env
#      (cosmetic — .env is git-ignored, but keeps local builds prod-correct.)
#   3. Prints a summary so you can verify before clicking Save to GitHub.
#
# The mock harness files (src/api/mocks.ts, mock dispatcher in src/api/client.ts,
# MOCK_WEB guard in app/voice-screen.tsx) stay in place. They are dormant when
# EXPO_PUBLIC_MOCK_API is unset, so production behaviour is unaffected.
#
# To flip back to preview mode after a push, run:
#     bash /app/scripts/preview-mode-on.sh
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT="/app"
EXPO_DIR="${ROOT}/chinguspeak-app/frontend"
APP_JSON="${EXPO_DIR}/app.json"
ENV_FILE="${EXPO_DIR}/.env"

if [[ ! -f "$APP_JSON" ]]; then
  echo "ERROR: $APP_JSON not found." >&2
  exit 1
fi

# ---- 1. Restore baseUrl in app.json ----------------------------------------
python3 - <<PY
import json, sys, pathlib
p = pathlib.Path("$APP_JSON")
data = json.loads(p.read_text())
exp = data.setdefault("expo", {}).setdefault("experiments", {})
exp["typedRoutes"] = True
exp["baseUrl"] = "/mobile"
p.write_text(json.dumps(data, indent=2) + "\n")
print("  app.json: experiments.baseUrl = /mobile")
PY

# ---- 2. Flip MOCK_API off in .env ------------------------------------------
if [[ -f "$ENV_FILE" ]]; then
  if grep -q "^EXPO_PUBLIC_MOCK_API=" "$ENV_FILE"; then
    sed -i 's|^EXPO_PUBLIC_MOCK_API=.*|EXPO_PUBLIC_MOCK_API=0|' "$ENV_FILE"
    echo "  .env: EXPO_PUBLIC_MOCK_API set to 0"
  else
    echo "EXPO_PUBLIC_MOCK_API=0" >> "$ENV_FILE"
    echo "  .env: EXPO_PUBLIC_MOCK_API appended as 0"
  fi
else
  echo "  .env: not present (skipping)"
fi

# ---- 3. Summary -------------------------------------------------------------
echo ""
echo "Production-ready state:"
echo "------------------------------------------------------------------"
grep -E '"baseUrl"|"typedRoutes"' "$APP_JSON" | sed 's/^/  app.json| /'
echo "------------------------------------------------------------------"
if [[ -f "$ENV_FILE" ]]; then
  grep -E '^EXPO_PUBLIC_(MOCK_API|BACKEND_URL)=' "$ENV_FILE" | sed 's/^/  .env | /'
fi
echo "------------------------------------------------------------------"
echo ""
echo "Workspace is now production-clean."
echo "You can click  Save to GitHub  in the Emergent UI."
echo "After the push, run  bash /app/scripts/preview-mode-on.sh"
echo "to re-enable the mock preview locally."
