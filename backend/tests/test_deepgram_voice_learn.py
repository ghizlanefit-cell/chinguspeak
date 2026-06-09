"""
Test suite for Deepgram Nova-2 STT, Voice Screen, and Learn Module fixes
Iteration 8 - Testing Premium Voice UI + STT stack rebuild
"""
import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDeepgramTranscribeEndpoint:
    """Test POST /api/transcribe endpoint with Deepgram Nova-2"""
    
    def test_transcribe_endpoint_exists(self):
        """Verify /api/transcribe endpoint exists and is not 404"""
        response = requests.post(
            f"{BASE_URL}/api/transcribe",
            json={},
            headers={"Content-Type": "application/json"}
        )
        # Should NOT be 404 - endpoint must exist
        assert response.status_code != 404, f"Transcribe endpoint returned 404 - not deployed"
        # Should return 422 for missing required field
        assert response.status_code == 422, f"Expected 422 for missing audio_base64, got {response.status_code}"
    
    def test_transcribe_invalid_audio_error_shape(self):
        """Verify proper error response for invalid audio"""
        response = requests.post(
            f"{BASE_URL}/api/transcribe",
            json={"audio_base64": "invalid_base64_data", "mime_type": "audio/m4a"},
            headers={"Content-Type": "application/json"}
        )
        # Should return 400 for invalid base64
        assert response.status_code == 400, f"Expected 400 for invalid audio, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Error response should have 'detail' field"
        assert "invalid" in data["detail"].lower() or "base64" in data["detail"].lower(), \
            f"Error should mention invalid base64: {data['detail']}"
    
    def test_transcribe_empty_audio_error(self):
        """Verify error for empty audio_base64"""
        response = requests.post(
            f"{BASE_URL}/api/transcribe",
            json={"audio_base64": "", "mime_type": "audio/m4a"},
            headers={"Content-Type": "application/json"}
        )
        # Should return 400 for empty audio
        assert response.status_code == 400, f"Expected 400 for empty audio, got {response.status_code}"


class TestLearnModuleEndpoint:
    """Test /api/modules/content endpoint - Learn module no longer crashes"""
    
    def test_modules_content_endpoint_exists(self):
        """Verify /api/modules/content endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/modules/content",
            json={"module": "learn"},
            headers={"Content-Type": "application/json"}
        )
        # Should NOT be 404
        assert response.status_code != 404, "Modules content endpoint returned 404"
        # Should return 200 with content
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:200]}"
    
    def test_learn_module_returns_fallback_content(self):
        """Verify Learn module returns content (fallback or generated)"""
        response = requests.post(
            f"{BASE_URL}/api/modules/content",
            json={
                "module": "learn",
                "topic": "everyday communication",
                "level": "beginner",
                "app_locale": "en"
            },
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Learn module failed: {response.text[:200]}"
        data = response.json()
        
        # Verify response structure
        assert "module" in data, "Response should have 'module' field"
        assert data["module"] == "learn", f"Module should be 'learn', got {data['module']}"
        assert "content" in data, "Response should have 'content' field"
        
        content = data["content"]
        # Content should have title and intro at minimum
        assert "title" in content or "intro" in content, "Content should have title or intro"
        
        # If fallback is used, intro should mention it
        if data.get("fallback"):
            assert "Gemini key" in content.get("intro", "") or "starter" in content.get("intro", "").lower(), \
                "Fallback content should indicate Gemini key missing"
    
    def test_tutorial_module_works(self):
        """Verify tutorial module also works"""
        response = requests.post(
            f"{BASE_URL}/api/modules/content",
            json={"module": "tutorial", "app_locale": "en"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Tutorial module failed: {response.text[:200]}"
        data = response.json()
        assert data["module"] == "tutorial"
    
    def test_roleplay_module_works(self):
        """Verify roleplay module also works"""
        response = requests.post(
            f"{BASE_URL}/api/modules/content",
            json={"module": "roleplay", "app_locale": "en"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Roleplay module failed: {response.text[:200]}"
        data = response.json()
        assert data["module"] == "roleplay"
    
    def test_invalid_module_returns_400(self):
        """Verify invalid module name returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/modules/content",
            json={"module": "invalid_module"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid module, got {response.status_code}"


class TestOtherMobileEndpoints:
    """Test other mobile endpoints are still working"""
    
    def test_ping_endpoint(self):
        """Verify ping endpoint works"""
        response = requests.get(f"{BASE_URL}/api/ping")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "chingu-speak"
    
    def test_translate_endpoint(self):
        """Verify translate endpoint works"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={"text": "Hello", "source_lang": "en", "target_lang": "ko"},
            headers={"Content-Type": "application/json"}
        )
        # May return 503 if no LLM key, but should not be 404
        assert response.status_code != 404, "Translate endpoint returned 404"
    
    def test_public_languages(self):
        """Verify public languages endpoint works"""
        response = requests.get(f"{BASE_URL}/api/public/languages")
        assert response.status_code == 200
        data = response.json()
        assert "languages" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
