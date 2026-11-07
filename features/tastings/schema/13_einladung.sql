-- Einladung zur Verkostung (07.11.2026) – Konzept: „Koldingbräu – Konzept: Verkostungs-Einladung & Foto-Zuschnitt“
--
-- TEIL A – nur hinzufügend, stört den Live-Stand nicht, kann vor dem Veröffentlichen laufen:
--   * verkostungen.uhrzeit (optional) und verkostungen.einladungstext (optional, max. 1000 Zeichen)
--   * vk_ankuendigung(id): öffentliche Ankündigung EINER Verkostung für die Ankündigungsseite
--     (verkostung.html?a=<id>) – ohne Code, ohne Teilnehmer; blinde Verkostungen nur mit Bier-Anzahl.
--     Abgeschlossene Verkostungen liefern nur {id, status}, die Seite leitet dann aufs Ergebnis weiter.
--   * vk_angekuendigt() zusätzlich mit uhrzeit (Einladungstext bewusst NICHT – nur auf der Ankündigungsseite).
--
-- TEIL B – ändert Verhalten, erst NACH dem Veröffentlichen des Frontends ausführen (siehe unten).

alter table public.verkostungen
  add column if not exists uhrzeit time,
  add column if not exists einladungstext text check (einladungstext is null or length(einladungstext) <= 1000);

create or replace function public.vk_ankuendigung(p_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare v public.verkostungen;
begin
  select * into v from public.verkostungen where id = p_id;
  if not found then raise exception 'Diese Verkostung gibt es nicht (mehr).' using errcode = 'P0002'; end if;
  if v.status = 'abgeschlossen' then return jsonb_build_object('id', v.id, 'status', v.status); end if;
  return jsonb_build_object(
    'id', v.id, 'titel', v.titel, 'datum', v.datum, 'uhrzeit', to_char(v.uhrzeit, 'HH24:MI'), 'ort', v.ort,
    'blind', v.blind, 'status', v.status, 'bild_titel', v.bild_titel, 'einladungstext', v.einladungstext,
    'anzahlProben', (select count(*) from public.proben p where p.verkostung_id = v.id),
    'proben', case when v.blind then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('nummer', p.nummer, 'name', b.name, 'brauerei', b.brauerei, 'eigen', b.eigen,
               'stil', s.name, 'alkohol', b.alkohol, 'bild_kronkorken', b.bild_kronkorken, 'bild_flasche', b.bild_flasche)
             order by p.nummer)
      from public.proben p join public.biere b on b.id = p.bier_id left join public.bierstile s on s.id = b.stil_id
      where p.verkostung_id = v.id), '[]'::jsonb) end);
end $function$;
grant execute on function public.vk_ankuendigung(uuid) to anon, authenticated;

create or replace function public.vk_angekuendigt()
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', v.id, 'titel', v.titel, 'datum', v.datum, 'uhrzeit', to_char(v.uhrzeit, 'HH24:MI'), 'ort', v.ort, 'blind', v.blind,
    'status', v.status, 'bild_titel', v.bild_titel,
    'teilnehmer', (select count(*) from public.teilnehmer t where t.verkostung_id = v.id),
    'anzahlProben', (select count(*) from public.proben p where p.verkostung_id = v.id),
    'proben', case when v.blind then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('nummer', p.nummer, 'name', b.name, 'brauerei', b.brauerei, 'eigen', b.eigen,
               'stil', s.name, 'alkohol', b.alkohol, 'bild_kronkorken', b.bild_kronkorken, 'bild_flasche', b.bild_flasche)
             order by p.nummer)
      from public.proben p join public.biere b on b.id = p.bier_id left join public.bierstile s on s.id = b.stil_id
      where p.verkostung_id = v.id), '[]'::jsonb) end
  ) order by v.datum asc, v.angelegt asc), '[]'::jsonb)
  from public.verkostungen v where v.status in ('vorbereitung', 'laeuft')
$function$;

-- TEIL B – erst nach dem Veröffentlichen ausführen: Mitmachen erst, wenn die Verkostung läuft.
-- (Vorher konnte man mit dem Code schon in der Vorbereitung beitreten und bewerten.)
--
-- create or replace function public.vk_beitreten(p_code text, p_name text)
--  returns jsonb language plpgsql security definer set search_path to ''
-- as $function$
-- declare v public.verkostungen; t public.teilnehmer; n text := trim(coalesce(p_name, ''));
-- begin
--   v := private.vk_finden(p_code);
--   if v.status = 'abgeschlossen' then raise exception 'Diese Verkostung ist schon abgeschlossen.' using errcode = 'P0001'; end if;
--   if v.status <> 'laeuft' then raise exception 'Mitmachen geht erst, wenn die Verkostung begonnen hat.' using errcode = 'P0001'; end if;
--   if length(n) < 1 or length(n) > 40 then raise exception 'Bitte einen Namen mit 1 bis 40 Zeichen eingeben.' using errcode = 'P0001'; end if;
--   if (select count(*) from public.teilnehmer where verkostung_id = v.id) >= 100 then
--     raise exception 'Diese Verkostung hat schon zu viele Teilnehmer.' using errcode = 'P0001'; end if;
--   insert into public.teilnehmer (verkostung_id, name) values (v.id, n) returning * into t;
--   return jsonb_build_object('id', t.id, 'token', t.token, 'name', t.name);
-- end $function$;
