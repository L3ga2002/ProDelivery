from fastapi import APIRouter, HTTPException, Depends, Response, Request
from database import db
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    get_current_user,
    resolve_user_context,
    set_auth_cookies,
    clear_auth_cookies,
    decode_token,
    REFRESH_TOKEN_COOKIE,
)
from models.user import User, UserCreate, UserLogin
from models.driver import Driver

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
async def register(user_data: UserCreate, response: Response):
    normalized_email = user_data.email.strip().lower()
    existing = await db.users.find_one({"email": normalized_email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=normalized_email,
        name=user_data.name,
        role=user_data.role,
        phone=user_data.phone,
        restaurant_id=user_data.restaurant_id
    )

    doc = user.model_dump()
    doc["password_hash"] = hash_password(user_data.password)
    doc["created_at"] = doc["created_at"].isoformat()

    await db.users.insert_one(doc)

    if user_data.role == "driver":
        driver = Driver(
            user_id=user.id,
            name=user.name,
            phone=user_data.phone or ""
        )
        await db.drivers.insert_one(driver.model_dump())

    user_payload = await resolve_user_context(user.id)
    access_token = create_access_token(user_payload)
    refresh_token = create_refresh_token(user_payload)
    set_auth_cookies(response, access_token, refresh_token)
    return {"token": access_token, "user": user_payload}


@router.post("/login")
async def login(credentials: UserLogin, response: Response):
    normalized_email = credentials.email.strip().lower()
    user = await db.users.find_one({"email": normalized_email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_payload = await resolve_user_context(user["id"])
    access_token = create_access_token(user_payload)
    refresh_token = create_refresh_token(user_payload)
    set_auth_cookies(response, access_token, refresh_token)

    return {"token": access_token, "user": user_payload}


@router.post("/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"message": "Logged out"}


@router.post("/refresh")
async def refresh_session(request: Request, response: Response):
    refresh_token = request.cookies.get(REFRESH_TOKEN_COOKIE)
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_token(refresh_token, "refresh")
    user_payload = await resolve_user_context(payload["user_id"])
    access_token = create_access_token(user_payload)
    set_auth_cookies(response, access_token, refresh_token)
    return {"token": access_token, "user": user_payload}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user
