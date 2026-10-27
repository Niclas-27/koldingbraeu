// EINMALIGE Migration (27.10.2026): verschiebt bereits hochgeladene Teilnehmer-Galeriefotos aus dem
// öffentlichen Bucket "bilder" in den neuen privaten Bucket "verkostung-galerie".
//
// Aufruf (einmal, danach kann diese Funktion gelöscht werden – im Supabase-Dashboard oder mit
// `supabase functions delete einmalig-galerie-migrieren`):
//
//   curl -X POST "https://ysmnvtuxckiflvvfxxiy.supabase.co/functions/v1/einmalig-galerie-migrieren"
//
// Läuft mit verify_jwt=false (kein Login nötig), prüft aber nichts anderes – ist also nur so lange auf dem
// Server, bis sie manuell gelöscht wird. Sie berührt ausschließlich die Pfade aus `verkostung_bilder`.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

function geheimerSchluessel(): string {
  const neu = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (neu) { try { const k = JSON.parse(neu)["default"]; if (k) return k; } catch (_) { /* weiter mit Legacy */ } }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

Deno.serve(async (_req) => {
  const schluessel = geheimerSchluessel();
  const db = createClient(Deno.env.get("SUPABASE_URL")!, schluessel, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: rows, error: e0 } = await db.from("verkostung_bilder").select("id,pfad");
  if (e0) return new Response(JSON.stringify({ fehler: e0.message }), { status: 500 });

  const ergebnisse: Record<string, unknown>[] = [];
  for (const row of rows ?? []) {
    const pfade = [row.pfad, row.pfad.replace(/\.jpg$/, "_t.jpg")];
    const eintrag: Record<string, unknown> = { id: row.id, pfad: row.pfad };
    for (const p of pfade) {
      const dl = await db.storage.from("bilder").download(p);
      if (dl.error) { eintrag["fehler_" + p] = dl.error.message; continue; }
      const up = await db.storage.from("verkostung-galerie").upload(p, dl.data, { contentType: "image/jpeg", upsert: true });
      if (up.error) { eintrag["fehler_" + p] = up.error.message; continue; }
      const rm = await db.storage.from("bilder").remove([p]);
      eintrag["ok_" + p] = !rm.error;
    }
    ergebnisse.push(eintrag);
  }
  return new Response(JSON.stringify({ anzahl: ergebnisse.length, ergebnisse }), { headers: { "Content-Type": "application/json" } });
});
