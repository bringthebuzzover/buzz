---
id: spa.edu-rotate-panel-test-red
title: EduEmailRotatePanel nested-form Jest test fails on main
kind: test_gap
severity: P3
status: fixed
surface: spa
closed_in: b5ad317
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

`scripts/ci-local.sh` and GitHub CI did not run frontend Jest, so this stayed
red without blocking CI.

**Resolution:** the test was wrong. It picked the submit target with
`querySelectorAll("form").find(f => f.querySelector("#edu-rotate-email"))`,
which returns the outer profile form (it also contains the input and comes
first in document order), so it submitted the profile form itself. The test
now clicks **Send verification**, and the component's `stopPropagation` is
what keeps the outer form from firing. Production already renders the panel
outside the profile form (`OrgPortalProfilePage`). Frontend Jest now runs in
`ci-local.sh` and in the GitHub `frontend` job.
