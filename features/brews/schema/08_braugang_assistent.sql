-- Koldingbräu – Sude: Braugang-Assistent (Stand 31.10.2026)
-- Setzt features/brews/schema.sql und features/recipes/schema.sql (rezept_id) voraus.
--
-- Der Assistent führt in Schritten durch einen aus einem Rezept gestarteten Braugang und speichert dabei
-- laufend in genau die Spalten, die der bestehende Sud-Editor schon kennt (hauptguss, nachguss, malz, rasten,
-- hopfen, kochzeit, stammwuerze, hefe, hefemenge, abgefuellt, …) – kein Parallel-Datenmodell dafür. Neu sind
-- nur: ein Status, damit ein begonnener, aber noch nicht fertiger Braugang von einem dokumentierten Sud zu
-- unterscheiden ist; ein paar bisher fehlende Messwerte (Wasserhärte, Milchsäure, pH, Refraktometer); eine
-- eigene Tabelle für beliebig viele Zwischenmessungen während der Gärung; und ein offenes Feld für Angaben,
-- die sich keiner der festen Spalten zuordnen lassen.

alter table public.sude add column status text not null default 'dokumentiert'
  check (status in ('entwurf','gaerung','dokumentiert'));
comment on column public.sude.status is
  'entwurf = Braugang-Assistent läuft noch vor dem Anstellen; gaerung = angestellt, Gärung/Abfüllen noch offen; dokumentiert = abgeschlossen (bisheriger Normalfall, auch für alle Alt-Sude)';

alter table public.sude add column wasserhaerte numeric(5,1);              -- °dH, fürs Milchsäure-Richtwert
alter table public.sude add column milchsaeure numeric(6,1);               -- ml, tatsächlich zugegeben
alter table public.sude add column ph_vorher numeric(3,2);
alter table public.sude add column ph_nachher numeric(3,2);
alter table public.sude add column refraktometer_anstellen numeric(4,1);   -- °Brix, zusätzlich zur Spindel (stammwuerze)
alter table public.sude add column refraktometer_restextrakt numeric(4,1); -- °Brix, zusätzlich zur Spindel (restextrakt)
-- Katalog-Feld für Angaben, die zu keiner festen Spalte passen: [{schritt, label, wert}]
alter table public.sude add column wizard_notizen jsonb not null default '[]'
  check (jsonb_typeof(wizard_notizen) = 'array');

-- Zwischenmessungen während der Gärung: beliebig viele, über Tage/Wochen nachgetragen
create table public.sud_messungen (
  id uuid primary key default gen_random_uuid(),
  sud_id uuid not null references public.sude(id) on delete cascade,
  bezeichnung text not null check (length(trim(bezeichnung)) between 1 and 60),  -- z. B. "Tag 4" oder ein Datum als Text
  plato numeric(4,1),
  refraktometer numeric(4,1),
  angelegt timestamptz not null default now(),
  angelegt_von uuid references public.profile(id) on delete set null default auth.uid(),
  constraint sud_messungen_wert check (plato is not null or refraktometer is not null)
);
create index sud_messungen_sud_idx on public.sud_messungen (sud_id);

alter table public.sud_messungen enable row level security;
-- Reines Arbeitswerkzeug wie sud_schritte/sud_bilder – kein Gäste-Inhalt.
grant select, insert, update, delete on public.sud_messungen to authenticated;
create policy "Braumeister sehen Messungen" on public.sud_messungen for select to authenticated using (private.ist_braumeister());
create policy "Braumeister legen Messungen an" on public.sud_messungen for insert to authenticated with check (private.ist_braumeister());
create policy "Braumeister bearbeiten Messungen" on public.sud_messungen for update to authenticated
  using (private.ist_braumeister()) with check (private.ist_braumeister());
create policy "Braumeister löschen Messungen" on public.sud_messungen for delete to authenticated using (private.ist_braumeister());

-- Die neuen Spalten sind reine Braumeister-Werkzeuge (wie notizen) – kein zusätzliches anon-Grant nötig,
-- sie bleiben automatisch außerhalb der für Gäste freigegebenen Spaltenliste.
