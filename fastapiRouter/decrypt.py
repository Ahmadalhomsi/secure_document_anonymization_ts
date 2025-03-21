from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import re
import base64
import os
import io
import shutil
from typing import List, Dict, Optional
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.backends import default_backend
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from PyPDF2 import PdfReader, PdfWriter

router = APIRouter()

# Define a simple encryption key (use the default key for all decryptions)
ENCRYPTION_KEY = os.getenv(
    "ENCRYPTION_KEY", "your-secure-encryption-key-min-32-chars")
encryption_key = ENCRYPTION_KEY.encode()
encryption_key = encryption_key.ljust(32, b'0')[:32]  # Ensure 32-byte key

# Create the decrypted PDF directory if it doesn't exist
DECRYPTED_PDF_DIR = "./pdfs/decrypted"
os.makedirs(DECRYPTED_PDF_DIR, exist_ok=True)


class DecryptRequest(BaseModel):
    pdfFileContent: str
    fileName: Optional[str] = None
    replaceWithNewPage: Optional[bool] = True


class DecryptedItem:
    def __init__(self, encrypted: str, decrypted: str, method: str = None):
        self.encrypted = encrypted
        self.decrypted = decrypted
        self.method = method


def simple_decrypt(encrypted_text: str) -> str:
    """Simple XOR decryption with Base64 encoding."""
    try:
        # Remove any newlines or whitespace
        encrypted_text = encrypted_text.strip()

        # Decode from Base64
        encrypted_bytes = base64.b64decode(encrypted_text)

        # Get the key as bytes
        key_bytes = ENCRYPTION_KEY.encode()

        # XOR decryption
        decrypted_bytes = bytearray()
        for i, byte in enumerate(encrypted_bytes):
            key_byte = key_bytes[i % len(key_bytes)]
            decrypted_bytes.append(byte ^ key_byte)

        # Convert back to string
        return decrypted_bytes.decode('utf-8')
    except Exception as e:
        raise ValueError(f"Decryption error: {str(e)}")


def aes_decrypt(encrypted_text: str) -> str:
    """AES-256-CBC decryption for colon-separated format."""
    try:
        # Get encryption key
        enc_key = encryption_key

        # Split the IV and ciphertext
        parts = encrypted_text.split(':')
        if len(parts) != 2:
            raise ValueError("Invalid AES encrypted format")

        iv = bytes.fromhex(parts[0])
        ciphertext = bytes.fromhex(parts[1])

        # Create cipher
        cipher = Cipher(algorithms.AES(enc_key),
                        modes.CBC(iv), backend=default_backend())
        decryptor = cipher.decryptor()

        # Decrypt
        padded_data = decryptor.update(ciphertext) + decryptor.finalize()

        # Unpad
        unpadder = padding.PKCS7(128).unpadder()
        data = unpadder.update(padded_data) + unpadder.finalize()

        return data.decode('utf-8')
    except Exception as e:
        raise ValueError(f"AES decryption error: {str(e)}")


def create_decryption_summary_page(decryption_results: List[Dict], file_name: str) -> bytes:
    """Create a PDF page with decryption summary."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()

    # Create custom styles
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=14,
        spaceAfter=12
    )

    normal_style = styles['Normal']
    header_style = ParagraphStyle(
        'HeaderStyle',
        parent=styles['Heading2'],
        fontSize=12,
        spaceAfter=6
    )

    # Build content
    content = []

    # Title
    content.append(
        Paragraph(f"Decryption Summary for {file_name}", title_style))
    content.append(Spacer(1, 12))

    # File info
    content.append(Paragraph(f"Original File: {file_name}", normal_style))
    content.append(
        Paragraph(f"Total Items Decrypted: {len(decryption_results)}", normal_style))
    content.append(
        Paragraph(f"Decryption Date: {os.popen('date').read().strip()}", normal_style))
    content.append(Spacer(1, 12))

    # Decrypted items
    content.append(Paragraph("Decrypted Information", header_style))

    # Create table data
    table_data = [["Item #", "Encrypted Value", "Decrypted Value", "Method"]]

    for i, item in enumerate(decryption_results, 1):
        table_data.append([
            str(i),
            item.get("encrypted", ""),
            item.get("decrypted", ""),
            item.get("method", "")
        ])

    # Create table
    table = Table(table_data, colWidths=[40, 150, 250, 60])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('WORDWRAP', (1, 1), (2, -1), True)
    ]))

    content.append(table)

    # Build document and get PDF data
    doc.build(content)
    buffer.seek(0)
    return buffer.getvalue()


def modify_pdf_with_summary(pdf_content: str, decryption_results: List[Dict], file_name: str,
                            replace_originals: bool = True) -> bytes:
    """Modifies the PDF by adding a summary page and optionally removing original pages."""
    try:
        # Convert PDF content string to bytes if needed
        if isinstance(pdf_content, str):
            pdf_bytes = pdf_content.encode('utf-8')
        else:
            pdf_bytes = pdf_content

        # Create PDF reader from bytes
        pdf_input = io.BytesIO(pdf_bytes)
        pdf_reader = PdfReader(pdf_input)

        # Create new PDF writer
        pdf_writer = PdfWriter()

        # If NOT replacing originals, add all original pages first
        if not replace_originals:
            for page in pdf_reader.pages:
                pdf_writer.add_page(page)

        # Create summary page
        summary_page_bytes = create_decryption_summary_page(
            decryption_results, file_name)
        summary_page_reader = PdfReader(io.BytesIO(summary_page_bytes))
        pdf_writer.add_page(summary_page_reader.pages[0])

        # Write to output buffer
        output_buffer = io.BytesIO()
        pdf_writer.write(output_buffer)
        output_buffer.seek(0)

        return output_buffer.getvalue()
    except Exception as e:
        raise Exception(f"Error modifying PDF: {str(e)}")


@router.post("/api/py/decrypt")
def decrypt_pdf_content(request: DecryptRequest):
    try:
        content = request.pdfFileContent
        file_name = request.fileName or "unknown_file.pdf"
        replace_with_new_page = request.replaceWithNewPage

        print(f"Decrypting content for {file_name}...")

        # Improved pattern to match encrypted strings
        # Look for "Encrypted:" followed by content until next keyword or end of content
        pattern = r'Encrypted:\s+((?:[^\n]+(?:\n(?!Encrypted:|Affiliation:|Original:))?)+)'

        # Find all encrypted values
        matches = re.finditer(pattern, content)

        # Store decryption results
        decryption_results = []

        # Process each encrypted value
        for match in matches:
            try:
                # Get the full encrypted text and strip any extra whitespace
                encrypted_raw = match.group(1).strip()

                # Handle case where there might be multiple hex strings
                # Split by whitespace and process each part that looks like encryption
                parts = encrypted_raw.split()
                encrypted_values = []

                # Look for parts that match encryption patterns
                for part in parts:
                    # Check if it matches AES format (contains colon) or base64 format
                    if ':' in part or re.match(r'^[A-Za-z0-9+/=]+$', part):
                        encrypted_values.append(part)

                # If we found multiple encrypted values, process each one
                if len(encrypted_values) > 1:
                    decrypted_results = []
                    for enc_val in encrypted_values:
                        try:
                            if ':' in enc_val:
                                # AES format with IV:ciphertext
                                dec_val = aes_decrypt(enc_val)
                                method = "AES-256-CBC"
                            else:
                                # Simple XOR format
                                dec_val = simple_decrypt(enc_val)
                                method = "XOR"
                            decrypted_results.append(dec_val)

                            # Add individual result to tracking
                            decryption_results.append({
                                "encrypted": enc_val,
                                "decrypted": dec_val,
                                "method": method
                            })
                        except Exception as e:
                            print(f"Error decrypting part {enc_val}: {str(e)}")

                    # Replace in content with all decrypted values
                    all_decrypted = " ".join(decrypted_results)
                    # The entire "Encrypted: value" text
                    full_match = match.group(0)
                    content = content.replace(
                        full_match, f"Decrypted: {all_decrypted}")

                else:
                    # Process as a single encrypted value
                    encrypted = encrypted_raw

                    # Determine decryption method based on format
                    if ':' in encrypted:
                        # AES format with IV:ciphertext
                        decrypted = aes_decrypt(encrypted)
                        method = "AES-256-CBC"
                    else:
                        # Simple XOR format
                        decrypted = simple_decrypt(encrypted)
                        method = "XOR"

                    # Replace the encrypted value with the decrypted value in the content
                    # The entire "Encrypted: value" text
                    full_match = match.group(0)
                    content = content.replace(
                        full_match, f"Decrypted: {decrypted}")

                    # Add to results
                    decryption_results.append({
                        "encrypted": encrypted,
                        "decrypted": decrypted,
                        "method": method
                    })
            except Exception as e:
                # Log the error but continue with other encryptions
                print(f"Error decrypting {match.group(1)}: {str(e)}")
                decryption_results.append({
                    "encrypted": match.group(1),
                    "error": str(e)
                })

        # Create modified PDF with summary page
        try:
            # Generate a new PDF with just the summary page or append it
            modified_pdf = modify_pdf_with_summary(
                content,
                decryption_results,
                file_name,
                replace_originals=replace_with_new_page
            )

            # Create the output filename
            base_name = os.path.basename(file_name)
            output_filename = f"decrypted_{base_name}"
            output_path = os.path.join(DECRYPTED_PDF_DIR, output_filename)

            # Save the modified PDF to the decrypted folder
            with open(output_path, "wb") as f:
                f.write(modified_pdf)

            # Create a relative download URL
            download_url = f"/api/download?file={output_filename}"

        except Exception as e:
            print(f"Error creating modified PDF: {str(e)}")
            # Fallback to original method
            download_url = "/api/download?file=decrypted_content.pdf"

        return JSONResponse({
            "success": True,
            "decrypted_content": content if not replace_with_new_page else "Summary page created",
            "decryption_results": decryption_results,
            "total_decrypted": len([r for r in decryption_results if "decrypted" in r]),
            "download_url": download_url
        })

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": f"Decryption failed: {str(e)}"
            }
        )
