'use client';

import { useEffect } from 'react';

const DESTINATION = 'https://cat1ang.github.io/dnd-potion-vault/';

export default function RedirectToPotionVault() {
  useEffect(() => {
    window.location.replace(`${DESTINATION}${window.location.hash}`);
  }, []);
  return (
    <main style={{minHeight:'100dvh',display:'grid',placeItems:'center',background:'#efe2c3',color:'#54392a',fontFamily:'Georgia,serif',textAlign:'center',padding:'24px'}}>
      <div>
        <p style={{letterSpacing:'0.2em',fontSize:'11px'}}>АЛХИМИЧЕСКАЯ ЛАВКА</p>
        <h1 style={{fontWeight:400}}>Открываем книгу зелий…</h1>
        <a href={DESTINATION} style={{color:'#8c0000'}}>Перейти вручную</a>
      </div>
    </main>
  );
}
