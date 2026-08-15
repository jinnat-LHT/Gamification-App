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
        <a href="./" class="mt-2 inline-block text-xs text-cyan-300 hover:text-cyan-200 underline">ลืมรหัสผ่าน? ติดต่อผู้ดูแลโปรแกรม</a>
      `;
      email.closest("div").after(wrapper);
    }
  }

  function learnerState(account) {
    return {
      id: account.id,
      name: account.display_name || account.email,
      email: account.email,
      group: "Cohort ของคุณ",
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
    return data;
  }

  function showLearner(account) {
    window.leadershipQuestLearner = account;
    if (typeof window.loginUser === "function") window.loginUser(learnerState(account), false);
  }

  function signOutAndShowError(client, message) {
    client.auth.signOut().finally(() => showLoginMessage(message, "text-rose-300"));
  }

  function boot(client) {
    prepareLoginForm();

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
        try { showLearner(await getLearnerAccount(client, data.user.id)); }
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
      try { showLearner(await getLearnerAccount(client, session.user.id)); }
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
