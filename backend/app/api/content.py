"""
Content Generation API routes.

Handles:
- AI content generation
- Topic analysis
- Hook generation
- Image prompt creation
- Caption writing

Security:
- Rate limiting to prevent API abuse
- Input validation and sanitization
- User authentication required
"""

from fastapi import APIRouter, HTTPException, status, Request, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import os

from ..models.schemas import (
    ContentGenerationRequest,
    GeneratedContent,
    ContentType
)
from ..core.config import logger
from ..services.content_generation import content_service
from ..services.pdf_carousel import carousel_service
from ..services.database import log_audit_event, supabase_client
from ..core.security import get_client_ip
from ..middleware.rate_limit import limiter, GENERATION_RATE_LIMIT


router = APIRouter()

class CarouselGenerationRequest(BaseModel):
    hook: str
    caption: str
    slides: list[str] | None = None
    author_name: str = "LinkedIn Author"
    theme: str = "indigo"


# =============================================================================
# CONTENT GENERATION
# =============================================================================

@router.post("/generate", response_model=GeneratedContent)
@limiter.limit(GENERATION_RATE_LIMIT)
async def generate_content(
    request: Request,
    generation_request: ContentGenerationRequest,
    user_id: str
):
    """
    Generate LinkedIn content for a given topic using the Growth Engine.
    """
    try:
        logger.info(
            f"Growth generation request from user {user_id}: "
            f"topic='{generation_request.topic}', goal='{generation_request.goal}'"
        )
        
        # Generate content using AI strategist
        generated_content = await content_service.generate_content(
            topic=generation_request.topic,
            goal=generation_request.goal or "Authority",
            audience=generation_request.audience or "General professionals",
            style=generation_request.style or "Carousel slides",
            tone=generation_request.tone or "professional",
            instructions=generation_request.instructions or ""
        )
        
        # Log audit event
        await log_audit_event(
            user_id=user_id,
            event_type="content_generated",
            details={
                "topic": generation_request.topic,
                "goal": generation_request.goal,
                "audience": generation_request.audience
            },
            ip_address=get_client_ip(request)
        )
        
        return generated_content
        
    except Exception as e:
        logger.error(f"Content generation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate content strategy."
        )

@router.post("/generate/carousel")
@limiter.limit(GENERATION_RATE_LIMIT)
async def generate_carousel_pdf(
    request: Request,
    carousel_request: CarouselGenerationRequest,
    user_id: str
):
    """
    Generates a PDF Carousel from the provided hook, caption and slides.
    Returns the PDF file.
    """
    try:
        filepath = carousel_service.generate_carousel(
            hook=carousel_request.hook,
            caption=carousel_request.caption,
            slides=carousel_request.slides,
            author_name=carousel_request.author_name,
            theme=carousel_request.theme
        )
        
        if not os.path.exists(filepath):
            raise HTTPException(status_code=500, detail="Failed to create PDF file")
            
        return FileResponse(
            path=filepath, 
            media_type="application/pdf", 
            filename=os.path.basename(filepath)
        )
        
    except Exception as e:
        logger.error(f"Carousel generation failed for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate carousel."
        )


# =============================================================================
# TOPIC CLASSIFICATION
# =============================================================================

@router.post("/classify", response_model=dict)
@limiter.limit("30/minute")
async def classify_topic(
    request: Request,
    topic: str,
    user_id: str
):
    """
    Classify a topic into a content type.
    
    Useful for understanding what type of content would work best
    for a given topic before generating full content.
    
    Args:
        topic: Topic to classify
        user_id: Authenticated user ID
        
    Returns:
        Content type classification
    """
    try:
        # Use private method from content service
        content_type = await content_service._classify_content_type(topic)
        
        return {
            "topic": topic,
            "content_type": content_type.value,
            "description": {
                "alert": "Breaking news, urgent updates, warnings",
                "curiosity": "Interesting facts, questions, mysteries",
                "insight": "Analysis, lessons, deep dives",
                "future": "Predictions, trends, what's next"
            }.get(content_type.value, "")
        }
        
    except Exception as e:
        logger.error(f"Topic classification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to classify topic"
        )


# =============================================================================
# REGENERATE SPECIFIC COMPONENTS
# =============================================================================

@router.post("/regenerate/hook", response_model=dict)
@limiter.limit("20/minute")
async def regenerate_hook(
    request: Request,
    topic: str,
    content_type: ContentType,
    tone: str = "professional",
    user_id: str = None
):
    """
    Regenerate just the hook for a topic.
    
    Useful when user wants to try different hooks without
    regenerating the entire content.
    
    Args:
        topic: Topic
        content_type: Content type
        tone: Tone of content
        user_id: Authenticated user ID
        
    Returns:
        New hook
    """
    try:
        hook = await content_service._generate_hook(topic, content_type, tone)
        
        return {
            "hook": hook,
            "topic": topic,
            "content_type": content_type.value
        }
        
    except Exception as e:
        logger.error(f"Hook regeneration failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to regenerate hook"
        )


@router.post("/regenerate/caption", response_model=dict)
@limiter.limit("20/minute")
async def regenerate_caption(
    request: Request,
    topic: str,
    hook: str,
    content_type: ContentType,
    tone: str = "professional",
    user_id: str = None
):
    """
    Regenerate just the caption.
    
    Args:
        topic: Topic
        hook: Hook text
        content_type: Content type
        tone: Tone of content
        user_id: Authenticated user ID
        
    Returns:
        New caption
    """
    try:
        caption = await content_service._generate_caption(
            topic, hook, content_type, tone
        )
        
        return {
            "caption": caption,
            "topic": topic,
            "hook": hook,
            "content_type": content_type.value
        }
        
    except Exception as e:
        logger.error(f"Caption regeneration failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to regenerate caption"
        )


@router.post("/regenerate/image-prompt", response_model=dict)
@limiter.limit("20/minute")
async def regenerate_image_prompt(
    request: Request,
    topic: str,
    hook: str,
    content_type: ContentType,
    user_id: str | None = None
):
    """
    Regenerate just the image prompt.
    
    Args:
        topic: Topic
        hook: Hook text
        content_type: Content type
        user_id: Authenticated user ID
        
    Returns:
        New image prompt
    """
    try:
        image_prompt = await content_service._generate_image_prompt(
            topic, hook, content_type
        )
        
        return {
            "image_prompt": image_prompt,
            "topic": topic,
            "hook": hook,
            "content_type": content_type.value
        }
        
    except Exception as e:
        logger.error(f"Image prompt regeneration failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to regenerate image prompt"
        )


# =============================================================================
# USAGE STATISTICS
# =============================================================================

@router.get("/stats", response_model=dict)
@limiter.limit("60/minute")
async def get_generation_stats(request: Request, user_id: str):
    """
    Get content generation statistics for the user.
    
    Returns:
        Usage statistics
    """
    try:
        # Query audit logs for generation events
        result = supabase_client.admin.table("audit_logs").select(
            "id, created_at, details"
        ).eq("user_id", user_id).eq("event_type", "content_generated").execute()
        
        # Calculate stats
        total_generations = len(result.data)
        
        # Count by content type
        type_counts = {}
        for log in result.data:
            content_type = log.get("details", {}).get("content_type", "unknown")
            type_counts[content_type] = type_counts.get(content_type, 0) + 1
        
        return {
            "total_generations": total_generations,
            "by_content_type": type_counts,
            "user_id": user_id
        }
        
    except Exception as e:
        logger.error(f"Failed to get generation stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve statistics"
        )
