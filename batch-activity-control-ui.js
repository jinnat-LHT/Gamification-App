(() => {
  "use strict";
  const label={PRE_TEST:"Pre-test",POST_TEST:"Post-test",SELF_BEFORE:"Self-assessment ก่อนเรียน",SELF_AFTER:"Self-assessment หลังเรียน",PEER_REVIEW:"Peer review",ASSIGNMENT:"Assignment"};
  const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const api=async body=>{const {data,error}=await window.leadershipQuestSupabase.functions.invoke("batch-activity-admin",{body});if(error||data?.error)throw new Error(error?.message||data.error);return data;};
  const modal=()=>{let e=document.getElementById("activityControlModal");if(e)return e;e=document.createElement("div");e.id="activityControlModal";e.className="fixed inset-0 z-50 hidden overflow-y-auto bg-slate-950/85 p-4 backdrop-blur";document.body.appendChild(e);return e;};
  async function open(){
    const el=modal();el.classList.remove("hidden");el.innerHTML="<div class='mx-auto my-8 max-w-3xl rounded-2xl border border-cyan-500/40 bg-slate-950 p-6 text-slate-100'>กำลังโหลดการตั้งค่ากิจกรรม…</div>";
    const {data:batches,error}=await window.leadershipQuestSupabase.from("batches").select("id,name,external_code").order("created_at",{ascending:false});
    if(error||!batches?.length){el.innerHTML="<div class='mx-auto my-8 max-w-xl rounded-2xl bg-slate-950 p-6 text-amber-300'>ยังไม่มี Batch ที่คุณมีสิทธิ์จัดการ</div>";return;}
    el.innerHTML=`<div class="mx-auto my-8 max-w-3xl rounded-2xl border border-cyan-500/40 bg-slate-950 p-6 text-slate-100"><div class="flex justify-between"><div><h2 class="text-2xl font-bold">เปิด/ปิดกิจกรรมใน Batch</h2><p class="text-sm text-slate-400">ปิดกิจกรรมเพื่อซ่อนจากผู้เรียน หรือเปิดและกำหนดสถานะพร้อมใช้งาน</p></div><button id="closeActivityControl">×</button></div><select id="activityBatch" class="mt-5 rounded-lg border border-slate-700 bg-slate-900 p-2">${batches.map(b=>`<option value="${b.id}">${escapeHtml(b.name||b.external_code)}</option>`).join("")}</select><div id="activityControlBody" class="mt-5"></div></div>`;
    document.getElementById("closeActivityControl").onclick=()=>el.classList.add("hidden");document.getElementById("activityBatch").onchange=load;await load();
  }
  async function load(){
    const body=document.getElementById("activityControlBody"),batchId=document.getElementById("activityBatch").value;body.innerHTML="กำลังโหลด…";
    try{
      const r=await api({action:"list",batch_id:batchId});const items=r.items||[];
      body.innerHTML=(items.map(x=>`<div class="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4"><div><div class="font-semibold">${escapeHtml(x.config_json?.title||label[x.activity_type]||x.activity_key)}</div><div class="text-xs text-slate-400">${escapeHtml(x.activity_key)}</div></div><div class="flex items-center gap-2"><label class="text-xs"><input data-enabled="${x.id}" type="checkbox" ${x.enabled?"checked":""}> เปิดใช้</label><select data-gate="${x.id}" class="rounded bg-slate-800 p-2 text-xs"><option value="OPEN" ${x.gate_state==="OPEN"?"selected":""}>เปิดรับ</option><option value="LOCKED" ${x.gate_state==="LOCKED"?"selected":""}>ล็อก</option></select></div></div>`).join("")||"<p class='text-slate-400'>ไม่มีการตั้งค่ากิจกรรม</p>")+ `<div class="sticky bottom-0 mt-5 border-t border-slate-800 bg-slate-950/95 pt-4"><p id="activitySaveMessage" class="mb-2 text-sm"></p><button id="saveAllActivities" class="rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950">บันทึกการเปลี่ยนแปลงทั้งหมด</button></div>`;
      document.getElementById("saveAllActivities").onclick=async()=>{
        const button=document.getElementById("saveAllActivities"),note=document.getElementById("activitySaveMessage");button.disabled=true;note.className="mb-2 text-sm text-cyan-300";note.textContent="กำลังบันทึก…";
        try{
          for(const item of items){
            await api({action:"update",batch_id:batchId,activity_config_id:item.id,enabled:body.querySelector(`[data-enabled='${item.id}']`).checked,gate_state:body.querySelector(`[data-gate='${item.id}']`).value});
          }
          note.className="mb-2 text-sm text-emerald-300";note.textContent="บันทึกการตั้งค่าทั้งหมดแล้ว";
          setTimeout(load,700);
        }catch(e){note.className="mb-2 text-sm text-rose-300";note.textContent=e.message;button.disabled=false;}
      };
    }catch(e){body.innerHTML=`<p class="text-rose-300">${escapeHtml(e.message)}</p>`;}
  }
  function mount(){if(document.getElementById("activityControlButton")||window.leadershipQuestAccount?.account_type!=="ADMIN")return;const b=document.createElement("button");b.id="activityControlButton";b.className="fixed bottom-5 left-5 z-40 rounded-full bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg";b.textContent="จัดการกิจกรรม";b.onclick=open;document.body.appendChild(b);}
  document.addEventListener("DOMContentLoaded",()=>setInterval(mount,400));
})();