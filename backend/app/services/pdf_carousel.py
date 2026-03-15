"""
PDF Carousel Generation Service

This service automatically takes generated LinkedIn text and turns it into 
a multi-page PDF document (a "Carousel"), which is highly engaging on LinkedIn.
"""

from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from ..core.config import logger
import os

class PDFCarouselService:
    def __init__(self):
        self.output_dir = "static/carousels"
        os.makedirs(self.output_dir, exist_ok=True)

    def _split_text_into_chunks(self, text: str, max_chars_per_slide: int = 150) -> list[str]:
        """Simple heuristic to split long captions into bite-sized slides."""
        sentences = text.split('. ')
        slides = []
        current_slide = ""
        
        for sentence in sentences:
            if not sentence.endswith('.'):
                sentence += '.'
            
            if len(current_slide) + len(sentence) < max_chars_per_slide:
                current_slide += sentence + " "
            else:
                if current_slide:
                    slides.append(current_slide.strip())
                current_slide = sentence + " "
                
        if current_slide and current_slide.strip() != '.':
            slides.append(current_slide.strip())
            
        return slides

    def generate_carousel(self, hook: str, caption: str, slides: list[str] = None, author_name: str = "Author") -> str:
        """
        Generates a visually appealing PDF carousel and returns the file path.
        If 'slides' is provided, it uses them directly. Otherwise, it splits the caption.
        """
        try:
            # Hash to ensure unique filenames without duplicates for identical text
            filename_hash = str(abs(hash(caption)))[:8]
            filename = f"carousel_{filename_hash}.pdf"
            filepath = os.path.join(self.output_dir, filename)
            
            # Use provided slides or split caption
            final_slides = slides if slides else ([hook] + self._split_text_into_chunks(caption))
            
            # We use square-ish dimensions for LinkedIn
            page_width = 8 * inch
            page_height = 8 * inch
            
            c = canvas.Canvas(filepath, pagesize=(page_width, page_height))
            
            for index, slide_text in enumerate(final_slides):
                self._draw_slide(c, slide_text, page_width, page_height, index + 1, len(final_slides), author_name)
                c.showPage()
                
            c.save()
            logger.info(f"Generated PDF Carousel at {filepath}")
            return filepath
            
        except Exception as e:
            logger.error(f"Failed to generate PDF Carousel: {e}")
            raise Exception("PDF Carousel Generation failed.")
            
    def _draw_slide(self, c: canvas.Canvas, text: str, width: float, height: float, current_page: int, total_pages: int, author: str):
        """Draws an individual slide using reportlab."""
        # Background
        c.setFillColor(HexColor("#F5F7FA")) # Light grey/blue background
        c.rect(0, 0, width, height, fill=True, stroke=False)
        
        # Author header
        c.setFillColor(HexColor("#333333"))
        c.setFont("Helvetica-Bold", 14)
        c.drawString(0.5 * inch, height - 0.8 * inch, f"{author}")
        
        # We need a simple text wrapping mechanism because drawString doesn't wrap natively
        text_object = c.beginText(0.5 * inch, height - 2.5 * inch)
        text_object.setFont("Helvetica", 24)
        text_object.setFillColor(HexColor("#1A1A1A"))
        
        # Text wrapping
        max_width = width - 1 * inch
        words = text.split()
        current_line = ""
        
        for word in words:
            # Check width of current line + next word
            if c.stringWidth(current_line + word, "Helvetica", 24) < max_width:
                current_line += word + " "
            else:
                text_object.textLine(current_line)
                current_line = word + " "
        
        if current_line:
            text_object.textLine(current_line)
            
        c.drawText(text_object)
        
        # Footer / Page Number
        c.setFont("Helvetica", 12)
        c.setFillColor(HexColor("#666666"))
        c.drawString(width - 1.5 * inch, 0.5 * inch, f"Swipe ->   {current_page}/{total_pages}")


carousel_service = PDFCarouselService()
