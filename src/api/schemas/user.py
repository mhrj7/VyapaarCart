from pydantic import BaseModel, EmailStr
from src.api.models.user import RoleEnum

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: RoleEnum = RoleEnum.buyer

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    role: RoleEnum

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str | None = None
