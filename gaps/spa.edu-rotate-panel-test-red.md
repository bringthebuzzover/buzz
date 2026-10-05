---
id: spa.edu-rotate-panel-test-red
title: EduEmailRotatePanel nested-form Jest test fails on main
kind: test_gap
severity: P3
status: open
surface: spa
evidence:
  - path: frontend/src/components/org/EduEmailRotatePanel.test.tsx
    note: "does not submit a wrapping profile form when sending verification" fails; mockRotate is never called after dispatching submit on the inner rotate form.
  - path: frontend/src/components/org/EduEmailRotatePanel.tsx
    note: Last changed in ccf4f05 (keep school-email rotate off the profile form); none of its imports differ from HEAD on prototype/campus-creators.
repro: |
  cd frontend && CI=true npm test -- --watchAll=false --testPathPattern=EduEmailRotatePanel
  -> 1 failed, 4 passed. Full suite: 1 failed, 209 passed (2026-10-04).
fix_when: |
  Either the component submits the rotate request when its own form is submitted
  inside a wrapping form, or the test drives the real submit path (e.g. clicking
  the send button) and passes; full frontend Jest is green.
---

`scripts/ci-local.sh` does not run frontend Jest, so this stays red without
blocking CI. Unknown whether the component or the test is wrong: jsdom also
warns `<form> cannot appear as a descendant of <form>`, which suggests the
component still renders a real nested `<form>` inside the profile form.
