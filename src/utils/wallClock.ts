/**
 * Shared 1-second wall-clock hook for countdowns and time-derived UI.
 *
 * `useWallClockNow` ticks once a second via a tiny external store, so components
 * that read "now" (e.g. `useCountdown`, the org drop feed) stay live without each
 * mounting their own interval. The store's interval only runs while something is
 * subscribed; on the server (SSR/tests) it returns a stable `Date.now()` and
 * starts no interval.
 */
import { useSyncExternalStore } from "react";

let _wallNow = 0;
const _wallListeners = new Set<() => void>();
let _wallInterval: ReturnType<typeof setInterval> | null = null;

function _subscribeWall(onChange: () => void): () => void {
  _wallListeners.add(onChange);
  if (_wallInterval === null) {
    _wallNow = Date.now();
    _wallInterval = setInterval(() => {
      _wallNow = Date.now();
      _wallListeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    _wallListeners.delete(onChange);
    if (_wallListeners.size === 0 && _wallInterval !== null) {
      clearInterval(_wallInterval);
      _wallInterval = null;
    }
  };
}

function _getWall(): number {
  return _wallNow || Date.now();
}

export function useWallClockNow(): number {
  return useSyncExternalStore(_subscribeWall, _getWall, _getWall);
}
