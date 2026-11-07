# Supabase – bereichsübergreifend

Projekt `koldingbraeu` (ID `ysmnvtuxckiflvvfxxiy`), Region Frankfurt (eu-central-1).

Hier liegt nur, was alle Bereiche gemeinsam nutzen. Die Tabellen und Funktionen eines Bereichs stehen in seinem Ordner
(`features/<bereich>/schema*.sql`). Ausgeführt werden alle Änderungen in Supabase als nummerierte Migrationen
(*Database → Migrations*); die Dateien hier im Repo zeigen den jeweiligen Stand zum Nachlesen.

- `core.sql` – Profile, Rollen, Hilfsfunktionen `private.rolle()`, `private.ist_braumeister()`, `private.ist_admin()`,
  Trigger für neue Konten und Rollenschutz.
- `functions/einladen/` – Edge Function, mit der der Admin Braumeister per E-Mail einlädt.
- `functions/galerie-hochladen/` – Edge Function, über die Gäste einer laufenden Verkostung bis zu drei Fotos in die Galerie laden (prüft Code, Schlüssel und Limit, nimmt nur JPEG).
- `functions/galerie-loeschen/` – Edge Function, über die ein Gast sein zuletzt hochgeladenes Galerie-Foto wieder entfernt (gleiche Prüfung von Code und Schlüssel, löscht immer genau das jüngste eigene Foto).
- Beide Galerie-Functions laufen ohne Anmeldung (`verify_jwt = false`), weil Gäste kein Konto haben, und arbeiten mit dem geheimen Schlüssel am Speicher vorbei – die Prüfung steckt in der Function selbst.
- Storage-Bucket `bilder` – öffentlich lesbar (Fotos und Etiketten der Sude und Rezepte, Titelbilder, Bierbilder); hochladen, ersetzen und löschen dürfen nur Braumeister (Policies in `features/tastings/schema/04_images.sql`).
- Storage-Bucket `verkostung-galerie` – **privat**, nur JPEG bis 1,5 MB. Hier liegen die Galerie-Fotos der Verkostungen; sehen, hochladen und löschen dürfen nur Braumeister (Anzeige über kurzlebige signierte Links). Gäste kommen nur über die beiden Edge Functions heran (`features/tastings/schema/09_galerie_privater_bucket.sql`).

Edge Functions werden in Supabase bereitgestellt (*Edge Functions*), nicht über GitHub – eine Änderung im Repo
allein ändert die laufende Function nicht.

## Rollen

| Rolle | Darf |
|-------|------|
| Gast (nicht angemeldet) | Öffentliches lesen; per QR-Code an einer laufenden Verkostung teilnehmen |
| Konto ohne Rolle | nichts (z. B. gesperrte Zugänge) |
| `braumeister` | alles sehen, anlegen und bearbeiten; Bewertungen ausblenden |
| `admin` | zusätzlich löschen, Rollen vergeben, einladen, Bewertungen ändern und nachtragen, Bierstile ergänzen |

Die Rechte stehen in der Datenbank (Row Level Security und geprüfte Funktionen), nicht nur in der Oberfläche.
