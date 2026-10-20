-- Ergänzung vom 20.10.2026: Lesbarer, aber weiterhin schwer erratbarer Beitritts-Code.
-- Bisher war der Code (Spalte verkostungen.code) rein zufällig, z. B. "k7m2p9qx4a" – schwer zu merken
-- und beim Teilen (z. B. per Chat) nicht erkennbar, zu welcher Verkostung er gehört.
-- Jetzt setzt sich der Code aus einem Kürzel des Titels und einem kürzeren Zufallsteil zusammen,
-- z. B. "craftbier-q7x2pmz4". Der Zufallsteil (8 Zeichen aus einem 31er-Alphabet, ~40 Bit) bleibt lang
-- genug, dass niemand eine Verkostung einfach durchprobieren kann – der Code ist weiterhin der
-- eigentliche Zugangsschlüssel zum Mitmachen, nicht nur Deko.
-- Der Titel-Teil wird nur beim Anlegen gesetzt; ein späteres Umbenennen der Verkostung ändert den
-- Code absichtlich nicht mehr (sonst würde ein schon verteilter QR-Code/Link ungültig).

-- Titel zu einem URL-freundlichen Kürzel machen (a-z0-9 und Bindestriche, max. 20 Zeichen beim Aufruf)
create or replace function private.slug(p_text text) returns text
language sql immutable set search_path = '' as $f$
  select coalesce(nullif(regexp_replace(regexp_replace(
           translate(lower(trim(coalesce(p_text, ''))), 'äöüß', 'aous'),
         '[^a-z0-9]+', '-', 'g'), '(^-+)|(-+$)', '', 'g'), ''), 'verkostung')
$f$;

create or replace function private.vk_code_setzen() returns trigger
language plpgsql security definer set search_path = '' as $f$
declare
  basis text := substr(private.slug(new.titel), 1, 20);
  kandidat text;
begin
  loop
    kandidat := basis || '-' || (
      select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + (get_byte(b, i) % 31), 1), '')
      from (select extensions.gen_random_bytes(8) as b) x, generate_series(0, 7) i
    );
    exit when not exists (select 1 from public.verkostungen where code = kandidat);
  end loop;
  new.code := kandidat;
  return new;
end $f$;

create trigger vk_code_setzen before insert on public.verkostungen
  for each row execute function private.vk_code_setzen();

revoke all on function private.slug(text), private.vk_code_setzen() from public, anon, authenticated;
