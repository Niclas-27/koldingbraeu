// Gäste laden während einer Verkostung bis zu drei Fotos für die Galerie hoch.
// Bereitgestellt mit verify_jwt = false: Gäste haben kein Konto. Geprüft werden stattdessen der Code der Verkostung
// und der persönliche Schlüssel (token) des Gastes – genau wie bei den vk_*-Datenbankfunktionen.
// Erwartet multipart/form-data mit: code, token, gross (JPEG, max. 1,5 MB), klein (JPEG, max. 200 KB).
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
const MAX_BILDER = 3;
const istJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return antwort(405, { fehler: "Nur POST erlaubt" });

  let form: FormData;
  try { form = await req.formData(); } catch (_) { return antwort(400, { fehler: "Ungültige Anfrage" }); }
  const code = String(form.get("code") ?? "").trim().toLowerCase();
  const token = String(form.get("token") ?? "").trim();
  const gross = form.get("gross"), klein = form.get("klein");
  if (!code || !/^[0-9a-f-]{36}$/i.test(token)) return antwort(400, { fehler: "Bitte zuerst mit deinem Namen beitreten." });
  if (!(gross instanceof File) || !(klein instanceof File)) return antwort(400, { fehler: "Kein Bild erhalten." });
  if (gross.size > 1_500_000 || klein.size > 200_000) return antwort(413, { fehler: "Das Bild ist zu groß." });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, geheimerSchluessel(), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: v } = await db.from("verkostungen").select("id,status").eq("code", code).maybeSingle();
  if (!v) return antwort(404, { fehler: "Diese Verkostung gibt es nicht (mehr)." });
  if (v.status === "abgeschlossen") return antwort(403, { fehler: "Die Verkostung ist abgeschlossen – Fotos können jetzt nur noch die Braumeister hinzufügen." });
  const { data: t } = await db.from("teilnehmer").select("id").eq("verkostung_id", v.id).eq("token", token).maybeSingle();
  if (!t) return antwort(403, { fehler: "Bitte zuerst mit deinem Namen beitreten." });
  const { count } = await db.from("verkostung_bilder").select("id", { count: "exact", head: true }).eq("teilnehmer_id", t.id);
  if ((count ?? 0) >= MAX_BILDER) return antwort(409, { fehler: `Du hast schon ${MAX_BILDER} Fotos hochgeladen.` });

  const g = new Uint8Array(await gross.arrayBuffer()), k = new Uint8Array(await klein.arrayBuffer());
  if (!istJpeg(g) || !istJpeg(k)) return antwort(415, { fehler: "Bitte ein Foto (JPEG) verwenden." });

  const pfad = `verkostungen/${v.id}/galerie/${crypto.randomUUID()}.jpg`;
  const opt = { contentType: "image/jpeg", cacheControl: "31536000", upsert: false };
  const a = await db.storage.from("bilder").upload(pfad, g, opt);
  if (a.error) return antwort(500, { fehler: "Hochladen fehlgeschlagen." });
  const b = await db.storage.from("bilder").upload(pfad.replace(/\.jpg$/, "_t.jpg"), k, opt);
  if (b.error) { await db.storage.from("bilder").remove([pfad]); return antwort(500, { fehler: "Hochladen fehlgeschlagen." }); }
  const { error } = await db.from("verkostung_bilder").insert({ verkostung_id: v.id, pfad, teilnehmer_id: t.id, hochgeladen_von: null });
  if (error) { await db.storage.from("bilder").remove([pfad, pfad.replace(/\.jpg$/, "_t.jpg")]); return antwort(500, { fehler: "Speichern fehlgeschlagen." }); }
  return antwort(200, { ok: true, pfad });
});
