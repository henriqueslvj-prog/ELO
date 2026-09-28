import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  try{
    const authHeader=req.headers.get('Authorization')||'';
    const anon=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authHeader}}});
    const {data:{user:caller}}=await anon.auth.getUser();
    if(!caller) return new Response(JSON.stringify({error:'Não autenticado'}),{status:401,headers:{...cors,'Content-Type':'application/json'}});
    const {data:profile}=await anon.from('profiles').select('role,status').eq('id',caller.id).single();
    if(profile?.role!=='administrador'||profile?.status!=='ativo') return new Response(JSON.stringify({error:'Apenas administradores podem criar usuários'}),{status:403,headers:{...cors,'Content-Type':'application/json'}});
    const body=await req.json();
    const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const tempPassword=crypto.randomUUID().replaceAll('-','').slice(0,12)+'A!';
    const {data,error}=await admin.auth.admin.createUser({email:body.email,email_confirm:true,password:tempPassword,user_metadata:{full_name:body.name}});
    if(error) throw error;
    await admin.from('profiles').update({full_name:body.name,role:body.role||'colaborador',status:'ativo'}).eq('id',data.user.id);
    return new Response(JSON.stringify({ok:true,user_id:data.user.id,temporary_password:tempPassword}),{headers:{...cors,'Content-Type':'application/json'}});
  }catch(e){return new Response(JSON.stringify({error:e.message||'Erro interno'}),{status:500,headers:{...cors,'Content-Type':'application/json'}})}
});
