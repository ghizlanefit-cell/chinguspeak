#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# preview-mode-on.sh
#
# Flip the workspace back into mock-preview mode AFTER you've pushed to GitHub.
# Companion of pre-push-cleanup.sh. Idempotent.
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

# ---- 1. Drop baseUrl so the preview serves at / ----------------------------
python3 - <<PY
import json, pathlib
p = pathlib.Path("$APP_JSON")
data = json.loads(p.read_text())
exp = data.setdefault("expo", {}).setdefault("experiments", {})
exp["typedRoutes"] = True
exp.pop("baseUrl", None)
p.write_text(json.dumps(data, indent=2) + "\n")
print("  app.json: experiments.baseUrl removed")
PY

# ---- 2. Turn MOCK_API on in .env -------------------------------------------
if [[ -f "$ENV_FILE" ]]; then
  if grep -q "^EXPO_PUBLIC_MOCK_API=" "$ENV_FILE"; then
    sed -i 's|^EXPO_PUBLIC_MOCK_API=.*|EXPO_PUBLIC_MOCK_API=1|' "$ENV_FILE"
  else
    echo "EXPO_PUBLIC_MOCK_API=1" >> "$ENV_FILE"
  fi
  echo "  .env: EXPO_PUBLIC_MOCK_API=1"
fi

echo ""
echo "Restart the preview to pick up the new bundle:"
echo "  sudo supervisorctl restart expo"
