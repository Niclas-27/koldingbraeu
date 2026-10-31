-- Markiert, ob der Alkoholgehalt eines Sudes gemessen oder nur aus Stammwürze/Restextrakt
-- abgeschätzt wurde (ohne Alkoholkorrektur, daher eher die Untergrenze). Bereits angewendet.

alter table public.sude add column if not exists alkohol_geschaetzt boolean not null default false;

grant select (alkohol_geschaetzt) on public.sude to anon;
