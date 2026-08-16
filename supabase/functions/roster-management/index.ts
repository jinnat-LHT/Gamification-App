import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGIN="https://jinnat-lht.github.io";
const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,"Content-Type":"application/json"}});

async function rolesFor(db:any,userId:string){
  const account=await db.from("user_accounts").select("account_type,status").eq("id",userId).maybeSingle();
  if(!account.data||account.data.account_type!=="ADMIN"||account.data.status!=="ACTIVE") return null;
  const roles=await db.from("role_assignments").select("scope_type,provider_organization_id,client_organization_id,program_id,batch_id").eq("user_id",userId).eq("role","ADMIN").is("revoked_at",null);
  return roles.data??[];
}
async function scopeForBatch(db:any,roles:any[],batchId:string){
  const batch=await db.from("batches").select("id,program_id").eq("id",batchId).maybeSingle();
  if(!batch.data) return null;
  const program=await db.from("programs").select("id,client_organization_id").eq("id",batch.data.program_id).maybeSingle();
  if(!program.data) return null;
  const client=await db.from("client_organizations").select("id,provider_organization_id").eq("id",program.data.client_organization_id).maybeSingle();
  if(!client.data) return null;
  const allowed=roles.some((r:any)=>
    (r.scope_type==="PROVIDER"&&r.provider_organization_id===client.data.provider_organization_id)||
    (r.scope_type==="CLIENT_ORGANIZATION"&&r.client_organization_id===client.data.id)||
    (r.scope_type==="PROGRAM"&&r.program_id===program.data.id)||
    (r.scope_type==="BATCH"&&r.batch_id===batch.data.id)
  );
  return allowed?{batch:batch.data,program:program.data,client:client.data}:null;
}
const statusAllowed=new Set(["INVITED","ACTIVE","COMPLETED","WITHDRAWN"]);

Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers});
  if(req.method!=="POST") return reply({error:"Method not allowed"},405);
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
  const url=Deno.env.get("SUPABASE_URL")??"";
  const anon=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY")??"";
  const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??Deno.env.get("SUPABASE_SECRET_KEY")??"";
  if(!token||!url||!anon||!secret) return reply({error:"Authentication or configuration missing"},401);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false}});
  const user=(await userClient.auth.getUser(token)).data.user;
  if(!user) return reply({error:"Invalid session"},401);
  const db=createClient(url,secret,{auth:{persistSession:false}});
  const payload=await req.json().catch(()=>({}));
  const action=String(payload.action??"list");
  const batchId=String(payload.batch_id??"");
  const roles=await rolesFor(db,user.id);
  const scope=roles&&batchId?await scopeForBatch(db,roles,batchId):null;
  if(!scope) return reply({error:"Administrator access to this batch is required"},403);

  if(action==="list"){
    const [enrollments,groups]=await Promise.all([
      db.from("batch_learners").select("id,learner_id,group_id,enrollment_status,enrolled_at,completed_at").eq("batch_id",batchId).order("enrolled_at"),
      db.from("groups").select("id,name,external_code").eq("batch_id",batchId).order("name")
    ]);
    if(enrollments.error||groups.error) return reply({error:"Could not load learner roster"},500);
    const ids=(enrollments.data??[]).map((row:any)=>row.learner_id);
    const accounts=ids.length?await db.from("user_accounts").select("id,email,display_name,status").in("id",ids):{data:[]};
    const profiles=ids.length?await db.from("learner_profiles").select("user_id,employee_code").in("user_id",ids):{data:[]};
    if(accounts.error||profiles.error) return reply({error:"Could not load learner details"},500);
    const accountMap=new Map((accounts.data??[]).map((row:any)=>[row.id,row]));
    const profileMap=new Map((profiles.data??[]).map((row:any)=>[row.user_id,row]));
    const groupMap=new Map((groups.data??[]).map((row:any)=>[row.id,row]));
    return reply({batch_id:batchId,groups:groups.data??[],learners:(enrollments.data??[]).map((row:any)=>{const account=accountMap.get(row.learner_id)??{},profile=profileMap.get(row.learner_id)??{},group=groupMap.get(row.group_id)??{};return {...row,email:account.email??"",display_name:account.display_name??account.email??"ไม่ระบุชื่อ",account_status:account.status??"",employee_code:profile.employee_code??"",group_name:group.name??""};})});
  }

  const enrollmentId=String(payload.batch_learner_id??"");
  const enrollment=await db.from("batch_learners").select("id,batch_id,group_id,enrollment_status,learner_id").eq("id",enrollmentId).eq("batch_id",batchId).maybeSingle();
  if(!enrollment.data) return reply({error:"Learner enrollment not found"},404);

  if(action==="update_group"){
    const groupId=String(payload.group_id??"");
    const group=await db.from("groups").select("id,name").eq("id",groupId).eq("batch_id",batchId).maybeSingle();
    if(!group.data) return reply({error:"Selected group does not belong to this batch"},422);
    const changed=await db.from("batch_learners").update({group_id:groupId}).eq("id",enrollmentId).select("id").maybeSingle();
    if(changed.error) return reply({error:"Could not update group"},500);
    await db.from("audit_events").insert({actor_user_id:user.id,client_organization_id:scope.client.id,batch_id:batchId,event_type:"LEARNER_GROUP_CHANGED",target_type:"BATCH_LEARNER",target_id:enrollmentId,before_json:{group_id:enrollment.data.group_id},after_json:{group_id:groupId,group_name:group.data.name},reason:"Updated from Admin roster"});
    return reply({updated:true,message:"ย้ายกลุ่มผู้เรียนเรียบร้อยแล้ว"});
  }
  if(action==="update_status"){
    const status=String(payload.enrollment_status??"").toUpperCase();
    if(!statusAllowed.has(status)) return reply({error:"Invalid enrollment status"},422);
    const update:any={enrollment_status:status};
    if(status==="COMPLETED") update.completed_at=new Date().toISOString();
    if(status!=="COMPLETED") update.completed_at=null;
    const changed=await db.from("batch_learners").update(update).eq("id",enrollmentId).select("id").maybeSingle();
    if(changed.error) return reply({error:"Could not update enrollment status"},500);
    await db.from("audit_events").insert({actor_user_id:user.id,client_organization_id:scope.client.id,batch_id:batchId,event_type:"LEARNER_ENROLLMENT_STATUS_CHANGED",target_type:"BATCH_LEARNER",target_id:enrollmentId,before_json:{enrollment_status:enrollment.data.enrollment_status},after_json:{enrollment_status:status},reason:"Updated from Admin roster"});
    return reply({updated:true,message:"อัปเดตสถานะผู้เรียนเรียบร้อยแล้ว"});
  }
  return reply({error:"Unsupported action"},400);
});