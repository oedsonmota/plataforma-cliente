// Edge function: cria e gerencia o acesso dos clientes.
// Só o admin (Edson) pode chamar. Usa a service role, que nunca vai para o navegador.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    let service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
    if (!service) {
      try { const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}"); service = keys.default ?? Object.values(keys)[0] ?? ""; } catch (_) { /* sem chave */ }
    }
    if (!service) return json({ error: "Chave secreta do Supabase não encontrada na função." }, 500);
    const admin = createClient(url, service, { auth: { persistSession: false } });

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: who } = await admin.auth.getUser(token);
    if (!who?.user) return json({ error: "Sua sessão expirou. Entre de novo." }, 401);
    const { data: prof } = await admin.from("profiles").select("role").eq("id", who.user.id).single();
    if (prof?.role !== "admin") return json({ error: "Só o admin pode fazer isso." }, 403);

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (body.action === "create") {
      if (!email || password.length < 8) return json({ error: "Informe e-mail e uma senha com pelo menos 8 caracteres." }, 400);
      let userId: string | null = null;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) {
        // e-mail já existe: reaproveita o usuário e troca a senha
        for (let page = 1; page <= 10 && !userId; page++) {
          const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
          const found = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
          if (found) userId = found.id;
          if (!list || list.users.length < 200) break;
        }
        if (!userId) return json({ error: error.message }, 400);
        const { error: upErr } = await admin.auth.admin.updateUserById(userId, { password });
        if (upErr) return json({ error: upErr.message }, 400);
      } else {
        userId = data.user.id;
      }
      const { error: pErr } = await admin.from("projects")
        .update({ client_user_id: userId, client_email: email }).eq("id", body.project_id);
      if (pErr) return json({ error: pErr.message }, 400);
      return json({ ok: true, user_id: userId });
    }

    if (body.action === "reset") {
      const { data: p } = await admin.from("projects").select("client_user_id").eq("id", body.project_id).single();
      if (!p?.client_user_id) return json({ error: "Este cliente ainda não tem acesso criado." }, 400);
      if (password.length < 8) return json({ error: "A senha precisa de pelo menos 8 caracteres." }, 400);
      const { error } = await admin.auth.admin.updateUserById(p.client_user_id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (body.action === "remove") {
      const { data: p } = await admin.from("projects").select("client_user_id").eq("id", body.project_id).single();
      await admin.from("projects").delete().eq("id", body.project_id);
      if (p?.client_user_id && p.client_user_id !== who.user.id) {
        const { count } = await admin.from("projects").select("id", { count: "exact", head: true }).eq("client_user_id", p.client_user_id);
        if (!count) await admin.auth.admin.deleteUser(p.client_user_id);
      }
      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
