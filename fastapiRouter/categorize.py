import os
import re
from typing import Dict, List
import fitz  # PyMuPDF for PDF text extraction
from fastapi import APIRouter, Body, HTTPException

router = APIRouter()

PROCESS_DIR = os.path.join(os.getcwd(), "pdfs")

# Define category keywords and their mappings
CATEGORIES = {
    "Artificial Intelligence and Machine Learning": [
        "machine learning", "deep learning", "neural network", "artificial intelligence", "AI", "ML", 
        "natural language processing", "NLP", "computer vision", "CV", "generative AI", "transformer",
        "reinforcement learning", "supervised learning", "unsupervised learning", "GPT", "BERT", 
        "feature extraction", "classification algorithm", "semantic segmentation", "object detection"
    ],
    
    "Human-Computer Interaction": [
        "human-computer interaction", "HCI", "brain-computer interface", "BCI", "user experience", 
        "UX", "UI", "user interface", "augmented reality", "virtual reality", "AR", "VR", 
        "interaction design", "usability", "accessibility", "user-centered design", "immersive experience"
    ],
    
    "Big Data and Data Analytics": [
        "big data", "data analytics", "data mining", "data visualization", "hadoop", "spark", 
        "time series", "data processing", "data warehouse", "ETL", "data lake", "data mart", 
        "business intelligence", "BI", "predictive analytics", "NoSQL", "analytics", "dashboards"
    ],
    
    "Cybersecurity": [
        "cybersecurity", "security", "encryption", "cryptography", "secure software", "network security", 
        "authentication", "authorization", "digital forensics", "malware", "virus", "firewall", 
        "intrusion detection", "penetration testing", "vulnerability", "exploit", "threat", "zero-day"
    ],
    
    "Networking and Distributed Systems": [
        "networking", "distributed system", "5G", "cloud computing", "blockchain", "peer-to-peer", 
        "P2P", "decentralized", "distributed computing", "network protocol", "SDN", "NFV", 
        "edge computing", "fog computing", "network architecture", "network topology", "microservices"
    ]
}

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text content from a PDF file."""
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        return text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract text from PDF: {str(e)}")

def categorize_text(text: str) -> Dict[str, float]:
    """
    Categorize text based on keyword frequency.
    Returns a dictionary with categories and their confidence scores.
    """
    text = text.lower()
    
    # Count occurrences of keywords for each category
    category_scores = {}
    total_matches = 0
    
    for category, keywords in CATEGORIES.items():
        score = 0
        for keyword in keywords:
            # Count occurrences with word boundaries to prevent partial matches
            pattern = r'\b' + re.escape(keyword.lower()) + r'\b'
            matches = len(re.findall(pattern, text))
            score += matches
            total_matches += matches
        
        category_scores[category] = score
    
    # Normalize scores if there are any matches
    if total_matches > 0:
        for category in category_scores:
            category_scores[category] = round(category_scores[category] / total_matches * 100, 2)
    
    return category_scores

def get_primary_category(scores: Dict[str, float]) -> str:
    """Get the primary category with the highest score."""
    if not scores:
        return "Uncategorized"
        
    max_score = max(scores.values())
    if max_score == 0:
        return "Uncategorized"
        
    # Get all categories with the maximum score
    top_categories = [cat for cat, score in scores.items() if score == max_score]
    
    if len(top_categories) == 1:
        return top_categories[0]
    else:
        # If there are multiple categories with the same score, return them joined
        return " & ".join(top_categories)

@router.post("/api/py/categorize")
async def categorize_pdf(
    pdf_filename: str = Body(..., description="Name of the PDF file to categorize"),
):
    # Construct the full path to the PDF file
    pdf_path = os.path.join(PROCESS_DIR, pdf_filename)
    
    # Check if the PDF file exists
    print(pdf_path)
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail=f"PDF file '{pdf_filename}' not found")
    
    # Extract text from PDF
    text = extract_text_from_pdf(pdf_path)
    
    # Get category scores
    category_scores = categorize_text(text)
    
    # Get primary category
    primary_category = get_primary_category(category_scores)
    
    return {
        "pdf_filename": pdf_filename,
        "primary_category": primary_category,
        "category_scores": category_scores
    }