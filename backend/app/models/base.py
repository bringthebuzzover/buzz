"""SQLAlchemy 2.0 declarative base for every ORM model.

Stage 2 adds concrete tables (users, organizations, brands, drops, ...).
This module exists in Stage 1 so the engine in `app.deps.db` has a metadata
target ready and Alembic can autogenerate against it on day one.
"""

from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Project-wide declarative base. All ORM models subclass this."""

    pass
