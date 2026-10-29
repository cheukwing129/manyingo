const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'public/mascot/manifest.json'),'utf8')),failures=[];
const expected=['neutral','happy','celebrate','encouraging','thinking','determined'];
if(manifest.version!==2||manifest.artFamily!=='logo-aligned-gpt-image-v2')failures.push('expected approved GPT Image v2 family');
if(JSON.stringify(manifest.states.map(s=>s.id))!==JSON.stringify(expected))failures.push('canonical state identities changed');
const files=new Set([...manifest.states.map(s=>s.asset),manifest.compactAsset,manifest.completionAsset]);
for(const asset of files){
 if(!/^\.\/mascot\/v2\/[a-z]+\.svg$/.test(asset)){failures.push('invalid asset path '+asset);continue}
 const file=path.join(root,'public',asset.slice(2));if(!fs.existsSync(file)){failures.push('missing '+asset);continue}
 const svg=fs.readFileSync(file,'utf8'),match=svg.match(/data:image\/webp;base64,([^"']+)/);
 if(!/viewBox="0 0 1024 1024"/.test(svg)||!/<title/.test(svg)||!/<desc/.test(svg))failures.push(asset+': missing square frame or description');
 if(/<text\b|<script\b|mascot-moling\.svg/.test(svg))failures.push(asset+': unexpected text, script, or old artwork');
 if(!match){failures.push(asset+': missing embedded bitmap');continue}
 const bytes=Buffer.from(match[1],'base64');
 if(bytes.subarray(0,4).toString()!=='RIFF'||bytes.subarray(8,12).toString()!=='WEBP')failures.push(asset+': invalid WebP');
 if(!(bytes.includes(Buffer.from('ALPH'))||bytes.subarray(12,16).toString()==='VP8X'&&(bytes[20]&0x10)))failures.push(asset+': missing real alpha');
 if(!/feFuncA type="linear"/.test(svg)||!svg.includes('共同底線 900'))failures.push(asset+': missing normalized display treatment');
}
if(new Set(manifest.states.map(s=>s.productionPriority)).size!==6)failures.push('duplicate production priority');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Mascot v2: '+files.size+' transparent assets, stable frames and state mapping verified.');
