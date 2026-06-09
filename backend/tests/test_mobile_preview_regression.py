"""Regression tests for mobile preview/static routes and admin auth integration."""

import os
from pathlib import Path

import pytest
import requests


def _base_url() -> str:
    """Resolve public app URL from env, then fallback to test credentials file."""
    env_url = (os.environ.get("REACT_APP_BACKEND_URL") or "").strip().rstrip("/")
    if env_url:
        return env_url

    creds_path = Path("/app/memory/test_credentials.md")
    if creds_path.exists():
        for line in creds_path.read_text(encoding="utf-8").splitlines():
            if line.lower().startswith("- admin url:"):
                url = line.split(":", 1)[1].strip().rstrip("/")
                if url:
                    if url.endswith("/login"):
                        url = url[: -len("/login")]
                    return url

    pytest.skip("Public base URL not configured in REACT_APP_BACKEND_URL or test_credentials.md")


BASE_URL = _base_url()
API_BASE = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def http_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# Module: backend API connectivity and admin auth
def test_api_health_ok(http_session):
    r = http_session.get(f"{API_BASE}/health", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("status") == "ok"


# Module: static mobile web export routes
def test_mobile_root_no_unmatched_route(http_session):
    r = http_session.get(f"{BASE_URL}/mobile/", timeout=20)
    assert r.status_code == 200
    body = r.text
    assert "Unmatched Route" not in body
    assert "<div id=\"root\"></div>" in body


# Module: direct deep link route for camera page
def test_mobile_camera_no_unmatched_route(http_session):
    r = http_session.get(f"{BASE_URL}/mobile/camera", timeout=20)
    assert r.status_code in (200, 301, 302), r.text
    body = r.text
    assert "Unmatched Route" not in body


# Module: admin authentication endpoint basic contract
def test_admin_login_works(http_session):
    email = os.environ.get("ADMIN_EMAIL", "admin@chinguspeak.com")
    password = os.environ.get("ADMIN_PASSWORD", "ChinguAdmin#2026!Secure")
    r = http_session.post(
        f"{API_BASE}/admin-auth/login",
        json={"email": email, "password": password},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data.get("access_token"), str) and len(data["access_token"]) > 16
    assert data.get("admin", {}).get("email") == email
