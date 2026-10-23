const fs=require('node:fs');
const course=require('./content.cjs');
fs.mkdirSync('dist',{recursive:true});
fs.writeFileSync('dist/data.js','window.COURSE='+JSON.stringify(course,null,2)+';\n');
const referenceLinks=ids=>ids.map(id=>`- [${course.refs[id][0]}](${course.refs[id][1]})`).join('\n');
let md='# System Design Path\n\nAn independent course and interview workbook. Examples and capacity numbers are teaching assumptions, not descriptions of company production systems.\n\nStudy loop: predict → learn → design → break → explain. Complete the exercises before revealing answers. This guide covers high-level and low-level system design, specialized systems, runnable labs and interview reasoning.\n\n';
for(const phase of course.phases){md+=`## Phase ${phase.id}: ${phase.title}\n\n${phase.goal}\n\n`;for(const l of course.lessons.filter(l=>l.phase===phase.id))md+=`### ${l.title}\n\n${l.model}\n\n**Worked example.** ${l.worked}\n\n**Tradeoffs.** ${l.tradeoff}\n\n**Exercise.** ${l.exercise}\n\n**Answer.** ${l.answer}\n\n${l.code?'```text\n'+l.code+'\n```\n\n':''}${referenceLinks(l.refs)}\n\n`;}
md+='## Pattern catalog\n\n';for(const p of course.patterns)md+=`### ${p.title}\n\n**Recognize:** ${p.signal}\n\n**Apply:** ${p.mechanism}\n\n**Failure:** ${p.failure}\n\n**Boundary:** ${p.avoid}\n\n${referenceLinks(p.refs)}\n\n`;
md+='## Design questions\n\n';for(const d of course.designs)md+=`### ${d.title}\n\n**Scope:** ${d.requirements}\n\n**Capacity assumptions:** ${d.scale}\n\n**API:** ${d.api}\n\n**Data:** ${d.data}\n\n${d.flow.map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\n**Decision:** ${d.decision}\n\n**Failure:** ${d.failure}\n\n**Follow-ups:**\n${d.followup.map(s=>'- '+s).join('\n')}\n\n`;
for(const d of course.designs){const w=d.walkthrough;md+='### Extended walkthrough: '+d.title+'\n\n**Numerical deep dive.** '+w.calculation+'\n\n**Alternatives:**\n'+w.alternatives.map(x=>'- '+x).join('\n')+'\n\n**Failure timeline:**\n'+w.timeline.map(x=>'- '+x).join('\n')+'\n\n**Migration.** '+w.migration+'\n\n**Hints:** '+w.hints.join(' / ')+'\n\n';d.followup.forEach((q,i)=>md+='**'+q+'**\n\n'+w.answers[i]+'\n\n');md+='**Weak reasoning.** '+w.weak+'\n\n**Stronger reasoning.** '+w.strong+'\n\n';}
md+='## Runnable labs\n\nRequires Node.js 22.13 or newer. Run npm run labs from the repository or node labs.cjs all with the downloaded runner.\n\n';
for(const l of course.labs)md+='### '+l.title+'\n\n'+l.hypothesis+'\n\nCommand: '+l.command+'\n\n'+l.steps.map((s,i)=>(i+1)+'. '+s).join('\n')+'\n\n**Expected:** '+l.expected+'\n\n**Extend:** '+l.extension+'\n\n**Limits:** '+l.limits+'\n\n';
fs.copyFileSync('labs/run.cjs','dist/labs.cjs');
fs.writeFileSync('dist/guide.md',md);
console.log(`Built ${course.phases.length} phases, ${course.lessons.length} lessons, ${course.patterns.length} patterns, ${course.designs.length} worked designs.`);
