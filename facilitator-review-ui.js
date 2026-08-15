(() => {
  "use strict";
  const escapeHtml=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const api=async(body)=>{const c=window.leadershipQuestSupabase;if(!c)throw new Error("กรุณาเข้าสู่ระบบใหม่");const {data,error}=await c.functions.invoke("assignment-review",{body});if(error||data?.error)throw new Error(error?.message||data.error);return data;};
  const modal=()=>{let x=document.getElementById("assignmentReviewModal");if(x)return x;x=document.createElement("div");x.id="assignmentReviewModal";x.className="fixed inset-0 z-50 hidden overflow-y-auto bg-slate-950/85 p-4 backdrop-blur";document.body.appendChild(x);return x;};
  async function open(){
    const el=modal();el.classList.remove("hidden");el.innerHTML="<div class='mx-auto my-8 max-w-4xl rounded-2xl border border-violet-500/40 bg-slate-950 p-6 text-slate-100'>กำลังโหลดคิวตรวจงาน…</div>";
    const c=window.leadershipQuestSupabase;const {data:batches,error}=await c.from("batches").select("id,name,external_code").order("created_at",{ascending:false});
    if(error||!batches?.length){el.innerHTML="<div class='mx-auto my-8 max-w-xl rounded-2xl bg-slate-950 p-6 text-amber-300'>ยังไม่มีรุ่นที่คุณมีสิทธิ์ตรวจงาน</div>";return;}
    const choices=batches.map(b=>`<option value="${b.id}">${escapeHtml(b.name||b.external_code)}</option>`).join("");
    el.innerHTML=`<div class="mx-auto my-8 max-w-4xl rounded-2xl border border-violet-500/40 bg-slate-950 p-6 text-slate-100"><div class="flex justify-between gap-4"><div><h2 class="text-2xl font-bold">ตรวจ Assignment</h2><p class="text-sm text-slate-400">ส่ง feedback หรือขอให้ผู้เรียนแก้ไขได้</p></div><button id="closeReview">×</button></div><select id="reviewBatch" class="mt-5 rounded-lg border border-slate-700 bg-slate-900 p-2">${choices}</select><div id="reviewBody" class="mt-5"></div></div>`;
    document.getElementById("closeReview").onclick=()=>el.classList.add("hidden");
    document.getElementById("reviewBatch").onchange=load;
    await load();
  }
  async function load(){
    const body=document.getElementById("reviewBody"), batchId=document.getElementById("reviewBatch").value;body.innerHTML="กำลังโหลด…";
    try{const result=await api({action:"list",batch_id:batchId});const items=result.items||[];
      body.innerHTML=items.length?items.map(x=>`<article class="mb-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4"><div class="flex flex-wrap justify-between gap-3"><div><div class="font-bold">${escapeHtml(x.learner?.display_name||x.learner?.email||"ผู้เรียน")}</div><div class="text-xs text-slate-400">${escapeHtml(x.activity_key)} · ส่ง ${x.submitted_at?new Date(x.submitted_at).toLocaleString("th-TH"):"-"}</div></div><span class="rounded-full px-2 py-1 text-xs ${x.status==="NEEDS_REVISION"?"bg-amber-500/20 text-amber-300":"bg-cyan-500/20 text-cyan-300"}">${escapeHtml(x.status)}</span></div><div class="mt-3 whitespace-pre-wrap rounded-lg bg-slate-950/70 p-3 text-sm">${escapeHtml(x.text_response||"(ไม่ได้พิมพ์คำตอบ)")}</div>${x.files?.length?`<div class="mt-3 text-sm">${x.files.map(f=>f.signed_url?`<a class="mr-3 text-cyan-300 underline" href="${f.signed_url}" target="_blank" rel="noopener">${escapeHtml(f.original_filename)}</a>`:escapeHtml(f.original_filename)).join("")}</div>`:""}${x.feedback?`<div class="mt-3 text-sm text-emerald-300">Feedback ล่าสุด: ${escapeHtml(x.feedback.feedback_text||x.feedback.status)}</div>`:""}<textarea id="feedback-${x.id}" class="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm" rows="3" placeholder="Feedback ถึงผู้เรียน"></textarea><div class="mt-3 flex gap-2"><button data-review="${x.id}" data-status="REVIEWED" class="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950">ตรวจแล้ว</button><button data-review="${x.id}" data-status="NEEDS_REVISION" class="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-950">ให้แก้ไข</button></div></article>`).join(""):"<p class='rounded-xl bg-slate-900 p-4 text-slate-400'>ยังไม่มีงานในคิวตรวจ</p>";
      body.querySelectorAll("[data-review]").forEach(btn=>btn.onclick=async()=>{btn.disabled=true;try{await api({action:"review",batch_id:batchId,submission_id:btn.dataset.review,status:btn.dataset.status,feedback_text:document.getElementById("feedback-"+btn.dataset.review).value.trim()});await load();}catch(e){alert(e.message);btn.disabled=false;}});
    }catch(e){body.innerHTML=`<p class="text-rose-300">${escapeHtml(e.message)}</p>`;}
  }
  function mount(){
    if(document.getElementById("assignmentReviewButton"))return;
    const a=window.leadershipQuestAccount;if(!a||!["ADMIN","FACILITATOR"].includes(a.account_type))return;
    const b=document.createElement("button");b.id="assignmentReviewButton";b.className="fixed bottom-5 right-5 z-40 rounded-full bg-violet-500 px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-violet-400";b.textContent="ตรวจ Assignment";b.onclick=open;document.body.appendChild(b);
  }
  document.addEventListener("DOMContentLoaded",()=>setInterval(mount,400));
})();