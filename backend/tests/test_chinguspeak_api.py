"""
ChinguSpeak API Backend Tests
Tests for: transcribe, tts, credits, subscriptions, modules endpoints
Both Hostinger PHP backend and Preview FastAPI backend
"""
import pytest
import requests
import os

# Backend URLs
HOSTINGER_URL = "https://linen-wolf-239815.hostingersite.com"
PREVIEW_URL = "https://chinguspeak-preview.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@chinguspeak.com"
ADMIN_PASSWORD = "ChinguAdmin#2026!Secure"


class TestHostingerBackend:
    """Tests for the Hostinger PHP backend"""
    
    BASE_URL = HOSTINGER_URL
    
    def test_health_endpoint(self):
        """Test /api/health returns ok"""
        response = requests.get(f"{self.BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print(f"✓ Health endpoint working: {data}")
    
    def test_ping_endpoint(self):
        """Test /api/ping returns ok"""
        response = requests.get(f"{self.BASE_URL}/api/ping")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print(f"✓ Ping endpoint working: {data}")
    
    def test_transcribe_route_exists(self):
        """Test POST /api/transcribe route exists (should return 400 for missing audio, not 404)"""
        response = requests.post(
            f"{self.BASE_URL}/api/transcribe",
            json={},
            headers={"Content-Type": "application/json"}
        )
        # Should return 400 (bad request for missing audio) or 503 (no key), NOT 404
        if response.status_code == 404:
            pytest.fail(f"CRITICAL: /api/transcribe route returns 404 - route not deployed. Response: {response.text}")
        print(f"✓ Transcribe route exists, status: {response.status_code}, response: {response.text[:200]}")
    
    def test_tts_route_exists(self):
        """Test POST /api/tts route exists (should return 400 for missing text, not 404)"""
        response = requests.post(
            f"{self.BASE_URL}/api/tts",
            json={},
            headers={"Content-Type": "application/json"}
        )
        # Should return 400 (bad request for missing text) or 503 (no key), NOT 404
        if response.status_code == 404:
            pytest.fail(f"CRITICAL: /api/tts route returns 404 - route not deployed. Response: {response.text}")
        print(f"✓ TTS route exists, status: {response.status_code}, response: {response.text[:200]}")
    
    def test_credits_me_route_exists(self):
        """Test GET /api/credits/me route exists (should return 401 for missing auth, not 404)"""
        response = requests.get(f"{self.BASE_URL}/api/credits/me")
        # Should return 401 (unauthorized), NOT 404
        if response.status_code == 404:
            pytest.fail(f"CRITICAL: /api/credits/me route returns 404 - route not deployed. Response: {response.text}")
        print(f"✓ Credits/me route exists, status: {response.status_code}, response: {response.text[:200]}")
    
    def test_credits_reward_route_exists(self):
        """Test POST /api/credits/reward route exists (should return 401 for missing auth, not 404)"""
        response = requests.post(
            f"{self.BASE_URL}/api/credits/reward",
            json={"source": "test"},
            headers={"Content-Type": "application/json"}
        )
        # Should return 401 (unauthorized), NOT 404
        if response.status_code == 404:
            pytest.fail(f"CRITICAL: /api/credits/reward route returns 404 - route not deployed. Response: {response.text}")
        print(f"✓ Credits/reward route exists, status: {response.status_code}, response: {response.text[:200]}")
    
    def test_credits_events_route_exists(self):
        """Test GET /api/credits/events route exists (should return 401 for missing auth, not 404)"""
        response = requests.get(f"{self.BASE_URL}/api/credits/events")
        # Should return 401 (unauthorized), NOT 404
        if response.status_code == 404:
            pytest.fail(f"CRITICAL: /api/credits/events route returns 404 - route not deployed. Response: {response.text}")
        print(f"✓ Credits/events route exists, status: {response.status_code}, response: {response.text[:200]}")
    
    def test_subscriptions_verify_route_exists(self):
        """Test POST /api/subscriptions/verify route exists (should return 401 for missing auth, not 404)"""
        response = requests.post(
            f"{self.BASE_URL}/api/subscriptions/verify",
            json={"product_id": "test", "purchase_token": "test"},
            headers={"Content-Type": "application/json"}
        )
        # Should return 401 (unauthorized), NOT 404
        if response.status_code == 404:
            pytest.fail(f"CRITICAL: /api/subscriptions/verify route returns 404 - route not deployed. Response: {response.text}")
        print(f"✓ Subscriptions/verify route exists, status: {response.status_code}, response: {response.text[:200]}")
    
    def test_modules_content_route_exists(self):
        """Test POST /api/modules/content route exists"""
        response = requests.post(
            f"{self.BASE_URL}/api/modules/content",
            json={"module": "tutorial", "app_locale": "en"},
            headers={"Content-Type": "application/json"}
        )
        # Should return 200/400/503, NOT 404
        if response.status_code == 404:
            pytest.fail(f"CRITICAL: /api/modules/content route returns 404 - route not deployed. Response: {response.text}")
        print(f"✓ Modules/content route exists, status: {response.status_code}, response: {response.text[:200]}")
    
    def test_translate_route_exists(self):
        """Test POST /api/translate route exists"""
        response = requests.post(
            f"{self.BASE_URL}/api/translate",
            json={"text": "hello", "source_lang": "en", "target_lang": "ko"},
            headers={"Content-Type": "application/json"}
        )
        # Should not return 404
        if response.status_code == 404:
            pytest.fail(f"CRITICAL: /api/translate route returns 404 - route not deployed. Response: {response.text}")
        print(f"✓ Translate route exists, status: {response.status_code}, response: {response.text[:200]}")
    
    def test_chat_route_exists(self):
        """Test POST /api/chat route exists"""
        response = requests.post(
            f"{self.BASE_URL}/api/chat",
            json={"session_id": "test-session", "message": "hello"},
            headers={"Content-Type": "application/json"}
        )
        # Should not return 404
        if response.status_code == 404:
            pytest.fail(f"CRITICAL: /api/chat route returns 404 - route not deployed. Response: {response.text}")
        print(f"✓ Chat route exists, status: {response.status_code}, response: {response.text[:200]}")


class TestPreviewBackend:
    """Tests for the Preview FastAPI backend"""
    
    BASE_URL = PREVIEW_URL
    
    def test_health_endpoint(self):
        """Test /api/health returns ok"""
        response = requests.get(f"{self.BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print(f"✓ Preview health endpoint working: {data}")
    
    def test_ping_endpoint(self):
        """Test /api/ping returns ok"""
        response = requests.get(f"{self.BASE_URL}/api/ping")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print(f"✓ Preview ping endpoint working: {data}")
    
    def test_transcribe_route_exists(self):
        """Test POST /api/transcribe route exists on preview"""
        response = requests.post(
            f"{self.BASE_URL}/api/transcribe",
            json={},
            headers={"Content-Type": "application/json"}
        )
        # Should return 422 (validation error for missing audio), NOT 404
        if response.status_code == 404:
            pytest.fail(f"Preview /api/transcribe route returns 404. Response: {response.text}")
        assert response.status_code == 422, f"Expected 422 for missing audio_base64, got {response.status_code}"
        print(f"✓ Preview transcribe route exists, status: {response.status_code}")
    
    def test_tts_route_exists(self):
        """Test POST /api/tts route exists on preview"""
        response = requests.post(
            f"{self.BASE_URL}/api/tts",
            json={},
            headers={"Content-Type": "application/json"}
        )
        # Should return 422 (validation error for missing text), NOT 404
        if response.status_code == 404:
            pytest.fail(f"Preview /api/tts route returns 404. Response: {response.text}")
        assert response.status_code == 422, f"Expected 422 for missing text, got {response.status_code}"
        print(f"✓ Preview TTS route exists, status: {response.status_code}")
    
    def test_credits_me_route_missing(self):
        """Test GET /api/credits/me - expected to be missing on preview FastAPI"""
        response = requests.get(f"{self.BASE_URL}/api/credits/me")
        # This route is NOT implemented in preview FastAPI backend
        print(f"Preview credits/me status: {response.status_code} (expected 404 - not implemented)")
        if response.status_code == 404:
            print("⚠ /api/credits/me NOT implemented in preview FastAPI backend")
    
    def test_modules_content_route_missing(self):
        """Test POST /api/modules/content - expected to be missing on preview FastAPI"""
        response = requests.post(
            f"{self.BASE_URL}/api/modules/content",
            json={"module": "tutorial"},
            headers={"Content-Type": "application/json"}
        )
        # This route is NOT implemented in preview FastAPI backend
        print(f"Preview modules/content status: {response.status_code} (expected 404 - not implemented)")
        if response.status_code == 404:
            print("⚠ /api/modules/content NOT implemented in preview FastAPI backend")
    
    def test_translate_route_works(self):
        """Test POST /api/translate works on preview"""
        response = requests.post(
            f"{self.BASE_URL}/api/translate",
            json={"text": "hello", "source_lang": "en", "target_lang": "ko"},
            headers={"Content-Type": "application/json"}
        )
        # Should work (200) or fail with LLM error (500/503), NOT 404
        assert response.status_code != 404, f"Translate route returns 404: {response.text}"
        print(f"✓ Preview translate route exists, status: {response.status_code}")
    
    def test_chat_route_works(self):
        """Test POST /api/chat works on preview"""
        response = requests.post(
            f"{self.BASE_URL}/api/chat",
            json={"session_id": "test-session-preview", "message": "hello"},
            headers={"Content-Type": "application/json"}
        )
        # Should work (200) or fail with LLM error (500/503), NOT 404
        assert response.status_code != 404, f"Chat route returns 404: {response.text}"
        print(f"✓ Preview chat route exists, status: {response.status_code}")


class TestPublicEndpoints:
    """Tests for public config endpoints"""
    
    @pytest.mark.parametrize("base_url", [HOSTINGER_URL, PREVIEW_URL])
    def test_public_languages(self, base_url):
        """Test /api/public/languages returns languages list"""
        response = requests.get(f"{base_url}/api/public/languages")
        assert response.status_code == 200, f"Public languages failed on {base_url}: {response.text}"
        data = response.json()
        assert "languages" in data
        print(f"✓ Public languages on {base_url}: {len(data['languages'])} languages")
    
    @pytest.mark.parametrize("base_url", [HOSTINGER_URL, PREVIEW_URL])
    def test_public_scenarios(self, base_url):
        """Test /api/public/scenarios returns scenarios list"""
        response = requests.get(f"{base_url}/api/public/scenarios")
        assert response.status_code == 200, f"Public scenarios failed on {base_url}: {response.text}"
        data = response.json()
        assert "scenarios" in data
        print(f"✓ Public scenarios on {base_url}: {len(data['scenarios'])} scenarios")
    
    @pytest.mark.parametrize("base_url", [HOSTINGER_URL, PREVIEW_URL])
    def test_public_settings(self, base_url):
        """Test /api/public/settings returns settings"""
        response = requests.get(f"{base_url}/api/public/settings")
        assert response.status_code == 200, f"Public settings failed on {base_url}: {response.text}"
        data = response.json()
        assert "items" in data
        print(f"✓ Public settings on {base_url}: {len(data['items'])} settings")


class TestAdminAuth:
    """Tests for admin authentication"""
    
    @pytest.mark.parametrize("base_url", [HOSTINGER_URL, PREVIEW_URL])
    def test_admin_login(self, base_url):
        """Test admin login works"""
        response = requests.post(
            f"{base_url}/api/admin-auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Admin login failed on {base_url}: {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"✓ Admin login successful on {base_url}")
        return data["access_token"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
