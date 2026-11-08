import {guessBackground} from './engine.mjs';
const $=s=>document.querySelector(s);
let image=null,worker=null,outputUrl=null,profile=null,background='#d2fff9',dirty=false,job=0;
const controls=[...document.querySelectorAll('.settings input:not([type=file]),.settings select,.swatches button')];
const status=message=>{$('#status').textContent=message;};
const hex=rgb=>'#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
async function loadProfile(){
  if(!profile)profile=fetch('./rec2100-pq.icc').then(r=>{if(!r.ok)throw Error('色彩配置未能加载，请刷新页面后重试。');return r.arrayBuffer();}).catch(e=>{profile=null;throw e;});
  return profile;
}
function options(){return {mode:$('#mode').value,key:$('#key').value.match(/\w\w/g).map(v=>parseInt(v,16)),tolerance:+$('#tolerance').value,softness:+$('#softness').value,background,backgroundGain:+$('#backgroundGain').value,personGain:+$('#personGain').value,scale:+$('#scale').value/100,dx:+$('#dx').value,dy:+$('#dy').value};}
function invalidate(){
  dirty=true;$('#download').disabled=true;$('#download-sdr').disabled=true;$('#hdr-tab').disabled=true;setView(false);
  if(worker){job++;worker.terminate();worker=null;}
  $('#generate').disabled=!image;$('#generate').firstChild.textContent='生成 HDR 头像 ';
  if(image)status('设置已调整，点击「生成 HDR 头像」更新预览与文件。');
}
function setView(hdr){
  $('#hdr-image').hidden=!hdr;$('#preview').hidden=hdr;
  $('#sdr-tab').setAttribute('aria-pressed',String(!hdr));$('#hdr-tab').setAttribute('aria-pressed',String(hdr));
  $('#preview-caption').textContent=hdr?'真实 HDR 文件 · 显示效果取决于设备与系统支持':'SDR 构图模拟 · 不代表屏幕上的真实 HDR 亮度';
}
function drawSource(){
  const canvas=$('#source'),ratio=Math.min(320/image.width,240/image.height);canvas.width=Math.round(image.width*ratio);canvas.height=Math.round(image.height*ratio);
  const original=document.createElement('canvas');original.width=image.width;original.height=image.height;original.getContext('2d').putImageData(image,0,0);
  canvas.getContext('2d').drawImage(original,0,0,canvas.width,canvas.height);
}
async function acceptFile(file){
  if(!file)return;
  try {
    if(!/^image\/(png|jpeg|webp|avif)$/.test(file.type))throw Error('请使用 PNG、JPG、WebP 或 AVIF 图片。');
    if(file.size>20*1024*1024)throw Error('图片超过 20 MB，请先裁切或缩小后再上传。');
    status('正在读取图片…');const bitmap=await createImageBitmap(file,{colorSpaceConversion:'default'});
    if(bitmap.width*bitmap.height>8000000){bitmap.close();throw Error('图片超过 800 万像素，请先裁切为头像大小。');}
    const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
    const ctx=canvas.getContext('2d',{colorSpace:'srgb',willReadFrequently:true});ctx.drawImage(bitmap,0,0);bitmap.close();
    image=ctx.getImageData(0,0,canvas.width,canvas.height);$('#filename').textContent=file.name;document.body.classList.add('has-image');
    $('#key').value=hex(guessBackground(image.data,image.width,image.height));drawSource();invalidate();await generate();
  }catch(e){status(e.message);}
}
async function generate(){
  if(!image)return;
  const current=++job;if(worker)worker.terminate();
  $('#generate').disabled=true;$('#download').disabled=true;$('#download-sdr').disabled=true;$('#hdr-tab').disabled=true;
  status('正在准备色彩配置…');setView(false);
  try {
    if(typeof CompressionStream==='undefined')throw Error('当前浏览器不支持 PNG 编码，请使用新版 Chrome、Edge 或 Safari。');
    const icc=(await loadProfile()).slice(0);if(current!==job)return;
    worker=new Worker('./worker.mjs',{type:'module'});
    worker.onerror=()=>{if(current!==job)return;status('转换未能完成，请减小图片或使用新版浏览器重试。');$('#generate').disabled=false;worker?.terminate();worker=null;};
    worker.onmessage=({data})=>{
      if(current!==job)return;if(data.progress){status(data.progress);return;}
      $('#generate').disabled=false;worker.terminate();worker=null;
      if(data.error){status(data.error);return;}
      const {png,preview,stats}=data.result;
      $('#preview').getContext('2d').putImageData(new ImageData(preview,400,400),0,0);
      // This canvas is only an SDR UI thumbnail; the 48px HDR metric is calculated in linear light.
      const small=$('#small').getContext('2d');small.clearRect(0,0,48,48);small.drawImage($('#preview'),0,0,48,48);
      if(outputUrl)URL.revokeObjectURL(outputUrl);outputUrl=URL.createObjectURL(new Blob([png],{type:'image/png'}));$('#hdr-image').src=outputUrl;
      $('#empty-state').hidden=true;$('#peak').textContent=stats.peak.toFixed(1)+'×';$('#area').textContent=(stats.brightArea*100).toFixed(0)+'%';$('#small-area').textContent=(stats.smallBrightArea*100).toFixed(0)+'%';
      const balanced=stats.smallBrightArea>=.4&&stats.smallBrightArea<=.6;
      $('#composition-note').textContent=(balanced?'亮区比例合适。':'亮区比例偏'+(stats.smallBrightArea<.4?'少，试着缩小人物。':'多，试着放大人物。'))+'人物最高约 '+stats.personPeak.toFixed(2)+'×；背景最高约 '+Math.round(stats.peak*203)+' 尼特。';
      $('#download').disabled=false;$('#download-sdr').disabled=false;$('#hdr-tab').disabled=false;dirty=false;
      status('已生成 · 400 × 400 · HDR 色彩配置已嵌入。');
    };
    const pixels=image.data.slice();worker.postMessage({pixels:pixels.buffer,width:image.width,height:image.height,options:options(),icc},[pixels.buffer,icc]);
  }catch(e){if(current!==job)return;status(e.message);$('#generate').disabled=false;}
}
$('#file').addEventListener('change',e=>acceptFile(e.target.files[0]));
const drop=$('#drop-zone');for(const name of ['dragenter','dragover'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.add('dragging');});
for(const name of ['dragleave','drop'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.remove('dragging');if(name==='drop')acceptFile(e.dataTransfer.files[0]);});
controls.forEach(control=>control.addEventListener('input',()=>{
  for(const id of ['tolerance','softness','backgroundGain','personGain','scale']){
    const suffix=id==='scale'?'%':id.includes('Gain')?'×':'';$('#'+id+'-value').value=(id.includes('Gain')?(+$('#'+id).value).toFixed(1):$('#'+id).value)+suffix;
  }
  invalidate();
}));
document.querySelectorAll('[data-background]').forEach(button=>button.addEventListener('click',()=>{
  background=button.dataset.background;document.querySelectorAll('[data-background]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});invalidate();
}));
$('#guess').addEventListener('click',()=>{if(!image)return;$('#key').value=hex(guessBackground(image.data,image.width,image.height));invalidate();});
$('#source').addEventListener('click',e=>{
  if(!image)return;const box=e.currentTarget.getBoundingClientRect(),x=Math.min(image.width-1,Math.floor((e.clientX-box.left)/box.width*image.width)),y=Math.min(image.height-1,Math.floor((e.clientY-box.top)/box.height*image.height));
  const i=(y*image.width+x)*4;$('#key').value=hex([...image.data.slice(i,i+3)]);$('#mode').value='key';invalidate();
});
$('#reset-position').addEventListener('click',()=>{for(const id of ['dx','dy'])$('#'+id).value=0;$('#scale').value=100;$('#scale-value').value='100%';invalidate();});
$('#generate').addEventListener('click',generate);$('#sdr-tab').addEventListener('click',()=>setView(false));$('#hdr-tab').addEventListener('click',()=>setView(true));
function download(url,name){const a=document.createElement('a');a.href=url;a.download=name;a.click();}
$('#download').addEventListener('click',()=>{if(!dirty&&outputUrl)download(outputUrl,'xueyu-hdr-avatar.png');});
$('#download-sdr').addEventListener('click',()=>{if(!dirty)download($('#preview').toDataURL('image/png'),'xueyu-avatar-preview.png');});
$('#demo').addEventListener('click',()=>{
  const canvas=document.createElement('canvas');canvas.width=600;canvas.height=600;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#d9ece9';ctx.fillRect(0,0,600,600);
  ctx.fillStyle='#283d4c';ctx.beginPath();ctx.ellipse(300,565,148,180,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#e9b993';ctx.fillRect(268,350,64,100);ctx.beginPath();ctx.ellipse(300,280,95,120,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#29262e';ctx.beginPath();ctx.ellipse(296,198,104,68,-.16,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(210,270,23,80,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#211f28';for(const x of [264,338]){ctx.beginPath();ctx.ellipse(x,285,5,7,0,0,Math.PI*2);ctx.fill();}
  ctx.strokeStyle='#a96f63';ctx.lineWidth=4;ctx.beginPath();ctx.arc(302,329,25,.15,Math.PI-.15);ctx.stroke();
  ctx.strokeStyle='#45424c';ctx.lineWidth=1;for(let i=0;i<18;i++){ctx.beginPath();ctx.moveTo(200+i*9,177);ctx.quadraticCurveTo(180+i*9,115+(i%4)*7,189+i*9,148);ctx.stroke();}
  canvas.toBlob(blob=>acceptFile(new File([blob],'示例头像.png',{type:'image/png'})));
});
