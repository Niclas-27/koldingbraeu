// Erzeugt für jedes Bier einer abgeschlossenen Verkostung eine kurze, launige Zusammenfassung der
// Gästekommentare (mit Namen, wo zuordenbar) über die Anthropic-API. Nur der Admin darf das auslösen,
// per Knopf in der Verwaltung (nicht automatisch). Braucht das Secret ANTHROPIC_API_KEY.
// Bereitgestellt mit verify_jwt = false; die Anmeldung wird unten selbst geprüft (wie bei „einladen“).
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return antwort(405, { fehler: "Nur POST erlaubt" });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return antwort(401, { fehler: "Nicht angemeldet" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, geheimerSchluessel(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: u, error: ue } = await admin.auth.getUser(token);
  if (ue || !u?.user) return antwort(401, { fehler: "Anmeldung ungültig. Bitte neu anmelden." });
  const { data: profil } = await admin.from("profile").select("rolle").eq("id", u.user.id).maybeSingle();
  if (profil?.rolle !== "admin") return antwort(403, { fehler: "Nur der Admin darf Zusammenfassungen erstellen." });

  let body: { verkostung_id?: string };
  try { body = await req.json(); } catch (_) { return antwort(400, { fehler: "Ungültige Anfrage" }); }
  const vId = String(body.verkostung_id ?? "");
  if (!/^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$/i.test(vId)) {
    return antwort(400, { fehler: "Ungültige Verkostung." });
  }

  const { data: v } = await admin.from("verkostungen").select("id,status").eq("id", vId).maybeSingle();
  if (!v) return antwort(404, { fehler: "Diese Verkostung gibt es nicht." });
  if (v.status !== "abgeschlossen") return antwort(409, { fehler: "Die Verkostung ist noch nicht abgeschlossen." });

  const { data: proben, error: pe } = await admin.from("proben")
    .select("id,nummer,biere(name)").eq("verkostung_id", vId).order("nummer");
  if (pe || !proben) return antwort(500, { fehler: "Biere konnten nicht geladen werden." });
  if (!proben.length) return antwort(200, { ok: true, anzahl: 0, hinweis: "Keine Biere in dieser Verkostung." });

  const { data: bewertungen, error: be } = await admin.from("bewertungen")
    .select("probe_id,kommentar,note,nochmal,teilnehmer:teilnehmer_id(name)")
    .in("probe_id", proben.map((p) => p.id)).eq("ausgeblendet", false).not("kommentar", "is", null);
  if (be) return antwort(500, { fehler: "Bewertungen konnten nicht geladen werden." });

  const proBier = new Map<string, { name: string; kommentar: string; note: number; nochmal: boolean | null }[]>();
  for (const b of bewertungen ?? []) {
    const liste = proBier.get(b.probe_id) ?? [];
    // deno-lint-ignore no-explicit-any
    const tn = (b as any).teilnehmer;
    liste.push({ name: tn?.name ?? "jemand", kommentar: String(b.kommentar), note: b.note, nochmal: b.nochmal });
    proBier.set(b.probe_id, liste);
  }

  const biereFuerKi = proben
    .filter((p) => proBier.has(p.id))
    // deno-lint-ignore no-explicit-any
    .map((p) => ({ id: p.id, name: (p as any).biere?.name ?? `Bier Nr. ${p.nummer}`, kommentare: proBier.get(p.id) }));
  if (!biereFuerKi.length) return antwort(200, { ok: true, anzahl: 0, hinweis: "Noch keine Kommentare vorhanden." });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return antwort(503, { fehler: "Kein ANTHROPIC_API_KEY als Secret hinterlegt (Edge Functions → Secrets)." });

  const prompt = "Du bekommst Bewertungskommentare einer privaten Hobby-Bierverkostung unter Freunden, je Bier mit " +
    "Namen der Gäste, ihrer Note (0-10) und ob sie es nochmal trinken würden. Schreib für JEDES Bier eine kurze, " +
    "launige Zusammenfassung auf Deutsch (2 bis 4 Sätze, locker und herzlich, wie unter Freunden – niemals gemein " +
    "oder bloßstellend), die möglichst konkret aufgreift, was auffällig war, und dabei Namen nennt, wenn ein Kommentar " +
    "klar zuordenbar ist. Erfinde nichts dazu, was nicht aus den Kommentaren oder Noten hervorgeht. " +
    "Antworte NUR mit einem JSON-Array ohne Codeblock und ohne weiteren Text, Format genau: " +
    '[{"id":"<id>","text":"<zusammenfassung>"}, ...] – ein Eintrag pro Bier.\n\n' +
    "Biere:\n" + JSON.stringify(biereFuerKi);

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 4000, thinking: { type: "disabled" }, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    console.error(`Anthropic-Aufruf fehlgeschlagen: Status ${r.status} – ${txt.slice(0, 500)}`);
    return antwort(502, { fehler: `KI-Aufruf fehlgeschlagen (${r.status}). ${txt.slice(0, 200)}` });
  }
  // deno-lint-ignore no-explicit-any
  const kiAntwort: any = await r.json();
  // deno-lint-ignore no-explicit-any
  const textBlock = (kiAntwort?.content ?? []).find((c: any) => c?.type === "text");
  const text = String(textBlock?.text ?? "");
  let ergebnisse: { id: string; text: string }[];
  try {
    const match = text.match(/\[[\s\S]*\]/);
    ergebnisse = JSON.parse(match ? match[0] : text);
  } catch (fehler) {
    console.error(`KI-Antwort konnte nicht geparst werden: fehler=${fehler}\nRohe Antwort (erste 1500 Zeichen): ${JSON.stringify(kiAntwort).slice(0, 1500)}`);
    return antwort(502, { fehler: "Die Antwort der KI konnte nicht gelesen werden." });
  }

  let gespeichert = 0;
  for (const e of ergebnisse) {
    if (!e?.id || !e?.text) continue;
    const { error } = await admin.from("proben")
      .update({ zusammenfassung: String(e.text).slice(0, 800) })
      .eq("id", e.id).eq("verkostung_id", vId);
    if (!error) gespeichert++;
  }
  return antwort(200, { ok: true, anzahl: gespeichert, gefunden: biereFuerKi.length });
});
