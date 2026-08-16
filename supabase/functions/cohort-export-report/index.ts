import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGIN="https://jinnat-lht.github.io";
const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,"Content-Type":"application/json"}});

async function rolesFor(db:any,userId:string){
  const account=await db.from("user_accounts").select("account_type,status").eq("id",userId).maybeSingle();
  if(!account.data||account.data.account_type!=="ADMIN"||account.data.status!=="ACTIVE") return null;
  const roles=await db.from("role_assignments").select("scope_type,provider_organization_id,client_organization_id,program_id,batch_id").eq("user_id",userId).eq("role","ADMIN").is("revoked_at",null);
  return roles.data??[];
}
async function canManage(db:any,roles:any[],batchId:string){
  const batch=await db.from("batches").select("id,program_id").eq("id",batchId).maybeSingle();
  if(!batch.data) return false;
  const program=await db.from("programs").select("id,client_organization_id").eq("id",batch.data.program_id).maybeSingle();
  if(!program.data) return false;
  const client=await db.from("client_organizations").select("id,provider_organization_id").eq("id",program.data.client_organization_id).maybeSingle();
  if(!client.data) return false;
  return roles.some((r:any)=>
    (r.scope_type==="PROVIDER"&&r.provider_organization_id===client.data.provider_organization_id)||
    (r.scope_type==="CLIENT_ORGANIZATION"&&r.client_organization_id===client.data.id)||
    (r.scope_type==="PROGRAM"&&r.program_id===program.data.id)||
    (r.scope_type==="BATCH"&&r.batch_id===batch.data.id)
  );
}
const latest=(attempts:any[])=>[...(attempts??[])].sort((a,b)=>String(b.submitted_at??"").localeCompare(String(a.submitted_at??""))||Number(b.attempt_number)-Number(a.attempt_number))[0];
const avg=(values:number[])=>values.length?Number((values.reduce((sum,value)=>sum+value,0)/values.length).toFixed(2)):null;
const rounded=(value:number|null)=>value==null?null:Number(value.toFixed(2));

Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers});
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
  const url=Deno.env.get("SUPABASE_URL")??"";
  const anon=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY")??"";
  const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??Deno.env.get("SUPABASE_SECRET_KEY")??"";
  if(!token||!url||!anon||!secret) return out({error:"Authentication or configuration missing"},401);
  const client=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false}});
  const user=(await client.auth.getUser(token)).data.user;
  if(!user) return out({error:"Invalid session"},401);
  const db=createClient(url,secret,{auth:{persistSession:false}});
  const payload=await req.json().catch(()=>({}));
  const batchId=String(payload.batch_id??"");
  const roles=await rolesFor(db,user.id);
  if(!roles||!batchId||!(await canManage(db,roles,batchId))) return out({error:"Administrator access to this batch is required"},403);

  const [batchResult,learnersResult,configsResult,sessionsResult]=await Promise.all([
    db.from("batches").select("id,name,external_code,start_date,end_date,status").eq("id",batchId).maybeSingle(),
    db.from("batch_learners").select("id,learner_id,group_id,enrollment_status").eq("batch_id",batchId).order("enrolled_at"),
    db.from("batch_activity_configs").select("id,activity_type,activity_key,enabled,gate_state,config_json").eq("batch_id",batchId),
    db.from("attendance_sessions").select("id,session_number,session_date").eq("batch_id",batchId).order("session_number")
  ]);
  if(!batchResult.data) return out({error:"Batch not found"},404);
  if(learnersResult.error||configsResult.error||sessionsResult.error) return out({error:"Could not load batch report data"},500);
  const learners=learnersResult.data??[];
  const learnerIds=learners.map((row:any)=>row.learner_id);
  const batchLearnerIds=learners.map((row:any)=>row.id);
  const groupIds=[...new Set(learners.map((row:any)=>row.group_id).filter(Boolean))];
  const sessionIds=(sessionsResult.data??[]).map((row:any)=>row.id);
  const [accountsResult,groupsResult,submissionsResult,attendanceResult,xpResult]=await Promise.all([
    learnerIds.length?db.from("user_accounts").select("id,email,display_name").in("id",learnerIds):Promise.resolve({data:[]}),
    groupIds.length?db.from("groups").select("id,name,external_code").in("id",groupIds):Promise.resolve({data:[]}),
    batchLearnerIds.length?db.from("submissions").select("batch_learner_id,activity_type,activity_config_id,status,last_submitted_at,reviewed_at,submission_attempts(attempt_number,score_percent,response_json,submitted_at)").eq("batch_id",batchId).in("batch_learner_id",batchLearnerIds):Promise.resolve({data:[]}),
    sessionIds.length?db.from("attendance_records").select("batch_learner_id,status").in("session_id",sessionIds):Promise.resolve({data:[]}),
    batchLearnerIds.length?db.from("xp_transactions").select("batch_learner_id,amount").eq("batch_id",batchId).in("batch_learner_id",batchLearnerIds):Promise.resolve({data:[]})
  ]);
  if(accountsResult.error||groupsResult.error||submissionsResult.error||attendanceResult.error||xpResult.error) return out({error:"Could not load learner results"},500);

  const accounts=new Map((accountsResult.data??[]).map((row:any)=>[row.id,row]));
  const groups=new Map((groupsResult.data??[]).map((row:any)=>[row.id,row]));
  const perLearner=new Map<string,any>();
  for(const enrollment of learners){
    const account=accounts.get(enrollment.learner_id)??{};
    const group=groups.get(enrollment.group_id)??{};
    perLearner.set(enrollment.id,{
      batch_learner_id:enrollment.id,
      learner_name:account.display_name||account.email||"ไม่ระบุชื่อ",
      email:account.email||"",
      group_name:group.name||"",
      enrollment_status:enrollment.enrollment_status,
      pre_test:null,post_test:null,self_before:null,self_after:null,
      assignments_submitted:0,assignments_reviewed:0,assignments_needs_revision:0,
      attendance_present:0,attendance_total:(sessionsResult.data??[]).length,xp:0
    });
  }
  const selfConfig=(configsResult.data??[]).find((row:any)=>Array.isArray(row.config_json?.criteria)&&row.config_json.criteria.length===5);
  const criteria=selfConfig?.config_json?.criteria??[];
  const selfValues:any={SELF_BEFORE:{},SELF_AFTER:{}};
  for(const submission of submissionsResult.data??[]){
    const learner=perLearner.get(submission.batch_learner_id);
    if(!learner) continue;
    const attempt=latest(submission.submission_attempts??[]);
    const score=Number(attempt?.score_percent);
    if(submission.activity_type==="PRE_TEST"&&Number.isFinite(score)) learner.pre_test=score;
    if(submission.activity_type==="POST_TEST"&&Number.isFinite(score)) learner.post_test=score;
    if(submission.activity_type==="ASSIGNMENT"){
      if(["SUBMITTED","PASSED","REVIEWED","NEEDS_REVISION","LATE"].includes(submission.status)) learner.assignments_submitted++;
      if(submission.status==="REVIEWED") learner.assignments_reviewed++;
      if(submission.status==="NEEDS_REVISION") learner.assignments_needs_revision++;
    }
    if(["SELF_BEFORE","SELF_AFTER"].includes(submission.activity_type)&&attempt?.response_json?.ratings){
      const ratings=attempt.response_json.ratings;
      const nums=criteria.map((c:any)=>Number(ratings[c.key])).filter((v:number)=>v>=1&&v<=5);
      learner[submission.activity_type==="SELF_BEFORE"?"self_before":"self_after"]=avg(nums);
      for(const c of criteria){
        const value=Number(ratings[c.key]);
        if(value>=1&&value<=5){
          const values=selfValues[submission.activity_type][c.key]??[];
          values.push(value);
          selfValues[submission.activity_type][c.key]=values;
        }
      }
    }
  }
  for(const record of attendanceResult.data??[]){
    const learner=perLearner.get(record.batch_learner_id);
    if(learner&&record.status==="PRESENT") learner.attendance_present++;
  }
  for(const transaction of xpResult.data??[]){
    const learner=perLearner.get(transaction.batch_learner_id);
    if(learner) learner.xp+=Number(transaction.amount)||0;
  }
  const rows=[...perLearner.values()].sort((a,b)=>b.xp-a.xp||a.learner_name.localeCompare(b.learner_name,"th"));
  rows.forEach((row,index)=>row.rank=index+1);
  const before=rows.map(row=>row.self_before).filter((v:any)=>v!=null);
  const after=rows.map(row=>row.self_after).filter((v:any)=>v!=null);
  const pre=rows.map(row=>row.pre_test).filter((v:any)=>v!=null);
  const post=rows.map(row=>row.post_test).filter((v:any)=>v!=null);
  const assignmentConfigs=(configsResult.data??[]).filter((row:any)=>row.activity_type==="ASSIGNMENT").length;
  const self_rows=criteria.map((c:any)=>{
    const beforeValues=selfValues.SELF_BEFORE[c.key]??[],afterValues=selfValues.SELF_AFTER[c.key]??[];
    const beforeAvg=avg(beforeValues),afterAvg=avg(afterValues);
    return {title:c.title,before:beforeAvg,after:afterAvg,difference:beforeAvg!=null&&afterAvg!=null?rounded(afterAvg-beforeAvg):null,before_count:beforeValues.length,after_count:afterValues.length};
  });
  return out({
    generated_at:new Date().toISOString(),
    batch:batchResult.data,
    overview:{
      learner_count:rows.length,
      active_learners:rows.filter(row=>row.enrollment_status==="ACTIVE").length,
      attendance_sessions:(sessionsResult.data??[]).length,
      attendance_present_rate:rows.length&&(sessionsResult.data??[]).length?rounded(rows.reduce((sum,row)=>sum+row.attendance_present,0)/(rows.length*(sessionsResult.data??[]).length)*100):null,
      pre_test_average:avg(pre),
      post_test_average:avg(post),
      self_before_average:avg(before),
      self_after_average:avg(after),
      assignment_count:assignmentConfigs,
      assignments_submitted:rows.reduce((sum,row)=>sum+row.assignments_submitted,0),
      assignments_reviewed:rows.reduce((sum,row)=>sum+row.assignments_reviewed,0),
      total_xp:rows.reduce((sum,row)=>sum+row.xp,0)
    },
    self_assessment:{criteria:self_rows,scale_labels:selfConfig?.config_json?.scale_labels??[]},
    learners:rows
  });
});