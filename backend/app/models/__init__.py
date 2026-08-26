"""SQLAlchemy ORM model registry.

Importing this module is the single side-effect required to populate
``Base.metadata`` with every table — both the FastAPI app and Alembic's
``env.py`` rely on that. We list every class in ``__all__`` (no wildcard
imports) so the dependency surface stays obvious and ``ruff`` will flag
unused models if a table ever drops out.
"""

from app.models.application import DropApplication
from app.models.base import Base
from app.models.brand import Brand
from app.models.brand_invite_token import BrandInviteToken
from app.models.drop import Drop
from app.models.job_run import JobRun
from app.models.notify_me import NotifyMe
from app.models.org_connect_token import OrgConnectToken
from app.models.organization import Organization
from app.models.password_reset_token import PasswordResetToken
from app.models.post_link import PostCampaignLink
from app.models.post_suggestion import PostCampaignSuggestion
from app.models.social_post import SocialPost
from app.models.tracker_event import DropTrackerEvent
from app.models.user import User
from app.models.verification_token import EmailVerificationToken

__all__ = [
    "Base",
    "Brand",
    "BrandInviteToken",
    "Drop",
    "DropApplication",
    "DropTrackerEvent",
    "EmailVerificationToken",
    "JobRun",
    "NotifyMe",
    "OrgConnectToken",
    "Organization",
    "PasswordResetToken",
    "PostCampaignLink",
    "PostCampaignSuggestion",
    "SocialPost",
    "User",
]
