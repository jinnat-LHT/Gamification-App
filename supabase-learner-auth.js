(() => {
  "use strict";

  const config = window.LEADERSHIP_QUEST_SUPABASE || {};
  const byId = (id) => document.getElementById(id);

  function showLoginMessage(message, tone = "text-amber-300") {
    const form = document.querySelector("#loginView form");
    if (!form) return;
    let note = byId("supabaseLoginMessage");
    if (!note) {
      note = document.createElement("p");
      note.id = "supabaseLoginMessage";
      note.className = "mt-3 text-center text-xs";
      form.after(note);
    }
    note.className = `mt-3 text-center text-xs ${tone}`;
    note.textContent = message;
  }

  function prepareLoginForm() {
    const form = document.querySelector("#loginView form");
    const email = byId("loginEmail");
    if (!form || !email) return;
    byId("loginView")?.querySelector(".mt-6.pt-6")?.classList.add("hidden");

    if (!byId("loginPassword")) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = `
        <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">รหัสผ่าน</label>
        <input type="password" id="loginPassword" required autocomplete="current-password"
          class="w-full bg-slate-900/80 border border-cyan-500/40 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-cyan-400 transition" />
        <button type="button" id="forgotPasswordButton" class="mt-2 text-xs text-cyan-300 hover:text-cyan-200 underline">ลืมรหัสผ่าน?</button>
      `;
      email.closest("div").after(wrapper);
    }
  }

  function learnerState(account) {
    return {
      id: account.id,
      name: account.display_name || account.email,
      email: account.email,
      group: account.group_name || "ยังไม่มีกลุ่ม",
      batch: account.batch_name || "ยังไม่มีกำหนดรุ่น",
      archetypeIcon: "fa-user-ninja",
      archetypeTitle: "Executive Learner",
      equippedBadgeId: "b_first",
      customBadges: [],
      attendance: [false, false, false, false, false],
      liveXp: 0, preScore: 0, postScore: 0,
      hasPretest: false, hasPosttest: false,
      hasBehaviorBefore: false, hasBehaviorAfter: false,
      hasPeerAssessment: false, openedChest2: false,
      behaviorBeforeScores: [1, 1, 1, 1, 1],
      behaviorAfterScores: [1, 1, 1, 1, 1],
      assignments: { 1: { done: false }, 2: { done: false }, 3: { done: false } },
      isFirstTime: false,
    };
  }

  async function getLearnerAccount(client, userId) {
    const { data, error } = await client
      .from("user_accounts")
      .select("id, email, display_name, account_type, status")
      .eq("id", userId)
      .single();
    if (error || !data) throw new Error("ไม่พบบัญชีผู้เรียนใน Leadership Quest");
    if (data.account_type !== "LEARNER" || !["INVITED", "ACTIVE"].includes(data.status)) {
      throw new Error("บัญชีนี้ไม่มีสิทธิ์เข้า Learner Portal");
    }

    const { data: enrollments, error: enrollmentError } = await client
      .from("batch_learners")
      .select("batch_id, group:groups(name, external_code), batch:batches(name, external_code, start_date, end_date)")
      .eq("learner_id", userId)
      .in("enrollment_status", ["INVITED", "ACTIVE"])
      .limit(1);
    if (enrollmentError) throw new Error("ไม่สามารถอ่านข้อมูลรุ่นเรียนได้");

    const enrollment = enrollments?.[0];
    return {
      ...data,
      batch_id: enrollment?.batch_id || null,
      group_name: enrollment?.group?.name || enrollment?.group?.external_code || "ยังไม่มีกลุ่ม",
      batch_name: enrollment?.batch?.name || enrollment?.batch?.external_code || "ยังไม่มีกำหนดรุ่น",
    };
  }

  const activityLabel = (activity) => ({
    PRE_TEST: "Pre-test",
    POST_TEST: "Post-test",
    SELF_BEFORE: "Self-assessment ก่อนเรียน",
    SELF_AFTER: "Self-assessment หลังเรียน",
    PEER_REVIEW: "Peer review",
    ASSIGNMENT: "Assignment",
  }[activity.activity_type] || activity.activity_key);

  async function showActivityOverview(client, account) {
    const existing = byId("liveActivityOverview");
    if (existing) existing.remove();
    if (!account.batch_id) return;

    const { data: activities, error } = await client
      .from("batch_activity_configs")
      .select("activity_type, activity_key, enabled, gate_state, due_at")
      .eq("batch_id", account.batch_id)
      .order("activity_type");
    if (error) return;

    const enabled = (activities || []).filter((activity) => activity.enabled);
    const card = document.createElement("section");
    card.id = "liveActivityOverview";
    card.className = "glass-card neon-frame-cyan p-5 rounded-2xl";
    const content = enabled.length
      ? enabled.map((activity) => `<li class="flex items-center justify-between gap-3 py-2 border-b border-slate-800 last:border-0"><span>${activityLabel(activity)}</span><span class="rounded-full px-2 py-0.5 text-xs ${activity.gate_state === "OPEN" ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-300"}">${activity.gate_state === "OPEN" ? "เปิดใช้งาน" : "รอตามกำหนด"}</span></li>`).join("")
      : "<li class='py-2 text-slate-400'>ยังไม่มีกิจกรรมที่เปิดในรุ่นนี้</li>";
    card.innerHTML = `<div class="flex items-center justify-between gap-3"><div><h3 class="font-bold text-slate-100">กิจกรรมของ ${account.batch_name}</h3><p class="text-xs text-slate-400">ข้อมูลจาก Batch ที่คุณลงทะเบียน</p></div><span class="rounded-xl bg-cyan-500/15 px-3 py-1 text-sm font-semibold text-cyan-300">${enabled.length} กิจกรรม</span></div><ul class="mt-3 text-sm text-slate-200">${content}</ul>`;
    byId("tab-dashboard")?.prepend(card);
  }

  function showLearner(client, account) {
    window.leadershipQuestLearner = account;
    if (typeof window.loginUser === "function") window.loginUser(learnerState(account), false);
    showActivityOverview(client, account);
  }

  function signOutAndShowError(client, message) {
    client.auth.signOut().finally(() => showLoginMessage(message, "text-rose-300"));
  }

  function boot(client) {
    prepareLoginForm();

    byId("forgotPasswordButton")?.addEventListener("click", async () => {
      const email = byId("loginEmail")?.value?.trim();
      if (!email) return showLoginMessage("กรอกอีเมลก่อนกดลืมรหัสผ่าน", "text-amber-300");
      const button = byId("forgotPasswordButton");
      button.disabled = true; button.textContent = "กำลังส่งอีเมล…";
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: "https://jinnat-lht.github.io/Gamification-App/set-password.html",
      });
      showLoginMessage(error ? error.message : "ส่งลิงก์ตั้งรหัสผ่านใหม่แล้ว โปรดตรวจสอบอีเมล", error ? "text-rose-300" : "text-emerald-300");
      button.disabled = false; button.textContent = "ลืมรหัสผ่าน?";
    });

    window.handleLogin = async (event) => {
      event?.preventDefault();
      const email = byId("loginEmail")?.value?.trim();
      const password = byId("loginPassword")?.value;
      if (!email || !password) return showLoginMessage("กรอกอีเมลและรหัสผ่านให้ครบ", "text-rose-300");

      const button = document.querySelector("#loginView button[type='submit']");
      button.disabled = true; button.textContent = "กำลังเข้าสู่ระบบ…";
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) showLoginMessage(error.message, "text-rose-300");
      else {
        try { showLearner(client, await getLearnerAccount(client, data.user.id)); }
        catch (accessError) { await signOutAndShowError(client, accessError.message); }
      }
      button.disabled = false; button.innerHTML = 'เข้าสู่ระบบ <i class="fa-solid fa-arrow-right ml-2"></i>';
    };

    window.quickLogin = () => showLoginMessage("โหมดตัวอย่างปิดแล้ว โปรดเข้าสู่ระบบด้วยบัญชีจริง", "text-amber-300");
    window.logoutUser = async () => {
      await client.auth.signOut();
      location.reload();
    };

    client.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      try { showLearner(client, await getLearnerAccount(client, session.user.id)); }
      catch (error) { await signOutAndShowError(client, error.message); }
    });
  }

  function loadSupabase() {
    if (!config.url || !config.anonKey) return showLoginMessage("ระบบยังไม่ได้ตั้งค่า Supabase", "text-rose-300");
    const ready = () => {
      if (!window.supabase?.createClient) return showLoginMessage("ไม่สามารถโหลดบริการเข้าสู่ระบบได้", "text-rose-300");
      const client = window.supabase.createClient(config.url, config.anonKey);
      window.leadershipQuestSupabase = client;
      boot(client);
    };
    if (window.supabase?.createClient) return ready();
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.onload = ready;
    script.onerror = () => showLoginMessage("ไม่สามารถโหลดบริการเข้าสู่ระบบได้", "text-rose-300");
    document.head.appendChild(script);
  }

  document.addEventListener("DOMContentLoaded", loadSupabase);
})();
