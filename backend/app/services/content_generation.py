"""
AI Content Generation Service using Google Gemini (Free).

This service handles:
- Topic analysis and classification
- Viral hook generation
- Image prompt creation (Simulated or via free service)
- LinkedIn caption writing
- Content optimization for engagement

Security:
- API key stored in environment variables
- Input sanitization before API calls
- Error handling without exposing internals
"""

from typing import Dict, Any, Optional
from google import genai
from google.genai import types
from ..core.config import settings, logger
from ..core.security import sanitize_input
from ..models.schemas import ContentType, GeneratedContent
import re
import asyncio

import json

class ContentGenerationService:
    """
    Expert LinkedIn Content strategist powered by Google Gemini.
    
    Implements the '10x Feature' system:
    User Goal -> Audience -> Topic -> Format -> Strategy -> Content -> Carousel
    """
    
    def __init__(self):
        """Initialize the Gemini content strategist."""
        if settings.GOOGLE_API_KEY:
            self.client = genai.Client(api_key=settings.GOOGLE_API_KEY)
            self.model_name = settings.GOOGLE_MODEL
            self.fallback_model_name = "gemini-2.5-flash"
            self.configured = True
        else:
            self.client = None
            self.model_name = settings.GOOGLE_MODEL
            self.fallback_model_name = "gemini-2.5-flash"
            self.configured = False
            logger.warning("GOOGLE_API_KEY not set. Content generation will return mock data.")

    def _generate_with_model_fallback(self, prompt: str, temperature: float):
        """
        Generate content using the configured model and fall back when it's unavailable.
        """
        try:
            return self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=temperature),
            )
        except Exception as model_error:
            error_text = str(model_error).lower()
            should_fallback = (
                self.model_name != self.fallback_model_name and
                ("not found" in error_text or "not supported" in error_text or "404" in error_text)
            )
            if not should_fallback:
                raise

            logger.warning(
                f"Configured model '{self.model_name}' unavailable. "
                f"Retrying with '{self.fallback_model_name}'."
            )
            return self.client.models.generate_content(
                model=self.fallback_model_name,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=temperature),
            )
            
    async def generate_content(
        self,
        topic: str,
        goal: str = "Authority",
        audience: str = "General professionals",
        style: str = "Carousel slides",
        tone: str = "professional",
        instructions: str = ""
    ) -> GeneratedContent:
        """
        Generate high-quality LinkedIn content using the strategy engine.
        """
        try:
            if not self.configured:
                logger.warning("Google API key not set. Returning mock strategy data.")
                return GeneratedContent(
                    hook="The one mistake every founder makes.",
                    caption="Most founders focus on features, not solutions. Here's why that's a mistake...",
                    slides=[
                        "Slide 1: Why most startups fail early.",
                        "Slide 2: The feature-trap explained.",
                        "Slide 3: User-centric design vs Feature-built design.",
                        "Slide 4: Example: The eLAutopost journey.",
                        "Slide 5: 3 ways to shift your focus today.",
                        "Slide 6: What's your biggest product challenge?"
                    ],
                    cta="What's your biggest product challenge?",
                    hashtags=["SaaS", "Founders", "Growth"],
                    content_type=ContentType.INSIGHT
                )

            # Sanitize inputs
            topic = sanitize_input(topic, max_length=200)
            goal = sanitize_input(goal, max_length=100)
            audience = sanitize_input(audience, max_length=100)
            style = sanitize_input(style, max_length=100)
            
            master_prompt = f"""
You are a senior LinkedIn growth strategist with 30 years of experience in personal branding, social media algorithms, and copywriting.

User Inputs:
Topic: {topic}
Goal: {goal}
Audience: {audience}
Style: {style}
Tone: {tone}
Instructions: {instructions}

Output Structure (JSON ONLY):
{{
  "hook": "Exactly 3-7 words. A massive scroll-stopper.",
  "hook_variations": ["Variation 1", "Variation 2", "Variation 3", "Variation 4", "Variation 5"],
  "caption": "Engaging caption with value, short paragraphs, and no generic AI fluff.",
  "slides": [
    "Slide 1: Viral hook/Title",
    "Slide 2: Identifying the deep problem",
    "Slide 3: High-level solution/framework",
    "Slide 4: Detailed specific insight/example",
    "Slide 5: Key takeaway/Impact",
    "Slide 6: Powerful CTA"
  ],
  "cta": "The specific question to drive comments.",
  "hashtags": ["list", "of", "4-6", "tags"],
  "engagement_score": 0-100 (integer based on hook strength and trend),
  "quality_score": 0-100 (integer based on clarity and value for audience),
  "content_type": "alert, curiosity, insight, or future"
}}

Writing Rules:
• No "In today's fast-paced world" or generic introductions.
• Use active voice and short sentences.
• Tailor vocabulary specifically for {audience}.
• Predicted engagement should be realistic.

Respond ONLY with valid JSON.
"""
            
            logger.info(f"Growth Coach generating strategy for: {topic}")
            
            # Use async executor for the Gemini call
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, lambda: self._generate_with_model_fallback(
                    prompt=master_prompt,
                    temperature=0.8,
                )
            )
            
            # Clean potential markdown formatting
            raw_text = (response.text or "").strip()
            if not raw_text:
                raise ValueError("Gemini returned an empty response.")
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            if raw_text.startswith("```"):
                raw_text = raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
                
            content_json = json.loads(raw_text.strip())
            
            # Map content_type string to Enum
            raw_type = content_json.get("content_type", "insight").lower()
            type_mapping = {
                "alert": ContentType.ALERT,
                "curiosity": ContentType.CURIOSITY,
                "insight": ContentType.INSIGHT,
                "future": ContentType.FUTURE
            }
            
            return GeneratedContent(
                hook=content_json.get("hook", ""),
                hook_variations=content_json.get("hook_variations", []),
                caption=content_json.get("caption", ""),
                slides=content_json.get("slides", []),
                cta=content_json.get("cta", ""),
                hashtags=content_json.get("hashtags", []),
                engagement_score=content_json.get("engagement_score", 80),
                quality_score=content_json.get("quality_score", 85),
                content_type=type_mapping.get(raw_type, ContentType.INSIGHT)
            )
            
        except Exception as e:
            logger.error(f"Strategy Content Engine failed: {e}")
            raise Exception("Strategy engine failed to generate content.")

    # Keeping helper methods if needed for partial regeneration later, but generate_content is now the main path.
    async def _async_generate(self, prompt: str, temperature: float = 0.7) -> str:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None, lambda: self._generate_with_model_fallback(
                prompt=prompt,
                temperature=temperature,
            )
        )
        return (response.text or "").strip()
    
    async def _classify_content_type(self, topic: str) -> ContentType:
        prompt = f"""Classify this topic into ONE of these categories:
- ALERT: Breaking news, urgent updates
- CURIOSITY: Interesting facts, mysteries
- INSIGHT: Analysis, lessons, deep dives
- FUTURE: Predictions, trends

Topic: {topic}
Respond with ONLY the category name (ALERT, CURIOSITY, INSIGHT, or FUTURE)."""
        try:
            res = await self._async_generate(prompt, temperature=0.1)
            type_str = res.strip().upper()
            mapping = {
                "ALERT": ContentType.ALERT,
                "CURIOSITY": ContentType.CURIOSITY,
                "INSIGHT": ContentType.INSIGHT,
                "FUTURE": ContentType.FUTURE
            }
            return mapping.get(type_str, ContentType.INSIGHT)
        except:
            return ContentType.INSIGHT

    async def _generate_hook(self, topic: str, content_type: ContentType, tone: str) -> str:
        prompt = f"""Create a viral LinkedIn hook about: {topic}
Requirements:
- Exactly 3-7 words
- {tone} tone
- Catchy and engaging
- No hashtags or emojis
Respond ONLY with the hook."""
        try:
            hook = await self._async_generate(prompt, temperature=0.8)
            # Cleanup quotes if Gemini added them
            hook = hook.replace('"', '').replace("'", "")
            return hook
        except:
            return "An important update to share"

    async def _generate_caption(self, topic: str, content_type: ContentType, tone: str) -> str:
        prompt = f"""Write a LinkedIn caption about: {topic}
Type: {content_type.value}
Tone: {tone}
Requirements:
- Max 120 words
- Highly engaging, professional
- Subtle call-to-action at the end
- No hashtags
- Line breaks for readability
Respond ONLY with the caption text."""
        try:
            return await self._async_generate(prompt, temperature=0.7)
        except:
            return f"Sharing some thoughts on {topic}. What do you think?"

    async def _generate_hashtags(self, topic: str, content_type: ContentType) -> list[str]:
        prompt = f"""Generate 3-5 relevant LinkedIn hashtags for: {topic}
Requirements:
- Professional
- No # symbol
- Comma-separated list
Respond ONLY with the comma-separated tags."""
        try:
            res = await self._async_generate(prompt, temperature=0.5)
            tags = [t.strip() for t in res.split(",")]
            tags = [re.sub(r'[^a-zA-Z0-9]', '', t) for t in tags if t]
            return tags[:5]
        except:
            return ["LinkedIn", "Professional", "Update"]

content_service = ContentGenerationService()

