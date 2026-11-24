'use client';

import type { CSSProperties } from 'react';
import type { PrintBundle, PrintItem } from '../types';
import Modal from './Modal';

function TagFrame() {
  return <svg className="tag-frame" viewBox="0 0 1000 310" preserveAspectRatio="none" aria-hidden="true">
    <path d="M115 8H970L992 32V278L970 302H115L8 242V68Z" />
    <path d="M124 21H960L979 41V269L960 289H124L23 234V76Z" />
  </svg>;
}

function PrintTag({ item }: { item: PrintItem }) {
  return <article className="print-tag" style={{ '--potion-color': item.potion.color } as CSSProperties}>
    <TagFrame />
    <div className="tag-seal" aria-hidden="true"><span>✦</span><i>△</i><span>✦</span></div>
    <div className="tag-copy">
      <div className="tag-ornament">— • ☾ • —</div>
      <p>{item.potion.rarity} · Алхимическая печать №{String(item.number).padStart(2, '0')}</p>
      <h2>{item.potion.fullName}</h2>
      <div className="tag-rule">✦</div>
      <strong>{item.potion.formula}</strong><span>Восстанавливает {item.potion.range} очков здоровья</span>
      <div className="tag-ornament">— • ◡ • —</div>
    </div>
    <div className="tag-qr"><img src={item.qr} alt={`QR-код: ${item.potion.fullName}`} /><small>СКАНИРОВАТЬ</small></div>
  </article>;
}

function BundleTag({ bundle }: { bundle: PrintBundle }) {
  return <article className="print-tag bundle-tag" style={{ '--potion-color': '#8c0000' } as CSSProperties}>
    <TagFrame />
    <div className="tag-seal" aria-hidden="true"><span>✦</span><i>✧</i><span>✦</span></div>
    <div className="tag-copy">
      <div className="tag-ornament">— • ☾ • —</div>
      <p>ЕДИНАЯ ПЕЧАТЬ · ОДНОРАЗОВАЯ АКТИВАЦИЯ</p>
      <h2>Весь набор зелий</h2>
      <div className="tag-rule">✦</div>
      <strong>{bundle.itemCount} флаконов</strong><span>Одно сканирование добавит весь набор в инвентарь</span>
      <div className="tag-ornament">— • ◡ • —</div>
    </div>
    <div className="tag-qr"><img src={bundle.qr} alt={`QR-код набора из ${bundle.itemCount} зелий`} /><small>ЗАБРАТЬ ВЕСЬ НАБОР</small></div>
  </article>;
}

type Props = { items: PrintItem[]; bundle: PrintBundle | null; onClose: () => void };

export default function PrintOverlay({ items, bundle, onClose }: Props) {
  return <Modal className="print-overlay" label="Печатный набор" onClose={onClose}>
    <div className="print-toolbar">
      <div><strong>Печатный набор</strong><span>{items.length} отдельных бирок + общий QR</span></div>
      <button onClick={onClose}>Закрыть</button>
      <button className="primary-action" onClick={() => window.print()}>Печатать</button>
    </div>
    <div className="print-sheet">{bundle && <BundleTag bundle={bundle} />} {items.map(item => <PrintTag item={item} key={item.id} />)}</div>
  </Modal>;
}
