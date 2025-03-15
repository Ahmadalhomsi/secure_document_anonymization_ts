

import os
from fastapi import APIRouter, Body, HTTPException


router = APIRouter()

PROCESS_DIR = os.path.join(os.getcwd(), "pdfs")

@router.post("/api/py/categorize")
async def categorize_pdf(
    pdf_filename: str = Body(..., description="Name of the PDF file to categorize"),
):
    # Construct the full path to the PDF file
    pdf_path = os.path.join(PROCESS_DIR, pdf_filename)
    
    # Check if the PDF file exists
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail=f"PDF file '{pdf_filename}' not found")
    
    # Placeholder for actual categorization logic
    return {"pdf_filename": pdf_filename, "category": "Uncategorized"}