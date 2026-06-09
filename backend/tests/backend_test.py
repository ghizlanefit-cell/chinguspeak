"""ChinguSpeak Admin Backend regression test (FastAPI mirror).

Covers: auth/login + lockout-bypass-on-success, /auth/me, 401 protection,
dashboard overview, LLM keys CRUD + reveal + test, settings upsert,
users list + search + plan toggle, languages add + dup conflict, scenarios add,
admins list + cannot-delete-self.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://chinguspeak-preview.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@chinguspeak.com"
ADMIN_PASSWORD = "ChinguAdmin#2026!Secure"


# -------- fixtures -------- #
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def token(session):
    r = session.post(f"{API}/admin-auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# -------- Auth -------- #
class TestAuth:
    def test_health(self, session):
        r = session.get(f"{API}/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_admin_login_success(self, session):
        r = session.post(f"{API}/admin-auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data and len(data["access_token"]) > 20
        assert data["admin"]["email"] == ADMIN_EMAIL
        assert data["admin"]["role"] == "super_admin"

    def test_admin_login_wrong_password(self, session):
        r = session.post(f"{API}/admin-auth/login", json={"email": ADMIN_EMAIL, "password": "WRONG-pw-xyz"})
        assert r.status_code == 401

    def test_me_with_token(self, session, auth):
        r = session.get(f"{API}/admin-auth/me", headers=auth)
        assert r.status_code == 200
        assert r.json()["admin"]["email"] == ADMIN_EMAIL

    def test_protected_without_token(self, session):
        r = session.get(f"{API}/admin-auth/me")
        assert r.status_code == 401

    def test_old_auth_login_is_now_user_route(self, session):
        # /api/auth/login is now the MOBILE-USER auth route (not admin).
        # Posting admin creds there must NOT return a super_admin token.
        r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        # Either 401 (no such user in users collection) or 200 but with a user shape (no role=super_admin).
        if r.status_code == 200:
            assert "admin" not in r.json(), "old /auth/login still returns admin shape!"


# -------- Dashboard -------- #
class TestDashboard:
    def test_overview(self, session, auth):
        r = session.get(f"{API}/dashboard/overview", headers=auth)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "stats" in data
        st = data["stats"]
        for k in ("total_users", "conversations", "active_users", "revenue_usd"):
            assert k in st
        assert isinstance(data["growth_series"], list) and len(data["growth_series"]) > 0
        assert isinstance(data["conversations_series"], list)
        assert isinstance(data["top_languages"], list)

    def test_dashboard_unauth(self, session):
        r = session.get(f"{API}/dashboard/overview")
        assert r.status_code == 401


# -------- LLM keys -------- #
class TestLLMKeys:
    def test_list_seeded(self, session, auth):
        r = session.get(f"{API}/llm-keys", headers=auth)
        assert r.status_code == 200
        items = r.json()["items"]
        providers = {x["provider"] for x in items}
        assert {"emergent", "openai", "anthropic", "gemini"}.issubset(providers)

    def test_masked_vs_reveal(self, session, auth):
        # create a key with a real-looking value first
        body = {"provider": "openai", "label": "TEST_mask", "api_key": "sk-mask-test-1234567890ABCD",
                "model": "gpt-4o", "balance": 5, "is_active": False}
        c = session.post(f"{API}/llm-keys", json=body, headers=auth)
        assert c.status_code == 200, c.text
        key_id = c.json()["id"]

        masked = session.get(f"{API}/llm-keys", headers=auth).json()["items"]
        rev = session.get(f"{API}/llm-keys?reveal=true", headers=auth).json()["items"]
        m = next(x for x in masked if x["id"] == key_id)
        rv = next(x for x in rev if x["id"] == key_id)
        assert "*" in m["api_key"]
        assert rv["api_key"] == body["api_key"]
        # cleanup
        session.delete(f"{API}/llm-keys/{key_id}", headers=auth)

    def test_full_crud(self, session, auth):
        body = {"provider": "openai", "label": "TEST_QA_" + uuid.uuid4().hex[:6],
                "api_key": "sk-qa-test-1234567890XX", "model": "gpt-4o",
                "balance": 25, "is_active": True}
        c = session.post(f"{API}/llm-keys", json=body, headers=auth)
        assert c.status_code == 200
        created = c.json()
        key_id = created["id"]
        assert created["label"] == body["label"]

        # GET to verify persistence
        items = session.get(f"{API}/llm-keys?reveal=true", headers=auth).json()["items"]
        got = next((x for x in items if x["id"] == key_id), None)
        assert got and got["api_key"] == body["api_key"]
        assert got["balance"] == 25

        # PATCH
        u = session.patch(f"{API}/llm-keys/{key_id}", json={"label": "TEST_QA_updated"}, headers=auth)
        assert u.status_code == 200
        items2 = session.get(f"{API}/llm-keys?reveal=true", headers=auth).json()["items"]
        assert next(x for x in items2 if x["id"] == key_id)["label"] == "TEST_QA_updated"

        # TEST endpoint
        t = session.post(f"{API}/llm-keys/{key_id}/test", headers=auth)
        assert t.status_code == 200
        assert t.json()["has_api_key"] is True

        # DELETE
        d = session.delete(f"{API}/llm-keys/{key_id}", headers=auth)
        assert d.status_code == 200
        assert d.json()["deleted"] == 1
        items3 = session.get(f"{API}/llm-keys", headers=auth).json()["items"]
        assert not any(x["id"] == key_id for x in items3)


# -------- Settings -------- #
class TestSettings:
    def test_list_seeded(self, session, auth):
        r = session.get(f"{API}/settings", headers=auth)
        assert r.status_code == 200
        keys = {x["key"] for x in r.json()["items"]}
        for k in ("app_name", "active_llm_provider", "free_tier_daily_limit",
                  "pro_price_usd", "maintenance_mode"):
            assert k in keys

    def test_upsert_persists(self, session, auth):
        new_msg = "TEST welcome " + uuid.uuid4().hex[:6]
        body = {"key": "welcome_message", "value": new_msg, "category": "general", "description": "x"}
        r = session.put(f"{API}/settings/welcome_message", json=body, headers=auth)
        assert r.status_code == 200, r.text
        assert r.json()["value"] == new_msg
        # confirm via GET
        listed = session.get(f"{API}/settings?category=general", headers=auth).json()["items"]
        got = next(x for x in listed if x["key"] == "welcome_message")
        assert got["value"] == new_msg


# -------- Users -------- #
class TestUsers:
    def test_seeded_five(self, session, auth):
        r = session.get(f"{API}/users", headers=auth)
        assert r.status_code == 200
        users = r.json()["items"]
        names = {u["name"] for u in users}
        expected = {"Sarah Kim", "John Smith", "Yuki Tanaka", "Maria Garcia", "Pierre Dubois"}
        assert expected.issubset(names), f"missing demo users: {expected - names}"

    def test_search_sarah(self, session, auth):
        r = session.get(f"{API}/users?q=sarah", headers=auth)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 1
        assert any("Sarah" in u["name"] for u in items)

    def test_toggle_pro(self, session, auth):
        users = session.get(f"{API}/users", headers=auth).json()["items"]
        target = next(u for u in users if u["name"] == "John Smith")
        new_val = not target["is_pro"]
        r = session.patch(f"{API}/users/{target['id']}", json={"is_pro": new_val}, headers=auth)
        assert r.status_code == 200
        # verify
        users2 = session.get(f"{API}/users", headers=auth).json()["items"]
        got = next(u for u in users2 if u["id"] == target["id"])
        assert got["is_pro"] == new_val
        # restore
        session.patch(f"{API}/users/{target['id']}", json={"is_pro": target["is_pro"]}, headers=auth)


# -------- Languages -------- #
class TestLanguages:
    def test_seeded_six(self, session, auth):
        r = session.get(f"{API}/languages", headers=auth)
        assert r.status_code == 200
        codes = {x["code"] for x in r.json()["items"]}
        assert {"en", "ko", "ar-ma", "fr", "es", "ja"}.issubset(codes)

    def test_add_and_dup(self, session, auth):
        code = "TEST" + uuid.uuid4().hex[:4]
        body = {"code": code, "name": "TestLang", "flag": "🏳", "tts_voice": "alloy", "is_active": True}
        r = session.post(f"{API}/languages", json=body, headers=auth)
        assert r.status_code == 200
        dup = session.post(f"{API}/languages", json=body, headers=auth)
        assert dup.status_code == 409
        # cleanup
        session.delete(f"{API}/languages/{code}", headers=auth)


# -------- Scenarios -------- #
class TestScenarios:
    def test_seeded_five(self, session, auth):
        r = session.get(f"{API}/scenarios", headers=auth)
        assert r.status_code == 200
        titles = {x["title"] for x in r.json()["items"]}
        assert {"Order at a Cafe", "Job Interview", "Book a Hotel", "At the Airport",
                "Daily Conversation"}.issubset(titles)

    def test_add_scenario(self, session, auth):
        body = {"title": "TEST_scenario_" + uuid.uuid4().hex[:6], "description": "qa",
                "language": "en", "difficulty": "beginner", "prompt": "qa prompt",
                "is_active": True, "icon": "test"}
        r = session.post(f"{API}/scenarios", json=body, headers=auth)
        assert r.status_code == 200
        sid = r.json()["id"]
        # cleanup
        session.delete(f"{API}/scenarios/{sid}", headers=auth)


# -------- Admins -------- #
class TestAdmins:
    def test_list_has_super_admin(self, session, auth):
        r = session.get(f"{API}/admins", headers=auth)
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(a["email"] == ADMIN_EMAIL for a in items)

    def test_cannot_delete_self(self, session, auth):
        me = session.get(f"{API}/admin-auth/me", headers=auth).json()["admin"]
        r = session.delete(f"{API}/admins/{me['id']}", headers=auth)
        assert r.status_code == 400


# ============================================================== #
# ============= NEW: mobile + public + integration ============== #
# ============================================================== #

USER_EMAIL = "testuser@chinguspeak.com"
USER_PASSWORD = "test1234"
USER_NAME = "QA Tester"


@pytest.fixture(scope="session")
def user_token(session):
    """Login (or register if missing) the mobile-app test user and return their access_token."""
    r = session.post(f"{API}/auth/login", json={"email": USER_EMAIL, "password": USER_PASSWORD})
    if r.status_code == 401:
        reg = session.post(f"{API}/auth/register",
                           json={"email": USER_EMAIL, "password": USER_PASSWORD, "name": USER_NAME})
        assert reg.status_code in (200, 201, 409), reg.text
        r = session.post(f"{API}/auth/login", json={"email": USER_EMAIL, "password": USER_PASSWORD})
    assert r.status_code == 200, f"user login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def user_auth(user_token):
    return {"Authorization": f"Bearer {user_token}", "Content-Type": "application/json"}


# -------- Ping & public config -------- #
class TestPing:
    def test_ping(self, session):
        r = session.get(f"{API}/ping")
        assert r.status_code == 200
        body = r.json()
        assert body.get("status") == "ok"
        assert body.get("service") == "chingu-speak"


class TestPublicConfig:
    def test_active_llm_no_apikey_leak(self, session):
        r = session.get(f"{API}/public/active-llm")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "provider" in data and "model" in data and "label" in data
        # CRITICAL: api_key MUST NEVER leak from a public endpoint
        assert "api_key" not in data, f"api_key leaked: {data}"

    def test_public_scenarios(self, session):
        r = session.get(f"{API}/public/scenarios")
        assert r.status_code == 200
        data = r.json()
        assert "scenarios" in data and isinstance(data["scenarios"], list)
        assert len(data["scenarios"]) >= 1

    def test_public_languages(self, session):
        r = session.get(f"{API}/public/languages")
        assert r.status_code == 200
        data = r.json()
        assert "languages" in data and isinstance(data["languages"], list)
        assert len(data["languages"]) >= 1


# -------- Mobile-user auth (POST /api/auth/*) -------- #
class TestMobileUserAuth:
    def test_login_returns_user_and_token(self, session, user_token):
        # fixture already does the work; just sanity-check shape via /auth/me
        r = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("email") == USER_EMAIL

    def test_login_wrong_password(self, session):
        r = session.post(f"{API}/auth/login",
                         json={"email": USER_EMAIL, "password": "wrong-pw-zzz"})
        assert r.status_code == 401


# -------- /api/translate (real LLM) -------- #
class TestTranslate:
    def test_translate_hello_to_ko(self, session):
        body = {"text": "Hello", "source_lang": "en", "target_lang": "ko"}
        r = session.post(f"{API}/translate", json=body, timeout=45)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "translated_text" in data and data["translated_text"].strip()
        # Should contain at least one Hangul character
        assert any("\uac00" <= ch <= "\ud7a3" for ch in data["translated_text"]), \
            f"expected Korean output, got: {data['translated_text']!r}"
        assert data.get("source_lang") == "en"
        assert data.get("target_lang") == "ko"


# -------- /api/chat (real LLM) -------- #
class TestChat:
    SESSION_ID = "qa-pytest-" + uuid.uuid4().hex[:6]

    def test_chat_reply(self, session):
        body = {"session_id": self.SESSION_ID,
                "message": "Teach me hi in Korean",
                "practice_lang": "ko"}
        r = session.post(f"{API}/chat", json=body, timeout=45)
        assert r.status_code == 200, r.text
        data = r.json()
        # Reply field can be "reply" or "message" depending on schema; accept common ones
        text = data.get("reply") or data.get("message") or data.get("response") or ""
        assert text and len(text) > 5, f"empty/short chat reply: {data!r}"

    def test_chat_history(self, session):
        # depends on the previous test having run
        r = session.get(f"{API}/chat/{self.SESSION_ID}/history")
        assert r.status_code == 200, r.text
        data = r.json()
        items = data.get("messages") or data.get("items") or data
        assert isinstance(items, list) and len(items) >= 1, f"history empty: {data!r}"


# -------- Banned-user enforcement (admin → mobile flow) -------- #
class TestBannedUserEnforcement:
    def test_ban_then_login_blocked_then_unban(self, session, auth):
        # 1. find the test user in admin's users list
        users = session.get(f"{API}/users", headers=auth).json()["items"]
        target = next((u for u in users if u["email"] == USER_EMAIL), None)
        if not target:
            # ensure user exists by registering (idempotent — 409 is fine)
            session.post(f"{API}/auth/register",
                         json={"email": USER_EMAIL, "password": USER_PASSWORD, "name": USER_NAME})
            users = session.get(f"{API}/users", headers=auth).json()["items"]
            target = next((u for u in users if u["email"] == USER_EMAIL), None)
        assert target, "test user not found in admin users list — backend isn't surfacing mobile-user signups"

        uid = target["id"]
        try:
            # 2. ban
            r = session.patch(f"{API}/users/{uid}", json={"is_banned": True}, headers=auth)
            assert r.status_code == 200, r.text

            # 3. login attempt should now be 403
            r = session.post(f"{API}/auth/login",
                             json={"email": USER_EMAIL, "password": USER_PASSWORD})
            assert r.status_code == 403, f"expected 403 after ban, got {r.status_code}: {r.text}"
            assert "suspend" in r.text.lower() or "banned" in r.text.lower()
        finally:
            # 4. always unban so other tests can re-use the user
            session.patch(f"{API}/users/{uid}", json={"is_banned": False}, headers=auth)

        # 5. login should work again
        r = session.post(f"{API}/auth/login",
                         json={"email": USER_EMAIL, "password": USER_PASSWORD})
        assert r.status_code == 200, f"login failed after unban: {r.status_code} {r.text}"
