# ProDelivery Bacău - PRD

## Problem Statement
Platformă de management livrări și ride-sharing pentru zona Bacău, România. Proiect dezvoltat în faze pe 7-8 luni, buget total €20,000.

## Roluri Utilizatori
- **Admin**: Dashboard complet, management comenzi/șoferi/restaurante, analytics
- **Șofer**: Vizualizare/acceptare comenzi, program săptămânal, actualizare status
- **Restaurant**: Gestionare comenzi, confirmare "gata", anulare cu motiv

## Arhitectură Tehnică
- **Backend**: FastAPI (modular - routers/models/database) + MongoDB
- **Frontend**: React + Shadcn UI + Recharts
- **Auth**: JWT cu bcrypt

### Structura Backend (după refactorizare Phase 2)
```
/app/backend/
├── server.py          # Entry point FastAPI
├── database.py        # Conexiune MongoDB
├── auth.py            # JWT + bcrypt helpers
├── models/
│   ├── user.py, driver.py, restaurant.py, order.py, schedule.py
├── routers/
│   ├── auth.py, drivers.py, restaurants.py, orders.py, stats.py, seed.py, schedules.py
```

## API Endpoints
- `/api/auth/login`, `/api/auth/register`, `/api/auth/me`
- `/api/orders`, `/api/orders/{id}/status`, `/api/orders/{id}/assign`, etc.
- `/api/drivers`, `/api/restaurants`
- `/api/stats`, `/api/stats/hourly`, `/api/stats/analytics`
- `/api/schedules`, `/api/schedules/driver/{id}`, `/api/schedules/admin/summary`
- `/api/seed`

## Credențiale Test
- Admin: admin@delivery.ro / admin123
- Driver: driver-001@delivery.ro / driver123
- Restaurant: rest-001@delivery.ro / restaurant123

## Faze Implementate

### Phase 1 (Complete)
- MVP cu branding ProDeliveryBacau
- Dashboard Admin cu hartă Bacău, grafice, simulare demo
- Aplicații Driver și Restaurant cu notificări vizuale

### Phase 2 (Complete - 15 Mar 2026)
- **Task 2.5**: Backend refactorizat din monolitic în module (routers/models)
- **Task 2.1**: Sistem program șoferi - calendar săptămânal cu ore, admin summary
- **Task 2.3**: Flux comenzi cu dialoguri de confirmare + anulare cu motiv obligatoriu
- **Task 2.4**: Analytics fără date financiare - distribuție comenzi per restaurant/driver, comenzi anulate cu motive

### Phase 2 - Rămas
- **Task 2.2**: Zone geospațiale de livrare (harta + calcul taxe automat)

## Faze Viitoare
- Phase 3: GPS Tracking real-time (WebSockets) + Alocare automată comenzi
- Phase 4: Push Notifications (Firebase)
- Phase 5: Integrări externe (Glovo/Wolt/Bolt API Webhooks)
- Phase 6: Rapoarte avansate
- Phase 7: Aplicație nativă (Android/iOS)
- Phase 8: Testing complet și Lansare producție
