'use client';

import type { CSSProperties } from 'react';
import Bottle from '../Bottle';
import type { Potion } from '../types';

type Props = {
  catalog: Potion[];
  cart: Record<string, number>;
  total: number;
  busy: boolean;
  onChange: (id: string, delta: number) => void;
  onCreate: () => void;
};

export default function MasterView({ catalog, cart, total, busy, onChange, onCreate }: Props) {
  return <main className="master-layout">
    <section className="catalog-panel">
      <div className="page-title"><p>СОБРАНИЕ АЛХИМИЧЕСКИХ РЕЦЕПТОВ</p><h1>Каталог зелий</h1><span>Соберите набор для следующей игровой сессии, затем создайте персональные печати.</span></div>
      <div className="catalog-grid">
        {catalog.map((potion, index) => <article className="potion-card" key={potion.id} style={{ '--potion-color': potion.color } as CSSProperties}>
          <div className="card-rarity"><span>{potion.rarity}</span><i>{'♥'.repeat(index + 1)}</i></div>
          <div className="bottle-display"><div className="alchemy-ring">✦</div><Bottle level={index} /></div>
          <div className="card-copy"><p>ЗЕЛЬЕ ЛЕЧЕНИЯ</p><h2>{potion.name}</h2><div className="formula-row"><strong>{potion.formula}</strong><span>{potion.range} здоровья</span></div>
            <div className="quantity-control" role="group" aria-label={`Количество: ${potion.fullName}`}>
              <button onClick={() => onChange(potion.id, -1)} disabled={!cart[potion.id]}>Убрать</button>
              <output>{cart[potion.id] || 0}</output>
              <button onClick={() => onChange(potion.id, 1)}>Добавить</button>
            </div>
          </div>
        </article>)}
      </div>
    </section>
    <aside className="cart-panel">
      <p className="kicker">ПОДГОТОВКА К СЕССИИ</p><h2>Корзина мастера</h2>
      {!total
        ? <div className="empty-cart"><span>☾</span><p>Добавьте зелья из каталога</p></div>
        : <ul>{catalog.filter(p => cart[p.id]).map(p => <li key={p.id}><span className="cart-swatch" style={{ background: p.color }} /><div><strong>{p.name}</strong><small>{p.formula}</small></div><b>× {cart[p.id]}</b></li>)}</ul>}
      <div className="cart-total"><span>Всего бирок</span><strong>{total}</strong></div>
      <button className="primary-action" disabled={!total || busy} onClick={onCreate}>{busy ? 'Создаём печати…' : 'Создать и печатать'}</button>
      <small className="prototype-note">В прототипе вход мастера не защищён. Перед публикацией добавим аккаунт и историю наборов.</small>
    </aside>
  </main>;
}
