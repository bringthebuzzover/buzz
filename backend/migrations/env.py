"""Alembic environment — async runner pulling URL/metadata from the app.

The async template ships ``run_async_migrations()``; we override only the
project-specific bits:

* ``target_metadata`` points at ``app.models.Base.metadata`` so autogenerate
  diffs the live database against the SQLAlchemy declarative tree.
* ``sqlalchemy.url`` is injected from ``app.config.settings`` instead of
  being read from ``alembic.ini`` so a single source of truth (the ``.env``
  file via pydantic-settings) drives both the FastAPI app and the migration
  runner.
* Online Postgres runs take ``pg_advisory_xact_lock`` inside the migration
  transaction so api + cron pre-deploys cannot apply the same revision in
  parallel.
"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.config import settings
from app.models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata

# Transaction-scoped Postgres lock so api + cron pre-deploys cannot apply the
# same revision in parallel (ADD COLUMN would otherwise fail on the loser).
_ALEMBIC_ADVISORY_LOCK_KEY = 737841


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        if connection.dialect.name == "postgresql":
            connection.execute(
                text("SELECT pg_advisory_xact_lock(:k)"), {"k": _ALEMBIC_ADVISORY_LOCK_KEY}
            )
        context.run_migrations()


async def run_async_migrations() -> None:
    """In this scenario we need to create an Engine
    and associate a connection with the context.

    """

    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""

    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
