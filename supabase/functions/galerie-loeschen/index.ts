// Gäste können ihr zuletzt hochgeladenes Foto wieder entfernen (z. B. versehentlich falsches Foto).
// Bereitgestellt mit verify_jwt = false: Gäste haben kein Konto. Geprüft werden Code der Verkostung
// und der persönliche Schlüssel (token) des Gastes – genau wie bei galerie-hochladen.
// Erwartet JSON: { code, token }. Löscht genau EIN Foto: das zuletzt von diesem Gast hochgeladene.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return antwort(405, { fehler: "Nur POST erlaubt" });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch (_) { return antwort(400, { fehler: "Ungültige Anfrage" }); }
  const code = String(body.code ?? "").trim().toLowerCase();
  const token = String(body.token ?? "").trim();
  if (!code || !/^[0-9a-f-]{36}$/i.test(token)) return antwort(400, { fehler: "Bitte zuerst mit deinem Namen beitreten." });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, geheimerSchluessel(), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: v } = await db.from("verkostungen").select("id,status").eq("code", code).maybeSingle();
  if (!v) return antwort(404, { fehler: "Diese Verkostung gibt es nicht (mehr)." });
  if (v.status === "abgeschlossen") return antwort(403, { fehler: "Die Verkostung ist abgeschlossen – Fotos können jetzt nur noch die Braumeister entfernen." });
  const { data: t } = await db.from("teilnehmer").select("id").eq("verkostung_id", v.id).eq("token", token).maybeSingle();
  if (!t) return antwort(403, { fehler: "Bitte zuerst mit deinem Namen beitreten." });

  const { data: letztes } = await db.from("verkostung_bilder").select("id,pfad").eq("teilnehmer_id", t.id).order("angelegt", { ascending: false }).limit(1).maybeSingle();
  if (!letztes) return antwort(404, { fehler: "Du hast kein Foto hochgeladen." });

  const { error: delError } = await db.from("verkostung_bilder").delete().eq("id", letztes.id);
  if (delError) return antwort(500, { fehler: "Löschen fehlgeschlagen." });
  await db.storage.from(BUCKET).remove([letztes.pfad, letztes.pfad.replace(/\.jpg$/, "_t.jpg")]);
  return antwort(200, { ok: true });
});
