-- Verkostungs-Galerie wie die Brautag-Galerie (07.11.2026): Bildunterschrift, Aufnahmedatum, Ausschnitt ändern.
-- Nur hinzufügend, stört den Live-Stand nicht.
alter table public.verkostung_bilder
  add column if not exists bildunterschrift text check (bildunterschrift is null or length(bildunterschrift) <= 200),
  add column if not exists aufgenommen date;
-- Bearbeiten (Bildunterschrift, Datum, neuer Pfad nach „Ausschnitt ändern“) nur Braumeister/Admin.
grant update (bildunterschrift, aufgenommen, pfad) on public.verkostung_bilder to authenticated;
create policy "Braumeister bearbeiten Galerie" on public.verkostung_bilder for update to authenticated
  using (private.ist_braumeister()) with check (private.ist_braumeister());
