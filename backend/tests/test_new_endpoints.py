"""Tests for NEW/CHANGED endpoints added in this session.

Focus: ping, health, delete-account, admin login, CORS.
"""
import time
import pytest
import requests
from datetime import datetime, timezone


class TestPing:
    """Test GET /api/ping endpoint."""
    
    def test_ping_returns_200_with_correct_structure(self, api_client, base_url):
        """Ping must return 200 with {status, service, ts}."""
        start = time.time()
        r = api_client.get(f"{base_url}/api/ping")
        elapsed_ms = (time.time() - start) * 1000
        
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        
        # Check structure
        assert "status" in data, f"Missing 'status' in response: {data}"
        assert "service" in data, f"Missing 'service' in response: {data}"
        assert "ts" in data, f"Missing 'ts' in response: {data}"
        
        # Check values
        assert data["status"] == "ok", f"Expected status='ok', got {data['status']}"
        assert data["service"] == "chingu-speak", f"Expected service='chingu-speak', got {data['service']}"
        
        # Validate ISO-8601 timestamp
        try:
            ts = datetime.fromisoformat(data["ts"].replace("Z", "+00:00"))
            assert ts.tzinfo is not None, "Timestamp must include timezone"
        except Exception as e:
            pytest.fail(f"Invalid ISO-8601 timestamp '{data['ts']}': {e}")
        
        # Response time check (should be <500ms)
        assert elapsed_ms < 500, f"Ping took {elapsed_ms:.0f}ms, expected <500ms"


class TestHealth:
    """Test GET /api/health endpoint."""
    
    def test_health_returns_200_with_ok_status(self, api_client, base_url):
        """Health must return 200 with {status: ok}."""
        r = api_client.get(f"{base_url}/api/health")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("status") == "ok", f"Expected status='ok', got {data}"


class TestDeleteAccount:
    """Test DELETE /api/auth/delete-account endpoint."""
    
    def test_delete_account_no_token_guest_delete(self, api_client, base_url):
        """DELETE without token must return {deleted: true, guest: true}."""
        # Create a session without Authorization header
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        r = session.delete(f"{base_url}/api/auth/delete-account")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        
        assert data.get("deleted") is True, f"Expected deleted=true, got {data}"
        assert data.get("guest") is True, f"Expected guest=true, got {data}"
    
    def test_delete_account_with_valid_token(self, api_client, base_url):
        """DELETE with valid user token must delete user and return correct response."""
        # 1. Register a new user
        import uuid
        email = f"test_delete_{uuid.uuid4().hex[:8]}@example.com"
        password = "testpass123"
        
        reg_r = api_client.post(f"{base_url}/api/auth/register", json={
            "email": email,
            "password": password,
            "name": "Test Delete User"
        })
        assert reg_r.status_code == 200, f"Registration failed: {reg_r.text}"
        reg_data = reg_r.json()
        token = reg_data["access_token"]
        user_id = reg_data["user"]["id"]
        
        # 2. Verify user exists via /api/auth/me
        me_r = api_client.get(
            f"{base_url}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_r.status_code == 200, f"User verification failed: {me_r.text}"
        
        # 3. Delete account
        del_r = api_client.delete(
            f"{base_url}/api/auth/delete-account",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert del_r.status_code == 200, f"Delete failed: {del_r.text}"
        del_data = del_r.json()
        
        assert del_data.get("deleted") is True, f"Expected deleted=true, got {del_data}"
        assert del_data.get("guest") is False, f"Expected guest=false, got {del_data}"
        assert del_data.get("user_id") == user_id, f"Expected user_id={user_id}, got {del_data}"
        
        # 4. Verify user is actually deleted (GET /api/auth/me should fail)
        verify_r = api_client.get(
            f"{base_url}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert verify_r.status_code == 404, f"Expected 404 after delete, got {verify_r.status_code}"
    
    def test_delete_account_with_invalid_token(self, api_client, base_url):
        """DELETE with invalid/expired token must return 401."""
        invalid_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlIiwic2NvcGUiOiJ1c2VyIn0.invalid"
        
        r = api_client.delete(
            f"{base_url}/api/auth/delete-account",
            headers={"Authorization": f"Bearer {invalid_token}"}
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"


class TestAdminLogin:
    """Test POST /api/admin/login endpoint."""
    
    def test_admin_login_correct_credentials(self, api_client, base_url):
        """Admin login with correct credentials must return JWT token."""
        r = api_client.post(f"{base_url}/api/admin/login", json={
            "username": "chingunadi",
            "password": "0644782611"
        })
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        
        assert "access_token" in data, f"Missing access_token in response: {data}"
        assert data.get("token_type") == "bearer", f"Expected token_type='bearer', got {data}"
        
        token = data["access_token"]
        assert len(token) > 20, f"Token seems too short: {token}"
        
        # Verify token works against /api/admin/stats
        stats_r = api_client.get(
            f"{base_url}/api/admin/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert stats_r.status_code == 200, f"Token verification failed: {stats_r.text}"
        stats_data = stats_r.json()
        assert "conversations" in stats_data, f"Invalid stats response: {stats_data}"
    
    def test_admin_login_wrong_password_and_lockout(self, api_client, base_url):
        """Admin login with wrong password must return 401, and lock after 5 attempts."""
        import uuid
        # Use a unique username to avoid interfering with other tests
        fake_username = f"fake_admin_{uuid.uuid4().hex[:8]}"
        
        # Attempt 1-4: should return 401
        for attempt in range(1, 5):
            r = api_client.post(f"{base_url}/api/admin/login", json={
                "username": fake_username,
                "password": "wrongpassword"
            })
            assert r.status_code == 401, f"Attempt {attempt}: Expected 401, got {r.status_code}"
        
        # Attempt 5: should still return 401 but trigger lockout
        r5 = api_client.post(f"{base_url}/api/admin/login", json={
            "username": fake_username,
            "password": "wrongpassword"
        })
        assert r5.status_code == 401, f"Attempt 5: Expected 401, got {r5.status_code}"
        
        # Attempt 6: should return 423 (locked)
        r6 = api_client.post(f"{base_url}/api/admin/login", json={
            "username": fake_username,
            "password": "wrongpassword"
        })
        assert r6.status_code == 423, f"Attempt 6: Expected 423 (locked), got {r6.status_code}: {r6.text}"
        assert "locked" in r6.text.lower() or "too many" in r6.text.lower(), \
            f"Expected lockout message, got: {r6.text}"


class TestCORS:
    """Test CORS preflight on /api/ping."""
    
    def test_cors_preflight_on_ping(self, base_url):
        """OPTIONS /api/ping from external origin must include CORS headers."""
        # Send OPTIONS request with Origin header
        r = requests.options(
            f"{base_url}/api/ping",
            headers={
                "Origin": "https://example.com",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "content-type"
            }
        )
        
        # Should return 200 or 204 (FastAPI/Starlette CORS middleware handles OPTIONS)
        assert r.status_code in [200, 204], f"Expected 200 or 204, got {r.status_code}: {r.text}"
        
        # Check CORS headers
        headers = {k.lower(): v for k, v in r.headers.items()}
        assert "access-control-allow-origin" in headers, \
            f"Missing Access-Control-Allow-Origin header. Headers: {dict(r.headers)}"
        
        # Should allow the origin (configured as "*" in server.py)
        allow_origin = headers["access-control-allow-origin"]
        assert allow_origin in ["*", "https://example.com"], \
            f"Expected allow-origin='*' or 'https://example.com', got '{allow_origin}'"
