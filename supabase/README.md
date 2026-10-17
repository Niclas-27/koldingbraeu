# Supabase-Backend

Projekt `koldingbraeu` (ID `ysmnvtuxckiflvvfxxiy`), Region Frankfurt (eu-central-1).

- `schema.sql` – Stand der Datenbank (Tabellen, Rechte, Trigger). Die einzelnen Migrationen sind im Projekt unter
  *Database → Migrations* hinterlegt: `grundgeruest_profile_sude`, `sude_lesen_nur_braumeister`,
  `rollenschutz_serverseitig_erlauben`, `profil_email`.
- `functions/einladen/` – Edge Function, mit der der Admin Braumeister per E-Mail einlädt.

## Rollen

| Rolle | Darf |
|-------|------|
| Gast (nicht angemeldet) | freigegebene Sude ohne Notizen und Bewertung lesen |
| Konto ohne Rolle | nichts (z. B. gesperrte Zugänge) |
| `braumeister` | alle Sude lesen, anlegen, bearbeiten; Profile sehen; eigenen Namen ändern |
| `admin` | zusätzlich Sude löschen, Rollen vergeben, einladen |

Die Rechte stehen in der Datenbank (Row Level Security), nicht nur in der Oberfläche.
