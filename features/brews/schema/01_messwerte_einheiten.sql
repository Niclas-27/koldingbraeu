-- Koldingbräu – Sude: Messwerte von Freitext auf Wert + Einheit umstellen (Entwurf, Stand 25.10.2026)
-- Setzt features/brews/schema.sql voraus. NICHT ausgeführt – bitte im Supabase SQL Editor prüfen und selbst anwenden
-- (DROP COLUMN und DELETE lassen sich laut Arbeitsstand per MCP nicht zuverlässig ausführen; hier wird daher
--  umbenannt statt gelöscht, damit nichts verloren geht).
--
-- Prinzip: Spaltennamen bleiben, wie sie sind – nur der Typ wechselt von text auf numeric/integer/date, genau wie
-- es in features/recipes/schema.sql für dieselben Begriffe (hauptguss, nachguss, kochzeit, stammwuerze, alkohol,
-- ausschlag) schon gemacht ist. Der bisherige Freitext wird vorher unter „<spalte>_alt“ gesichert, damit beim
-- Bearbeiten alter Sude nichts verloren geht (wie heute schon bei Malz/Hopfen: „vorher: …“-Hinweis).

begin;

-- 1) Alte Textspalten beiseiteschieben
alter table public.sude rename column hauptguss    to hauptguss_alt;
alter table public.sude rename column nachguss     to nachguss_alt;
alter table public.sude rename column kochzeit     to kochzeit_alt;
alter table public.sude rename column wuerze       to wuerze_alt;
alter table public.sude rename column stammwuerze  to stammwuerze_alt;
alter table public.sude rename column restextrakt  to restextrakt_alt;
alter table public.sude rename column ausschlag    to ausschlag_alt;
alter table public.sude rename column alkohol      to alkohol_alt;
alter table public.sude rename column abgefuellt   to abgefuellt_alt;
alter table public.sude rename column maischplan   to maischplan_alt;   -- jsonb, Array von Freitext-Zeilen

-- 2) Neue, typisierte Spalten – gleicher Name/Typ wie beim analogen Rezept-Feld
alter table public.sude add column hauptguss          numeric(6,2);         -- Liter
alter table public.sude add column nachguss            numeric(6,2);         -- Liter
alter table public.sude add column kochzeit             integer;              -- Minuten
alter table public.sude add column wuerze               numeric(6,2);         -- Liter (Würzemenge vorm Ausschlagen)
alter table public.sude add column stammwuerze    numeric(4,1);         -- °Plato
alter table public.sude add column restextrakt       numeric(4,1);         -- °Plato
alter table public.sude add column ausschlag            numeric(6,2);         -- Liter
alter table public.sude add column alkohol               numeric(4,1);         -- % vol
alter table public.sude add column abgefuellt         date;

-- Maischplan wie bei Rezepten: Einmaischen/Abmaischen als Temperatur, dazwischen Rasten als [{temperatur, zeit}]
alter table public.sude add column einmaischtemperatur numeric(4,1);     -- °C
alter table public.sude add column abmaischtemperatur  numeric(4,1);     -- °C
alter table public.sude add column rasten jsonb not null default '[]' check (jsonb_typeof(rasten) = 'array');

-- 3) Bestehende Werte bestmöglich in die neuen Spalten übernehmen (Komma als Dezimaltrennzeichen, erste Zahl im Text)
update public.sude set hauptguss   = nullif(regexp_replace((regexp_match(hauptguss_alt,   '(\d+(?:[.,]\d+)?)'))[1], ',', '.'), '')::numeric where hauptguss_alt   ~ '\d';
update public.sude set nachguss    = nullif(regexp_replace((regexp_match(nachguss_alt,    '(\d+(?:[.,]\d+)?)'))[1], ',', '.'), '')::numeric where nachguss_alt    ~ '\d';
update public.sude set kochzeit    = nullif((regexp_match(kochzeit_alt, '(\d+)'))[1], '')::integer                                          where kochzeit_alt    ~ '\d';
update public.sude set wuerze      = nullif(regexp_replace((regexp_match(wuerze_alt,      '(\d+(?:[.,]\d+)?)'))[1], ',', '.'), '')::numeric where wuerze_alt      ~ '\d';
update public.sude set stammwuerze = nullif(regexp_replace((regexp_match(stammwuerze_alt, '(\d+(?:[.,]\d+)?)'))[1], ',', '.'), '')::numeric where stammwuerze_alt ~ '\d';
update public.sude set restextrakt = nullif(regexp_replace((regexp_match(restextrakt_alt, '(\d+(?:[.,]\d+)?)'))[1], ',', '.'), '')::numeric where restextrakt_alt ~ '\d';
update public.sude set ausschlag   = nullif(regexp_replace((regexp_match(ausschlag_alt,   '(\d+(?:[.,]\d+)?)'))[1], ',', '.'), '')::numeric where ausschlag_alt   ~ '\d';
update public.sude set alkohol     = nullif(regexp_replace((regexp_match(alkohol_alt,     '(\d+(?:[.,]\d+)?)'))[1], ',', '.'), '')::numeric where alkohol_alt     ~ '\d';
-- Datum „12.3.2024“ o.ä. versuchen; alles andere bleibt leer und zeigt nur noch den alten Text als Hinweis
update public.sude set abgefuellt = to_date(abgefuellt_alt, 'DD.MM.YYYY') where abgefuellt_alt ~ '^\d{1,2}\.\d{1,2}\.\d{4}$';

-- Maischplan-Zeilen aufteilen: „Einmaischen 63 °C“ / „63 °C 30 Min.“ / „Abmaischen 78 °C“ (gleiche Logik wie
-- rezeptAusSud() in features/brews/brews.js – bei Gelegenheit abgleichen, falls sich das Freitext-Muster dort ändert)
do $$
declare r record; zeile text; temp numeric; zeit integer; neue_rasten jsonb;
begin
  for r in select id, maischplan_alt from public.sude where jsonb_array_length(coalesce(maischplan_alt,'[]')) > 0 loop
    neue_rasten := '[]'::jsonb;
    for zeile in select jsonb_array_elements_text(r.maischplan_alt) loop
      temp := nullif(regexp_replace((regexp_match(zeile, '(\d+(?:[.,]\d+)?)\s*°'))[1], ',', '.'), '')::numeric;
      zeit := nullif((regexp_match(zeile, '(\d+)\s*[Mm]in'))[1], '')::integer;
      if zeile ~* 'einmaisch' then
        update public.sude set einmaischtemperatur = temp where id = r.id;
      elsif zeile ~* 'abmaisch' then
        update public.sude set abmaischtemperatur = temp where id = r.id;
      elsif temp is not null then
        neue_rasten := neue_rasten || jsonb_build_object('temperatur', temp, 'zeit', zeit);
      end if;
    end loop;
    update public.sude set rasten = neue_rasten where id = r.id;
  end loop;
end $$;

-- 4) Rechte: Gäste sehen weiterhin dieselben (jetzt typisierten) Felder; die „_alt“-Hinweisspalten sind nur fürs
--    Bearbeiten durch Braumeister gedacht und werden Gästen nicht neu freigegeben.
grant select (hauptguss, nachguss, kochzeit, wuerze, stammwuerze, restextrakt, ausschlag, alkohol, abgefuellt,
  einmaischtemperatur, abmaischtemperatur, rasten) on public.sude to anon;

commit;

-- Danach prüfen (im SQL Editor):
--   select nr, hauptguss_alt, hauptguss, kochzeit_alt, kochzeit, maischplan_alt, rasten from public.sude order by nr;
-- Alte Sude, bei denen die Zahl nicht sauber erkannt wurde, zeigen im Editor weiterhin den „_alt“-Text als Hinweis
-- (wie bisher bei Hopfen) und können händisch nachgetragen werden. Sind alle 22 alten Sude geprüft, können die
-- neun „_alt“-Spalten und maischplan_alt irgendwann mit DROP COLUMN entfernt werden (das muss ohnehin manuell
-- im SQL Editor passieren, siehe Arbeitsstand).
