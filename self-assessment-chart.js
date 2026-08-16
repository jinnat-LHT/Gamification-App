(()=>{
  const types={SELF_BEFORE:"behaviorBeforeScores",SELF_AFTER:"behaviorAfterScores"};
  async function refreshSelfAssessmentChart(){
    const client=window.leadershipQuestSupabase,account=window.leadershipQuestLearner;
    if(!client||!account?.batch_learner_id||!window.STATE?.currentUser)return;
    const [submissions,configs]=await Promise.all([
      client.from("submissions").select("activity_type,status,submission_attempts(response_json,attempt_number)").eq("batch_learner_id",account.batch_learner_id).in("activity_type",["SELF_BEFORE","SELF_AFTER"]),
      client.from("batch_activity_configs").select("activity_type,config_json").eq("batch_id",account.batch_id).in("activity_type",["SELF_BEFORE","SELF_AFTER"])
    ]);
    if(submissions.error||configs.error)return;
    const state=window.STATE.currentUser;
    const beforeConfig=(configs.data||[]).find(row=>row.activity_type==="SELF_BEFORE")||(configs.data||[])[0];
    const criteria=beforeConfig?.config_json?.criteria||[];
    const fallback=["strategic_thinking","coaching","growth_mindset","team_execution","agility"];
    const keys=(criteria.length===5?criteria.map(item=>item.key):fallback);
    if(criteria.length===5)window.selfAssessmentChartLabels=criteria.map(item=>item.title);
    (submissions.data||[]).forEach(row=>{
      const latest=[...(row.submission_attempts||[])].sort((a,b)=>Number(b.attempt_number)-Number(a.attempt_number))[0];
      const ratings=latest?.response_json?.ratings;
      if(!ratings||!types[row.activity_type])return;
      state[types[row.activity_type]]=keys.map(key=>Number(ratings[key]||0));
      if(row.activity_type==="SELF_BEFORE")state.hasBehaviorBefore=true;
      if(row.activity_type==="SELF_AFTER")state.hasBehaviorAfter=true;
    });
    if(typeof window.renderDashboard==="function")window.renderDashboard();
  }
  window.addEventListener("self-assessment:submitted",refreshSelfAssessmentChart);
  document.addEventListener("DOMContentLoaded",()=>setTimeout(refreshSelfAssessmentChart,1800));
  setTimeout(refreshSelfAssessmentChart,3200);
  window.refreshSelfAssessmentChart=refreshSelfAssessmentChart;
})();