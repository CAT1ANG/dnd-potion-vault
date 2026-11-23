import {env} from 'cloudflare:workers';
import QRCode from 'qrcode';
import {publicPotion, rollPotion, types} from '../../../lib/potions';

type Selection = {potionId?: unknown; quantity?: unknown};

let schemaReady: Promise<unknown> | null = null;

function database() {
  if (!env.DB) throw new Error('D1 database binding is unavailable');
  return env.DB;
}

function ensureSchema() {
  const db = database();
  schemaReady ??= db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS inventory_batches (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, item_count INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS inventory_items (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, potion_type TEXT NOT NULL, batch_id TEXT NOT NULL, owner_device TEXT, claimed_at TEXT, consumed_at TEXT, result_json TEXT, created_at TEXT NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS inventory_items_owner_idx ON inventory_items(owner_device, consumed_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS inventory_items_batch_idx ON inventory_items(batch_id)'),
  ]);
  return schemaReady;
}

function json(body: unknown, status = 200) {
  return Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
}

function randomHex(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

function validDevice(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9-]{16,64}$/i.test(value);
}

function potionById(id: string) {
  return types.find(potion => potion.id === id);
}

export async function GET(request: Request) {
  await ensureSchema();
  const db = database();
  const url = new URL(request.url);
  const deviceId = url.searchParams.get('deviceId');
  if (!validDevice(deviceId)) return json({error:'Неизвестное устройство'}, 400);
  const result = await db.prepare('SELECT id, potion_type, claimed_at FROM inventory_items WHERE owner_device = ? AND consumed_at IS NULL ORDER BY claimed_at DESC, created_at DESC').bind(deviceId).all<{id:string;potion_type:string;claimed_at:string}>();
  const items = result.results.flatMap(item => {
    const potion = potionById(item.potion_type);
    return potion ? [{id:item.id, claimedAt:item.claimed_at, potion:publicPotion(potion)}] : [];
  });
  return json({items});
}

export async function POST(request: Request) {
  await ensureSchema();
  const db = database();
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === 'create_batch') {
      const raw = Array.isArray(body.items) ? body.items as Selection[] : [];
      const selections = raw.flatMap(item => {
        const potion = typeof item.potionId === 'string' ? potionById(item.potionId) : null;
        const quantity = Number(item.quantity);
        return potion && Number.isInteger(quantity) && quantity > 0 && quantity <= 24 ? [{potion, quantity}] : [];
      });
      const total = selections.reduce((sum, item) => sum + item.quantity, 0);
      if (!total || total > 48) return json({error:'Выберите от 1 до 48 зелий'}, 400);

      const batchId = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const generated = selections.flatMap(({potion,quantity}) => Array.from({length:quantity}, () => ({
        id: randomHex(12), token: randomHex(24), potion,
      })));
      const statements = [
        db.prepare('INSERT INTO inventory_batches (id, created_at, item_count) VALUES (?, ?, ?)').bind(batchId,createdAt,total),
        ...await Promise.all(generated.map(async item => db.prepare('INSERT INTO inventory_items (id, token_hash, potion_type, batch_id, created_at) VALUES (?, ?, ?, ?, ?)').bind(item.id,await tokenHash(item.token),item.potion.id,batchId,createdAt))),
      ];
      await db.batch(statements);
      const origin = new URL(request.url).origin;
      const printable = await Promise.all(generated.map(async (item,index) => {
        const url = `${origin}/#p=${item.token}`;
        return {
          id:item.id,
          number:index + 1,
          potion:publicPotion(item.potion),
          url,
          qr:await QRCode.toDataURL(url,{errorCorrectionLevel:'M',margin:1,width:420,color:{dark:'#251a14',light:'#fffdf4'}}),
        };
      }));
      return json({batchId, createdAt, items:printable});
    }

    if (body.action === 'claim') {
      if (typeof body.token !== 'string' || !/^[a-f0-9]{48}$/.test(body.token) || !validDevice(body.deviceId)) return json({error:'QR-код повреждён'}, 400);
      const hash = await tokenHash(body.token);
      const existing = await db.prepare('SELECT id, potion_type, owner_device, consumed_at FROM inventory_items WHERE token_hash = ?').bind(hash).first<{id:string;potion_type:string;owner_device:string|null;consumed_at:string|null}>();
      if (!existing) return json({error:'Зелье не найдено'}, 404);
      if (existing.consumed_at) return json({error:'Это зелье уже выпито'}, 409);
      const claimedAt = new Date().toISOString();
      await db.prepare('UPDATE inventory_items SET owner_device = ?, claimed_at = ? WHERE id = ? AND consumed_at IS NULL').bind(body.deviceId,claimedAt,existing.id).run();
      const potion = potionById(existing.potion_type);
      if (!potion) return json({error:'Неизвестный вид зелья'}, 500);
      return json({item:{id:existing.id,claimedAt,potion:publicPotion(potion)},transferred:Boolean(existing.owner_device && existing.owner_device !== body.deviceId)});
    }

    if (body.action === 'consume') {
      if (typeof body.itemId !== 'string' || !validDevice(body.deviceId)) return json({error:'Не удалось определить флакон'}, 400);
      const item = await db.prepare('SELECT potion_type FROM inventory_items WHERE id = ? AND owner_device = ? AND consumed_at IS NULL').bind(body.itemId,body.deviceId).first<{potion_type:string}>();
      if (!item) return json({error:'Флакон больше не принадлежит этому устройству'}, 409);
      const potion = potionById(item.potion_type);
      if (!potion) return json({error:'Неизвестный вид зелья'}, 500);
      const outcome = rollPotion(potion);
      const consumedAt = new Date().toISOString();
      const updated = await db.prepare('UPDATE inventory_items SET consumed_at = ?, result_json = ? WHERE id = ? AND owner_device = ? AND consumed_at IS NULL RETURNING id').bind(consumedAt,JSON.stringify(outcome),body.itemId,body.deviceId).first();
      if (!updated) return json({error:'Зелье уже передано или выпито'}, 409);
      return json({potion:publicPotion(potion),outcome,consumedAt});
    }

    return json({error:'Неизвестное действие'}, 400);
  } catch (error) {
    console.error(error);
    return json({error:'Алхимическая лаборатория временно недоступна'}, 503);
  }
}
