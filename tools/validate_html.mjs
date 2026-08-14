import fs from 'node:fs';

const file = process.argv[2];
const html = fs.readFileSync(file, 'utf8');
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);

let failed = false;
inlineScripts.forEach((source, index) => {
  try {
    new Function(source);
    console.log(`inline script ${index + 1}: syntax OK`);
  } catch (error) {
    failed = true;
    console.error(`inline script ${index + 1}: ${error.message}`);
  }
});

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicateIds.length) {
  failed = true;
  console.error(`duplicate ids: ${duplicateIds.join(', ')}`);
} else {
  console.log(`ids: ${ids.length} unique`);
}

const requiredIds = [
  'nav-admin-setup', 'nav-admin-quiz', 'nav-admin-users', 'nav-admin-reports',
  'kpiLearnerCount', 'kpiKnowledgeGrowth', 'kpiAttendanceRate', 'kpiTotalXpSum',
  'knowledgeComparisonChart', 'cohortRadarChart', 'attendanceTrendChart',
  'assignmentCompletionChart', 'levelDistributionChart', 'groupAverageXpChart'
];
const missing = requiredIds.filter(id => !ids.includes(id));
if (missing.length) {
  failed = true;
  console.error(`missing required ids: ${missing.join(', ')}`);
} else {
  console.log('enhanced admin/report elements: present');
}

const literalIdReferences = inlineScripts.flatMap(source =>
  [...source.matchAll(/getElementById\(['"]([^'"`$]+)['"]\)/g)].map(match => match[1])
);
const unresolvedReferences = [...new Set(literalIdReferences.filter(id => !ids.includes(id)))];
if (unresolvedReferences.length) {
  failed = true;
  console.error(`unresolved literal getElementById references: ${unresolvedReferences.join(', ')}`);
} else {
  console.log(`literal DOM id references: ${new Set(literalIdReferences).size} resolved`);
}

process.exitCode = failed ? 1 : 0;
