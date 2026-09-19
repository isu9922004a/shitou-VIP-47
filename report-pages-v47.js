/* R4.5 研究候選：四大模組「完整文字內容」3:4加大字分頁圖；原有圖表PNG保持不變。 */
(function(){
'use strict';
const W=1200,H=1600,LEFT=64,RIGHT=64,TOP=148,BOTTOM=118,SIZE=26,HEIGHT=39;
const modes={
 stock:{title:'個股完整文字圖',data:()=>typeof lastReportData!=='undefined'?lastReportData:null,build:()=>buildReportText(lastReportData),root:'result'},
 market:{title:'大盤完整文字圖',data:()=>typeof lastMarketReportData!=='undefined'?lastMarketReportData:null,build:()=>buildMarketWorkerReportText(lastMarketReportData),root:'marketResult'},
 momentum:{title:'主升段完整文字圖',data:()=>typeof lastMomentumScanDataV3762!=='undefined'?lastMomentumScanDataV3762:null,build:()=>buildMomentumScanTextReportV3763(lastMomentumScanDataV3762),root:'momentumResult'},
 daytrade:{title:'當沖完整文字圖',data:()=>typeof lastDayTradeScanDataV1!=='undefined'?lastDayTradeScanDataV1:null,build:()=>buildDayTradeTextReportV1(lastDayTradeScanDataV1),root:'dayTradeResult'}
};
const state=new Map();
function setupCanvas(){const c=document.createElement('canvas');c.width=W;c.height=H;return c;}
function font(ctx){ctx.font=`800 ${SIZE}px "Noto Sans TC","Microsoft JhengHei",sans-serif`;ctx.textBaseline='top';}
function wrap(ctx,text,width){
 const parts=typeof Intl!=='undefined'&&Intl.Segmenter?[...new Intl.Segmenter('zh-TW',{granularity:'grapheme'}).segment(text)].map(s=>s.segment):Array.from(text);
 if(!parts.length)return [''];const lines=[];let s='';
 for(const ch of parts){if(s&&ctx.measureText(s+ch).width>width){lines.push(s);s=ch;}else s+=ch;
   if(ctx.measureText(s).width>width)throw Error('有單一文字超出圖片寬度，已停止排版而非裁切');}
 if(s)lines.push(s);return lines;
}
function paginate(text){
 const measure=setupCanvas().getContext('2d');font(measure);
 const lines=text.replace(/\r\n?/g,'\n').split('\n').flatMap(s=>wrap(measure,s,W-LEFT-RIGHT));
 const limit=Math.floor((H-TOP-BOTTOM)/HEIGHT),pages=[];
 for(let i=0;i<lines.length;i+=limit)pages.push(lines.slice(i,i+limit));
 if(!pages.length)pages.push(['目前沒有報告內容。']);
 const unchanged=pages.flat().join('')===text.replace(/\r\n?/g,'\n').replace(/\n/g,'');
 if(!unchanged)throw Error('文字內容比對失敗，停止產圖以避免截斷');
 return {pages,lines:lines.length,unchanged,limit};
}
function canvasPage(st,index){
 const c=setupCanvas(),x=c.getContext('2d'),pg=st.pages[index];
 x.fillStyle='#f7fafc';x.fillRect(0,0,W,H);x.fillStyle='#163954';x.fillRect(0,0,W,108);
 x.fillStyle='#fff';x.font='900 33px "Noto Sans TC",sans-serif';x.textBaseline='top';x.fillText(st.title,LEFT,20);
 x.font='700 20px sans-serif';x.fillText('完整文字分頁｜原判讀與數據不變',LEFT,69);
 x.fillStyle='#294969';x.font='800 22px "Noto Sans TC",sans-serif';x.fillText(`第 ${index+1}／${st.pages.length} 頁｜${st.date||'來源日期依原報告'}`,LEFT,115);
 font(x);x.fillStyle='#172d46';pg.forEach((ln,i)=>{x.fillText(ln,LEFT,TOP+i*HEIGHT);});
 x.strokeStyle='#cad6e1';x.beginPath();x.moveTo(LEFT,H-104);x.lineTo(W-RIGHT,H-104);x.stroke();
 x.fillStyle='#5b6879';x.font='750 19px "Noto Sans TC",sans-serif';x.fillText(`逐頁文字完整性已核對｜${index+1}/${st.pages.length}｜此為研究候選的3:4文字版，原圖表另存`,LEFT,H-84);
 x.fillText('技術分析僅供研究參考；原有進場限制與風險判讀不變。',LEFT,H-51);
 return c;
}
function blob(c){return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('圖片轉檔失敗')),'image/png'));}
function download(b,name){const url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),8000);}
const fileName=(kind,st,i)=>`石頭少爺_${kind}_完整文字圖_${st.date||'latest'}_${String(i+1).padStart(3,'0')}-${st.pages.length}_3比4_研究候選.png`;
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function u16(v){return [v&255,(v>>>8)&255];}function u32(v){return [v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];}
function makeZip(entries){
 const enc=new TextEncoder(),chunks=[],central=[];let offset=0;
 for(const {name,bytes} of entries){const n=enc.encode(name),size=bytes.length,crc=crc32(bytes);
   const header=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(size),...u32(size),...u16(n.length),...u16(0),...n]);chunks.push(header,bytes);
   const cd=new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(size),...u32(size),...u16(n.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...n]);central.push(cd);offset+=header.length+bytes.length;}
 let cdSize=0;central.forEach(b=>{cdSize+=b.length;chunks.push(b);});
 chunks.push(new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(entries.length),...u16(entries.length),...u32(cdSize),...u32(offset),...u16(0)]));
 return new Blob(chunks,{type:'application/zip'});
}
async function prepare(kind,st){const data=modes[kind].data();if(!data)throw Error('請先完成本模組的正式分析或掃描');
  if(document.fonts?.ready)await document.fonts.ready;
  const text=modes[kind].build();if(typeof text!=='string'||!text.trim())throw Error('完整文字報告尚未產生，停止輸出');
  const out=paginate(text),date=String(data.closeDate||data.createdAt||'').replace(/\D/g,'').slice(0,8);
  Object.assign(st,{...out,title:modes[kind].title,date,sourceText:text,kind,index:0});
  state.set(kind,st);return st;
}
function update(kind,st){const panel=document.querySelector(`[data-pages-kind="${kind}"]`);if(!panel)return;
  const img=panel.querySelector('img');img.src=canvasPage(st,st.index).toDataURL('image/png');
  panel.querySelector('.pages-audit-r45').textContent=`完整性：${st.unchanged?'逐字檢查通過':'未通過'}｜原文約 ${st.sourceText.length.toLocaleString()} 字｜分為 ${st.pages.length} 頁｜目前第 ${st.index+1} 頁`;
  panel.querySelector('[data-page-prev]').disabled=st.index===0;panel.querySelector('[data-page-next]').disabled=st.index>=st.pages.length-1;
  panel.querySelector('[data-page-group]').textContent=`下載第 ${Math.floor(st.index/10)*10+1}～${Math.min(st.pages.length,Math.floor(st.index/10)*10+10)} 頁 ZIP`;
}
async function group(kind,panel){const st=state.get(kind);if(!st)return;const button=panel.querySelector('[data-page-group]'),before=button.textContent;button.disabled=true;button.textContent='正在打包這一組完整頁面…';
 try{const start=Math.floor(st.index/10)*10,entries=[];for(let i=start;i<Math.min(st.pages.length,start+10);i++){
   const b=await blob(canvasPage(st,i)),bytes=new Uint8Array(await b.arrayBuffer());entries.push({name:fileName(kind,st,i),bytes});
 }
 const zip=makeZip(entries);download(zip,`石頭少爺_${kind}_第${start+1}-${start+entries.length}頁_研究候選.zip`);
 panel.querySelector('.pages-audit-r45').textContent=`✅ 已打包第 ${start+1}～${start+entries.length} 頁；全報告 ${st.pages.length} 頁，如超過10頁請移到下一組繼續下載。`;
 }catch(e){panel.querySelector('.pages-audit-r45').textContent='❌ 打包未完成：'+e.message;}finally{button.disabled=false;button.textContent=before;}
}
function mount(kind){const mode=modes[kind],root=document.getElementById(mode.root);if(!root)return;
 const panel=document.createElement('section');panel.className='panel pages-tool-r45';panel.dataset.pagesKind=kind;
 const title=document.createElement('h3');title.textContent='📄 '+mode.title+'｜3:4完整文字分頁（研究候選）';panel.append(title);
 const note=document.createElement('p');note.textContent='這是另外產生的完整文字分頁圖片；原有圖表、完整長圖及浮水印功能維持不變，尚未替換。';panel.append(note);
 const controls=document.createElement('div');controls.className='pages-actions-r45';controls.innerHTML='<button type="button" data-page-build>產生完整文字分頁</button><button type="button" data-page-prev disabled>上一頁</button><button type="button" data-page-next disabled>下一頁</button><button type="button" data-page-save disabled>下載目前頁 PNG</button><button type="button" data-page-group disabled>下載目前組 ZIP</button>';panel.append(controls);
 const audit=document.createElement('p');audit.className='pages-audit-r45';audit.textContent='請先完成分析，才能產生對應文字分頁。';panel.append(audit);
 const img=document.createElement('img');img.alt='3:4研究候選完整文字報告預覽';img.style.cssText='width:100%;max-width:600px;height:auto;display:block;margin:auto';panel.append(img);root.append(panel);
 const B=s=>panel.querySelector('[data-page-'+s+']');B('build').addEventListener('click',async()=>{try{let st=await prepare(kind,{});B('save').disabled=false;B('group').disabled=false;update(kind,st);}catch(e){audit.textContent='⚠️ '+e.message;}});
 B('prev').addEventListener('click',()=>{const st=state.get(kind);if(st){st.index=Math.max(0,st.index-1);update(kind,st);}});
 B('next').addEventListener('click',()=>{const st=state.get(kind);if(st){st.index=Math.min(st.pages.length-1,st.index+1);update(kind,st);}});
 B('save').addEventListener('click',async()=>{try{const st=state.get(kind);if(st)download(await blob(canvasPage(st,st.index)),fileName(kind,st,st.index));}catch(e){audit.textContent='⚠️ '+e.message;}});
 B('group').addEventListener('click',()=>group(kind,panel));
}
Object.keys(modes).forEach(mount);
window.SHITO_R45_PAGES_AUDIT={installed:true,size:`${W}x${H}`,mode:'FULL_TEXT_ONLY_NOT_ORIGINAL_CHARTS',reportModes:Object.keys(modes)};
})();
