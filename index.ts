import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Não autenticado.')

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const adminClient = createClient(supabaseUrl, serviceKey)

    const { data: { user: requester } } = await userClient.auth.getUser()
    if (!requester) throw new Error('Sessão inválida.')

    const { data: requesterProfile } = await adminClient
      .from('profiles').select('role,status').eq('id', requester.id).single()
    if (!requesterProfile || requesterProfile.role !== 'administrador' || requesterProfile.status !== 'ativo') {
      throw new Error('Apenas administradores ativos podem criar usuários.')
    }

    const body = await req.json()
    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const role = String(body.role || 'colaborador')
    const password = String(body.password || '')

    if (!name || !email || password.length < 8) throw new Error('Nome, e-mail e senha de pelo menos 8 caracteres são obrigatórios.')
    if (!['administrador','gestor','supervisor','colaborador'].includes(role)) throw new Error('Perfil inválido.')

    const { data, error } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: name },
    })
    if (error) throw error

    if (data.user) {
      const { error: profileError } = await adminClient.from('profiles').update({
        full_name: name, email, role, status: 'ativo', updated_at: new Date().toISOString()
      }).eq('id', data.user.id)
      if (profileError) throw profileError
    }

    return new Response(JSON.stringify({ ok: true, user_id: data.user?.id }), {
      headers: { ...cors, 'Content-Type': 'application/json' }, status: 200
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro interno.' }), {
      headers: { ...cors, 'Content-Type': 'application/json' }, status: 400
    })
  }
})
