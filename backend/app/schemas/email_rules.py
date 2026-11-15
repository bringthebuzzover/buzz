"""Strict email-address validation for schemas whose address becomes a header.

An address that is only stored can be checked loosely — deliverability is the
provider's problem. An address that is handed to a mail provider as ``reply_to``
or as the ``To:`` of a send is different: CRLF inside a header value is a
header-injection surface, and a comma list silently mails strangers. So this
module is deliberately stricter than ``"@" in v`` and ``"." in domain``.

Rule (all ASCII, no surprises):

* length <= 320 (RFC 5321 practical ceiling), local part <= 64;
* no control characters (anything ``< 0x20`` or ``0x7f``);
* none of ``,`` ``;`` ``<`` ``>`` ``"`` — they split or re-quote a mailbox;
* no whitespace anywhere (internal whitespace would split the header token);
* exactly one ``@``;
* a dot-separated local part: dot-atoms only, no leading/trailing/double dot;
* a dotted domain: at least two labels, each 1–63 alphanumerics/hyphens and not
  starting or ending with a hyphen, ending in an alphabetic TLD of >= 2 chars.

The value is returned trimmed and lower-cased, which is what the rest of the
code base does with stored addresses. Quoted local parts, domain literals
(``user@[10.0.0.1]``) and non-ASCII (IDN) addresses are rejected on purpose:
none of them are needed by BUZZ, and each one is extra parsing surface.
"""

from __future__ import annotations

import re

EMAIL_MAX_LENGTH = 320
EMAIL_LOCAL_MAX_LENGTH = 64

# Characters that must never reach a header value we build. A comma list would
# add recipients; ``;``/``<>`` and quotes let a value re-interpret the mailbox.
_FORBIDDEN_CHARS = frozenset(',;<>"')

# Dot-atom per RFC 5322 (atext), minus the characters above.
_DOT_ATOM = r"[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+"
_LOCAL_RE = re.compile(rf"^{_DOT_ATOM}(?:\.{_DOT_ATOM})*$")
_DOMAIN_LABEL_RE = re.compile(r"^(?!-)[A-Za-z0-9-]{1,63}(?<!-)$")
_TLD_RE = re.compile(r"^[A-Za-z]{2,63}$")

INVALID_EMAIL_MESSAGE = "Invalid email address"


def _has_control_char(value: str) -> bool:
    return any(ord(ch) < 0x20 or ord(ch) == 0x7F for ch in value)


def is_valid_email(value: object) -> bool:
    """True when ``value`` is a single, plain, ASCII mailbox per the rule above."""

    if not isinstance(value, str):
        return False
    candidate = value.strip()
    if not candidate or len(candidate) > EMAIL_MAX_LENGTH:
        return False
    if _has_control_char(candidate):
        return False
    if any(ch in _FORBIDDEN_CHARS for ch in candidate):
        return False
    if any(ch.isspace() for ch in candidate):
        return False
    if candidate.count("@") != 1:
        return False

    local, _, domain = candidate.partition("@")
    if not local or len(local) > EMAIL_LOCAL_MAX_LENGTH:
        return False
    if not _LOCAL_RE.match(local):
        return False
    if "." not in domain:
        return False
    labels = domain.split(".")
    if not all(_DOMAIN_LABEL_RE.match(label) for label in labels):
        return False
    return bool(_TLD_RE.match(labels[-1]))


def clean_email_address(value: str) -> str:
    """Trim, lower-case, and validate. Raises ``ValueError`` on a bad address.

    The message is user-safe (it is surfaced verbatim on a form field) and says
    nothing about which check failed.
    """

    candidate = value.strip().lower()
    if not is_valid_email(candidate):
        raise ValueError(INVALID_EMAIL_MESSAGE)
    return candidate


# Domains where a plus-tag is a genuine alias of the same inbox, so abuse limits
# keyed on the exact address would be trivially bypassed by appending ``+n``.
# Restricted to the large providers that behave this way; on any other domain the
# local part is left alone, because there ``+`` may be a real, distinct mailbox.
_PLUS_ALIAS_DOMAINS = frozenset(
    {
        "gmail.com",
        "googlemail.com",
        "outlook.com",
        "hotmail.com",
        "live.com",
        "yahoo.com",
        "icloud.com",
        "me.com",
        "proton.me",
        "protonmail.com",
    }
)


# Providers whose local part ignores dots entirely.
_DOT_INSENSITIVE_DOMAINS = frozenset({"gmail.com", "googlemail.com"})


def mailbox_identity(value: str) -> str:
    """The key under which two addresses reach the same inbox.

    Used for per-recipient abuse limits only, never for validation or storage:
    ``victim+1@gmail.com`` and ``victim+2@gmail.com`` are one mailbox, so
    limiting the literal address would let a sender rotate the tag and keep
    delivering into the same inbox.
    """

    address = value.strip().lower()
    local, _, domain = address.partition("@")
    if domain in _PLUS_ALIAS_DOMAINS:
        local = local.split("+", 1)[0]
    if domain in _DOT_INSENSITIVE_DOMAINS:
        # Gmail ignores dots in the local part, so ``campus.team`` and
        # ``campusteam`` are one inbox.
        local = local.replace(".", "")
    return f"{local}@{domain}"
