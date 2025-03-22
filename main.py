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

from fastapiRouter import addDecryptedInfo, review, categorize, decrypt

# Create FastAPI instance with custom docs and openapi url
app = FastAPI(docs_url="/api/py/docs", openapi_url="/api/py/openapi.json")

app.include_router(review.router)
app.include_router(categorize.router)
app.include_router(decrypt.router)
app.include_router(addDecryptedInfo.router)

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
        "affiliations": [],
        "title": ""  # Added field to capture paper title
    }

    # Get blocks for more structured analysis
    blocks = first_page.get_text("blocks")
    
    # Filter blocks to the top portion of the page
    top_blocks = [block for block in blocks if block[1] < first_page.rect.height * process_percentage]
    
    # Extract paper title first - usually the biggest text at the top
    # Sort blocks by font size (approximated by block height) - largest first
    title_candidates = sorted(top_blocks, key=lambda b: (b[3] - b[1]), reverse=True)
    
    if title_candidates and title_candidates[0][3] - title_candidates[0][1] > 12:  # Title usually has larger text
        # Store the title but don't add it to things to encrypt unless specifically requested
        authors_info["title"] = title_candidates[0][4].strip()
        # Remove this block from further processing to avoid misidentification
        top_blocks.remove(title_candidates[0])
    
    # Process each block for author information
    for block in top_blocks:
        block_text = block[4]
        
        # Extract emails first - they're the most reliable identifiers
        emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', block_text)
        for email in emails:
            if email not in authors_info["emails"]:
                authors_info["emails"].append(email)
                
                # Extract the name part from email (often first.last@domain)
                name_part = email.split('@')[0]
                if '.' in name_part:
                    # Try to reconstruct a name from the email
                    parts = name_part.split('.')
                    constructed_name = ' '.join([part.capitalize() for part in parts])
                    if constructed_name not in authors_info["names"] and len(constructed_name) > 5:
                        # Only add if it's not already there and a reasonable length
                        authors_info["names"].append(constructed_name)
        
        # If this block contains an email, it's likely an author block
        # Extract name that might be at the beginning of the block
        if emails:
            # Get the text before the email
            pre_email_text = block_text.split(emails[0])[0].strip()
            lines = pre_email_text.split('\n')
            
            # First line might be the name
            if lines and len(lines[0]) < 40:  # Names aren't usually too long
                potential_name = lines[0].strip()
                
                # Check if it looks like a name
                words = potential_name.split()
                if len(words) >= 2 and all(word[0].isupper() for word in words if len(word) > 1):
                    if potential_name not in authors_info["names"]:
                        authors_info["names"].append(potential_name)
        
        # Extract department and affiliation information
        affiliation_patterns = [
            # Department pattern
            r'(Department\s+of\s+[\w\s\-,&]+)',
            # School pattern
            r'(School\s+of\s+[\w\s\-,&]+)',
            # University/Institute/College pattern
            r'((?:University|Institute|College)\s+of\s+[\w\s\-,&]+)',
            r'((?:University|Institute|College)\s+[\w\s\-,&]+)',
            # Location with country
            r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s+[A-Z][a-z]+)'
        ]
        
        for pattern in affiliation_patterns:
            affiliations = re.findall(pattern, block_text)
            for affiliation in affiliations:
                if affiliation not in authors_info["affiliations"]:
                    authors_info["affiliations"].append(affiliation.strip())
    
    # Fallback for names if email-based approach didn't find enough
    if len(authors_info["emails"]) >= 1 and len(authors_info["names"]) < len(authors_info["emails"]):
        # Look for "standard" author name patterns in blocks that contain affiliations
        for block in top_blocks:
            block_text = block[4]
            
            # Skip blocks that are likely part of the header/title
            if len(block_text) > 200 or block_text.isupper():  # Long blocks or ALL CAPS are less likely to be author names
                continue
                
            # Check if there's any indication this is an author block
            has_affiliation = any(aff in block_text for aff in authors_info["affiliations"])
            has_location = re.search(r'\b(?:India|USA|UK|Germany|France|Japan|China|Canada)\b', block_text)
            
            if has_affiliation or has_location or 'Department' in block_text or 'University' in block_text:
                # Look for name patterns, but be more restrictive
                name_pattern = r'([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)'
                names = re.findall(name_pattern, block_text)
                
                for name in names:
                    # More stringent filtering to reduce false positives
                    words = name.split()
                    if (2 <= len(words) <= 4 and 
                        4 <= len(name) <= 30 and 
                        name not in authors_info["names"] and
                        not any(word in name for word in ["Department", "University", "College", "Institute", "School"])):
                        authors_info["names"].append(name)
    
    # Remove duplicates while preserving order
    authors_info["names"] = list(dict.fromkeys(authors_info["names"]))
    authors_info["emails"] = list(dict.fromkeys(authors_info["emails"]))
    authors_info["affiliations"] = list(dict.fromkeys(authors_info["affiliations"]))
    
    # Final validation: if we found significantly more names than emails, 
    # we might have false positives - limit to a reasonable ratio
    if len(authors_info["emails"]) > 0 and len(authors_info["names"]) > len(authors_info["emails"]) * 3:
        # Too many names compared to emails - possible false positives
        # Keep the first names that match the number of emails multiplied by a reasonable factor
        authors_info["names"] = authors_info["names"][:len(authors_info["emails"]) * 2]
    
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
            # Replace with asterisks instead of empty string
            replacements[name] = "*" * len(name)

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
            # Replace with asterisks instead of empty string
            replacements[email] = "*" * len(email)

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
            # Replace with asterisks instead of empty string
            replacements[affiliation] = "*" * len(affiliation)

    # Process title if option is explicitly enabled
    if options.title and author_info["title"]:
        encrypted = encrypt_aes(author_info["title"])
        encrypted_data.append({
            "title": {
                "original": author_info["title"],
                "encrypted": encrypted,
                "algorithm": "AES-256-CBC"
            }
        })
        # Replace with asterisks instead of empty string
        replacements[author_info["title"]] = "*" * len(author_info["title"])

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

    # First, process specific text strings for replacement
    for original, replacement in sorted_replacements:
        instances = page.search_for(original)
        
        for rect in instances:
            # Only redact if in the top 50% of the page
            if rect.y0 < page.rect.height * 0.5:
                # Use redaction annotation with asterisks instead of empty text
                annot = page.add_redact_annot(rect, text=replacement)
                
    # Apply all redactions
    page.apply_redactions()
    
    # Additional handling for author blocks that might be missed by string search
    # Process each text block in the first 50% of the page looking specifically for emails
    blocks = page.get_text("blocks")
    
    for block in blocks:
        # Only process blocks in the top 50% of the page
        if block[1] < page.rect.height * 0.5:
            block_text = block[4]
            
            # Check specifically for email patterns that might have been missed
            emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', block_text)
            should_redact = False
            
            # Check if this block contains emails and the email option is enabled
            if options.email and emails:
                should_redact = True
                
            if should_redact:
                # Create a rectangle for this block
                rect = fitz.Rect(block[0], block[1], block[2], block[3])
                
                # Prepare a redacted version with asterisks
                redacted_text = block_text
                for email in emails:
                    redacted_text = redacted_text.replace(email, "*" * len(email))
                
                # Apply manual redaction
                page.draw_rect(rect, color=(1, 1, 1), fill=(1, 1, 1))
                page.insert_text(fitz.Point(block[0] + 2, (block[1] + block[3])/2), 
                               redacted_text[:50] + "..." if len(redacted_text) > 50 else redacted_text, 
                               fontsize=8)
    
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
                    
                    # new_page.insert_text(
                    #     fitz.Point(current_x, y_position),
                    #     f"Original: {original}",
                    #     fontsize=9
                    # )
                    y_position += 10  # Increase spacing
                    
                    # Add encrypted value - handle long encrypted values
                    # Start the encrypted value text
                    encrypted_text = f"Encrypted: [{encrypted}]"
                    
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
            "title": author_info["title"] != "" and options.title,  # Explicitly show if title was encrypted
            "address": False
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
