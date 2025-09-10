import pytest
import httpx
from src.main import app

@pytest.mark.asyncio
async def test_get_seasons():
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/seasons")
    
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert all(isinstance(year, int) for year in response.json())
    assert len(response.json()) > 0 # Assuming there are always some seasons
