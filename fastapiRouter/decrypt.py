import os

from fastapi import APIRouter, Body, HTTPException


router = APIRouter()


@router.post("/api/py/decrypt")
async def decrypt_pdf(
    pdf_filename: str = Body(..., description="Name of the PDF file to decrypt"),
):
    
    print(pdf_filename)