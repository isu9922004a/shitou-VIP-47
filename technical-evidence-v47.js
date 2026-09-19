/* 石頭少爺 R4.5 研究候選｜純技術證據：不變更原始候選、分數、Hard Reject、ABC 或 Worker。 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ShitouTechnicalEvidenceR45=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const MODEL='TECHNICAL_EVIDENCE_R45_RESEARCH';
  const periods=[8,12,21,50,200];
  const unavailable=(why,extra={})=>({available:false,label:'資料不足，暫不判斷',reason:why,...extra});
  function num(v){
    if(v===null||v===undefined||v==='')return null;
    const x=Number(typeof v==='string'?v.replace(/,/g,''):v);
    return Number.isFinite(x)?x:null;
  }
  function date(v){
    const s=String(v||'').trim();
    if(/^\d{8}$/.test(s))return s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6);
    return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null;
  }
  function normalize(report){
    const source=report?.dailySeries;
    if(!Array.isArray(source)||!source.length)return unavailable('缺少已完成交易日的日K歷史');
    let last='',rows=[];
    for(const b of source){
      const d=date(b?.date),o=num(b?.open),h=num(b?.high),l=num(b?.low),c=num(b?.close);
      if(!d||!(o>0)||!(c>0)||!(h>=Math.max(o,c,l))||!(l>0&&l<=Math.min(o,c,h)))return unavailable('日K日期或開高低收資料有缺漏，停止新增指標');
      if(last&&d<=last)return unavailable('日K日期重複或排列錯誤，停止新增指標');
      const volume=num(b?.volume);
      if(volume!==null&&volume<0)return unavailable('成交量為負值，停止新增指標');
      rows.push({date:d,open:o,high:h,low:l,close:c,volume});last=d;
    }
    const expected=date(report?.closeDate),displayClose=num(report?.close);
    if(expected&&rows[rows.length-1].date!==expected)return unavailable('日K末日與報告交易日不一致，不能混用不同日期',{
      dataDate:rows[rows.length-1].date,expectedDate:expected
    });
    if(displayClose!==null&&Math.abs(rows[rows.length-1].close-displayClose)>Math.max(.02,displayClose*.0001))return unavailable('日K收盤價與報告現價不一致，避免混用價格');
    return {available:true,rows,dataDate:rows[rows.length-1].date,count:rows.length};
  }
  function emaSeries(rows,p){
    if(rows.length<p+30)return unavailable(`EMA${p}需至少${p+30}根日K以降低起始值影響；目前只有${rows.length}根`,{period:p});
    const out=Array(rows.length).fill(null),alpha=2/(p+1);
    let sum=0;
    for(let i=0;i<p;i++)sum+=rows[i].close;
    out[p-1]=sum/p;
    for(let i=p;i<rows.length;i++)out[i]=rows[i].close*alpha+out[i-1]*(1-alpha);
    const current=out[out.length-1],prior=out[out.length-6],slope=prior>0?(current-prior)/prior*100:null;
    // 平走門檻是研究介面用的相對變化描述，未參與選股Gate。
    const direction=slope===null?'資料不足':slope>.15?'向上':slope<-.15?'向下':'接近平走';
    return {available:true,period:p,value:current,previous:out[out.length-2],slopeFiveBarsPct:slope,direction,series:out};
  }
  function kdSeries(rows){
    const period=9,warm=30;
    if(rows.length<period+warm)return unavailable(`KD需至少${period+warm}根已完成日K，目前只有${rows.length}根`);
    let k=50,d=50,prevK=null,prevD=null;
    const ks=[],ds=[],rsv=[];
    for(let i=0;i<rows.length;i++){
      if(i<period-1){ks.push(null);ds.push(null);rsv.push(null);continue;}
      let lo=Infinity,hi=-Infinity;
      for(let j=i-period+1;j<=i;j++){lo=Math.min(lo,rows[j].low);hi=Math.max(hi,rows[j].high);}
      const raw=hi===lo?null:(rows[i].close-lo)/(hi-lo)*100;
      prevK=k;prevD=d;
      if(raw!==null){k=(2*k+raw)/3;d=(2*d+k)/3;}
      ks.push(k);ds.push(d);rsv.push(raw);
    }
    const idx=rows.length-1,ck=ks[idx],cd=ds[idx],pk=ks[idx-1],pd=ds[idx-1];
    const cross=pk<=pd&&ck>cd?'黃金交叉':pk>=pd&&ck<cd?'死亡交叉':'沒有新交叉';
    const band=ck>80?'高於80，短線偏熱但不等於反轉':ck<20?'低於20，短線偏弱但不等於反轉':ck>=50?'50以上，偏強區':'50以下，偏弱區';
    return {available:true,k:ck,d:cd,prevK:pk,prevD:pd,cross,band,seriesK:ks,seriesD:ds,rsvLast:rsv[idx],initialK:50,initialD:50};
  }
  function controlPoints(rows){
    // 僅作「前一根/當根/後一根」的獨立研究控制點；不觸碰既有左右3根Pivot。
    const highs=[],lows=[];
    for(let i=1;i<rows.length-1;i++){
      if(rows[i].low<rows[i-1].low&&rows[i].low<rows[i+1].low)lows.push({pivotDate:rows[i].date,confirmedAt:rows[i+1].date,confirmedPrice:rows[i].low});
      if(rows[i].high>rows[i-1].high&&rows[i].high>rows[i+1].high)highs.push({pivotDate:rows[i].date,confirmedAt:rows[i+1].date,confirmedPrice:rows[i].high});
    }
    return {available:rows.length>=3,lastHigh:highs[highs.length-1]||null,lastLow:lows[lows.length-1]||null,definition:'兩側各一根嚴格高低點，研究定義；不是原版Pivot',dataDate:rows.at(-1).date};
  }
  function analyze(report,{kind='stock'}={}){
    const data=normalize(report);
    if(!data.available)return {model:MODEL,kind,available:false,dataQuality:data,ema:unavailable(data.reason),kd:unavailable(data.reason),controls:unavailable(data.reason),risk:'未取得可靠日K，不提供新增技術結論',originalDecisionUnchanged:true};
    const rows=data.rows,emas={};
    for(const p of periods)emas[p]=emaSeries(rows,p);
    const e21=emas[21],e50=emas[50],e200=emas[200],kd=kdSeries(rows);
    const all=[e21,e50,e200].every(v=>v.available);
    const alignment=!all?'長期趨勢資料不足':e21.value>e50.value&&e50.value>e200.value?'短、中、長期平均價格由高到低排列，目前趨勢偏多':e21.value<e50.value&&e50.value<e200.value?'短、中、長期平均價格由低到高排列，目前趨勢偏弱':'各期間均線方向不一致，暫時不以排列判定趨勢';
    const last=rows.at(-1),bias=e21.available?(last.close-e21.value)/e21.value*100:null;
    const b=kd.available?kd.cross==='黃金交叉'?'短線力道剛有轉強跡象，仍要看價格能否站穩':kd.cross==='死亡交叉'?'短線力道轉弱跡象，尚不能單憑交叉判定整段趨勢失敗':'短線暫無新的交叉，觀察價格與量能':kd.reason;
    const controls=controlPoints(rows);
    return {
      model:MODEL,kind,available:true,dataQuality:{available:true,dataDate:data.dataDate,bars:data.count,period:'已完成日K',volumeReady:rows.every(r=>r.volume!==null)},
      ema:{available:true,values:emas,alignment,bias21Pct:bias,shortDirection:e21.available?e21.direction:'資料不足',longTermReady:e200.available},
      kd:{...kd,plain:b},controls,risk:'本區只有輔助證據，不能代替原有進場檢查',originalDecisionUnchanged:true
    };
  }
  function price(v,digits=2){return num(v)===null?'資料不足':num(v).toLocaleString('zh-TW',{minimumFractionDigits:digits,maximumFractionDigits:digits});}
  function plain(e){
    if(!e?.available)return ['⚪ 新增趨勢資料不足：'+(e?.dataQuality?.reason||'請先取得可靠的已完成日K。'),'原有選股結果保持不變。'];
    const a=e.ema.values;
    return [
      `📈 趨勢背景：${e.ema.alignment}。${a[21].available?'21日平均價格'+a[21].direction:'21日平均價格資料不足'}；${a[200].available?'200日平均價格可參考':'長期日K不足，不能下長期結論'}。`,
      `📊 短線力道：${e.kd.available?e.kd.plain:'KD資料不足'}。${e.kd.available?`K ${price(e.kd.k,1)}、D ${price(e.kd.d,1)}；${e.kd.band}。`:''}`,
      `📍 現價距21日平均價格：${e.ema.bias21Pct===null?'資料不足':price(e.ema.bias21Pct,2)+'%'}；已確認控制低點：${e.controls?.lastLow?price(e.controls.lastLow.confirmedPrice)+'（'+e.controls.lastLow.confirmedAt+'才確認）':'尚未形成'}。`,
      `🕒 僅採用${e.dataQuality.dataDate}以前已完成的日K；這是補充證據，不是隔日買點，原有資格與風險檢查不變。`
    ];
  }
  return Object.freeze({MODEL,normalize,emaSeries,kdSeries,controlPoints,analyze,plain,price});
});
