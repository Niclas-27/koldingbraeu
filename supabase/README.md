# Supabase – bereichsübergreifend

Projekt `koldingbraeu` (ID `ysmnvtuxckiflvvfxxiy`), Region Frankfurt (eu-central-1).

Hier liegt nur, was alle Bereiche gemeinsam nutzen. Die Tabellen und Funktionen eines Bereichs stehen in seinem Ordner
(`features/<bereich>/schema*.sql`). Ausgeführt werden alle Änderungen in Supabase als nummerierte Migrationen
(*Database → Migrations*); die Dateien hier im Repo zeigen den jeweiligen Stand zum Nachlesen.

- `core.sql` – Profile, Rollen, Hilfsfunktionen `private.rolle()`, `private.ist_braumeister()`, `private.ist_admin()`,
  Trigger für neue Konten und Rollenschutz.
- `functions/einladen/` – Edge Function, mit der der Admin Braumeister per E-Mail einlädt.
- `functions/galerie-hochladen/` – Edge Function, über die Gäste einer laufenden Verkostung bis zu drei Fotos in die Galerie laden (prüft Code, Schlüssel und Limit, nimmt nur JPEG).
- Storage-Bucket `bilder` – öffentlich lesbar; hochladen, ersetzen und löschen dürfen nur Braumeister (Policies in `features/tastings/schema/04_images.sql`).

## Rollen

| Rolle | Darf |
|-------|------|
| Gast (nicht angemeldet) | Öffentliches lesen; per QR-Code an einer laufenden Verkostung teilnehmen |
| Konto ohne Rolle | nichts (z. B. gesperrte Zugänge) |
| `braumeister` | alles sehen, anlegen und bearbeiten; Bewertungen ausblenden |
| `admin` | zusätzlich löschen, Rollen vergeben, einladen, Bewertungen ändern und nachtragen, Bierstile ergänzen |

Die Rechte stehen in der Datenbank (Row Level Security und geprüfte Funktionen), nicht nur in der Oberfläche.
