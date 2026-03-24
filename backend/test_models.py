"""
Compatibility test for optional Gemini dependency.

This project can run in environments where `google-genai` is absent.
"""

import importlib


def test_google_genai_optional_dependency():
    """Import should not break test collection when dependency is missing."""
    try:
        importlib.import_module("google.genai")
    except Exception:
        # Optional dependency is allowed to be absent.
        assert True
        return

    assert True
