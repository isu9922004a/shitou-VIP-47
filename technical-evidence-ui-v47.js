/* R4.5 研究候選｜只增補使用者可見證據；四大核心報告及原有掃描結果維持原樣。 */
(function(){
'use strict';
const E=window.ShitouTechnicalEvidenceR45;
if(!E){console.warn('新增EMA/KD證據未載入；原有功能照常使用');return;}
function line(tag,text,cls=''){
  const p=document.createElement('p');p.className=cls;p.textContent=tag+' '+text;return p;
}
function create(e,title,priceRows=[]){
  const panel=document.createElement('section');panel.className='technical-evidence-r45';panel.dataset.evidenceMode='supplementary-only';
  const h=document.createElement('h3');h.textContent=title+'｜補充趨勢證據（不計分、不改原判讀）';panel.append(h);
  for(const s of E.plain(e))panel.append(line('',s));
  const date=document.createElement('p');date.className='technical-date-r45';date.textContent=e.available?`📅 技術證據使用日：${e.dataQuality.dataDate}｜已完成日K ${e.dataQuality.bars} 根｜盤後參考，不是盤中確認`:'⚠️ 本項證據未取得；原有結果不受影響。';panel.append(date);
  const values=priceRows.filter(row=>row.value!==null&&row.value!==undefined&&Number.isFinite(Number(row.value))&&Number(row.value)>0);
  if(values.length){const g=document.createElement('div');g.className='technical-price-grid-r45';values.forEach(r=>{
    const d=document.createElement('div');d.className='technical-price-r45';const label=document.createElement('span');label.textContent=r.label;
    const strong=document.createElement('strong');strong.textContent=E.price(r.value)+(r.unit||' 元');d.append(label,strong);g.append(d);
  });panel.append(g);}
  return panel;
}
function insertSingle(rootId,afterSelector,e,title,prices){
  const root=document.getElementById(rootId);if(!root)return;
  root.querySelectorAll('.technical-evidence-r45[data-single="yes"]').forEach(x=>x.remove());
  const panel=create(e,title,prices);panel.dataset.single='yes';
  const after=root.querySelector(afterSelector);if(after)after.insertAdjacentElement('afterend',panel);else root.prepend(panel);
}
function safe(fn){try{return fn();}catch(err){console.warn('技術證據呈現失敗，原始報告仍可使用',err);return null;}}
function stockUI(r){if(!r)return;safe(()=>insertSingle('result','.panel',E.analyze(r), '個股趨勢',[
  {label:'🔴 原始現價',value:r.close},{label:'👀 ABC的B點',value:r.fib?.B},
  {label:'🛡️ 原有20日均線',value:r.structure?.ma20??r.dailyMa20??r.ma20}
]));}
function marketUI(r){if(!r)return;safe(()=>insertSingle('marketResult','.panel',E.analyze(r,{kind:'market'}),'大盤趨勢',[
  {label:'📍 最近收盤',value:r.close,unit:' 點'}, {label:'👀 ABC的B點',value:r.fib?.B,unit:' 點'},
  {label:'🛡️ 原有20日均線',value:r.ma20,unit:' 點'}
]));}
function scanUI(scan,rootId,kind){safe(()=>{
  const root=document.getElementById(rootId);if(!root||!Array.isArray(scan?.candidates))return;
  const cards=[...root.querySelectorAll('.momentum-card')];
  cards.forEach((card,i)=>{
    card.querySelectorAll('.technical-evidence-r45').forEach(x=>x.remove());
    const c=scan.candidates[i];if(!c)return;
    const e=E.analyze(c.report||{},{kind});
    const levels=kind==='momentum'?
      [{label:'🔴 原始現價',value:c.close},{label:'🧱 原有最近壓力',value:c.nearestResistancePriceR43},{label:'🛡️ 原有防守',value:c.support?.value}]:
      [{label:'🔴 原始現價',value:c.close},{label:'👀 原有盤前觀察價',value:c.levels?.triggerShadow?.value},{label:'🧱 原有第一壓力',value:c.levels?.resistance?.value}];
    card.append(create(e,kind==='momentum'?'主升附加證據':'當沖附加證據',levels));
  });
});}
function techText(r,kind){
  const e=E.analyze(r||{},{kind});return E.plain(e).join('\n');
}
function appendTechnicalText(text,block){
  if(typeof text!=='string'||!text.trim())return text;
  const stamp='【新增EMA／KD趨勢參考｜不改原分數與原進場限制】\n'+block+'\n';
  const marker=/^(?:完整結尾標記：)?END-OF-(?:MOMENTUM|DAYTRADE)-[^\n]*$/m;
  if(marker.test(text))return text.replace(marker,m=>stamp+'\n'+m);
  const disclaimer='技術分析僅供研究與決策參考，不構成投資建議。';
  const ix=text.lastIndexOf(disclaimer);
  return ix>=0?text.slice(0,ix)+stamp+'\n'+text.slice(ix):text+'\n\n'+stamp;
}
function scanText(scan,kind,compact){
  const arr=Array.isArray(scan?.candidates)?scan.candidates:[];
  if(!arr.length)return '本次沒有候選個股，EMA與KD證據無逐檔資料。';
  // 精簡版不重複原有 TOP 行，避免破壞舊版完整性稽核的候選數量。
  return arr.map(c=>`${c.report?.stock||c.report?.code||'代號不明'}：${(compact?E.plain(E.analyze(c.report||{},{kind})).slice(0,2):E.plain(E.analyze(c.report||{},{kind}))).join('／')}`).join('\n');
}
function wrapRender(fn,after){
  const original=window[fn];if(typeof original!=='function')return;
  window[fn]=function(...args){const result=original.apply(this,args);safe(()=>after(args[0]));return result;};
}
function wrapText(fn,make){
  const original=window[fn];if(typeof original!=='function')return;
  window[fn]=function(...args){const text=original.apply(this,args);return appendTechnicalText(text,safe(()=>make(args[0]))||'新增證據暫時無法取得。');};
}
// 原有資料查詢完成才增補；不改原有請求、異常處理或原本計算物件。
const analyzeStockOriginal=window.analyzeStock;
if(typeof analyzeStockOriginal==='function')window.analyzeStock=async function(...a){const r=await analyzeStockOriginal.apply(this,a);if(typeof lastReportData!=='undefined')stockUI(lastReportData);return r;};
wrapRender('renderMarketWorkerData',marketUI);
wrapRender('renderMomentumScanResultV3765',scan=>scanUI(scan,'momentumList','momentum'));
wrapRender('renderDayTradeScanResultV1',scan=>scanUI(scan,'dayTradeList','daytrade'));
wrapText('buildReportText',r=>techText(r,'stock'));
wrapText('buildMarketWorkerReportText',r=>techText(r,'market'));
wrapText('buildMomentumScanTextReportV3763',r=>scanText(r,'momentum',false));
wrapText('buildMomentumScanCompactTextReportV377713',r=>scanText(r,'momentum',true));
wrapText('buildDayTradeTextReportV1',r=>scanText(r,'daytrade',false));
window.SHITO_R45_UI_AUDIT={installed:true,mode:'SUPPLEMENTARY_ONLY',noOriginalRankChange:true,noWorkerChange:true};
})();
