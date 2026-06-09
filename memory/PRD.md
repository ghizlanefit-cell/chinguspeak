# Chingu Speak — Mobile App PRD (session bootstrap)

## Context
- Repo cloned: https://github.com/ghizlanefit-cell/chinguspeak
- Mobile Expo app: `chinguspeak-app/frontend` → copied into `/app/frontend`
- Backend FastAPI: `chinguspeak-app/backend` → copied into `/app/backend`
- Web admin (React, not in scope this session): `/frontend` in the repo (skipped)

## Stack
- Expo SDK 54 (`expo@~54.0.35`), React 19.1, RN 0.81.5
- expo-router 6, react-native-reanimated 4 + worklets 0.5
- expo-audio, expo-image-picker, expo-camera, expo-secure-store, async-storage
- FastAPI backend with admin endpoints (seeded admin: `chingunadi`)

## Boot Fix Applied
- Removed `experiments.baseUrl: "/mobile"` from `app.json` so the exported web bundle
  is served correctly at `/` in the Emergent preview (previously the index referenced
  `/mobile/_expo/...` assets that returned 404, manifesting as a white screen).

## Preserved
- `/app/frontend/.env` (EXPO_PACKAGER_PROXY_URL / EXPO_PACKAGER_HOSTNAME / EXPO_PUBLIC_BACKEND_URL)
- `/app/backend/.env` (MONGO_URL, DB_NAME)

## Known Non-Blocking
- API client uses `window.location.origin` on web → calls hit the local Emergent
  backend instead of the Hostinger production backend. Endpoints not implemented
  locally (e.g. `/api/public/settings`) return 404 but the UI tolerates this.

## Next
- Optional: switch web API base to Hostinger (or keep local for dev iteration).
- Continue UI/feature iteration as user requests.
