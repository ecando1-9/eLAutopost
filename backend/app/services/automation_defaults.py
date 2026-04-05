"""
Helpers for applying saved user automation settings consistently.
"""

from typing import Any, Dict, List, Optional
import random
import re

from ..core.config import logger
from ..core.text_utils import strip_markdown_formatting
from ..services.database import supabase_client


DEFAULT_AUTOMATION_SETTINGS: Dict[str, Any] = {
    "default_goal": "Authority",
    "default_audience": "General Professionals",
    "default_style": "Carousel slides",
    "default_tone": "professional",
    "publish_target": "person",
    "organization_id": None,
    "max_posts_per_day": 1,
    "preferred_content_types": [],
    "auto_post": False,
}


async def load_user_automation_settings(user_id: str) -> Dict[str, Any]:
    """Load and normalize automation-related user settings."""
    normalized = dict(DEFAULT_AUTOMATION_SETTINGS)

    try:
        result = supabase_client.admin.table("settings").select(
            "default_goal,default_audience,default_style,default_tone,"
            "publish_target,organization_id,max_posts_per_day,"
            "preferred_content_types,auto_post"
        ).eq("user_id", user_id).limit(1).execute()

        if not result.data:
            return normalized

        raw = result.data[0]
        normalized["default_goal"] = str(
            raw.get("default_goal") or normalized["default_goal"]
        ).strip() or normalized["default_goal"]
        normalized["default_audience"] = str(
            raw.get("default_audience") or normalized["default_audience"]
        ).strip() or normalized["default_audience"]
        normalized["default_style"] = str(
            raw.get("default_style") or normalized["default_style"]
        ).strip() or normalized["default_style"]
        normalized["default_tone"] = str(
            raw.get("default_tone") or normalized["default_tone"]
        ).strip().lower() or normalized["default_tone"]

        publish_target = str(
            raw.get("publish_target") or normalized["publish_target"]
        ).strip().lower()
        normalized["publish_target"] = (
            publish_target if publish_target in {"person", "organization", "both"} else "person"
        )

        organization_id = str(raw.get("organization_id") or "").strip()
        normalized["organization_id"] = organization_id or None

        try:
            normalized["max_posts_per_day"] = max(
                1,
                min(10, int(raw.get("max_posts_per_day") or 1))
            )
        except Exception:
            normalized["max_posts_per_day"] = 1

        preferred_content_types = raw.get("preferred_content_types")
        if isinstance(preferred_content_types, list):
            normalized["preferred_content_types"] = [
                str(item).strip().lower()
                for item in preferred_content_types
                if str(item).strip()
            ]

        normalized["auto_post"] = bool(raw.get("auto_post", normalized["auto_post"]))
        return normalized
    except Exception as e:
        logger.warning(f"Failed to load automation settings for {user_id}: {e}")
        return normalized


def build_target_variants(settings: Dict[str, Any]) -> List[Dict[str, Optional[str]]]:
    """Expand a saved publish target into one or more concrete post variants."""
    publish_target = str(settings.get("publish_target") or "person").strip().lower()
    organization_id = str(settings.get("organization_id") or "").strip() or None

    variants: List[Dict[str, Optional[str]]] = []
    if publish_target in {"person", "both"}:
        variants.append({"target": "person", "organization_id": None})
    if publish_target in {"organization", "both"} and organization_id:
        variants.append({"target": "organization", "organization_id": organization_id})

    return variants or [{"target": "person", "organization_id": None}]


def build_generation_instructions(
    settings: Dict[str, Any],
    category: Optional[str] = None
) -> str:
    """Build additional prompt guidance from saved preferences."""
    audience = str(
        settings.get("default_audience") or DEFAULT_AUTOMATION_SETTINGS["default_audience"]
    ).strip()
    goal = str(
        settings.get("default_goal") or DEFAULT_AUTOMATION_SETTINGS["default_goal"]
    ).strip()
    style = str(
        settings.get("default_style") or DEFAULT_AUTOMATION_SETTINGS["default_style"]
    ).strip()

    parts: List[str] = [
        "Be concrete, specific, and actionable.",
        "Avoid generic LinkedIn advice and vague filler.",
        "Use examples that feel directly relevant to the target audience.",
        f"Write for {audience} and speak to their actual day-to-day challenges.",
        f"Optimize the post for the user's goal of {goal}.",
        f"Keep the structure aligned with {style} unless a clearer version is needed.",
    ]

    preferred_content_types = settings.get("preferred_content_types") or []
    if preferred_content_types:
        parts.append(
            "Favor one of these content angles when it fits naturally: "
            + ", ".join(preferred_content_types)
        )

    if category:
        parts.append(f"Anchor the examples and framing around {category}.")

    return " ".join(parts)


def build_topic_from_category(
    category: Optional[str],
    settings: Dict[str, Any]
) -> str:
    """Turn a broad category into a more specific content topic."""
    base_category = str(category or "Industry insights").strip() or "Industry insights"
    audience = str(settings.get("default_audience") or "General Professionals").strip()
    goal = str(settings.get("default_goal") or "Authority").strip()

    goal_templates = {
        "Reach": [
            f"What {audience} miss about {base_category}",
            f"The {base_category} shift {audience} cannot ignore",
            f"Why {base_category} is changing faster than {audience} think",
        ],
        "Authority": [
            f"A practical {base_category} framework for {audience}",
            f"{base_category} lessons every {audience} can apply this week",
            f"What high-performers understand about {base_category}",
        ],
        "Discussion": [
            f"The most overrated advice in {base_category}",
            f"Where {audience} disagree on {base_category}",
            f"The unpopular truth about {base_category}",
        ],
        "Promotion": [
            f"How strong teams solve {base_category} problems faster",
            f"The operational gap hurting {audience} in {base_category}",
            f"What better execution looks like in {base_category}",
        ],
        "Research": [
            f"{base_category} trends shaping decisions for {audience}",
            f"What the latest signals say about {base_category}",
            f"Data-backed shifts in {base_category} for {audience}",
        ],
        "Knowledge": [
            f"{base_category} basics every {audience} should know",
            f"A simple way to understand {base_category}",
            f"The clearest starting point for learning {base_category}",
        ],
    }

    generic_templates = [
        f"How {base_category} affects {audience} right now",
        f"The {base_category} lessons worth sharing this week",
        f"What {audience} should understand about {base_category}",
    ]

    templates = goal_templates.get(goal, generic_templates)
    return random.choice(templates)


def compose_linkedin_caption(generated: Any) -> str:
    """Normalize AI output into a clean LinkedIn caption."""
    hook = strip_markdown_formatting(getattr(generated, "hook", "")).strip()
    body = strip_markdown_formatting(getattr(generated, "caption", "")).strip()
    cta = strip_markdown_formatting(getattr(generated, "cta", "")).strip()

    if hook and body.lower().startswith(hook.lower()):
        body = body[len(hook):].strip().lstrip(".: \n")

    if cta and cta.lower() in body.lower():
        if body.lower().endswith(cta.lower()):
            body = body[:-len(cta)].strip()
        else:
            cta = ""

    body = re.sub(r"(\s*#\w+)+$", "", body).strip()

    final_caption = hook
    if body:
        final_caption += f"\n\n{body}" if final_caption else body
    if cta:
        final_caption += f"\n\n{cta}" if final_caption else cta

    hashtags = getattr(generated, "hashtags", None) or []
    cleaned_tags: List[str] = []
    current_content = final_caption.lower()
    for raw_tag in hashtags:
        tag = str(raw_tag).strip().lstrip("#").replace("hashtag", "").replace(" ", "")
        if tag and f"#{tag.lower()}" not in current_content:
            cleaned_tags.append(f"#{tag}")

    if cleaned_tags:
        final_caption += "\n\n" + " ".join(cleaned_tags)

    return final_caption.strip()
