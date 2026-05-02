/**
 * `useCountdown` — given a target timestamp, returns the remaining { days, hours,
 * minutes, seconds, done } using the demo clock's tick. `done` flips true once
 * `now >= target`.
 */
import { useMemo } from "react";
import { useDemoNow } from "../contexts/DemoClockContext";

export type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True when the target time has been reached or passed. */
  done: boolean;
};

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

export function useCountdown(targetMs: number): Countdown {
  const now = useDemoNow();
  return useMemo(() => {
    const remainingMs = targetMs - now;
    if (remainingMs <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
    }
    const totalSeconds = Math.floor(remainingMs / MS_PER_SECOND);
    const totalMinutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
    const totalHours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
    const days = Math.floor(totalHours / HOURS_PER_DAY);
    return {
      days,
      hours: totalHours % HOURS_PER_DAY,
      minutes: totalMinutes % MINUTES_PER_HOUR,
      seconds: totalSeconds % SECONDS_PER_MINUTE,
      done: false,
    };
  }, [now, targetMs]);
}
