import {createClient} from '@supabase/supabase-js';
// Somente a chave PÚBLICA (anon) vai para o navegador. Nunca coloque a service_role/secret key em variáveis VITE_*.
const SUPABASE_URL=import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase=(SUPABASE_URL&&SUPABASE_ANON_KEY)?createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
