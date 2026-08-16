import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGIN="https://jinnat-lht.github.io";
const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,"Content-Type":"application/json"}});
const clean=(v:unknown,max=160)=>String(v??"").trim().slice(0,max);
const batchPrefix=(name:string)=>{const words=String(name??"").toUpperCase().match(/[A-Z0-9]+/g)??[];const initials=words.length>1?words.map(word=>word[0]).join(""):words.join("");return (initials||"BATCH").slice(0,12);};

async function getAdmin(db:any,userId:string){
  const account=await db.from("user_accounts").select("account_type,status").eq("id",userId).maybeSingle();
  if(!account.data||account.data.account_type!=="ADMIN"||account.data.status!=="ACTIVE")return null;
  const roles=await db.from("role_assignments").select("scope_type,provider_organization_id,client_organization_id,program_id,batch_id").eq("user_id",userId).eq("role","ADMIN").is("revoked_at",null);
  return roles.data??[];
}
async function scopeForClient(db:any,roles:any[],clientId:string){
  const client=await db.from("client_organizations").select("id,provider_organization_id").eq("id",clientId).is("deleted_at",null).maybeSingle();
  if(!client.data)return null;
  const ok=roles.some((r:any)=>(r.scope_type==="PROVIDER"&&r.provider_organization_id===client.data.provider_organization_id)||(r.scope_type==="CLIENT_ORGANIZATION"&&r.client_organization_id===client.data.id));
  return ok?client.data:null;
}
async function scopeForProgram(db:any,roles:any[],programId:string){
  const program=await db.from("programs").select("id,name,client_organization_id").eq("id",programId).is("deleted_at",null).maybeSingle();
  if(!program.data)return null;
  const client=await db.from("client_organizations").select("id,provider_organization_id").eq("id",program.data.client_organization_id).is("deleted_at",null).maybeSingle();
  if(!client.data)return null;
  const ok=roles.some((r:any)=>(r.scope_type==="PROVIDER"&&r.provider_organization_id===client.data.provider_organization_id)||(r.scope_type==="CLIENT_ORGANIZATION"&&r.client_organization_id===client.data.id)||(r.scope_type==="PROGRAM"&&r.program_id===program.data.id));
  return ok?{program:program.data,client:client.data}:null;
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers});
  if(req.method!=="POST")return reply({error:"Method not allowed"},405);
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
  const url=Deno.env.get("SUPABASE_URL")??"",anon=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY")??"",secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??Deno.env.get("SUPABASE_SECRET_KEY")??"";
  if(!token||!url||!anon||!secret)return reply({error:"Authentication or configuration missing"},401);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false}});
  const user=(await userClient.auth.getUser(token)).data.user;if(!user)return reply({error:"Invalid session"},401);
  const db=createClient(url,secret,{auth:{persistSession:false}}),payload=await req.json().catch(()=>({})),roles=await getAdmin(db,user.id);
  if(!roles)return reply({error:"Admin access is required"},403);
  const action=clean(payload.action,40);

  if(action==="list"){
    const providerIds=[...new Set(roles.filter((r:any)=>r.scope_type==="PROVIDER").map((r:any)=>r.provider_organization_id).filter(Boolean))];
    const clientIds=[...new Set(roles.filter((r:any)=>r.scope_type==="CLIENT_ORGANIZATION").map((r:any)=>r.client_organization_id).filter(Boolean))];
    let clients:any[]=[];
    if(providerIds.length){const q=await db.from("client_organizations").select("id,name,external_code,status,provider_organization_id").in("provider_organization_id",providerIds).is("deleted_at",null).order("name");clients=q.data??[];}
    if(clientIds.length){const q=await db.from("client_organizations").select("id,name,external_code,status,provider_organization_id").in("id",clientIds).is("deleted_at",null).order("name");for(const row of q.data??[]){if(!clients.some(x=>x.id===row.id))clients.push(row);}}
    const programs=clients.length?(await db.from("programs").select("id,client_organization_id,name,description,status").in("client_organization_id",clients.map(x=>x.id)).is("deleted_at",null).order("name")).data??[]:[];
    const programIds=programs.map((p:any)=>p.id);
    const batches=programIds.length?(await db.from("batches").select("id,program_id,name,external_code,start_date,end_date,status").in("program_id",programIds).is("deleted_at",null).order("created_at")).data??[]:[];
    return reply({clients,programs,batches,can_create_client:providerIds.length>0});
  }

  if(action==="create_client"){
    const providerRole=roles.find((r:any)=>r.scope_type==="PROVIDER"&&r.provider_organization_id);
    if(!providerRole)return reply({error:"สิทธิ์ Admin ระดับผู้ให้บริการเท่านั้นที่สร้างลูกค้าใหม่ได้"},403);
    const name=clean(payload.name),code=clean(payload.external_code,40).toUpperCase().replace(/[^A-Z0-9_-]/g,"");
    if(!name||!code)return reply({error:"กรุณาระบุชื่อลูกค้าและรหัสลูกค้า"},422);
    const created=await db.from("client_organizations").insert({provider_organization_id:providerRole.provider_organization_id,name,external_code:code,status:"ACTIVE"}).select("id,name").maybeSingle();
    if(created.error)return reply({error:created.error.code==="23505"?"รหัสลูกค้าซ้ำ":"ไม่สามารถสร้างลูกค้าได้"},422);
    await db.from("audit_events").insert({actor_user_id:user.id,client_organization_id:created.data.id,event_type:"CLIENT_CREATED",target_type:"CLIENT_ORGANIZATION",target_id:created.data.id,after_json:{name,external_code:code},reason:"Created from Setup Center"});
    return reply({saved:true,message:"สร้างลูกค้าเรียบร้อยแล้ว"});
  }

  if(action==="create_program"||action==="update_program"){
    const clientId=clean(payload.client_id),scope=await scopeForClient(db,roles,clientId);
    if(!scope)return reply({error:"ไม่มีสิทธิ์จัดการลูกค้านี้"},403);
    const name=clean(payload.name),description=clean(payload.description,1200),status=["DRAFT","ACTIVE","ARCHIVED"].includes(clean(payload.status))?clean(payload.status):"DRAFT";
    if(!name)return reply({error:"กรุณาระบุชื่อโปรแกรม"},422);
    if(action==="create_program"){
      const created=await db.from("programs").insert({client_organization_id:clientId,name,description,status}).select("id,name").maybeSingle();
      if(created.error)return reply({error:"ไม่สามารถสร้างโปรแกรมได้"},500);
      const version=await db.from("program_versions").insert({program_id:created.data.id,version_number:1,status:"DRAFT",created_by:user.id}).select("id").maybeSingle();
      if(version.error)return reply({error:"สร้างเวอร์ชันเริ่มต้นของโปรแกรมไม่สำเร็จ"},500);
      await db.from("programs").update({current_version_id:version.data.id,updated_at:new Date().toISOString()}).eq("id",created.data.id);
      await db.from("audit_events").insert({actor_user_id:user.id,client_organization_id:clientId,event_type:"PROGRAM_CREATED",target_type:"PROGRAM",target_id:created.data.id,after_json:{name,description,status},reason:"Created from Setup Center"});
      return reply({saved:true,message:"สร้างโปรแกรมและเวอร์ชันเริ่มต้นเรียบร้อยแล้ว"});
    }
    const programId=clean(payload.program_id),old=await db.from("programs").select("id,name,description,status").eq("id",programId).eq("client_organization_id",clientId).is("deleted_at",null).maybeSingle();
    if(!old.data)return reply({error:"ไม่พบโปรแกรมที่เลือก"},404);
    const updated=await db.from("programs").update({name,description,status,updated_at:new Date().toISOString()}).eq("id",programId);if(updated.error)return reply({error:"ไม่สามารถบันทึกโปรแกรมได้"},500);
    await db.from("audit_events").insert({actor_user_id:user.id,client_organization_id:clientId,event_type:"PROGRAM_UPDATED",target_type:"PROGRAM",target_id:programId,before_json:old.data,after_json:{name,description,status},reason:"Updated from Setup Center"});
    return reply({saved:true,message:"บันทึกข้อมูลโปรแกรมเรียบร้อยแล้ว"});
  }

  if(action==="create_batch"||action==="update_batch"){
    const programId=clean(payload.program_id),scope=await scopeForProgram(db,roles,programId);
    if(!scope)return reply({error:"ไม่มีสิทธิ์จัดการโปรแกรมนี้"},403);
    const name=clean(payload.name),startDate=clean(payload.start_date,10)||null,endDate=clean(payload.end_date,10)||null,status=["DRAFT","READY","ACTIVE","COMPLETED","ARCHIVED"].includes(clean(payload.status))?clean(payload.status):"DRAFT";
    let code=clean(payload.external_code,40).toUpperCase().replace(/[^A-Z0-9_-]/g,"");
    if(!name)return reply({error:"กรุณาระบุชื่อรุ่น"},422);
    if(action==="create_batch"){
      const existing=await db.from("batches").select("external_code").eq("program_id",programId).is("deleted_at",null);
      if(existing.error)return reply({error:"ไม่สามารถสร้างรหัสรุ่นได้"},500);
      const prefix=batchPrefix(scope.program.name),pattern=new RegExp("^"+prefix+"-(\\d+)$"),max=(existing.data??[]).reduce((value:number,row:any)=>{const match=String(row.external_code??"").match(pattern);return match?Math.max(value,Number(match[1])):value;},0);
      code=prefix+"-"+String(max+1).padStart(3,"0");
      const created=await db.from("batches").insert({program_id:programId,name,external_code:code,start_date:startDate,end_date:endDate,status}).select("id,name").maybeSingle();
      if(created.error)return reply({error:created.error.code==="23505"?"รหัสรุ่นซ้ำในโปรแกรมนี้":"ไม่สามารถสร้างรุ่นได้"},422);
      const configs=[
        {activity_type:"PRE_TEST",activity_key:"pre_test"},{activity_type:"POST_TEST",activity_key:"post_test"},{activity_type:"SELF_BEFORE",activity_key:"self_before"},{activity_type:"SELF_AFTER",activity_key:"self_after"},{activity_type:"PEER_REVIEW",activity_key:"peer_review"},
        {activity_type:"ASSIGNMENT",activity_key:"assignment_1"},{activity_type:"ASSIGNMENT",activity_key:"assignment_2"},{activity_type:"ASSIGNMENT",activity_key:"assignment_3"}
      ].map(x=>({...x,batch_id:created.data.id,enabled:false,gate_state:"LOCKED"}));
      const configResult=await db.from("batch_activity_configs").insert(configs);if(configResult.error)return reply({error:"สร้างการตั้งค่ากิจกรรมเริ่มต้นไม่สำเร็จ"},500);
      await db.from("audit_events").insert({actor_user_id:user.id,client_organization_id:scope.client.id,batch_id:created.data.id,event_type:"BATCH_CREATED",target_type:"BATCH",target_id:created.data.id,after_json:{name,external_code:code,start_date:startDate,end_date:endDate,status},reason:"Created from Setup Center"});
      return reply({saved:true,external_code:code,message:"สร้างรุ่น "+code+" และการตั้งค่ากิจกรรมเริ่มต้นเรียบร้อยแล้ว"});
    }
    const batchId=clean(payload.batch_id),old=await db.from("batches").select("id,name,external_code,start_date,end_date,status").eq("id",batchId).eq("program_id",programId).is("deleted_at",null).maybeSingle();
    if(!old.data)return reply({error:"ไม่พบรุ่นที่เลือก"},404);
    const updated=await db.from("batches").update({name,external_code:code,start_date:startDate,end_date:endDate,status,updated_at:new Date().toISOString()}).eq("id",batchId);if(updated.error)return reply({error:updated.error.code==="23505"?"รหัสรุ่นซ้ำในโปรแกรมนี้":"ไม่สามารถบันทึกรุ่นได้"},422);
    await db.from("audit_events").insert({actor_user_id:user.id,client_organization_id:scope.client.id,batch_id:batchId,event_type:"BATCH_UPDATED",target_type:"BATCH",target_id:batchId,before_json:old.data,after_json:{name,external_code:code,start_date:startDate,end_date:endDate,status},reason:"Updated from Setup Center"});
    return reply({saved:true,message:"บันทึกรุ่นเรียนเรียบร้อยแล้ว"});
  }
  return reply({error:"Unsupported action"},400);
});