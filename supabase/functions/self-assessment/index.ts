import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGIN="https://jinnat-lht.github.io";
const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,"Content-Type":"application/json"}});

const defaultCriteria=[
  {key:"strategic_thinking",title:"Strategic Thinking",description:"มองภาพรวม เชื่อมโยงข้อมูล และวางแนวทางระยะยาว",scale_labels:{"1":"ต้องพัฒนาอย่างมาก","2":"กำลังพัฒนา","3":"ทำได้ตามความคาดหวัง","4":"ทำได้ดี","5":"เป็นแบบอย่าง"}},
  {key:"coaching",title:"Coaching",description:"สนับสนุนและพัฒนาผู้อื่นด้วยการตั้งคำถามและให้คำแนะนำ",scale_labels:{"1":"ต้องพัฒนาอย่างมาก","2":"กำลังพัฒนา","3":"ทำได้ตามความคาดหวัง","4":"ทำได้ดี","5":"เป็นแบบอย่าง"}},
  {key:"growth_mindset",title:"Growth Mindset",description:"เปิดรับการเรียนรู้ ทดลอง และพัฒนาตนเองอย่างต่อเนื่อง",scale_labels:{"1":"ต้องพัฒนาอย่างมาก","2":"กำลังพัฒนา","3":"ทำได้ตามความคาดหวัง","4":"ทำได้ดี","5":"เป็นแบบอย่าง"}},
  {key:"team_execution",title:"Team Execution",description:"ทำงานร่วมกัน เปลี่ยนแผนเป็นผลลัพธ์ และรับผิดชอบต่อเป้าหมาย",scale_labels:{"1":"ต้องพัฒนาอย่างมาก","2":"กำลังพัฒนา","3":"ทำได้ตามความคาดหวัง","4":"ทำได้ดี","5":"เป็นแบบอย่าง"}},
  {key:"agility",title:"Agility",description:"ปรับตัวและตัดสินใจได้เหมาะสมเมื่อบริบทเปลี่ยนแปลง",scale_labels:{"1":"ต้องพัฒนาอย่างมาก","2":"กำลังพัฒนา","3":"ทำได้ตามความคาดหวัง","4":"ทำได้ดี","5":"เป็นแบบอย่าง"}}
];
const defaultScaleLabels=defaultCriteria[0].scale_labels;
function normaliseCriteria(value:any){
  if(!Array.isArray(value)||value.length!==5)throw new Error("กรุณากำหนดเกณฑ์ให้ครบ 5 ข้อ");
  return value.map((item:any,index:number)=>{
    const title=String(item?.title??"").trim(),description=String(item?.description??"").trim();
    if(!title)throw new Error("กรุณาระบุชื่อเกณฑ์ข้อที่ "+(index+1));
    return {key:String(item?.key??defaultCriteria[index].key),title,description};
  });
}
function normaliseScaleLabels(value:any){
  const labels:any={};
  for(let n=1;n<=5;n++){labels[String(n)]=String(value?.[String(n)]??"").trim();if(!labels[String(n)])throw new Error("กรุณาระบุคำอธิบายระดับ "+n);}
  return labels;
}
async function adminRoles(db:any,userId:string){
  const account=await db.from("user_accounts").select("id,account_type,status").eq("id",userId).maybeSingle();
  if(!account.data||account.data.account_type!=="ADMIN"||account.data.status!=="ACTIVE")return null;
  const roles=await db.from("role_assignments").select("scope_type,provider_organization_id,client_organization_id,program_id,batch_id").eq("user_id",userId).eq("role","ADMIN").is("revoked_at",null);
  return roles.data??[];
}
async function canManageBatch(db:any,roles:any[],batchId:string){
  const batch=await db.from("batches").select("id,program_id").eq("id",batchId).maybeSingle();if(!batch.data)return false;
  const program=await db.from("programs").select("id,client_organization_id").eq("id",batch.data.program_id).maybeSingle();if(!program.data)return false;
  const client=await db.from("client_organizations").select("id,provider_organization_id").eq("id",program.data.client_organization_id).maybeSingle();if(!client.data)return false;
  return roles.some(r=>(r.scope_type==="PROVIDER"&&r.provider_organization_id===client.data.provider_organization_id)||(r.scope_type==="CLIENT_ORGANIZATION"&&r.client_organization_id===client.data.id)||(r.scope_type==="PROGRAM"&&r.program_id===program.data.id)||(r.scope_type==="BATCH"&&r.batch_id===batch.data.id));
}
async function learnerEnrollment(db:any,userId:string){
  const r=await db.from("batch_learners").select("id,batch_id,status").eq("learner_id",userId).in("status",["INVITED","ACTIVE"]).limit(1).maybeSingle();
  return r.data;
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers});
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,""),url=Deno.env.get("SUPABASE_URL")??"",anon=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY")??"",secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??Deno.env.get("SUPABASE_SECRET_KEY")??"";
  if(!token||!url||!anon||!secret)return out({error:"Authentication or configuration missing"},401);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false}});
  const {data:{user}}=await userClient.auth.getUser(token);if(!user)return out({error:"Invalid session"},401);
  const db=createClient(url,secret,{auth:{persistSession:false}}),payload=await req.json().catch(()=>({})),action=String(payload.action??""),batchId=String(payload.batch_id??"");
  if(action==="criteria-get"||action==="criteria-save"){
    const roles=await adminRoles(db,user.id);
    if(!roles||!batchId||!(await canManageBatch(db,roles,batchId)))return out({error:"Administrator access to this batch is required"},403);
    const configs=await db.from("batch_activity_configs").select("id,activity_type,config_json").eq("batch_id",batchId).in("activity_type",["SELF_BEFORE","SELF_AFTER"]);
    if(configs.error)return out({error:"Could not load Self-assessment configuration"},500);
    if(action==="criteria-get"){const source=(configs.data??[]).find((row:any)=>Array.isArray(row.config_json?.criteria)&&row.config_json.criteria.length===5);return out({criteria:source?.config_json?.criteria??defaultCriteria,scale_labels:source?.config_json?.scale_labels??source?.config_json?.criteria?.[0]?.scale_labels??defaultScaleLabels,items:configs.data??[]});}
    try{
      const criteria=normaliseCriteria(payload.criteria),scale_labels=normaliseScaleLabels(payload.scale_labels);if((configs.data??[]).length===0)return out({error:"ยังไม่มี Self-assessment ใน Batch นี้"},404);
      for(const config of configs.data??[]){const update=await db.from("batch_activity_configs").update({config_json:{...(config.config_json??{}),criteria,scale_labels}}).eq("id",config.id);if(update.error)throw new Error("Could not save Self-assessment configuration");}
      await db.from("audit_events").insert({actor_user_id:user.id,batch_id:batchId,event_type:"SELF_ASSESSMENT_CRITERIA_UPDATED",target_type:"batch",target_id:batchId,after_json:{criteria,scale_labels}});
      return out({criteria,scale_labels});
    }catch(error){return out({error:error instanceof Error?error.message:"Could not save criteria"},422);}
  }
  if(!["start","submit"].includes(action))return out({error:"Unsupported action"},400);
  const enrollment=await learnerEnrollment(db,user.id);if(!enrollment)return out({error:"You are not enrolled in a batch"},403);
  const type=String(payload.type??"");if(!["SELF_BEFORE","SELF_AFTER"].includes(type))return out({error:"Invalid Self-assessment type"},422);
  const config=await db.from("batch_activity_configs").select("id,config_json,enabled,gate_state").eq("batch_id",enrollment.batch_id).eq("activity_type",type).maybeSingle();
  if(!config.data||!config.data.enabled||config.data.gate_state!=="OPEN")return out({error:"Self-assessment is not open"},403);
  const criteria=Array.isArray(config.data.config_json?.criteria)&&config.data.config_json.criteria.length===5?config.data.config_json.criteria:defaultCriteria;
  const scale_labels=config.data.config_json?.scale_labels??criteria[0]?.scale_labels??defaultScaleLabels;
  const existing=await db.from("submissions").select("id,status,submitted_at").eq("activity_config_id",config.data.id).eq("batch_learner_id",enrollment.id).maybeSingle();
  if(action==="start")return out({type,criteria,scale_labels,submitted:existing.data?.status==="SUBMITTED",submitted_at:existing.data?.submitted_at??null});
  if(existing.data?.status==="SUBMITTED")return out({error:"คุณส่งแบบประเมินนี้แล้ว"},409);
  try{
    const ratings:any=payload.ratings??{},response:any={};
    criteria.forEach((criterion:any)=>{const value=Number(ratings[criterion.key]);if(!Number.isInteger(value)||value<1||value>5)throw new Error("กรุณาเลือกระดับให้ครบทั้ง 5 ข้อ");response[criterion.key]=value;});
    let submissionId=existing.data?.id;
    if(!submissionId){const created=await db.from("submissions").insert({activity_config_id:config.data.id,batch_learner_id:enrollment.id,status:"DRAFT"}).select("id").single();if(created.error||!created.data)throw new Error("Could not create submission");submissionId=created.data.id;}
    const attempts=await db.from("submission_attempts").select("attempt_number").eq("submission_id",submissionId).order("attempt_number",{ascending:false}).limit(1);
    const attemptNumber=(attempts.data?.[0]?.attempt_number??0)+1,score=Object.values(response).reduce((sum:any,value:any)=>sum+Number(value),0)/5*20;
    const attempt=await db.from("submission_attempts").insert({submission_id:submissionId,attempt_number:attemptNumber,response_json:{ratings:response},score_percent:score,pass_state:"NOT_APPLICABLE"});
    if(attempt.error)throw new Error("Could not save responses");
    const final=await db.from("submissions").update({status:"SUBMITTED",submitted_at:new Date().toISOString()}).eq("id",submissionId);if(final.error)throw new Error("Could not submit Self-assessment");
    return out({submitted:true,score_percent:score});
  }catch(error){return out({error:error instanceof Error?error.message:"Could not submit Self-assessment"},422);}
});