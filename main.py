from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, List, Optional
import fitz  # PyMuPDF
import re
import os
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.backends import default_backend
import hashlib
import io
import json

# Create FastAPI instance with custom docs and openapi url
app = FastAPI(docs_url="/api/py/docs", openapi_url="/api/py/openapi.json")


@app.get("/api/py/helloFastApi")
def hello_fast_api():
    return {"message": "Hello from FastAPI"}


# Add CORS middleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Encryption setup
ENCRYPTION_KEY = os.getenv(
    "ENCRYPTION_KEY", "your-secure-encryption-key-min-32-chars")
encryption_key = ENCRYPTION_KEY.encode()
encryption_key = encryption_key.ljust(32, b'0')[:32]  # Ensure 32-byte key

# Define paths for the PDF directories
UPLOAD_DIR = os.path.join(os.getcwd(), "pdfs")
PROCESS_DIR = os.path.join(os.getcwd(), "pdfs", "processed")

# Create directories if they don't exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROCESS_DIR, exist_ok=True)


class EncryptionOptions(BaseModel):
    name: bool = True
    email: bool = True
    affiliation: bool = True
    title: bool = False
    address: bool = False


def encrypt_aes(text: str) -> str:
    iv = os.urandom(16)
    cipher = Cipher(algorithms.AES(encryption_key),
                    modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    padder = padding.PKCS7(128).padder()
    padded_data = padder.update(text.encode()) + padder.finalize()
    encrypted = encryptor.update(padded_data) + encryptor.finalize()
    return f"{iv.hex()}:{encrypted.hex()}"


def hash_sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def extract_ieee_author_info(doc: fitz.Document, process_percentage=0.5) -> dict:
    """
    Extract author information specifically from IEEE papers
    focussing on the specified percentage of the first page
    """
    # Get text from only the first page where author info is typically found
    first_page = doc[0]
    text = first_page.get_text()

    # Process the specified percentage of the first page
    header_section = text[:int(len(text) * process_percentage)]

    # Initialize results
    authors_info = {
        "names": [],
        "emails": [],
        "affiliations": []
    }

    # Extract author names - look for names in the header section
    # IEEE format often has names followed by superscripts/numbers
    # First look for names with ordinal indicators
    ordinal_names = re.findall(
        r'(\d+(?:st|nd|rd|th))\s+([\w\s\-çÇăĂîÎâÂşŞţŢ˘\']+)', header_section)
    if ordinal_names:
        for _, name in ordinal_names:
            authors_info["names"].append(name.strip())
    else:
        # Try to find names in other common IEEE formats
        # Look for capitalized words that likely represent names
        # Try to extract what appears to be full names
        potential_names = re.findall(
            r'([A-Z][a-zçÇăĂîÎâÂşŞţŢ˘\-]+(?:\s+[A-Z][a-zçÇăĂîÎâÂşŞţŢ˘\-]+)+)', header_section)
        # Filter out likely non-names (like paper title which can be in all caps)
        for name in potential_names:
            words = name.split()
            # Typical name has 2-4 words and isn't too long
            if 2 <= len(words) <= 4 and len(name) < 40:
                authors_info["names"].append(name.strip())

    # Improved email extraction
    # Try multiple patterns to catch different email formats
    standard_emails = re.findall(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', header_section)

    # IEEE sometimes formats emails with spaces or line breaks
    # Remove line breaks and extra spaces, then search again
    clean_header = re.sub(r'\s+', ' ', header_section)
    additional_emails = re.findall(
        r'\b[A-Za-z0-9._%+-]+\s*@\s*[A-Za-z0-9.-]+\s*\.\s*[A-Z|a-z]{2,}\b', clean_header)
    additional_emails = [re.sub(r'\s+', '', email)
                         for email in additional_emails]

    # Check PDF text blocks directly for emails
    blocks = first_page.get_text("blocks")
    block_emails = []
    for block in blocks:
        if block[3] < first_page.rect.height * process_percentage:  # Only top portion of page
            for match in re.finditer(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}', block[4]):
                block_emails.append(match.group())

    # Combine all email sources and remove duplicates
    all_emails = list(set(standard_emails + additional_emails + block_emails))
    authors_info["emails"] = all_emails

    # Extract affiliations - look for department, university, location patterns
    affiliations = re.findall(
        r'(?:Dept\.|Department)\s+of\s+[\w\s\-,&]+', header_section)
    if not affiliations:
        # Try a broader pattern
        affiliations = re.findall(
            r'(?:University|Institute|College|School)\s+of\s+[\w\s\-,&]+', header_section)

    # Also look for typical academic institution names
    institutions = re.findall(
        r'(?:University|Institute|College)\s+[\w\s\-,&]+', header_section)
    affiliations.extend(institutions)

    # Look for location/country info that often follows affiliation
    locations = re.findall(
        r'(?:Bucharest|Romania|[A-Z][a-z]+),\s+(?:Romania|[A-Z][a-z]+)', header_section)

    # Combine unique affiliations
    seen = set()
    authors_info["affiliations"] = [
        x for x in affiliations if x not in seen and not seen.add(x)]
    authors_info["locations"] = [
        x for x in locations if x not in seen and not seen.add(x)]

    return authors_info

def process_pdf_for_ieee(pdf_bytes: bytes, options: EncryptionOptions) -> tuple:
    # Open the PDF for inspection
    doc = fitz.open("pdf", pdf_bytes)
    
    # Extract author information from a larger portion of the first page
    author_info = extract_ieee_author_info(
        doc, process_percentage=0.5)  # Process top 50%
    
    # Close the doc after inspection
    doc.close()
    
    replacements = {}
    encrypted_data = []

    # Process names if option is enabled
    if options.name and author_info["names"]:
        for name in author_info["names"]:
            encrypted = encrypt_aes(name)
            encrypted_data.append({
                "name": {
                    "original": name,
                    "encrypted": encrypted,
                    "algorithm": "AES-256-CBC"
                }
            })
            replacements[name] = ""

    # Process emails if option is enabled
    if options.email and author_info["emails"]:
        for email in author_info["emails"]:
            encrypted = encrypt_aes(email)
            encrypted_data.append({
                "email": {
                    "original": email,
                    "encrypted": encrypted,
                    "algorithm": "AES-256-CBC"
                }
            })
            replacements[email] = ""

    # Process affiliations if option is enabled
    if options.affiliation:
        for affiliation in author_info["affiliations"]:
            encrypted = encrypt_aes(affiliation)
            encrypted_data.append({
                "affiliation": {
                    "original": affiliation,
                    "encrypted": encrypted,
                    "algorithm": "AES-256-CBC"
                }
            })
            replacements[affiliation] = ""

        # Also process locations if available
        if "locations" in author_info:
            for location in author_info["locations"]:
                encrypted = encrypt_aes(location)
                encrypted_data.append({
                    "affiliation": {
                        "original": location,
                        "encrypted": encrypted,
                        "algorithm": "AES-256-CBC"
                    }
                })
                replacements[location] = ""

    # Open the PDF again for modification
    doc = fitz.open("pdf", pdf_bytes)
    
    # Verify the document has pages
    if doc.page_count == 0:
        raise ValueError("The PDF document contains no pages")

    # Sort replacements by length (longest first) to avoid partial replacements
    sorted_replacements = sorted(
        replacements.items(), key=lambda x: len(x[0]), reverse=True)

    # Process the first page to remove sensitive information
    page = doc[0]  # Get the first page

    # More aggressive approach using text extraction and drawing rectangles
    # Get all text blocks from the page
    blocks = page.get_text("blocks")

    # Track redacted areas to prevent overlap
    redacted_areas = []

    # Process each text block in the first 50% of the page
    for block in blocks:
        # Only process blocks in the top 50% of the page
        if block[1] < page.rect.height * 0.5:
            block_text = block[4]  # The text content of the block
            should_redact = False

            # Check if this block contains any text that needs to be replaced
            for original, _ in sorted_replacements:
                if original in block_text:
                    should_redact = True
                    break

            if should_redact:
                # Create a rectangle covering this block
                rect = fitz.Rect(block[0], block[1], block[2], block[3])

                # Add some padding to ensure complete coverage
                rect.x0 -= 3
                rect.x1 += 3
                rect.y0 -= 3
                rect.y1 += 3

                # Create a white rectangle to cover the text
                page.draw_rect(rect, color=(1, 1, 1), fill=(1, 1, 1))
                redacted_areas.append(rect)

    # Now handle each text string specifically for more precise redaction
    for original, replacement in sorted_replacements:
        instances = page.search_for(original)

        for rect in instances:
            # Only redact if in the top 50% of the page
            if rect.y0 < page.rect.height * 0.5:
                # Add some padding
                rect.x0 -= 2
                rect.x1 += 2
                rect.y0 -= 2
                rect.y1 += 2

                # Add a formal redaction
                annot = page.add_redact_annot(rect, text="", fill=(1, 1, 1))

                # Also cover with rectangle for extra assurance
                page.draw_rect(rect, color=(1, 1, 1), fill=(1, 1, 1))
                redacted_areas.append(rect)

    # Apply all redactions
    page.apply_redactions()

    # Create a structured encryption data page that's easy to read and process
    if encrypted_data:
        try:
            # Add a new page at the end
            page_width = page.rect.width
            page_height = page.rect.height
            new_page = doc.new_page(-1, width=page_width, height=page_height)
            
            # Simple title at the top
            new_page.insert_text(
                fitz.Point(50, 50),
                "ENCRYPTED INFORMATION",
                fontsize=16,
                fontname="Helvetica-Bold"
            )
            
            # Add simple information about what was encrypted
            y_position = 80
            
            if options.name and author_info["names"]:
                new_page.insert_text(
                    fitz.Point(50, y_position),
                    f"Author Names: {len(author_info['names'])} found and encrypted",
                    fontsize=10
                )
                y_position += 20
                
            if options.email and author_info["emails"]:
                new_page.insert_text(
                    fitz.Point(50, y_position),
                    f"Emails: {len(author_info['emails'])} found and encrypted",
                    fontsize=10
                )
                y_position += 20
                
            if options.affiliation and author_info["affiliations"]:
                new_page.insert_text(
                    fitz.Point(50, y_position),
                    f"Affiliations: {len(author_info['affiliations'])} found and encrypted",
                    fontsize=10
                )
                y_position += 20
            
            # Add a separator
            y_position += 10
            new_page.draw_line(
                fitz.Point(50, y_position),
                fitz.Point(page_width - 50, y_position)
            )
            y_position += 20
            
            # Add details section title
            new_page.insert_text(
                fitz.Point(50, y_position),
                "Encryption Details:",
                fontsize=12,
                fontname="Helvetica-Bold"
            )
            y_position += 30
            
            # Add each encrypted item with limited width to avoid overflow
            current_x = 50
            max_width = page_width - 100  # 50px margins on each side

            for item in encrypted_data:
                for key, value in item.items():
                    original = value["original"]
                    encrypted = value["encrypted"]  # Don't truncate
                    
                    # Add the item type
                    new_page.insert_text(
                        fitz.Point(current_x, y_position),
                        f"{key.capitalize()}:",
                        fontsize=10,
                        fontname="Helvetica-Bold"
                    )
                    y_position += 20  # Increase spacing
                    
                    # Add original value (can still truncate if needed)
                    if len(original) > 70:
                        original = original[:67] + "..."
                    
                    new_page.insert_text(
                        fitz.Point(current_x, y_position),
                        f"Original: {original}",
                        fontsize=9
                    )
                    y_position += 20  # Increase spacing
                    
                    # Add encrypted value - handle long encrypted values
                    # Start the encrypted value text
                    encrypted_text = f"Encrypted: {encrypted}"
                    
                    # Calculate how many characters can fit on one line
                    # Approximate 6 pixels per character for font size 9
                    chars_per_line = int((max_width - current_x) / 6)
                    
                    # Break the encrypted text into multiple lines if needed
                    if len(encrypted_text) > chars_per_line:
                        # Print first line
                        new_page.insert_text(
                            fitz.Point(current_x, y_position),
                            encrypted_text[:chars_per_line],
                            fontsize=9
                        )
                        y_position += 15
                        
                        # Print remaining lines
                        remaining = encrypted_text[chars_per_line:]
                        while remaining:
                            # Check if we need a new page
                            if y_position > page_height - 50:
                                new_page = doc.new_page(-1, width=page_width, height=page_height)
                                y_position = 50
                                
                                # Add "continued" header
                                new_page.insert_text(
                                    fitz.Point(50, y_position),
                                    "ENCRYPTED INFORMATION (CONTINUED)",
                                    fontsize=16,
                                    fontname="Helvetica-Bold"
                                )
                                y_position += 30
                            
                            # Print the next line
                            new_page.insert_text(
                                fitz.Point(current_x, y_position),
                                remaining[:chars_per_line],
                                fontsize=9
                            )
                            remaining = remaining[chars_per_line:]
                            y_position += 15
                    else:
                        # Print the entire encrypted text on one line
                        new_page.insert_text(
                            fitz.Point(current_x, y_position),
                            encrypted_text,
                            fontsize=9
                        )
                        y_position += 20
                    
                    # Add a small separator with more space
                    y_position += 10  # Add more space before the separator
                    new_page.draw_line(
                        fitz.Point(current_x, y_position),
                        fitz.Point(current_x + 100, y_position)
                    )
                    y_position += 25  # Add more space after the separator
                    
                    # Check if we need to start a new page
                    if y_position > page_height - 60:  # Increased margin
                        new_page = doc.new_page(-1, width=page_width, height=page_height)
                        y_position = 50
                        
                        # Add "continued" header
                        new_page.insert_text(
                            fitz.Point(50, y_position),
                            "ENCRYPTED INFORMATION (CONTINUED)",
                            fontsize=16,
                            fontname="Helvetica-Bold"
                        )
                        y_position += 30
        
        except Exception as e:
            print(f"Error adding encryption information page: {str(e)}")
            # Continue with the PDF even if we can't add the encryption info page
    
    # Save the modified PDF
    output = io.BytesIO()
    doc.save(output, deflate=True, garbage=4)
    doc.close()

    mapping = {
        "encrypted_data": encrypted_data,
        "sensitive_data_found": {
            "name": len(author_info["names"]) > 0,
            "email": len(author_info["emails"]) > 0,
            "affiliation": len(author_info["affiliations"]) > 0,
            "title": False,
            "address": False
        },
        "encryption_options": options.dict(),
        "total_replacements": len(replacements)
    }

    return output.getvalue(), mapping

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


@app.post("/api/py/process-pdf")
async def process_pdf_endpoint(request: dict):
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

        # Parse encryption options
        encryption_options_data = request.get("encryptionOptions", {})
        encryption_options = EncryptionOptions(**encryption_options_data)

        # Build file paths
        input_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(input_path):
            return JSONResponse(
                status_code=404,
                content={"error": f"File not found: {filename}"}
            )

        # Generate output filename
        output_filename = f"processed_{filename}"
        output_path = os.path.join(PROCESS_DIR, output_filename)

        # Read the PDF file
        with open(input_path, "rb") as f:
            pdf_bytes = f.read()

        # Process the PDF specifically for IEEE papers
        modified_pdf, mapping = process_pdf_for_ieee(
            pdf_bytes, encryption_options)

        # Save the processed PDF
        with open(output_path, "wb") as f:
            f.write(modified_pdf)

        # Return response with mapping and new filename
        return JSONResponse(content={
            "success": True,
            "mapping": mapping,
            "processed_filename": output_filename,
            "download_url": f"/pdfs/processed/{output_filename}"
        })

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        return JSONResponse(
            status_code=500,
            content={
                "error": f"Processing failed: {str(e)}",
                "details": error_details
            }
        )
