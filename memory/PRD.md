# ProDelivery Bacău - PRD

## Problem Statement
Platformă de management livrări și ride-sharing pentru zona Bacău, România. Proiect dezvoltat în faze pe 7-8 luni, buget total €20,000.

## Roluri Utilizatori
- **Admin**: Dashboard, management, analytics, program control (10-02), sloturi urgență (10-22)
- **Șofer**: Comenzi, program 10-22, sloturi urgență disponibile, actualizare status
- **Restaurant**: Gestionare comenzi, confirmare "gata", anulare cu motiv

## Arhitectură
```
/app/backend/ → server.py, database.py, auth.py
  models/ → user, driver, restaurant, order, schedule, emergency_slot
  routers/ → auth, drivers, restaurants, orders, stats, seed, schedules, emergency_slots
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

## Rămas
- Task 2.2: Zone geospațiale (hartă + taxe automat)
- Phase 3-8: GPS, Push, Glovo/Wolt/Bolt, Rapoarte, App Nativă, Lansare
- Algoritm automat urgență
