"""Crypto primitives: JWT encode/decode and Fernet token encryption.

These modules are intentionally free of FastAPI and database imports so they
unit-test in isolation. FastAPI wiring lives in ``app.deps.auth`` and the
route layer.
"""
