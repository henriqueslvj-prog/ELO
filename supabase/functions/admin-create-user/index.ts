import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

// ---- Segurança comum (V0.22): CORS restrito, erros sem detalhes internos, sessão válida e limite de uso ----
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map((s) => s.trim()).filter(Boolean);
let CURRENT_ORIGIN = '*';
const setOrigin = (req: Request) => {
  const origin = req.headers.get('Origin') || '';
  CURRENT_ORIGIN = ALLOWED_ORIGINS.length ? (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]) : '*';
};
const corsHeaders = () => ({
  'Access-Control-Allow-Origin': CURRENT_ORIGIN,
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
});
const DEBUG_ERRORS = Deno.env.get('DEBUG_ERRORS') === 'true';
const json = (body: any, status = 200) => {
  if (status >= 500 && !DEBUG_ERRORS) {
    console.error('Erro interno:', body?.error);
    body = { error: 'Erro interno ao processar a solicitação. Tente novamente; se persistir, contate o administrador.' };
  }
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
};
// Bloqueia conta inativa e sessão sem 2FA concluído (quando o usuário tem 2FA) e aplica limite de uso por usuário.
const guardRequest = async (userClient: any, adminClient: any, userId: string, bucket: string, limit: number, windowSeconds: number): Promise<Response | null> => {
  try {
    const { data: ok, error } = await userClient.rpc('elo_session_ok');
    if (error) {
      // função ainda não criada no banco (migração pendente): não bloqueia; qualquer outro erro bloqueia
      if (!['PGRST202', '42883'].includes(String(error.code))) return json({ error: 'Não foi possível validar a sessão.' }, 503);
    } else if (ok !== true) {
      return json({ error: 'Acesso bloqueado: conta inativa ou verificação em duas etapas pendente.' }, 403);
    }
  } catch { return json({ error: 'Não foi possível validar a sessão.' }, 503); }
  if (adminClient) {
    try {
      const { data: allowed, error } = await adminClient.rpc('check_rate_limit', { p_user: userId, p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds });
      if (!error && allowed === false) return json({ error: 'Limite de uso atingido. Aguarde alguns minutos e tente novamente.' }, 429);
    } catch { /* sem limite se indisponível */ }
  }
  return null;
};

const ROLES = ['administrador', 'gestor', 'supervisor', 'colaborador'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COMMON = ['senha', 'password', '123456', 'qwerty', 'abcdef', 'admin', 'elo2026', 'mudar123', 'trocar123'];

// Política de senha (a mesma do app): 10+ caracteres, letras e números, sem sequências óbvias, sem o e-mail/nome.
const passwordProblem = (password: string, email: string, name: string): string | null => {
  if (password.length < 10) return 'A senha deve ter pelo menos 10 caracteres.';
  if (new TextEncoder().encode(password).length > 72) return 'A senha deve ter no máximo 72 caracteres.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'A senha deve combinar letras e números.';
  const low = password.toLowerCase();
  if (COMMON.some((c) => low.includes(c))) return 'A senha é muito comum. Escolha outra.';
  if (/(.)\1{3,}/.test(password)) return 'A senha não pode ter o mesmo caractere repetido várias vezes.';
  const local = email.split('@')[0];
  if (local.length >= 4 && low.includes(local.toLowerCase())) return 'A senha não pode conter o e-mail.';
  const first = name.split(/\s+/)[0]?.toLowerCase() || '';
  if (first.length >= 4 && low.includes(first)) return 'A senha não pode conter o nome do usuário.';
  return null;
};

Deno.serve(async (req) => {
  setOrigin(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  let secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  if (!secret) { try { secret = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')?.default || null; } catch { secret = null; } }
  const auth = req.headers.get('Authorization');
  if (!url || !anon || !secret) return json({ error: 'Configuração do servidor incompleta.' }, 500);
  if (!auth) return json({ error: 'Não autenticado.' }, 401);

  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  const requester = userData?.user;
  if (userError || !requester) return json({ error: 'Sessão inválida.' }, 401);

  const blocked = await guardRequest(userClient, admin, requester.id, 'admin-create-user', 20, 3600);
  if (blocked) return blocked;

  const { data: requesterProfile } = await admin.from('profiles').select('role,status,full_name').eq('id', requester.id).maybeSingle();
  if (!requesterProfile || requesterProfile.role !== 'administrador' || requesterProfile.status !== 'ativo') {
    return json({ error: 'Apenas administradores ativos podem criar usuários.' }, 403);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido.' }, 400); }
  const name = String(body?.name || '').trim().replace(/\s+/g, ' ');
  const email = String(body?.email || '').trim().toLowerCase();
  const role = String(body?.role || 'colaborador');
  const password = String(body?.password || '');

  if (name.length < 2 || name.length > 120) return json({ error: 'Informe o nome (de 2 a 120 caracteres).' }, 400);
  if (email.length > 254 || !EMAIL_RE.test(email)) return json({ error: 'Informe um e-mail válido.' }, 400);
  if (!ROLES.includes(role)) return json({ error: 'Perfil inválido.' }, 400);
  const problem = passwordProblem(password, email, name);
  if (problem) return json({ error: problem }, 400);

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error || !data?.user) {
    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) return json({ error: 'Já existe um usuário com este e-mail.' }, 409);
    console.error('Falha ao criar usuário no Auth:', error?.message);
    return json({ error: 'Não foi possível criar o usuário.' }, 500);
  }

  const { error: profileError } = await admin.from('profiles').upsert(
    { id: data.user.id, full_name: name, email, role, status: 'ativo' },
    { onConflict: 'id' },
  );
  if (profileError) {
    // não deixa conta "órfã" (sem perfil) caso o perfil não possa ser gravado
    await admin.auth.admin.deleteUser(data.user.id).catch(() => {});
    console.error('Falha ao gravar perfil:', profileError.message);
    return json({ error: 'Não foi possível concluir o cadastro do usuário.' }, 500);
  }

  // Trilha de auditoria (sem a senha)
  await admin.from('audit_log').insert({
    actor: requester.id, actor_name: requesterProfile.full_name || null,
    action: 'CREATE_USER', table_name: 'auth.users', record_id: data.user.id, new_data: { email, role, full_name: name },
  }).then(() => {}, () => {});

  return json({ ok: true, success: true, user_id: data.user.id });
});
