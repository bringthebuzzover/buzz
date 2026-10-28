"""Units for Instagram insight fields that are not whole counts.

Graph ``reels_skip_rate`` is a percentage on the closed interval 0–100.
A value of 62.8 means 62.8% of initial views skipped in the first 3 seconds.
It is not a 0–1 ratio. Scaling it by 100 renders impossible figures such as
6280%.

Reel watch times (``ig_reels_avg_watch_time``, ``ig_reels_video_view_total_time``)
are milliseconds. Every other stored insight is a whole count. Skip rate is
the only rate metric.
"""

from __future__ import annotations

import math


def clamp_reels_skip_rate(value: object) -> float | None:
    """Return a skip rate as a percentage in ``[0, 100]``, or ``None`` if absent.

    Non-finite numbers become ``None`` so callers can omit the metric instead
    of storing ``NaN``. Values outside 0–100 are clamped.
    """

    if value is None:
        return None
    try:
        number = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    if number < 0:
        return 0.0
    if number > 100:
        return 100.0
    return number
