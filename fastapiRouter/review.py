from fastapi import APIRouter, HTTPException, Body
import os
from datetime import datetime
import PyPDF2
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from io import BytesIO
import tempfile

router = APIRouter()

PROCESS_DIR = os.path.join(os.getcwd(), "pdfs", "processed")

@router.get("/api/py/review")
def hello_fast_api():
    return {"message": "Hello from FastAPI"}

@router.post("/api/py/review/add")
async def add_review_to_pdf(
    pdf_filename: str = Body(..., description="Name of the PDF file to add review to"),
    review_text: str = Body(..., description="Review text content"),
    review_score: float = Body(..., description="Review score (e.g., 4.5)"),
    review_date: datetime = Body(default_factory=datetime.now, description="Date of the review"),
    reviewer_email: str = Body(..., description="Email of the reviewer"),
    reviewer_name: str = Body(..., description="Name of the reviewer")
):
    # Construct the full path to the PDF file
    pdf_path = os.path.join(PROCESS_DIR, pdf_filename)
    
    # Check if the PDF file exists
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail=f"PDF file '{pdf_filename}' not found")
    
    try:
        # Open the original PDF
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            pdf_writer = PyPDF2.PdfWriter()
            
            # Copy all pages from the original PDF
            for page_num in range(len(pdf_reader.pages)):
                pdf_writer.add_page(pdf_reader.pages[page_num])
            
            # Create a new page with review information
            review_page = BytesIO()
            can = canvas.Canvas(review_page, pagesize=letter)
            
            # Add review information to the page
            can.setFont("Helvetica-Bold", 16)
            can.drawString(100, 750, "Review Information")
            
            can.setFont("Helvetica", 12)
            can.drawString(100, 720, f"Reviewer: {reviewer_name}")
            can.drawString(100, 700, f"Email: {reviewer_email}")
            can.drawString(100, 680, f"Date: {review_date.strftime('%Y-%m-%d %H:%M:%S')}")
            can.drawString(100, 660, f"Score: {review_score}")
            
            can.setFont("Helvetica-Bold", 14)
            can.drawString(100, 620, "Review:")
            
            # Handle multi-line review text
            can.setFont("Helvetica", 12)
            text_object = can.beginText(100, 600)
            
            # Split the review text into lines
            lines = []
            for line in review_text.split('\n'):
                # Further split long lines
                while len(line) > 70:
                    lines.append(line[:70])
                    line = line[70:]
                lines.append(line)
            
            for line in lines:
                text_object.textLine(line)
            
            can.drawText(text_object)
            can.save()
            
            # Add the new page to the PDF
            review_page.seek(0)
            new_page = PyPDF2.PdfReader(review_page).pages[0]
            pdf_writer.add_page(new_page)
            
            # Create a temporary file for the new PDF
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
                temp_path = temp_file.name
            
            # Write the new PDF to the temporary file
            with open(temp_path, 'wb') as output_file:
                pdf_writer.write(output_file)
            
            # Replace the original file with the new one
            os.replace(temp_path, pdf_path)
            
            return {
                "success": True,
                "message": f"Review added to '{pdf_filename}' successfully",
                "pdf_path": pdf_path
            }
            
    except Exception as e:
        # If any error occurs, raise an HTTPException
        raise HTTPException(status_code=500, detail=f"Failed to add review: {str(e)}")