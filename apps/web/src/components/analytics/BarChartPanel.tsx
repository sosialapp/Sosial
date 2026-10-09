'use client';

import { ChartBar } from '@/components/ui/chart';

/**
 * Client boundary for a bar chart. Exists so server pages can render a chart
 * without passing a formatter function across the RSC boundary — only plain,
 * serializable props cross here.
 */
export default function BarChartPanel({
  data,
  dataKey,
  labelKey,
  domainMax,
  height = 176,
  suffix,
}: {
  data: Record<string, string | number | null>[];
  dataKey: string;
  labelKey: string;
  domainMax?: number;
  height?: number;
  suffix?: string;
}) {
  return (
    <ChartBar
      data={data}
      dataKey={dataKey}
      labelKey={labelKey}
      domainMax={domainMax}
      height={height}
      formatter={(v) => (suffix ? `${v} ${suffix}` : String(v))}
    />
  );
}
