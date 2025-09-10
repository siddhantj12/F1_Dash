from fastapi.security import OAuth2PasswordBearer
from src.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=settings.token_url)
