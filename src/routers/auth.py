from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm


# A dummy function to simulate creating a token
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    # In a real app, you'd encode a JWT here
    return "fake-jwt-token"


router = APIRouter()


@router.post("/token", tags=["Authentication"])
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    # In a real app, you would have a database of users and check the password hash
    # For this placeholder, we'll accept any user/pass
    if not form_data.username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create a fake token
    access_token_expires = timedelta(minutes=30)
    access_token = create_access_token(
        data={"sub": form_data.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}
