const fs=require('node:fs');
const course={...require('./curriculum.cjs'),patterns:require('./patterns.cjs'),designs:require('./designs.cjs')};
fs.mkdirSync('dist',{recursive:true});
fs.writeFileSync('dist/data.js','window.COURSE='+JSON.stringify(course,null,2)+';\n');
const referenceLinks=ids=>ids.map(id=>`- [${course.refs[id][0]}](${course.refs[id][1]})`).join('\n');
let md='# System Design Path\n\nAn independent course and interview workbook. Examples and capacity numbers are teaching assumptions, not descriptions of company production systems.\n\nStudy loop: predict → learn → design → break → explain. Complete the exercises before revealing answers. This guide covers high-level system design; role-specific low-level design and coding need separate practice.\n\n';
for(const phase of course.phases){md+=`## Phase ${phase.id}: ${phase.title}\n\n${phase.goal}\n\n`;for(const l of course.lessons.filter(l=>l.phase===phase.id))md+=`### ${l.title}\n\n${l.model}\n\n**Worked example.** ${l.worked}\n\n**Tradeoffs.** ${l.tradeoff}\n\n**Exercise.** ${l.exercise}\n\n**Answer.** ${l.answer}\n\n${referenceLinks(l.refs)}\n\n`;}
md+='## Pattern catalog\n\n';for(const p of course.patterns)md+=`### ${p.title}\n\n**Recognize:** ${p.signal}\n\n**Apply:** ${p.mechanism}\n\n**Failure:** ${p.failure}\n\n**Boundary:** ${p.avoid}\n\n${referenceLinks(p.refs)}\n\n`;
md+='## Design questions\n\n';for(const d of course.designs)md+=`### ${d.title}\n\n**Scope:** ${d.requirements}\n\n**Capacity assumptions:** ${d.scale}\n\n**API:** ${d.api}\n\n**Data:** ${d.data}\n\n${d.flow.map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\n**Decision:** ${d.decision}\n\n**Failure:** ${d.failure}\n\n**Follow-ups:**\n${d.followup.map(s=>'- '+s).join('\n')}\n\n`;
fs.writeFileSync('dist/guide.md',md);
console.log(`Built ${course.phases.length} phases, ${course.lessons.length} lessons, ${course.patterns.length} patterns, ${course.designs.length} worked designs.`);
