# Test Credentials

## Admin Account
- Email: admin@delivery.ro
- Password: admin123
- Role: admin

## Driver Accounts
- Email: driver-001@delivery.ro
- Password: driver123
- Role: driver
- Extra test driver: driver-002@delivery.ro / driver123

## Restaurant Accounts  
- Email: rest-001@delivery.ro
- Password: restaurant123
- Role: restaurant

## Auth Endpoints
- POST `/api/auth/login`
- GET `/api/auth/me`
- POST `/api/auth/refresh`
- POST `/api/auth/logout`
- POST `/api/drivers/{driver_id}/verify-email`
- POST `/api/drivers/{driver_id}/resend-verification`

## Notes
- Credențialele demo sunt încărcate din environment variables
- Auth frontend folosește acum cookie-uri httpOnly (`access_token`, `refresh_token`)
- Toate parolele trebuie să fie bcrypt hashed în baza de date
- Admin account has full access to all endpoints
- Driver creation now supports `vehicle_type`: `scooter` or `car`
- New drivers start with `email_verified=false` until they confirm the Resend code
- Resend preview sender is `onboarding@resend.dev`; it only sends to the Resend owner email until a domain is verified