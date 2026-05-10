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
- Phase 2 Map Polish 07 Mai 2026: harta principală folosește iconițe operaționale custom 3D/SVG — livratori pe scuter și restaurante storefront, cu legendă dedicată și fără poligoane de zone pe harta live
- Phase 2 UX Cleanup 07 Mai 2026: butonul și modalul „Tur Client” au fost eliminate la cererea userului
- Phase 2 Refactor 07 Mai 2026: extras harta live în `components/admin/LiveMapPanel.jsx`, iconițele/Leaflet setup în `components/admin/MapMarkerIcons.jsx` și hero/KPI/action buttons în `components/admin/AdminCommandCenter.jsx`, reducând riscul pentru modificări înainte de redeploy
- Phase 2 Map Status Polish 07 Mai 2026: marker-ele livratorilor au status vizual disponibil/ocupat/offline cu culori și mini-badge; popup-urile de hartă au fost redesenate cu informații clare pentru livrator/restaurant
- Code Review Fix Pass 07 Mai 2026: eliminat `dangerouslySetInnerHTML` din frontend; legenda hărții folosește SVG React safe, iar marker-ele Leaflet sanitizează id/aria înainte de HTML static intern
- Code Review Fix Pass 07 Mai 2026: reparate hook/catch issues principale în `RestaurantApp`, `DriverApp`, `AdminDashboard`; empty catches au log/debug/toast, iar timpii magici principali au fost extrași în constante
- Code Review Fix Pass 07 Mai 2026: extras `OrdersTab` și `RestaurantAnalyticsPanel` din `AdminDashboard`, pe lângă modulele deja extrase pentru hartă și command center
- Code Review Fix Pass 07 Mai 2026: refactor backend pentru `emergency_slots.bulk_delete_emergency_slots` și `restaurants.get_restaurant_analytics` în helper functions; `server.py` are return type hints de bază
- Code Review Fix Pass 07 Mai 2026: `DriverSchedule` a fost refăcut din table tags în CSS grid cu roluri ARIA, eliminând warning-urile DOM nesting/hydration din Driver App
- Code Review Fix Pass 10 Mai 2026: aplicat al doilea val de review — ThemeContext nu mai folosește `localStorage` (sessionStorage pentru preferință temă), `RestaurantApp`/`DriverApp` au catch-uri logate și constante pentru timing, iar callback-urile principale au dependențe stabilizate
- Code Review Fix Pass 10 Mai 2026: memoizate obiecte/array-uri inline în hartă, preview restaurant, zone polygons și analytics pentru a reduce rerender-uri inutile
- Code Review Fix Pass 10 Mai 2026: `AdminDashboard` a fost redus suplimentar prin extragerea `OrdersTab` și `RestaurantAnalyticsPanel`; `AdminCommandCenter`, `LiveMapPanel` și `MapMarkerIcons` rămân module separate
- Code Review Fix Pass 10 Mai 2026: backend refactor suplimentar — `schedules.auto_generate_normal_slots`, `zones.build_zone_update_payload` și `seed.seed_data` au fost sparte în helper functions mai mici
- Code Review Validation 10 Mai 2026: testing agent iteration 20 PASS 100% backend/frontend; static checks confirmă fără `dangerouslySetInnerHTML`, fără `localStorage`, fără identity comparisons evidente, fără warnings DriverSchedule DOM nesting
- Code Review Completion Pass 10 Mai 2026: după feedback user, au fost închise și resturile de maintainability: `RestaurantsTab`, `SettingsTab` și `DeliveryZoneMapParts` extrase; `DeliveryZonesManager` este mai mic și logica de hartă/desenare/poligoane este separată
- Code Review Completion Pass 10 Mai 2026: `SettingsTab` are `data-testid` pe controls, iar iteration 21 PASS confirmă Admin/Restaurant/Driver, seed, analytics, schedules, zones update, static checks și lipsa runtime errors după login
- Phase 2 Demo Data Cleanup 07 Mai 2026: curățat restaurant test non-demo din baza preview; demo-ul afișează 5 restaurante curate
- Operations UX Patch 10 Mai 2026: modalul „Alocă comandă” a fost refăcut cu layering peste overlay, search live/debounce pentru livratori și selecție comandă+livrator într-un singur flow.
- Operations UX Patch 10 Mai 2026: harta live are restaurante mai mici, statusuri livratori „Activ / În pauză / Offline / În livrare”, iconițe scuter/mașină, popup livrator fără coordonate și buton „Alocă comandă”, plus trasee dashed livrator→restaurant→client pentru comenzile active.
- Operations UX Patch 10 Mai 2026: butonul „Adaugă livrator” a fost mutat în tabul Livratori, iar „Adaugă restaurant” în tabul Restaurante; demo-ul și „Comandă nouă” rămân active în command center.
- Operations UX Patch 10 Mai 2026: adăugarea livratorilor include vehicul scuter/mașină și integrare Resend pentru cod verificare email; în preview, senderul `onboarding@resend.dev` este limitat de Resend până la verificarea domeniului.
- Resend Restriction Fix 10 Mai 2026: dacă Resend returnează 403 pentru `onboarding@resend.dev` către destinatari externi, aplicația nu mai eșuează flow-ul; creează livratorul, păstrează hash-ul codului în DB și afișează adminului un cod local temporar pentru verificare în preview. Emailul real rămâne activ automat după verificarea domeniului și schimbarea senderului.
- Resend Domain Activation 10 Mai 2026: domeniul `prodeliverybacau.com` este verificat în Resend, iar aplicația folosește acum `verificare@prodeliverybacau.com` ca sender real; testul backend a returnat `email_delivery.status=sent` și `email_id` valid.
- Admin Program Visibility Patch 10 Mai 2026: calendarul rapid afișează acum explicit sloturile standard create, împărțirea Admin/Livrator și sloturile de urgență cu ocupate/total/libere direct în celule, plus sumar săptămânal de sloturi.
- Admin Driver Management Patch 10 Mai 2026: cardurile de livratori sunt clickabile și deschid dialog de gestiune; adminul poate seta scor manual 0-100 pentru rank, adăuga notă internă, reveni la scor automat și șterge livratorul din DB cu confirmare `STERGE`.
- Admin Driver Management Patch 10 Mai 2026: backend-ul include `PATCH /api/drivers/{driver_id}/ranking` și `DELETE /api/drivers/{driver_id}?confirm_delete=true`; ștergerea este blocată dacă livratorul are comenzi active și curăță userul, programările și claim-urile de urgență.
- Operations UX Patch 10 Mai 2026: Programul admin are calendar rapid permanent 10:00-02:00, sloturi standard verzi, sloturi urgență roșii, confirmare pentru intervale de noapte și flow „Refă sloturile săptămânii trecute” cu preview.
- Operations UX Patch 10 Mai 2026: zonele de livrare create sunt blocate implicit; editarea/ștergerea cer confirmare explicită `CONFIRM`, iar backend-ul refuză modificările fără confirmare.
- Operations UX Patch 10 Mai 2026: Driver App are notificare profesională „Urmează să primești o comandă”, card verificare email pentru livratori neverificați și dialog explicativ pentru scor/rank.
- Security Patch 10 Mai 2026: login-ul are brute-force lockout după 5 încercări eșuate, iar backend-ul returnează CORS explicit intern; preflight-ul extern din ingress încă răspunde wildcard la OPTIONS înainte de backend.

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
- `POST /api/drivers/{driver_id}/verify-email` - verifică emailul livratorului cu codul trimis prin Resend
- `POST /api/drivers/{driver_id}/resend-verification` - retrimite codul de verificare email pentru livrator
- `PATCH /api/drivers/{driver_id}/ranking` - setează/șterge scor manual de rank pentru livrator
- `DELETE /api/drivers/{driver_id}?confirm_delete=true` - șterge livratorul și userul asociat, dacă nu există comenzi active
- `POST /api/schedules/admin/clone-previous-week` - preview/confirmare pentru refacerea sloturilor după săptămâna precedentă

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
- P1: Testare vizuală cu clientul pe iconițele 3D ale hărții; ajustare dacă preferă alt simbol pentru restaurante decât storefront
- P2: refactor structural suplimentar pentru split complet pe fișiere/componente încă lungi (`AdminDashboard`, `AdminScheduleView`, `DeliveryZonesManager`) și reducerea suplimentară a dimensiunii lui `seed.py`; `AdminDashboard` rămâne ~1450 LOC după primul split și trebuie continuat într-un pas separat
- P2: după iteration 21, nu există defect blocant cunoscut; rămâne doar cleanup gradual de maintainability pentru `AdminDashboard.jsx` / `AdminScheduleView.jsx`, fără impact funcțional curent
- P2: reglaj fin al algoritmului automat de urgență pe baza datelor reale de volum/comenzi ale clientului
- P1: monitorizare primele emailuri reale Resend pentru spam/deliverability; fallback-ul local rămâne doar backup dacă providerul returnează eroare.
- P1: rezolvare la nivel ingress/platformă pentru preflight OPTIONS care returnează `Access-Control-Allow-Origin: *` extern, deși backend-ul returnează explicit origin intern
- P1: CORS preflight extern necesită modificare de ingress Kubernetes; troubleshoot RCA confirmă că FastAPI răspunde corect pe localhost și OPTIONS este interceptat înainte de backend.
- P1: suport real pentru multi-comandă pe același livrator dacă business-ul confirmă că livratorii pot prelua încă o comandă simultan
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
