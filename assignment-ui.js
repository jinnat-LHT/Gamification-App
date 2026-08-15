(() => {
  "use strict";
  const MAX_FILES=3, MAX_SIZE=20*1024*1024;
  const escapeHtml=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const modal=()=>{let x=document.getElementById("assignmentModal");if(x)return x;x=document.createElement("div");x.id="assignmentModal";x.className="fixed inset-0 z-50 hidden overflow-y-auto bg-slate-950/85 p-4 backdrop-blur";document.body.appendChild(x);return x;};
  const api=async(body)=>{const c=window.leadershipQuestSupabase;if(!c)throw new Error("กรุณาเข้าสู่ระบบใหม่");const {data,error}=await c.functions.invoke("assignment-submit",{body});if(error||data?.error)throw new Error(error?.message||data.error);return data;};
  async function open(){
    const el=modal();el.classList.remove("hidden");el.innerHTML="<div class='mx-auto my-8 max-w-3xl rounded-2xl border border-cyan-500/40 bg-slate-950 p-6 text-slate-100'>กำลังโหลด Assignment…</div>";
    const c=window.leadershipQuestSupabase, me=window.leadershipQuestLearner;
    if(!c||!me?.batch_id){el.innerHTML="<div class='mx-auto my-8 max-w-xl rounded-2xl bg-slate-950 p-6 text-rose-300'>ไม่พบข้อมูลรุ่นเรียน</div>";return;}
    const {data,error}=await c.from("batch_activity_configs").select("id,activity_key,enabled,gate_state,due_at,config_json").eq("batch_id",me.batch_id).eq("activity_type","ASSIGNMENT").eq("enabled",true).order("activity_key");
    if(error){el.innerHTML="<div class='mx-auto my-8 max-w-xl rounded-2xl bg-slate-950 p-6 text-rose-300'>โหลด Assignment ไม่สำเร็จ</div>";return;}
    const items=(data||[]).filter(x=>x.gate_state==="OPEN");
    el.innerHTML=`<div class="mx-auto my-8 max-w-3xl rounded-2xl border border-cyan-500/40 bg-slate-950 p-6 text-slate-100"><div class="flex items-start justify-between gap-4"><div><h2 class="text-2xl font-bold">Assignment</h2><p class="mt-1 text-sm text-slate-400">พิมพ์คำตอบ และ/หรือ แนบไฟล์ได้ไม่เกิน 3 ไฟล์ (ไฟล์ละ 20 MB)</p></div><button id="closeAssignment" class="text-xl">×</button></div><div id="assignmentBody" class="mt-6"></div></div>`;
    document.getElementById("closeAssignment").onclick=()=>el.classList.add("hidden");
    const body=document.getElementById("assignmentBody");
    if(!items.length){body.innerHTML="<p class='rounded-xl bg-slate-900 p-4 text-slate-400'>ยังไม่มี Assignment ที่เปิดอยู่สำหรับรุ่นนี้</p>";return;}
    body.innerHTML=items.map((x,i)=>`<button data-assignment="${x.id}" class="mb-3 block w-full rounded-xl border border-slate-700 bg-slate-900/80 p-4 text-left hover:border-cyan-400"><div class="font-semibold">${escapeHtml(x.config_json?.title||x.activity_key||`Assignment ${i+1}`)}</div><div class="mt-1 text-xs text-slate-400">${x.due_at?"กำหนดส่ง "+new Date(x.due_at).toLocaleString("th-TH"):"เปิดส่งงาน"}</div></button>`).join("");
    body.querySelectorAll("[data-assignment]").forEach(button=>button.onclick=()=>form(items.find(x=>x.id===button.dataset.assignment)));
  }
  function form(item){
    const body=document.getElementById("assignmentBody");
    body.innerHTML=`<button id="backAssignment" class="mb-4 text-sm text-cyan-300">← รายการ Assignment</button><h3 class="text-xl font-bold">${escapeHtml(item.config_json?.title||item.activity_key)}</h3><p class="mt-2 whitespace-pre-wrap text-sm text-slate-400">${escapeHtml(item.config_json?.instructions||"ส่งคำตอบแบบข้อความ หรือแนบไฟล์ตามโจทย์")}</p><label class="mt-5 block text-sm font-semibold">คำตอบของคุณ</label><textarea id="assignmentText" rows="7" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 p-3" placeholder="พิมพ์คำตอบ (ถ้ามี)"></textarea><label class="mt-4 block text-sm font-semibold">แนบไฟล์</label><input id="assignmentFiles" type="file" multiple class="mt-2 block text-sm"/><p class="mt-1 text-xs text-slate-400">สูงสุด 3 ไฟล์ · ไฟล์ละไม่เกิน 20 MB · ไม่รองรับลิงก์ภายนอก</p><p id="assignmentMessage" class="mt-3 text-sm"></p><button id="submitAssignment" class="mt-4 rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950">ส่งงาน</button>`;
    document.getElementById("backAssignment").onclick=open;
    document.getElementById("submitAssignment").onclick=async()=>{
      const button=document.getElementById("submitAssignment"), message=document.getElementById("assignmentMessage");
      const text=document.getElementById("assignmentText").value.trim(), files=[...document.getElementById("assignmentFiles").files];
      if(!text&&!files.length){message.textContent="พิมพ์คำตอบหรือเลือกไฟล์อย่างน้อย 1 รายการ";message.className="mt-3 text-sm text-amber-300";return;}
      if(files.length>MAX_FILES||files.some(f=>f.size>MAX_SIZE)){message.textContent="เลือกได้สูงสุด 3 ไฟล์ และไฟล์ละไม่เกิน 20 MB";message.className="mt-3 text-sm text-rose-300";return;}
      button.disabled=true;message.textContent="กำลังเตรียมส่งงาน…";message.className="mt-3 text-sm text-cyan-300";
      try{
        const prepared=await api({action:"prepare",activity_config_id:item.id,files:files.map(f=>({name:f.name,size:f.size,type:f.type}))});
        for(let i=0;i<files.length;i++){message.textContent=`กำลังอัปโหลดไฟล์ ${i+1}/${files.length}…`;const u=prepared.uploads[i];const result=await window.leadershipQuestSupabase.storage.from("assignment-submissions").uploadToSignedUrl(u.path,u.token,files[i],{contentType:files[i].type||"application/octet-stream"});if(result.error)throw result.error;}
        await api({action:"submit",activity_config_id:item.id,text_response:text,files:files.map((f,i)=>({storage_key:prepared.uploads[i].path,original_filename:f.name,mime_type:f.type||"application/octet-stream",size_bytes:f.size}))});
        body.innerHTML="<div class='rounded-xl bg-emerald-500/10 p-5 text-emerald-300'><div class='text-xl font-bold'>ส่งงานเรียบร้อย</div><p class='mt-2 text-sm'>Facilitator จะตรวจและส่ง feedback ผ่านระบบ</p></div>";
      }catch(error){message.textContent=error.message||"ส่งงานไม่สำเร็จ";message.className="mt-3 text-sm text-rose-300";button.disabled=false;}
    };
  }
  document.addEventListener("DOMContentLoaded",()=>document.getElementById("nav-assignments")?.addEventListener("click",()=>setTimeout(open,0)));
})();