# ProDelivery Bacău - Platformă de Management Livrări

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
- **Frontend**: React + Tailwind CSS + Shadcn UI + Recharts
- **Real-time**: Polling (WebSocket în faza următoare)
- **Maps**: Leaflet + OpenStreetMap (centrat pe Bacău)
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
- Analizează grafice și statistici

### 2. Livrator
- Primește comenzi pe telefon
- Actualizează status comenzi
- Apelare directă client
- Navigație către adresă

### 3. Restaurant
- Vizualizează comenzi proprii
- Marchează comenzi ca "gata"

## Ce s-a implementat

### FAZA 1 - Prototip (27 Feb 2026)
- [x] Login securizat JWT
- [x] Dashboard Admin cu statistici
- [x] Hartă interactivă Leaflet/OpenStreetMap
- [x] Tabel comenzi cu status badges
- [x] Alocare manuală comenzi
- [x] Aplicație Livrator PWA
- [x] Buton SUNĂ + Navigație Google Maps
- [x] Butoane status: ACCEPT → RIDICAT → LIVRAT
- [x] Panou Restaurant cu timp pregătire + GATA
- [x] Seed 100 comenzi demo, 5 livratori, 5 restaurante

### FAZA 1.5 - WOW Features (4 Mar 2026)
- [x] Hartă centrată pe Bacău cu restaurante reale
- [x] Simulare mișcare livratori pe hartă (animație frontend)
- [x] Grafice Admin: Comenzi/Oră (BarChart) + Venituri/Oră (AreaChart)
- [x] Sumar Zi Curentă cu 4 KPIs
- [x] Notificări audio Restaurant (fix sunet repetitiv)
- [x] Notificări audio Driver (la comandă nouă + vibrație)
- [x] Branding custom "ProDelivery Bacău" (deep navy + orange)
- [x] Restaurante Bacău: Trattoria Da Vinci, La Cuptor, Sushi Room, Burger Craft, Casa Moldoveanu
- [x] Adrese clienți cu străzi reale din Bacău

## Backlog Prioritizat

### P0 (Critical) - FAZA 2
- [ ] Salvare programări livratori în DB
- [ ] Zone livrare geospațiale + taxe automate
- [ ] Logica completă flux comenzi (blocare Ridicat până restaurant confirmă)
- [ ] Istoric livrări livrator

### P1 (Important) - FAZA 3
- [ ] GPS tracking live (WebSocket)
- [ ] Alocare automată (algoritm cel mai apropiat)
- [ ] Poziție livrator în timp real pe hartă

### P2 (Nice to Have) - FAZA 4+
- [ ] Push notifications (Firebase)
- [ ] Integrări Glovo/Wolt/Bolt (webhooks)
- [ ] Rapoarte și statistici avansate
- [ ] Export date (Excel/PDF)
- [ ] Rating bidirecțional
- [ ] Aplicație nativă Android/iOS

## Credențiale Test
```
Admin: admin@delivery.ro / admin123
Driver: driver-001@delivery.ro / driver123
Restaurant: rest-001@delivery.ro / restaurant123
```

## API Endpoints
```
POST /api/auth/login - Autentificare
POST /api/seed - Creare date demo
GET /api/orders - Lista comenzi
GET /api/orders/driver/{id} - Comenzile unui livrator
GET /api/orders/restaurant/{id} - Comenzile unui restaurant
PUT /api/orders/{id}/assign - Alocare comandă
PUT /api/orders/{id}/status - Update status
PUT /api/orders/{id}/preparing - Set timp pregătire
PUT /api/orders/{id}/ready - Marcheaza gata
GET /api/drivers - Lista livratori
GET /api/restaurants - Lista restaurante
GET /api/stats - Statistici dashboard
GET /api/stats/hourly - Statistici pe oră (grafice)
```
