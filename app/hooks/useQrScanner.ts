'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { SCAN_INTERVAL_MS } from '../constants';

type DetectorLike = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };
type DetectorCtor = {
  new (options: { formats: string[] }): DetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

const VIDEO_CONSTRAINTS = { audio: false, video: { facingMode: { ideal: 'environment' } } } as const;

/** Нативный BarcodeDetector: без лишней библиотеки. Возвращает null, если недоступен. */
async function startNative(video: HTMLVideoElement, onText: (text: string) => void) {
  const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const formats = await Ctor.getSupportedFormats?.();
    if (formats && !formats.includes('qr_code')) return null;
  } catch { return null; }

  const stream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  };
  try {
    video.srcObject = stream;
    await video.play();
    const detector = new Ctor({ formats: ['qr_code'] });
    const tick = async () => {
      if (stopped) return;
      try {
        const codes = await detector.detect(video);
        if (!stopped && codes[0]?.rawValue) onText(codes[0].rawValue);
      } catch { /* кадр ещё не готов */ }
      if (!stopped) timer = setTimeout(tick, SCAN_INTERVAL_MS);
    };
    void tick();
    return stop;
  } catch (error) {
    stop();
    throw error;
  }
}

async function startZxing(video: HTMLVideoElement, onText: (text: string) => void) {
  const { BrowserQRCodeReader } = await import('@zxing/browser');
  const controls = await new BrowserQRCodeReader().decodeFromConstraints(
    VIDEO_CONSTRAINTS,
    video,
    result => { if (result) onText(result.getText()); },
  );
  return () => controls.stop();
}

type Options = {
  videoRef: RefObject<HTMLVideoElement | null>;
  onScan: (text: string) => void;
  onError: (error: unknown) => void;
};

/** Сканер живёт, пока смонтирован компонент, использующий хук. */
export function useQrScanner({ videoRef, onScan, onError }: Options) {
  const [starting, setStarting] = useState(true);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  useEffect(() => { onScanRef.current = onScan; onErrorRef.current = onError; });

  useEffect(() => {
    let active = true;
    let handled = false; // после первого кода остальные кадры игнорируем; сбрасывается при следующем открытии
    let stop: (() => void) | undefined;

    const onText = (text: string) => {
      if (!active || handled) return;
      handled = true;
      onScanRef.current(text);
    };

    (async () => {
      const video = videoRef.current;
      if (!video) { setStarting(false); return; }
      const stopper = (await startNative(video, onText)) ?? (await startZxing(video, onText));
      if (active) { stop = stopper; setStarting(false); } else stopper();
    })().catch(error => {
      if (!active) return;
      setStarting(false);
      onErrorRef.current(error);
    });

    return () => { active = false; stop?.(); };
  }, [videoRef]);

  return { starting };
}
