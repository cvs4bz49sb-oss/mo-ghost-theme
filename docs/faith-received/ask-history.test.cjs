const {test}=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../../assets/js/faith-ask-history.js');
function store(){const records=new Map(),meta=new Map();let id=0;return {records,id:()=>String(++id),put:async c=>records.set(c.id,structuredClone(c)),get:async id=>structuredClone(records.get(id)),all:async()=>structuredClone([...records.values()]),update:async(id,fn)=>{const c=records.get(id);fn(c);},setMeta:async(k,v)=>meta.set(k,v),meta:async k=>({value:meta.get(k)})};}
test('a question is committed before an answer exists and can be recovered by a fresh controller',async()=>{
 const s=store(),a=create(s),id=await a.begin('Where does this author discuss grace?',{traditions:['Latin Fathers'],author:'Author'});const b=create(s),saved=await b.restore(id);
 assert.equal(saved.result.question,'Where does this author discuss grace?');assert.equal(saved.status,'running');assert.equal((await b.list()).length,1);
});
test('complete questions restore full text, citations, and scope after navigation',async()=>{
 const s=store(),a=create(s),id=await a.begin('Question',{traditions:[],author:'Author'});const answer='Long answer. '.repeat(10000);await a.complete(id,{answer,citations:[{n:1,cit:'Source',url:'/the-faith-received/reader/?w=work'}],works:[],gaps:[]});const restored=await create(s).restore(id);
 assert.equal(restored.result.answer,answer);assert.equal(restored.result.citations[0].url,'/the-faith-received/reader/?w=work');assert.equal(restored.record.mereoScope.author,'Author');
});
test('a failure retains the question and never overwrites a completed result',async()=>{
 const s=store(),a=create(s),id=await a.begin('Question',{traditions:[]});await a.fail(id,'Connection lost');assert.equal((await a.restore(id)).status,'interrupted');await a.complete(id,{answer:'Complete'});await a.fail(id,'Late failure');assert.equal((await a.restore(id)).result.answer,'Complete');
});
