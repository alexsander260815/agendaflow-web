'use client';

import { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';

export default function AssinaturaCanvas({ onChange }: { onChange: (arquivo: Blob | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [vazio, setVazio] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const largura = canvas.clientWidth;
    canvas.width = largura * window.devicePixelRatio;
    canvas.height = 150 * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim() || '#ffffff';
  }, []);

  function posicao(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function iniciar(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    desenhando.current = true;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = posicao(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = posicao(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setVazio(false);
  }

  function terminar() {
    if (!desenhando.current) return;
    desenhando.current = false;
    canvasRef.current?.toBlob((blob) => onChange(blob), 'image/png');
  }

  function limpar() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setVazio(true);
    onChange(null);
  }

  return (
    <div>
      <div className='relative overflow-hidden rounded-xl border border-border-subtle bg-background'>
        <canvas ref={canvasRef} onPointerDown={iniciar} onPointerMove={mover} onPointerUp={terminar} onPointerCancel={terminar} className='h-[150px] w-full touch-none cursor-crosshair' />
        {vazio && <p className='pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted'>Assine com o dedo ou mouse</p>}
      </div>
      <button type='button' onClick={limpar} className='mt-2 flex items-center gap-1.5 text-xs text-muted hover:text-accent'><Eraser size={13} /> Limpar assinatura</button>
    </div>
  );
}
