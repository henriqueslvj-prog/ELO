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
Deno.serve(async(req)=>{
 setOrigin(req);
 if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders()});
 if(req.method!=='POST') return json({error:'Método não permitido.'},405);
 const url=Deno.env.get('SUPABASE_URL'), anon=Deno.env.get('SUPABASE_ANON_KEY'), auth=req.headers.get('Authorization');
 let secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||Deno.env.get('SUPABASE_SECRET_KEY');
 if(!secret){const raw=Deno.env.get('SUPABASE_SECRET_KEYS');try{secret=JSON.parse(raw||'{}')?.default||null}catch{secret=null}}
 if(!url||!anon||!auth) return json({error:'Configuração de autenticação incompleta.'},500);
 const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
 const {data:userData,error:userError}=await userClient.auth.getUser();
 if(userError||!userData.user) return json({error:'Usuário não autenticado.'},401);
 {const guardAdmin=secret?createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}}):null;const blocked=await guardRequest(userClient,guardAdmin,userData.user.id,'delete-attendance',60,3600);if(blocked)return blocked}
 let attendanceId:string; try{attendanceId=(await req.json())?.attendance_id}catch{return json({error:'JSON inválido.'},400)}
 if(!attendanceId) return json({error:'attendance_id é obrigatório.'},400);
 const {data:attendance,error:attendanceError}=await userClient.from('destaque_atendimentos').select('id,cycle_id,employee_id,status,period_key').eq('id',attendanceId).is('evaluation_deleted_at',null).single();
 if(attendanceError||!attendance) return json({error:'Avaliação não encontrada.'},404);
 const {data:canDelete,error:permissionError}=await userClient.rpc('has_permission',{requested_module:'destaques',requested_action:'delete'});
 if(permissionError||!canDelete) return json({error:'Você não possui permissão para excluir avaliações.'},403);
 if(!secret) return json({error:'A chave segura do Supabase não está configurada na Edge Function.'},500);
 const admin=createClient(url,secret), now=new Date().toISOString();
 const {error:updateError}=await admin.from('destaque_atendimentos').update({evaluation_deleted_at:now,evaluation_deleted_by:userData.user.id,status:'revisado',analysis:null,analyzed_at:null,error_message:null,updated_at:now}).eq('id',attendance.id);
 if(updateError) return json({error:`Não foi possível excluir a avaliação: ${updateError.message}`},500);
 const {data:evaluation}=await admin.from('destaque_avaliacoes').select('id').eq('cycle_id',attendance.cycle_id).eq('employee_id',attendance.employee_id).maybeSingle();
 if(evaluation?.id){const {error:recalcError}=await admin.rpc('recalculate_destaque_evaluation',{p_evaluation_id:evaluation.id});if(recalcError)return json({error:`Avaliação excluída, mas a consolidação mensal não foi recalculada: ${recalcError.message}`},500)}
 return json({success:true,attendance_id:attendance.id,message:'Avaliação excluída. O PDF foi preservado e poderá ser enviado novamente para análise.'});
});
