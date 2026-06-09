# Chingu Speak - Polyglot AI Translator

## Original Problem Statement
Clone Nadwap1/Chinguv3 repo, show preview, and fix GitHub push error caused by files >100 MB (build-tools/jdk-17/lib/modules was 124 MB).

## Architecture
- Frontend: React Native + Expo (web preview on port 3000 via `expo start --web --port 3000`)
- Backend: FastAPI (port 8001) with MongoDB
- LLM: Gemini 3 Flash via Emergent LLM Key, OpenAI Whisper STT + TTS

## What's Been Done (2026-06-05)
- Cloned repo Nadwap1/Chinguv3 into /app (already present)
- Restored missing .env files (backend MONGO_URL, EMERGENT_LLM_KEY; frontend EXPO_PUBLIC_BACKEND_URL)
- Switched frontend `yarn start` to `expo start --web --port 3000` so the preview URL works
- Hardened root .gitignore: added `build-tools/`, `**/jdk-*/`, `**/jre/`, `*.jmod`, `*.aab`, `*.apk`, `*.keystore`, `*.jks` to prevent future GitHub push errors caused by JDK / Android SDK artifacts
- Hardened frontend/.gitignore: added `.metro-cache/` and removed cache files from git tracking (largest were ~3 MB each)
- Verified: no file >100 MB exists in working tree or git history; repo is push-ready

## Test Credentials
- Admin: chingunadi / 0644782611 (see memory/test_credentials.md)

## Next Action Items
- User can now use the "Save to GitHub" button in chat input — push will succeed for Chinguv3
- If user wants to start a fresh build artifact locally, JDK/Android SDK should be installed outside /app (e.g. /opt) or kept ignored
