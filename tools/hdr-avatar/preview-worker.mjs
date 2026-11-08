import {makeMatte,composeAvatar,applyPreviewShape} from './engine.mjs?v=2';
let source=null,matte=null,matteKey='';
self.onmessage=({data})=>{
  if(data.type==='source'){source={bytes:new Uint8ClampedArray(data.pixels),width:data.width,height:data.height};matte=null;matteKey='';return;}
  if(!source)return;
  try{
    const {options,id}=data,key=JSON.stringify([options.mode,options.key,options.tolerance,options.softness]);
    if(!matte||key!==matteKey){matte=makeMatte(source.bytes,source.width,source.height,options);matteKey=key;}
    const {preview}=composeAvatar(matte,options);applyPreviewShape(preview,options);
    self.postMessage({id,preview},[preview.buffer]);
  }catch(error){self.postMessage({id:data.id,error:error.message});}
};
