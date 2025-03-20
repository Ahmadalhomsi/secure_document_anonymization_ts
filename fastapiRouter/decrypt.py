from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, List, Optional
import fitz  # PyMuPDF
import os
import io
import json
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.backends import default_backend

router = APIRouter()

# Get encryption key from environment (should match the one in main.py)
ENCRYPTION_KEY = os.getenv(
    "ENCRYPTION_KEY", "your-secure-encryption-key-min-32-chars")
encryption_key = ENCRYPTION_KEY.encode()
encryption_key = encryption_key.ljust(32, b'0')[:32]  # Ensure 32-byte key

# Define paths for the PDF directories
UPLOAD_DIR = os.path.join(os.getcwd(), "pdfs")
PROCESS_DIR = os.path.join(os.getcwd(), "pdfs", "processed")
REVIEW_DIR = os.path.join(os.getcwd(), "pdfs", "reviewed")

# Create directories if they don't exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROCESS_DIR, exist_ok=True)
os.makedirs(REVIEW_DIR, exist_ok=True)

def decrypt_aes(encrypted_text: str) -> str:
    iv_hex, ciphertext_hex = encrypted_text.split(':')
    iv = bytes.fromhex(iv_hex)
    ciphertext = bytes.fromhex(ciphertext_hex)

    cipher = Cipher(algorithms.AES(encryption_key),
                    modes.CBC(iv),
                    backend=default_backend())
    decryptor = cipher.decryptor()
    padded_data = decryptor.update(ciphertext) + decryptor.finalize()

    unpadder = padding.PKCS7(128).unpadder()
    data = unpadder.update(padded_data) + unpadder.finalize()

    return data.decode()


@router.post("/api/py/decrypt")
async def decrypt_pdf_endpoint(request: dict):
    try:
        # Extract request data
        if not request:
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid request format"}
            )

        filename = request.get("filename")
        if not filename:
            return JSONResponse(
                status_code=400,
                content={"error": "Filename is required"}
            )

        # Extract encryption mapping if provided
        encryption_mapping = request.get("encryptionMapping", {})
        encrypted_data = encryption_mapping.get("encrypted_data", [])

        # Build file paths
        input_path = os.path.join(REVIEW_DIR, ("reviewed_" + filename) )
        
        if not os.path.exists(input_path):
            print(f"File not foundXXXX: {input_path}")
            return JSONResponse(
                status_code=404,
                content={"error": f"File not found: {filename}"}
            )

        # Generate output filename
        output_filename = f"decrypted_{filename}"
        output_path = os.path.join(PROCESS_DIR, output_filename)

        # Read the PDF file
        with open(input_path, "rb") as f:
            pdf_bytes = f.read()

        # Open the PDF for modification
        doc = fitz.open("pdf", pdf_bytes)
        
        # Verify the document has pages
        if doc.page_count == 0:
            raise ValueError("The PDF document contains no pages")

        # Initialize dictionary for replacements (encrypted -> original)
        replacements = {}
        
        # Process the encrypted data to build the replacement dictionary
        for item in encrypted_data:
            for data_type, data in item.items():  # data_type can be name, email, affiliation, etc.
                if isinstance(data, dict) and "original" in data and "encrypted" in data:
                    # Get encrypted value and original value
                    encrypted_value = data["encrypted"]
                    original_value = data["original"]
                    
                    # Try to decrypt the encrypted value to verify
                    try:
                        decrypted_value = decrypt_aes(encrypted_value)
                        # If decryption successful and matches original, add to replacements
                        if decrypted_value == original_value:
                            # Replace the asterisks with the original text
                            asterisks = "*" * len(original_value)
                            replacements[asterisks] = original_value
                    except Exception as e:
                        print(f"Error decrypting {data_type}: {str(e)}")

        # Process the first page to restore sensitive information
        page = doc[0]  # Get the first page

        # Sort replacements by length (longest first) to avoid partial replacements
        sorted_replacements = sorted(
            replacements.items(), key=lambda x: len(x[0]), reverse=True)

        # Get text blocks to handle manual replacements
        blocks = page.get_text("blocks")
        
        # First pass: Replace asterisks with original text in the content stream
        for original_asterisks, replacement in sorted_replacements:
            # Search for the exact asterisk pattern
            instances = page.search_for(original_asterisks)
            
            for rect in instances:
                # Only process if in the top 50% of the page (same as encryption)
                if rect.y0 < page.rect.height * 0.5:
                    # Need to delete existing content and insert the original
                    page.add_redact_annot(rect, text=replacement)
        
        # Apply all redactions (which in this case restores original text)
        page.apply_redactions()
        
        # Second pass: Handle any redacted blocks that might have been inserted as text
        for block in blocks:
            # Only process blocks in the top 50% of the page
            if block[1] < page.rect.height * 0.5:
                block_text = block[4]
                
                # Check if this block contains any asterisk patterns we need to replace
                new_text = block_text
                for asterisks, original in sorted_replacements:
                    if asterisks in new_text:
                        new_text = new_text.replace(asterisks, original)
                
                # If we made any changes, update the block
                if new_text != block_text:
                    # Create a rectangle for this block
                    rect = fitz.Rect(block[0], block[1], block[2], block[3])
                    
                    # Clear existing content and insert the decrypted text
                    page.draw_rect(rect, color=(1, 1, 1), fill=(1, 1, 1))
                    page.insert_text(fitz.Point(block[0] + 2, (block[1] + block[3])/2), 
                                   new_text, 
                                   fontsize=8)
        
        # Save the modified PDF
        output = io.BytesIO()
        doc.save(output, deflate=True, garbage=4)
        doc.close()

        # Save the decrypted PDF
        with open(output_path, "wb") as f:
            f.write(output.getvalue())

        # Return response with the new filename
        return JSONResponse(content={
            "success": True,
            "decrypted_filename": output_filename,
            "download_url": f"/pdfs/processed/{output_filename}",
            "replacements_count": len(replacements)
        })

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        return JSONResponse(
            status_code=500,
            content={
                "error": f"Decryption failed: {str(e)}",
                "details": error_details
            }
        )