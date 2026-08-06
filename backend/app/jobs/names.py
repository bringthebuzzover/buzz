"""Canonical background job names (architecture §10 / run_job.py).

Import these constants wherever a job name is stored or filtered (runner,
``job_runs``, admin health pipeline) so renames cannot drift.
"""

from __future__ import annotations

from typing import Final

JOB_DROP_AUTOCLOSE: Final = "drop_autoclose"
JOB_NOTIFY_REMINDERS: Final = "notify_reminders"
JOB_TOKEN_CLEANUP: Final = "token_cleanup"
JOB_AUTOLINK_SCAN: Final = "autolink_scan"
JOB_TOKEN_REFRESH: Final = "token_refresh"
JOB_METRIC_SYNC: Final = "metric_sync"

ALL_JOB_NAMES: Final[tuple[str, ...]] = (
    JOB_DROP_AUTOCLOSE,
    JOB_NOTIFY_REMINDERS,
    JOB_TOKEN_CLEANUP,
    JOB_AUTOLINK_SCAN,
    JOB_TOKEN_REFRESH,
    JOB_METRIC_SYNC,
)
