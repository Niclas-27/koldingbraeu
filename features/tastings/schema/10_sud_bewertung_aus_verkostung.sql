-- Verkostungsbewertungen wirken sich auf die Sud-Bewertung aus (Stand 31.10.2026):
-- Sobald für ein mit einem Sud verknüpftes Bier (biere.sud_id) mindestens eine Bewertung aus einer
-- abgeschlossenen Verkostung vorliegt, wird der Durchschnitt davon automatisch die Bewertung des
-- Suds (sude.bewertung) – ohne Markierung, wie mit dem Nutzer abgestimmt. Liegt (noch) keine
-- abgeschlossene Verkostung mit Bewertungen vor, bleibt die bisherige (manuell eingetragene oder
-- zuletzt übernommene) Bewertung unverändert; sie wird also nicht auf leer zurückgesetzt, wenn z. B.
-- eine Verkostung wieder geöffnet wird.

-- Berechnet den Schnitt aus allen (nicht ausgeblendeten) Bewertungen abgeschlossener Verkostungen
-- für die Biere eines Suds und übernimmt ihn, wenn vorhanden, in sude.bewertung.
create function private.sud_bewertung_aktualisieren(p_sud_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $f$
declare v_schnitt numeric;
begin
  if p_sud_id is null then return; end if;
  select round(avg(w.note)::numeric, 1) into v_schnitt
  from public.bewertungen w
  join public.proben p on p.id = w.probe_id
  join public.verkostungen v on v.id = p.verkostung_id and v.status = 'abgeschlossen'
  join public.biere b on b.id = p.bier_id
  where b.sud_id = p_sud_id and not w.ausgeblendet;
  if v_schnitt is not null then
    update public.sude set bewertung = v_schnitt where id = p_sud_id;
  end if;
end $f$;

-- Nach jeder Änderung an einer Bewertung (neu, geändert, gelöscht/ausgeblendet oder per Kaskade
-- gelöscht): den betroffenen Sud (über Probe → Bier) neu berechnen.
create function private.trg_bewertungen_sud_aktualisieren() returns trigger
language plpgsql volatile security definer set search_path = '' as $f$
declare s_alt uuid; s_neu uuid;
begin
  if tg_op in ('UPDATE','DELETE') then
    select b.sud_id into s_alt from public.proben p join public.biere b on b.id = p.bier_id where p.id = old.probe_id;
  end if;
  if tg_op in ('INSERT','UPDATE') then
    select b.sud_id into s_neu from public.proben p join public.biere b on b.id = p.bier_id where p.id = new.probe_id;
  end if;
  if s_alt is not null then perform private.sud_bewertung_aktualisieren(s_alt); end if;
  if s_neu is not null and s_neu is distinct from s_alt then perform private.sud_bewertung_aktualisieren(s_neu); end if;
  return coalesce(new, old);
end $f$;

create trigger bewertungen_sud_aktualisieren
after insert or update or delete on public.bewertungen
for each row execute function private.trg_bewertungen_sud_aktualisieren();

-- Nach einem Statuswechsel einer Verkostung (insbesondere beim Abschließen oder Wieder-Öffnen):
-- alle Sude neu berechnen, deren Biere in dieser Verkostung dabei waren.
create function private.trg_verkostung_sud_aktualisieren() returns trigger
language plpgsql volatile security definer set search_path = '' as $f$
declare r record;
begin
  if new.status is distinct from old.status then
    for r in select distinct b.sud_id from public.proben p join public.biere b on b.id = p.bier_id
             where p.verkostung_id = new.id and b.sud_id is not null
    loop
      perform private.sud_bewertung_aktualisieren(r.sud_id);
    end loop;
  end if;
  return new;
end $f$;

create trigger verkostung_sud_aktualisieren
after update on public.verkostungen
for each row execute function private.trg_verkostung_sud_aktualisieren();

-- Nach Ändern der Sud-Zuordnung eines Biers (z. B. nachträglich verknüpft oder umgehängt):
-- sowohl den alten als auch den neuen Sud neu berechnen.
create function private.trg_biere_sud_aktualisieren() returns trigger
language plpgsql volatile security definer set search_path = '' as $f$
begin
  if tg_op = 'UPDATE' and old.sud_id is distinct from new.sud_id and old.sud_id is not null then
    perform private.sud_bewertung_aktualisieren(old.sud_id);
  end if;
  if new.sud_id is not null then perform private.sud_bewertung_aktualisieren(new.sud_id); end if;
  return new;
end $f$;

create trigger biere_sud_aktualisieren
after update on public.biere
for each row execute function private.trg_biere_sud_aktualisieren();

revoke execute on function private.sud_bewertung_aktualisieren(uuid),
  private.trg_bewertungen_sud_aktualisieren(), private.trg_verkostung_sud_aktualisieren(),
  private.trg_biere_sud_aktualisieren() from public, anon, authenticated;
