"""
Text cleanup helpers for LinkedIn-safe plain text output.
"""

import re


def strip_markdown_formatting(value: str | None) -> str:
    """Remove common markdown markers that render poorly in LinkedIn plain text."""
    text = str(value or "")
    if not text:
        return ""

    text = re.sub(r"```(.*?)```", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"__(.*?)__", r"\1", text, flags=re.DOTALL)
    text = re.sub(r"(?<!\*)\*([^\n*]+?)\*(?!\*)", r"\1", text)
    text = re.sub(r"(?<!_)_([^\n_]+?)_(?!_)", r"\1", text)
    text = re.sub(r"^\s{0,3}#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\*\s+", "• ", text, flags=re.MULTILINE)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.replace("**", "").replace("__", "")

    return text.strip()
