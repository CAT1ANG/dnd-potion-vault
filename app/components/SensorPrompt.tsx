'use client';

import Modal from './Modal';

type Props = { busy: boolean; onEnable: () => void; onSkip: () => void };

export default function SensorPrompt({ busy, onEnable, onSkip }: Props) {
  return <Modal className="sensor-permission-overlay" labelledBy="sensor-title" onClose={onSkip}>
    <div className="sensor-permission-card">
      <span aria-hidden="true">✦</span>
      <p>ИНТЕРАКТИВНОЕ ЗЕЛЬЕ</p>
      <h2 id="sensor-title">Разрешить датчики движения?</h2>
      <div className="sensor-orbit" aria-hidden="true"><i>◒</i></div>
      <p className="sensor-copy">Это позволит наклонить телефон и выпить открытое зелье. Без датчиков зелье выпивается кнопкой.</p>
      <button className="primary-action" disabled={busy} onClick={onEnable}>{busy ? 'Запрашиваем доступ…' : 'Разрешить датчики'}</button>
      <button className="sensor-skip" disabled={busy} onClick={onSkip}>Продолжить без датчиков</button>
    </div>
  </Modal>;
}
