(() => {
  "use strict";

  const config = window.LEADERSHIP_QUEST_SUPABASE || {};
  const loginView = () => document.getElementById("loginView");
  const appView = () => document.getElementById("appView");
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

    const demo = loginView()?.querySelector(".mt-6.pt-6");
    if (demo) demo.classList.add("hidden");

    if (!byId("loginPassword")) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = `
        <label class="block text-xs font-semibold text-slate-300 uppercase mb-2">รหัสผ่าน</label>
        <input type="password" id="loginPassword" required autocomplete="current-password"
          class="w-full bg-slate-900/80 border border-cyan-500/40 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-cyan-400 transition" />
      `;
      email.closest("div").after(wrapper);
    }

    const button = form.querySelector("button[type='submit']");
    if (button) button.innerHTML = 'เข้าสู่ระบบ <i class="fa-solid fa-arrow-right ml-2"></i>';
  }

  function showApp(account) {
    loginView()?.classList.add("hidden");
    appView()?.classList.remove("hidden");
    byId("mainHeader")?.classList.remove("hidden");
    byId("contextBar")?.classList.remove("hidden");
    byId("gameTicker")?.classList.remove("hidden");

    window.leadershipQuestAccount = account;
    const name = account.display_name || account.email;
    if (byId("userName")) byId("userName").textContent = name;
    if (byId("userRoleBadge")) byId("userRoleBadge").textContent = "Administrator";

    if (typeof window.switchAdminModule === "function") {
      window.switchAdminModule("setup");
    } else if (typeof window.switchTab === "function") {
      window.switchTab("dashboard");
    }
  }

  async function getAccount(client, userId) {
    const { data, error } = await client
      .from("user_accounts")
      .select("id, email, display_name, account_type, status")
      .eq("id", userId)
      .single();

    if (error) throw new Error("ไม่พบบัญชีใน Leadership Quest");
    if (data.status !== "ACTIVE" || data.account_type !== "ADMIN") {
      throw new Error("บัญชีนี้ไม่มีสิทธิ์เข้า Admin Portal");
    }
    return data;
  }

  function signOutAndShowError(client, message) {
    client.auth.signOut().finally(() => {
      loginView()?.classList.remove("hidden");
      appView()?.classList.add("hidden");
      showLoginMessage(message, "text-rose-300");
    });
  }

  function bootWithClient(client) {
    prepareLoginForm();

    window.handleLogin = async (event) => {
      event?.preventDefault();
      const email = byId("loginEmail")?.value?.trim();
      const password = byId("loginPassword")?.value;
      if (!email || !password) {
        showLoginMessage("กรอกอีเมลและรหัสผ่านให้ครบ", "text-rose-300");
        return;
      }

      const button = document.querySelector("#loginView button[type='submit']");
      if (button) {
        button.disabled = true;
        button.textContent = "กำลังเข้าสู่ระบบ…";
      }

      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        showLoginMessage(error.message, "text-rose-300");
      } else {
        try {
          showApp(await getAccount(client, data.user.id));
        } catch (accessError) {
          await signOutAndShowError(client, accessError.message);
        }
      }

      if (button) {
        button.disabled = false;
        button.innerHTML = 'เข้าสู่ระบบ <i class="fa-solid fa-arrow-right ml-2"></i>';
      }
    };

    window.logout = async () => {
      await client.auth.signOut();
      window.leadershipQuestAccount = null;
      location.reload();
    };

    window.quickLogin = () => showLoginMessage("โหมดตัวอย่างปิดแล้ว โปรดเข้าสู่ระบบด้วยบัญชีจริง", "text-amber-300");

    client.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      try {
        showApp(await getAccount(client, session.user.id));
      } catch (error) {
        await signOutAndShowError(client, error.message);
      }
    });

    client.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        loginView()?.classList.remove("hidden");
        appView()?.classList.add("hidden");
      }
    });
  }

  function loadSupabase() {
    if (!config.url || !config.anonKey) {
      prepareLoginForm();
      showLoginMessage("ยังไม่ได้ตั้งค่า Supabase public key ใน supabase-admin-config.js", "text-amber-300");
      return;
    }

    const ready = () => {
      if (!window.supabase?.createClient) {
        showLoginMessage("ไม่สามารถโหลดบริการเข้าสู่ระบบได้", "text-rose-300");
        return;
      }
      const client = window.supabase.createClient(config.url, config.anonKey);
      window.leadershipQuestSupabase = client;
      bootWithClient(client);
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
