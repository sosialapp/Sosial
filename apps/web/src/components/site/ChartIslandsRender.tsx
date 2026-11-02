'use client';

import { createRoot, type Root } from 'react-dom/client';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = ['#1C1A14', '#F2A400', '#2F8F5B', '#1D7FE0', '#D6249F', '#E6A417', '#7C6FF0', '#C24E4C', '#4E9BB9', '#8A8F3A', '#B06FA8', '#5E5A50'];

interface ChartPayload {
  kind?: string;
  title?: string;
  points?: { label: string; value: number }[];
}

/**
 * Draws the charts for the figures ChartIslands found. Loaded on demand, so
 * recharts only downloads on pages that actually contain a chart. Returns the
 * cleanup that unmounts every chart root.
 */
export function renderChartIslands(figures: HTMLElement[]): () => void {
  const roots: Root[] = [];
  for (const el of figures) {
    let payload: ChartPayload;
    try {
      payload = JSON.parse(el.dataset.chart ?? '{}') as ChartPayload;
    } catch {
      continue;
    }
    const points = (payload.points ?? []).filter((p) => p && p.label);
    if (!points.length) continue;
    el.dataset.ready = '1';
    const canvas = document.createElement('div');
    canvas.className = 'sosial-chart-canvas';
    el.appendChild(canvas);
    const kind = payload.kind ?? 'bar';
    const root = createRoot(canvas);
    roots.push(root);
    root.render(
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {kind === 'pie' ? (
            <PieChart>
              <Pie data={points} dataKey="value" nameKey="label" innerRadius="45%" outerRadius="80%" paddingAngle={2} isAnimationActive={false}>
                {points.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          ) : kind === 'line' ? (
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,26,20,0.12)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="rgba(28,26,20,0.4)" />
              <YAxis tick={{ fontSize: 11 }} stroke="rgba(28,26,20,0.4)" />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#F2A400" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          ) : (
            <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,26,20,0.12)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="rgba(28,26,20,0.4)" />
              <YAxis tick={{ fontSize: 11 }} stroke="rgba(28,26,20,0.4)" />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {points.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>,
    );
  }
  return () => roots.forEach((r) => r.unmount());
}
