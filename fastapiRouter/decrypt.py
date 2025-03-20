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

# Define paths for the PDF directories
DECRYPT_DIR = os.path.join(os.getcwd(), "pdfs", "decrypted")
REVIEW_DIR = os.path.join(os.getcwd(), "pdfs", "reviewed")

# Create directories if they don't exist
os.makedirs(DECRYPT_DIR, exist_ok=True)

# Get encryption key from environment variable
ENCRYPTION_KEY = os.getenv(
    "ENCRYPTION_KEY", "your-secure-encryption-key-min-32-chars")
encryption_key = ENCRYPTION_KEY.encode()
encryption_key = encryption_key.ljust(32, b'0')[:32]  # Ensure 32-byte key

def decrypt_aes(encrypted_text: str) -> str:
    """
    Decrypt AES encrypted text in the format "iv:encrypted_data"
    """
    try:
        iv_hex, encrypted_hex = encrypted_text.split(":")
        iv = bytes.fromhex(iv_hex)
        encrypted = bytes.fromhex(encrypted_hex)
        
        cipher = Cipher(algorithms.AES(encryption_key),
                      modes.CBC(iv), backend=default_backend())
        decryptor = cipher.decryptor()
        padded_data = decryptor.update(encrypted) + decryptor.finalize()
        
        unpadder = padding.PKCS7(128).unpadder()
        data = unpadder.update(padded_data) + unpadder.finalize()
        
        return data.decode()
    except Exception as e:
        raise ValueError(f"Failed to decrypt data: {str(e)}")

def extract_encryption_data(doc: fitz.Document) -> List[Dict]:
    """
    Extract the encryption data from the last pages of the PDF
    """
    encrypted_data = []
    
    # Check if the document has an encryption page
    # The encryption data should be in the last pages of the document
    for page_num in range(doc.page_count - 1, 0, -1):
        page = doc[page_num]
        text = page.get_text()
        
        # Check if this page contains encryption information
        if "ENCRYPTED INFORMATION" in text:
            # Parse this page for encrypted data
            blocks = page.get_text("blocks")
            
            current_item = None
            for block in blocks:
                block_text = block[4].strip()
                
                # Look for item types
                if block_text.endswith(":") and any(key in block_text.lower() for key in ["name:", "email:", "affiliation:", "title:"]):
                    # Start a new item
                    current_item = {
                        "type": block_text.lower().rstrip(":"),
                        "original": None,
                        "encrypted": None
                    }
                
                # Look for original value
                elif current_item and block_text.startswith("Original:"):
                    current_item["original"] = block_text[len("Original:"):].strip()
                
                # Look for encrypted value
                elif current_item and block_text.startswith("Encrypted:"):
                    encrypted_value = block_text[len("Encrypted:"):].strip()
                    
                    # The encrypted value might continue on the next lines
                    # For simplicity, we'll just use what we have
                    current_item["encrypted"] = encrypted_value
                    
                    # Add the completed item and reset
                    if current_item["original"] and current_item["encrypted"]:
                        encrypted_data.append(current_item)
                        current_item = None
    
    return encrypted_data

def restore_original_content(doc: fitz.Document, encrypted_data: List[Dict]) -> fitz.Document:
    """
    Restore the original content in the PDF by removing asterisks
    and putting back the original content
    """
    # We'll focus on the first page where the redactions are likely to be
    page = doc[0]
    
    # For each encrypted item, find the corresponding asterisks and replace them
    for item in encrypted_data:
        item_type = item["type"]
        original_text = item["original"]
        
        if original_text:
            # Create a pattern of asterisks that matches the length of the original text
            asterisk_pattern = "*" * len(original_text)
            
            # Search for the asterisk pattern on the page
            instances = page.search_for(asterisk_pattern)
            
            for rect in instances:
                # Only process if in the top 50% of the page (where author info usually is)
                if rect.y0 < page.rect.height * 0.5:
                    # Replace with original text
                    # First remove the asterisks by drawing a white rectangle
                    page.draw_rect(rect, color=(1, 1, 1), fill=(1, 1, 1))
                    
                    # Then insert the original text
                    page.insert_text(
                        fitz.Point(rect.x0, (rect.y0 + rect.y1) / 2),
                        original_text,
                        fontsize=8
                    )
    
    return doc

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
        
        # Build file paths
        input_path = os.path.join(REVIEW_DIR, "reviewed_" + filename)
        
        if not os.path.exists(input_path):
            return JSONResponse(
                status_code=404,
                content={"error": f"File not found: {filename}"}
            )

        # Generate output filename
        output_filename = f"decrypted_{filename}"
        output_path = os.path.join(DECRYPT_DIR, output_filename)

        # Read the PDF file
        doc = fitz.open(input_path)
        
        # Check if the document has encryption data
        encrypted_data = extract_encryption_data(doc)
        
        if not encrypted_data:
            return JSONResponse(
                status_code=400,
                content={"error": "No encryption data found in the PDF"}
            )
        
        # Process each encrypted item to get the original content
        decrypted_items = []
        for item in encrypted_data:
            try:
                encrypted_value = item["encrypted"]
                
                # The encrypted value might be incomplete if it was split across multiple lines
                # Try to decrypt it anyway, but handle potential errors
                decrypted_value = decrypt_aes(encrypted_value)
                
                item["decrypted"] = decrypted_value
                decrypted_items.append({
                    "type": item["type"],
                    "original": item["original"],
                    "decrypted": decrypted_value
                })
            except Exception as e:
                # Log the error but continue with other items
                print(f"Error decrypting {item['type']}: {str(e)}")
        
        # Restore the original content in the PDF
        modified_doc = restore_original_content(doc, encrypted_data)
        
        # Remove the encryption information pages
        # Identify which pages contain encryption information
        pages_to_remove = []
        for page_num in range(doc.page_count - 1, 0, -1):
            page = doc[page_num]
            text = page.get_text()
            if "ENCRYPTED INFORMATION" in text:
                pages_to_remove.append(page_num)
        
        # Remove pages in reverse order to avoid index shifting
        for page_num in sorted(pages_to_remove, reverse=True):
            doc.delete_page(page_num)
        
        # Save the decrypted PDF
        doc.save(output_path, deflate=True, garbage=4)
        doc.close()
        
        # Return response with mapping of decrypted items
        return JSONResponse(content={
            "success": True,
            "decrypted_items": decrypted_items,
            "processed_filename": output_filename,
            "download_url": f"/pdfs/decrypted/{output_filename}"
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