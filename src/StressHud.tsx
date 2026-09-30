// Панель метрик стрес-тесту (ADR-0013).
import { useEffect, useState } from 'react';

const PRESETS = [100, 150, 200];

/** Середній FPS за останню секунду. */
function useFps() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let frames = 0;
    let start = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      frames++;
      if (now - start >= 1000) {
        setFps(Math.round((frames * 1000) / (now - start)));
        frames = 0;
        start = now;
      }
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  return fps;
}

/** JS heap, МБ — лише в Chromium (`performance.memory` нестандартне). */
function useHeapMb() {
  const [mb, setMb] = useState<number | null>(null);
  useEffect(() => {
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    if (!memory) return;
    const read = () => setMb(Math.round(memory.usedJSHeapSize / 1024 / 1024));
    read();
    const id = setInterval(read, 1000);
    return () => clearInterval(id);
  }, []);
  return mb;
}

type Props = { nodes: number; edges: number; expanded: number; layoutMs: number | null };

export function StressHud({ nodes, edges, expanded, layoutMs }: Props) {
  const fps = useFps();
  const heap = useHeapMb();
  const current = new URLSearchParams(window.location.search).get('stress');

  return (
    <div className="stress-hud">
      <Metric label="Віджетів" value={nodes} />
      <Metric label="Розгорнуто" value={expanded} />
      <Metric label="Ребер" value={edges} />
      <Metric label="Лейаут" value={layoutMs === null ? '…' : `${Math.round(layoutMs)} мс`} />
      <Metric label="FPS" value={fps} tone={fps >= 50 ? 'good' : fps >= 30 ? 'warn' : 'bad'} />
      {heap !== null && <Metric label="Heap" value={`${heap} МБ`} />}
      <div className="stress-hud__presets">
        {PRESETS.map((n) => (
          <a key={n} className={`stress-hud__preset${current === String(n) ? ' is-active' : ''}`} href={`?stress=${n}`}>
            {n}
          </a>
        ))}
        <a className="stress-hud__preset" href="?">
          вийти
        </a>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="stress-hud__metric">
      <span className="stress-hud__label">{label}</span>
      <span className={`stress-hud__value${tone ? ` is-${tone}` : ''}`}>{value}</span>
    </div>
  );
}
