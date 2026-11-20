import React, {useMemo, useState} from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import {
  BoxplotStat,
  ClusterZProfile,
  KMetric,
  MissingColStat,
  PcaPoint,
  SimpulNode,
} from '../types/report';
import {
  buildLog1pHistogram,
  CLUSTERING_FEATURES,
  formatIdNumber,
  SHORT_FEATURE_LABELS,
  toRoman,
} from '../utils/analytics';
import {CLUSTER_SHAPE_NAMES, ClusterSymbol} from './ClusterSymbol';

interface ThemeProps {
  isInverted: boolean;
}

function getInkColors(isInverted: boolean) {
  return {
    ink: isInverted ? '#F2F2EE' : '#111111',
    muted: isInverted ? '#C2C2BC' : '#525252',
    subtle: isInverted ? '#A3A39E' : '#6B6B6B',
    rule: isInverted ? '#4A4A46' : '#BDBDBD',
    paper: isInverted ? '#111111' : '#FAFAF7',
    paperAlt: isInverted ? '#1D1D1A' : '#EFEFE9',
  };
}

// Monotonic grayscale cell color + WCAG AA guaranteed text color
function getGrayScaleCell(norm01: number, isInverted: boolean): {bg: string; fg: string} {
  const t = Math.max(0, Math.min(1, norm01));
  if (!isInverted) {
    // Mode Cetak: 0 -> light #F5F5F0, 1 -> dark #141414
    const lum = Math.round(245 - t * 225);
    const bg = `rgb(${lum}, ${lum}, ${Math.max(0, lum - 3)})`;
    const fg = lum < 135 ? '#FAFAF7' : '#111111';
    return {bg, fg};
  } else {
    // Mode Terbalik: 0 -> dark #1C1C1A, 1 -> light #EAEAE4
    const lum = Math.round(28 + t * 206);
    const bg = `rgb(${lum}, ${lum}, ${Math.max(0, lum - 3)})`;
    const fg = lum > 135 ? '#111111' : '#F2F2EE';
    return {bg, fg};
  }
}

// 1. Missing Data Bar Chart (Gambar 2)
export const MissingBarChart: React.FC<{stats: MissingColStat[]} & ThemeProps> = ({
  stats,
  isInverted,
}) => {
  const c = getInkColors(isInverted);
  const data = useMemo(
    () =>
      [...stats]
        .sort((a, b) => b.persenMissing - a.persenMissing)
        .slice(0, 8)
        .map((s) => ({
          kolom: s.kolom,
          persen: s.persenMissing,
          jumlah: s.jumlahMissing,
        })),
    [stats]
  );

  return (
    <div className="w-full h-[270px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{top: 8, right: 28, left: 20, bottom: 8}}>
          <CartesianGrid stroke={c.rule} strokeDasharray="2 2" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 'dataMax + 2']}
            tick={{fill: c.ink, fontSize: 12, fontFamily: 'IBM Plex Mono'}}
            stroke={c.ink}
            unit="%"
          />
          <YAxis
            type="category"
            dataKey="kolom"
            width={165}
            tick={{fill: c.ink, fontSize: 12, fontFamily: 'IBM Plex Mono'}}
            stroke={c.ink}
          />
          <Tooltip
            cursor={{fill: c.paperAlt}}
            contentStyle={{
              backgroundColor: c.paper,
              border: `1px solid ${c.ink}`,
              borderRadius: 0,
              color: c.ink,
              fontFamily: 'IBM Plex Mono',
              fontSize: 12,
            }}
            formatter={(value: unknown, _name: unknown, item: {payload?: {jumlah?: number}}) => [
              `${formatIdNumber(Number(value), 1)}% (${item?.payload?.jumlah ?? 0} baris)`,
              'Persentase kosong',
            ]}
          />
          <Bar dataKey="persen" fill={c.ink} barSize={16} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// 2. Before vs After Dedup Comparison (Gambar 3)
export const DedupComparisonChart: React.FC<
  {preCount: number; postCount: number} & ThemeProps
> = ({preCount, postCount, isInverted}) => {
  const c = getInkColors(isInverted);
  const removed = Math.max(0, preCount - postCount);
  const pct = preCount > 0 ? (removed / preCount) * 100 : 0;

  const data = [
    {tahap: 'Sebelum Deduplikasi (N)', jumlah: preCount},
    {tahap: 'Sesudah Deduplikasi (M)', jumlah: postCount},
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 border border-[var(--rule)] divide-x divide-[var(--rule)] font-mono-code tabular-nums">
        <div className="p-3">
          <div className="small-caps text-[11px] tracking-widest text-[var(--ink-subtle)]">
            Node Awal (N)
          </div>
          <div className="text-[22px] font-semibold mt-0.5">{preCount}</div>
        </div>
        <div className="p-3">
          <div className="small-caps text-[11px] tracking-widest text-[var(--ink-subtle)]">
            Node Akhir (M)
          </div>
          <div className="text-[22px] font-semibold mt-0.5">{postCount}</div>
        </div>
        <div className="p-3">
          <div className="small-caps text-[11px] tracking-widest text-[var(--ink-subtle)]">
            Dibuang (&le; 25 m)
          </div>
          <div className="text-[22px] font-semibold mt-0.5">
            {removed} ({formatIdNumber(pct, 1)}%)
          </div>
        </div>
      </div>

      <div className="w-full h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{top: 10, right: 24, left: 10, bottom: 5}}>
            <CartesianGrid stroke={c.rule} strokeDasharray="2 2" vertical={false} />
            <XAxis
              dataKey="tahap"
              tick={{fill: c.ink, fontSize: 13, fontFamily: 'Source Serif 4'}}
              stroke={c.ink}
            />
            <YAxis
              tick={{fill: c.ink, fontSize: 12, fontFamily: 'IBM Plex Mono'}}
              stroke={c.ink}
            />
            <Tooltip
              cursor={{fill: c.paperAlt}}
              contentStyle={{
                backgroundColor: c.paper,
                border: `1px solid ${c.ink}`,
                borderRadius: 0,
                color: c.ink,
                fontFamily: 'IBM Plex Mono',
                fontSize: 12,
              }}
            />
            <Bar dataKey="jumlah" fill={c.ink} barSize={46} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// 3. Spearman Correlation Heatmap (Gambar 4)
export const SpearmanHeatmap: React.FC<
  {matrix: number[][]; featureNames: string[]} & ThemeProps
> = ({matrix, featureNames, isInverted}) => {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[540px]">
        <div className="flex items-center justify-between text-[12px] font-mono-code text-[var(--ink-muted)] mb-2">
          <span>Skala satu arah: |rho| = 0,00 (terang) hingga 1,00 (gelap)</span>
          <span>Garis tebal = |rho| &gt; 0,85</span>
        </div>
        <table className="w-full border-collapse font-mono-code text-[12px] tabular-nums">
          <thead>
            <tr>
              <th className="p-1.5 text-left border border-[var(--rule)] bg-[var(--paper-alt)]">
                Fitur
              </th>
              {featureNames.map((f) => (
                <th
                  key={f}
                  className="p-1.5 text-center border border-[var(--rule)] bg-[var(--paper-alt)] font-semibold"
                >
                  {SHORT_FEATURE_LABELS[f] || f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {featureNames.map((fRow, i) => (
              <tr key={fRow}>
                <th className="p-1.5 text-left border border-[var(--rule)] bg-[var(--paper-alt)] font-medium whitespace-nowrap">
                  {SHORT_FEATURE_LABELS[fRow] || fRow}
                </th>
                {featureNames.map((fCol, j) => {
                  const val = matrix[i]?.[j] ?? 0;
                  const absVal = Math.abs(val);
                  const isHighOffDiag = i !== j && absVal > 0.85;
                  const {bg, fg} = getGrayScaleCell(absVal, isInverted);
                  return (
                    <td
                      key={fCol}
                      style={{
                        backgroundColor: bg,
                        color: fg,
                        border: isHighOffDiag
                          ? `2.5px solid ${isInverted ? '#FFFFFF' : '#000000'}`
                          : `1px solid var(--rule)`,
                      }}
                      className="p-2 text-center font-medium"
                      title={`${fRow} vs ${fCol}: rho = ${formatIdNumber(val, 3)}`}
                    >
                      {formatIdNumber(val, 2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 4. Histogram Before vs After log1p (Gambar 5)
export const Log1pHistogramChart: React.FC<{nodes: SimpulNode[]} & ThemeProps> = ({
  nodes,
  isInverted,
}) => {
  const c = getInkColors(isInverted);
  const [selectedFeat, setSelectedFeat] = useState<
    'poi_total_500m' | 'kepadatan_penduduk_kec' | 'jarak_simpul_terdekat'
  >('poi_total_500m');

  const {rawBins, logBins} = useMemo(
    () => buildLog1pHistogram(nodes, selectedFeat, 10),
    [nodes, selectedFeat]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--rule)] pb-3">
        <span className="small-caps text-[12px] tracking-widest text-[var(--ink-subtle)] mr-1">
          Pilih fitur:
        </span>
        {(
          [
            ['poi_total_500m', 'poi_total_500m'],
            ['kepadatan_penduduk_kec', 'kepadatan_penduduk_kec'],
            ['jarak_simpul_terdekat', 'jarak_simpul_terdekat'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelectedFeat(key)}
            className={`px-2.5 py-1 text-[12px] font-mono-code border cursor-pointer fade-150 ${
              selectedFeat === key
                ? 'border-[var(--rule-strong)] bg-[var(--ink)] text-[var(--paper)]'
                : 'border-[var(--rule)] bg-[var(--paper)] text-[var(--ink)] hover:border-[var(--rule-strong)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-[13px] font-mono-code mb-2 text-[var(--ink)] font-semibold">
            A. Skala Asli (Sebelum log1p)
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rawBins} margin={{top: 5, right: 8, left: -12, bottom: 24}}>
                <CartesianGrid stroke={c.rule} strokeDasharray="2 2" vertical={false} />
                <XAxis
                  dataKey="range"
                  tick={{fill: c.ink, fontSize: 10, fontFamily: 'IBM Plex Mono'}}
                  angle={-30}
                  textAnchor="end"
                  interval={1}
                  stroke={c.ink}
                />
                <YAxis
                  tick={{fill: c.ink, fontSize: 11, fontFamily: 'IBM Plex Mono'}}
                  stroke={c.ink}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: c.paper,
                    border: `1px solid ${c.ink}`,
                    borderRadius: 0,
                    color: c.ink,
                    fontFamily: 'IBM Plex Mono',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" name="Frekuensi" fill={c.muted} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <div className="text-[13px] font-mono-code mb-2 text-[var(--ink)] font-semibold">
            B. Sesudah Transformasi log1p(x)
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={logBins} margin={{top: 5, right: 8, left: -12, bottom: 24}}>
                <CartesianGrid stroke={c.rule} strokeDasharray="2 2" vertical={false} />
                <XAxis
                  dataKey="range"
                  tick={{fill: c.ink, fontSize: 10, fontFamily: 'IBM Plex Mono'}}
                  angle={-30}
                  textAnchor="end"
                  interval={1}
                  stroke={c.ink}
                />
                <YAxis
                  tick={{fill: c.ink, fontSize: 11, fontFamily: 'IBM Plex Mono'}}
                  stroke={c.ink}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: c.paper,
                    border: `1px solid ${c.ink}`,
                    borderRadius: 0,
                    color: c.ink,
                    fontFamily: 'IBM Plex Mono',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" name="Frekuensi" fill={c.ink} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

// 5. Three Line Charts for k = 2..8 (Gambar 6)
export const SelectionKCharts: React.FC<
  {metrics: KMetric[]; selectedK: number} & ThemeProps
> = ({metrics, selectedK, isInverted}) => {
  const c = getInkColors(isInverted);
  const formatted = metrics.map((m) => ({
    k: m.k,
    inertia: Number(m.inertia.toFixed(1)),
    silhouette: Number(m.silhouette.toFixed(3)),
    daviesBouldin: Number(m.daviesBouldin.toFixed(3)),
  }));

  const panels: Array<{
    key: 'inertia' | 'silhouette' | 'daviesBouldin';
    title: string;
    subtitle: string;
  }> = [
    {key: 'inertia', title: '1. Elbow (Inertia)', subtitle: 'Cari patahan penurunan melandai'},
    {key: 'silhouette', title: '2. Silhouette Score', subtitle: 'Semakin tinggi semakin baik'},
    {key: 'daviesBouldin', title: '3. Davies-Bouldin', subtitle: 'Semakin rendah semakin baik'},
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {panels.map((p) => (
          <div key={p.key} className="border border-[var(--rule)] p-2.5">
            <div className="text-[13px] font-semibold font-display">{p.title}</div>
            <div className="text-[11px] text-[var(--ink-subtle)] mb-2">{p.subtitle}</div>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formatted} margin={{top: 8, right: 12, left: -10, bottom: 4}}>
                  <CartesianGrid stroke={c.rule} strokeDasharray="2 2" />
                  <XAxis
                    dataKey="k"
                    tick={{fill: c.ink, fontSize: 11, fontFamily: 'IBM Plex Mono'}}
                    stroke={c.ink}
                  />
                  <YAxis
                    tick={{fill: c.ink, fontSize: 10, fontFamily: 'IBM Plex Mono'}}
                    stroke={c.ink}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: c.paper,
                      border: `1px solid ${c.ink}`,
                      borderRadius: 0,
                      color: c.ink,
                      fontFamily: 'IBM Plex Mono',
                      fontSize: 12,
                    }}
                  />
                  <ReferenceLine
                    x={selectedK}
                    stroke={c.ink}
                    strokeDasharray="4 3"
                    strokeWidth={1.8}
                  />
                  <Line
                    type="monotone"
                    dataKey={p.key}
                    stroke={c.ink}
                    strokeWidth={2}
                    dot={{r: 3.5, fill: c.paper, stroke: c.ink, strokeWidth: 1.8}}
                    activeDot={{r: 5, fill: c.ink}}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* Compact tabular readout */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono-code text-[12px] tabular-nums">
          <thead>
            <tr className="border-y border-[var(--rule-strong)] bg-[var(--paper-alt)]">
              <th className="py-1.5 px-2 text-left">k</th>
              <th className="py-1.5 px-2 text-right">Inertia</th>
              <th className="py-1.5 px-2 text-right">Silhouette</th>
              <th className="py-1.5 px-2 text-right">Davies-Bouldin</th>
              <th className="py-1.5 px-2 text-left">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const isChosen = m.k === selectedK;
              return (
                <tr
                  key={m.k}
                  className={`border-b border-[var(--rule)] ${
                    isChosen ? 'font-bold bg-[var(--paper-alt)]' : ''
                  }`}
                >
                  <td className="py-1.5 px-2">{m.k}</td>
                  <td className="py-1.5 px-2 text-right">{formatIdNumber(m.inertia, 1)}</td>
                  <td className="py-1.5 px-2 text-right">{formatIdNumber(m.silhouette, 3)}</td>
                  <td className="py-1.5 px-2 text-right">{formatIdNumber(m.daviesBouldin, 3)}</td>
                  <td className="py-1.5 px-2">
                    {isChosen ? `k terpilih (garis vertikal)` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 6. PCA 2D Scatter Plot (Gambar 7) with Roman shapes per cluster
export const PcaScatterChart: React.FC<
  {
    points: PcaPoint[];
    clusterIds: number[];
    pc1Pct: number;
    pc2Pct: number;
    totalPct: number;
  } & ThemeProps
> = ({points, clusterIds, pc1Pct, pc2Pct, totalPct, isInverted}) => {
  const c = getInkColors(isInverted);

  const renderShapePoint = (props: {cx?: number; cy?: number; payload?: PcaPoint}) => {
    const {cx = 0, cy = 0, payload} = props;
    if (!payload) return <g />;
    const cl = payload.klaster;
    switch (cl) {
      case 1:
        return <circle cx={cx} cy={cy} r={4.5} fill={c.ink} stroke={c.ink} strokeWidth={1} />;
      case 2:
        return <circle cx={cx} cy={cy} r={4.5} fill={c.paper} stroke={c.ink} strokeWidth={1.6} />;
      case 3:
        return (
          <rect
            x={cx - 4}
            y={cy - 4}
            width={8}
            height={8}
            fill={c.ink}
            stroke={c.ink}
            strokeWidth={1}
          />
        );
      case 4:
        return (
          <polygon
            points={`${cx},${cy - 5} ${cx + 5},${cy + 4} ${cx - 5},${cy + 4}`}
            fill={c.paper}
            stroke={c.ink}
            strokeWidth={1.6}
          />
        );
      case 5:
        return (
          <g>
            <polygon
              points={`${cx},${cy - 5.5} ${cx + 5.5},${cy} ${cx},${cy + 5.5} ${cx - 5.5},${cy}`}
              fill={c.paper}
              stroke={c.ink}
              strokeWidth={1.4}
            />
            <line x1={cx - 3} y1={cy - 3} x2={cx + 3} y2={cy + 3} stroke={c.ink} strokeWidth={1} />
            <line x1={cx + 3} y1={cy - 3} x2={cx - 3} y2={cy + 3} stroke={c.ink} strokeWidth={1} />
          </g>
        );
      default:
        return (
          <g>
            <rect
              x={cx - 4.5}
              y={cy - 4.5}
              width={9}
              height={9}
              fill={c.paper}
              stroke={c.ink}
              strokeWidth={1.5}
            />
            <circle cx={cx} cy={cy} r={1.6} fill={c.ink} />
          </g>
        );
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] font-mono-code">
        <span>
          Varians dijelaskan PC1 + PC2:{' '}
          <strong className="tabular-nums">{formatIdNumber(totalPct, 1)}%</strong> (PC1:{' '}
          {formatIdNumber(pc1Pct, 1)}% · PC2: {formatIdNumber(pc2Pct, 1)}%)
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
        {clusterIds.map((cid) => (
          <span key={cid} className="inline-flex items-center gap-1.5">
            <ClusterSymbol cluster={cid} size={14} />
            <span className="text-[12px] text-[var(--ink-muted)]">
              ({CLUSTER_SHAPE_NAMES[cid] || `Bentuk ${cid}`})
            </span>
          </span>
        ))}
      </div>

      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{top: 12, right: 16, bottom: 16, left: 0}}>
            <CartesianGrid stroke={c.rule} strokeDasharray="2 2" />
            <XAxis
              type="number"
              dataKey="pc1"
              name="PC1"
              tick={{fill: c.ink, fontSize: 11, fontFamily: 'IBM Plex Mono'}}
              stroke={c.ink}
              label={{
                value: `PC1 (${formatIdNumber(pc1Pct, 1)}%)`,
                position: 'bottom',
                offset: 0,
                fill: c.ink,
                fontSize: 12,
                fontFamily: 'IBM Plex Mono',
              }}
            />
            <YAxis
              type="number"
              dataKey="pc2"
              name="PC2"
              tick={{fill: c.ink, fontSize: 11, fontFamily: 'IBM Plex Mono'}}
              stroke={c.ink}
              label={{
                value: `PC2 (${formatIdNumber(pc2Pct, 1)}%)`,
                angle: -90,
                position: 'insideLeft',
                fill: c.ink,
                fontSize: 12,
                fontFamily: 'IBM Plex Mono',
              }}
            />
            <ZAxis range={[60, 60]} />
            <Tooltip
              cursor={{stroke: c.ink, strokeDasharray: '2 2'}}
              content={({active, payload}) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload as PcaPoint;
                return (
                  <div
                    style={{
                      backgroundColor: c.paper,
                      border: `1px solid ${c.ink}`,
                      color: c.ink,
                    }}
                    className="p-2 text-[12px] font-mono-code"
                  >
                    <div className="font-bold">{d.nama_simpul}</div>
                    <div>
                      Klaster {toRoman(d.klaster)} · {d.kecamatan}
                    </div>
                    <div>
                      PC1: {formatIdNumber(d.pc1, 2)} | PC2: {formatIdNumber(d.pc2, 2)}
                    </div>
                  </div>
                );
              }}
            />
            {clusterIds.map((cid) => (
              <Scatter
                key={cid}
                name={`Klaster ${toRoman(cid)}`}
                data={points.filter((p) => p.klaster === cid)}
                shape={renderShapePoint as unknown as (props: unknown) => React.ReactElement}
                isAnimationActive={false}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// 7. Cluster Profile Z-Score Heatmap (Gambar 8)
export const ProfileZHeatmap: React.FC<{profiles: ClusterZProfile[]} & ThemeProps> = ({
  profiles,
  isInverted,
}) => {
  const cols = [...CLUSTERING_FEATURES, 'skor_fasilitas'];

  // Map z-score [-1.8, 1.8] to [0, 1] monotonic grayscale
  const normZ = (z: number) => Math.max(0, Math.min(1, (z + 1.6) / 3.2));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="text-[12px] font-mono-code text-[var(--ink-muted)] mb-2">
          Nilai z-score antar-klaster (positif = di atas rata-rata klaster; skala abu-abu satu arah)
        </div>
        <table className="w-full border-collapse font-mono-code text-[12px] tabular-nums">
          <thead>
            <tr className="border-y border-[var(--rule-strong)] bg-[var(--paper-alt)]">
              <th className="p-2 text-left border border-[var(--rule)]">Klaster (n)</th>
              {cols.map((col) => (
                <th key={col} className="p-2 text-center border border-[var(--rule)]">
                  {SHORT_FEATURE_LABELS[col] || col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profiles.map((prof) => (
              <tr key={prof.klaster}>
                <th className="p-2 text-left border border-[var(--rule)] bg-[var(--paper-alt)] whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <ClusterSymbol cluster={prof.klaster} size={14} />
                    <span className="font-normal text-[var(--ink-muted)]">({prof.count})</span>
                  </span>
                </th>
                {cols.map((col) => {
                  const z = prof.zScores[col] ?? 0;
                  const {bg, fg} = getGrayScaleCell(normZ(z), isInverted);
                  return (
                    <td
                      key={col}
                      style={{backgroundColor: bg, color: fg}}
                      className="p-2 text-center border border-[var(--rule)] font-medium"
                      title={`Klaster ${toRoman(prof.klaster)} · ${col}: z=${formatIdNumber(z, 2)}, rata-rata=${formatIdNumber(prof.rawMeans[col] || 0, 2)}`}
                    >
                      {z > 0 ? `+${formatIdNumber(z, 2)}` : formatIdNumber(z, 2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 8. Radar Chart with distinct line stroke dash styles per cluster (Gambar 9)
const RADAR_LINE_STYLES: Array<{dash: string; label: string; width: number}> = [
  {dash: '', label: 'garis penuh', width: 2.4},
  {dash: '6 4', label: 'putus-putus', width: 2.2},
  {dash: '2 3', label: 'titik-titik', width: 2.2},
  {dash: '10 3 2 3', label: 'garis-titik', width: 2.2},
  {dash: '12 4', label: 'putus panjang', width: 2.0},
  {dash: '4 2 1 2', label: 'ganda pendek', width: 2.0},
];

export const ClusterRadarChart: React.FC<{profiles: ClusterZProfile[]} & ThemeProps> = ({
  profiles,
  isInverted,
}) => {
  const c = getInkColors(isInverted);
  const cols = [...CLUSTERING_FEATURES, 'skor_fasilitas'];

  // Shift z-scores by +2 so radar radii are non-negative [0, 4]
  const radarData = cols.map((col) => {
    const entry: Record<string, string | number> = {
      fitur: SHORT_FEATURE_LABELS[col] || col,
    };
    profiles.forEach((p) => {
      const z = p.zScores[col] ?? 0;
      entry[`k${p.klaster}`] = Number(Math.max(0.1, z + 2).toFixed(2));
    });
    return entry;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] font-mono-code">
        {profiles.map((p, idx) => {
          const style = RADAR_LINE_STYLES[idx % RADAR_LINE_STYLES.length];
          return (
            <span key={p.klaster} className="inline-flex items-center gap-2">
              <svg width="28" height="10" aria-hidden="true">
                <line
                  x1="0"
                  y1="5"
                  x2="28"
                  y2="5"
                  stroke={c.ink}
                  strokeWidth={style.width}
                  strokeDasharray={style.dash || undefined}
                />
              </svg>
              <ClusterSymbol cluster={p.klaster} size={13} />
              <span className="text-[var(--ink-muted)]">({style.label})</span>
            </span>
          );
        })}
      </div>

      <div className="w-full h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="74%">
            <PolarGrid stroke={c.rule} />
            <PolarAngleAxis
              dataKey="fitur"
              tick={{fill: c.ink, fontSize: 12, fontFamily: 'IBM Plex Mono'}}
            />
            <PolarRadiusAxis
              domain={[0, 4]}
              tick={false}
              axisLine={false}
            />
            {profiles.map((p, idx) => {
              const style = RADAR_LINE_STYLES[idx % RADAR_LINE_STYLES.length];
              return (
                <Radar
                  key={p.klaster}
                  name={`Klaster ${toRoman(p.klaster)}`}
                  dataKey={`k${p.klaster}`}
                  stroke={c.ink}
                  strokeWidth={style.width}
                  strokeDasharray={style.dash || undefined}
                  fill="none"
                  isAnimationActive={false}
                />
              );
            })}
            <Tooltip
              contentStyle={{
                backgroundColor: c.paper,
                border: `1px solid ${c.ink}`,
                borderRadius: 0,
                color: c.ink,
                fontFamily: 'IBM Plex Mono',
                fontSize: 12,
              }}
              formatter={(value: unknown) => [
                `z = ${formatIdNumber(Number(value) - 2, 2)}`,
                '',
              ]}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// 9. Boxplot skor_fasilitas per cluster (Gambar 10)
export const FacilityBoxplotChart: React.FC<{stats: BoxplotStat[]} & ThemeProps> = ({
  stats,
  isInverted,
}) => {
  const c = getInkColors(isInverted);
  const svgW = 640;
  const svgH = 260;
  const padL = 56;
  const padR = 24;
  const padT = 20;
  const padB = 46;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const minVal = 0.5;
  const maxVal = 5.2;
  const yOf = (v: number) => padT + ((maxVal - v) / (maxVal - minVal)) * plotH;

  const ticks = [1, 2, 3, 4, 5];

  return (
    <div className="space-y-3">
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-auto max-h-[260px]"
          role="img"
          aria-label="Boxplot distribusi skor fasilitas per klaster"
        >
          {/* Horizontal grid lines */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={padL}
                y1={yOf(t)}
                x2={svgW - padR}
                y2={yOf(t)}
                stroke={c.rule}
                strokeDasharray="2 2"
              />
              <text
                x={padL - 10}
                y={yOf(t) + 4}
                textAnchor="end"
                fill={c.ink}
                fontSize="11"
                fontFamily="IBM Plex Mono"
              >
                {t},0
              </text>
            </g>
          ))}

          {/* Axes */}
          <line x1={padL} y1={padT} x2={padL} y2={svgH - padB} stroke={c.ink} strokeWidth="1.2" />
          <line
            x1={padL}
            y1={svgH - padB}
            x2={svgW - padR}
            y2={svgH - padB}
            stroke={c.ink}
            strokeWidth="1.2"
          />

          {/* Y axis label */}
          <text
            x={16}
            y={padT + plotH / 2}
            textAnchor="middle"
            transform={`rotate(-90 16 ${padT + plotH / 2})`}
            fill={c.ink}
            fontSize="12"
            fontFamily="IBM Plex Mono"
          >
            skor_fasilitas (1–5)
          </text>

          {/* Boxes per cluster */}
          {stats.map((st, idx) => {
            const bandW = plotW / (stats.length || 1);
            const cx = padL + bandW * (idx + 0.5);
            const boxW = Math.min(46, bandW * 0.45);
            const yMin = yOf(st.min);
            const yQ1 = yOf(st.q1);
            const yMed = yOf(st.median);
            const yQ3 = yOf(st.q3);
            const yMax = yOf(st.max);

            return (
              <g key={st.klaster}>
                {/* Whisker line */}
                <line x1={cx} y1={yMax} x2={cx} y2={yMin} stroke={c.ink} strokeWidth="1.4" />
                {/* Top & bottom caps */}
                <line
                  x1={cx - boxW * 0.35}
                  y1={yMax}
                  x2={cx + boxW * 0.35}
                  y2={yMax}
                  stroke={c.ink}
                  strokeWidth="1.4"
                />
                <line
                  x1={cx - boxW * 0.35}
                  y1={yMin}
                  x2={cx + boxW * 0.35}
                  y2={yMin}
                  stroke={c.ink}
                  strokeWidth="1.4"
                />
                {/* IQR Box */}
                <rect
                  x={cx - boxW / 2}
                  y={yQ3}
                  width={boxW}
                  height={Math.max(2, yQ1 - yQ3)}
                  fill={c.paperAlt}
                  stroke={c.ink}
                  strokeWidth="1.8"
                />
                {/* Median thick line */}
                <line
                  x1={cx - boxW / 2}
                  y1={yMed}
                  x2={cx + boxW / 2}
                  y2={yMed}
                  stroke={c.ink}
                  strokeWidth="3"
                />
                {/* Outliers */}
                {st.outliers.map((oVal, oi) => (
                  <circle
                    key={oi}
                    cx={cx}
                    cy={yOf(oVal)}
                    r={3.2}
                    fill={c.paper}
                    stroke={c.ink}
                    strokeWidth="1.4"
                  />
                ))}
                {/* X Label */}
                <text
                  x={cx}
                  y={svgH - padB + 18}
                  textAnchor="middle"
                  fill={c.ink}
                  fontSize="12"
                  fontFamily="IBM Plex Mono"
                  fontWeight="600"
                >
                  Klaster {toRoman(st.klaster)}
                </text>
                <text
                  x={cx}
                  y={svgH - padB + 33}
                  textAnchor="middle"
                  fill={c.muted}
                  fontSize="11"
                  fontFamily="IBM Plex Mono"
                >
                  Med: {formatIdNumber(st.median, 2)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
