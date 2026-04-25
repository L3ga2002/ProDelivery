# ProDelivery Bacău - PRD

## Problem Statement
Platformă de management livrări și ride-sharing pentru zona Bacău, România. Proiect dezvoltat în faze pe 7-8 luni, buget total €20,000.

## Roluri Utilizatori
- **Admin**: Dashboard, management, analytics, program control (10-02), sloturi urgență (10-22), zone de livrare
- **Șofer**: Comenzi, program 10-22, sloturi urgență disponibile, actualizare status
- **Restaurant**: Gestionare comenzi, confirmare "gata", anulare cu motiv

## Arhitectură
```
/app/backend/ → server.py, database.py, auth.py
  models/ → user, driver, restaurant, order, schedule, emergency_slot, delivery_zone
  routers/ → auth, drivers, restaurants, orders, stats, seed, schedules, emergency_slots, zones
```

## Reguli Program
- **Livratori**: selectează 10:00-22:00 | **Admin**: controlează 10:00-02:00
- **Fereastră**: Duminică 22:00 → Luni 10:00
- **Urgență**: doar 10:00-22:00, admin setează locuri, livratorii fără program iau
- **Format**: intervale "10-11", "11-12" etc.
- **Viitor**: ranking → prioritate calendar + algoritm automat urgență

## Credențiale: admin@delivery.ro/admin123 | driver-001@delivery.ro/driver123 | rest-001@delivery.ro/restaurant123

## Implementat
- Phase 1: MVP, branding, hartă, demo
- Phase 2: Backend modular, program șoferi, confirmări, analytics fără financiar, urgență
- Task 2.2: Zone de livrare geospațiale (Leaflet/OSM, poligoane pe hartă, CRUD zone, detecție automată zonă, taxe livrare) - COMPLETAT 26 Mar 2026
- Task 2.2.1: Sectoare livrare Bacău (Nord, Centru, Sud, Nord Extrem) cu 3 niveluri fixe per sector - IMPLEMENTAT 25 Apr 2026
- Admin poate acum filtra pe sector, redesena conturul unei zone, adăuga zone noi manual și folosește tarifare fixă per nivel: Zona 1 = 14 lei, Zona 2 = 22 lei, Zona 3 = 33 lei
- Seed demo creează 12 zone (4 sectoare × 3 zone) ca primă aproximare editabilă pe baza hărților primite de la user
- Refinement 25 Apr 2026: am rafinat manual poligoanele seed pentru cele 4 sectoare și am schimbat afișarea hărții astfel încât în modul "Toate" se văd doar contururile exterioare, iar pe filtru de sector se văd toate cele 3 zone pentru sectorul ales

## Key API Endpoints - Zone
- `GET /api/zones` - lista toate zonele
- `POST /api/zones` - creează zonă (admin only)
- `PUT /api/zones/{zone_id}` - actualizează zonă (admin only)
- `DELETE /api/zones/{zone_id}` - șterge zonă (admin only)
- `POST /api/zones/detect` - detectează zona pe baza coordonatelor lat/lng

## DB Schema - delivery_zones
```
{id, sector, zone_level, name, color, fee, polygon: [{lat, lng}], is_active, sort_order, created_at, updated_at}
```

## Rămas
- P0: Validare și rafinare manuală a celor 12 poligoane pe baza hărților reale ale clientului până coincid exact cu limitele operaționale dorite
- P0: Continuare rafinare fină punct-cu-punct împreună cu user/client până când fiecare sector este validat vizual ca 1:1 cu harta operațională
- P0: Legare completă comandă -> coordonate -> detectare zonă -> taxă aplicată automat în fluxul real de creare comandă
- Ranking-based Calendar Access (P1) - prioritate calendar pe baza rankingului șoferului
- Algoritm automat urgență (P2) - creare automată sloturi când crește volumul
- Phase 3: GPS tracking în timp real (WebSockets) + Alocare automată comenzi
- Phase 4: Push Notifications (Firebase)
- Phase 5: Integrări externe (Glovo/Wolt/Bolt API)
- Phase 6: Raportare avansată
- Phase 7: Aplicație nativă (Android/iOS)
- Phase 8: Lansare producție

## Tehnologii
- Frontend: React, Tailwind CSS, Recharts, Shadcn UI, PWA, react-leaflet, leaflet-draw
- Backend: FastAPI, Pydantic, Shapely (geo), modular routing
- Database: MongoDB (Motor)
- Mapping: OpenStreetMap/Leaflet (gratuit, fără Google Maps)
