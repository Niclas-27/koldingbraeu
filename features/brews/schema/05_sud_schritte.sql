-- Koldingbräu – Bereich Sude: Checkliste für den Brautag (Stand 27.10.2026)
-- Schritte werden im Code aus den Sud-Daten abgeleitet (Rasten, Hopfengaben, Kochzeit – siehe brews.js
-- schritteAbleiten()). Diese Tabelle hält nur den Fortschritt: welche Schritte sind abgehakt, plus eigene
-- Zusatzschritte, die der Nutzer während des Brauens frei ergänzen kann.
--
-- Ein abgeleiteter Schritt (schluessel gesetzt) existiert als Zeile nur, solange er abgehakt ist – Abhaken
-- legt die Zeile an, Abwählen löscht sie wieder. Ein eigener Zusatzschritt (schluessel NULL, text gesetzt)
-- existiert dagegen dauerhaft ab dem Anlegen, mit eigenem erledigt-Status zum Umschalten.

create table public.sud_schritte (
  id uuid primary key default gen_random_uuid(),
  sud_id uuid not null references public.sude(id) on delete cascade,
  schluessel text,              -- feste ID eines aus den Sud-Daten abgeleiteten Schritts (z. B. 'rast-0', 'hopfen-2'); NULL bei eigenen Zusatzschritten
  text text,                    -- Beschriftung, nur bei eigenen Zusatzschritten gesetzt
  gruppe text,                  -- Phase, in die ein eigener Zusatzschritt einsortiert ist (z. B. 'kochen'); bei abgeleiteten Schritten ungenutzt
  erledigt boolean not null default false,
  erledigt_am timestamptz,
  erledigt_von uuid references public.profile(id) on delete set null,
  angelegt timestamptz not null default now(),
  angelegt_von uuid references public.profile(id) on delete set null default auth.uid(),
  constraint sud_schritte_art check (
    (schluessel is not null and text is null) or (schluessel is null and text is not null)
  ),
  unique (sud_id, schluessel)
);

create index sud_schritte_sud_idx on public.sud_schritte (sud_id);

alter table public.sud_schritte enable row level security;
-- Reines Arbeitswerkzeug für den Brautag, kein Gäste-Inhalt – wie bei der Fotogalerie (schema/04) nur Braumeister/Admin.
grant select, insert, update, delete on public.sud_schritte to authenticated;
create policy "Braumeister sehen Schritte" on public.sud_schritte for select to authenticated using (private.ist_braumeister());
create policy "Braumeister legen Schritte an" on public.sud_schritte for insert to authenticated with check (private.ist_braumeister());
create policy "Braumeister bearbeiten Schritte" on public.sud_schritte for update to authenticated
  using (private.ist_braumeister()) with check (private.ist_braumeister());
create policy "Braumeister löschen Schritte" on public.sud_schritte for delete to authenticated using (private.ist_braumeister());
