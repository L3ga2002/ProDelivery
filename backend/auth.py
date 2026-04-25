from fastapi import Depends, HTTPException, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import os

from database import db

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_COOKIE = "access_token"
REFRESH_TOKEN_COOKIE = "refresh_token"
ACCESS_TOKEN_LIFETIME_MINUTES = 15
REFRESH_TOKEN_LIFETIME_DAYS = 7

security = HTTPBearer(auto_error=False)


def get_jwt_secret() -> str:
    return os.environ['JWT_SECRET']


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def _build_access_payload(user_data: dict) -> dict:
    return {
        "user_id": user_data["id"],
        "email": user_data["email"],
        "role": user_data["role"],
        "name": user_data["name"],
        "restaurant_id": user_data.get("restaurant_id"),
        "restaurant_name": user_data.get("restaurant_name"),
        "driver_id": user_data.get("driver_id"),
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_LIFETIME_MINUTES),
    }


def create_access_token(user_data: dict) -> str:
    return jwt.encode(_build_access_payload(user_data), get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_data: dict) -> str:
    payload = {
        "user_id": user_data["id"],
        "email": user_data["email"],
        "role": user_data["role"],
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_LIFETIME_DAYS),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    if payload.get("type") != expected_type:
        raise HTTPException(status_code=401, detail="Invalid token type")

    return payload


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE,
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=ACCESS_TOKEN_LIFETIME_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE,
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=REFRESH_TOKEN_LIFETIME_DAYS * 24 * 60 * 60,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_TOKEN_COOKIE, path="/")
    response.delete_cookie(REFRESH_TOKEN_COOKIE, path="/")


async def resolve_user_context(user_id: str) -> dict:
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    driver_id = None
    if user["role"] == "driver":
        driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
        if driver:
            driver_id = driver["id"]

    restaurant_name = user.get("restaurant_name")
    if user["role"] == "restaurant" and user.get("restaurant_id"):
        restaurant = await db.restaurants.find_one({"id": user["restaurant_id"]}, {"_id": 0})
        if restaurant:
            restaurant_name = restaurant["name"]

    return {
        "user_id": user["id"],
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "driver_id": driver_id,
        "restaurant_id": user.get("restaurant_id"),
        "restaurant_name": restaurant_name,
    }


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    token = request.cookies.get(ACCESS_TOKEN_COOKIE)
    if not token and credentials is not None:
        token = credentials.credentials
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_token(token, "access")
    return await resolve_user_context(payload["user_id"])
