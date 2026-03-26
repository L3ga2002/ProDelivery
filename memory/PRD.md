# ProDelivery Bacău - PRD

## Problem Statement
Platformă de management livrări și ride-sharing pentru zona Bacău, România. Proiect dezvoltat în faze pe 7-8 luni, buget total €20,000.

## Roluri Utilizatori
- **Admin**: Dashboard complet, management comenzi/șoferi/restaurante, analytics, program control, sloturi urgență
- **Șofer**: Vizualizare/acceptare comenzi, program săptămânal (10:00-22:00), sloturi urgență, actualizare status
- **Restaurant**: Gestionare comenzi, confirmare "gata", anulare cu motiv

## Arhitectură Tehnică
```
/app/backend/
├── server.py, database.py, auth.py
├── models/ (user, driver, restaurant, order, schedule, emergency_slot)
├── routers/ (auth, drivers, restaurants, orders, stats, seed, schedules, emergency_slots)
```
- Backend: FastAPI + MongoDB | Frontend: React + Shadcn UI + Recharts | Auth: JWT/bcrypt

## API Endpoints
- Auth: `/api/auth/login`, `/api/auth/register`, `/api/auth/me`
- Orders: `/api/orders`, `/api/orders/{id}/status`, `/api/orders/{id}/assign`, etc.
- Drivers/Restaurants: `/api/drivers`, `/api/restaurants`
- Stats: `/api/stats`, `/api/stats/hourly`, `/api/stats/analytics`
- Schedules: `/api/schedules`, `/api/schedules/driver/{id}`, `/api/schedules/admin/summary`, `/api/schedules/scheduling-window`
- Emergency: `/api/schedules/emergency`, `/api/schedules/emergency/{id}/claim`, DELETE `/api/schedules/emergency/{id}`
- Seed: `/api/seed`

## Credențiale Test
- Admin: admin@delivery.ro / admin123 | Driver: driver-001@delivery.ro / driver123 | Restaurant: rest-001@delivery.ro / restaurant123

## Reguli Program Săptămânal
- **Livratori**: selectează 10:00-22:00 | **Admin**: controlează 10:00-02:00 (inclusiv noapte)
- **Fereastră editare**: Duminică 22:00 → Luni 10:00
- **Sloturi urgență**: Admin setează locuri per oră, doar livratorii FĂRĂ program pe acea oră le pot lua
- **Viitor**: ranking livrator → prioritate calendar + sloturi limitate + algoritm automat urgență

## Implementat

### Phase 1 (Complete)
- MVP cu branding ProDeliveryBacau, hartă Bacău, grafice, simulare demo

### Phase 2 (Complete - 26 Mar 2026)
- Task 2.5: Backend modular (routers/models)
- Task 2.1: Program șoferi cu calendar, ore admin/driver, zone per livrator
- Task 2.3: Confirmări (pickup/deliver) + anulare cu motiv obligatoriu
- Task 2.4: Analytics fără date financiare
- **Sloturi Urgență**: Sistem complet - admin setează locuri, livratori le iau, claimed_by tracking

### Phase 2 - Rămas
- Task 2.2: Zone geospațiale de livrare (hartă + calcul taxe automat)

## Faze Viitoare
- Phase 3: GPS Tracking real-time (WebSockets) + Alocare automată
- Phase 4: Push Notifications (Firebase) 
- Phase 5: Integrări externe (Glovo/Wolt/Bolt)
- Phase 6: Rapoarte avansate | Phase 7: App nativă | Phase 8: Lansare producție
- **Algoritm automat urgență**: Detectare zile cu volum mare → creare automată sloturi
