import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGIN="https://jinnat-lht.github.io";
const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,"Content-Type":"application/json"}});
const bucket="assignment-submissions";

async function reviewerContext(admin:any,userId:string){
  const account=await admin.from("user_accounts").select("id,account_type,status,display_name,email").eq("id",userId).maybeSingle();
  if(account.error||!account.data||!["ADMIN","FACILITATOR"].includes(account.data.account_type)||account.data.status!=="ACTIVE") return null;
  const roles=await admin.from("role_assignments").select("role,scope_type,provider_organization_id,client_organization_id,program_id,batch_id").eq("user_id",userId).eq("role",account.data.account_type).is("revoked_at",null);
  return {account:account.data,roles:roles.data??[]};
}
async function canReviewBatch(admin:any,ctx:any,batchId:string){
  const batch=await admin.from("batches").select("id,program_id").eq("id",batchId).maybeSingle();
  if(batch.error||!batch.data) return false;
  const program=await admin.from("programs").select("id,client_organization_id").eq("id",batch.data.program_id).maybeSingle();
  const client=program.data?await admin.from("client_organizations").select("id,provider_organization_id").eq("id",program.data.client_organization_id).maybeSingle():{data:null};
  if(!program.data||!client.data) return false;
  return ctx.roles.some((r:any)=>
    (r.scope_type==="PROVIDER"&&r.provider_organization_id===client.data.provider_organization_id) ||
    (r.scope_type==="CLIENT_ORGANIZATION"&&r.client_organization_id===client.data.id) ||
    (r.scope_type==="PROGRAM"&&r.program_id===program.data.id) ||
    (r.scope_type==="BATCH"&&r.batch_id===batch.data.id)
  );
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers});
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
  const url=Deno.env.get("SUPABASE_URL")??"", anon=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY")??"", secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??Deno.env.get("SUPABASE_SECRET_KEY")??"";
  if(!token||!url||!anon||!secret) return out({error:"Authentication or configuration missing"},401);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
  const {data:{user}}=await userClient.auth.getUser(token); if(!user) return out({error:"Invalid session"},401);
  const admin=createClient(url,secret,{auth:{persistSession:false}});
  const ctx=await reviewerContext(admin,user.id); if(!ctx) return out({error:"Reviewer access required"},403);
  const payload=await req.json().catch(()=>({})); const action=String(payload.action??"list");
  const batchId=String(payload.batch_id??"");
  if(!batchId||!(await canReviewBatch(admin,ctx,batchId))) return out({error:"You do not have access to this batch"},403);

  if(action==="list"){
    const queue=await admin.from("submissions").select("id,status,activity_config_id,batch_learner_id,last_submitted_at").eq("batch_id",batchId).eq("activity_type","ASSIGNMENT").in("status",["SUBMITTED","NEEDS_REVISION","REVIEWED"]).order("last_submitted_at",{ascending:false});
    if(queue.error) return out({error:"Could not load assignment queue"},500);
    const configIds=[...new Set((queue.data??[]).map((x:any)=>x.activity_config_id))];
    const learnerIds=[...new Set((queue.data??[]).map((x:any)=>x.batch_learner_id))];
    const submissionIds=(queue.data??[]).map((x:any)=>x.id);
    const [configs, learners, attempts, feedbacks]=await Promise.all([
      configIds.length?admin.from("batch_activity_configs").select("id,activity_key,config_json").in("id",configIds):Promise.resolve({data:[]}),
      learnerIds.length?admin.from("batch_learners").select("id,learner_id").in("id",learnerIds):Promise.resolve({data:[]}),
      submissionIds.length?admin.from("submission_attempts").select("id,submission_id,attempt_number,response_json,submitted_at").in("submission_id",submissionIds).order("attempt_number",{ascending:false}):Promise.resolve({data:[]}),
      submissionIds.length?admin.from("facilitator_feedback").select("id,submission_id,status,feedback_text,created_at,facilitator_id").in("submission_id",submissionIds).is("deleted_at",null).order("created_at",{ascending:true}):Promise.resolve({data:[]})
    ]);
    const userIds=[...new Set((learners.data??[]).map((x:any)=>x.learner_id))];
    const accounts=userIds.length?await admin.from("user_accounts").select("id,display_name,email").in("id",userIds):{data:[]};
    const learnerMap=new Map((learners.data??[]).map((x:any)=>[x.id,x.learner_id]));
    const accountMap=new Map((accounts.data??[]).map((x:any)=>[x.id,x]));
    const configMap=new Map((configs.data??[]).map((x:any)=>[x.id,x]));
    const latestAttempt=new Map();
    for(const attempt of attempts.data??[]) if(!latestAttempt.has(attempt.submission_id)) latestAttempt.set(attempt.submission_id,attempt);
    const attemptIds=[...latestAttempt.values()].map((x:any)=>x.id);
    const fileResult=attemptIds.length?await admin.from("submission_files").select("submission_attempt_id,storage_key,original_filename,mime_type,size_bytes").in("submission_attempt_id",attemptIds).is("deleted_at",null):{data:[]};
    const filesByAttempt=new Map<string,any[]>();
    for(const file of fileResult.data??[]){const group=filesByAttempt.get(file.submission_attempt_id)??[];group.push(file);filesByAttempt.set(file.submission_attempt_id,group);}
    const feedbackBySubmission=new Map<string,any>();
    for(const feedback of feedbacks.data??[]) feedbackBySubmission.set(feedback.submission_id,feedback);
    const items=await Promise.all((queue.data??[]).map(async(s:any)=>{
      const latest=latestAttempt.get(s.id); const signedFiles=await Promise.all((filesByAttempt.get(latest?.id)??[]).map(async(f:any)=>{const signed=await admin.storage.from(bucket).createSignedUrl(f.storage_key,900);return {...f,signed_url:signed.data?.signedUrl??null};}));
      return {id:s.id,status:s.status,activity_key:configMap.get(s.activity_config_id)?.activity_key,submitted_at:s.last_submitted_at,learner:accountMap.get(learnerMap.get(s.batch_learner_id)),attempt_number:latest?.attempt_number??0,text_response:latest?.response_json?.text_response??"",files:signedFiles,feedback:feedbackBySubmission.get(s.id)??null};
    }));
    return out({items});
  }
  if(action!=="review") return out({error:"Unsupported action"},400);
  const submissionId=String(payload.submission_id??""); const status=String(payload.status??""); const feedback=String(payload.feedback_text??"").trim();
  if(!["REVIEWED","NEEDS_REVISION"].includes(status)) return out({error:"Invalid review status"},422);
  if(status==="NEEDS_REVISION"&&!feedback) return out({error:"Feedback is required when revision is requested"},422);
  const submission=await admin.from("submissions").select("id,batch_id,activity_type").eq("id",submissionId).eq("batch_id",batchId).maybeSingle();
  if(!submission.data||submission.data.activity_type!=="ASSIGNMENT") return out({error:"Assignment not found"},404);
  const feedbackResult=await admin.from("facilitator_feedback").insert({submission_id:submissionId,facilitator_id:user.id,status,feedback_text:feedback||null});
  if(feedbackResult.error) return out({error:"Could not save feedback"},500);
  const now=new Date().toISOString();
  await admin.from("submissions").update({status,reviewed_at:now,reviewed_by:user.id}).eq("id",submissionId);
  await admin.from("audit_events").insert({actor_user_id:user.id,batch_id:batchId,event_type:"ASSIGNMENT_REVIEWED",target_type:"submission",target_id:submissionId,after_json:{status}});
  return out({ok:true,status});
});