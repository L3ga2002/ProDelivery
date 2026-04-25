# Auth Testing Playbook

## MongoDB Verification
- Verifică existența utilizatorului admin în colecția `users`
- Verifică faptul că parola este hash-uită bcrypt

## API Testing
1. Login admin:
   - `POST /api/auth/login`
   - trebuie să seteze cookie-urile `access_token` și `refresh_token`
   - trebuie să returneze și `user`
2. Session check:
   - `GET /api/auth/me` cu cookie-urile din login
   - trebuie să întoarcă utilizatorul curent
3. Refresh:
   - `POST /api/auth/refresh` cu `refresh_token`
   - trebuie să seteze un nou `access_token`
4. Logout:
   - `POST /api/auth/logout`
   - trebuie să șteargă cookie-urile auth

## Frontend Testing
- Login-ul din React trebuie să funcționeze fără localStorage pentru token
- Refresh-ul paginii trebuie să păstreze sesiunea prin cookie-uri
- Logout-ul trebuie să scoată utilizatorul din sesiune
