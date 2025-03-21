// app/api/decrypt/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Define encryption key
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secure-encryption-key-min-32-chars';
// Ensure 32-byte key for AES-256
const normalizedKey = Buffer.from(ENCRYPTION_KEY).slice(0, 32).toString('hex').padEnd(64, '0').slice(0, 64);
const encryptionKeyBuffer = Buffer.from(normalizedKey, 'hex');

function simpleDecrypt(encryptedText: string): string {
  try {
    // Remove any whitespace
    encryptedText = encryptedText.trim();
    
    // Decode from Base64
    const encryptedBuffer = Buffer.from(encryptedText, 'base64');
    
    // Get the key as buffer
    const keyBuffer = Buffer.from(ENCRYPTION_KEY);
    
    // XOR decryption
    const decryptedBuffer = Buffer.alloc(encryptedBuffer.length);
    for (let i = 0; i < encryptedBuffer.length; i++) {
      const keyByte = keyBuffer[i % keyBuffer.length];
      decryptedBuffer[i] = encryptedBuffer[i] ^ keyByte;
    }
    
    // Convert back to string
    return decryptedBuffer.toString('utf8');
  } catch (error) {
    throw new Error(`Decryption error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function aesDecrypt(encryptedText: string): string {
  try {
    // Split the IV and ciphertext
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid AES encrypted format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const ciphertext = Buffer.from(parts[1], 'hex');
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKeyBuffer, iv);
    
    // Decrypt
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error(`AES decryption error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { pdfFileContent } = await request.json();
    
    if (!pdfFileContent) {
      return NextResponse.json({ 
        success: false, 
        error: 'PDF content is required' 
      }, { status: 400 });
    }

    let content = pdfFileContent;
    const decryptionResults = [];
    
    // Pattern to match encrypted strings
    const pattern = /Encrypted:\s+([^\n]+)/g;
    
    // Find and process all matches
    let match;
    while ((match = pattern.exec(pdfFileContent)) !== null) {
      try {
        const encrypted = match[1].trim();
        let decrypted: string;
        let method: string;
        
        // Choose decryption method based on format
        if (encrypted.includes(':')) {
          // AES format with IV:ciphertext
          decrypted = aesDecrypt(encrypted);
          method = 'AES-256-CBC';
        } else {
          // Simple XOR format
          decrypted = simpleDecrypt(encrypted);
          method = 'XOR';
        }
        
        // Replace in content
        const fullMatch = match[0];  // The entire "Encrypted: value" text
        content = content.replace(fullMatch, `Decrypted: ${decrypted}`);
        
        decryptionResults.push({
          encrypted,
          decrypted,
          method
        });
      } catch (error) {
        console.error(`Error decrypting match: ${match[1]}`, error);
        decryptionResults.push({
          encrypted: match[1],
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      decrypted_content: content,
      decryption_results: decryptionResults,
      total_decrypted: decryptionResults.filter(r => 'decrypted' in r).length
    });
    
  } catch (error) {
    console.error('Decryption error:', error);
    return NextResponse.json({
      success: false,
      error: `Decryption failed: ${error instanceof Error ? error.message : String(error)}`
    }, { status: 500 });
  }
}