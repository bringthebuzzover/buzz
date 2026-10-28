"""Skip rate is a percentage in [0, 100] on every path that stores or returns it.

Graph's ``reels_skip_rate`` of 62.8 means 62.8%. Treating that number as a
0–1 ratio and multiplying by 100 rendered "6280%" on the brand drop page
(org posts and admin View as share the same field).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest

from app.jobs.metric_sync import _apply_insights
from app.models.social_post import SocialPost
from app.schemas.brands import BrandDropPostItem
from app.schemas.posts import PostResponse
from app.services.insight_units import clamp_reels_skip_rate
from app.services.instagram import _parse_insight_value


def test_clamp_keeps_graph_percentage_and_caps_at_100() -> None:
    assert clamp_reels_skip_rate(None) is None
    assert clamp_reels_skip_rate(0) == 0
    assert clamp_reels_skip_rate(0.4) == pytest.approx(0.4)
    assert clamp_reels_skip_rate(62.8) == pytest.approx(62.8)
    assert clamp_reels_skip_rate(100) == 100
    assert clamp_reels_skip_rate(100.4) == 100
    assert clamp_reels_skip_rate(6280) == 100
    assert clamp_reels_skip_rate(-4) == 0
    assert clamp_reels_skip_rate(float("nan")) is None
    assert clamp_reels_skip_rate(float("inf")) is None
    assert clamp_reels_skip_rate("nope") is None


def test_parse_insight_value_keeps_the_raw_graph_number() -> None:
    """Clamping happens when the column is written, not when Graph is parsed."""

    assert _parse_insight_value("reels_skip_rate", 62.8) == pytest.approx(62.8)
    assert _parse_insight_value("reels_skip_rate", 6280) == 6280
    assert _parse_insight_value("reach", "10") == 10


def _post() -> SocialPost:
    return SocialPost(
        id=uuid.uuid4(),
        org_id=uuid.uuid4(),
        platform="instagram",
        external_id="ig_media_1789",
        url="https://instagram.com/reel/example-post",
        caption="Campus philanthropy caption",
        media_type="VIDEO",
        media_product_type="REELS",
        posted_at=datetime.now(timezone.utc),
        likes=1,
        comments=0,
    )


def test_apply_insights_stores_percentage_points(
    caplog: pytest.LogCaptureFixture,
) -> None:
    post = _post()
    with caplog.at_level("WARNING", logger="app.jobs.metric_sync"):
        _apply_insights(post, {"reach": 300, "reels_skip_rate": 62.8})
    assert post.reels_skip_rate == pytest.approx(62.8)
    assert post.insights_raw is not None
    assert post.insights_raw["reels_skip_rate"] == pytest.approx(62.8)
    assert post.reach == 300
    assert caplog.records == []

    caplog.clear()
    with caplog.at_level("WARNING", logger="app.jobs.metric_sync"):
        _apply_insights(post, {"reels_skip_rate": 6280})
    assert post.reels_skip_rate == 100
    assert post.insights_raw is not None
    assert post.insights_raw["reels_skip_rate"] == 6280
    assert len(caplog.records) == 1
    message = caplog.records[0].getMessage()
    assert str(post.id) in message
    assert post.external_id in message
    assert "6280" in message
    assert post.caption not in message
    assert post.url not in message
    assert str(post.org_id) not in message


def test_apply_insights_logs_non_finite_skip_rate_without_storing_it(
    caplog: pytest.LogCaptureFixture,
) -> None:
    post = _post()
    with caplog.at_level("WARNING", logger="app.jobs.metric_sync"):
        _apply_insights(post, {"reach": 10, "reels_skip_rate": float("nan")})
    assert post.reels_skip_rate is None
    assert post.insights_raw == {"reach": 10}
    assert len(caplog.records) == 1
    message = caplog.records[0].getMessage()
    assert str(post.id) in message
    assert post.external_id in message
    assert "nan" in message


def _post_response(skip_rate: float) -> PostResponse:
    now = datetime.now(timezone.utc)
    return PostResponse(
        id=uuid.uuid4(),
        org_id=uuid.uuid4(),
        platform="instagram",
        external_id="ig",
        url="https://instagram.com/reel/x",
        media_url=None,
        thumbnail_url=None,
        caption="reel",
        media_type="VIDEO",
        media_product_type="REELS",
        posted_at=now,
        likes=1,
        comments=0,
        reach=10,
        views=20,
        saved=0,
        shares=0,
        reposts=None,
        total_interactions=1,
        profile_visits=None,
        profile_activity=None,
        follows=None,
        ig_reels_avg_watch_time=1200,
        ig_reels_video_view_total_time=48000,
        reels_skip_rate=skip_rate,
        metrics_updated_at=now,
        created_at=now,
    )


def _brand_post(skip_rate: float) -> BrandDropPostItem:
    return BrandDropPostItem(
        id=uuid.uuid4(),
        url="https://instagram.com/reel/x",
        media_url=None,
        thumbnail_url=None,
        caption="reel",
        media_type="VIDEO",
        media_product_type="REELS",
        posted_at=datetime.now(timezone.utc),
        likes=31,
        comments=7,
        platform="instagram",
        reach=1029,
        views=2192,
        saved=0,
        shares=7,
        total_interactions=47,
        profile_visits=None,
        profile_activity=None,
        follows=None,
        ig_reels_avg_watch_time=9600,
        ig_reels_video_view_total_time=11880000,
        reels_skip_rate=skip_rate,
    )


def test_org_and_brand_responses_share_the_percentage_unit() -> None:
    """Org posts and brand drop posts (admin View as uses the brand payload)."""

    org = _post_response(62.8)
    brand = _brand_post(62.8)
    assert org.reels_skip_rate == pytest.approx(62.8)
    assert brand.reels_skip_rate == pytest.approx(62.8)

    assert _post_response(6280).reels_skip_rate == 100
    assert _brand_post(6280).reels_skip_rate == 100
    assert _post_response(0.4).reels_skip_rate == pytest.approx(0.4)
    assert _brand_post(-2).reels_skip_rate == 0
