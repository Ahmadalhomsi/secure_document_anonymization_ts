from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
import json
import os
from typing import Dict, List, Any
from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from io import BytesIO
import tempfile
import shutil

router = APIRouter()

# Path to the directory containing reviewed PDFs
REVIEWED_PDFS_DIR = "./pdfs/reviewed/"
# New path for storing decrypted PDFs
DECRYPTED_PDFS_DIR = "./pdfs/decrypted/"

@router.post("/api/py/addDecryptedInfo/{filename}")
async def add_decrypted_info_to_pdf(filename: str, decryption_data: Dict[str, Any], background_tasks: BackgroundTasks):
    """
    Add decrypted information to a PDF file located in the /pdfs/reviewed/ directory.
    Save the result in the /pdfs/decrypted/ directory and return it as a download.

    Args:
        filename: Name of the PDF file (without path)
        decryption_data: JSON object containing the decryption results

    Returns:
        Modified PDF file as a download
    """

    # Validate input
    if not filename.endswith('.pdf'):
        filename += '.pdf'

    file_path = os.path.join(REVIEWED_PDFS_DIR,"reviewed_" + filename)

    # Check if file exists
    if not os.path.exists(file_path):
        print(f"File {filename} not found in {REVIEWED_PDFS_DIR}")
        raise HTTPException(status_code=404, detail=f"File {filename} not found in {REVIEWED_PDFS_DIR}")

    try:
        # Ensure the decrypted directory exists
        os.makedirs(DECRYPTED_PDFS_DIR, exist_ok=True)
        
        # Path for the decrypted file
        decrypted_filename = f"decrypted_{filename}"
        decrypted_file_path = os.path.join(DECRYPTED_PDFS_DIR, decrypted_filename)

        # Extract decryption results
        decryption_results = decryption_data.get("decryptionResults", [])
        print(f"decryption_results={decryption_results}")

        if not decryption_results:
            raise HTTPException(status_code=400, detail="No decryption results provided")

        # Create a temporary file for the overlay
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_overlay:
            temp_overlay_path = temp_overlay.name

        # Create a new PDF with the decrypted information
        create_overlay_pdf(temp_overlay_path, decryption_results)

        # Merge the original PDF with the overlay and save to the decrypted directory
        merge_pdfs(file_path, temp_overlay_path, decrypted_file_path)

        # Clean up the overlay temporary file
        os.unlink(temp_overlay_path)

        # Return the modified PDF from the decrypted directory
        return FileResponse(
            path=decrypted_file_path,
            filename=decrypted_filename,
            media_type="application/pdf"
        )

    except Exception as e:
        print(f"Failed to process PDF: error={str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")

def create_overlay_pdf(output_path: str, decryption_results: List[Dict[str, str]]):
    """Create a PDF overlay with the decrypted information."""
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)

    # Set font and size
    c.setFont("Helvetica", 10)

    # Add a title
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, 750, "Decrypted Information")
    c.setFont("Helvetica", 10)

    # Add decrypted data
    y_position = 730
    for i, result in enumerate(decryption_results):
        decrypted = result.get("decrypted", "")
        if decrypted:
            # Handle multi-line content
            if "\n" in decrypted:
                lines = decrypted.split("\n")
                for line in lines:
                    c.drawString(50, y_position, line)
                    y_position -= 15
                y_position -= 5  # Extra space between multi-line items
            else:
                c.drawString(50, y_position, decrypted)
                y_position -= 15

            # Check if we need to start a new page
            if y_position < 50:
                c.showPage()
                y_position = 750
                c.setFont("Helvetica", 10)

    c.save()

    # Write the buffer to the output file
    with open(output_path, 'wb') as f:
        f.write(buffer.getvalue())

def merge_pdfs(original_path: str, overlay_path: str, output_path: str):
    """Merge the original PDF with the overlay containing decrypted information."""
    original_pdf = PdfReader(original_path)
    overlay_pdf = PdfReader(overlay_path)

    output = PdfWriter()

    # Add original pages
    for i in range(len(original_pdf.pages)):
        page = original_pdf.pages[i]
        output.add_page(page)

    # Add overlay pages
    for i in range(len(overlay_pdf.pages)):
        page = overlay_pdf.pages[i]
        output.add_page(page)

    # Write the output PDF
    with open(output_path, 'wb') as output_file:
        output.write(output_file)