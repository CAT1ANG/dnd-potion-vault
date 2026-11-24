import React from 'react';
import {createRoot} from 'react-dom/client';
import PrototypeApp from '../app/PrototypeApp';
import '../app/globals.css';
import {publicPotion,types} from '../lib/potions';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PrototypeApp catalog={types.map(publicPotion)} />
  </React.StrictMode>,
);
