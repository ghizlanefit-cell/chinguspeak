"""Backend tests for Polyglot AI Translator (Pingo-style).

Covers languages, translate, image-translate, TTS, transcribe, chat (session
persistence + clear), and history CRUD with favorite toggle.
"""
import base64
import io
import uuid
import pytest
import requests


# ------------------------- 1. Health / Languages ------------------------- #

class TestHealth:
    def test_root(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("model") == "gemini-3-flash-preview"

    def test_languages_50_plus(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/languages")
        assert r.status_code == 200
        langs = r.json()["languages"]
        assert isinstance(langs, list)
        assert len(langs) >= 50, f"Expected >=50 languages, got {len(langs)}"
        codes = {l["code"] for l in langs}
        for required in ["en", "ko", "ar-ma", "fr", "es", "zh", "ja", "hi"]:
            assert required in codes, f"missing language code {required}"
        # Every entry has expected keys
        for l in langs:
            assert {"code", "name", "flag", "tts_voice"} <= set(l.keys())


# ------------------------- 2. Translate ------------------------- #

class TestTranslate:
    def test_empty_text_returns_400(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/translate", json={
            "text": "  ", "source_lang": "en", "target_lang": "fr"
        })
        assert r.status_code == 400

    def test_english_to_korean(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/translate", json={
            "text": "Hello, how are you today?",
            "source_lang": "en",
            "target_lang": "ko",
        }, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("id", "source_text", "translated_text", "source_lang", "target_lang"):
            assert k in d
        assert d["target_lang"] == "ko"
        assert d["translated_text"].strip()
        # Korean text should contain Hangul characters
        assert any("\uac00" <= ch <= "\ud7af" for ch in d["translated_text"]), \
            f"Expected Korean characters, got: {d['translated_text']!r}"

    def test_english_to_french(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/translate", json={
            "text": "Good morning, my friend.",
            "source_lang": "en",
            "target_lang": "fr",
        }, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["target_lang"] == "fr"
        assert d["translated_text"].strip()
        # French translation should likely contain typical French words
        lowered = d["translated_text"].lower()
        assert any(tok in lowered for tok in ["bonjour", "bon matin", "ami", "salut"])

    def test_english_to_darija(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/translate", json={
            "text": "Hello my friend, how are you?",
            "source_lang": "en",
            "target_lang": "ar-ma",
        }, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["target_lang"] == "ar-ma"
        assert d["translated_text"].strip()
        # Should contain Arabic script
        assert any("\u0600" <= ch <= "\u06ff" for ch in d["translated_text"]), \
            f"Expected Arabic script, got: {d['translated_text']!r}"

    def test_auto_detect_to_spanish(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/translate", json={
            "text": "I love learning new languages.",
            "source_lang": "auto",
            "target_lang": "es",
        }, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["target_lang"] == "es"
        assert d["translated_text"].strip()
        assert d.get("detected_source")  # should report a detected source


# ------------------------- 3. Image Translate ------------------------- #

def _make_text_image_png_b64(text: str = "Hello World") -> str:
    """Generate a PNG with visible rendered text + features (lines/shapes)."""
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new("RGB", (480, 220), color=(245, 248, 255))
    draw = ImageDraw.Draw(img)
    # Add visual features (rectangles + line) so it's not uniform
    draw.rectangle([10, 10, 470, 210], outline=(20, 20, 40), width=3)
    draw.line([(10, 110), (470, 110)], fill=(120, 120, 200), width=2)
    try:
        font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
    except Exception:
        font = ImageFont.load_default()
    draw.text((30, 60), text, fill=(15, 15, 35), font=font)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


class TestImageTranslate:
    def test_image_ocr_and_translate_to_french(self, api_client, base_url):
        img_b64 = _make_text_image_png_b64("Hello World")
        r = api_client.post(f"{base_url}/api/translate-image", json={
            "image_base64": img_b64,
            "target_lang": "fr",
        }, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("id", "extracted_text", "translated_text", "target_lang"):
            assert k in d
        assert d["target_lang"] == "fr"
        assert d["extracted_text"].strip(), f"No text extracted: {d}"
        assert "hello" in d["extracted_text"].lower()
        assert d["translated_text"].strip()
        # French translation for "Hello World" usually has 'bonjour' or 'monde' or 'salut'
        assert any(tok in d["translated_text"].lower()
                   for tok in ["bonjour", "monde", "salut"]), \
            f"Unexpected translation: {d['translated_text']!r}"

    def test_image_missing_returns_400(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/translate-image", json={
            "image_base64": "", "target_lang": "fr"
        })
        assert r.status_code == 400


# ------------------------- 4. TTS ------------------------- #

class TestTTS:
    def test_tts_english_returns_mp3_b64(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/tts", json={
            "text": "Hello, this is a quick test.",
            "target_lang": "en",
        }, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["mime"] == "audio/mpeg"
        assert d["audio_base64"]
        raw = base64.b64decode(d["audio_base64"])
        assert len(raw) > 1000, "audio too small"
        # MP3 magic: ID3 or 0xFFFB/0xFFF3/0xFFF2
        assert raw[:3] == b"ID3" or raw[0] == 0xFF, "Not an MP3 file"

    def test_tts_empty_text_400(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/tts", json={"text": "", "target_lang": "en"})
        assert r.status_code == 400


# ------------------------- 5. Transcribe (uses TTS-produced audio) ------- #

class TestTranscribe:
    def test_transcribe_real_audio(self, api_client, base_url):
        # Generate real speech via /api/tts, feed it back to /api/transcribe
        tts = api_client.post(f"{base_url}/api/tts", json={
            "text": "The quick brown fox jumps over the lazy dog.",
            "target_lang": "en",
        }, timeout=60)
        assert tts.status_code == 200
        audio_b64 = tts.json()["audio_base64"]

        r = api_client.post(f"{base_url}/api/transcribe", json={
            "audio_base64": audio_b64,
            "mime_type": "audio/mpeg",
            "language": "en",
        }, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "text" in d and d["text"].strip(), f"No transcription: {d}"
        lower = d["text"].lower()
        # Whisper should pick at least a couple keywords
        hits = sum(1 for w in ["quick", "brown", "fox", "lazy", "dog"] if w in lower)
        assert hits >= 2, f"Transcript missed keywords: {d['text']!r}"

    def test_transcribe_missing_audio_400(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/transcribe", json={
            "audio_base64": "", "mime_type": "audio/mpeg"
        })
        assert r.status_code == 400


# ------------------------- 6. Chat (LingoBot) ------------------------- #

class TestChat:
    def test_chat_session_persistence_and_clear(self, api_client, base_url):
        session_id = f"TEST_session_{uuid.uuid4()}"

        r1 = api_client.post(f"{base_url}/api/chat", json={
            "session_id": session_id,
            "message": "Hey LingoBot! Teach me one fun French word.",
        }, timeout=60)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["session_id"] == session_id
        assert d1["reply"].strip()

        r2 = api_client.post(f"{base_url}/api/chat", json={
            "session_id": session_id,
            "message": "Now give me another one, please!",
        }, timeout=60)
        assert r2.status_code == 200
        assert r2.json()["reply"].strip()

        h = api_client.get(f"{base_url}/api/chat/{session_id}/history")
        assert h.status_code == 200
        msgs = h.json()["messages"]
        # 2 user + 2 assistant
        assert len(msgs) == 4, f"Expected 4 messages, got {len(msgs)}"
        roles = [m["role"] for m in msgs]
        assert roles == ["user", "assistant", "user", "assistant"]

        # Clear
        d = api_client.delete(f"{base_url}/api/chat/{session_id}")
        assert d.status_code == 200
        assert d.json().get("ok") is True

        h2 = api_client.get(f"{base_url}/api/chat/{session_id}/history")
        assert h2.status_code == 200
        assert h2.json()["messages"] == []

    def test_chat_empty_message_400(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/chat", json={
            "session_id": "TEST_empty", "message": "  "
        })
        assert r.status_code == 400


# ------------------------- 7. History CRUD ------------------------- #

class TestHistory:
    created_ids: list = []

    def test_create_and_list_sorted_desc(self, api_client, base_url):
        ids = []
        for i in range(2):
            r = api_client.post(f"{base_url}/api/history", json={
                "kind": "text",
                "source_text": f"TEST_src_{i}",
                "translated_text": f"TEST_dst_{i}",
                "source_lang": "en",
                "target_lang": "fr",
            })
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["id"] and d["created_at"]
            assert d["favorite"] is False
            ids.append(d["id"])
        TestHistory.created_ids = ids

        r = api_client.get(f"{base_url}/api/history?limit=50")
        assert r.status_code == 200
        items = r.json()["items"]
        # Both created should be present
        all_ids = [it["id"] for it in items]
        for i in ids:
            assert i in all_ids
        # Sorted desc by created_at
        ts = [it["created_at"] for it in items]
        assert ts == sorted(ts, reverse=True), "history not sorted desc"

    def test_toggle_favorite(self, api_client, base_url):
        assert TestHistory.created_ids, "no items to favorite"
        item_id = TestHistory.created_ids[0]
        r = api_client.post(f"{base_url}/api/history/{item_id}/favorite")
        assert r.status_code == 200
        assert r.json()["favorite"] is True
        # Verify via GET list
        lst = api_client.get(f"{base_url}/api/history").json()["items"]
        match = [x for x in lst if x["id"] == item_id][0]
        assert match["favorite"] is True
        # Toggle off
        r2 = api_client.post(f"{base_url}/api/history/{item_id}/favorite")
        assert r2.json()["favorite"] is False

    def test_favorite_404(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/history/does-not-exist/favorite")
        assert r.status_code == 404

    def test_delete_and_verify_gone(self, api_client, base_url):
        for item_id in TestHistory.created_ids:
            r = api_client.delete(f"{base_url}/api/history/{item_id}")
            assert r.status_code == 200
        lst = api_client.get(f"{base_url}/api/history").json()["items"]
        all_ids = {x["id"] for x in lst}
        for item_id in TestHistory.created_ids:
            assert item_id not in all_ids
