(()=>{
  const css=`.sar-modal{position:fixed;z-index:1000;inset:0;background:#020617e8;overflow:auto;padding:25px;color:#e2e8f0}.sar-panel{max-width:1040px;margin:auto;background:#0f172a;border:1px solid #334155;border-radius:20px;padding:28px}.sar-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.sar-top h2{margin:0;font-size:27px}.sar-top p{color:#94a3b8}.sar-select{padding:10px;background:#111c33;border:1px solid #475569;border-radius:9px;color:#fff;min-width:280px}.sar-btn{border:0;border-radius:10px;padding:11px 16px;font-weight:800;cursor:pointer;background:#06b6d4;color:#082f49;margin:8px 8px 8px 0}.sar-btn.alt{background:#172554;color:#bae6fd;border:1px solid #334155}.sar-btn.pdf{background:linear-gradient(90deg,#8b5cf6,#ec4899);color:#fff}.sar-close{background:#1e293b;color:#fff}.sar-summary{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.sar-pill{padding:10px 14px;border-radius:10px;background:#172554;color:#bfdbfe}.sar-table{width:100%;border-collapse:collapse;margin-top:16px}.sar-table th,.sar-table td{padding:12px;border-bottom:1px solid #334155;text-align:left}.sar-table th{color:#94a3b8;font-size:13px}.sar-empty{padding:30px;background:#111827;border-radius:14px;color:#94a3b8;margin-top:15px}.sar-export{padding:18px;margin:18px 0;background:linear-gradient(110deg,#102c46,#182547);border:1px solid #0e7490;border-radius:14px}.sar-export strong{display:block;font-size:17px;color:#e0f2fe}.sar-export p{margin:6px 0;color:#94a3b8}@media(max-width:650px){.sar-modal{padding:8px}.sar-panel{padding:18px}.sar-table{font-size:13px}.sar-table th,.sar-table td{padding:8px}}`;
  const style=document.createElement("style");style.textContent=css;document.head.append(style);
  let chart=null;
  const esc=value=>String(value??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&#39;"}[c]));
  const call=async body=>{const r=await window.leadershipQuestSupabase.functions.invoke("self-assessment-report",{body});if(r.error){let m=r.error.message;try{m=(await r.error.context?.json?.())?.error||m;}catch(_e){}throw new Error(m);}if(r.data?.error)throw new Error(r.data.error);return r.data;};
  const callExport=async body=>{const r=await window.leadershipQuestSupabase.functions.invoke("cohort-export-report",{body});if(r.error){let m=r.error.message;try{m=(await r.error.context?.json?.())?.error||m;}catch(_e){}throw new Error(m);}if(r.data?.error)throw new Error(r.data.error);return r.data;};
  function close(root){if(chart){chart.destroy();chart=null;}root.remove();}
  function render(root,data){const host=root.querySelector("#sar-result");if(!data.rows?.some(row=>row.before!=null||row.after!=null)){host.innerHTML='<div class="sar-empty">ยังไม่มีผู้ตอบแบบประเมินใน Batch นี้</div>';return;}host.innerHTML='<div class="sar-summary"><span class="sar-pill">Before: '+(data.rows[0]?.before_count||0)+' ผู้ตอบ</span><span class="sar-pill">After: '+(data.rows[0]?.after_count||0)+' ผู้ตอบ</span></div><div style="height:320px"><canvas id="sar-chart"></canvas></div><table class="sar-table"><thead><tr><th>เกณฑ์</th><th>Before เฉลี่ย</th><th>After เฉลี่ย</th><th>ผลต่าง</th></tr></thead><tbody>'+data.rows.map(row=>'<tr><td>'+esc(row.title)+'</td><td>'+(row.before??"—")+'</td><td>'+(row.after??"—")+'</td><td style="color:'+(row.difference>0?"#6ee7b7":"#cbd5e1")+'">'+(row.difference==null?"—":(row.difference>0?"+":"")+row.difference)+'</td></tr>').join("")+'</tbody></table>';if(window.Chart){chart=new Chart(root.querySelector("#sar-chart"),{type:"radar",data:{labels:data.rows.map(r=>r.title),datasets:[{label:"Before",data:data.rows.map(r=>r.before??0),backgroundColor:"rgba(8,145,178,.22)",borderColor:"#22d3ee",pointBackgroundColor:"#22d3ee",borderWidth:2},{label:"After",data:data.rows.map(r=>r.after??0),backgroundColor:"rgba(147,51,234,.22)",borderColor:"#c084fc",pointBackgroundColor:"#c084fc",borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,scales:{r:{min:0,max:5,ticks:{stepSize:1,color:"#cbd5e1",backdropColor:"transparent"},angleLines:{color:"#334155"},grid:{color:"#334155"},pointLabels:{color:"#e2e8f0",font:{size:13}}}},plugins:{legend:{labels:{color:"#e2e8f0"}}}}});}}
  const csvValue=value=>'"'+String(value??"").replace(/"/g,'""')+'"';
  function downloadCsv(data){
    const o=data.overview||{}, lines=[];
    const row=(values=[])=>lines.push(values.map(csvValue).join(","));
    row(["Leadership Quest - รายงาน Cohort รวม"]);
    row(["Batch",data.batch?.name||"",data.batch?.external_code||""]);
    row(["สร้างรายงานเมื่อ",new Date(data.generated_at).toLocaleString("th-TH")]);row([]);
    row(["ภาพรวม", "ค่า"]);
    row(["จำนวนผู้เรียน",o.learner_count]);row(["ผู้เรียนสถานะ Active",o.active_learners]);row(["จำนวนครั้งเข้าเรียน",o.attendance_sessions]);row(["อัตราเข้าเรียน (%)",o.attendance_present_rate]);row(["คะแนน Pre-test เฉลี่ย (%)",o.pre_test_average]);row(["คะแนน Post-test เฉลี่ย (%)",o.post_test_average]);row(["Self-assessment Before เฉลี่ย",o.self_before_average]);row(["Self-assessment After เฉลี่ย",o.self_after_average]);row(["XP รวม",o.total_xp]);row([]);
    row(["Self-assessment รายเกณฑ์","Before","After","ผลต่าง","จำนวน Before","จำนวน After"]);
    (data.self_assessment?.criteria||[]).forEach(item=>row([item.title,item.before,item.after,item.difference,item.before_count,item.after_count]));row([]);
    row(["รายชื่อผู้เรียน","อีเมล","กลุ่ม","สถานะ","อันดับ","XP","Pre-test (%)","Post-test (%)","Self ก่อน","Self หลัง","งานส่ง","งานตรวจแล้ว","ต้องแก้","เข้าเรียน","จำนวนครั้งทั้งหมด"]);
    (data.learners||[]).forEach(item=>row([item.learner_name,item.email,item.group_name,item.enrollment_status,item.rank,item.xp,item.pre_test,item.post_test,item.self_before,item.self_after,item.assignments_submitted,item.assignments_reviewed,item.assignments_needs_revision,item.attendance_present,item.attendance_total]));
    const blob=new Blob(["\ufeff"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=(data.batch?.external_code||"cohort")+"_report.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function radarSvg(criteria){
    const vals=criteria||[],cx=235,cy=210,r=125,n=Math.max(vals.length,3);
    const point=(i,ratio)=>{const a=(-Math.PI/2)+(Math.PI*2*i/n);return (cx+Math.cos(a)*r*ratio).toFixed(1)+","+(cy+Math.sin(a)*r*ratio).toFixed(1);};
    const polygon=ratio=>Array.from({length:n},(_,i)=>point(i,ratio)).join(" ");
    const series=key=>vals.map((x,i)=>point(i,Number(x[key]||0)/5)).join(" ");
    const labels=vals.map((x,i)=>{const a=(-Math.PI/2)+(Math.PI*2*i/n),lx=cx+Math.cos(a)*(r+36),ly=cy+Math.sin(a)*(r+36);return '<text x="'+lx.toFixed(1)+'" y="'+ly.toFixed(1)+'" fill="#dbeafe" font-size="12" text-anchor="middle">'+esc(x.title).slice(0,22)+'</text>';}).join("");
    return '<svg viewBox="0 0 470 420" width="100%" height="350" role="img"><g fill="none" stroke="#384b70">'+[.2,.4,.6,.8,1].map(v=>'<polygon points="'+polygon(v)+'"/>').join("")+'</g><polygon points="'+series("before")+'" fill="rgba(34,211,238,.22)" stroke="#22d3ee" stroke-width="3"/><polygon points="'+series("after")+'" fill="rgba(192,132,252,.2)" stroke="#c084fc" stroke-width="3"/>'+labels+'</svg>';
  }
  function printPdf(data, win){
    if(!win) throw new Error("เบราว์เซอร์บล็อกหน้าต่าง PDF กรุณาอนุญาต Pop-up แล้วลองใหม่");
    const o=data.overview||{}, criteria=data.self_assessment?.criteria||[];
    const stat=(label,value,accent)=>'<div class="stat"><span>'+esc(label)+'</span><b style="color:'+accent+'">'+esc(value??"—")+'</b></div>';
    const learnerRows=(data.learners||[]).map(x=>'<tr><td>'+x.rank+'</td><td><b>'+esc(x.learner_name)+'</b><small>'+esc(x.email)+'</small></td><td>'+esc(x.group_name||"—")+'</td><td>'+esc(x.pre_test??"—")+'</td><td>'+esc(x.post_test??"—")+'</td><td>'+esc(x.self_before??"—")+'</td><td>'+esc(x.self_after??"—")+'</td><td>'+x.assignments_reviewed+'/'+x.assignments_submitted+'</td><td>'+x.attendance_present+'/'+x.attendance_total+'</td><td>'+x.xp+'</td></tr>').join("");
    const criteriaRows=criteria.map(x=>'<tr><td>'+esc(x.title)+'</td><td>'+esc(x.before??"—")+'</td><td>'+esc(x.after??"—")+'</td><td>'+esc(x.difference==null?"—":(x.difference>0?"+":"")+x.difference)+'</td></tr>').join("");
    const html='<!doctype html><html><head><meta charset="utf-8"><title>Leadership Quest Cohort Report</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,"Noto Sans Thai",sans-serif;background:#071322;color:#e8f1ff;margin:0;padding:28px}.hero{padding:28px;border-radius:22px;background:linear-gradient(125deg,#0d3850,#12234a 58%,#32165e);border:1px solid #22d3ee}.eyebrow{color:#67e8f9;font-weight:bold;letter-spacing:1px}.hero h1{margin:8px 0 4px;font-size:30px}.hero p{margin:0;color:#b7c8e8}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.stat{background:#101f3b;border:1px solid #284566;border-radius:14px;padding:16px}.stat span{display:block;color:#a6b8d7;font-size:12px}.stat b{font-size:24px;display:block;margin-top:6px}.section{margin-top:18px;padding:22px;border:1px solid #294563;border-radius:18px;background:#0d1a31}.section h2{margin:0 0 5px;font-size:20px}.muted{color:#a6b8d7;margin:0 0 12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.legend{font-size:13px;color:#bcd1f0;text-align:center}.legend i{display:inline-block;width:12px;height:12px;margin:0 5px;border-radius:2px;background:#22d3ee}.legend i.after{background:#c084fc}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#1a2d4d;color:#bdefff;text-align:left}th,td{padding:9px;border-bottom:1px solid #263d5a;vertical-align:top}small{display:block;color:#9ab0cf;margin-top:2px}.foot{color:#a6b8d7;font-size:11px;margin:18px 0 0;text-align:right}@media print{body{background:#071322;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><section class="hero"><div class="eyebrow">LEADERSHIP QUEST · COHORT REPORT</div><h1>'+esc(data.batch?.name)+'</h1><p>รหัสรุ่น '+esc(data.batch?.external_code)+' · สรุปผลการเรียนรู้และ Gamification ทั้งรุ่น</p></section><section class="stats">'+stat("ผู้เรียนทั้งหมด",o.learner_count,"#67e8f9")+stat("Pre-test เฉลี่ย",o.pre_test_average==null?"—":o.pre_test_average+"%","#fbbf24")+stat("Post-test เฉลี่ย",o.post_test_average==null?"—":o.post_test_average+"%","#6ee7b7")+stat("XP รวม",o.total_xp,"#c084fc")+'</section><section class="section"><h2>Self-assessment: Before vs After</h2><p class="muted">ค่าเฉลี่ย 1-5 ของผู้ตอบแบบประเมินในรุ่น</p><div class="grid"><div>'+radarSvg(criteria)+'<div class="legend"><i></i> BEFORE &nbsp;&nbsp; <i class="after"></i> AFTER</div></div><table><thead><tr><th>เกณฑ์</th><th>Before</th><th>After</th><th>ผลต่าง</th></tr></thead><tbody>'+criteriaRows+'</tbody></table></div></section><section class="section"><h2>รายละเอียดผู้เรียน</h2><p class="muted">งานตรวจแล้ว / งานที่ส่ง · เข้าเรียน (ครั้ง)</p><table><thead><tr><th>#</th><th>ผู้เรียน</th><th>กลุ่ม</th><th>Pre</th><th>Post</th><th>Self Before</th><th>Self After</th><th>งาน</th><th>เข้าเรียน</th><th>XP</th></tr></thead><tbody>'+learnerRows+'</tbody></table></section><p class="foot">สร้างรายงานเมื่อ '+esc(new Date(data.generated_at).toLocaleString("th-TH"))+'</p><script>setTimeout(function(){window.print();},350)<\/script></body></html>';
    win.document.open();win.document.write(html);win.document.close();
  }
  async function exportReport(root,kind){
    const select=root.querySelector("#sar-batch"),host=root.querySelector("#sar-result");
    let pdfWindow=null;
    try{
      if(kind==="pdf"){
        pdfWindow=window.open("","_blank","width=1200,height=900");
        if(!pdfWindow) throw new Error("เบราว์เซอร์บล็อกหน้าต่าง PDF กรุณาอนุญาต Pop-up แล้วลองใหม่");
        pdfWindow.document.write('<!doctype html><title>กำลังสร้าง PDF</title><body style="font-family:Arial;background:#071322;color:#e2e8f0;padding:32px">กำลังสร้างรายงาน PDF...</body>');
        pdfWindow.document.close();
      }
      host.innerHTML='<div class="sar-empty">กำลังสร้างรายงานรวม...</div>';
      const data=await callExport({batch_id:select.value});
      if(kind==="pdf") printPdf(data,pdfWindow); else downloadCsv(data);
      host.innerHTML='<div class="sar-empty" style="color:#6ee7b7">สร้างรายงานเรียบร้อยแล้ว</div>';
    }catch(e){
      if(pdfWindow&&!pdfWindow.closed) pdfWindow.close();
      host.innerHTML='<div class="sar-empty">'+esc(e.message)+'</div>';
    }
  }
  async function open(){
    const root=document.createElement("div");root.className="sar-modal";
    root.innerHTML='<main class="sar-panel"><div class="sar-top"><div><h2>รายงาน Cohort</h2><p>ดูค่าเฉลี่ย Self-assessment และดาวน์โหลดรายงานผลทั้งรุ่น</p></div><button class="sar-btn sar-close">ปิด</button></div><select id="sar-batch" class="sar-select"></select><div><button id="sar-load" class="sar-btn">ดู Self-assessment</button></div><section class="sar-export"><strong>รายงานรวมทั้งรุ่น</strong><p>ผู้เรียน · Pre/Post-test · Self-assessment · Assignment · Attendance · XP และ Ranking</p><button id="sar-csv" class="sar-btn alt">ดาวน์โหลด CSV สำหรับ Excel</button><button id="sar-pdf" class="sar-btn pdf">บันทึก PDF สไตล์ Dashboard</button></section><div id="sar-result"></div></main>';
    document.body.append(root);root.querySelector(".sar-close").onclick=()=>close(root);
    const select=root.querySelector("#sar-batch"),res=await window.leadershipQuestSupabase.from("batches").select("id,name,external_code").order("created_at");
    if(res.error){root.querySelector("#sar-result").textContent=res.error.message;return;}
    select.innerHTML=(res.data||[]).map(b=>'<option value="'+b.id+'">'+esc(b.name)+(b.external_code?" · "+esc(b.external_code):"")+'</option>').join("");
    root.querySelector("#sar-load").onclick=async()=>{const h=root.querySelector("#sar-result");h.innerHTML='<div class="sar-empty">กำลังคำนวณรายงาน...</div>';try{render(root,await call({batch_id:select.value}));}catch(e){h.innerHTML='<div class="sar-empty">'+esc(e.message)+'</div>';}};
    root.querySelector("#sar-csv").onclick=()=>exportReport(root,"csv");
    root.querySelector("#sar-pdf").onclick=()=>exportReport(root,"pdf");
  }
  function boot(){const nav=document.getElementById("nav-admin-reports");if(!nav||nav.dataset.sar)return;nav.dataset.sar="1";nav.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();open();},true);}
  document.addEventListener("DOMContentLoaded",()=>setTimeout(boot,900));setTimeout(boot,1800);
})();