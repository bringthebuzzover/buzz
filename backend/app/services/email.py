"""Transactional email service (architecture §3.4, §4).

Dev mode logs to console so the developer can copy verification links from stderr.
In production this would dispatch through Resend / SendGrid / SES.
"""

from __future__ import annotations

import logging

from app.config import settings

logger = logging.getLogger(__name__)


async def send_verification_email(
    to_email: str,
    token: str,
    *,
    org_name: str = "",
) -> None:
    """Send a .edu verification link to the org contact."""
    verify_url = f"{settings.FRONTEND_URL}/onboarding/verify-email?token={token}"

    subject = "Verify your Buzz organization email"
    body = _verification_body(verify_url, org_name)

    if settings.ENVIRONMENT == "development":
        logger.info(
            "\n╔══════════════════════════════════════════════════════════════╗\n"
            "║  DEV EMAIL — Verification link (copy into browser):         ║\n"
            f"║  To: {to_email:<52s}║\n"
            f"║  URL: {verify_url:<50s}║\n"
            "╚══════════════════════════════════════════════════════════════╝"
        )
        return

    # Production path: dispatch through email provider.
    await _dispatch(to_email, subject, body)


async def send_brand_invite_email(
    to_email: str,
    setup_token: str,
    *,
    brand_name: str = "",
) -> None:
    """Send a brand account-setup invitation link."""
    setup_url = f"{settings.FRONTEND_URL}/brand/setup?token={setup_token}"

    subject = (
        f"Set up your Buzz account — {brand_name}" if brand_name else "Set up your Buzz account"
    )
    body = _brand_invite_body(setup_url, brand_name)

    if settings.ENVIRONMENT == "development":
        logger.info(
            "\n╔══════════════════════════════════════════════════════════════╗\n"
            "║  DEV EMAIL — Brand invite link:                             ║\n"
            f"║  To: {to_email:<52s}║\n"
            f"║  URL: {setup_url:<50s}║\n"
            "╚══════════════════════════════════════════════════════════════╝"
        )
        return

    await _dispatch(to_email, subject, body)


async def send_org_approved_email(to_email: str, *, org_name: str = "") -> None:
    """Tell an org their account was approved and they can sign in."""
    login_url = f"{settings.FRONTEND_URL}/login"
    subject = "Your Buzz organization account is approved"
    body = _org_approved_body(login_url, org_name)

    if settings.ENVIRONMENT == "development":
        logger.info(
            "\n╔══════════════════════════════════════════════════════════════╗\n"
            "║  DEV EMAIL — Org approved:                                  ║\n"
            f"║  To: {to_email:<52s}║\n"
            f"║  URL: {login_url:<50s}║\n"
            "╚══════════════════════════════════════════════════════════════╝"
        )
        return

    await _dispatch(to_email, subject, body)


async def send_org_denied_email(to_email: str, *, org_name: str = "") -> None:
    """Tell an org their application was not approved."""
    subject = "Update on your Buzz application"
    body = _org_denied_body(org_name)

    if settings.ENVIRONMENT == "development":
        logger.info(
            "\n╔══════════════════════════════════════════════════════════════╗\n"
            "║  DEV EMAIL — Org denied:                                    ║\n"
            f"║  To: {to_email:<52s}║\n"
            "╚══════════════════════════════════════════════════════════════╝"
        )
        return

    await _dispatch(to_email, subject, body)


async def send_brand_denied_email(to_email: str, *, brand_name: str = "") -> None:
    """Tell a brand their application was not approved."""
    subject = "Update on your Buzz application"
    name = brand_name or "your brand"
    body = (
        f"Thanks for your interest in Buzz. After review, {name} was not "
        "approved at this time. Reply to this email if you'd like another look."
    )

    if settings.ENVIRONMENT == "development":
        logger.info(
            "\n╔══════════════════════════════════════════════════════════════╗\n"
            "║  DEV EMAIL — Brand denied:                                  ║\n"
            f"║  To: {to_email:<52s}║\n"
            "╚══════════════════════════════════════════════════════════════╝"
        )
        return

    await _dispatch(to_email, subject, body)


async def _dispatch(to_email: str, subject: str, body: str) -> None:
    """Dispatch through the configured email provider."""
    # Resend / SendGrid / SES integration goes here when needed.
    logger.info("Email dispatched: to=%s subject=%s", to_email, subject)


def _verification_body(verify_url: str, org_name: str) -> str:
    name = org_name or "your organization"
    return (
        f"Click the link below to verify your email for {name} on Buzz.\n\n"
        f"{verify_url}\n\n"
        "This link expires in 24 hours."
    )


def _brand_invite_body(setup_url: str, brand_name: str) -> str:
    name = brand_name or "your brand"
    return (
        f"Your brand ({name}) has been approved on Buzz!\n\n"
        f"Click the link below to set up your account password:\n\n"
        f"{setup_url}\n\n"
        "This link expires in 7 days."
    )


def _org_approved_body(login_url: str, org_name: str) -> str:
    name = org_name or "your organization"
    return (
        f"Good news — {name} has been approved on Buzz!\n\n"
        f"Sign in to start browsing drops:\n\n"
        f"{login_url}"
    )


def _org_denied_body(org_name: str) -> str:
    name = org_name or "your organization"
    return (
        f"Thanks for your interest in Buzz. After review, {name} was not "
        "approved at this time. If you think this was a mistake, reply to this "
        "email and our team will take another look."
    )
