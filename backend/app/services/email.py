"""Transactional email service (architecture §3.4, §4).

Dev mode logs to console so the developer can copy verification links from stderr.
Off-dev, mail is dispatched through **Resend** when ``RESEND_API_KEY`` is set;
with no key configured it logs (so a misconfigured deploy degrades to "no email"
rather than crashing). Sends are **best-effort**: a provider failure is logged,
never raised, so a failed email can't roll back the operation that triggered it
(account verification, brand invite, applicant denial).

Callers that need honesty (verification, Notify Me) use the returned ``bool``:
``True`` only on provider accept (HTTP 2xx) or intentional development console
success; ``False`` on unset key / HTTP error / exception.
"""

from __future__ import annotations

import logging
from datetime import datetime

import httpx

from app.brand_emails import CONTACT_EMAIL, EMAIL_FROM, OPS_CC_EMAIL
from app.config import settings

logger = logging.getLogger(__name__)

_RESEND_ENDPOINT = "https://api.resend.com/emails"


def _email_client() -> httpx.AsyncClient:
    """HTTP client for the email provider (seam for tests to inject a transport)."""
    return httpx.AsyncClient(timeout=10.0)


async def send_verification_email(
    to_email: str,
    token: str,
    *,
    org_name: str = "",
    kind: str = "signup",
) -> bool:
    """Send a .edu verification link (signup vs rotate copy)."""
    verify_url = f"{settings.FRONTEND_URL}/onboarding/verify-email?token={token}"
    name = org_name or "your organization"

    if kind == "rotate":
        subject = f"Confirm the new school email for {name}"
        text = _verification_rotate_text(verify_url, name)
        html = _verification_html(
            verify_url,
            heading=f"Confirm the new school email for {name}",
            paragraphs=[
                f"Someone requested a new school email for {name} on Buzz.",
                "Confirm this address to finish the change.",
            ],
        )
    else:
        subject = "Confirm your Buzz account"
        text = _verification_signup_text(verify_url, name)
        html = _verification_html(
            verify_url,
            heading=f"Confirm your Buzz account for {name}",
            paragraphs=[
                f"You just created a Buzz account for {name}.",
                f"Confirm this school email so we can review {name}.",
            ],
        )

    if settings.ENVIRONMENT == "development":
        logger.info(
            "\n╔══════════════════════════════════════════════════════════════╗\n"
            "║  DEV EMAIL — Verification link (copy into browser):         ║\n"
            f"║  To: {to_email:<52s}║\n"
            f"║  Kind: {kind:<50s}║\n"
            f"║  URL: {verify_url:<50s}║\n"
            "╚══════════════════════════════════════════════════════════════╝"
        )
        return True

    return await _dispatch(to_email, subject, text, html=html)


async def send_brand_invite_email(
    to_email: str,
    setup_token: str,
    *,
    brand_name: str = "",
) -> bool:
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
        return True

    return await _dispatch(to_email, subject, body)


async def send_org_approved_email(
    to_email: str,
    *,
    org_name: str = "",
    connect_token: str | None = None,
) -> bool:
    """Tell an org they are approved and must Connect Instagram (or legacy login)."""
    name = org_name or "your organization"
    if connect_token:
        connect_url = f"{settings.FRONTEND_URL}/onboarding/connect-instagram?token={connect_token}"
        subject = "Your Buzz organization is approved — connect Instagram"
        text = _org_connect_text(connect_url, name)
        html = _cta_html(
            connect_url,
            subject=subject,
            button="Connect Instagram",
            paragraphs=[
                f"Good news — {name} has been approved on Buzz.",
                "First, accept the Instagram Tester invite at "
                "instagram.com/accounts/manage_access/ (Tester Invites).",
                "Then connect the organization's Business or Creator Instagram "
                "account to finish setup.",
            ],
        )
        log_url = connect_url
    else:
        login_url = f"{settings.FRONTEND_URL}/login"
        subject = "Your Buzz organization account is approved"
        text = _org_approved_body(login_url, name)
        html = None
        log_url = login_url

    if settings.ENVIRONMENT == "development":
        logger.info(
            "\n╔══════════════════════════════════════════════════════════════╗\n"
            "║  DEV EMAIL — Org approved:                                  ║\n"
            f"║  To: {to_email:<52s}║\n"
            f"║  URL: {log_url:<50s}║\n"
            "╚══════════════════════════════════════════════════════════════╝"
        )
        return True

    return await _dispatch(to_email, subject, text, html=html)


async def send_org_apply_prefill_email(
    to_email: str,
    raw_token: str,
    *,
    org_name: str = "",
) -> bool:
    """Invite an org to finish public apply with a prefilled form."""
    subject, text, html = build_org_apply_prefill_email(raw_token, org_name=org_name)

    if settings.ENVIRONMENT == "development":
        logger.info(
            "DEV EMAIL — Org apply prefill to=%s (prefill token omitted from logs)",
            to_email,
        )
        return True

    return await _dispatch(to_email, subject, text, html=html)


def build_org_apply_prefill_email(
    raw_token: str,
    *,
    org_name: str = "",
) -> tuple[str, str, str]:
    apply_url = f"{settings.FRONTEND_URL.rstrip('/')}/org/apply?prefill={raw_token}"
    name = org_name or "your organization"
    subject = f"Finish {name}'s Buzz profile"
    text = (
        "You told us you're interested in Buzz.\n\n"
        f"Finish this profile for {name} so your organization can get access "
        "to exclusive brand partnerships. We'll fill in what we already have — "
        "confirm your campus .edu email, the organization's Instagram "
        "(Business or Creator), and a US shipping address, then submit.\n\n"
        f"{apply_url}\n\n"
        "This link expires in 30 days."
    )
    html = _cta_html(
        apply_url,
        subject=subject,
        button="Finish your profile",
        paragraphs=[
            "You told us you're interested in Buzz.",
            f"Finish this profile for {name} so your organization can get access "
            "to exclusive brand partnerships. We'll fill in what we already have — "
            "confirm your campus .edu email, the organization's Instagram "
            "(Business or Creator), and a US shipping address, then submit.",
            "This link expires in 30 days.",
        ],
    )
    return subject, text, html


_UPDATE_BRAND = "UPDATE"
_FORM_TS_FORMATS = ("%m/%d/%Y %H:%M:%S", "%m/%d/%Y %H:%M", "%m/%d/%Y")


def applied_on_from_source_row_key(key: str | None) -> str | None:
    """Prefill ``source_row_key`` prefix → 'August 30'. None if unparseable."""
    text = (key or "").strip()
    if "|" in text:
        text = text.split("|", 1)[0].strip()
    if not text:
        return None
    for fmt in _FORM_TS_FORMATS:
        try:
            dt = datetime.strptime(text, fmt)
        except ValueError:
            continue
        return f"{dt.strftime('%B')} {dt.day}"
    return None


async def send_org_apply_prefill_update_email(
    to_email: str,
    raw_token: str,
    *,
    org_name: str = "",
    contact_name: str = "",
) -> bool:
    """Invite an org that already has an UPDATE shipment to finish apply."""
    subject, text, html = build_org_apply_prefill_update_email(
        raw_token,
        org_name=org_name,
        contact_name=contact_name,
    )

    if settings.ENVIRONMENT == "development":
        logger.info(
            "DEV EMAIL — Org apply prefill UPDATE to=%s (prefill token omitted from logs)",
            to_email,
        )
        return True

    return await _dispatch(
        to_email,
        subject,
        text,
        html=html,
        cc=_ops_cc(exclude=to_email),
    )


def _first_name(contact_name: str | None) -> str:
    parts = (contact_name or "").strip().split()
    return parts[0] if parts else ""


def build_org_apply_prefill_update_email(
    raw_token: str,
    *,
    org_name: str = "",
    contact_name: str = "",
) -> tuple[str, str, str]:
    apply_url = f"{settings.FRONTEND_URL.rstrip('/')}/org/apply?prefill={raw_token}"
    login_url = f"{settings.FRONTEND_URL.rstrip('/')}/login"
    chapter = org_name or "your chapter"
    first = _first_name(contact_name)
    hi = f"Hi {first}!" if first else "Hi!"
    subject = f"Your {_UPDATE_BRAND} cases have shipped — {chapter}"
    shipped = (
        f"Your {_UPDATE_BRAND} cases have shipped and may already be at the house! "
        "If they haven't arrived yet, keep an eye out over the next few days. "
        "We're so excited for you guys to try them :)"
    )
    complete = (
        "When you have a chance, please complete your chapter's BUZZ profile "
        "using your personalized link below so we can get your account set up!"
    )
    expiry = "This link is valid for 30 days."
    login = f"Once you're set up, you can log in here: {login_url}"
    support = (
        "As a newer startup, your support means so much to us, and the content "
        "you create for this collab would mean the world! We'd love to see you "
        "make it your own, but if you need ideas or there's anything we can do "
        f"to help, email {CONTACT_EMAIL}!"
    )
    more = (
        "We also have some amazing makeup, skincare, and beverage partnerships "
        f"coming up on BUZZ, and we'd love to include {chapter} in more collabs soon."
    )
    close = f"Hope you all love {_UPDATE_BRAND}!"
    signoff = "Best,"
    team = "The BUZZ Team"
    text = (
        f"{hi}\n\n{shipped}\n\n{complete}\n\n{apply_url}\n\n{expiry}\n\n{login}\n\n"
        f"{support}\n\n{more}\n\n{close}\n\n{signoff}\n{team}"
    )
    html = _cta_html(
        apply_url,
        subject=subject,
        button="Finish your chapter's profile",
        paragraphs=[hi, shipped, complete],
        footer_paragraphs=[expiry, login, support, more, close, signoff, team],
    )
    html = html.replace(_escape(login_url), _inline_a(login_url), 1)
    html = html.replace(
        _escape(CONTACT_EMAIL),
        _inline_a(f"mailto:{CONTACT_EMAIL}", CONTACT_EMAIL),
        1,
    )
    return subject, text, html


async def send_org_denied_email(to_email: str, *, org_name: str = "") -> bool:
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
        return True

    return await _dispatch(to_email, subject, body)


async def send_org_erased_email(to_email: str, *, org_name: str = "") -> bool:
    """Confirm an org account was erased after a data-deletion request."""
    subject = "Your Buzz account data has been deleted"
    body = _org_erased_body(org_name)

    if settings.ENVIRONMENT == "development":
        logger.info(
            "\n╔══════════════════════════════════════════════════════════════╗\n"
            "║  DEV EMAIL — Org erased (data deletion):                    ║\n"
            f"║  To: {to_email:<52s}║\n"
            "╚══════════════════════════════════════════════════════════════╝"
        )
        return True

    return await _dispatch(to_email, subject, body)


async def send_brand_denied_email(to_email: str, *, brand_name: str = "") -> bool:
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
        return True

    return await _dispatch(to_email, subject, body)


async def send_org_undenied_email(to_email: str, *, org_name: str = "") -> bool:
    """Tell an org their denial was lifted and they are back under review."""
    subject = "Your Buzz application is under review again"
    name = org_name or "your organization"
    body = (
        f"Good news — access for {name} has been restored to the review queue. "
        "We'll email you again when a decision is ready."
    )

    if settings.ENVIRONMENT == "development":
        logger.info(
            "\n╔══════════════════════════════════════════════════════════════╗\n"
            "║  DEV EMAIL — Org undenied:                                  ║\n"
            f"║  To: {to_email:<52s}║\n"
            "╚══════════════════════════════════════════════════════════════╝"
        )
        return True

    return await _dispatch(to_email, subject, body)


async def send_brand_undenied_email(to_email: str, *, brand_name: str = "") -> bool:
    """Tell a brand their denial was lifted and they are back under review."""
    subject = "Your Buzz application is under review again"
    name = brand_name or "your brand"
    body = (
        f"Good news — access for {name} has been restored to the review queue. "
        "We'll email you again when a decision is ready."
    )

    if settings.ENVIRONMENT == "development":
        logger.info(
            "\n╔══════════════════════════════════════════════════════════════╗\n"
            "║  DEV EMAIL — Brand undenied:                                ║\n"
            f"║  To: {to_email:<52s}║\n"
            "╚══════════════════════════════════════════════════════════════╝"
        )
        return True

    return await _dispatch(to_email, subject, body)


async def send_application_denied_email(
    to_email: str,
    *,
    org_name: str = "",
    drop_title: str = "",
    brand_name: str = "",
) -> bool:
    """Tell an org their drop application was not selected (PRODUCT §7.1: email-only).

    Denied applicants get no My Campaigns row, so this email is the only channel
    they ever hear back on.
    """
    subject = "Update on your Buzz drop application"
    body = _application_denied_body(org_name, drop_title, brand_name)

    if settings.ENVIRONMENT == "development":
        logger.info(
            "\n╔══════════════════════════════════════════════════════════════╗\n"
            "║  DEV EMAIL — Drop application denied:                       ║\n"
            f"║  To: {to_email:<52s}║\n"
            "╚══════════════════════════════════════════════════════════════╝"
        )
        return True

    return await _dispatch(to_email, subject, body)


async def send_drop_opening_reminder_email(
    to_email: str,
    *,
    org_name: str = "",
    drop_title: str = "",
    brand_name: str = "",
) -> bool:
    """Tell an org a drop they subscribed to is about to open (§6.3.1).

    Sent by the ``notify_reminders`` job at the lead time the org picked.
    """
    feed_url = f"{settings.FRONTEND_URL}/org/browse"
    subject = f"Applications opening: {drop_title}" if drop_title else "A Buzz drop is opening"
    body = _drop_reminder_body(org_name, drop_title, brand_name, feed_url)

    if settings.ENVIRONMENT == "development":
        logger.info(
            "\n╔══════════════════════════════════════════════════════════════╗\n"
            "║  DEV EMAIL — Drop opening reminder:                         ║\n"
            f"║  To: {to_email:<52s}║\n"
            f"║  Drop: {drop_title:<50s}║\n"
            "╚══════════════════════════════════════════════════════════════╝"
        )
        return True

    return await _dispatch(to_email, subject, body)


async def send_drop_published_email(
    to_email: str,
    *,
    brand_name: str = "",
    drop_title: str = "",
    drop_url: str,
) -> bool:
    """Tell a brand their campaign is live on the org feed (LAUNCH.md Phase B)."""
    name = brand_name or "your brand"
    title = drop_title or "your campaign"
    subject = f"Your Buzz drop is live — {title}" if drop_title else "Your Buzz drop is live"
    text = (
        f"Good news — {title} for {name} is now published on Buzz.\n\n"
        f"Student orgs can see it on the Drop Feed. Monitor applicants here:\n\n"
        f"{drop_url}\n\n"
        "We'll email when there are updates that need your attention."
    )
    html = _cta_html(
        drop_url,
        subject=subject,
        button="View drop",
        paragraphs=[
            f"Good news — {title} for {name} is now published on Buzz.",
            "Student orgs can see it on the Drop Feed. Monitor applicants from your brand portal.",
        ],
    )

    if settings.ENVIRONMENT == "development":
        logger.info(
            "\n╔══════════════════════════════════════════════════════════════╗\n"
            "║  DEV EMAIL — Drop published:                                ║\n"
            f"║  To: {to_email:<52s}║\n"
            f"║  URL: {drop_url:<50s}║\n"
            "╚══════════════════════════════════════════════════════════════╝"
        )
        return True

    return await _dispatch(to_email, subject, text, html=html)


async def send_password_reset_email(
    to_email: str,
    token: str,
    *,
    portal: str,
) -> bool:
    """Send a brand or admin password-reset link."""
    path = "/brand/reset-password" if portal == "brand" else "/admin/reset-password"
    reset_url = f"{settings.FRONTEND_URL}{path}?token={token}"
    subject = "Reset your Buzz password"
    body = (
        "We received a request to reset your Buzz password.\n\n"
        f"Click the link below to choose a new password:\n\n{reset_url}\n\n"
        "If you did not request this, you can ignore this email. "
        "The link expires in one hour."
    )

    if settings.ENVIRONMENT == "development":
        logger.info(
            "\n╔══════════════════════════════════════════════════════════════╗\n"
            "║  DEV EMAIL — Password reset link:                           ║\n"
            f"║  To: {to_email:<52s}║\n"
            f"║  URL: {reset_url:<50s}║\n"
            "╚══════════════════════════════════════════════════════════════╝"
        )
        return True

    return await _dispatch(to_email, subject, body)


def _ops_cc(*, exclude: str) -> list[str]:
    """CONTACT_EMAIL + OPS_CC_EMAIL, skipping blanks, dupes, and the To address."""
    skip = {exclude.strip().lower()}
    out: list[str] = []
    seen: set[str] = set()
    for addr in (CONTACT_EMAIL, OPS_CC_EMAIL):
        v = addr.strip()
        key = v.lower()
        if not v or key in skip or key in seen:
            continue
        seen.add(key)
        out.append(v)
    return out


async def _dispatch(
    to_email: str,
    subject: str,
    body: str,
    *,
    html: str | None = None,
    cc: list[str] | None = None,
) -> bool:
    """Send one email through Resend. Best-effort: never raises.

    Returns ``True`` on HTTP 2xx provider accept, ``False`` on unset key /
    HTTP error / exception. With no ``RESEND_API_KEY`` configured this logs
    and returns False, so a deploy that hasn't wired email yet degrades
    gracefully instead of 500-ing the flows that send mail.
    """
    if not settings.RESEND_API_KEY:
        logger.warning("Email not sent (RESEND_API_KEY unset): to=%s subject=%s", to_email, subject)
        return False
    payload: dict[str, object] = {
        "from": EMAIL_FROM,
        "to": [to_email],
        "subject": subject,
        "text": body,
        "reply_to": CONTACT_EMAIL,
    }
    if html:
        payload["html"] = html
    if cc:
        payload["cc"] = cc
    try:
        async with _email_client() as client:
            resp = await client.post(
                _RESEND_ENDPOINT,
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json=payload,
            )
            resp.raise_for_status()
            resend_id = None
            try:
                resend_id = resp.json().get("id")
            except Exception:  # noqa: BLE001 — body parse is best-effort
                resend_id = None
    except Exception:  # noqa: BLE001 — email is best-effort; log, don't break the caller
        logger.exception("Email send failed: to=%s subject=%s", to_email, subject)
        return False
    logger.info(
        "Email dispatched: to=%s subject=%s resend_id=%s",
        to_email,
        subject,
        resend_id,
    )
    return True


def _verification_signup_text(verify_url: str, org_name: str) -> str:
    return (
        f"You just created a Buzz account for {org_name}.\n\n"
        f"Confirm this school email so we can review {org_name}.\n\n"
        f"Verify email:\n{verify_url}\n\n"
        "This link expires in 24 hours.\n\n"
        "If you didn't create this account, ignore this email."
    )


def _verification_rotate_text(verify_url: str, org_name: str) -> str:
    return (
        f"Someone requested a new school email for {org_name} on Buzz.\n\n"
        "Confirm this address to finish the change.\n\n"
        f"Verify email:\n{verify_url}\n\n"
        "This link expires in 24 hours.\n\n"
        "If you didn't request this, ignore this email."
    )


def _verification_body(verify_url: str, org_name: str) -> str:
    """Backward-compatible alias (signup). Prefer ``_verification_signup_text``."""
    return _verification_signup_text(verify_url, org_name or "your organization")


def _org_connect_text(connect_url: str, org_name: str) -> str:
    return (
        f"Good news — {org_name} has been approved on Buzz.\n\n"
        "1. Accept the Instagram Tester invite at "
        "https://www.instagram.com/accounts/manage_access/ (Tester Invites).\n"
        "2. Connect your organization's Business or Creator Instagram:\n\n"
        f"{connect_url}\n\n"
        "This link expires in 7 days."
    )


_CORAL = "#E85D4C"
_CREAM = "#FBF7F0"
_INK = "#1A1A1A"


def _verification_html(verify_url: str, *, heading: str, paragraphs: list[str]) -> str:
    return _cta_html(
        verify_url,
        subject=heading,
        button="Verify email",
        paragraphs=paragraphs + ["This link expires in 24 hours."],
    )


def _cta_html(
    url: str,
    *,
    subject: str,
    button: str,
    paragraphs: list[str],
    footer_paragraphs: list[str] | None = None,
) -> str:
    paras = "".join(
        f'<p style="margin:0 0 16px;color:{_INK};font-size:16px;line-height:1.5;">'
        f"{_escape(p)}</p>"
        for p in paragraphs
    )
    footer = "".join(
        f'<p style="margin:16px 0 0;color:{_INK};font-size:16px;line-height:1.5;">'
        f"{_escape(p)}</p>"
        for p in (footer_paragraphs or [])
    )
    # Force the light Buzz palette in clients that invert for dark mode
    # (Apple Mail / some Gmail). Exact hexes match the light template.
    dark_lock = (
        f"<style>:root{{color-scheme:light only;supported-color-schemes:light}}"
        f"@media (prefers-color-scheme:dark){{"
        f".buzz-mail{{background-color:{_CREAM}!important;color:{_INK}!important}}"
        f".buzz-mail-card{{background-color:#ffffff!important;color:{_INK}!important}}"
        f".buzz-mail h1,.buzz-mail p{{color:{_INK}!important;"
        f"background-color:transparent!important}}"
        f".buzz-mail a{{color:{_CORAL}!important}}"
        f".buzz-mail a.buzz-mail-btn{{color:#ffffff!important;"
        f"background-color:{_CORAL}!important}}"
        f".buzz-mail-muted{{color:#666666!important}}"
        f"}}</style>"
    )
    return (
        f'<!DOCTYPE html><html lang="en" style="color-scheme:light only;">'
        f'<head><meta charset="utf-8"/>'
        f'<meta name="color-scheme" content="light only"/>'
        f'<meta name="supported-color-schemes" content="light"/>'
        f"{dark_lock}</head>"
        f'<body class="buzz-mail" bgcolor="{_CREAM}" style="margin:0;padding:24px;'
        f"background-color:{_CREAM};color:{_INK};"
        f'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">'
        f'<div class="buzz-mail-card" bgcolor="#ffffff" style="max-width:520px;'
        f"margin:0 auto;background-color:#ffffff;padding:32px;border-radius:12px;"
        f'color:{_INK};">'
        f'<h1 style="margin:0 0 20px;font-size:22px;color:{_INK};">{_escape(subject)}</h1>'
        f"{paras}"
        f'<p style="margin:24px 0;"><a class="buzz-mail-btn" href="{_escape(url)}" '
        f'style="display:inline-block;background-color:{_CORAL};color:#ffffff;'
        f"text-decoration:none;padding:12px 24px;border-radius:8px;"
        f'font-weight:600;">{_escape(button)}</a></p>'
        f'<p class="buzz-mail-muted" style="margin:0;color:#666666;font-size:13px;'
        f'line-height:1.5;">Or paste this link:<br/>{_inline_a(url)}</p>'
        f"{footer}"
        f"</div></body></html>"
    )


def _inline_a(href: str, label: str | None = None) -> str:
    lab = _escape(label if label is not None else href)
    return (
        f'<a href="{_escape(href)}" style="color:{_CORAL};text-decoration:underline;">' f"{lab}</a>"
    )


def _escape(value: str) -> str:
    return (
        value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
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


def _org_erased_body(org_name: str) -> str:
    name = org_name or "your organization"
    return (
        f"We've completed your data deletion request for {name} on Buzz.\n\n"
        "Your Buzz login identity, contact details, and Instagram credentials "
        "on file have been removed or anonymized. Campaign participation metrics "
        "tied to past drops may be retained in anonymized form for brand reporting.\n\n"
        "If you have questions, reply to this email."
    )


def _drop_reminder_body(
    org_name: str,
    drop_title: str,
    brand_name: str,
    feed_url: str,
) -> str:
    name = org_name or "your organization"
    drop = f'"{drop_title}"' if drop_title else "a drop"
    brand = f" from {brand_name}" if brand_name else ""
    # Wording holds whether this lands just before the window opens or on the
    # first catch-up run for a drop that already opened.
    return (
        f"You asked us to remind {name} about {drop}{brand} on Buzz — "
        "applications are opening now.\n\n"
        f"Apply from your Drop Feed:\n\n{feed_url}\n\n"
        "Spots are limited and close when capacity fills."
    )


def _application_denied_body(org_name: str, drop_title: str, brand_name: str) -> str:
    name = org_name or "your organization"
    drop = f' for "{drop_title}"' if drop_title else ""
    brand = f" by {brand_name}" if brand_name else ""
    return (
        f"Thanks for applying{drop}{brand} on Buzz. After review, {name} was not "
        "selected for this drop. Keep an eye on your Drop Feed — new opportunities "
        "open regularly, and you're welcome to apply again."
    )
