from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import re
import base64
import os
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.backends import default_backend

router = APIRouter()

# Define a simple encryption key
ENCRYPTION_KEY = os.getenv(
    "ENCRYPTION_KEY", "your-secure-encryption-key-min-32-chars")
encryption_key = ENCRYPTION_KEY.encode()
encryption_key = encryption_key.ljust(32, b'0')[:32]  # Ensure 32-byte key

class DecryptRequest(BaseModel):
    pdfFileContent: str

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
        # Split the IV and ciphertext
        parts = encrypted_text.split(':')
        if len(parts) != 2:
            raise ValueError("Invalid AES encrypted format")
        
        iv = bytes.fromhex(parts[0])
        ciphertext = bytes.fromhex(parts[1])
        
        # Create cipher
        cipher = Cipher(algorithms.AES(encryption_key),
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

@router.post("/api/py/decrypt")
async def decrypt_pdf_content(request: DecryptRequest):
    try:
        content = request.pdfFileContent
        
        # Pattern to match encrypted strings
        pattern = r'Encrypted:\s+([^\n]+)'
        
        # Find all encrypted values
        matches = re.finditer(pattern, content)
        
        # Store decryption results
        decryption_results = []
        
        # Process each encrypted value
        for match in matches:
            try:
                encrypted = match.group(1).strip()
                
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
                full_match = match.group(0)  # The entire "Encrypted: value" text
                content = content.replace(full_match, f"Decrypted: {decrypted}")
                
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
        
        return JSONResponse({
            "success": True,
            "decrypted_content": content,
            "decryption_results": decryption_results,
            "total_decrypted": len([r for r in decryption_results if "decrypted" in r])
        })
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": f"Decryption failed: {str(e)}"
            }
        )