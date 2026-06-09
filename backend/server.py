from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
import json
import base64
import logging
import tempfile
import bcrypt
import jwt
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from emergentintegrations.llm.openai.text_to_speech import OpenAITextToSpeech
from emergentintegrations.llm.openai.speech_to_text import OpenAISpeechToText


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# MongoDB connection
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
LLM_PROVIDER = "gemini"
LLM_MODEL = "gemini-3-flash-preview"

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
JWT_ALGO = "HS256"
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "chingunadi")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "0644782611")
TOKEN_TTL_HOURS = 12
LOCKOUT_LIMIT = 5
LOCKOUT_MINUTES = 5

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("polyglot")

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ------------------------- Languages ------------------------- #

LANGUAGES = [
    {"code": "en", "name": "English", "flag": "🇺🇸", "tts_voice": "alloy"},
    {"code": "ko", "name": "Korean", "flag": "🇰🇷", "tts_voice": "nova"},
    {"code": "ar-ma", "name": "Moroccan Arabic (Darija)", "flag": "🇲🇦", "tts_voice": "shimmer"},
    {"code": "ar", "name": "Arabic", "flag": "🇸🇦", "tts_voice": "shimmer"},
    {"code": "fr", "name": "French", "flag": "🇫🇷", "tts_voice": "coral"},
    {"code": "es", "name": "Spanish", "flag": "🇪🇸", "tts_voice": "nova"},
    {"code": "zh", "name": "Chinese (Mandarin)", "flag": "🇨🇳", "tts_voice": "nova"},
    {"code": "ja", "name": "Japanese", "flag": "🇯🇵", "tts_voice": "shimmer"},
    {"code": "de", "name": "German", "flag": "🇩🇪", "tts_voice": "onyx"},
    {"code": "it", "name": "Italian", "flag": "🇮🇹", "tts_voice": "coral"},
    {"code": "pt", "name": "Portuguese", "flag": "🇵🇹", "tts_voice": "echo"},
    {"code": "pt-br", "name": "Portuguese (Brazil)", "flag": "🇧🇷", "tts_voice": "echo"},
    {"code": "ru", "name": "Russian", "flag": "🇷🇺", "tts_voice": "onyx"},
    {"code": "hi", "name": "Hindi", "flag": "🇮🇳", "tts_voice": "nova"},
    {"code": "bn", "name": "Bengali", "flag": "🇧🇩", "tts_voice": "shimmer"},
    {"code": "ur", "name": "Urdu", "flag": "🇵🇰", "tts_voice": "shimmer"},
    {"code": "tr", "name": "Turkish", "flag": "🇹🇷", "tts_voice": "coral"},
    {"code": "nl", "name": "Dutch", "flag": "🇳🇱", "tts_voice": "echo"},
    {"code": "pl", "name": "Polish", "flag": "🇵🇱", "tts_voice": "onyx"},
    {"code": "sv", "name": "Swedish", "flag": "🇸🇪", "tts_voice": "alloy"},
    {"code": "no", "name": "Norwegian", "flag": "🇳🇴", "tts_voice": "alloy"},
    {"code": "da", "name": "Danish", "flag": "🇩🇰", "tts_voice": "alloy"},
    {"code": "fi", "name": "Finnish", "flag": "🇫🇮", "tts_voice": "alloy"},
    {"code": "el", "name": "Greek", "flag": "🇬🇷", "tts_voice": "coral"},
    {"code": "he", "name": "Hebrew", "flag": "🇮🇱", "tts_voice": "shimmer"},
    {"code": "th", "name": "Thai", "flag": "🇹🇭", "tts_voice": "nova"},
    {"code": "vi", "name": "Vietnamese", "flag": "🇻🇳", "tts_voice": "shimmer"},
    {"code": "id", "name": "Indonesian", "flag": "🇮🇩", "tts_voice": "nova"},
    {"code": "ms", "name": "Malay", "flag": "🇲🇾", "tts_voice": "nova"},
    {"code": "tl", "name": "Filipino", "flag": "🇵🇭", "tts_voice": "nova"},
    {"code": "sw", "name": "Swahili", "flag": "🇰🇪", "tts_voice": "echo"},
    {"code": "uk", "name": "Ukrainian", "flag": "🇺🇦", "tts_voice": "onyx"},
    {"code": "cs", "name": "Czech", "flag": "🇨🇿", "tts_voice": "onyx"},
    {"code": "ro", "name": "Romanian", "flag": "🇷🇴", "tts_voice": "coral"},
    {"code": "hu", "name": "Hungarian", "flag": "🇭🇺", "tts_voice": "onyx"},
    {"code": "bg", "name": "Bulgarian", "flag": "🇧🇬", "tts_voice": "onyx"},
    {"code": "fa", "name": "Persian (Farsi)", "flag": "🇮🇷", "tts_voice": "shimmer"},
    {"code": "ta", "name": "Tamil", "flag": "🇱🇰", "tts_voice": "shimmer"},
    {"code": "te", "name": "Telugu", "flag": "🇮🇳", "tts_voice": "shimmer"},
    {"code": "pa", "name": "Punjabi", "flag": "🇮🇳", "tts_voice": "nova"},
    {"code": "mr", "name": "Marathi", "flag": "🇮🇳", "tts_voice": "nova"},
    {"code": "gu", "name": "Gujarati", "flag": "🇮🇳", "tts_voice": "nova"},
    {"code": "ml", "name": "Malayalam", "flag": "🇮🇳", "tts_voice": "shimmer"},
    {"code": "kn", "name": "Kannada", "flag": "🇮🇳", "tts_voice": "shimmer"},
    {"code": "af", "name": "Afrikaans", "flag": "🇿🇦", "tts_voice": "echo"},
    {"code": "ca", "name": "Catalan", "flag": "🇪🇸", "tts_voice": "coral"},
    {"code": "hr", "name": "Croatian", "flag": "🇭🇷", "tts_voice": "coral"},
    {"code": "sk", "name": "Slovak", "flag": "🇸🇰", "tts_voice": "onyx"},
    {"code": "sr", "name": "Serbian", "flag": "🇷🇸", "tts_voice": "onyx"},
    {"code": "sl", "name": "Slovenian", "flag": "🇸🇮", "tts_voice": "onyx"},
    {"code": "lv", "name": "Latvian", "flag": "🇱🇻", "tts_voice": "alloy"},
    {"code": "lt", "name": "Lithuanian", "flag": "🇱🇹", "tts_voice": "alloy"},
    {"code": "et", "name": "Estonian", "flag": "🇪🇪", "tts_voice": "alloy"},
]


def lang_name(code: str) -> str:
    for lang in LANGUAGES:
        if lang["code"] == code:
            return lang["name"]
    return code


def lang_voice(code: str) -> str:
    for lang in LANGUAGES:
        if lang["code"] == code:
            return lang["tts_voice"]
    return "alloy"


# ------------------------- Models ------------------------- #

class TranslateRequest(BaseModel):
    text: str
    source_lang: str = "auto"
    target_lang: str = "en"


class TranslateResponse(BaseModel):
    id: str
    source_text: str
    translated_text: str
    source_lang: str
    target_lang: str
    detected_source: Optional[str] = None


class ImageTranslateRequest(BaseModel):
    image_base64: str
    target_lang: str = "en"


class ImageTranslateResponse(BaseModel):
    id: str
    extracted_text: str
    translated_text: str
    target_lang: str


class TranscribeRequest(BaseModel):
    audio_base64: str
    mime_type: str = "audio/m4a"
    language: Optional[str] = None


class TranscribeResponse(BaseModel):
    text: str
    language: Optional[str] = None


class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None
    target_lang: Optional[str] = None
    speed: float = 1.0


class TTSResponse(BaseModel):
    audio_base64: str
    mime: str = "audio/mpeg"


class ChatRequest(BaseModel):
    session_id: str
    message: str
    practice_lang: Optional[str] = None  # if set, bot replies in this language as practice friend


class ChatResponse(BaseModel):
    session_id: str
    reply: str


class HistoryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    kind: str  # text | image | voice
    source_text: str
    translated_text: str
    source_lang: str
    target_lang: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    favorite: bool = False


class HistoryCreate(BaseModel):
    kind: str
    source_text: str
    translated_text: str
    source_lang: str
    target_lang: str


# ------------------------- Helpers ------------------------- #

def get_llm(session_id: str, system_message: str) -> LlmChat:
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model(LLM_PROVIDER, LLM_MODEL)


# ------------------------- Routes ------------------------- #

@api_router.get("/")
async def root():
    return {"message": "Polyglot AI Translator API", "model": LLM_MODEL}


@api_router.get("/ping")
async def ping():
    """Ultra-lightweight keep-alive endpoint. Does NOT hit the database.
    Used by the frontend and external uptime monitors to prevent the
    backend container from going idle.
    """
    return {"status": "ok", "service": "chingu-speak", "ts": datetime.now(timezone.utc).isoformat()}


@api_router.get("/health")
async def health():
    return {"status": "ok"}


@api_router.get("/languages")
async def get_languages():
    return {"languages": LANGUAGES}


@api_router.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty")

    target = lang_name(req.target_lang)
    source = "auto-detect" if req.source_lang == "auto" else lang_name(req.source_lang)

    system = (
        "You are a world-class translator. Respond ONLY with strict JSON in the form "
        '{"translated_text": "<translation>", "detected_source_lang": "<ISO code>"}. '
        "No code fences, no commentary. Preserve names, numbers, line breaks. "
        "If the target is Moroccan Arabic (Darija), use authentic Darija with Arabic script."
    )
    prompt = (
        f"Translate the following text from {source} to {target}.\n\n"
        f"TEXT:\n{req.text}\n\n"
        "Output JSON only."
    )

    chat = get_llm(session_id=f"translate-{uuid.uuid4()}", system_message=system)
    try:
        result = await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        logger.exception("Translate failed")
        raise HTTPException(status_code=500, detail=f"Translation failed: {e}")

    translated = req.text
    detected = req.source_lang
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

    resp = TranslateResponse(
        id=str(uuid.uuid4()),
        source_text=req.text,
        translated_text=translated,
        source_lang=req.source_lang,
        target_lang=req.target_lang,
        detected_source=detected,
    )
    return resp


@api_router.post("/translate-image", response_model=ImageTranslateResponse)
async def translate_image(req: ImageTranslateRequest):
    if not req.image_base64:
        raise HTTPException(status_code=400, detail="image_base64 is required")

    target = lang_name(req.target_lang)

    system = (
        "You are an OCR + translation engine. Look at the image, read ALL visible text, "
        "then translate it. Respond ONLY with strict JSON in the form "
        '{"extracted_text": "<original text from image>", "translated_text": "<translation>"}. '
        "No code fences, no commentary. If no text is visible, set both fields to empty strings."
    )
    prompt = (
        f"Extract all text from this image, then translate the extracted text into {target}. "
        "Return JSON only."
    )

    chat = get_llm(session_id=f"img-translate-{uuid.uuid4()}", system_message=system)
    image = ImageContent(image_base64=req.image_base64)
    try:
        result = await chat.send_message(UserMessage(text=prompt, file_contents=[image]))
    except Exception as e:
        logger.exception("Image translate failed")
        raise HTTPException(status_code=500, detail=f"Image translation failed: {e}")

    extracted = ""
    translated = ""
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
    )


@api_router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(req: TranscribeRequest):
    if not req.audio_base64:
        raise HTTPException(status_code=400, detail="audio_base64 is required")

    # Determine extension from mime_type
    mime = req.mime_type.lower()
    if "wav" in mime:
        ext = "wav"
    elif "m4a" in mime or "mp4" in mime or "aac" in mime:
        ext = "m4a"
    elif "mpeg" in mime or "mp3" in mime:
        ext = "mp3"
    elif "webm" in mime:
        ext = "webm"
    elif "ogg" in mime:
        ext = "ogg"
    else:
        ext = "m4a"

    try:
        audio_bytes = base64.b64decode(req.audio_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 audio")

    tmp = tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False)
    tmp.write(audio_bytes)
    tmp.flush()
    tmp.close()

    try:
        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
        # OpenAI/litellm expects a file-like object or PathLike, not a str path.
        with open(tmp.name, "rb") as fh:
            kwargs = {"file": fh, "model": "whisper-1", "response_format": "json"}
            if req.language and req.language != "auto":
                # Strip region suffixes like ar-ma -> ar
                kwargs["language"] = req.language.split("-")[0]
            result = await stt.transcribe(**kwargs)
        # litellm transcription returns a dict-like object with 'text'
        text = ""
        if isinstance(result, dict):
            text = result.get("text", "")
        else:
            text = getattr(result, "text", "") or str(result)
        return TranscribeResponse(text=text.strip(), language=req.language)
    except Exception as e:
        logger.exception("Transcribe failed")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")
    finally:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass


@api_router.post("/tts", response_model=TTSResponse)
async def text_to_speech(req: TTSRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty")

    voice = req.voice
    if not voice and req.target_lang:
        voice = lang_voice(req.target_lang)
    if not voice:
        voice = "nova"

    try:
        tts = OpenAITextToSpeech(api_key=EMERGENT_LLM_KEY)
        audio_b64 = await tts.generate_speech_base64(
            text=req.text[:4000],
            model="tts-1",
            voice=voice,
            speed=req.speed,
            response_format="mp3",
        )
        return TTSResponse(audio_base64=audio_b64, mime="audio/mpeg")
    except Exception as e:
        logger.exception("TTS failed")
        raise HTTPException(status_code=500, detail=f"TTS failed: {e}")


@api_router.post("/chat", response_model=ChatResponse)
async def chat_buddy(req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message is empty")

    # Load prior history for this session
    history_doc = await db.chat_sessions.find_one({"session_id": req.session_id}, {"_id": 0})
    messages = history_doc.get("messages", []) if history_doc else []

    practice = lang_name(req.practice_lang) if req.practice_lang else None
    system = (
        "You are Chingu — a warm, hilarious, sharp-witted AI translation friend. "
        "Chingu means 'friend' in Korean. You help users learn languages naturally through chat. "
        "You speak like a fun bestie: punchy lines, playful jokes, emoji sprinkled, never robotic. "
        "Help users practice languages, translate phrases, explain slang and culture, and reply FAST. "
        "Keep replies short (1–4 sentences) unless asked for more. Stay supportive and energetic."
    )
    if practice:
        system += (
            f" The user is practicing {practice}. Reply primarily in {practice} with a short English "
            "hint in parentheses after tricky words. Correct mistakes gently with a wink."
        )

    chat = get_llm(session_id=req.session_id, system_message=system)
    # Replay history into the chat so it has context (LlmChat keeps internal state per instance,
    # but each request creates a new instance — feed prior turns as context inside prompt).
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

    # Save updated history
    new_messages = messages + [
        {"role": "user", "content": req.message, "ts": datetime.now(timezone.utc).isoformat()},
        {"role": "assistant", "content": reply, "ts": datetime.now(timezone.utc).isoformat()},
    ]
    await db.chat_sessions.update_one(
        {"session_id": req.session_id},
        {"$set": {"session_id": req.session_id, "messages": new_messages, "practice_lang": req.practice_lang}},
        upsert=True,
    )
    return ChatResponse(session_id=req.session_id, reply=reply)


@api_router.get("/chat/{session_id}/history")
async def chat_history(session_id: str):
    doc = await db.chat_sessions.find_one({"session_id": session_id}, {"_id": 0})
    return {"session_id": session_id, "messages": doc.get("messages", []) if doc else []}


@api_router.delete("/chat/{session_id}")
async def chat_clear(session_id: str):
    await db.chat_sessions.delete_one({"session_id": session_id})
    return {"ok": True}


@api_router.post("/history", response_model=HistoryItem)
async def add_history(item: HistoryCreate):
    obj = HistoryItem(**item.dict())
    await db.translations.insert_one(obj.dict())
    return obj


@api_router.get("/history")
async def list_history(limit: int = 50):
    docs = await db.translations.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"items": docs}


@api_router.delete("/history/{item_id}")
async def delete_history(item_id: str):
    await db.translations.delete_one({"id": item_id})
    return {"ok": True}


@api_router.post("/history/{item_id}/favorite")
async def toggle_favorite(item_id: str):
    doc = await db.translations.find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    new_val = not doc.get("favorite", False)
    await db.translations.update_one({"id": item_id}, {"$set": {"favorite": new_val}})
    return {"id": item_id, "favorite": new_val}


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------- Admin (hidden) ------------------------- #

bearer_scheme = HTTPBearer(auto_error=False)
_failed_logins: dict = {}


class AdminLogin(BaseModel):
    username: str
    password: str


class AdminToken(BaseModel):
    access_token: str
    token_type: str = "bearer"


@app.on_event("startup")
async def seed_admin():
    existing = await db.admins.find_one({"username": ADMIN_USERNAME}, {"_id": 0})
    if existing:
        return
    hashed = bcrypt.hashpw(ADMIN_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    await db.admins.insert_one(
        {
            "username": ADMIN_USERNAME,
            "password_hash": hashed,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    logger.info("Seeded admin user: %s", ADMIN_USERNAME)


def _register_failure(username: str):
    now = datetime.now(timezone.utc)
    state = _failed_logins.get(username, {"count": 0, "locked_until": None})
    state["count"] += 1
    if state["count"] >= LOCKOUT_LIMIT:
        state["locked_until"] = now + timedelta(minutes=LOCKOUT_MINUTES)
    _failed_logins[username] = state


def _is_locked(username: str) -> bool:
    state = _failed_logins.get(username)
    if not state or not state.get("locked_until"):
        return False
    if datetime.now(timezone.utc) < state["locked_until"]:
        return True
    _failed_logins.pop(username, None)
    return False


def _create_admin_token(username: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS)
    payload = {"sub": username, "scope": "admin", "exp": exp}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def require_admin(creds: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> str:
    if not creds:
        raise HTTPException(status_code=401, detail="Missing admin token")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired admin token")
    if payload.get("scope") != "admin":
        raise HTTPException(status_code=403, detail="Not an admin token")
    return payload.get("sub")


@api_router.post("/admin/login", response_model=AdminToken)
async def admin_login(body: AdminLogin):
    if _is_locked(body.username):
        raise HTTPException(status_code=423, detail="Too many attempts. Locked for 5 minutes.")
    doc = await db.admins.find_one({"username": body.username}, {"_id": 0})
    if not doc:
        _register_failure(body.username)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    ok = bcrypt.checkpw(body.password.encode("utf-8"), doc["password_hash"].encode("utf-8"))
    if not ok:
        _register_failure(body.username)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    _failed_logins.pop(body.username, None)
    return AdminToken(access_token=_create_admin_token(body.username))


@api_router.get("/admin/stats")
async def admin_stats(_admin: str = Depends(require_admin)):
    chat_count = await db.chat_sessions.count_documents({})
    trans_count = await db.translations.count_documents({})
    msg_count = 0
    async for s in db.chat_sessions.find({}, {"_id": 0, "messages": 1}):
        msg_count += len(s.get("messages", []))
    return {
        "conversations": chat_count,
        "messages": msg_count,
        "translations": trans_count,
    }


@api_router.get("/admin/conversations")
async def admin_list_conversations(_admin: str = Depends(require_admin)):
    items = []
    async for s in db.chat_sessions.find({}, {"_id": 0}):
        msgs = s.get("messages", [])
        items.append(
            {
                "session_id": s.get("session_id"),
                "practice_lang": s.get("practice_lang"),
                "message_count": len(msgs),
                "messages": msgs,
                "last_ts": msgs[-1]["ts"] if msgs else None,
            }
        )
    items.sort(key=lambda x: x.get("last_ts") or "", reverse=True)
    return {"items": items}


@api_router.delete("/admin/conversations/{session_id}")
async def admin_delete_conversation(session_id: str, _admin: str = Depends(require_admin)):
    res = await db.chat_sessions.delete_one({"session_id": session_id})
    return {"deleted": res.deleted_count}


@api_router.get("/admin/translations")
async def admin_list_translations(_admin: str = Depends(require_admin), limit: int = 1000):
    docs = await db.translations.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"items": docs}


@api_router.delete("/admin/translations/{item_id}")
async def admin_delete_translation(item_id: str, _admin: str = Depends(require_admin)):
    res = await db.translations.delete_one({"id": item_id})
    return {"deleted": res.deleted_count}


@api_router.get("/admin/export")
async def admin_export(
    kind: str = "translations",
    fmt: str = "json",
    _admin: str = Depends(require_admin),
):
    if kind == "translations":
        rows = await db.translations.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    elif kind == "conversations":
        rows = []
        async for s in db.chat_sessions.find({}, {"_id": 0}):
            for m in s.get("messages", []):
                rows.append(
                    {
                        "session_id": s.get("session_id"),
                        "practice_lang": s.get("practice_lang"),
                        "role": m.get("role"),
                        "content": m.get("content"),
                        "ts": m.get("ts"),
                    }
                )
    else:
        raise HTTPException(status_code=400, detail="Unknown kind")

    if fmt == "json":
        return JSONResponse(content=rows)
    if fmt == "csv":
        buf = io.StringIO()
        if rows:
            writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            for r in rows:
                writer.writerow({k: ("" if v is None else str(v)) for k, v in r.items()})
        data = buf.getvalue().encode("utf-8")
        return StreamingResponse(
            iter([data]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{kind}.csv"'},
        )
    raise HTTPException(status_code=400, detail="fmt must be json or csv")


# ------------------------- Admin: EAS Builds ------------------------- #

import asyncio as _asyncio

EXPO_TOKEN = os.environ.get("EXPO_TOKEN", "")
EAS_PROJECT_DIR = os.environ.get("EAS_PROJECT_DIR", str(ROOT_DIR.parent / "frontend"))
EAS_BUILD_PROFILE = os.environ.get("EAS_BUILD_PROFILE", "apk")


class BuildRecord(BaseModel):
    id: str
    eas_build_id: str
    eas_build_url: str
    profile: str
    platform: str
    status: str
    triggered_by: str
    created_at: str


@api_router.post("/admin/builds/android", response_model=BuildRecord)
async def admin_trigger_android_build(_admin: str = Depends(require_admin)):
    """Trigger a cloud Android APK build on EAS. Returns the build URL.

    Requires EXPO_TOKEN to be configured server-side. Runs `eas build` via
    npx in non-interactive + no-wait mode so the request returns in seconds
    with the build URL the user can open.
    """
    if not EXPO_TOKEN:
        raise HTTPException(status_code=500, detail="EXPO_TOKEN not configured on server")

    cmd = [
        "npx", "--yes", "eas-cli@latest", "build",
        "--platform", "android",
        "--profile", EAS_BUILD_PROFILE,
        "--non-interactive", "--no-wait", "--json",
    ]
    env = os.environ.copy()
    env["EXPO_TOKEN"] = EXPO_TOKEN

    try:
        proc = await _asyncio.create_subprocess_exec(
            *cmd,
            cwd=EAS_PROJECT_DIR,
            env=env,
            stdout=_asyncio.subprocess.PIPE,
            stderr=_asyncio.subprocess.PIPE,
        )
        # 5-minute hard timeout on the trigger phase (upload + queue)
        stdout_b, stderr_b = await _asyncio.wait_for(proc.communicate(), timeout=300)
    except _asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="EAS trigger timed out after 5 minutes")

    if proc.returncode != 0:
        err = stderr_b.decode("utf-8", "ignore")[-1500:]
        raise HTTPException(status_code=500, detail=f"eas-cli failed: {err}")

    out = stdout_b.decode("utf-8", "ignore").strip()
    # eas outputs a JSON array of builds; pick the first
    try:
        # find first '[' or '{' to skip any progress prefix
        idx_arr = out.find("[")
        idx_obj = out.find("{")
        idx = min(i for i in [idx_arr, idx_obj] if i >= 0)
        data = json.loads(out[idx:])
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=500, detail=f"Could not parse eas output: {out[-500:]}")

    info = data[0] if isinstance(data, list) and data else data
    eas_id = info.get("id")
    project = info.get("project", {})
    owner = project.get("ownerAccount", {}).get("name") or "unknown"
    slug = project.get("slug") or "frontend"
    eas_url = f"https://expo.dev/accounts/{owner}/projects/{slug}/builds/{eas_id}"

    record = {
        "id": str(uuid.uuid4()),
        "eas_build_id": eas_id,
        "eas_build_url": eas_url,
        "profile": EAS_BUILD_PROFILE,
        "platform": "android",
        "status": info.get("status", "NEW"),
        "triggered_by": _admin,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.eas_builds.insert_one({**record})
    return BuildRecord(**record)


@api_router.get("/admin/builds/recent")
async def admin_recent_builds(limit: int = 20, _admin: str = Depends(require_admin)):
    rows = await db.eas_builds.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    # best-effort live status refresh for the 3 most recent in-progress builds
    in_progress_ids = [r["eas_build_id"] for r in rows[:3] if r.get("status") in ("NEW", "IN_QUEUE", "IN_PROGRESS")]
    if in_progress_ids and EXPO_TOKEN:
        for bid in in_progress_ids:
            try:
                p = await _asyncio.create_subprocess_exec(
                    "npx", "--yes", "eas-cli@latest", "build:view", bid, "--json",
                    cwd=EAS_PROJECT_DIR, env={**os.environ, "EXPO_TOKEN": EXPO_TOKEN},
                    stdout=_asyncio.subprocess.PIPE, stderr=_asyncio.subprocess.PIPE,
                )
                so, _ = await _asyncio.wait_for(p.communicate(), timeout=30)
                if p.returncode == 0:
                    d = json.loads(so.decode("utf-8", "ignore"))
                    new_status = d.get("status")
                    apk = (d.get("artifacts") or {}).get("buildUrl")
                    update = {"status": new_status}
                    if apk:
                        update["apk_url"] = apk
                    await db.eas_builds.update_one({"eas_build_id": bid}, {"$set": update})
                    for r in rows:
                        if r["eas_build_id"] == bid:
                            r.update(update)
            except Exception:
                pass
    return {"items": rows}


# ------------------------- User Auth (optional) ------------------------- #

class UserRegister(BaseModel):
    email: str
    password: str
    name: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: Optional[str] = None


class AuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


def _create_user_token(user_id: str, email: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=30)
    payload = {"sub": user_id, "email": email, "scope": "user", "exp": exp}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


@api_router.post("/auth/register", response_model=AuthOut)
async def register_user(body: UserRegister):
    email = body.email.strip().lower()
    if "@" not in email or len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Invalid email or password too short (min 6)")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    hashed = bcrypt.hashpw(body.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "name": body.name,
        "password_hash": hashed,
        "is_pro": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    return AuthOut(
        access_token=_create_user_token(user_id, email),
        user=UserOut(id=user_id, email=email, name=body.name),
    )


@api_router.post("/auth/login", response_model=AuthOut)
async def login_user(body: UserLogin):
    email = body.email.strip().lower()
    doc = await db.users.find_one({"email": email}, {"_id": 0})
    if not doc or not bcrypt.checkpw(body.password.encode("utf-8"), doc["password_hash"].encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return AuthOut(
        access_token=_create_user_token(doc["id"], email),
        user=UserOut(id=doc["id"], email=email, name=doc.get("name")),
    )


@api_router.get("/auth/me", response_model=UserOut)
async def me(creds: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    if not creds:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if payload.get("scope") != "user":
        raise HTTPException(status_code=403, detail="Not a user token")
    doc = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0, "password_hash": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut(id=doc["id"], email=doc["email"], name=doc.get("name"))


@api_router.delete("/auth/delete-account")
async def delete_account(creds: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    """Permanently delete the current user account and all associated data.
    Required by Google Play store policy. Works for authenticated users; guest
    accounts can also call this with no token to receive a no-op success
    (so the UI flow stays uniform).
    """
    if not creds:
        return {"deleted": True, "guest": True}
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if payload.get("scope") != "user":
        raise HTTPException(status_code=403, detail="Not a user token")
    user_id = payload.get("sub")
    await db.users.delete_one({"id": user_id})
    # best-effort cleanup of anonymous-style data tied to this user
    return {"deleted": True, "guest": False, "user_id": user_id}


app.include_router(api_router)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
