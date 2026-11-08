import {convertAvatar} from './engine.mjs?v=2';
self.onmessage=async({data})=>{
  try {
    const result=await convertAvatar(new Uint8ClampedArray(data.pixels),data.width,data.height,data.options,new Uint8Array(data.icc),message=>self.postMessage({progress:message}));
    self.postMessage({result},[result.png.buffer,result.preview.buffer]);
  }catch(error){self.postMessage({error:error.message||'转换失败，请换一张图片重试。'});}
};
