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


def extract_ieee_author_info(doc: fitz.Document) -> dict:
    """
    Extract author information specifically from IEEE papers
    focussing on the first page header section
    """
    # Get text from only the first page where author info is typically found
    first_page = doc[0]
    text = first_page.get_text()

    # For IEEE papers, we'll divide the page into sections
    # Authors are typically in the top 30% of the first page
    header_section = text[:int(len(text) * 0.3)]

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

    # Extract emails - this is quite reliable with regex
    emails = re.findall(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', header_section)
    authors_info["emails"] = emails

    # Extract affiliations - look for department, university, location patterns
    # Typical IEEE affiliation format
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

    # Extract author information specifically from IEEE format
    author_info = extract_ieee_author_info(doc)

    replacements = {}
    encrypted_data = []

    # Process names if option is enabled
    if options.name and author_info["names"]:
        for name in author_info["names"]:
            sha = hash_sha256(name)
            encrypted_data.append({
                "name": {
                    "original": name,
                    "sha256": sha
                }
            })
            replacements[name] = sha

    # Process emails if option is enabled
    if options.email and author_info["emails"]:
        for email in author_info["emails"]:
            sha = hash_sha256(email)
            encrypted_data.append({
                "email": {
                    "original": email,
                    "sha256": sha
                }
            })
            replacements[email] = sha

    # Process affiliations if option is enabled
    if options.affiliation:
        for affiliation in author_info["affiliations"]:
            sha = hash_sha256(affiliation)
            encrypted_data.append({
                "affiliation": {
                    "original": affiliation,
                    "sha256": sha
                }
            })
            replacements[affiliation] = sha

        # Also process locations if available
        if "locations" in author_info:
            for location in author_info["locations"]:
                sha = hash_sha256(location)
                encrypted_data.append({
                    "affiliation": {
                        "original": location,
                        "sha256": sha
                    }
                })
                replacements[location] = sha

    # Replace text in PDF using redaction - but only on the first page where author info is
    output = io.BytesIO()
    doc = fitz.open("pdf", pdf_bytes)

    # Sort replacements by length (longest first) to avoid partial replacements
    sorted_replacements = sorted(
        replacements.items(), key=lambda x: len(x[0]), reverse=True)

    # Only process the first page where author info typically is
    page = doc[0]
    redacted_areas = []

    for original, replacement in sorted_replacements:
        for inst in page.search_for(original):
            # Only redact if in the top 30% of the page (typical for author info)
            if inst.y0 < page.rect.height * 0.4:
                # Check if this area overlaps with any previously redacted area
                overlaps = False
                for area in redacted_areas:
                    if (max(inst.x0, area.x0) < min(inst.x1, area.x1) and
                            max(inst.y0, area.y0) < min(inst.y1, area.y1)):
                        overlaps = True
                        break

                if not overlaps:
                    # Add some padding to the redacted area to prevent text overlap
                    expanded_rect = fitz.Rect(
                        inst.x0, inst.y0, inst.x1 + 5, inst.y1)
                    page.add_redact_annot(
                        expanded_rect, text=replacement, fill=(1, 1, 1))
                    redacted_areas.append(expanded_rect)

    page.apply_redactions()

    doc.save(output, deflate=True, garbage=4)
    doc.close()

    mapping = {
        "encrypted_data": encrypted_data,
        "sensitive_data_found": {
            "name": len(author_info["names"]) > 0,
            "email": len(author_info["emails"]) > 0,
            "affiliation": len(author_info["affiliations"]) > 0,
            "title": False,  # Not implemented for IEEE papers
            "address": False  # Not implemented for IEEE papers
        },
        "encryption_options": options.dict(),
        "total_replacements": len(replacements)
    }

    return output.getvalue(), mapping


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


# Add this to your FastAPI app
@app.post("/api/py/decrypt-data")
async def decrypt_data_endpoint(request: dict):
    try:
        # Extract hash from request
        hash_value = request.get("hash")
        if not hash_value:
            return JSONResponse(
                status_code=400,
                content={"error": "Hash value is required"}
            )

        # Extract mapping from request
        mapping = request.get("mapping")
        if not mapping or "encrypted_data" not in mapping:
            return JSONResponse(
                status_code=400,
                content={"error": "Valid mapping data is required"}
            )

        # Find the original value for this hash
        original_value = None
        data_type = None

        for entry in mapping["encrypted_data"]:
            for key, value in entry.items():
                if value["sha256"] == hash_value:
                    original_value = value["original"]
                    data_type = key
                    break
            if original_value:
                break

        if not original_value:
            return JSONResponse(
                status_code=404,
                content={"error": "No data found for this hash"}
            )

        return JSONResponse(content={
            "success": True,
            "original_value": original_value,
            "data_type": data_type
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
