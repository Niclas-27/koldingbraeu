-- Koldingbräu – Sude: Ziel-Karbonathärte und Speise/Zucker als Auswahl (Stand 22.11.2026)
-- Setzt features/brews/schema/10_milchsaeure_getrennt.sql voraus.
-- Nur Hinzufügen – darf vor dem Release der Oberfläche laufen (siehe HANDOVER.md 2.5). Lief am 22.11.2026.
--
-- ziel_kh: Karbonathärte, auf die der Milchsäure-Rechner im Wasser-Schritt senkt. Bisher nur ein
--   ungespeichertes Feld im Assistenten, sprang darum beim Zurückblättern auf 2 °dH zurück.
-- speise_art / speise_menge: ersetzen für neue Sude den Freitext sude.zucker. Zucker und Traubenzucker
--   in Gramm für die ganze Biermenge, Speise in Litern. sude.zucker bleibt für alte Einträge stehen.

alter table public.sude add column ziel_kh numeric(4,1);
alter table public.sude add column speise_art text
  check (speise_art in ('zucker', 'traubenzucker', 'speise'));
alter table public.sude add column speise_menge numeric(7,2);

comment on column public.sude.ziel_kh is 'Ziel-Karbonathärte in °dH für den Milchsäure-Rechner.';
comment on column public.sude.speise_art is 'Womit nachgegoren wurde: zucker (Haushaltszucker), traubenzucker oder speise.';
comment on column public.sude.speise_menge is 'Menge zu speise_art: Gramm bei zucker/traubenzucker, Liter bei speise – für die ganze Biermenge.';

-- Speise/Zucker ist (wie sude.zucker) für Gäste sichtbar, die Ziel-KH ist interne Angabe wie wasserhaerte.
grant select (speise_art, speise_menge) on public.sude to anon;
