/**
 * DemoClock — drives the demo's time-based behavior:
 *
 * 1. A 1-second `now` tick used by countdowns and "now" derivations.
 * 2. A slow ~10-second metric jitter that nudges likes/comments on posts linked to
 *    `drop_active` campaigns (PRODUCT.md §4.3 — periodic refresh).
 * 3. A scheduled-transition runner that advances `Drop.brandTrackerStage` based on
 *    `scheduledTransitions[]` baked into seed data or written by the brand request flow.
 *    When a drop transitions to `drop_active`, accepted applications inherit the
 *    derived `Active` org-side status automatically (no extra writes needed since
 *    org status is derived in `utils/orgCampaignStatus`).
 *
 * The clock starts as soon as the provider mounts. It is safe under React 18 strict
 * mode: timers are torn down + recreated on remount, and storage writes are idempotent
 * for stages already past the target.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { applicationsStore } from "../data/store/applicationsStore";
import { dropsStore } from "../data/store/dropsStore";
import { linksStore } from "../data/store/linksStore";
import { postsStore } from "../data/store/postsStore";
import { brandTrackerStore } from "../data/store/brandTrackerStore";
import { BRAND_DROP_TRACKER_ORDER } from "../types/brandPortal";

type DemoClockValue = {
  /** A monotonically increasing timestamp updated every second. */
  now: number;
};

const DemoClockContext = createContext<DemoClockValue | null>(null);

/** Tick frequency for the `now` clock (drives countdowns). */
const NOW_TICK_MS = 1000;

/** Slow metric refresh frequency (drives the "live" engagement feel). */
const METRICS_TICK_MS = 10_000;

/** Scheduled-transition pump frequency. */
const TRANSITION_TICK_MS = 2000;

/** Random integer between 0 and `max` (inclusive). */
function jitter(max: number): number {
  return Math.floor(Math.random() * (max + 1));
}

export function DemoClockProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState<number>(() => Date.now());

  /** 1s tick — drives countdowns. */
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, NOW_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  /** Metric jitter — only touches posts linked to currently-active drops. */
  useEffect(() => {
    const id = window.setInterval(() => {
      const drops = dropsStore.getAll();
      const activeDropIds = new Set(
        drops
          .filter((d) => d.brandTrackerStage === "drop_active")
          .map((d) => d.id)
      );
      if (activeDropIds.size === 0) return;
      const links = linksStore.getAll();
      const activePostIds = new Set(
        links.filter((l) => activeDropIds.has(l.dropId)).map((l) => l.postId)
      );
      if (activePostIds.size === 0) return;
      const posts = postsStore.getAll();
      const updated = posts.map((p) => {
        if (!activePostIds.has(p.id)) return p;
        const dLikes = jitter(8);
        const dComments = jitter(2);
        if (dLikes === 0 && dComments === 0) return p;
        return {
          ...p,
          metrics: {
            likes: p.metrics.likes + dLikes,
            comments: p.metrics.comments + dComments,
            fetchedAt: Date.now(),
          },
        };
      });
      postsStore.replaceAll(updated);
    }, METRICS_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  /**
   * Scheduled-transition pump — for any drop with `scheduledTransitions[]`, advance
   * the brand tracker stage when the relative offset has elapsed since `createdAt`.
   * Skips transitions that target a stage at-or-before the drop's current stage.
   */
  useEffect(() => {
    const id = window.setInterval(() => {
      const drops = dropsStore.getAll();
      let touched = false;
      for (const drop of drops) {
        if (!drop.scheduledTransitions?.length) continue;
        const currentIdx = BRAND_DROP_TRACKER_ORDER.indexOf(
          drop.brandTrackerStage
        );
        const due = drop.scheduledTransitions
          .filter((t) => Date.now() - drop.createdAt >= t.offsetMs)
          .filter(
            (t) => BRAND_DROP_TRACKER_ORDER.indexOf(t.toStage) > currentIdx
          )
          .sort(
            (a, b) =>
              BRAND_DROP_TRACKER_ORDER.indexOf(a.toStage) -
              BRAND_DROP_TRACKER_ORDER.indexOf(b.toStage)
          );
        if (due.length === 0) continue;
        // Apply the latest reachable stage in one shot, but record an event per stage.
        const target = due[due.length - 1];
        const trackingNumber =
          due.find((d) => d.assignTrackingNumber)?.assignTrackingNumber ??
          drop.trackingNumber;
        dropsStore.setBrandTrackerStage(drop.id, target.toStage, trackingNumber);
        for (const transition of due) {
          brandTrackerStore.insert({
            id: `evt-${drop.id}-${transition.toStage}-${transition.offsetMs}`,
            dropId: drop.id,
            stage: transition.toStage,
            occurredAt: drop.createdAt + transition.offsetMs,
            note:
              transition.assignTrackingNumber != null
                ? `Tracking #${transition.assignTrackingNumber}`
                : undefined,
          });
        }
        // When entering drop_active, mirror tracking number onto accepted applications.
        if (
          target.toStage === "drop_active" ||
          target.toStage === "awaiting_products"
        ) {
          if (trackingNumber) {
            const apps = applicationsStore.getAll();
            const updated = apps.map((a) =>
              a.dropId === drop.id && a.decision === "accepted"
                ? { ...a, trackingNumber }
                : a
            );
            applicationsStore.replaceAll(updated);
          }
        }
        touched = true;
      }
      if (touched) {
        // Force a tick refresh so any countdowns/derived statuses recompute now.
        setNow(Date.now());
      }
    }, TRANSITION_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const value = useMemo<DemoClockValue>(() => ({ now }), [now]);

  return (
    <DemoClockContext.Provider value={value}>
      {children}
    </DemoClockContext.Provider>
  );
}

/** Returns the demo clock's `now` (ms). */
export function useDemoNow(): number {
  const ctx = useContext(DemoClockContext);
  if (!ctx) {
    throw new Error("useDemoNow must be used within DemoClockProvider");
  }
  return ctx.now;
}
