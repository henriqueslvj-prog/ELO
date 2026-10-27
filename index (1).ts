import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 if(req.method!=='POST') return json({error:'Método não permitido.'},405);
 const url=Deno.env.get('SUPABASE_URL'), anon=Deno.env.get('SUPABASE_ANON_KEY'), auth=req.headers.get('Authorization');
 let secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||Deno.env.get('SUPABASE_SECRET_KEY');
 if(!secret){const raw=Deno.env.get('SUPABASE_SECRET_KEYS');try{secret=JSON.parse(raw||'{}')?.default||null}catch{secret=null}}
 if(!url||!anon||!auth) return json({error:'Configuração de autenticação incompleta.'},500);
 const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
 const {data:userData,error:userError}=await userClient.auth.getUser();
 if(userError||!userData.user) return json({error:'Usuário não autenticado.'},401);
 let attendanceId:string; try{attendanceId=(await req.json())?.attendance_id}catch{return json({error:'JSON inválido.'},400)}
 if(!attendanceId) return json({error:'attendance_id é obrigatório.'},400);
 const {data:attendance,error:attendanceError}=await userClient.from('destaque_atendimentos').select('id,cycle_id,employee_id,status,period_key').eq('id',attendanceId).is('evaluation_deleted_at',null).single();
 if(attendanceError||!attendance) return json({error:attendanceError?.message||'Avaliação não encontrada.'},404);
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
