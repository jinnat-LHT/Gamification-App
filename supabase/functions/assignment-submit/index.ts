import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGIN="https://jinnat-lht.github.io";
const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,"Content-Type":"application/json"}});
const bucket="assignment-submissions";
const clean=(name:string)=>name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g,"_").replace(/_+/g,"_").slice(-120)||"file";

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers});
  if(req.method!=="POST") return out({error:"Method not allowed"},405);
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
  const url=Deno.env.get("SUPABASE_URL")??"", anon=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY")??"", secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??Deno.env.get("SUPABASE_SECRET_KEY")??"";
  if(!token||!url||!anon||!secret) return out({error:"Authentication or configuration missing"},401);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
  const {data:{user}}=await userClient.auth.getUser(token);
  if(!user) return out({error:"Invalid session"},401);
  const admin=createClient(url,secret,{auth:{persistSession:false}});
  const payload=await req.json().catch(()=>({}));
  const action=String(payload.action??"prepare");
  const {data:enrollment}=await admin.from("batch_learners").select("id,batch_id").eq("learner_id",user.id).in("enrollment_status",["INVITED","ACTIVE"]).limit(1).maybeSingle();
  if(!enrollment) return out({error:"No active batch enrolment"},403);
  const activityConfigId=String(payload.activity_config_id??"");
  const {data:config}=await admin.from("batch_activity_configs").select("id,enabled,gate_state,activity_key,config_json").eq("id",activityConfigId).eq("batch_id",enrollment.batch_id).eq("activity_type","ASSIGNMENT").maybeSingle();
  if(!config?.enabled||config.gate_state!=="OPEN") return out({error:"Assignment is not open"},403);

  let {data:submission}=await admin.from("submissions").select("id,status").eq("activity_config_id",config.id).eq("batch_learner_id",enrollment.id).maybeSingle();
  if(!submission){
    const result=await admin.from("submissions").insert({batch_id:enrollment.batch_id,batch_learner_id:enrollment.id,activity_config_id:config.id,activity_type:"ASSIGNMENT",status:"IN_PROGRESS"}).select("id,status").single();
    if(result.error||!result.data) return out({error:"Could not create assignment submission"},500);
    submission=result.data;
  }
  if(["REVIEWED","PASSED"].includes(submission.status)) return out({error:"This assignment has already been reviewed"},409);

  if(action==="prepare"){
    const files=Array.isArray(payload.files)?payload.files:[];
    if(files.length>3) return out({error:"Upload up to 3 files only"},422);
    const uploads=[];
    for(const file of files){
      const size=Number(file?.size??0);
      if(!Number.isFinite(size)||size<=0||size>20971520) return out({error:"Each file must be between 1 byte and 20 MB"},422);
      const path=`${enrollment.batch_id}/${submission.id}/${crypto.randomUUID()}-${clean(String(file?.name??"file"))}`;
      const signed=await admin.storage.from(bucket).createSignedUploadUrl(path);
      if(signed.error||!signed.data) return out({error:"Could not prepare file upload"},500);
      uploads.push({path,token:signed.data.token});
    }
    return out({submission_id:submission.id,activity_key:config.activity_key,uploads});
  }
  if(action!=="submit") return out({error:"Unsupported action"},400);

  const text=String(payload.text_response??"").trim();
  const files=Array.isArray(payload.files)?payload.files:[];
  if(!text&&!files.length) return out({error:"Enter a response or attach at least one file"},422);
  if(files.length>3) return out({error:"Upload up to 3 files only"},422);
  const folder=`${enrollment.batch_id}/${submission.id}`;
  const listed=await admin.storage.from(bucket).list(folder,{limit:20});
  if(listed.error) return out({error:"Could not validate uploaded files"},500);
  const objectNames=new Set((listed.data??[]).map((x:any)=>x.name));
  for(const file of files){
    const path=String(file?.storage_key??"");
    const size=Number(file?.size_bytes??0);
    if(!path.startsWith(folder+"/")||!objectNames.has(path.split("/").pop()||"")||!Number.isFinite(size)||size<=0||size>20971520) return out({error:"One or more uploaded files are invalid"},422);
  }
  const countResult=await admin.from("submission_attempts").select("id",{count:"exact",head:true}).eq("submission_id",submission.id);
  const attempt=await admin.from("submission_attempts").insert({submission_id:submission.id,attempt_number:(countResult.count??0)+1,response_json:{text_response:text},pass_state:"NOT_APPLICABLE",question_order_json:[]}).select("id").single();
  if(attempt.error||!attempt.data) return out({error:"Could not save assignment"},500);
  if(files.length){
    const meta=files.map((f:any)=>({submission_attempt_id:attempt.data.id,storage_key:String(f.storage_key),original_filename:String(f.original_filename??"file"),mime_type:String(f.mime_type??"application/octet-stream"),size_bytes:Number(f.size_bytes),scan_status:"PENDING"}));
    const saved=await admin.from("submission_files").insert(meta);
    if(saved.error) return out({error:"Assignment saved but file metadata could not be saved"},500);
  }
  const now=new Date().toISOString();
  const updated=await admin.from("submissions").update({status:"SUBMITTED",first_submitted_at:submission.status==="IN_PROGRESS"?now:undefined,last_submitted_at:now}).eq("id",submission.id);
  if(updated.error) return out({error:"Could not finalize assignment"},500);
  await admin.from("audit_events").insert({actor_user_id:user.id,batch_id:enrollment.batch_id,event_type:"ASSIGNMENT_SUBMITTED",target_type:"submission",target_id:submission.id,after_json:{activity_config_id:config.id,file_count:files.length}});
  return out({submission_id:submission.id,status:"SUBMITTED"});
});