# ProDelivery Bacău - PRD

## Problem Statement
Platformă de management livrări și ride-sharing pentru zona Bacău, România. Proiect dezvoltat în faze pe 7-8 luni, buget total €20,000.

## Roluri Utilizatori
- **Admin**: Dashboard complet, management comenzi/șoferi/restaurante, analytics, program control
- **Șofer**: Vizualizare/acceptare comenzi, program săptămânal (10:00-22:00), actualizare status
- **Restaurant**: Gestionare comenzi, confirmare "gata", anulare cu motiv

## Arhitectură Tehnică
- **Backend**: FastAPI (modular - routers/models/database) + MongoDB
- **Frontend**: React + Shadcn UI + Recharts
- **Auth**: JWT cu bcrypt

### Structura Backend
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
- `/api/schedules/scheduling-window`
- `/api/seed`

## Credențiale Test
- Admin: admin@delivery.ro / admin123
- Driver: driver-001@delivery.ro / driver123
- Restaurant: rest-001@delivery.ro / restaurant123

## Reguli Program Săptămânal
- **Livratori**: pot selecta ore doar 10:00-22:00
- **Admin**: poate edita toate orele 10:00-02:00 (inclusiv noapte)
- **Fereastră editare**: Duminică 22:00 → Luni 10:00
- **Ore noapte** (22:00-02:00): read-only pt livrator, vizibile cu marcaj albastru dacă setate de admin
- **Viitor**: ranking livrator → prioritate deschidere calendar + sloturi limitate

## Faze Implementate

### Phase 1 (Complete)
- MVP cu branding ProDeliveryBacau
- Dashboard Admin cu hartă Bacău, grafice, simulare demo interactivă
- Aplicații Driver și Restaurant cu notificări vizuale

### Phase 2 (Complete - 15 Mar 2026)
- **Task 2.5**: Backend refactorizat din monolitic în module
- **Task 2.1**: Sistem program șoferi - calendar săptămânal, admin summary cu ore/comenzi/zone
- **Task 2.3**: Flux comenzi cu confirmări (pickup/deliver) + anulare cu motiv obligatoriu
- **Task 2.4**: Analytics fără date financiare - distribuție per restaurant/driver, comenzi anulate

### Phase 2 - Actualizări (15 Mar 2026)
- Ore livrator limitate la 10:00-22:00, admin controlează 22:00-02:00
- Accept comandă direct (fără confirmare), confirmare la ridicare/livrare
- Zone per livrator (Zona 1-4) vizibile pe cardul adminului
- Fereastră program: Duminică 22:00 → Luni 10:00
- Structură pregătită pentru ranking viitor

### Phase 2 - Rămas
- **Task 2.2**: Zone geospațiale de livrare (harta + calcul taxe automat)

## Faze Viitoare
- Phase 3: GPS Tracking real-time (WebSockets) + Alocare automată comenzi
- Phase 4: Push Notifications (Firebase)
- Phase 5: Integrări externe (Glovo/Wolt/Bolt API Webhooks)
- Phase 6: Rapoarte avansate
- Phase 7: Aplicație nativă (Android/iOS)
- Phase 8: Testing complet și Lansare producție
