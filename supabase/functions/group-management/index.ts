import { createClient } from "npm:@supabase/supabase-js@2";
const ORIGIN="https://jinnat-lht.github.io";
const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,"Content-Type":"application/json"}});
async function rolesFor(db:any,userId:string){const account=await db.from("user_accounts").select("account_type,status").eq("id",userId).maybeSingle();if(!account.data||account.data.account_type!=="ADMIN"||account.data.status!=="ACTIVE")return null;const roles=await db.from("role_assignments").select("scope_type,provider_organization_id,client_organization_id,program_id,batch_id").eq("user_id",userId).eq("role","ADMIN").is("revoked_at",null);return roles.data??[];}
async function scopeForBatch(db:any,roles:any[],batchId:string){const batch=await db.from("batches").select("id,program_id").eq("id",batchId).maybeSingle();if(!batch.data)return null;const program=await db.from("programs").select("id,client_organization_id").eq("id",batch.data.program_id).maybeSingle();if(!program.data)return null;const client=await db.from("client_organizations").select("id,provider_organization_id").eq("id",program.data.client_organization_id).maybeSingle();if(!client.data)return null;const ok=roles.some((r:any)=>(r.scope_type==="PROVIDER"&&r.provider_organization_id===client.data.provider_organization_id)||(r.scope_type==="CLIENT_ORGANIZATION"&&r.client_organization_id===client.data.id)||(r.scope_type==="PROGRAM"&&r.program_id===program.data.id)||(r.scope_type==="BATCH"&&r.batch_id===batch.data.id));return ok?{client:client.data}:null;}
const clean=(v:any)=>String(v??"").trim();
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers});if(req.method!=="POST")return reply({error:"Method not allowed"},405);
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,""),url=Deno.env.get("SUPABASE_URL")??"",anon=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY")??"",secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??Deno.env.get("SUPABASE_SECRET_KEY")??"";
  if(!token||!url||!anon||!secret)return reply({error:"Authentication or configuration missing"},401);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false}}),user=(await userClient.auth.getUser(token)).data.user;if(!user)return reply({error:"Invalid session"},401);
  const db=createClient(url,secret,{auth:{persistSession:false}}),payload=await req.json().catch(()=>({})),batchId=clean(payload.batch_id),roles=await rolesFor(db,user.id),scope=roles&&batchId?await scopeForBatch(db,roles,batchId):null;
  if(!scope)return reply({error:"Admin access to this batch is required"},403);
  const action=clean(payload.action||"list");
  if(action==="list"){
    const groups=await db.from("groups").select("id,name,external_code,status").eq("batch_id",batchId).is("deleted_at",null).order("name");
    if(groups.error)return reply({error:"Could not load groups"},500);
    const ids=(groups.data??[]).map((g:any)=>g.id),members=ids.length?await db.from("batch_learners").select("group_id").eq("batch_id",batchId).in("group_id",ids):{data:[]};
    if(members.error)return reply({error:"Could not load group member counts"},500);
    const counts=new Map<string,number>();for(const row of members.data??[])counts.set(row.group_id,(counts.get(row.group_id)??0)+1);
    return reply({groups:(groups.data??[]).map((g:any)=>({...g,member_count:counts.get(g.id)??0}))});
  }
  if(action==="create"){
    const name=clean(payload.name).slice(0,120);
    if(!name)return reply({error:"กรุณาระบุชื่อกลุ่ม"},422);
    const existing=await db.from("groups").select("external_code,name").eq("batch_id",batchId).is("deleted_at",null);
    if(existing.error)return reply({error:"ไม่สามารถสร้างรหัสกลุ่มได้"},500);
    if((existing.data??[]).some((row:any)=>String(row.name??"").trim().toLocaleLowerCase()===name.toLocaleLowerCase()))return reply({error:"มีชื่อกลุ่มนี้ใน Batch แล้ว"},422);
    const max=(existing.data??[]).reduce((value:number,row:any)=>{const match=String(row.external_code??"").match(/^GROUP-(\\d+)$/);return match?Math.max(value,Number(match[1])):value;},0);
    const code="GROUP-"+String(max+1).padStart(3,"0");
    const created=await db.from("groups").insert({batch_id:batchId,name,external_code:code,status:"ACTIVE"}).select("id,name").maybeSingle();
    if(created.error)return reply({error:created.error.code==="23505"?"รหัสกลุ่มซ้ำใน Batch นี้":"ไม่สามารถสร้างกลุ่มได้"},422);
    await db.from("audit_events").insert({actor_user_id:user.id,client_organization_id:scope.client.id,batch_id:batchId,event_type:"GROUP_CREATED",target_type:"GROUP",target_id:created.data?.id,after_json:{name,external_code:code},reason:"Created from Admin group management"});
    return reply({saved:true,external_code:code,message:"สร้างกลุ่ม "+code+" เรียบร้อยแล้ว"});
  }
  if(action==="rename"){
    const groupId=clean(payload.group_id),name=clean(payload.name).slice(0,120);if(!groupId||!name)return reply({error:"กรุณาระบุชื่อกลุ่ม"},422);
    const current=await db.from("groups").select("id,name").eq("id",groupId).eq("batch_id",batchId).is("deleted_at",null).maybeSingle();if(!current.data)return reply({error:"ไม่พบกลุ่มที่เลือก"},404);
    const duplicate=await db.from("groups").select("id").eq("batch_id",batchId).is("deleted_at",null).neq("id",groupId).ilike("name",name).limit(1);if(duplicate.error)return reply({error:"ไม่สามารถตรวจสอบชื่อกลุ่มได้"},500);if(duplicate.data?.length)return reply({error:"มีชื่อกลุ่มนี้ใน Batch แล้ว"},422);const updated=await db.from("groups").update({name,updated_at:new Date().toISOString()}).eq("id",groupId).select("id").maybeSingle();if(updated.error)return reply({error:"ไม่สามารถเปลี่ยนชื่อกลุ่มได้"},500);
    await db.from("audit_events").insert({actor_user_id:user.id,client_organization_id:scope.client.id,batch_id:batchId,event_type:"GROUP_RENAMED",target_type:"GROUP",target_id:groupId,before_json:{name:current.data.name},after_json:{name},reason:"Renamed from Admin group management"});
    return reply({saved:true,message:"เปลี่ยนชื่อกลุ่มเรียบร้อยแล้ว"});
  }
  if(action==="archive"){
    const groupId=clean(payload.group_id),group=await db.from("groups").select("id,name").eq("id",groupId).eq("batch_id",batchId).is("deleted_at",null).maybeSingle();if(!group.data)return reply({error:"ไม่พบกลุ่มที่เลือก"},404);
    const members=await db.from("batch_learners").select("id").eq("group_id",groupId).limit(1);if(members.data?.length)return reply({error:"ไม่สามารถปิดกลุ่มที่ยังมีผู้เรียนอยู่ได้ กรุณาย้ายผู้เรียนออกก่อน"},422);
    const archived=await db.from("groups").update({status:"INACTIVE",updated_at:new Date().toISOString()}).eq("id",groupId);if(archived.error)return reply({error:"ไม่สามารถปิดกลุ่มได้"},500);
    await db.from("audit_events").insert({actor_user_id:user.id,client_organization_id:scope.client.id,batch_id:batchId,event_type:"GROUP_ARCHIVED",target_type:"GROUP",target_id:groupId,reason:"Archived empty group from Admin"});
    return reply({saved:true,message:"ปิดกลุ่มเรียบร้อยแล้ว"});
  }
  if(action==="activate"){
    const groupId=clean(payload.group_id),group=await db.from("groups").select("id,name,status").eq("id",groupId).eq("batch_id",batchId).is("deleted_at",null).maybeSingle();
    if(!group.data)return reply({error:"ไม่พบกลุ่มที่เลือก"},404);
    if(group.data.status==="ACTIVE")return reply({saved:true,message:"กลุ่มนี้เปิดใช้งานอยู่แล้ว"});
    const activated=await db.from("groups").update({status:"ACTIVE",updated_at:new Date().toISOString()}).eq("id",groupId);
    if(activated.error)return reply({error:"ไม่สามารถเปิดใช้กลุ่มได้"},500);
    await db.from("audit_events").insert({actor_user_id:user.id,client_organization_id:scope.client.id,batch_id:batchId,event_type:"GROUP_REACTIVATED",target_type:"GROUP",target_id:groupId,before_json:{status:group.data.status},after_json:{status:"ACTIVE"},reason:"Reactivated from Admin group management"});
    return reply({saved:true,message:"เปิดใช้กลุ่ม "+group.data.name+" อีกครั้งเรียบร้อยแล้ว"});
  }
  return reply({error:"Unsupported action"},400);
});