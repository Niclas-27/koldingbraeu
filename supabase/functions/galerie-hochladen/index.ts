// Gäste laden während einer Verkostung bis zu neun Fotos (bis 10.11.2026: drei) für die Galerie hoch.
// Bereitgestellt mit verify_jwt = false: Gäste haben kein Konto. Geprüft werden stattdessen der Code der Verkostung
// und der persönliche Schlüssel (token) des Gastes – genau wie bei den vk_*-Datenbankfunktionen.
// Erwartet multipart/form-data mit: code, token, gross (JPEG, max. 1,5 MB), klein (JPEG, max. 200 KB).
// Seit 07.11.2026 optional: ausschnitt (JSON {rahmen, quadrat}, Anteile 0…1) und basis (JPEG, max. 1,5 MB, das
// unbeschnittene Foto). Damit können Braumeister später „Ausschnitt ändern“ (Eintrag in bild_ausschnitte).
// Ohne basis, aber mit ausschnitt = ganzes Foto gewählt: dann ist das Großbild selbst das Basisbild.
// Seit 27.10.2026: landet im privaten Bucket "verkostung-galerie" (nicht mehr im öffentlichen "bilder") –
// nur Braumeister/Admin können die Fotos später sehen, siehe lib/bilder.js: galerieSignierteUrls().
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
const MAX_BILDER = 9; // bis 10.11.2026: 3
const istJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return antwort(405, { fehler: "Nur POST erlaubt" });

  let form: FormData;
  try { form = await req.formData(); } catch (_) { return antwort(400, { fehler: "Ungültige Anfrage" }); }
  const code = String(form.get("code") ?? "").trim().toLowerCase();
  const token = String(form.get("token") ?? "").trim();
  const gross = form.get("gross"), klein = form.get("klein"), basis = form.get("basis");
  let ausschnitt: { rahmen: Record<string, number>; quadrat: Record<string, number> | null } | null = null;
  try {
    const a = JSON.parse(String(form.get("ausschnitt") ?? "null"));
    const zahl = (o: unknown, k: string[]) => !!o && k.every((x) => typeof (o as Record<string, unknown>)[x] === "number" && (o as Record<string, number>)[x] >= -0.01 && (o as Record<string, number>)[x] <= 1.01);
    if (a && zahl(a.rahmen, ["x", "y", "w", "h"]) && (a.quadrat == null || zahl(a.quadrat, ["x", "y", "s"])))
      ausschnitt = { rahmen: { x: a.rahmen.x, y: a.rahmen.y, w: a.rahmen.w, h: a.rahmen.h }, quadrat: a.quadrat ? { x: a.quadrat.x, y: a.quadrat.y, s: a.quadrat.s } : null };
  } catch (_) { /* ohne Ausschnitt weiter */ }
  if (!code || !/^[0-9a-f-]{36}$/i.test(token)) return antwort(400, { fehler: "Bitte zuerst mit deinem Namen beitreten." });
  if (!(gross instanceof File) || !(klein instanceof File)) return antwort(400, { fehler: "Kein Bild erhalten." });
  if (gross.size > 1_500_000 || klein.size > 200_000 || (basis instanceof File && basis.size > 1_500_000)) return antwort(413, { fehler: "Das Bild ist zu groß." });

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
  const a = await db.storage.from(BUCKET).upload(pfad, g, opt);
  if (a.error) return antwort(500, { fehler: "Hochladen fehlgeschlagen." });
  const b = await db.storage.from(BUCKET).upload(pfad.replace(/\.jpg$/, "_t.jpg"), k, opt);
  if (b.error) { await db.storage.from(BUCKET).remove([pfad]); return antwort(500, { fehler: "Hochladen fehlgeschlagen." }); }
  const { error } = await db.from("verkostung_bilder").insert({ verkostung_id: v.id, pfad, teilnehmer_id: t.id, hochgeladen_von: null });
  if (error) { await db.storage.from(BUCKET).remove([pfad, pfad.replace(/\.jpg$/, "_t.jpg")]); return antwort(500, { fehler: "Speichern fehlgeschlagen." }); }

  // Best effort: ohne Eintrag gilt das Foto später als „Altbild“ (nachschneiden nur enger) – kein Grund zu scheitern.
  if (ausschnitt) {
    let basisPfad: string | null = pfad;
    if (basis instanceof File) {
      const bb = new Uint8Array(await basis.arrayBuffer());
      basisPfad = null;
      if (istJpeg(bb)) {
        const bp = pfad.replace(/\.jpg$/, "_b.jpg");
        if (!(await db.storage.from(BUCKET).upload(bp, bb, opt)).error) basisPfad = bp;
      }
    }
    if (basisPfad) await db.from("bild_ausschnitte").insert({ pfad, basis_pfad: basisPfad, rahmen: ausschnitt.rahmen, quadrat: ausschnitt.quadrat, angelegt_von: null });
  }
  return antwort(200, { ok: true, pfad });
});
