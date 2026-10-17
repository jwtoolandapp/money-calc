const assert = require('node:assert/strict');
(async () => {
  const {fetchAllPages, shapeSavingProducts, shapeLoanProducts, collectSnapshot} = await import('../tools/fetch-finlife.mjs');
  const base = bank => ({fin_co_no:bank,fin_prdt_cd:'same-code',kor_co_nm:bank,fin_prdt_nm:'example'});
  const option = (bank, rate) => ({fin_co_no:bank,fin_prdt_cd:'same-code',save_trm:'12',intr_rate:rate,intr_rate2:'',lend_rate_avg:rate});
  const raw = {baseList:[base('A'),base('B')],optionList:[option('A','2'),option('B','3')]};
  assert.deepEqual(shapeSavingProducts(raw).map(p => p.options[0].baseRate), [2,3]);
  assert.deepEqual(shapeLoanProducts(raw).map(p => p.options[0].averageRate), [2,3]);
  assert.equal(shapeSavingProducts(raw)[0].options[0].maxRate, null);
  assert.throws(() => shapeSavingProducts({baseList:[{fin_prdt_cd:'x'}],optionList:[]}), /identity/);
  let calls=0;
  const pages=await fetchAllPages('fixture', async()=>{calls++;return {...raw,max_page_no:2};});
  assert.equal(calls,2); assert.equal(pages.baseList.length,4);
  for (const bad of [{...raw,max_page_no:21},{...raw,max_page_no:0},{max_page_no:1}]) {
    await assert.rejects(fetchAllPages('fixture',async()=>bad));
  }
  await assert.rejects(fetchAllPages('fixture',async(_,p)=>({...raw,max_page_no:p===1?2:3})), /changed/);
  const fixture = async () => ({...raw,max_page_no:1});
  const snapshot = await collectSnapshot(fixture,new Date('2026-10-12T16:00:00Z'));
  assert.equal(snapshot.size,5);
  assert.equal(snapshot.get('meta.json').fetchedAt,'2026-10-13');
  assert.equal(snapshot.get('meta.json').datasets.length,4);
  await assert.rejects(collectSnapshot(async()=>({max_page_no:1,baseList:[],optionList:[]})), /empty/);
  await assert.rejects(collectSnapshot(async()=>({max_page_no:1,baseList:[base('A')],optionList:[option('A','')]})), /usable/);
  let reached=0;
  await assert.rejects(collectSnapshot(async()=>{if(++reached===4)throw new Error('last dataset failed');return fixture();}), /last dataset failed/);
  assert.equal(reached,4);
  console.log('finlife collector: bank identities, pagination, incomplete snapshots, KST date and failure guards passed (synthetic fixtures; no live API call)');
})().catch(error=>{console.error(error);process.exitCode=1;});
