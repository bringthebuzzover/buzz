---
id: ops.notify-cron-not-created
title: Notify Me reminders depend on a cron nobody has created yet
kind: ops
severity: P1
status: ops
surface: deploy
evidence:
  - path: backend/app/jobs/notify_reminders.py
    note: job exists and stamps notify_me.sent_at
  - path: DEPLOYMENT.md
    note: Railway cron-notify-reminders service not created
repro: |
  ```sql
  SELECT count(*) FROM notify_me n JOIN drops d ON d.id = n.drop_id
  WHERE n.enabled IS TRUE AND n.sent_at IS NULL
    AND d.apply_open_at <= now() AND d.apply_close_at > now();
  ```
fix_when: |
  Railway cron-notify-reminders exists and invokes the job; unsent due count stops climbing.
---

`notify_reminders` (`app/jobs/notify_reminders.py`) now emails subscribers and stamps
`notify_me.sent_at`, but the Railway `cron-notify-reminders` service does not exist
yet, so nothing invokes it in production. Until it is created, the query below keeps
climbing. The first run after it is created mails every already-due subscription.

```sql
SELECT count(*) FROM notify_me n JOIN drops d ON d.id = n.drop_id
WHERE n.enabled IS TRUE AND n.sent_at IS NULL
  AND d.apply_open_at <= now() AND d.apply_close_at > now();
```

Note `enabled = false` is never written by any code path (`set_notify` always writes
true, `clear_notify` deletes the row), and the seeds write `true` as well, so a
`false` row can only arrive by hand-written SQL.
