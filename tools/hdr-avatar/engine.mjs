// All image calculations are local. RGB arrays use linear-light BT.2020 nits.
export const SIZE = 400;
export const WHITE = 203;
export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const srgbToLinear = v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
export const linearToSrgb = v => v <= .0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - .055;
export const to2020 = (r, g, b) => [.6274039*r+.3292830*g+.0433131*b, .0690973*r+.9195404*g+.0113623*b, .0163914*r+.0880133*g+.8955953*b];
export const from2020 = (r, g, b) => [1.660491*r-.587641*g-.072850*b, -.124550*r+1.132900*g-.008349*b, -.018151*r-.100579*g+1.118730*b];
export const luminance = (r, g, b) => .2627*r + .6780*g + .0593*b;
export function pqEncode(nits) {
  const p = (clamp(nits, 0, 10000) / 10000) ** (2610 / 16384);
  return ((3424 / 4096 + (2413 / 128)*p) / (1 + (2392 / 128)*p)) ** (2523 / 32);
}
export function pqDecode(v) {
  const p = clamp(v) ** (32 / 2523);
  return 10000 * (Math.max(p - 3424 / 4096, 0) / (2413 / 128 - (2392 / 128)*p)) ** (16384 / 2610);
}
export const colorBytes = hex => hex.match(/[a-f\d]{2}/gi).map(v => parseInt(v, 16));
export function backgroundColor(hex, gain = 10) {
  const rgb = to2020(...colorBytes(hex).map(v => srgbToLinear(v / 255)));
  const scale = WHITE * gain / luminance(...rgb);
  return rgb.map(v => v * scale);
}
export function guessBackground(data, w, h) {
  const samples = [];
  const k = Math.max(1, Math.floor(Math.min(w, h) * .035));
  for (const [cx, cy] of [[0,0],[w-k,0],[0,h-k],[w-k,h-k]]) {
    const rgb = [0,0,0]; let count = 0;
    for (let y=cy;y<cy+k;y++) for(let x=cx;x<cx+k;x++) {
      const i=(y*w+x)*4; if(data[i+3]<250) continue;
      for(let c=0;c<3;c++) rgb[c]+=data[i+c]; count++;
    }
    if(count) samples.push(rgb.map(v=>v/count));
  }
  if(!samples.length) return [255,255,255];
  // Pick the corner with the greatest agreement, rather than averaging unrelated colors.
  return samples.map(a=>({a,score:samples.reduce((s,b)=>s+Math.hypot(...a.map((v,c)=>v-b[c])),0)})).sort((a,b)=>a.score-b.score)[0].a.map(Math.round);
}
export function makeMatte(bytes, w, h, options) {
  const n=w*h, rgba=new Float32Array(n*4), alpha=new Float32Array(n);
  const bg=(options.key || guessBackground(bytes,w,h)).map(v=>srgbToLinear(v/255));
  const tolerance=options.tolerance ?? .04, softness=options.softness ?? .22;
  let transparent=false;
  for(let i=3;i<bytes.length;i+=4) if(bytes[i]<250) {transparent=true;break;}
  const keying=options.mode==='key' || (options.mode!=='keep' && !transparent);
  const distance=new Float32Array(n);
  for(let i=0;i<n;i++) {
    const k=i*4;
    for(let c=0;c<3;c++) rgba[k+c]=srgbToLinear(bytes[k+c]/255);
    distance[i]=Math.hypot(rgba[k]-bg[0],rgba[k+1]-bg[1],rgba[k+2]-bg[2]);
    alpha[i]=bytes[k+3]/255;
  }
  if(keying) {
    // Remove only background connected to the image perimeter. Enclosed matching colors survive.
    const connected=new Uint8Array(n), queue=new Int32Array(n); let head=0,tail=0;
    const add=i=>{if(!connected[i] && distance[i]<tolerance+softness){connected[i]=1;queue[tail++]=i;}};
    for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}
    for(let y=1;y<h-1;y++){add(y*w);add(y*w+w-1);}
    while(head<tail){const i=queue[head++],x=i%w;if(x)add(i-1);if(x<w-1)add(i+1);if(i>=w)add(i-w);if(i<n-w)add(i+w);}
    // Include a narrow foreground-side band: a half-transparent dark hair can be
    // far from the background in RGB distance, despite being only one pixel wide.
    const band=connected.slice();let start=0,end=tail;
    const expand=i=>{if(!band[i]){band[i]=1;queue[tail++]=i;}};
    for(let step=0;step<3;step++){
      for(let j=start;j<end;j++){const i=queue[j],x=i%w;if(x)expand(i-1);if(x<w-1)expand(i+1);if(i>=w)expand(i-w);if(i<n-w)expand(i+w);}
      start=end;end=tail;
    }
    const nearest=new Int32Array(n);nearest.fill(-1);head=0;tail=0;
    for(let i=0;i<n;i++) {
      if(!band[i]) {nearest[i]=i;queue[tail++]=i;}
    }
    // Propagate a nearby opaque foreground color to solve C = aF + (1-a)B at fine hairs.
    const extend=(i,source)=>{if(nearest[i]<0){nearest[i]=source;queue[tail++]=i;}};
    while(head<tail){const i=queue[head++],x=i%w,s=nearest[i];if(x)extend(i-1,s);if(x<w-1)extend(i+1,s);if(i>=w)extend(i-w,s);if(i<n-w)extend(i+w,s);}
    for(let i=0;i<n;i++) if(band[i]) {
      const k=i*4,s=nearest[i]*4;
      if(distance[i]<=tolerance || s<0) {alpha[i]=0;continue;}
      let numerator=0,denominator=0;
      for(let c=0;c<3;c++){const f=rgba[s+c]-bg[c];numerator+=(rgba[k+c]-bg[c])*f;denominator+=f*f;}
      const a=clamp(numerator/Math.max(denominator,1e-9));
      alpha[i]*=a;
      for(let c=0;c<3;c++) rgba[k+c]=clamp((rgba[k+c]-(1-a)*bg[c])/Math.max(a,1e-6));
    }
  }
  let left=w,top=h,right=0,bottom=0,visible=0;
  for(let i=0;i<n;i++) {
    const k=i*4,a=alpha[i]; rgba[k+3]=a;
    for(let c=0;c<3;c++)rgba[k+c]*=a;
    if(a>.05){const x=i%w,y=Math.floor(i/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);visible++;}
  }
  if(!visible)throw new Error('没有找到可保留的人物。请重新取背景色，或切换为保留原图。');
  return {rgba,w,h,bounds:{left,top,right,bottom},keying};
}
const hamming=x=>Math.abs(x)>=1?0:Math.abs(x)<1e-8?1:Math.sin(Math.PI*x)/(Math.PI*x)*(.54+.46*Math.cos(Math.PI*x));
function axisWeights(input, output, scale, center, shift) {
  const filter=Math.min(1,scale), support=1/filter;
  return Array.from({length:output},(_,x)=>{
    const position=center+(x+.5-output/2-shift)/scale-.5;
    const start=Math.ceil(position-support),end=Math.floor(position+support),pairs=[];let total=0;
    for(let i=start;i<=end;i++){const weight=hamming((i-position)*filter);total+=weight;if(i>=0&&i<input)pairs.push([i,weight]);}
    return pairs.map(([i,v])=>[i,v/Math.max(total,1e-12)]);
  });
}
export function hammingResize(rgba,w,h,outW,outH,scale,cx,cy,dx=0,dy=0) {
  const wx=axisWeights(w,outW,scale,cx,dx),wy=axisWeights(h,outH,scale,cy,dy);
  const horizontal=new Float32Array(outW*h*4),out=new Float32Array(outW*outH*4);
  // Alpha and premultiplied RGB are filtered as separate channels with identical positive kernels.
  for(let y=0;y<h;y++)for(let x=0;x<outW;x++)for(const [sx,weight] of wx[x]) {
    const a=(y*w+sx)*4,b=(y*outW+x)*4;for(let c=0;c<4;c++)horizontal[b+c]+=rgba[a+c]*weight;
  }
  for(let y=0;y<outH;y++)for(let x=0;x<outW;x++)for(const [sy,weight]of wy[y]) {
    const a=(sy*outW+x)*4,b=(y*outW+x)*4;for(let c=0;c<4;c++)out[b+c]+=horizontal[a+c]*weight;
  }
  return out;
}
function autoScale(matte) {
  const {w,h,bounds:b,rgba}=matte,cx=(b.left+b.right+1)/2,cy=(b.top+b.bottom+1)/2;
  let lo=SIZE*.25/Math.max(b.right-b.left+1,b.bottom-b.top+1),hi=lo*8;
  for(let step=0;step<14;step++) {
    const scale=(lo+hi)/2;let bright=0,count=0;
    for(let y=0;y<48;y++)for(let x=0;x<48;x++)if((x+.5-24)**2+(y+.5-24)**2<=24**2){
      const sx=Math.floor(cx+(x+.5-24)*SIZE/48/scale),sy=Math.floor(cy+(y+.5-24)*SIZE/48/scale);
      const a=sx<0||sx>=w||sy<0||sy>=h?0:rgba[(sy*w+sx)*4+3];bright+=a<.8?1:0;count++;
    }
    if(bright/count>.5)lo=scale;else hi=scale;
  }
  return {scale:(lo+hi)/2,cx,cy};
}
export function composeAvatar(matte, options) {
  const layout=autoScale(matte),scale=layout.scale*(options.scale??1);
  const rgba=hammingResize(matte.rgba,matte.w,matte.h,SIZE,SIZE,scale,layout.cx,layout.cy,options.dx||0,options.dy||0);
  const bg=backgroundColor(options.background||'#d2fff9',options.backgroundGain??10);
  const linear=new Float32Array(SIZE*SIZE*3),pq=new Uint8Array(linear.length),alpha=new Float32Array(SIZE*SIZE);
  const preview=new Uint8ClampedArray(SIZE*SIZE*4),gain=options.personGain??1.8;
  const levels=[];
  for(let i=0;i<matte.rgba.length;i+=16){const a=matte.rgba[i+3];if(a>.98){const y=luminance(...to2020(matte.rgba[i]/a,matte.rgba[i+1]/a,matte.rgba[i+2]/a));if(y>.005)levels.push(y);}}
  levels.sort((a,b)=>a-b);
  // Normalize the foreground's upper midtones independently of the ten-times-brighter background.
  const reference=levels.length?Math.max(.04,levels[Math.floor((levels.length-1)*.9)]):1;
  const previewBg=colorBytes(options.background||'#d2fff9').map(v=>srgbToLinear(v/255));
  for(let i=0;i<SIZE*SIZE;i++) {
    const k=i*4,a=clamp(rgba[k+3]);alpha[i]=a;
    const rgb=to2020(rgba[k],rgba[k+1],rgba[k+2]);
    const multiplier=WHITE*gain/reference;
    const max=luminance(...rgb)*multiplier;
    const limit=max>WHITE*2.2*a?WHITE*2.2*a/max:1;
    for(let c=0;c<3;c++){
      const v=rgb[c]*multiplier*limit+bg[c]*(1-a);linear[i*3+c]=v;pq[i*3+c]=Math.round(pqEncode(v)*255);
      preview[k+c]=Math.round(clamp(linearToSrgb(rgba[k+c]+previewBg[c]*(1-a)))*255);
    }
    preview[k+3]=255;
  }
  return {linear,pq,alpha,preview,background:bg.map(v=>Math.round(pqEncode(v)*255))};
}
const distance=(a,b)=>{let s=0;for(let c=0;c<3;c++)s+=(a[c]-b[c])**2;return s;};
export function makePalette(pq,alpha,background,count=254) {
  const histogram=new Map();
  for(let i=0;i<alpha.length;i++)if(alpha[i]>.0001){
    const rgb=[pq[i*3],pq[i*3+1],pq[i*3+2]],key=((rgb[0]>>2)<<12)|((rgb[1]>>2)<<6)|(rgb[2]>>2);
    let p=histogram.get(key);if(!p){p={rgb:[0,0,0],n:0};histogram.set(key,p);}p.n++;for(let c=0;c<3;c++)p.rgb[c]+=rgb[c];
  }
  const points=[...histogram.values()].map(p=>({rgb:p.rgb.map(v=>v/p.n),n:p.n}));
  const box=pts=>{
    const low=[255,255,255],high=[0,0,0];let n=0;
    for(const p of pts){n+=p.n;for(let c=0;c<3;c++){low[c]=Math.min(low[c],p.rgb[c]);high[c]=Math.max(high[c],p.rgb[c]);}}
    const ranges=high.map((v,c)=>v-low[c]),axis=ranges.indexOf(Math.max(...ranges));
    return {pts,n,axis,score:ranges[axis]*n};
  };
  const boxes=points.length?[box(points)]:[];
  while(boxes.length<count){
    let at=-1;for(let i=0;i<boxes.length;i++)if(boxes[i].pts.length>1&&(at<0||boxes[i].score>boxes[at].score))at=i;
    if(at<0)break;const current=boxes.splice(at,1)[0];current.pts.sort((a,b)=>a.rgb[current.axis]-b.rgb[current.axis]);
    let weight=0,cut=1;for(;cut<current.pts.length;cut++){weight+=current.pts[cut-1].n;if(weight>=current.n/2)break;}cut=Math.min(cut,current.pts.length-1);
    boxes.push(box(current.pts.slice(0,cut)),box(current.pts.slice(cut)));
  }
  let centers=boxes.map(b=>[0,1,2].map(c=>b.pts.reduce((s,p)=>s+p.rgb[c]*p.n,0)/b.n));
  for(let iteration=0;iteration<5;iteration++){
    const sums=centers.map(()=>[0,0,0,0]);
    for(const p of points){let best=0,error=Infinity;for(let j=0;j<centers.length;j++){const e=distance(p.rgb,centers[j]);if(e<error){error=e;best=j;}}
      for(let c=0;c<3;c++)sums[best][c]+=p.rgb[c]*p.n;sums[best][3]+=p.n;}
    centers=centers.map((p,i)=>sums[i][3]?sums[i].slice(0,3).map(v=>v/sums[i][3]):p);
  }
  const colors=[background,...centers.map(p=>p.map(v=>Math.round(v)))];
  while(colors.length<255)colors.push([...(colors.at(-1)||background)]);
  return colors;
}
export function dither(pq,alpha,colors,width=SIZE) {
  const height=alpha.length/width,indices=new Uint8Array(alpha.length),error=new Float32Array((width+2)*3),next=new Float32Array(error.length);
  const light=colors.map(p=>luminance(...p.map(v=>pqDecode(v/255))));
  const nearest=(rgb,solid)=>{let best=1,dist=Infinity;for(let j=1;j<colors.length;j++){if(solid&&light[j]>WHITE*2.2*1.025)continue;const d=distance(rgb,colors[j]);if(d<dist){best=j;dist=d;}}return best;};
  for(let y=0;y<height;y++){
    next.fill(0);
    for(let x=0;x<width;x++){
      const i=y*width+x,e=(x+1)*3;
      if(alpha[i]<.0001){indices[i]=0;for(let c=0;c<3;c++)error[e+c]=0;continue;}
      const original=[pq[i*3],pq[i*3+1],pq[i*3+2]],rgb=original.map((v,c)=>clamp(v+error[e+c],0,255));
      let j=nearest(rgb,alpha[i]>.995);
      // Remove quantizer sparkle: bound original-color error and luminance excursions after diffusion.
      if(distance(original,colors[j])>100 || (alpha[i]>.995 && light[j]>WHITE*2.2))j=nearest(original,alpha[i]>.995);
      indices[i]=j;
      for(let c=0;c<3;c++){const d=clamp(rgb[c]-colors[j][c],-12,12);error[e+3+c]+=d*7/16;next[e-3+c]+=d*3/16;next[e+c]+=d*5/16;next[e+3+c]+=d/16;}
    }
    error.set(next);
  }
  return indices;
}
export function analyze(indices,colors,size=SIZE) {
  const rgb=new Float32Array(indices.length*4);let peak=0,bright=0,total=0,personPeak=0;
  for(let i=0;i<indices.length;i++){
    const p=colors[indices[i]].map(v=>pqDecode(v/255));for(let c=0;c<3;c++)rgb[i*4+c]=p[c];rgb[i*4+3]=1;
    const x=i%size+.5-size/2,y=Math.floor(i/size)+.5-size/2;
    if(x*x+y*y<=(size/2)**2){const l=luminance(...p)/WHITE;peak=Math.max(peak,l);bright+=l>3?1:0;total++;}
  }
  const small=hammingResize(rgb,size,size,48,48,48/size,size/2,size/2);let smallBright=0,smallTotal=0;
  for(let y=0;y<48;y++)for(let x=0;x<48;x++)if((x+.5-24)**2+(y+.5-24)**2<=24**2){const i=(y*48+x)*4;smallBright+=luminance(small[i],small[i+1],small[i+2])>WHITE*3?1:0;smallTotal++;}
  return {peak,brightArea:bright/total,smallBrightArea:smallBright/smallTotal,colors:colors.length};
}
const encoder=new TextEncoder();
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
export function join(parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;}
export function chunk(type,bytes){const out=new Uint8Array(bytes.length+12),view=new DataView(out.buffer);view.setUint32(0,bytes.length);out.set(encoder.encode(type),4);out.set(bytes,8);view.setUint32(out.length-4,crc32(out.subarray(4,out.length-4)));return out;}
export async function deflate(bytes){const stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));return new Uint8Array(await new Response(stream).arrayBuffer());}
export function validateProfile(icc){
  if(icc.length<132)throw new Error('ICC 文件过短');const v=new DataView(icc.buffer,icc.byteOffset,icc.byteLength),text=(o,n)=>String.fromCharCode(...icc.subarray(o,o+n));
  if(v.getUint32(0)!==icc.length||text(36,4)!=='acsp'||text(16,4)!=='RGB ')throw new Error('ICC 不是有效的 RGB 色彩配置');
  const count=v.getUint32(128);if(count>100||132+count*12>icc.length)throw new Error('ICC 标签表无效');
  for(let i=0;i<count;i++){const pos=132+i*12,offset=v.getUint32(pos+4),size=v.getUint32(pos+8);if(offset+size>icc.length)throw new Error('ICC 标签越界');if(text(pos,4)==='cicp'&&size>=12&&text(offset,4)==='cicp'&&[9,16,0,1].every((n,c)=>icc[offset+8+c]===n))return true;}
  throw new Error('ICC 需要包含 BT.2020 / PQ / 全范围的 cicp 标签');
}
export async function encodePng(indices,colors,icc,size=SIZE){
  validateProfile(icc);
  const ihdr=new Uint8Array(13),v=new DataView(ihdr.buffer);v.setUint32(0,size);v.setUint32(4,size);ihdr[8]=8;ihdr[9]=3;
  const scan=new Uint8Array((size+1)*size);for(let y=0;y<size;y++)scan.set(indices.subarray(y*size,(y+1)*size),y*(size+1)+1);
  const profile=join([encoder.encode('Rec2100 PQ'),new Uint8Array([0,0]),await deflate(icc)]);
  return join([new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('cICP',new Uint8Array([9,16,0,1])),chunk('iCCP',profile),chunk('PLTE',new Uint8Array(colors.flat())),chunk('IDAT',await deflate(scan)),chunk('IEND',new Uint8Array())]);
}
export async function convertAvatar(bytes,w,h,options,icc,progress=()=>{}){
  progress('正在分离背景与发丝…');const matte=makeMatte(bytes,w,h,options);
  progress('正在以 Hamming 滤镜缩小并合成亮度…');const composed=composeAvatar(matte,options);
  progress('正在生成调色板与消除亮点…');const colors=makePalette(composed.pq,composed.alpha,composed.background),indices=dither(composed.pq,composed.alpha,colors);
  const stats=analyze(indices,colors);let personPeak=0;
  for(let i=0;i<indices.length;i++)if(composed.alpha[i]>.995)personPeak=Math.max(personPeak,luminance(...colors[indices[i]].map(v=>pqDecode(v/255)))/WHITE);
  stats.personPeak=personPeak;stats.keying=matte.keying;
  progress('正在写入 HDR 色彩配置与 PNG 校验…');const png=await encodePng(indices,colors,icc);
  return {png,preview:composed.preview,stats,key:options.key||guessBackground(bytes,w,h)};
}
