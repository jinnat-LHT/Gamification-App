import { createClient } from "npm:@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin":"https://jinnat-lht.github.io", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const out = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers:{...headers,"Content-Type":"application/json"} });
const shuffle = <T>(items:T[]) => { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };

Deno.serve(async (req) => {
  if (req.method==="OPTIONS") return new Response("ok",{headers});
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
  const url=Deno.env.get("SUPABASE_URL")??"", anon=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY")??"", secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??Deno.env.get("SUPABASE_SECRET_KEY")??"";
  if(!token||!url||!anon||!secret) return out({error:"Authentication or configuration missing"},401);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
  const {data:{user}}=await userClient.auth.getUser(token); if(!user) return out({error:"Invalid session"},401);
  const admin=createClient(url,secret,{auth:{persistSession:false}});
  const payload=await req.json().catch(()=>({})); const action=String(payload.action??"start");
  const {data:enrollment}=await admin.from("batch_learners").select("id,batch_id").eq("learner_id",user.id).in("enrollment_status",["INVITED","ACTIVE"]).limit(1).maybeSingle();
  if(!enrollment) return out({error:"No active batch enrolment"},403);
  const {data:config}=await admin.from("batch_activity_configs").select("id,enabled,gate_state,config_json").eq("batch_id",enrollment.batch_id).eq("activity_type","POST_TEST").maybeSingle();
  if(!config?.enabled||config.gate_state!=="OPEN") return out({error:"Post-test is not open"},403);
  const {data:snapshot}=await admin.from("batch_content_snapshots").select("program_version_id").eq("batch_id",enrollment.batch_id).maybeSingle();
  if(!snapshot) return out({error:"Batch content is not published"},422);
  const {data:existing}=await admin.from("submissions").select("id,status,passed_at").eq("activity_config_id",config.id).eq("batch_learner_id",enrollment.id).maybeSingle();
  if(existing?.status==="PASSED") return out({locked:true,status:"PASSED",passed_at:existing.passed_at});
  const {data:questions}=await admin.from("quiz_question_versions").select("id,question_text,option_a,option_b,option_c,option_d,sort_order").eq("program_version_id",snapshot.program_version_id).is("deleted_at",null).order("sort_order");
  if(!questions?.length) return out({error:"Quiz Bank has no questions"},422);
  let submission=existing;
  if(!submission){const {data,error}=await admin.from("submissions").insert({batch_id:enrollment.batch_id,batch_learner_id:enrollment.id,activity_config_id:config.id,activity_type:"POST_TEST",status:"IN_PROGRESS"}).select("id,status").single();if(error||!data)return out({error:"Could not start post-test"},500);submission=data;}
  const ordered=shuffle(questions);
  if(action==="start") return out({submission_id:submission.id,questions:ordered.map(q=>({id:q.id,question_text:q.question_text,options:{A:q.option_a,B:q.option_b,C:q.option_c,D:q.option_d}}))});
  if(action!=="submit") return out({error:"Unsupported action"},400);
  const answers=payload.answers??{};const answerMap=new Map(questions.map(q=>[q.id,q]));const correct=Object.entries(answers).filter(([id,a])=>answerMap.get(id)?.[`option_${String(a).toLowerCase()}` as keyof typeof answerMap extends never ? never : never]).length;
  const score=Math.round((Object.entries(answers).filter(([id,a])=>{const q=answerMap.get(id);return q&&String(a).toUpperCase()===String((q as any).correct_option).toUpperCase();}).length/questions.length)*100);
  const pass=score>=80;const {count}=await admin.from("submission_attempts").select("id",{count:"exact",head:true}).eq("submission_id",submission.id);
  await admin.from("submission_attempts").insert({submission_id:submission.id,attempt_number:(count??0)+1,response_json:answers,score_percent:score,pass_state:pass?"PASSED":"FAILED",question_order_json:questions.map(q=>q.id)});
  await admin.from("submissions").update({status:pass?"PASSED":"SUBMITTED",last_submitted_at:new Date().toISOString(),passed_at:pass?new Date().toISOString():null}).eq("id",submission.id);
  return out({score_percent:score,passed:pass,can_retest:!pass});
});