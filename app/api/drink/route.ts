import { env } from 'cloudflare:workers';
import { registry } from '../../../lib/registry';
import { types } from '../../../lib/potions';
export async function POST(request: Request) {
 const headers = {'Cache-Control':'no-store'};
 if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({error:'Недопустимый запрос'}, {status:403,headers});
 try {
 const body = await request.json();
 if(typeof body.token !== 'string' || !/^[a-f0-9]{48}$/.test(body.token)) return Response.json({error:'Зелье не найдено'},{status:404,headers});
 const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.token)))).map(v=>v.toString(16).padStart(2,'0')).join('');
 const type = (registry as Record<string,number>)[hash];
 if(type === undefined) return Response.json({error:'Зелье не найдено'},{status:404,headers});
 const potion=types[type];
 const dice=Array.from(crypto.getRandomValues(new Uint8Array(potion.dice)),v=>v%4+1);
 const result=dice.reduce((a,b)=>a+b,potion.bonus);
 const inserted = await env.DB.prepare('INSERT INTO consumed (hash,result,at) VALUES (?,?,?) ON CONFLICT(hash) DO NOTHING RETURNING hash').bind(hash,result,new Date().toISOString()).first();
 if(!inserted) return Response.json({used:true,type},{status:409,headers});
 return Response.json({result,dice,type},{headers});
 } catch { return Response.json({error:'Не удалось проверить зелье. Проверьте соединение и попробуйте снова.'},{status:503,headers}); }
}
