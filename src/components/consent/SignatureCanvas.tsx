/**
 * SignatureCanvas — Canvas de firma digital.
 *
 * Permite capturar la firma mediante mouse o touch, limpiar y exportar como base64.
 *
 * Requirement 6.4: Captura firma del estudiante (o representante legal)
 * mediante un canvas de firma digital.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, Check } from 'lucide-react';

interface SignatureCanvasProps {
  onSignature: (dataUrl: string) => void;
  width?: number;
  height?: number;
}

export function SignatureCanvas({
  onSignature,
  width = 500,
  height = 200,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up canvas
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getPosition = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      if ('touches' in e) {
        const touch = e.touches[0];
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY,
        };
      }

      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    [],
  );

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      const pos = getPosition(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      setIsDrawing(true);
    },
    [getPosition],
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawing) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      const pos = getPosition(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setHasContent(true);
    },
    [isDrawing, getPosition],
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
  }, []);

  const confirm = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasContent) return;

    const dataUrl = canvas.toDataURL('image/png');
    onSignature(dataUrl);
  }, [hasContent, onSignature]);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-border overflow-hidden">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Dibuje su firma en el área de arriba usando el mouse o el dedo (en dispositivos táctiles).
      </p>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={clear}>
          <Eraser className="size-4 mr-1" />
          Limpiar
        </Button>
        <Button size="sm" onClick={confirm} disabled={!hasContent}>
          <Check className="size-4 mr-1" />
          Confirmar firma
        </Button>
      </div>
    </div>
  );
}
