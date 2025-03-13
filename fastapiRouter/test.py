# fastapiRouter/test.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/api/py/test")
async def read_users():
    return [{"username": "TESTOR"}, {"username": "master"}]
