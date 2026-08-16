(() => {
  "use strict";
  const expected = ["topic","question_text","option_a","option_b","option_c","option_d","correct_option","difficulty"];
  let selectedBatchId = "";
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));

  function parseCsv(text) {
    const out = []; let row = [], value = "", quoted = false;
    for (let i = 0, input = String(text).replace(/^\uFEFF/, ""); i < input.length; i += 1) {
      const char = input[i];
      if (char === '"') { if (quoted && input[i + 1] === '"') { value += '"'; i += 1; } else quoted = !quoted; }
      else if (char === "," && !quoted) { row.push(value.trim()); value = ""; }
      else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && input[i + 1] === "\n") i += 1; row.push(value.trim()); value = ""; if (row.some(Boolean)) out.push(row); row = []; }
      else value += char;
    }
    row.push(value.trim()); if (row.some(Boolean)) out.push(row); return out;
  }
  function show(html) { const el = document.getElementById("quizImportResult"); if (el) el.innerHTML = html; }
  async function invoke(action, rows) {
    const client = window.leadershipQuestSupabase; if (!client) throw new Error("โปรดเข้าสู่ระบบใหม่");
    const { data, error } = await client.functions.invoke("import-quiz-bank", { body: { action, batch_id: selectedBatchId, rows } });
    if (error || data?.error) throw new Error(error?.message || data.error); return data;
  }
  async function open() {
    let modal = document.getElementById("quizImportModal");
    if (modal) return modal.classList.remove("hidden");
    modal = document.createElement("div"); modal.id = "quizImportModal"; modal.className = "fixed inset-0 z-50 bg-slate-950/80 backdrop-blur p-4 overflow-y-auto";
    modal.innerHTML = `<div class="max-w-2xl mx-auto my-8 glass-card p-6 rounded-2xl"><div class="flex justify-between"><div><h2 class="text-xl font-bold">นำเข้าคำถาม Quiz Bank</h2><p class="text-sm text-slate-400">เลือก Batch ที่ต้องการนำเข้าคำถาม · รองรับ CSV</p></div><button id="closeQuizImport">✕</button></div><select id="quizImportBatch" class="mt-4 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"></select><a class="mt-3 inline-block text-cyan-300 underline text-sm" href="./templates/quiz-bank-import-template.csv" download>ดาวน์โหลด template</a><input id="quizImportFile" type="file" accept=".csv,text/csv" class="mt-5 block w-full text-sm"/><div id="quizImportResult" class="mt-5 text-sm"></div></div>`;
    document.body.appendChild(modal); document.getElementById("closeQuizImport").onclick = () => modal.classList.add("hidden");
    try {
      const list = await window.leadershipQuestSupabase.functions.invoke("setup-management", { body: { action: "list" } });
      if (list.error || list.data?.error) throw new Error(list.error?.message || list.data?.error || "ไม่สามารถโหลด Batch ได้");
      const batches = list.data?.batches || [], programs = list.data?.programs || [];
      const select = document.getElementById("quizImportBatch");
      select.innerHTML = batches.map((batch) => { const program = programs.find((item) => item.id === batch.program_id); return '<option value="' + batch.id + '">' + escapeHtml((program?.name ? program.name + " · " : "") + batch.name + " · " + batch.external_code) + "</option>"; }).join("");
      selectedBatchId = select.value || "";
      select.onchange = () => { selectedBatchId = select.value; };
      if (!selectedBatchId) show('<p class="text-rose-300">ยังไม่มี Batch ที่คุณมีสิทธิ์จัดการ</p>');
    } catch (error) { show('<p class="text-rose-300">ไม่สามารถโหลด Batch: ' + escapeHtml(error.message || "เกิดข้อผิดพลาด") + "</p>"); }
    document.getElementById("quizImportFile").onchange = async (event) => {
      const file = event.target.files?.[0]; if (!file) return; show("กำลังตรวจสอบไฟล์…");
      try {
        const [header = [], ...data] = parseCsv(await file.text());
        if (expected.some((key, i) => String(header[i] || "").replace(/^\uFEFF/, "") !== key)) throw new Error("หัวตารางไม่ถูกต้อง กรุณาใช้ template");
        const rows = data.filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(expected.map((key, i) => [key, row[i] || ""])));
        const result = await invoke("validate", rows);
        if (!result.valid) return show(`<p class="text-rose-300 font-semibold">พบข้อผิดพลาด ${result.errors.length} รายการ</p><ul class="mt-2 list-disc pl-5">${result.errors.map((e) => `<li>แถว ${e.row}: ${escapeHtml(e.field)} — ${escapeHtml(e.message)}</li>`).join("")}</ul>`);
        show(`<p class="text-emerald-300 font-semibold">ผ่านการตรวจสอบ ${result.valid_rows} ข้อ</p><button id="confirmQuizImport" class="mt-4 rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-950">ยืนยันและเพิ่มคำถาม</button>`);
        document.getElementById("confirmQuizImport").onclick = async () => {
          show("กำลังบันทึก Quiz Bank…");
          const done = await invoke("commit", rows);
          show(`<p class="text-emerald-300 font-semibold">เพิ่มคำถามสำเร็จ ${done.imported_count} ข้อ</p>`);
        };
      } catch (error) { show(`<p class="text-rose-300">ไม่สำเร็จ: ${escapeHtml(error.message || "เกิดข้อผิดพลาด")}</p>`); }
    };
  }
  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.getElementById("nav-admin-quiz"); if (!nav) return;
    nav.addEventListener("click", () => setTimeout(() => {
      if (document.getElementById("quizImportLauncher")) return;
      const button = document.createElement("button"); button.id = "quizImportLauncher";
      button.className = "fixed bottom-5 right-5 z-30 rounded-xl border border-cyan-400 bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-xl";
      button.innerHTML = '<i class="fa-solid fa-file-import mr-2"></i>นำเข้าคำถามจากไฟล์'; button.onclick = open; document.body.appendChild(button);
    }, 0));
  });
})();
