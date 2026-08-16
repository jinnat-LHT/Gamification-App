import { createClient } from "npm:@supabase/supabase-js@2";
const ORIGIN="https://jinnat-lht.github.io";
const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,"Content-Type":"application/json"}});
async function rolesFor(db:any,userId:string){const account=await db.from("user_accounts").select("account_type,status").eq("id",userId).maybeSingle();if(!account.data||account.data.account_type!=="ADMIN"||account.data.status!=="ACTIVE")return null;const roles=await db.from("role_assignments").select("scope_type,provider_organization_id,client_organization_id,program_id,batch_id").eq("user_id",userId).eq("role","ADMIN").is("revoked_at",null);return roles.data??[];}
async function scopeForBatch(db:any,roles:any[],batchId:string){const batch=await db.from("batches").select("id,program_id").eq("id",batchId).maybeSingle();if(!batch.data)return null;const program=await db.from("programs").select("id,client_organization_id").eq("id",batch.data.program_id).maybeSingle();if(!program.data)return null;const client=await db.from("client_organizations").select("id,provider_organization_id").eq("id",program.data.client_organization_id).maybeSingle();if(!client.data)return null;const allowed=roles.some((r:any)=>(r.scope_type==="PROVIDER"&&r.provider_organization_id===client.data.provider_organization_id)||(r.scope_type==="CLIENT_ORGANIZATION"&&r.client_organization_id===client.data.id)||(r.scope_type==="PROGRAM"&&r.program_id===program.data.id)||(r.scope_type==="BATCH"&&r.batch_id===batch.data.id));return allowed?{client:client.data}:null;}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers});if(req.method!=="POST")return reply({error:"Method not allowed"},405);
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,""),url=Deno.env.get("SUPABASE_URL")??"",anon=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY")??"",secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??Deno.env.get("SUPABASE_SECRET_KEY")??"";
  if(!token||!url||!anon||!secret)return reply({error:"Authentication or configuration missing"},401);
  const client=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false}}),user=(await client.auth.getUser(token)).data.user;if(!user)return reply({error:"Invalid session"},401);
  const db=createClient(url,secret,{auth:{persistSession:false}}),payload=await req.json().catch(()=>({})),batchId=String(payload.batch_id??""),roles=await rolesFor(db,user.id),scope=roles&&batchId?await scopeForBatch(db,roles,batchId):null;
  if(!scope)return reply({error:"Admin access to this batch is required"},403);
  const action=String(payload.action??"list");
  const enrollments=await db.from("batch_learners").select("id,learner_id,group_id,enrollment_status").eq("batch_id",batchId).eq("enrollment_status","ACTIVE");
  if(enrollments.error)return reply({error:"Could not load active learners"},500);
  const learnerIds=(enrollments.data??[]).map((x:any)=>x.learner_id),batchLearnerIds=(enrollments.data??[]).map((x:any)=>x.id),groupIds=[...new Set((enrollments.data??[]).map((x:any)=>x.group_id))];
  const [accounts,groups,transactions]=await Promise.all([
    learnerIds.length?db.from("user_accounts").select("id,display_name,email").in("id",learnerIds):Promise.resolve({data:[]}),
    groupIds.length?db.from("groups").select("id,name").in("id",groupIds):Promise.resolve({data:[]}),
    batchLearnerIds.length?db.from("xp_transactions").select("batch_learner_id,source_type,amount,reason,created_at").eq("batch_id",batchId).in("batch_learner_id",batchLearnerIds):Promise.resolve({data:[]})
  ]);
  if(accounts.error||groups.error||transactions.error)return reply({error:"Could not load XP data"},500);
  const accountMap=new Map((accounts.data??[]).map((x:any)=>[x.id,x])),groupMap=new Map((groups.data??[]).map((x:any)=>[x.id,x])),xpByLearner=new Map<string,number>(),rapidCount=new Map<string,number>();
  for(const tx of transactions.data??[]){xpByLearner.set(tx.batch_learner_id,(xpByLearner.get(tx.batch_learner_id)??0)+Number(tx.amount));if(tx.source_type==="RAPID_GROUP"&&Number(tx.amount)>0)rapidCount.set(tx.batch_learner_id,(rapidCount.get(tx.batch_learner_id)??0)+1);}
  const learners=(enrollments.data??[]).map((x:any)=>{const account=accountMap.get(x.learner_id)??{},group=groupMap.get(x.group_id)??{};return {id:x.id,name:account.display_name??account.email??"ไม่ระบุชื่อ",email:account.email??"",group_id:x.group_id,group_name:group.name??"",xp:xpByLearner.get(x.id)??0,rapid_awards:rapidCount.get(x.id)??0};}).sort((a:any,b:any)=>b.xp-a.xp||a.name.localeCompare(b.name,"th"));
  if(action==="list")return reply({groups:groups.data??[],learners});
  if(action==="rapid_group"){
    const groupId=String(payload.group_id??""),reason=String(payload.reason??"Rapid Group Score").trim().slice(0,250)||"Rapid Group Score";
    const eligible=learners.filter((x:any)=>x.group_id===groupId&&x.rapid_awards<5);
    if(!groupMap.has(groupId))return reply({error:"Selected group does not belong to this batch"},422);
    if(!eligible.length)return reply({error:"สมาชิกในกลุ่มได้รับ Rapid Group Score ครบ 5 ครั้งแล้ว"},422);
    const rows=eligible.map((x:any)=>({client_organization_id:scope.client.id,batch_id:batchId,batch_learner_id:x.id,source_type:"RAPID_GROUP",amount:1000,reason,idempotency_key:"rapid-group:"+batchId+":"+groupId+":"+x.id+":"+(x.rapid_awards+1),created_by:user.id}));
    const saved=await db.from("xp_transactions").insert(rows);if(saved.error)return reply({error:"Could not award Rapid Group Score"},500);
    await db.from("audit_events").insert({actor_user_id:user.id,client_organization_id:scope.client.id,batch_id:batchId,event_type:"RAPID_GROUP_SCORE_AWARDED",target_type:"GROUP",target_id:groupId,after_json:{recipients:eligible.length,xp_per_learner:1000},reason});
    return reply({saved:true,message:"ให้ Rapid Group Score สำเร็จ "+eligible.length+" คน",recipients:eligible.length});
  }
  if(action==="adjust"){
    const learnerId=String(payload.batch_learner_id??""),amount=Number(payload.amount),reason=String(payload.reason??"").trim().slice(0,250);
    if(!Number.isInteger(amount)||amount===0||Math.abs(amount)>10000)return reply({error:"จำนวน XP ต้องเป็นจำนวนเต็มระหว่าง -10,000 ถึง 10,000 และไม่ใช่ 0"},422);
    if(!reason)return reply({error:"กรุณาระบุเหตุผลในการปรับ XP"},422);
    if(!learners.some((x:any)=>x.id===learnerId))return reply({error:"Learner not found in active batch"},404);
    const saved=await db.from("xp_transactions").insert({client_organization_id:scope.client.id,batch_id:batchId,batch_learner_id:learnerId,source_type:"LIVE_ADJUSTMENT",amount,reason,idempotency_key:"live-adjustment:"+crypto.randomUUID(),created_by:user.id});
    if(saved.error)return reply({error:"Could not adjust XP"},500);
    await db.from("audit_events").insert({actor_user_id:user.id,client_organization_id:scope.client.id,batch_id:batchId,event_type:"LIVE_XP_ADJUSTED",target_type:"BATCH_LEARNER",target_id:learnerId,after_json:{amount},reason});
    return reply({saved:true,message:"ปรับ XP เรียบร้อยแล้ว"});
  }
  return reply({error:"Unsupported action"},400);
});