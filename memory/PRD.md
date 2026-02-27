# ProDelivery - Platformă de Management Livrări

## Problem Statement Original
Platformă profesională de livrări cu:
- Aplicație mobilă (Android + iOS via PWA)
- Backend scalabil pentru mii de comenzi
- Alocare automată comenzi către cel mai apropiat livrator
- GPS tracking live
- Roluri diferite: Livrator / Restaurant / Admin
- Adăugare nelimitată restaurante

## Arhitectură

### Stack Tehnologic
- **Backend**: FastAPI (Python) + MongoDB
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Real-time**: Polling (WebSocket în faza următoare)
- **Maps**: Leaflet + OpenStreetMap
- **Auth**: JWT + bcrypt

### Structură Bază de Date
- **users**: email, password_hash, name, role (admin/driver/restaurant)
- **drivers**: user_id, name, phone, is_active, latitude, longitude, current_order_id
- **restaurants**: name, address, phone, latitude, longitude
- **orders**: order_number, restaurant_id, driver_id, customer_*, items, status, payment_type

## User Personas

### 1. Administrator/Dispecer
- Gestionează comenzi și livratori
- Vizualizează hartă live cu poziții
- Alocă manual/automat comenzile

### 2. Livrator
- Primește comenzi pe telefon
- Actualizează status comenzi
- Apelare directă client
- Navigație către adresă

### 3. Restaurant (Faza 2)
- Vizualizează comenzi proprii
- Marchează comenzi ca "gata"

## Ce s-a implementat - FAZA 1 (Prototip)

**Data: 27 Feb 2026**

### ✅ Funcționalități Completate

#### Dashboard Admin (Web)
- [x] Login securizat
- [x] Hartă interactivă cu livratori (Leaflet/OpenStreetMap)
- [x] Markere colorate: verde=activ, albastru=inactiv
- [x] Statistici: comenzi active, total comenzi, livratori activi
- [x] Tabel comenzi cu status badges
- [x] Alocare manuală comenzi către livratori
- [x] Dialog selector livrator disponibil
- [x] Auto-refresh date la 10 secunde

#### Aplicație Livrator (PWA)
- [x] Login cu email/parolă
- [x] Vizualizare comandă alocată cu toate detaliile
- [x] Detalii client: nume, telefon, adresă
- [x] Detalii comandă: produse, sumă, tip plată, observații
- [x] **Buton SUNĂ** - apelare directă client (tel:)
- [x] **Buton Navigație** - deschide Google Maps
- [x] Butoane status: ACCEPT → RIDICAT → LIVRAT
- [x] State "Nicio Comandă" când nu are comenzi
- [x] Auto-refresh la 5 secunde

#### Backend API
- [x] Autentificare JWT
- [x] CRUD pentru orders, drivers, restaurants
- [x] Endpoint alocare comenzi
- [x] Endpoint actualizare status
- [x] Seed data demo
- [x] CORS configurat

### Date Demo Incluse
- 1 Admin: admin@delivery.ro / admin123
- 4 Livratori: driver-001@delivery.ro / driver123 (etc.)
- 3 Restaurante: Pizza Roma, Burger House, Sushi Master
- 3 Comenzi demo

## Backlog Prioritizat

### P0 (Critical) - FAZA 2
- [ ] Panou Restaurant cu login
- [ ] Restaurant marchează comandă "Gata"
- [ ] Buton "Ridicat" inactiv până restaurant confirmă
- [ ] Notificare audio la comandă nouă

### P1 (Important) - FAZA 3
- [ ] GPS tracking live (WebSocket)
- [ ] Poziție livrator în timp real pe hartă
- [ ] Alocare automată (algoritm cel mai apropiat)

### P2 (Nice to Have) - FAZA 4+
- [ ] Push notifications
- [ ] Istoric livrări livrator
- [ ] Rapoarte și statistici
- [ ] Export date
- [ ] Calendar program livratori
- [ ] Check-in cu poză echipament
- [ ] Rating bidirecțional
- [ ] Aplicație nativă Android/iOS

## Next Tasks
1. Implementare panou restaurant
2. Logica "comanda gata" care activează butonul la livrator
3. Notificare audio când apare comandă nouă
4. WebSocket pentru actualizări în timp real

## Credențiale Test
```
Admin: admin@delivery.ro / admin123
Driver: driver-001@delivery.ro / driver123
```

## API Endpoints
```
POST /api/auth/login - Autentificare
POST /api/seed - Creare date demo
GET /api/orders - Lista comenzi
GET /api/orders/driver/{id} - Comenzile unui livrator
PUT /api/orders/{id}/assign - Alocare comandă
PUT /api/orders/{id}/status - Update status
GET /api/drivers - Lista livratori
GET /api/restaurants - Lista restaurante
```
