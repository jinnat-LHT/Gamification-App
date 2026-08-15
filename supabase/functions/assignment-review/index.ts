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
    const result=await admin.from("submissions").select("id,status,activity_config_id,first_submitted_at,last_submitted_at,batch_learners!inner(learner_id,user_accounts!inner(display_name,email)),batch_activity_configs!inner(activity_key,config_json),submission_attempts(id,attempt_number,response_json,submitted_at,submission_files(id,storage_key,original_filename,mime_type,size_bytes)),facilitator_feedback(id,status,feedback_text,created_at,facilitator_id)").eq("batch_id",batchId).eq("activity_type","ASSIGNMENT").in("status",["SUBMITTED","NEEDS_REVISION","REVIEWED"]).order("last_submitted_at",{ascending:false});
    if(result.error) return out({error:"Could not load assignment queue"},500);
    const items=await Promise.all((result.data??[]).map(async(s:any)=>{
      const attempts=[...(s.submission_attempts??[])].sort((a,b)=>Number(b.attempt_number)-Number(a.attempt_number));
      const latest=attempts[0]??null;
      const files=await Promise.all((latest?.submission_files??[]).map(async(f:any)=>{const x=await admin.storage.from(bucket).createSignedUrl(f.storage_key,900);return {...f,signed_url:x.data?.signedUrl??null};}));
      return {id:s.id,status:s.status,activity_key:s.batch_activity_configs?.activity_key,submitted_at:s.last_submitted_at,learner:s.batch_learners?.user_accounts,attempt_number:latest?.attempt_number??0,text_response:latest?.response_json?.text_response??"",files,feedback:(s.facilitator_feedback??[]).filter((x:any)=>!x.deleted_at).at(-1)??null};
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