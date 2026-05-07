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
- Flux comenzi 25 Apr 2026: creare comandă admin cu locație selectată pe hartă, detectare automată zonă/sector/nivel și calcul automat taxă + total final în backend și frontend
- Task 2.3: Ranking livratori + acces etapizat la calendar - IMPLEMENTAT 25 Apr 2026 (tier-uri Gold / Silver / Bronze / Start, scor calculat din livrări + anulări + punctualitate + senioritate, ferestre separate de acces la calendar)
- Task 2.4: Auto-generator sloturi de urgență - IMPLEMENTAT 25 Apr 2026 (buton admin + algoritm pe ore de vârf, sloturi marcate AUTO/system)
- UI/UX 25 Apr 2026: Adăugat sistem light/dark theme cu toggle vizibil pe Login, Admin, Driver și Restaurant, cu persistență locală și ajustări de contrast pentru dark mode
- Security/Quality 25 Apr 2026: migrare auth frontend/backend pe cookie-uri httpOnly + refresh/logout, fallback Bearer păstrat pentru compatibilitate, demo/test credentials mutate în variabile de mediu, curățare console logs, chei React stabilizate, helper comun pentru testele backend și refactor helper în `schedules.py` + `emergency_slots.py`
- Security/Quality 25 Apr 2026 (batch 2): refactor helper în `zones.py` + `orders.py`, `seed.py` mutat pe `secrets.SystemRandom()`, memoizare pentru calculele grele din `DeliveryZonesManager` și `DriverSchedule`, validare completă frontend/backend după batch-ul mare
- Production hardening 25 Apr 2026: cookie-urile auth trec pe `secure + SameSite=None` pe HTTPS, iar `CORS_ORIGINS` include și `prodeliverybacau.com` / `www.prodeliverybacau.com`; preview validat fără regresii după patch
- Phase 2 Rework P0 07 Mai 2026: restaurantele au acum locație individuală cu autocomplete/geocoding gratuit OpenStreetMap/Nominatim prin backend proxy, hartă care se centrează pe restaurant și marker automat
- Phase 2 Rework P0 07 Mai 2026: zonele de livrare sunt gestionate individual per restaurant; zonele globale vechi Zona 1/2/3 au fost eliminate din workflow și seed-ul demo creează doar zone per restaurant
- Phase 2 Rework P0 07 Mai 2026: tab-ul Restaurante include managerul de arii de livrare pentru restaurantul selectat, cu desenare UX nouă, auto-închidere poligon când se apasă primul punct, nume zonă, preț livrare, culoare, activ/inactiv și undo prin buton / Ctrl
- Phase 2 Rework P0 07 Mai 2026: harta live principală nu mai afișează poligoane de livrare; rămâne concentrată pe livratori și restaurante
- Phase 2 Rework P0 07 Mai 2026: backend-ul detectează zona doar în contextul restaurantului selectat și expune `/api/restaurants/available` pentru filtrarea internă a restaurantelor disponibile după coordonate
- Phase 2 Rework P1 07 Mai 2026: UX desenare zone modificat conform cerinței userului — tasta `Ctrl` șterge ultimul punct/ultima linie, nu Backspace/C
- Phase 2 Rework P1 07 Mai 2026: Restaurant App afișează timer live după selectarea timpului de preparare; timerul numără invers, devine întârziere după expirare, redă alertă sonoră scurtă și păstrează butonul „Comanda gata” sub timer
- Phase 2 Rework P1 07 Mai 2026: backend-ul salvează timp estimat, start, deadline, timp real și întârziere pentru prepararea comenzilor (`preparation_*` fields)
- Phase 2 Rework P1 07 Mai 2026: Admin Restaurants include analytics detaliat per restaurant cu KPI-uri, grafice pe ore/luni și istoric comenzi cu timpi de preparare/livrare
- Phase 2 Rework P1 07 Mai 2026: Program/Sloturi reorganizat în jurul sloturilor normale; există modal setup pentru generare automată cu zile, interval, număr sloturi, tip normal/urgență și repetare
- Phase 2 Rework P1 07 Mai 2026: backend-ul include generare automată sloturi normale, ștergere bulk a sloturilor automate și generare setup pentru sloturi de urgență
- Phase 2 Design Polish 07 Mai 2026: roșul agresiv a fost redus; UI-ul folosește mai mult slate/navy/amber pentru un look de dispecerat logistic, păstrând roșu doar pentru alerte/întârzieri/acțiuni distructive
- Phase 2 UX/Design Polish 07 Mai 2026: la adăugare restaurant, după autocomplete/geocoding, pinul de pe hartă poate fi ajustat manual prin drag sau click pe hartă; coordonatele lat/lng se actualizează înainte de salvare
- Phase 2 UX/Design Polish 07 Mai 2026: Admin Dashboard are hero premium „Control Room · Bacău” și KPI cards redesenate pentru o prezentare mai solidă în fața clientului
- Phase 2 Analytics Polish 07 Mai 2026: analytics restaurant extins în UI cu grafice vizibile pe ore, zile, săptămâni, luni, ani + card de insight operațional
- Phase 2 Program Polish 07 Mai 2026: adăugat endpoint și UI pentru ștergere bulk sloturi de urgență generate conform setup-ului; curăță și intrările de urgență din programele livratorilor
- Phase 2 UX Bugfix 07 Mai 2026: schimbarea între restaurante în tab-ul Restaurante nu mai demontează/înlocuiește agresiv panoul analytics; datele rămân afișate și se actualizează discret, fără refresh vizual/jump urât
- Phase 2 Design Pass 07 Mai 2026: aplicat polish A+B+C+D cerut de user — tab Restaurante cu carduri premium și selector stabil, Program/Sloturi cu contrast indigo/amber mai curat, Comenzi/Admin cu control surface și tabel mai profesional, Restaurant App cu hero „Kitchen Queue”, stat tiles și timer mare premium
- Phase 2 Map/Presentation Polish 07 Mai 2026: harta principală folosește iconițe operaționale custom — livratori pe scuter 🛵 și restaurante storefront 🏪, cu legendă dedicată și fără poligoane de zone pe harta live
- Phase 2 Client Demo Polish 07 Mai 2026: adăugat buton „Tur Client” în Admin, cu 4 pași de prezentare pentru restaurant→pin→zone, analytics, program și hartă operațională; taburile admin sunt acum controlate pentru navigare fluidă din tur
- Phase 2 Demo Data Cleanup 07 Mai 2026: curățat restaurant test non-demo din baza preview; demo-ul afișează 5 restaurante curate

## Key API Endpoints - Zone
- `GET /api/zones` - lista toate zonele
- `POST /api/zones` - creează zonă (admin only)
- `PUT /api/zones/{zone_id}` - actualizează zonă (admin only)
- `DELETE /api/zones/{zone_id}` - șterge zonă (admin only)
- `POST /api/zones/detect` - detectează zona pe baza coordonatelor lat/lng
- `GET /api/geocoding/search` - autocomplete/geocoding Nominatim pentru adrese/restaurante în Bacău
- `GET /api/zones?restaurant_id=...` - listează doar zonele unui restaurant
- `POST /api/restaurants/available` - returnează restaurantele care acoperă coordonatele date prin zonele proprii
- `GET /api/restaurants/{restaurant_id}/analytics` - analytics operațional per restaurant
- `PUT /api/orders/{order_id}/preparing` - pornește timerul de preparare și salvează estimarea/deadline-ul
- `PUT /api/orders/{order_id}/ready` - finalizează prepararea și salvează timpul real + întârzierea
- `POST /api/schedules/admin/auto-generate` - generează sloturi normale după setup admin
- `POST /api/schedules/admin/bulk-delete` - șterge bulk sloturile automate normale
- `POST /api/schedules/emergency/setup-generate` - generează/actualizează sloturi de urgență după setup admin
- `POST /api/schedules/emergency/bulk-delete` - șterge bulk sloturi de urgență după săptămână/zile/interval și curăță programările asociate

## DB Schema - delivery_zones
```
{id, restaurant_id, restaurant_name, sector, zone_level, name, color, fee, polygon: [{lat, lng}], is_active, sort_order, created_at, updated_at}
```

## Rămas
- P0: Validare cu clientul pe workflow-ul nou: fiecare restaurant își desenează propriile zone și nu mai există zone globale pe harta live
- P0: Testare reală cu mai multe restaurante + zone suprapuse pentru confirmarea filtrării pe restaurant
- P1: Testare UX cu clientul pe pinul ajustabil, zone per restaurant și modalul de generare sloturi pentru a regla terminologia „slot/oră” vs. „slot total”
- P1: Design polish propus pentru următorul pas: cards restaurante mai profesionale, skeleton-uri subtile, detalii vizuale pe hărți/analytics și ordine mai clară în tab-ul Restaurante
- P1: Testare vizuală cu clientul pe noul contrast indigo/slate/amber și ajustări fine dacă preferă altă direcție cromatică
- P1: Testare vizuală cu clientul pe iconițele hărții și Tur Client; ajustare dacă preferă alt simbol pentru restaurante decât storefront
- P2: refactor structural prioritar pentru split complet pe fișiere/componente foarte lungi (`AdminDashboard`, `AdminScheduleView`, `DriverSchedule`) și reducerea suplimentară a dimensiunii lui `seed.py`
- P2: reglaj fin al algoritmului automat de urgență pe baza datelor reale de volum/comenzi ale clientului
- P2: polish vizual suplimentar pe toate ecranele după feedback client — fără aplicație client final și fără pregătire Faza 3 în acest scope
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
