-- Ergänzung vom 18.10.2026: Der Admin darf einzelne Teilnehmer einer Verkostung wieder entfernen
-- (z. B. Karteileichen oder versehentlich doppelt angelegte). Löscht per Kaskade auch deren
-- Bewertungen und Vorschläge; von ihnen hochgeladene Fotos bleiben erhalten, verlieren aber den Bezug.

create function public.vk_admin_teilnehmer_loeschen(p_teilnehmer uuid) returns void
language plpgsql volatile security definer set search_path = '' as $f$
begin
  if not private.ist_admin() then raise exception 'Das darf nur der Admin.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.teilnehmer where id = p_teilnehmer) then
    raise exception 'Diesen Teilnehmer gibt es nicht (mehr).' using errcode = 'P0002'; end if;
  delete from public.teilnehmer where id = p_teilnehmer;
end $f$;

revoke execute on function public.vk_admin_teilnehmer_loeschen(uuid) from public, anon;
grant execute on function public.vk_admin_teilnehmer_loeschen(uuid) to authenticated;
