(() => {
  "use strict";

  const expectedHeaders = ["email", "display_name", "employee_code", "group_code"];
  const batchCode = window.LEADERSHIP_QUEST_IMPORT_BATCH_CODE || "LDP-001";

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  function parseCsv(text) {
    const records = [];
    let row = [], value = "", quoted = false;
    const input = String(text).replace(/^\uFEFF/, "");
    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];
      if (char === '"') {
        if (quoted && input[index + 1] === '"') { value += '"'; index += 1; }
        else quoted = !quoted;
      } else if (char === "," && !quoted) {
        row.push(value.trim()); value = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && input[index + 1] === "\n") index += 1;
        row.push(value.trim()); value = "";
        if (row.some(Boolean)) records.push(row);
        row = [];
      } else value += char;
    }
    row.push(value.trim());
    if (row.some(Boolean)) records.push(row);
    return records;
  }

  function loadXlsx() {
    if (window.XLSX) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("ไม่สามารถโหลดตัวอ่านไฟล์ Excel ได้"));
      document.head.appendChild(script);
    });
  }

  async function parseFile(file) {
    if (file.name.toLowerCase().endsWith(".csv")) return parseCsv(await file.text());
    await loadXlsx();
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    return window.XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false });
  }

  function normaliseRows(rows) {
    const [header = [], ...data] = rows;
    const normalisedHeader = header.map((value) => String(value).trim().replace(/^\uFEFF/, ""));
    if (expectedHeaders.some((key, index) => normalisedHeader[index] !== key)) {
      throw new Error("หัวตารางไม่ถูกต้อง กรุณาดาวน์โหลด template และห้ามเปลี่ยนชื่อคอลัมน์");
    }
    return data
      .filter((row) => row.some((value) => String(value).trim()))
      .map((row) => Object.fromEntries(expectedHeaders.map((key, index) => [key, String(row[index] ?? "").trim()])));
  }

  function setResult(html) {
    const result = document.getElementById("rosterResult");
    if (result) result.innerHTML = html;
  }

  async function validateRoster(rows) {
    const client = window.leadershipQuestSupabase;
    if (!client) throw new Error("โปรดเข้าสู่ระบบใหม่ก่อนนำเข้า");
    const { data, error } = await client.functions.invoke("import-roster", {
      body: { action: "validate", batch_code: batchCode, rows }
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function commitRoster(rows) {
    const client = window.leadershipQuestSupabase;
    if (!client) throw new Error("โปรดเข้าสู่ระบบใหม่ก่อนนำเข้า");
    const { data, error } = await client.functions.invoke("import-roster", {
      body: { action: "commit", batch_code: batchCode, rows }
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }

  function openModal() {
    let modal = document.getElementById("rosterImportModal");
    if (modal) return modal.classList.remove("hidden");
    modal = document.createElement("div");
    modal.id = "rosterImportModal";
    modal.className = "fixed inset-0 z-50 bg-slate-950/80 backdrop-blur p-4 overflow-y-auto";
    modal.innerHTML = `<div class="max-w-2xl mx-auto my-8 glass-card p-6 rounded-2xl">
      <div class="flex justify-between gap-4">
        <div><h2 class="text-xl font-bold">นำเข้าผู้เรียน</h2>
          <p class="text-sm text-slate-400">Batch: ${escapeHtml(batchCode)} · รองรับ CSV หรือ Excel (.xlsx)</p>
        </div><button id="closeRosterImport" class="text-slate-300" aria-label="ปิด">✕</button>
      </div>
      <div class="mt-4 rounded-xl border border-cyan-500/30 bg-slate-900/60 p-4 text-sm text-slate-300">
        <p>คอลัมน์ที่ต้องมี: <code>email, display_name, employee_code, group_code</code></p>
        <a class="inline-block mt-2 text-cyan-300 hover:text-cyan-200 underline" href="./templates/roster-import-template.csv" download>ดาวน์โหลด CSV template</a>
      </div>
      <input id="rosterFile" type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="mt-5 block w-full text-sm" />
      <div id="rosterResult" class="mt-5 text-sm text-slate-300"></div>
    </div>`;
    document.body.appendChild(modal);
    document.getElementById("closeRosterImport").onclick = () => modal.classList.add("hidden");
    document.getElementById("rosterFile").onchange = async (event) => {
      const file = event.target.files?.[0]; if (!file) return;
      setResult("กำลังอ่านและตรวจสอบไฟล์…");
      try {
        const rows = normaliseRows(await parseFile(file));
        if (!rows.length) throw new Error("ไม่พบรายชื่อผู้เรียนในไฟล์");
        const data = await validateRoster(rows);
        if (!data.valid) {
          setResult(`<p class="text-rose-300 font-semibold">พบข้อผิดพลาด ${data.errors.length} รายการ — ยังไม่มีการบันทึกข้อมูล</p>
            <ul class="mt-2 list-disc pl-5">${data.errors.map((e) => `<li>แถว ${escapeHtml(e.row)}: ${escapeHtml(e.field)} — ${escapeHtml(e.message)}</li>`).join("")}</ul>`);
          return;
        }
        setResult(`<p class="text-emerald-300 font-semibold">ผ่านการตรวจสอบ ${escapeHtml(data.valid_rows)} รายการ</p>
          <p class="mt-2 text-slate-400">ข้อมูลยังไม่ถูกบันทึกหรือส่งคำเชิญจนกว่าจะยืนยัน</p>
          <button id="confirmRosterImport" class="mt-4 rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-400">ยืนยันและส่งคำเชิญ ${escapeHtml(data.valid_rows)} คน</button>`);
        document.getElementById("confirmRosterImport").onclick = async () => {
          const button = document.getElementById("confirmRosterImport");
          button.disabled = true;
          button.textContent = "กำลังบันทึกและส่งคำเชิญ…";
          try {
            const committed = await commitRoster(rows);
            setResult(`<p class="text-emerald-300 font-semibold">นำเข้าและส่งคำเชิญสำเร็จ ${escapeHtml(committed.invited_count)} คน</p>
              <p class="mt-2 text-slate-400">ระบบบันทึกเลขที่งาน ${escapeHtml(committed.import_job_id)} ไว้ใน audit แล้ว</p>`);
          } catch (commitError) {
            setResult(`<p class="text-rose-300">ยืนยันไม่สำเร็จ: ${escapeHtml(commitError.message || "เกิดข้อผิดพลาด")}</p>`);
          }
        };
      } catch (error) {
        setResult(`<p class="text-rose-300">ตรวจสอบไม่สำเร็จ: ${escapeHtml(error.message || "เกิดข้อผิดพลาด")}</p>`);
      }
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.getElementById("desktopNav");
    if (!nav || document.getElementById("nav-roster-import")) return;
    const button = document.createElement("button");
    button.id = "nav-roster-import";
    button.className = "nav-btn hidden px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold text-amber-300 bg-amber-950/40 border border-amber-500/40";
    button.innerHTML = '<i class="fa-solid fa-file-import mr-1.5"></i>นำเข้าผู้เรียน';
    button.onclick = openModal;
    nav.appendChild(button);
    setTimeout(() => {
      if (window.leadershipQuestAccount?.account_type === "ADMIN") button.classList.remove("hidden");
    }, 700);
  });
})();
