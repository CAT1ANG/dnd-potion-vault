'use client';

import { useRef } from 'react';
import { useQrScanner } from '../hooks/useQrScanner';
import Modal from './Modal';

type Props = { onScan: (text: string) => void; onError: (error: unknown) => void; onClose: () => void };

export default function ScannerDialog({ onScan, onError, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { starting } = useQrScanner({ videoRef, onScan, onError });
  return <Modal className="scanner-overlay" label="Сканер QR-кода" onClose={onClose}>
    <div className="scanner-panel">
      <video ref={videoRef} autoPlay muted playsInline />
      <div className="scanner-frame" aria-hidden="true"><i /><i /><i /><i /></div>
      {starting && <div className="scanner-loading" role="status">Открываем камеру…</div>}
      <button type="button" className="scanner-close" aria-label="Закрыть сканер" onClick={onClose}>×</button>
    </div>
  </Modal>;
}
