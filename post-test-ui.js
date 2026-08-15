(() => {
  "use strict";
  let test = null, answers = {};

  const escapeHtml = (v) => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  async function api(body) {
    const client = window.leadershipQuestSupabase;
    if (!client) throw new Error("กรุณาเข้าสู่ระบบใหม่");
    const { data, error } = await client.functions.invoke("post-test", { body });
    if (error || data?.error) throw new Error(error?.message || data.error);
    return data;
  }
  function modal() {
    let el=document.getElementById("postTestModal");
    if(el) return el;
    el=document.createElement("div"); el.id="postTestModal"; el.className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur p-4 overflow-y-auto hidden";
    document.body.appendChild(el); return el;
  }
  function render() {
    const el=modal();
    el.innerHTML=`<div class="max-w-3xl mx-auto my-6 glass-card p-6 rounded-2xl"><div class="flex justify-between"><div><h2 class="text-2xl font-bold">Post-test</h2><p class="text-sm text-slate-400">ผ่านที่ 80% · ทำใหม่ได้จนกว่าจะผ่าน</p></div><button id="closePostTest">✕</button></div><div id="postTestBody" class="mt-6"></div></div>`;
    document.getElementById("closePostTest").onclick=()=>el.classList.add("hidden");
    const body=document.getElementById("postTestBody");
    if(test.locked){body.innerHTML="<p class='text-emerald-300 font-semibold'>คุณผ่าน Post-test แล้ว ระบบบันทึกผลการผ่านไว้เรียบร้อย</p>";return;}
    body.innerHTML=test.questions.map((q,index)=>`<section class="mb-6 rounded-xl bg-slate-900/70 p-4"><p class="font-semibold">${index+1}. ${escapeHtml(q.question_text)}</p><div class="mt-3 grid gap-2">${Object.entries(q.options).map(([key,value])=>`<label class="cursor-pointer rounded-lg border border-slate-700 p-3 hover:border-cyan-400"><input type="radio" name="q_${q.id}" value="${key}" class="mr-2"> ${key}. ${escapeHtml(value)}</label>`).join("")}</div></section>`).join("")+`<button id="submitPostTest" class="rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950">ส่งคำตอบ</button>`;
    test.questions.forEach(q=>document.querySelectorAll(`input[name="q_${q.id}"]`).forEach(i=>i.onchange=()=>answers[q.id]=i.value));
    document.getElementById("submitPostTest").onclick=submit;
  }
  async function submit(){
    if(Object.keys(answers).length!==test.questions.length) return alert("กรุณาตอบให้ครบทุกข้อ");
    const body=document.getElementById("postTestBody");body.innerHTML="กำลังตรวจคำตอบ…";
    try{const result=await api({action:"submit",answers});body.innerHTML=result.passed?`<p class="text-emerald-300 text-xl font-bold">ผ่านแล้ว: ${result.score_percent}%</p><p class="mt-2 text-slate-400">ระบบล็อกผลการผ่านเรียบร้อย</p>`:`<p class="text-amber-300 text-xl font-bold">ได้ ${result.score_percent}%</p><p class="mt-2">ยังไม่ผ่านเกณฑ์ 80% คุณสามารถทำใหม่ได้</p><button id="retest" class="mt-4 rounded-xl bg-cyan-500 px-4 py-2 font-bold text-slate-950">ทำใหม่</button>`;document.getElementById("retest")?.addEventListener("click",open);}catch(e){body.innerHTML=`<p class="text-rose-300">${escapeHtml(e.message)}</p>`;}
  }
  async function open(){
    const el=modal();el.classList.remove("hidden");el.innerHTML="<div class='max-w-3xl mx-auto my-6 glass-card p-6 rounded-2xl'>กำลังเตรียม Post-test…</div>";
    try{const result=await api({action:"start"});if(result.locked){test={locked:true};}else{test=result;answers={};}render();}catch(e){el.innerHTML=`<div class='max-w-xl mx-auto my-6 glass-card p-6 rounded-2xl text-rose-300'>${escapeHtml(e.message)}</div>`;}
  }
  document.addEventListener("DOMContentLoaded",()=>document.getElementById("nav-tests")?.addEventListener("click",()=>setTimeout(open,0)));
})();
