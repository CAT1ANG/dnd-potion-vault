import React from 'react';
import {createRoot} from 'react-dom/client';
import PrototypeApp from './App';
import './styles.css';
import {publicPotion,types} from './potions';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PrototypeApp catalog={types.map(publicPotion)} />
  </React.StrictMode>,
);
