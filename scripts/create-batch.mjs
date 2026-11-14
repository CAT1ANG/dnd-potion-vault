import {randomBytes,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
const out='outputs';mkdirSync(out,{recursive:true});
if(existsSync(out+'/potions.json'))throw Error('Existing batch; refusing to overwrite');
const rows=[];const registry={};
for(const [type,count] of [100,50,25,10].entries())for(let n=1;n<=count;n++){
 const token=randomBytes(24).toString('hex');const id=`${type+1}-${String(n).padStart(3,'0')}`;
 registry[createHash('sha256').update(token).digest('hex')]=type;
 rows.push({id,type,token,url:'https://potion-vault-dnd-141126.opensky137.chatgpt.site/#p='+token});
}
writeFileSync('lib/registry.ts','export const registry = '+JSON.stringify(registry,null,2)+';\n');
writeFileSync(out+'/potions.json',JSON.stringify(rows,null,2));
writeFileSync(out+'/potions.csv','id,type,password,url\n'+rows.map(r=>`${r.id},${r.type},${r.token},${r.url}`).join('\n'));
console.log('Created',rows.length,'unique potions; plaintext passwords stay in ignored outputs.');
