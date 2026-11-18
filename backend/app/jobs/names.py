"""Canonical background job names (architecture §10 / run_job.py).

Import these constants wherever a job name is stored or filtered (runner,
``job_runs``, admin health pipeline) so renames cannot drift.
"""

from __future__ import annotations

from typing import Final

JOB_NOTIFY_REMINDERS: Final = "notify_reminders"
JOB_TOKEN_CLEANUP: Final = "token_cleanup"
JOB_AUTOLINK_SCAN: Final = "autolink_scan"
JOB_TOKEN_REFRESH: Final = "token_refresh"
JOB_METRIC_SYNC: Final = "metric_sync"
