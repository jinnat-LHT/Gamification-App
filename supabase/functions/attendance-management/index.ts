import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGIN="https://jinnat-lht.github.io";
const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,"Content-Type":"application/json"}});
async function accessFor(db:any,userId:string){
  const account=await db.from("user_accounts").select("account_type,status").eq("id",userId).maybeSingle();
  if(!account.data||!["ADMIN","FACILITATOR"].includes(account.data.account_type)||account.data.status!=="ACTIVE") return null;
  const roles=await db.from("role_assignments").select("scope_type,provider_organization_id,client_organization_id,program_id,batch_id").eq("user_id",userId).eq("role",account.data.account_type).is("revoked_at",null);
  return {account:account.data,roles:roles.data??[]};
}
async function batchScope(db:any,roles:any[],batchId:string){
  const batch=await db.from("batches").select("id,program_id").eq("id",batchId).maybeSingle(); if(!batch.data)return null;
  const program=await db.from("programs").select("id,client_organization_id").eq("id",batch.data.program_id).maybeSingle(); if(!program.data)return null;
  const client=await db.from("client_organizations").select("id,provider_organization_id").eq("id",program.data.client_organization_id).maybeSingle(); if(!client.data)return null;
  const allowed=roles.some((r:any)=>(r.scope_type==="PROVIDER"&&r.provider_organization_id===client.data.provider_organization_id)||(r.scope_type==="CLIENT_ORGANIZATION"&&r.client_organization_id===client.data.id)||(r.scope_type==="PROGRAM"&&r.program_id===program.data.id)||(r.scope_type==="BATCH"&&r.batch_id===batch.data.id));
  return allowed?{client,batch}:null;
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers});
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,""),url=Deno.env.get("SUPABASE_URL")??"",anon=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY")??"",secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??Deno.env.get("SUPABASE_SECRET_KEY")??"";
  if(req.method!=="POST")return reply({error:"Method not allowed"},405);
  if(!token||!url||!anon||!secret)return reply({error:"Authentication or configuration missing"},401);
  const client=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false}}),user=(await client.auth.getUser(token)).data.user;
  if(!user)return reply({error:"Invalid session"},401);
  const db=createClient(url,secret,{auth:{persistSession:false}}),payload=await req.json().catch(()=>({})),batchId=String(payload.batch_id??""),access=await accessFor(db,user.id);
  const scope=access&&batchId?await batchScope(db,access.roles,batchId):null;
  if(!scope)return reply({error:"Admin or Facilitator access to this batch is required"},403);
  const action=String(payload.action??"list");
  if(action==="list"){
    const [enrollments,sessions]=await Promise.all([
      db.from("batch_learners").select("id,learner_id,group_id,enrollment_status").eq("batch_id",batchId).neq("enrollment_status","WITHDRAWN"),
      db.from("attendance_sessions").select("id,session_number,session_date").eq("batch_id",batchId).order("session_number")
    ]);
    if(enrollments.error||sessions.error)return reply({error:"Could not load attendance data"},500);
    const learnerIds=(enrollments.data??[]).map((r:any)=>r.learner_id),sessionIds=(sessions.data??[]).map((r:any)=>r.id),groupIds=[...new Set((enrollments.data??[]).map((r:any)=>r.group_id))];
    const [accounts,groups,records]=await Promise.all([
      learnerIds.length?db.from("user_accounts").select("id,display_name,email").in("id",learnerIds):Promise.resolve({data:[]}),
      groupIds.length?db.from("groups").select("id,name").in("id",groupIds):Promise.resolve({data:[]}),
      sessionIds.length?db.from("attendance_records").select("session_id,batch_learner_id,status").in("session_id",sessionIds):Promise.resolve({data:[]})
    ]);
    if(accounts.error||groups.error||records.error)return reply({error:"Could not load attendance records"},500);
    const accountMap=new Map((accounts.data??[]).map((r:any)=>[r.id,r])),groupMap=new Map((groups.data??[]).map((r:any)=>[r.id,r]));
    return reply({sessions:sessions.data??[],learners:(enrollments.data??[]).map((r:any)=>{const a=accountMap.get(r.learner_id)??{},g=groupMap.get(r.group_id)??{};return {id:r.id,name:a.display_name??a.email??"ไม่ระบุชื่อ",email:a.email??"",group_name:g.name??"",status:r.enrollment_status};}),records:records.data??[]});
  }
  if(action!=="save")return reply({error:"Unsupported action"},400);
  const sessionNumber=Number(payload.session_number),sessionDate=payload.session_date?String(payload.session_date):null;
  if(!Number.isInteger(sessionNumber)||sessionNumber<1||sessionNumber>5)return reply({error:"Session number must be 1-5"},422);
  const present=new Set((Array.isArray(payload.present_ids)?payload.present_ids:[]).map(String)),excused=new Set((Array.isArray(payload.excused_ids)?payload.excused_ids:[]).map(String));
  for(const id of present)if(excused.has(id))return reply({error:"A learner cannot be present and excused at the same time"},422);
  const enrollments=await db.from("batch_learners").select("id").eq("batch_id",batchId).neq("enrollment_status","WITHDRAWN");
  if(enrollments.error)return reply({error:"Could not load learners"},500);
  const validIds=new Set((enrollments.data??[]).map((r:any)=>r.id));
  if([...present,...excused].some(id=>!validIds.has(id)))return reply({error:"Invalid learner in attendance list"},422);
  const sessionUpsert=await db.from("attendance_sessions").upsert({batch_id:batchId,session_number:sessionNumber,session_date:sessionDate},{onConflict:"batch_id,session_number"}).select("id,session_number,session_date").single();
  if(sessionUpsert.error||!sessionUpsert.data)return reply({error:"Could not save session"},500);
  const sessionId=sessionUpsert.data.id;
  const oldRecords=await db.from("attendance_records").select("batch_learner_id,status").eq("session_id",sessionId);
  if(oldRecords.error)return reply({error:"Could not load previous attendance"},500);
  const oldMap=new Map((oldRecords.data??[]).map((r:any)=>[r.batch_learner_id,r.status]));
  const upserts=(enrollments.data??[]).map((r:any)=>({session_id:sessionId,batch_learner_id:r.id,status:present.has(r.id)?"PRESENT":excused.has(r.id)?"EXCUSED":"ABSENT",recorded_by:user.id,recorded_at:new Date().toISOString()}));
  const saved=await db.from("attendance_records").upsert(upserts,{onConflict:"session_id,batch_learner_id"});
  if(saved.error)return reply({error:"Could not save attendance"},500);
  const transactions:any[]=[];
  for(const row of enrollments.data??[]){
    const before=oldMap.get(row.id),after=present.has(row.id)?"PRESENT":excused.has(row.id)?"EXCUSED":"ABSENT";
    if(before===after)continue;
    if(after==="PRESENT")transactions.push({client_organization_id:scope.client.id,batch_id:batchId,batch_learner_id:row.id,source_type:"ATTENDANCE",source_id:sessionId,amount:2000,reason:"Attendance: session "+sessionNumber,idempotency_key:"attendance:"+sessionId+":"+row.id+":"+crypto.randomUUID(),created_by:user.id});
    if(before==="PRESENT"&&after!=="PRESENT")transactions.push({client_organization_id:scope.client.id,batch_id:batchId,batch_learner_id:row.id,source_type:"ATTENDANCE",source_id:sessionId,amount:-2000,reason:"Attendance correction: session "+sessionNumber,idempotency_key:"attendance-correction:"+sessionId+":"+row.id+":"+crypto.randomUUID(),created_by:user.id});
  }
  if(transactions.length){const xp=await db.from("xp_transactions").insert(transactions);if(xp.error)return reply({error:"Attendance saved but XP update failed"},500);}
  await db.from("audit_events").insert({actor_user_id:user.id,client_organization_id:scope.client.id,batch_id:batchId,event_type:"ATTENDANCE_RECORDED",target_type:"ATTENDANCE_SESSION",target_id:sessionId,after_json:{session_number:sessionNumber,present_count:present.size,excused_count:excused.size},reason:"Recorded from attendance screen"});
  return reply({saved:true,message:"บันทึกการเข้าเรียนเรียบร้อยแล้ว",session:sessionUpsert.data,present_count:present.size,excused_count:excused.size});
});