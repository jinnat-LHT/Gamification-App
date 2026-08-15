(() => {
  const parseCsv = (text) => text.trim().split(/\r?\n/).map(line => line.split(",").map(v => v.trim().replace(/^"|"$/g, "")));
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function openModal() {
    let modal = document.getElementById("rosterImportModal");
    if (modal) return modal.classList.remove("hidden");
    modal = document.createElement("div");
    modal.id = "rosterImportModal";
    modal.className = "fixed inset-0 z-50 bg-slate-950/80 backdrop-blur p-4 overflow-y-auto";
    modal.innerHTML = `<div class="max-w-2xl mx-auto my-8 glass-card p-6 rounded-2xl">
      <div class="flex justify-between gap-4"><div><h2 class="text-xl font-bold">นำเข้าผู้เรียน</h2><p class="text-sm text-slate-400">CSV columns: email, display_name, employee_code, group_code</p></div><button id="closeRosterImport" class="text-slate-300">✕</button></div>
      <input id="rosterFile" type="file" accept=".csv,text/csv" class="mt-5 block w-full text-sm" />
      <div id="rosterResult" class="mt-5 text-sm text-slate-300"></div>
    </div>`;
    document.body.appendChild(modal);
    document.getElementById("closeRosterImport").onclick = () => modal.classList.add("hidden");
    document.getElementById("rosterFile").onchange = async (event) => {
      const file = event.target.files?.[0]; if (!file) return;
      const result = document.getElementById("rosterResult");
      result.textContent = "กำลังตรวจสอบไฟล์…";
      const rows = parseCsv(await file.text());
      const [header, ...data] = rows;
      const expected = ["email","display_name","employee_code","group_code"];
      if (expected.some((key, index) => header?.[index] !== key)) {
        result.textContent = "หัวตารางไม่ถูกต้อง กรุณาใช้ template ที่กำหนด"; return;
      }
      const payloadRows = data.filter(r => r.some(Boolean)).map(r => Object.fromEntries(expected.map((key, i) => [key, r[i] || ""])));
      const client = window.leadershipQuestSupabase;
      if (!client) { result.textContent = "โปรดเข้าสู่ระบบใหม่ก่อนนำเข้า"; return; }
      const { data, error } = await client.functions.invoke("import-roster", { body: { batch_code: "LDP-001", rows: payloadRows } });
      if (error) { result.textContent = "ตรวจสอบไม่สำเร็จ: " + error.message; return; }
      if (!data.valid) {
        result.innerHTML = `<p class="text-rose-300 font-semibold">พบข้อผิดพลาด ${data.errors.length} รายการ</p><ul class="mt-2 list-disc pl-5">${data.errors.map(e => `<li>แถว ${e.row}: ${escapeHtml(e.field)} — ${escapeHtml(e.message)}</li>`).join("")}</ul>`;
      } else {
        result.innerHTML = `<p class="text-emerald-300 font-semibold">ผ่านการตรวจสอบ ${data.valid_rows} รายการ</p><p class="mt-2 text-slate-400">ขั้นยืนยันและส่งคำเชิญจะเปิดในลำดับถัดไป</p>`;
      }
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.getElementById("desktopNav");
    if (!nav || document.getElementById("nav-roster-import")) return;
    const button = document.createElement("button");
    button.id = "nav-roster-import";
    button.className = "nav-btn hidden px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold text-amber-300 bg-amber-950/40 border border-amber-500/40";
    button.innerHTML = "นำเข้าผู้เรียน";
    button.onclick = openModal;
    nav.appendChild(button);
    const reveal = () => button.classList.remove("hidden");
    setTimeout(reveal, 300);
  });
})();