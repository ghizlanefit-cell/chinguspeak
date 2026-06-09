"""
Mobile-app endpoints for ChinguSpeak.
These endpoints are consumed by the Expo mobile app (and the embedded Expo web preview).
They dynamically read the active LLM key configured by the admin in the admin panel.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List
import os
import uuid
import base64
import json
import tempfile
import logging
import requests
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt as jwt_lib

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from emergentintegrations.llm.openai.text_to_speech import OpenAITextToSpeech
from emergentintegrations.llm.openai.speech_to_text import OpenAISpeechToText

logger = logging.getLogger("chingu-mobile")

mobile_router = APIRouter(prefix="/api")
public_router = APIRouter(prefix="/api/public")
user_bearer = HTTPBearer(auto_error=False)

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
USER_TTL_DAYS = 30

# --------------- Active LLM resolution from admin DB --------------- #
async def resolve_active_llm(db) -> Dict[str, str]:
    """Return {provider, model, api_key} based on the admin's active selection."""
    setting = await db.settings.find_one({"key": "active_llm_provider"}, {"_id": 0})
    desired_provider = setting["value"] if setting else "emergent"

    # Try to find the active key for the desired provider
    key = await db.llm_keys.find_one({"provider": desired_provider, "is_active": True}, {"_id": 0})
    if not key:
        # Fallback: any active key
        key = await db.llm_keys.find_one({"is_active": True}, {"_id": 0})

    if key and key.get("api_key"):
        provider = key["provider"]
        api_key = key["api_key"]
        model = key.get("model") or _default_model_for(provider)
        # The 'emergent' provider is a wrapper — it maps to gemini under the hood for litellm
        litellm_provider = "gemini" if provider == "emergent" else provider
        return {"provider": litellm_provider, "model": model, "api_key": api_key, "label": key.get("label", "")}

    # Last resort fallback — Emergent universal key
    if EMERGENT_LLM_KEY:
        return {"provider": "gemini", "model": "gemini-3-flash-preview", "api_key": EMERGENT_LLM_KEY, "label": "Emergent fallback"}

    raise HTTPException(status_code=503, detail="No LLM key is configured by the admin. Open the admin panel → LLM & APIs and add a key.")


def _default_model_for(provider: str) -> str:
    return {
        "openai": "gpt-5.4",
        "anthropic": "claude-sonnet-4-6",
        "gemini": "gemini-3-flash-preview",
        "emergent": "gemini-3-flash-preview",
    }.get(provider, "gpt-5.4")


async def get_chat(db, session_id: str, system_message: str) -> LlmChat:
    cfg = await resolve_active_llm(db)
    return LlmChat(
        api_key=cfg["api_key"],
        session_id=session_id,
        system_message=system_message,
    ).with_model(cfg["provider"], cfg["model"])


# --------------- Pydantic models --------------- #
class TranslateRequest(BaseModel):
    text: str
    source_lang: str = "auto"
    target_lang: str = "en"
    app_locale: Optional[str] = None

class TranslateResponse(BaseModel):
    id: str
    source_text: str
    translated_text: str
    source_lang: str
    target_lang: str
    detected_source: Optional[str] = None
    credits: Optional[int] = None

class ImageTranslateRequest(BaseModel):
    image_base64: str
    target_lang: str = "en"
    app_locale: Optional[str] = None

class ImageTranslateResponse(BaseModel):
    id: str
    extracted_text: str
    translated_text: str
    target_lang: str
    credits: Optional[int] = None

class TranscribeRequest(BaseModel):
    audio_base64: str
    mime_type: str = "audio/m4a"
    language: Optional[str] = None
    app_locale: Optional[str] = None

class TranscribeResponse(BaseModel):
    text: str
    language: Optional[str] = None
    credits: Optional[int] = None

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None
    target_lang: Optional[str] = None
    speed: float = 1.0
    app_locale: Optional[str] = None

class TTSResponse(BaseModel):
    audio_base64: str
    mime: str = "audio/mpeg"
    credits: Optional[int] = None

class ChatRequest(BaseModel):
    session_id: str
    message: str
    practice_lang: Optional[str] = None
    teach_style: Optional[str] = "playful"
    app_locale: Optional[str] = None

class ChatResponse(BaseModel):
    session_id: str
    reply: str
    credits: Optional[int] = None


class CreditsRewardIn(BaseModel):
    source: str = "admob_rewarded"
    ad_unit_id: Optional[str] = None
    reward_amount: int = 5


class SubscriptionVerifyIn(BaseModel):
    product_id: str
    purchase_token: str
    package_name: Optional[str] = None


class ModuleContentIn(BaseModel):
    module: str
    topic: Optional[str] = "daily conversation"
    level: Optional[str] = "beginner"
    app_locale: Optional[str] = "en"
    target_lang: Optional[str] = None

class HistoryCreate(BaseModel):
    kind: str
    source_text: str
    translated_text: str
    source_lang: str
    target_lang: str

class HistoryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    kind: str
    source_text: str
    translated_text: str
    source_lang: str
    target_lang: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    favorite: bool = False
    user_id: Optional[str] = None

class UserRegister(BaseModel):
    email: str
    password: str
    name: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str


# --------------- User-auth helpers --------------- #
def _create_user_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id, "email": email, "scope": "user",
        "exp": datetime.now(timezone.utc) + timedelta(days=USER_TTL_DAYS),
    }
    return jwt_lib.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

async def get_optional_user(db, creds: Optional[HTTPAuthorizationCredentials]) -> Optional[Dict[str, Any]]:
    if not creds:
        return None
    try:
        payload = jwt_lib.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt_lib.PyJWTError:
        return None
    if payload.get("scope") != "user":
        return None
    return await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})


async def _ensure_user_credit_defaults(db, user: Dict[str, Any]) -> Dict[str, Any]:
    if user is None:
        return user
    if "credits" not in user:
        user["credits"] = 50
        await db.users.update_one({"id": user["id"]}, {"$set": {"credits": 50}})
    if "is_pro" not in user:
        user["is_pro"] = False
    return user


async def consume_credit_or_402(db, user: Optional[Dict[str, Any]], action: str) -> Optional[int]:
    if not user:
        return None
    user = await _ensure_user_credit_defaults(db, user)
    if user.get("is_pro"):
        return int(user.get("credits", 0))

    current = int(user.get("credits", 0))
    if current <= 0:
        raise HTTPException(status_code=402, detail="No credits left. Watch rewarded ad or upgrade to Pro.")

    new_balance = current - 1
    await db.users.update_one({"id": user["id"]}, {"$set": {"credits": new_balance}})
    await db.credit_events.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "action_type": action,
        "amount": -1,
        "balance_after": new_balance,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return new_balance


async def add_reward_credits(db, user_id: str, amount: int, source: str, ad_unit_id: Optional[str]) -> int:
    doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    current = int(doc.get("credits", 50))
    new_balance = current + max(1, amount)
    await db.users.update_one({"id": user_id}, {"$set": {"credits": new_balance}})
    await db.credit_events.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "action_type": "rewarded_ad",
        "amount": max(1, amount),
        "balance_after": new_balance,
        "meta": {"source": source, "ad_unit_id": ad_unit_id},
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return new_balance


def _streak_reward(days: int, base: int = 5, max_bonus: int = 5) -> int:
    streak_days = max(1, int(days or 1))
    return int(base) + min(max(0, streak_days - 1), int(max_bonus))


# --------------- Lang helpers --------------- #
async def lang_name(db, code: str) -> str:
    if not code or code == "auto":
        return "auto-detect"
    doc = await db.languages.find_one({"code": code}, {"_id": 0})
    return doc["name"] if doc else code

async def lang_voice(db, code: str) -> str:
    doc = await db.languages.find_one({"code": code}, {"_id": 0})
    return (doc.get("tts_voice") if doc else None) or "nova"


# ===================================================================
# Public endpoints (no auth) — for the mobile app to fetch config
# ===================================================================
def register_public_routes(app, db):
    @public_router.get("/active-llm")
    async def public_active_llm():
        cfg = await resolve_active_llm(db)
        return {"provider": cfg["provider"], "model": cfg["model"], "label": cfg.get("label", "")}

    @public_router.get("/languages")
    async def public_languages():
        rows = await db.languages.find({"is_active": True}, {"_id": 0}).to_list(500)
        return {"languages": rows}

    @public_router.get("/scenarios")
    async def public_scenarios():
        rows = await db.scenarios.find({"is_active": True}, {"_id": 0}).sort("created_at", -1).to_list(500)
        return {"scenarios": rows}

    @public_router.get("/active-style")
    async def public_active_style():
        s = await db.styles.find_one({"is_active": True}, {"_id": 0})
        return {"style": s}

    @public_router.get("/settings")
    async def public_settings():
        rows = await db.settings.find(
            {"key": {"$in": [
                "app_name",
                "welcome_message",
                "maintenance_mode",
                "free_tier_daily_limit",
                "admob_android_app_id",
                "admob_rewarded_ad_unit_id",
                "google_play_subscription_product_id",
                "google_play_package_name",
            ]}},
            {"_id": 0}
        ).to_list(50)
        return {"items": rows}

    app.include_router(public_router)


# ===================================================================
# Mobile-app endpoints (used by Expo)
# ===================================================================
def register_mobile_routes(app, db):

    @mobile_router.get("/ping")
    async def ping():
        return {"status": "ok", "service": "chingu-speak", "ts": datetime.now(timezone.utc).isoformat()}

    # ---------- Translate ----------
    @mobile_router.post("/translate", response_model=TranslateResponse)
    async def translate(req: TranslateRequest, creds: HTTPAuthorizationCredentials = Depends(user_bearer)):
        user = await get_optional_user(db, creds)
        credits_left = await consume_credit_or_402(db, user, "translate_text")
        if not req.text.strip():
            raise HTTPException(status_code=400, detail="Text is empty")
        target = await lang_name(db, req.target_lang)
        source = await lang_name(db, req.source_lang)
        system = (
            "You are a world-class translator. Respond ONLY with strict JSON in the form "
            '{"translated_text": "<translation>", "detected_source_lang": "<ISO code>"}. '
            "No code fences, no commentary. Preserve names, numbers, line breaks. "
            "If the target is Moroccan Arabic (Darija), use authentic Darija with Arabic script."
        )
        prompt = f"Translate the following text from {source} to {target}.\n\nTEXT:\n{req.text}\n\nOutput JSON only."
        chat = await get_chat(db, f"translate-{uuid.uuid4()}", system)
        try:
            result = await chat.send_message(UserMessage(text=prompt))
        except Exception as e:
            logger.exception("Translate failed")
            raise HTTPException(status_code=500, detail=f"Translation failed: {e}")

        translated, detected = req.text, req.source_lang
        try:
            raw = result.strip()
            if raw.startswith("```"):
                raw = raw.strip("`")
                if raw.lower().startswith("json"):
                    raw = raw[4:]
            data = json.loads(raw)
            translated = data.get("translated_text", result).strip()
            detected = data.get("detected_source_lang", req.source_lang)
        except Exception:
            translated = result.strip()

        return TranslateResponse(
            id=str(uuid.uuid4()),
            source_text=req.text,
            translated_text=translated,
            source_lang=req.source_lang,
            target_lang=req.target_lang,
            detected_source=detected,
            credits=credits_left,
        )

    # ---------- Translate image (OCR + translate) ----------
    @mobile_router.post("/translate-image", response_model=ImageTranslateResponse)
    async def translate_image(req: ImageTranslateRequest, creds: HTTPAuthorizationCredentials = Depends(user_bearer)):
        user = await get_optional_user(db, creds)
        credits_left = await consume_credit_or_402(db, user, "translate_image")
        if not req.image_base64:
            raise HTTPException(status_code=400, detail="image_base64 is required")
        target = await lang_name(db, req.target_lang)
        system = (
            "You are an OCR + translation engine. Look at the image, read ALL visible text, "
            "then translate it. Respond ONLY with strict JSON in the form "
            '{"extracted_text": "<original text>", "translated_text": "<translation>"}. '
            "No code fences, no commentary. If no text is visible, set both fields to empty strings."
        )
        prompt = f"Extract all text from this image, then translate the extracted text into {target}. Return JSON only."
        chat = await get_chat(db, f"img-translate-{uuid.uuid4()}", system)
        try:
            result = await chat.send_message(UserMessage(text=prompt, file_contents=[ImageContent(image_base64=req.image_base64)]))
        except Exception as e:
            logger.exception("Image translate failed")
            raise HTTPException(status_code=500, detail=f"Image translation failed: {e}")

        extracted, translated = "", ""
        try:
            raw = result.strip()
            if raw.startswith("```"):
                raw = raw.strip("`")
                if raw.lower().startswith("json"):
                    raw = raw[4:]
            data = json.loads(raw)
            extracted = data.get("extracted_text", "").strip()
            translated = data.get("translated_text", "").strip()
        except Exception:
            translated = result.strip()

        return ImageTranslateResponse(
            id=str(uuid.uuid4()),
            extracted_text=extracted,
            translated_text=translated,
            target_lang=req.target_lang,
            credits=credits_left,
        )

    # ---------- Transcribe (Deepgram Nova-2 STT) ----------
    @mobile_router.post("/transcribe", response_model=TranscribeResponse)
    async def transcribe(req: TranscribeRequest, creds: HTTPAuthorizationCredentials = Depends(user_bearer)):
        user = await get_optional_user(db, creds)
        credits_left = int(user.get("credits", 50)) if user else None
        if not req.audio_base64:
            raise HTTPException(status_code=400, detail="audio_base64 is required")
        try:
            audio_bytes = base64.b64decode(req.audio_base64)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 audio")

        key_row = await db.settings.find_one({"key": "deepgram_api_key"}, {"_id": 0, "value": 1})
        deepgram_key = str((key_row or {}).get("value") or "").strip() or "f23edcb41a01bf47c3f55b54749b2fbdace96054"
        model_row = await db.settings.find_one({"key": "deepgram_stt_model"}, {"_id": 0, "value": 1})
        deepgram_model = str((model_row or {}).get("value") or "nova-2")

        params = [f"model={deepgram_model}", "smart_format=true", "punctuate=true"]
        if req.language and req.language != "auto":
            params.append(f"language={req.language.split('-')[0]}")

        try:
            r = requests.post(
                f"https://api.deepgram.com/v1/listen?{'&'.join(params)}",
                headers={
                    "Authorization": f"Token {deepgram_key}",
                    "Content-Type": req.mime_type,
                },
                data=audio_bytes,
                timeout=90,
            )
            if r.status_code >= 400:
                msg = r.text
                try:
                    j = r.json()
                    msg = j.get("err_msg") or j.get("error") or msg
                except Exception:
                    pass
                raise HTTPException(status_code=502, detail=f"Deepgram transcription failed: {msg}")

            payload = r.json()
            text = (
                ((payload.get("results") or {}).get("channels") or [{}])[0]
                .get("alternatives", [{}])[0]
                .get("transcript", "")
            )
            return TranscribeResponse(text=str(text).strip(), language=req.language, credits=credits_left)
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Deepgram transcribe failed")
            raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")

    # ---------- TTS ----------
    @mobile_router.post("/tts", response_model=TTSResponse)
    async def tts_route(req: TTSRequest, creds: HTTPAuthorizationCredentials = Depends(user_bearer)):
        user = await get_optional_user(db, creds)
        credits_left = int(user.get("credits", 50)) if user else None
        if not req.text.strip():
            raise HTTPException(status_code=400, detail="Text is empty")
        voice = req.voice
        if not voice and req.target_lang:
            voice = await lang_voice(db, req.target_lang)
        voice = voice or "nova"

        cfg = await resolve_active_llm(db)
        tts_key = cfg["api_key"] if cfg["provider"] == "openai" else EMERGENT_LLM_KEY
        if not tts_key:
            raise HTTPException(status_code=503, detail="No OpenAI/Emergent key available for TTS")
        try:
            tts = OpenAITextToSpeech(api_key=tts_key)
            audio_b64 = await tts.generate_speech_base64(
                text=req.text[:4000], model="tts-1", voice=voice, speed=req.speed, response_format="mp3",
            )
            return TTSResponse(audio_base64=audio_b64, mime="audio/mpeg", credits=credits_left)
        except Exception as e:
            logger.exception("TTS failed")
            raise HTTPException(status_code=500, detail=f"TTS failed: {e}")

    # ---------- Chat ----------
    @mobile_router.post("/chat", response_model=ChatResponse)
    async def chat_endpoint(req: ChatRequest, creds: HTTPAuthorizationCredentials = Depends(user_bearer)):
        user = await get_optional_user(db, creds)
        credits_left = await consume_credit_or_402(db, user, "chat_message")
        if not req.message.strip():
            raise HTTPException(status_code=400, detail="Message is empty")
        history_doc = await db.chat_sessions.find_one({"session_id": req.session_id}, {"_id": 0})
        messages = history_doc.get("messages", []) if history_doc else []

        practice = await lang_name(db, req.practice_lang) if req.practice_lang else None
        system = (
            "You are Chingu — a warm, hilarious, sharp-witted AI translation friend. "
            "Chingu means 'friend' in Korean. You help users learn languages naturally through chat. "
            "You speak like a fun bestie: punchy lines, playful jokes, emoji sprinkled, never robotic. "
            "Keep replies short (1–4 sentences) unless asked for more."
        )
        if practice:
            system += (f" The user is practicing {practice}. Reply primarily in {practice} with a short English hint in parentheses after tricky words.")

        chat = await get_chat(db, req.session_id, system)
        context_str = ""
        for m in messages[-10:]:
            role = "User" if m["role"] == "user" else "Chingu"
            context_str += f"{role}: {m['content']}\n"
        prompt = (context_str + f"User: {req.message}\nChingu:").strip()

        try:
            reply = await chat.send_message(UserMessage(text=prompt))
        except Exception as e:
            logger.exception("Chat failed")
            raise HTTPException(status_code=500, detail=f"Chat failed: {e}")
        reply = reply.strip()

        new_messages = messages + [
            {"role": "user", "content": req.message, "ts": datetime.now(timezone.utc).isoformat()},
            {"role": "assistant", "content": reply, "ts": datetime.now(timezone.utc).isoformat()},
        ]
        await db.chat_sessions.update_one(
            {"session_id": req.session_id},
            {"$set": {"session_id": req.session_id, "messages": new_messages, "practice_lang": req.practice_lang}},
            upsert=True,
        )
        return ChatResponse(session_id=req.session_id, reply=reply, credits=credits_left)

    @mobile_router.get("/chat/{session_id}/history")
    async def chat_history(session_id: str):
        doc = await db.chat_sessions.find_one({"session_id": session_id}, {"_id": 0})
        return {"session_id": session_id, "messages": doc.get("messages", []) if doc else []}

    # ---------- Credits ----------
    @mobile_router.get("/credits/me")
    async def credits_me(creds: HTTPAuthorizationCredentials = Depends(user_bearer)):
        user = await get_optional_user(db, creds)
        if not user:
            raise HTTPException(status_code=401, detail="Missing or invalid token")
        user = await _ensure_user_credit_defaults(db, user)
        return {
            "user_id": user["id"],
            "credits": int(user.get("credits", 50)),
            "is_pro": bool(user.get("is_pro", False)),
            "has_active_subscription": bool(user.get("is_pro", False)),
        }

    @mobile_router.post("/credits/reward")
    async def credits_reward(body: CreditsRewardIn, creds: HTTPAuthorizationCredentials = Depends(user_bearer)):
        user = await get_optional_user(db, creds)
        if not user:
            raise HTTPException(status_code=401, detail="Missing or invalid token")
        new_balance = await add_reward_credits(db, user["id"], body.reward_amount, body.source, body.ad_unit_id)
        return {"ok": True, "credits": new_balance, "awarded": max(1, int(body.reward_amount or 5))}

    # ---------- Daily streak ----------
    @mobile_router.get("/streak/status")
    async def streak_status(creds: HTTPAuthorizationCredentials = Depends(user_bearer)):
        user = await get_optional_user(db, creds)
        if not user:
            raise HTTPException(status_code=401, detail="Missing or invalid token")
        user = await _ensure_user_credit_defaults(db, user)

        today = datetime.now(timezone.utc).date()
        yesterday = today - timedelta(days=1)

        doc = await db.daily_streaks.find_one({"user_id": user["id"]}, {"_id": 0})
        streak_days = int((doc or {}).get("streak_days", 0))
        last_claim_raw = (doc or {}).get("last_claim_date")
        last_claim = None
        if isinstance(last_claim_raw, str):
            try:
                last_claim = datetime.fromisoformat(last_claim_raw).date()
            except Exception:
                last_claim = None

        can_claim = last_claim != today
        next_days = (streak_days + 1) if (can_claim and last_claim == yesterday) else (1 if can_claim else streak_days)
        next_reward = _streak_reward(next_days)

        return {
            "streak_days": streak_days,
            "last_claim_date": last_claim.isoformat() if last_claim else None,
            "can_claim_today": can_claim,
            "next_reward": next_reward,
            "credits": int(user.get("credits", 50)),
        }

    @mobile_router.post("/streak/claim")
    async def streak_claim(creds: HTTPAuthorizationCredentials = Depends(user_bearer)):
        user = await get_optional_user(db, creds)
        if not user:
            raise HTTPException(status_code=401, detail="Missing or invalid token")
        user = await _ensure_user_credit_defaults(db, user)

        today = datetime.now(timezone.utc).date()
        yesterday = today - timedelta(days=1)
        doc = await db.daily_streaks.find_one({"user_id": user["id"]}, {"_id": 0})
        streak_days = int((doc or {}).get("streak_days", 0))
        last_claim_raw = (doc or {}).get("last_claim_date")
        last_claim = None
        if isinstance(last_claim_raw, str):
            try:
                last_claim = datetime.fromisoformat(last_claim_raw).date()
            except Exception:
                last_claim = None

        if last_claim == today:
            raise HTTPException(status_code=409, detail="Daily streak already claimed today")

        new_days = (streak_days + 1) if last_claim == yesterday else 1
        reward = _streak_reward(new_days)
        new_balance = int(user.get("credits", 50)) + reward

        await db.daily_streaks.update_one(
            {"user_id": user["id"]},
            {"$set": {
                "user_id": user["id"],
                "streak_days": new_days,
                "last_claim_date": today.isoformat(),
                "last_reward": reward,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
        await db.users.update_one({"id": user["id"]}, {"$set": {"credits": new_balance}})
        await db.credit_events.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "action_type": "daily_streak_bonus",
            "amount": reward,
            "balance_after": new_balance,
            "meta": {"streak_days": new_days},
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

        return {
            "ok": True,
            "streak_days": new_days,
            "reward": reward,
            "credits": new_balance,
            "claimed_on": today.isoformat(),
        }

    @mobile_router.get("/credits/events")
    async def credits_events(creds: HTTPAuthorizationCredentials = Depends(user_bearer)):
        user = await get_optional_user(db, creds)
        if not user:
            raise HTTPException(status_code=401, detail="Missing or invalid token")
        rows = await db.credit_events.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
        return {"items": rows}

    # ---------- Subscriptions ----------
    @mobile_router.post("/subscriptions/verify")
    async def subscriptions_verify(body: SubscriptionVerifyIn, creds: HTTPAuthorizationCredentials = Depends(user_bearer)):
        user = await get_optional_user(db, creds)
        if not user:
            raise HTTPException(status_code=401, detail="Missing or invalid token")
        await db.user_subscriptions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "platform": "google_play",
            "product_id": body.product_id,
            "purchase_token": body.purchase_token,
            "package_name": body.package_name,
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.users.update_one({"id": user["id"]}, {"$set": {"is_pro": True}})
        return {
            "ok": True,
            "status": "active",
            "product_id": body.product_id,
            "verification": "pending-server-verification",
        }

    # ---------- AI module content ----------
    @mobile_router.post("/modules/content")
    async def modules_content(body: ModuleContentIn, creds: HTTPAuthorizationCredentials = Depends(user_bearer)):
        module = (body.module or "").strip().lower()
        if module not in {"tutorial", "learn", "roleplay"}:
            raise HTTPException(status_code=400, detail="Unsupported module")

        user = await get_optional_user(db, creds)
        await consume_credit_or_402(db, user, "module_generate")

        locale = (body.app_locale or body.target_lang or "en").strip().lower()
        prompt_hash = f"{module}|{locale}|{body.topic}|{body.level}"

        cached = await db.module_content_cache.find_one({"module": module, "hash": prompt_hash}, {"_id": 0})
        if cached:
            return {
                "module": module,
                "locale": locale,
                "cached": True,
                "content": cached.get("content", {}),
            }

        prompt = (
            f"Generate {module} content for locale {locale}. Topic: {body.topic}. Level: {body.level}. "
            "Return strict JSON with keys: title, intro, steps(array of {heading,body}), practice_prompts(array), quick_quiz(array of {question,answer})."
        )
        raw = ""
        try:
            cfg = await resolve_active_llm(db)
            chat = LlmChat(
                api_key=cfg["api_key"],
                session_id=f"module-{uuid.uuid4()}",
                system_message="Return ONLY JSON for learning module generation.",
            ).with_model(cfg["provider"], cfg["model"])
            raw = await chat.send_message(UserMessage(text=prompt))
        except Exception:
            raw = ""

        raw = (raw or "").strip()
        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw.lower().startswith("json"):
                raw = raw[4:]

        try:
            payload = json.loads(raw)
        except Exception:
            payload = {
                "title": f"{module.title()} module",
                "intro": raw or "Gemini key missing or unavailable. Showing starter learning content.",
                "steps": [],
                "practice_prompts": [],
                "quick_quiz": [],
            }

        await db.module_content_cache.insert_one({
            "id": str(uuid.uuid4()),
            "module": module,
            "locale": locale,
            "hash": prompt_hash,
            "content": payload,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"module": module, "locale": locale, "cached": False, "content": payload}

    @mobile_router.delete("/chat/{session_id}")
    async def chat_clear(session_id: str):
        await db.chat_sessions.delete_one({"session_id": session_id})
        return {"ok": True}

    # ---------- History ----------
    @mobile_router.post("/history", response_model=HistoryItem)
    async def add_history(item: HistoryCreate, creds: HTTPAuthorizationCredentials = Depends(user_bearer)):
        user = await get_optional_user(db, creds)
        obj = HistoryItem(**item.dict(), user_id=(user["id"] if user else None))
        doc = obj.dict()
        await db.translations.insert_one(doc)
        doc.pop("_id", None)
        return obj

    @mobile_router.get("/history")
    async def list_history(limit: int = 50, creds: HTTPAuthorizationCredentials = Depends(user_bearer)):
        user = await get_optional_user(db, creds)
        q = {"user_id": user["id"]} if user else {}
        docs = await db.translations.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
        return {"items": docs}

    @mobile_router.delete("/history/{item_id}")
    async def delete_history(item_id: str):
        await db.translations.delete_one({"id": item_id})
        return {"ok": True}

    @mobile_router.post("/history/{item_id}/favorite")
    async def toggle_favorite(item_id: str):
        doc = await db.translations.find_one({"id": item_id}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Not found")
        new_val = not doc.get("favorite", False)
        await db.translations.update_one({"id": item_id}, {"$set": {"favorite": new_val}})
        return {"id": item_id, "favorite": new_val}

    # ---------- User Auth (mobile users) ----------
    @mobile_router.post("/auth/register")
    async def register_user(body: UserRegister):
        email = body.email.strip().lower()
        if "@" not in email or len(body.password) < 6:
            raise HTTPException(status_code=400, detail="Invalid email or password too short (min 6)")
        if await db.users.find_one({"email": email}):
            raise HTTPException(status_code=409, detail="Email already registered")
        hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
        user_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": user_id, "email": email, "name": body.name,
            "password_hash": hashed, "is_pro": False, "is_banned": False,
            "credits": 50,
            "conversations_count": 0, "time_spent_minutes": 0, "progress": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.credit_events.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "action_type": "signup_bonus",
            "amount": 50,
            "balance_after": 50,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return {
            "access_token": _create_user_token(user_id, email),
            "user": {"id": user_id, "email": email, "name": body.name, "credits": 50, "is_pro": False},
        }

    @mobile_router.post("/auth/login")
    async def login_user(body: UserLogin):
        email = body.email.strip().lower()
        doc = await db.users.find_one({"email": email}, {"_id": 0})
        if not doc or not bcrypt.checkpw(body.password.encode(), doc["password_hash"].encode()):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if doc.get("is_banned"):
            raise HTTPException(status_code=403, detail="Your account has been suspended. Please contact support.")
        return {
            "access_token": _create_user_token(doc["id"], email),
            "user": {
                "id": doc["id"],
                "email": email,
                "name": doc.get("name"),
                "is_pro": doc.get("is_pro", False),
                "credits": int(doc.get("credits", 50)),
            },
        }

    @mobile_router.get("/auth/me")
    async def me_user(creds: HTTPAuthorizationCredentials = Depends(user_bearer)):
        if not creds:
            raise HTTPException(status_code=401, detail="Missing token")
        try:
            payload = jwt_lib.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        except jwt_lib.PyJWTError:
            raise HTTPException(status_code=401, detail="Invalid token")
        if payload.get("scope") != "user":
            raise HTTPException(status_code=403, detail="Not a user token")
        doc = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="User not found")
        if doc.get("is_banned"):
            raise HTTPException(status_code=403, detail="Your account has been suspended")
        return doc

    @mobile_router.delete("/auth/delete-account")
    async def delete_account(creds: HTTPAuthorizationCredentials = Depends(user_bearer)):
        if not creds:
            return {"deleted": True, "guest": True}
        try:
            payload = jwt_lib.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        except jwt_lib.PyJWTError:
            raise HTTPException(status_code=401, detail="Invalid token")
        if payload.get("scope") != "user":
            raise HTTPException(status_code=403, detail="Not a user token")
        user_id = payload["sub"]
        await db.users.delete_one({"id": user_id})
        return {"deleted": True, "guest": False, "user_id": user_id}

    app.include_router(mobile_router)
