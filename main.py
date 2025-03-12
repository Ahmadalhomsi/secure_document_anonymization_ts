from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse, StreamingResponse
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
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Encryption setup
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "your-secure-encryption-key-min-32-chars")
encryption_key = ENCRYPTION_KEY.encode()
encryption_key = encryption_key.ljust(32, b'0')[:32]  # Ensure 32-byte key

# Define paths for the PDF directories
UPLOAD_DIR = os.path.join(os.getcwd(), "pdfs")
PROCESS_DIR = os.path.join(os.getcwd(), "pdfs", "process")

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
    cipher = Cipher(algorithms.AES(encryption_key), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    padder = padding.PKCS7(128).padder()
    padded_data = padder.update(text.encode()) + padder.finalize()
    encrypted = encryptor.update(padded_data) + encryptor.finalize()
    return f"{iv.hex()}:{encrypted.hex()}"

def hash_sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()

def extract_author_info(text: str) -> List[Dict[str, Optional[str]]]:
    authors = []
    patterns = {
        'name': re.compile(r'(?:author|by|written by)[^:\n]*:\s*([^\n]+)', re.I),
        'email': re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'),
        'affiliation': re.compile(r'(?:Department|University|Institute|School)\s+of\s+[^\n,]+', re.I),
        'title': re.compile(r'(?:title|Title)\s*:\s*([^\n.]+)', re.I),
        'address': re.compile(r'(?:address|Address)\s*:\s*([^\n.]+)', re.I)
    }
    
    # Extract fields
    fields = {k: [] for k in patterns.keys()}
    for key, pattern in patterns.items():
        matches = pattern.findall(text)
        if key in ['name', 'title', 'address'] and matches:
            fields[key] = [m[0] if isinstance(m, tuple) else m for m in matches]
        else:
            fields[key] = matches
    
    max_count = max(len(fields[key]) for key in fields)
    for i in range(max_count):
        author = {key: fields[key][i] if i < len(fields[key]) else None for key in fields}
        authors.append(author)
    
    return authors

def process_pdf(pdf_bytes: bytes, options: EncryptionOptions) -> tuple:
    doc = fitz.open("pdf", pdf_bytes)
    text = "\n".join(page.get_text() for page in doc)
    authors_info = extract_author_info(text)
    
    replacements = {}
    encrypted_data = []
    
    for author in authors_info:
        encrypted_author = {}
        for field in ['name', 'email', 'affiliation', 'title', 'address']:
            original = author.get(field)
            if original and getattr(options, field, False):
                # Generate both encryption and hash
                aes = encrypt_aes(original)
                sha = hash_sha256(original)
                encrypted_author[field] = {'aes': aes, 'sha256': sha}
                
                # Use SHA-256 if AES is too long (e.g., > 2x original length)
                replacement = sha if len(aes) > 2 * len(original) else aes
                replacements[original] = replacement
        
        encrypted_data.append(encrypted_author)
    
    # Replace text in PDF using redaction
    output = io.BytesIO()
    doc = fitz.open("pdf", pdf_bytes)
    for page in doc:
        for original, replacement in replacements.items():
            for inst in page.search_for(original):
                page.add_redact_annot(inst, text=replacement, fill=(1,1,1))
        page.apply_redactions()
    
    doc.save(output, deflate=True, garbage=4)
    doc.close()
    
    mapping = {
        "encrypted_data": encrypted_data,
        "sensitive_data_found": {
            key: any(a.get(key) for a in authors_info) 
            for key in ['name', 'email', 'affiliation', 'title', 'address']
        },
        "encryption_options": options.dict()
    }
    
    return output.getvalue(), mapping

@app.post("/api/py/process-pdf")
async def process_pdf_endpoint(request: dict):
    try:
        # Extract request data
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
        
        # Process the PDF
        modified_pdf, mapping = process_pdf(pdf_bytes, encryption_options)
        
        # Save the processed PDF
        with open(output_path, "wb") as f:
            f.write(modified_pdf)
        
        # Return response with mapping and new filename
        return JSONResponse(content={
            "success": True,
            "mapping": mapping,
            "processed_filename": output_filename,
            "download_url": f"/pdfs/process/{output_filename}"
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