import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {SIZE,WHITE,srgbToLinear,linearToSrgb,to2020,pqEncode,pqDecode,makeMatte,hammingResize,composeAvatar,convertAvatar,crc32,validateProfile} from './engine.mjs';
assert.ok(Math.abs(pqEncode(203)-.580688881)<1e-8);
for(const n of [.1,1,203,1000,2030,10000])assert.ok(Math.abs(pqDecode(pqEncode(n))-n)<.00001);
for(const v of [0,.02,.4,1])assert.ok(Math.abs(linearToSrgb(srgbToLinear(v))-v)<1e-9);
assert.ok(to2020(1,1,1).every(v=>Math.abs(v-1)<1e-6));
const constant=Float32Array.from({length:32*32*4},(_,i)=>i%4===3?.5:.2);
const reduced=hammingResize(constant,32,32,8,8,.25,16,16);
assert.ok([...reduced].every(v=>v>=0&&v<=.500001),'Hamming may not overshoot');
assert.ok(Math.abs(reduced[(4*8+4)*4]-.2)<1e-6);
const opaque=new Uint8ClampedArray(64*64*4);opaque.fill(255);
for(let y=16;y<48;y++)for(let x=16;x<48;x++){const k=(y*64+x)*4;opaque[k]=opaque[k+1]=opaque[k+2]=0;}
// A white island inside the head must not be mistaken for background.
for(let y=28;y<36;y++)for(let x=28;x<36;x++){const k=(y*64+x)*4;opaque[k]=opaque[k+1]=opaque[k+2]=255;}
const matte=makeMatte(opaque,64,64,{mode:'key',key:[255,255,255]});
assert.equal(matte.rgba[3],0);assert.equal(matte.rgba[(32*64+32)*4+3],1);
// A translucent dark strand blended into white should retain alpha, not a white fringe.
const strand=(12*64+32)*4,gray=Math.round(linearToSrgb(.5)*255);
opaque[strand]=opaque[strand+1]=opaque[strand+2]=gray;
const hair=makeMatte(opaque,64,64,{mode:'key',key:[255,255,255]});
assert.ok(hair.rgba[strand+3]>.45&&hair.rgba[strand+3]<.55,'preserve mixed hair alpha');
assert.ok(hair.rgba[strand]<.02,'remove the white background from premultiplied hair');
const iccPath=process.argv[2]||new URL('./rec2100-pq.icc',import.meta.url);
const icc=new Uint8Array(await readFile(iccPath));assert.equal(validateProfile(icc),true);
const w=256,h=256,pixels=new Uint8ClampedArray(w*h*4);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const k=(y*w+x)*4;
  if(((x-128)/55)**2+((y-132)/80)**2<=1){pixels[k]=Math.round(165+60*x/w);pixels[k+1]=Math.round(100+70*y/h);pixels[k+2]=95;pixels[k+3]=255;}
}
const options={mode:'auto',background:'#d2fff9',personGain:1.8,backgroundGain:10,scale:1};
const result=await convertAvatar(pixels,w,h,options,icc);
const order=[];let pos=8,profile;
while(pos<result.png.length){
  const view=new DataView(result.png.buffer,result.png.byteOffset+pos),length=view.getUint32(0),type=new TextDecoder().decode(result.png.subarray(pos+4,pos+8)),data=result.png.subarray(pos+8,pos+8+length);
  assert.equal(crc32(result.png.subarray(pos+4,pos+8+length)),view.getUint32(8+length),type+' CRC');order.push(type);
  if(type==='IHDR'){assert.equal(view.getUint32(8),400);assert.equal(view.getUint32(12),400);assert.equal(data[8],8);assert.equal(data[9],3);}
  if(type==='cICP')assert.deepEqual([...data],[9,16,0,1]);
  if(type==='iCCP'){profile=inflateSync(data.subarray(data.indexOf(0)+2));assert.deepEqual([...profile],[...icc]);}
  if(type==='PLTE')assert.equal(data.length,255*3);
  if(type==='IDAT'){const decoded=inflateSync(data);assert.equal(decoded.length,401*400);assert.equal(decoded[1],0,'pure background must use reserved palette index');}
  pos+=12+length;
}
assert.deepEqual(order,['IHDR','cICP','iCCP','PLTE','IDAT','IEND']);assert.equal(pos,result.png.length);
assert.ok(result.stats.peak>9.5&&result.stats.peak<10.5);
assert.ok(result.stats.personPeak<=2.25);
assert.ok(result.stats.brightArea>.4&&result.stats.brightArea<.6);
assert.ok(result.stats.smallBrightArea>.4&&result.stats.smallBrightArea<.6);
if(process.argv[3])await writeFile(process.argv[3],result.png);
console.log('HDR pipeline verified:',JSON.stringify(result.stats),'PNG CRC/order/profile verified');
