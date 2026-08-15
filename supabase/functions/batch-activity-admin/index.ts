import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGIN="https://jinnat-lht.github.io";
const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,"Content-Type":"application/json"}});

async function adminContext(db:any,userId:string){
  const account=await db.from("user_accounts").select("id,account_type,status").eq("id",userId).maybeSingle();
  if(account.error||!account.data||account.data.account_type!=="ADMIN"||account.data.status!=="ACTIVE")return null;
  const roles=await db.from("role_assignments").select("scope_type,provider_organization_id,client_organization_id,program_id,batch_id").eq("user_id",userId).eq("role","ADMIN").is("revoked_at",null);
  return roles.data??[];
}
async function canManageBatch(db:any,roles:any[],batchId:string){
  const b=await db.from("batches").select("id,program_id").eq("id",batchId).maybeSingle();if(!b.data)return false;
  const p=await db.from("programs").select("id,client_organization_id").eq("id",b.data.program_id).maybeSingle();if(!p.data)return false;
  const c=await db.from("client_organizations").select("id,provider_organization_id").eq("id",p.data.client_organization_id).maybeSingle();if(!c.data)return false;
  return roles.some(r=>(r.scope_type==="PROVIDER"&&r.provider_organization_id===c.data.provider_organization_id)||(r.scope_type==="CLIENT_ORGANIZATION"&&r.client_organization_id===c.data.id)||(r.scope_type==="PROGRAM"&&r.program_id===p.data.id)||(r.scope_type==="BATCH"&&r.batch_id===b.data.id));
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers});
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,""),url=Deno.env.get("SUPABASE_URL")??"",anon=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY")??"",secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??Deno.env.get("SUPABASE_SECRET_KEY")??"";
  if(!token||!url||!anon||!secret)return out({error:"Authentication or configuration missing"},401);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
  const {data:{user}}=await userClient.auth.getUser(token);if(!user)return out({error:"Invalid session"},401);
  const db=createClient(url,secret,{auth:{persistSession:false}}),roles=await adminContext(db,user.id);if(!roles)return out({error:"Administrator access required"},403);
  const payload=await req.json().catch(()=>({})),action=String(payload.action??"list"),batchId=String(payload.batch_id??"");
  if(!batchId||!(await canManageBatch(db,roles,batchId)))return out({error:"You do not have access to this batch"},403);
  if(action==="list"){
    const r=await db.from("batch_activity_configs").select("id,activity_type,activity_key,enabled,gate_state,due_at,config_json").eq("batch_id",batchId).order("activity_type");
    if(r.error)return out({error:"Could not load activity configuration"},500);return out({items:r.data??[]});
  }
  if(action==="update"){
    const id=String(payload.activity_config_id??""),enabled=Boolean(payload.enabled),gate=String(payload.gate_state??"");
    if(!id||!["OPEN","LOCKED"].includes(gate))return out({error:"Invalid activity update"},422);
    const own=await db.from("batch_activity_configs").select("id").eq("id",id).eq("batch_id",batchId).maybeSingle();if(!own.data)return out({error:"Activity not found"},404);
    const updated=await db.from("batch_activity_configs").update({enabled,gate_state:gate}).eq("id",id).select("id,enabled,gate_state").single();
    if(updated.error)return out({error:"Could not save activity configuration"},500);
    await db.from("audit_events").insert({actor_user_id:user.id,batch_id:batchId,event_type:"BATCH_ACTIVITY_CONFIG_UPDATED",target_type:"batch_activity_config",target_id:id,after_json:{enabled,gate_state:gate}});
    return out({item:updated.data});
  }
  return out({error:"Unsupported action"},400);
});