-- Ergänzung vom 25.10.2026: Die Fotogalerie "Fotos vom Brautag" war bisher für jeden sichtbar, sobald der
-- Sud "Öffentlich zeigen" war (wie die übrigen Sud-Werte). Auf Nutzerwunsch sollen die Fotos jetzt nur noch
-- Braumeister/Admin sehen können, unabhängig vom Öffentlich-Status des Suds. Gäste sehen stattdessen einen
-- Hinweis, sich anzumelden (Oberfläche: features/brews/brews.js).

alter policy "Galerie lesen" on public.sud_bilder to authenticated
  using (private.ist_braumeister());
revoke select on public.sud_bilder from anon;
