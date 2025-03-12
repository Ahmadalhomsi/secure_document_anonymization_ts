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
    doc = fitz.open("pdf", pdf_bytes)

    # Extract author information from a larger portion of the first page
    author_info = extract_ieee_author_info(
        doc, process_percentage=0.5)  # Process top 50%

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

    # Open the PDF for modification
    output = io.BytesIO()
    doc = fitz.open("pdf", pdf_bytes)

    # Sort replacements by length (longest first) to avoid partial replacements
    sorted_replacements = sorted(
        replacements.items(), key=lambda x: len(x[0]), reverse=True)

    # Process the first page to remove sensitive information
    page = doc[0]

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
        # Add a new page at the end
        new_page = doc.new_page(-1, width=page.rect.width,
                                height=page.rect.height)

        # Improved structured format for the encryption information
        text_blocks = []
        text_blocks.append("ENCRYPTED INFORMATION\n\n")

        # Group items by type for better organization
        grouped_data = {
            "name": [],
            "email": [],
            "affiliation": []
        }

        for item in encrypted_data:
            for key, value in item.items():
                if key in grouped_data:
                    grouped_data[key].append(value)

        # Format JSON data with proper line wrapping
        text_blocks.append("{\n")

        for data_type, items in grouped_data.items():
            if items:
                text_blocks.append(f'  "{data_type}": [\n')

                for i, item in enumerate(items):
                    text_blocks.append(f'    {{\n')

                    # Truncate very long values to prevent text overflow
                    original = item["original"]
                    if len(original) > 50:
                        original = original[:47] + "..."

                    encrypted = item["encrypted"]
                    if len(encrypted) > 50:
                        # For AES values, we'll keep the IV part and truncate the cipher part
                        if ":" in encrypted:
                            iv, cipher = encrypted.split(":", 1)
                            encrypted = f"{iv}:{cipher[:30]}..."
                        else:
                            encrypted = encrypted[:47] + "..."

                    text_blocks.append(f'      "original": "{original}",\n')
                    text_blocks.append(f'      "encrypted": "{encrypted}"\n')
                    text_blocks.append(
                        f'    }}{"," if i < len(items)-1 else ""}\n')

                text_blocks.append('  ],\n')

        # Remove the last comma and close the JSON structure
        if text_blocks[-1].endswith(',\n'):
            text_blocks[-1] = text_blocks[-1].rstrip(',\n') + '\n'
        text_blocks.append('}\n')

        # Join all text blocks
        full_text = "".join(text_blocks)

        # Calculate safe text width to prevent overflow
        page_width = new_page.rect.width
        margin = 50  # Left margin in points
        right_margin = 50  # Right margin in points
        text_width = page_width - margin - right_margin

        # Use a smaller font size to accommodate more text
        font_size = 9
        font_name = "Courier"  # Monospaced font for better formatting

        # Insert text with word wrapping
        text_point = fitz.Point(margin, 50)  # Starting position

        # Use PyMuPDF's built-in text insertion with controlled line width
        # This will automatically wrap text to prevent overflow
        new_page.insert_text(
            text_point,
            full_text,
            fontname=font_name,
            fontsize=font_size,
            color=(0, 0, 0),
            linewidth=text_width  # This sets the maximum width for text before wrapping
        )

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
