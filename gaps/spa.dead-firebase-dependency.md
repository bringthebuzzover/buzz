---
id: spa.dead-firebase-dependency
title: Unused firebase package still a production dependency
kind: dead_code
severity: P3
status: open
surface: spa
evidence:
  - path: frontend/package.json
    note: firebase ^12.7.0 direct dependency
  - path: DEPLOYMENT.md
    note: Already notes Firebase unused
repro: |
  rg -n "from 'firebase'|from \"firebase\"" frontend/src → no imports.
  npm ls firebase still present; contributes to audit noise / install surface.
fix_when: |
  Remove firebase from dependencies and lockfile; scrub REACT_APP_FIREBASE_*
  from examples if unused; ci-local green.
---

# Dead Firebase dependency

Security audit 2026-08-11 (area 12a). Parent-verified unused.
