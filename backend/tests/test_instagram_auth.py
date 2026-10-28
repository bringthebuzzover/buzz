"""Instagram OAuth login + callback flow (architecture.md §3.4).

Uses ``FakeInstagramClient`` (via ``fake_instagram``) so no network/secrets
are needed. ``app_client`` shares the rolled-back ``db_session``.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

import httpx
import jwt as pyjwt
from httpx import AsyncClient
from sqlalchemy import select

from app import errors
from app.config import settings
from app.exceptions import BuzzAPIException
from app.models.user import User
from app.security import jwt
from tests.conftest import FakeInstagramClient, set_request_cookies


async def test_login_redirects_with_state(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient
) -> None:
    resp = await app_client.get("/api/auth/instagram/login", follow_redirects=False)
    assert resp.status_code == 302
    location = resp.headers["location"]
    parsed = urlparse(location)
    query = parse_qs(parsed.query)
    assert parsed.fragment == "weblink"
    assert query["response_type"] == ["code"]
    assert "client_id" in query
    assert "scope" in query
    # The state must be a valid, decodable oauth_state token.
    state = query["state"][0]
    payload = jwt.decode_token(state, expected_type=jwt.OAUTH_STATE_TOKEN_TYPE)
    assert payload.type == "oauth_state"
    # The state is also bound to the browser via a cookie.
    assert "buzz_oauth_state" in resp.headers.get("set-cookie", "")


async def _begin_login(client: AsyncClient) -> str:
    """Drive ``/login`` to get a state whose cookie is now in the client jar."""

    resp = await client.get("/api/auth/instagram/login", follow_redirects=False)
    location = resp.headers["location"]
    return parse_qs(urlparse(location).query)["state"][0]


async def test_callback_unknown_ig_requires_apply(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    """Unknown Graph id must not INSERT — apply-first (LAUNCH Phase A)."""
    fake_instagram.account_type = "BUSINESS"
    fake_instagram.user_id = "ig_business_1"
    state = await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "oauth-code", "state": state},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == errors.ORG_APPLY_REQUIRED
    user = await db_session.scalar(select(User).where(User.instagram_user_id == "ig_business_1"))
    assert user is None


async def test_callback_denied_user_forbidden(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    """A returning denied account must not receive fresh tokens (B14)."""
    from app.models.enums import OrgUserStatus
    from tests.conftest import make_user, persist

    fake_instagram.account_type = "BUSINESS"
    fake_instagram.user_id = "ig_denied_1"
    await persist(
        db_session,
        make_user(status=OrgUserStatus.DENIED, instagram_user_id="ig_denied_1"),
    )
    state = await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": state},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "ACCOUNT_DENIED"


async def test_callback_media_creator_unknown_requires_apply(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient
) -> None:
    fake_instagram.account_type = "Media_Creator"
    state = await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": state},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == errors.ORG_APPLY_REQUIRED


async def test_callback_personal_account_rejected(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient
) -> None:
    fake_instagram.account_type = "PERSONAL"
    state = await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": state},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INSTAGRAM_PERSONAL_ACCOUNT"


async def test_callback_bad_state_invalid(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient
) -> None:
    # Even with a started login (valid cookie), a garbage state must fail.
    await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": "not-a-valid-token"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == errors.OAUTH_STATE_INVALID


async def test_callback_without_state_cookie_invalid(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient
) -> None:
    # No /login first → no state cookie → CSRF binding fails even though the
    # state is a validly-signed token.
    state = jwt.create_oauth_state_token()
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": state},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == errors.OAUTH_STATE_INVALID


async def test_callback_state_cookie_mismatch_invalid(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient
) -> None:
    # Cookie from a real login, but a *different* valid state submitted →
    # double-submit mismatch → 401.
    await _begin_login(app_client)
    other_state = jwt.create_oauth_state_token()
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": other_state},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == errors.OAUTH_STATE_INVALID


async def test_returning_active_user_not_downgraded(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    from app.models.enums import OrgUserStatus
    from tests.conftest import make_user, persist

    fake_instagram.user_id = "ig_return_1"
    await persist(
        db_session,
        make_user(status=OrgUserStatus.ACTIVE, instagram_user_id="ig_return_1"),
    )
    await db_session.commit()

    state = await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c2", "state": state},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["user"]["status"] == "active"


async def test_relogin_syncs_instagram_username(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    """Renamed IG username must update the user row on re-login."""
    from app.models.enums import OrgUserStatus
    from tests.conftest import make_org, make_user, persist

    fake_instagram.user_id = "ig_rename_1"
    fake_instagram.username = "newchapter"
    user = await persist(
        db_session,
        make_user(status=OrgUserStatus.ACTIVE, instagram_user_id="ig_rename_1"),
    )
    user.instagram_username = "oldchapter"
    await make_org(db_session, user)
    await db_session.commit()

    state = await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": state},
    )
    assert resp.status_code == 200

    await db_session.refresh(user)
    assert user.instagram_username == "newchapter"
    assert user.instagram_granted_permissions == (
        "instagram_business_basic,instagram_business_manage_insights"
    )


async def test_callback_persists_granted_permissions_in_response_order(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    from app.models.enums import OrgUserStatus
    from tests.conftest import make_user, persist

    fake_instagram.user_id = "ig_perms_1"
    fake_instagram.granted_permissions = (
        "instagram_business_manage_insights",
        "instagram_business_basic",
    )
    user = await persist(
        db_session,
        make_user(status=OrgUserStatus.ACTIVE, instagram_user_id="ig_perms_1"),
    )
    await db_session.commit()

    state = await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": state},
    )
    assert resp.status_code == 200
    await db_session.refresh(user)
    assert user.instagram_granted_permissions == (
        "instagram_business_manage_insights,instagram_business_basic"
    )


async def test_callback_omitted_permissions_keeps_stored_grant(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    from app.models.enums import OrgUserStatus
    from tests.conftest import make_user, persist

    fake_instagram.user_id = "ig_perms_keep"
    fake_instagram.granted_permissions = None
    user = await persist(
        db_session,
        make_user(status=OrgUserStatus.ACTIVE, instagram_user_id="ig_perms_keep"),
    )
    user.instagram_granted_permissions = "instagram_business_basic"
    await db_session.commit()

    state = await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": state},
    )
    assert resp.status_code == 200
    await db_session.refresh(user)
    assert user.instagram_granted_permissions == "instagram_business_basic"


async def test_relogin_taken_handle_409(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    """Graph rename onto another org's claimed handle must 409, not 500."""
    from app.models.enums import OrgUserStatus
    from tests.conftest import make_org, make_user, persist

    peer = await persist(
        db_session,
        make_user(
            status=OrgUserStatus.PENDING_EMAIL_VERIFICATION,
            instagram_username="newchapter",
        ),
    )
    await make_org(db_session, peer, org_name="Peer Org")

    fake_instagram.user_id = "ig_rename_taken"
    fake_instagram.username = "newchapter"
    user = await persist(
        db_session,
        make_user(
            status=OrgUserStatus.ACTIVE,
            instagram_user_id="ig_rename_taken",
            instagram_username="oldchapter",
        ),
    )
    await make_org(db_session, user)
    await db_session.commit()

    state = await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": state},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == errors.INSTAGRAM_HANDLE_TAKEN
    await db_session.refresh(user)
    assert user.instagram_username == "oldchapter"


async def test_callback_expired_state_invalid(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient
) -> None:
    # An expired (but correctly-signed) state token, with a matching cookie so
    # the double-submit check passes, must still be rejected on decode.
    now = datetime.now(timezone.utc)
    expired = pyjwt.encode(
        {
            "sub": "oauth",
            "type": jwt.OAUTH_STATE_TOKEN_TYPE,
            "nonce": "n",
            "iat": now - timedelta(minutes=30),
            "exp": now - timedelta(minutes=20),
            "jti": "j",
        },
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    set_request_cookies(app_client, {settings.OAUTH_STATE_COOKIE_NAME: expired})
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": expired},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == errors.OAUTH_STATE_INVALID


async def test_callback_instagram_failure_returns_error(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, monkeypatch
) -> None:
    # The real client maps an Instagram HTTP failure during code exchange to a
    # typed 401 (see services.instagram._ig_error). The callback must surface
    # that error envelope rather than a partial login.
    async def _boom(_code: str):
        raise BuzzAPIException(
            code=errors.UNAUTHORIZED,
            message="Instagram code exchange failed.",
            status_code=401,
        )

    monkeypatch.setattr(fake_instagram, "exchange_code", _boom)
    state = await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": state},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_callback_accepts_documented_meta_token_wrap(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    """Replay the production 401: Meta 200 with ``data[{access_token}]``.

    SPA POST /api/auth/instagram/callback used to map that body to UNAUTHORIZED
    ("Instagram didn't hand Buzz a session"). The real HTTP client must mint
    a session instead.
    """

    from app.main import app
    from app.models.enums import OrgUserStatus
    from app.services.instagram import HttpInstagramClient, get_instagram_client
    from tests.conftest import make_user, persist

    await persist(
        db_session,
        make_user(status=OrgUserStatus.ACTIVE, instagram_user_id="1020"),
    )
    await db_session.commit()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            return httpx.Response(
                200,
                json={
                    "data": [
                        {
                            "access_token": "EAAC-short",
                            "user_id": "1020",
                            "permissions": "instagram_business_basic",
                        }
                    ]
                },
            )
        if request.url.path.endswith("/access_token"):
            return httpx.Response(
                200,
                json={
                    "access_token": "EAAC-long",
                    "token_type": "bearer",
                    "expires_in": 5183944,
                },
            )
        return httpx.Response(
            200,
            json={
                "id": "1020",
                "username": "campus",
                "account_type": "BUSINESS",
                "followers_count": 10,
            },
        )

    real = HttpInstagramClient(http=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    app.dependency_overrides[get_instagram_client] = lambda: real
    state = await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "AQBx-hBsH3", "state": state},
    )
    assert resp.status_code == 200
    assert resp.json()["error"] is None
    assert resp.json()["data"]["user"]["status"] == "active"


async def _bind_callback(
    app_client: AsyncClient,
    db_session,
    fake_instagram: FakeInstagramClient,
    *,
    ig_user_id: str,
    username: str,
    followers_count: int | None,
):
    """Drive Connect Instagram (bind-start + callback) for a pending org."""
    from app.models.enums import OrgUserStatus, PortalRole
    from tests.conftest import make_org, make_user, mint_access_token, persist

    fake_instagram.user_id = ig_user_id
    fake_instagram.username = username
    fake_instagram.followers_count = followers_count
    user = await persist(
        db_session,
        make_user(
            role=PortalRole.ORG,
            status=OrgUserStatus.PENDING_INSTAGRAM,
            instagram_user_id=None,
            instagram_username=username,
        ),
    )
    org = await make_org(db_session, user)
    org.instagram_handle_confirmed = False
    await db_session.commit()

    token = mint_access_token(user)
    start = await app_client.post(
        "/api/auth/instagram/bind-start",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert start.status_code == 200
    state = parse_qs(urlparse(start.json()["data"]["authorizeUrl"]).query)["state"][0]
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "bind-code", "state": state},
    )
    return resp, user, org


async def test_bind_saves_follower_count(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    resp, _user, org = await _bind_callback(
        app_client,
        db_session,
        fake_instagram,
        ig_user_id="ig_bind_followers",
        username="campusgreeks",
        followers_count=5150,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["user"]["status"] == "active"
    await db_session.refresh(org)
    assert org.follower_count == 5150


async def test_bind_succeeds_when_followers_count_missing(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    resp, user, org = await _bind_callback(
        app_client,
        db_session,
        fake_instagram,
        ig_user_id="ig_bind_nofollowers",
        username="nofollowers",
        followers_count=None,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["user"]["status"] == "active"
    await db_session.refresh(org)
    await db_session.refresh(user)
    assert org.follower_count is None
    assert user.instagram_user_id == "ig_bind_nofollowers"


async def test_relogin_saves_follower_count(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    from app.models.enums import OrgUserStatus
    from tests.conftest import make_org, make_user, persist

    fake_instagram.user_id = "ig_relogin_followers"
    fake_instagram.username = "chapter"
    fake_instagram.followers_count = 8800
    user = await persist(
        db_session,
        make_user(
            status=OrgUserStatus.ACTIVE,
            instagram_user_id="ig_relogin_followers",
            instagram_username="chapter",
        ),
    )
    org = await make_org(db_session, user)
    org.follower_count = 10
    await db_session.commit()

    state = await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": state},
    )
    assert resp.status_code == 200
    await db_session.refresh(org)
    assert org.follower_count == 8800


async def test_relogin_keeps_follower_count_when_graph_omits(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    from app.models.enums import OrgUserStatus
    from tests.conftest import make_org, make_user, persist

    fake_instagram.user_id = "ig_relogin_omit"
    fake_instagram.username = "omitchapter"
    fake_instagram.followers_count = None
    user = await persist(
        db_session,
        make_user(
            status=OrgUserStatus.ACTIVE,
            instagram_user_id="ig_relogin_omit",
            instagram_username="omitchapter",
        ),
    )
    org = await make_org(db_session, user)
    org.follower_count = 77
    await db_session.commit()

    state = await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": state},
    )
    assert resp.status_code == 200
    await db_session.refresh(org)
    assert org.follower_count == 77


async def test_relogin_zero_followers_overwrites(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    from app.models.enums import OrgUserStatus
    from tests.conftest import make_org, make_user, persist

    fake_instagram.user_id = "ig_relogin_zero"
    fake_instagram.username = "zerochapter"
    fake_instagram.followers_count = 0
    user = await persist(
        db_session,
        make_user(
            status=OrgUserStatus.ACTIVE,
            instagram_user_id="ig_relogin_zero",
            instagram_username="zerochapter",
        ),
    )
    org = await make_org(db_session, user)
    org.follower_count = 50
    await db_session.commit()

    state = await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": state},
    )
    assert resp.status_code == 200
    await db_session.refresh(org)
    assert org.follower_count == 0


async def test_relogin_succeeds_when_follower_count_read_fails(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session, monkeypatch
) -> None:
    """A follower-count failure must not block login or clear a stored count."""
    from app.models.enums import OrgUserStatus
    from tests.conftest import make_org, make_user, persist

    class _FollowersBoom:
        id = "ig_foll_boom"
        username = "boomorg"
        account_type = "BUSINESS"

        @property
        def followers_count(self) -> int:
            raise RuntimeError("followers graph failed")

    async def _fetch(_token: str) -> _FollowersBoom:
        return _FollowersBoom()

    monkeypatch.setattr(fake_instagram, "fetch_profile", _fetch)
    user = await persist(
        db_session,
        make_user(
            status=OrgUserStatus.ACTIVE,
            instagram_user_id="ig_foll_boom",
            instagram_username="boomorg",
        ),
    )
    org = await make_org(db_session, user)
    org.follower_count = 321
    await db_session.commit()

    state = await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": state},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["user"]["status"] == "active"
    await db_session.refresh(org)
    await db_session.refresh(user)
    assert org.follower_count == 321
    assert user.instagram_user_id == "ig_foll_boom"
    assert user.instagram_username == "boomorg"


async def test_relogin_ignores_unstorable_follower_count(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session, caplog
) -> None:
    """A count PostgreSQL cannot store must not fail login or clear the prior count."""
    from app.models.enums import OrgUserStatus
    from tests.conftest import make_org, make_user, persist

    fake_instagram.user_id = "ig_relogin_huge"
    fake_instagram.username = "hugechapter"
    fake_instagram.followers_count = 3_000_000_000
    user = await persist(
        db_session,
        make_user(
            status=OrgUserStatus.ACTIVE,
            instagram_user_id="ig_relogin_huge",
            instagram_username="hugechapter",
        ),
    )
    org = await make_org(db_session, user)
    org.follower_count = 50
    await db_session.commit()

    state = await _begin_login(app_client)
    with caplog.at_level("WARNING"):
        resp = await app_client.post(
            "/api/auth/instagram/callback",
            json={"code": "c", "state": state},
        )
    assert resp.status_code == 200
    assert resp.json()["data"]["user"]["status"] == "active"
    await db_session.refresh(org)
    assert org.follower_count == 50
    assert "3000000000" not in caplog.text
    assert "reason=invalid" in caplog.text


async def test_relogin_bool_false_does_not_zero_follower_count(
    app_client: AsyncClient, fake_instagram: FakeInstagramClient, db_session
) -> None:
    from app.models.enums import OrgUserStatus
    from tests.conftest import make_org, make_user, persist

    fake_instagram.user_id = "ig_relogin_bool"
    fake_instagram.username = "boolchapter"
    fake_instagram.followers_count = False
    user = await persist(
        db_session,
        make_user(
            status=OrgUserStatus.ACTIVE,
            instagram_user_id="ig_relogin_bool",
            instagram_username="boolchapter",
        ),
    )
    org = await make_org(db_session, user)
    org.follower_count = 50
    await db_session.commit()

    state = await _begin_login(app_client)
    resp = await app_client.post(
        "/api/auth/instagram/callback",
        json={"code": "c", "state": state},
    )
    assert resp.status_code == 200
    await db_session.refresh(org)
    assert org.follower_count == 50
