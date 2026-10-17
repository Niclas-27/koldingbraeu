// Lädt einen neuen Braumeister per E-Mail ein. Nur für Admins.
// Bereitgestellt mit verify_jwt = false; die Anmeldung wird unten selbst geprüft.
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

  const { data: p } = await admin.from("profile").select("rolle").eq("id", u.user.id).maybeSingle();
  if (p?.rolle !== "admin") return antwort(403, { fehler: "Nur der Admin darf einladen." });

  let body: { email?: string; name?: string; redirectTo?: string };
  try { body = await req.json(); } catch (_) { return antwort(400, { fehler: "Ungültige Anfrage" }); }
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim().slice(0, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return antwort(400, { fehler: "Bitte eine gültige E-Mail-Adresse angeben." });

  // Nur auf erlaubte Ziele zurückleiten
  const erlaubt = ["https://kolding.de", "https://www.kolding.de", "https://niclas-27.github.io", "http://localhost", "http://127.0.0.1"];
  const redirectTo = erlaubt.some((e) => String(body.redirectTo ?? "").startsWith(e)) ? body.redirectTo : undefined;

  const { error } = await admin.auth.admin.inviteUserByEmail(email, { data: { name }, redirectTo });
  if (error) {
    const m = error.message || "";
    if (/already been registered|already registered|exists/i.test(m)) return antwort(409, { fehler: "Diese Adresse hat schon ein Konto." });
    if (/not authorized/i.test(m)) return antwort(503, { fehler: "E-Mail-Versand ist noch nicht eingerichtet (eigener Mailserver fehlt)." });
    return antwort(400, { fehler: "Einladung fehlgeschlagen: " + m });
  }
  return antwort(200, { ok: true });
});
