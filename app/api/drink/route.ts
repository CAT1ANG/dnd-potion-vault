import { env } from 'cloudflare:workers';
import { registry } from '../../../lib/registry';
import { masterRegistry } from '../../../lib/master-registry';
import { publicPotion, rollPotion, types } from '../../../lib/potions';

const PAGES_ORIGIN = 'https://cat1ang.github.io';

function responseHeaders(request: Request) {
  const origin = request.headers.get('origin');
  const ownOrigin = new URL(request.url).origin;
  const allowedOrigin = origin === PAGES_ORIGIN || origin === ownOrigin ? origin : null;
  return {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': allowedOrigin ?? ownOrigin,
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
}

function json(request: Request, body: unknown, status = 200) {
  return Response.json(body, {status, headers: responseHeaders(request)});
}

async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

async function resolveType(hash: string) {
  const masterType = (masterRegistry as Record<string, number>)[hash];
  if (masterType !== undefined) return {type: masterType, demo: true};
  const originalType = (registry as Record<string, number>)[hash];
  if (originalType !== undefined) return {type: originalType, demo: false};
  const stored = await env.DB!.prepare('SELECT potion_type FROM potion_codes WHERE hash = ? AND disabled = 0').bind(hash).first<{potion_type: string}>();
  const storedType = stored ? types.findIndex(potion => potion.id === stored.potion_type) : -1;
  return storedType >= 0 ? {type: storedType, demo: false} : null;
}

async function previousOutcome(hash: string) {
  return env.DB!.prepare('SELECT result, at, type, dice_json, outcome_json FROM consumed WHERE hash = ?').bind(hash).first<{result:number;at:string;type:number;dice_json:string;outcome_json:string}>();
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  const ownOrigin = new URL(request.url).origin;
  if (origin !== PAGES_ORIGIN && origin !== ownOrigin) return new Response(null, {status: 403});
  return new Response(null, {status: 204, headers: responseHeaders(request)});
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const ownOrigin = new URL(request.url).origin;
  if (origin !== PAGES_ORIGIN && origin !== ownOrigin) return json(request, {error:'Недопустимый источник запроса'}, 403);
  try {
    const body = await request.json() as {token?:unknown;action?:unknown};
    if (typeof body.token !== 'string' || !/^[a-f0-9]{48}$/.test(body.token)) return json(request, {error:'Зелье не найдено'}, 404);
    const action = body.action === 'inspect' ? 'inspect' : 'consume';
    const hash = await tokenHash(body.token);
    const resolved = await resolveType(hash);
    if (!resolved || !types[resolved.type]) return json(request, {error:'Зелье не найдено'}, 404);
    const potion = publicPotion(types[resolved.type]);

    if (!resolved.demo) {
      const previous = await previousOutcome(hash);
      if (previous) {
        const outcome = JSON.parse(previous.outcome_json || '{}');
        if (!outcome.amount) {
          outcome.kind = 'healing';
          outcome.amount = previous.result;
          outcome.dice = JSON.parse(previous.dice_json || '[]');
          outcome.bonus = types[previous.type]?.bonus ?? types[resolved.type].bonus;
        }
        return json(request, {status:'consumed',used:true,type:resolved.type,potion,outcome,consumedAt:previous.at});
      }
    }
    if (action === 'inspect') return json(request, {status:'ready',type:resolved.type,potion,demo:resolved.demo});

    const outcome = rollPotion(types[resolved.type]);
    if (resolved.demo) return json(request, {status:'consumed',type:resolved.type,potion,outcome,demo:true});

    const consumedAt = new Date().toISOString();
    const inserted = await env.DB!.prepare('INSERT INTO consumed (hash,result,at,type,dice_json,outcome_json) VALUES (?,?,?,?,?,?) ON CONFLICT(hash) DO NOTHING RETURNING hash').bind(hash,outcome.amount,consumedAt,resolved.type,JSON.stringify(outcome.dice),JSON.stringify(outcome)).first();
    if (!inserted) {
      const previous = await previousOutcome(hash);
      if (!previous) throw new Error('Consumed result was not readable');
      return json(request, {status:'consumed',used:true,type:previous.type,potion:publicPotion(types[previous.type] ?? types[resolved.type]),outcome:JSON.parse(previous.outcome_json),consumedAt:previous.at});
    }
    return json(request, {status:'consumed',type:resolved.type,potion,outcome,consumedAt});
  } catch {
    return json(request, {error:'Не удалось проверить зелье. Проверьте соединение и попробуйте снова.'}, 503);
  }
}
