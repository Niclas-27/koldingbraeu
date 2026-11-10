// Teilnehmer einer Verkostung sehen die Fotos vom Abend (seit 10.11.2026) – während der Verkostung in der
// Gästeansicht und danach unbegrenzt auf der Ergebnisseite. Öffentlich bleibt die Galerie unsichtbar.
// Bereitgestellt mit verify_jwt = false: Gäste haben kein Konto. Geprüft wird der persönliche Schlüssel (token)
// eines Teilnehmers genau dieser Verkostung – wie bei galerie-hochladen / galerie-loeschen.
// Erwartet JSON: { code, token } (Gästeansicht) oder { verkostung_id, tokens: [..] } (Ergebnisseite – der Browser
// schickt alle bei sich gespeicherten Gast-Schlüssel, max. 20; einer davon muss zu dieser Verkostung passen).
// Antwort: { code, token, name, fotos: [{ gross, klein, von, mein }] } – gross/klein sind signierte Links (1 Stunde).
// code + token geben wir zurück, damit die Seite den persönlichen „Mein Zugang“-Link anzeigen kann.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const antwort = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function geheimerSchluessel(): string {
  const neu = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (neu) {
    try { const k = JSON.parse(neu)["default"]; if (k) return k; } catch (_) { /* weiter mit Legacy */ }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}
const BUCKET = "verkostung-galerie";
const GUELTIG = 3600; // Sekunden
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kleinPfad = (p: string) => p.replace(/\.jpg$/, "_t.jpg");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return antwort(405, { fehler: "Nur POST erlaubt" });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch (_) { return antwort(400, { fehler: "Ungültige Anfrage" }); }
  const code = String(body.code ?? "").trim().toLowerCase();
  const vid = String(body.verkostung_id ?? "").trim();
  const roh = Array.isArray(body.tokens) ? body.tokens : [body.token];
  const tokens = roh.map((t) => String(t ?? "").trim()).filter((t) => UUID.test(t)).slice(0, 20);
  if (!tokens.length || (!code && !UUID.test(vid))) return antwort(403, { fehler: "Nur für Teilnehmer dieser Verkostung." });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, geheimerSchluessel(), { auth: { persistSession: false, autoRefreshToken: false } });
  const q = db.from("verkostungen").select("id,code");
  const { data: v } = await (code ? q.eq("code", code) : q.eq("id", vid)).maybeSingle();
  if (!v) return antwort(404, { fehler: "Diese Verkostung gibt es nicht (mehr)." });
  const { data: t } = await db.from("teilnehmer").select("id,name,token").eq("verkostung_id", v.id).in("token", tokens).limit(1).maybeSingle();
  if (!t) return antwort(403, { fehler: "Nur für Teilnehmer dieser Verkostung." });

  const { data: bilder, error } = await db.from("verkostung_bilder")
    .select("pfad,teilnehmer_id,hochgeladen_von,angelegt,teilnehmer(name)").eq("verkostung_id", v.id).order("angelegt");
  if (error) return antwort(500, { fehler: "Die Fotos konnten nicht geladen werden." });
  const liste = bilder ?? [];
  let urls: Record<string, string> = {};
  if (liste.length) {
    const { data: s } = await db.storage.from(BUCKET).createSignedUrls(liste.flatMap((b) => [b.pfad, kleinPfad(b.pfad)]), GUELTIG);
    (s ?? []).forEach((x) => { if (x.path && x.signedUrl) urls[x.path] = x.signedUrl; });
  }
  const fotos = liste.filter((b) => urls[b.pfad]).map((b) => ({
    gross: urls[b.pfad],
    klein: urls[kleinPfad(b.pfad)] ?? urls[b.pfad],
    // deno-lint-ignore no-explicit-any
    von: b.teilnehmer_id ? ((b as any).teilnehmer?.name ?? null) : b.hochgeladen_von ? "Braumeister" : null,
    mein: b.teilnehmer_id === t.id,
  }));
  return antwort(200, { code: v.code, token: t.token, name: t.name, fotos });
});
