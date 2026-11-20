import React, {useEffect, useState} from 'react';
import {
  ComputedAnalytics,
  SimpulNode,
  StageAppendix,
  StageKey,
  WranglingLogEntry,
} from '../types/report';
import {formatIdNumber, getDynamicInterpretation, toRoman} from '../utils/analytics';
import {
  ClusterRadarChart,
  ClusterRegionStackedBarChart,
  DedupComparisonChart,
  FacilityBoxplotChart,
  Log1pHistogramChart,
  MissingBarChart,
  PcaScatterChart,
  ProfileZHeatmap,
  SelectionKCharts,
  SpearmanHeatmap,
} from './Charts';
import {CodeBlock} from './CodeBlock';
import {SurabayaMap} from './SurabayaMap';

export interface PresentationSlide {
  id: string;
  judul: string;
  nomorVisual: string;
  stageKey: StageKey;
  insightKey?: string;
}

export const PRESENTATION_SLIDES: PresentationSlide[] = [
  {
    id: 'fig-peta',
    nomorVisual: 'Gambar 1',
    judul: 'Peta Sebaran Simpul Transportasi Surabaya Raya',
    stageKey: 'folium',
    insightKey: 'peta',
  },
  {
    id: 'tbl-wrangling',
    nomorVisual: 'Tabel 1',
    judul: 'Log Data Wrangling & Penanganan Kualitas Data',
    stageKey: 'ingestion',
  },
  {
    id: 'fig-missing',
    nomorVisual: 'Gambar 2',
    judul: 'Persentase Data Kosong per Kolom pada Profiling Awal',
    stageKey: 'profiling',
    insightKey: 'missing',
  },
  {
    id: 'fig-dedup',
    nomorVisual: 'Gambar 3',
    judul: 'Perbandingan Jumlah Node Sebelum dan Sesudah Deduplikasi (25 m)',
    stageKey: 'cleansing',
    insightKey: 'dedup',
  },
  {
    id: 'fig-korelasi',
    nomorVisual: 'Gambar 4',
    judul: 'Matriks Korelasi Spearman Antarfitur Kawasan',
    stageKey: 'scaling_korelasi',
    insightKey: 'korelasi',
  },
  {
    id: 'fig-log1p',
    nomorVisual: 'Gambar 5',
    judul: 'Distribusi Fitur Sebelum dan Sesudah Transformasi log1p',
    stageKey: 'scaling_korelasi',
    insightKey: 'log1p',
  },
  {
    id: 'tbl-outlier',
    nomorVisual: 'Tabel 2',
    judul: 'Daftar Observasi Ekstrem yang Divalidasi sebagai Hub Utama',
    stageKey: 'outlier',
    insightKey: 'outlier',
  },
  {
    id: 'fig-pemilihan-k',
    nomorVisual: 'Gambar 6',
    judul: 'Evaluasi Jumlah Klaster k = 2–8 (Elbow, Silhouette, Davies-Bouldin)',
    stageKey: 'clustering',
    insightKey: 'pemilihan_k',
  },
  {
    id: 'fig-pca',
    nomorVisual: 'Gambar 7',
    judul: 'Proyeksi Sebaran Klaster pada Ruang PCA 2D',
    stageKey: 'clustering',
    insightKey: 'pca',
  },
  {
    id: 'fig-heatmap-profil',
    nomorVisual: 'Gambar 8',
    judul: 'Heatmap Profil Z-Score Rata-Rata Fitur per Klaster',
    stageKey: 'profil_klaster',
    insightKey: 'heatmap_profil',
  },
  {
    id: 'fig-radar',
    nomorVisual: 'Gambar 9',
    judul: 'Grafik Radar Perbandingan Profil Klaster (Gaya Garis)',
    stageKey: 'profil_klaster',
    insightKey: 'radar',
  },
  {
    id: 'fig-boxplot',
    nomorVisual: 'Gambar 10',
    judul: 'Distribusi Skor Fasilitas (skor_fasilitas) per Klaster',
    stageKey: 'profil_klaster',
    insightKey: 'boxplot',
  },
  {
    id: 'fig-sebaran-wilayah',
    nomorVisual: 'Gambar 11',
    judul: 'Sebaran Klaster per Kabupaten/Kota (Batang Bertumpuk)',
    stageKey: 'profil_klaster',
    insightKey: 'sebaran_wilayah',
  },
];

interface PresentationModeProps {
  isOpen: boolean;
  initialSlideIndex?: number;
  onClose: () => void;
  nodes: SimpulNode[];
  analytics: ComputedAnalytics;
  wranglingLog: WranglingLogEntry[];
  stages: Record<StageKey, StageAppendix>;
  insights: Record<string, string>;
  isSampleData: boolean;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({
  isOpen,
  initialSlideIndex = 0,
  onClose,
  nodes,
  analytics,
  wranglingLog,
  stages,
  insights,
  isSampleData,
}) => {
  const [slideIdx, setSlideIdx] = useState(initialSlideIndex);
  const [secondsLeft, setSecondsLeft] = useState(8 * 60); // 8 minutes countdown
  const [timerRunning, setTimerRunning] = useState(true);
  const [rightTab, setRightTab] = useState<'ringkas' | 'kode'>('ringkas');

  useEffect(() => {
    if (isOpen) {
      setSlideIdx(initialSlideIndex);
      setSecondsLeft(8 * 60);
      setTimerRunning(true);
    }
  }, [isOpen, initialSlideIndex]);

  useEffect(() => {
    if (!isOpen || !timerRunning) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isOpen, timerRunning]);

  const activeSlides = React.useMemo(
    () =>
      PRESENTATION_SLIDES.filter(
        (s) => s.id !== 'fig-sebaran-wilayah' || analytics.hasKabupatenKota
      ),
    [analytics.hasKabupatenKota]
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        setSlideIdx((s) => Math.min(activeSlides.length - 1, s + 1));
      } else if (e.key === 'ArrowLeft') {
        setSlideIdx((s) => Math.max(0, s - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, activeSlides.length]);

  if (!isOpen) return null;

  const safeIdx = Math.min(slideIdx, Math.max(0, activeSlides.length - 1));
  const slide = activeSlides[safeIdx] || activeSlides[0];
  const stage = stages[slide.stageKey];
  const dynamicInterp = getDynamicInterpretation(slide.stageKey, analytics, isSampleData);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  const renderVisual = () => {
    switch (slide.id) {
      case 'fig-peta':
        return (
          <SurabayaMap
            nodes={nodes}
            clusterIds={analytics.clusterIds}
            isInverted={true}
            heightClass="h-[460px]"
            hasKabupatenKota={analytics.hasKabupatenKota}
            regionList={analytics.regionList}
          />
        );
      case 'tbl-wrangling':
        return (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[15px]">
              <thead>
                <tr className="border-y border-[#F2F2EE] bg-[#1A1A18]">
                  <th className="p-2 text-left">Masalah</th>
                  <th className="p-2 text-left">Jumlah Terdampak</th>
                  <th className="p-2 text-left">Tindakan</th>
                  <th className="p-2 text-left">Alasan</th>
                </tr>
              </thead>
              <tbody>
                {wranglingLog.map((row) => (
                  <tr key={row.id} className="border-b border-[#4A4A46]">
                    <td className="p-2 align-top">{row.masalah}</td>
                    <td className="p-2 align-top font-mono-code text-[13px] whitespace-nowrap">
                      {row.jumlahTerdampak}
                    </td>
                    <td className="p-2 align-top">{row.tindakan}</td>
                    <td className="p-2 align-top text-[#C2C2BC]">{row.alasan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'fig-missing':
        return <MissingBarChart stats={analytics.missingStats} isInverted={true} />;
      case 'fig-dedup':
        return (
          <DedupComparisonChart
            preCount={analytics.preDedupCount}
            postCount={analytics.postDedupCount}
            isInverted={true}
          />
        );
      case 'fig-korelasi':
        return (
          <SpearmanHeatmap
            matrix={analytics.spearmanMatrix}
            featureNames={analytics.featureNames}
            isInverted={true}
          />
        );
      case 'fig-log1p':
        return <Log1pHistogramChart nodes={nodes} isInverted={true} />;
      case 'tbl-outlier':
        return (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px] font-mono-code tabular-nums">
              <thead>
                <tr className="border-y border-[#F2F2EE] bg-[#1A1A18]">
                  <th className="p-2 text-left">Nama Simpul</th>
                  <th className="p-2 text-left">Jenis</th>
                  <th className="p-2 text-right">POI 500m</th>
                  <th className="p-2 text-right">Simpul 500m</th>
                  <th className="p-2 text-left">Status Validasi</th>
                </tr>
              </thead>
              <tbody>
                {analytics.outliers.map((o, i) => (
                  <tr key={i} className="border-b border-[#4A4A46]">
                    <td className="p-2 font-body">{o.nama_simpul}</td>
                    <td className="p-2">{o.jenis_simpul}</td>
                    <td className="p-2 text-right">{o.poi_total_500m}</td>
                    <td className="p-2 text-right">{o.jumlah_simpul_500m}</td>
                    <td className="p-2 font-body text-[13px]">{o.statusValidasi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'fig-pemilihan-k':
        return (
          <SelectionKCharts
            metrics={analytics.kMetrics}
            selectedK={analytics.numClusters}
            isInverted={true}
          />
        );
      case 'fig-pca':
        return (
          <PcaScatterChart
            points={analytics.pcaPoints}
            clusterIds={analytics.clusterIds}
            pc1Pct={analytics.pc1VariancePct}
            pc2Pct={analytics.pc2VariancePct}
            totalPct={analytics.pcaVariancePct}
            isInverted={true}
          />
        );
      case 'fig-heatmap-profil':
        return <ProfileZHeatmap profiles={analytics.clusterProfiles} isInverted={true} />;
      case 'fig-radar':
        return <ClusterRadarChart profiles={analytics.clusterProfiles} isInverted={true} />;
      case 'fig-boxplot':
        return <FacilityBoxplotChart stats={analytics.facilityBoxplots} isInverted={true} />;
      case 'fig-sebaran-wilayah':
        return (
          <ClusterRegionStackedBarChart
            regionCounts={analytics.clusterRegionCounts}
            clusterIds={analytics.clusterIds}
            isInverted={true}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] theme-inverted bg-[#111111] text-[#F2F2EE] flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Mode Presentasi Layar Penuh"
    >
      {/* Top presentation bar */}
      <header className="px-6 py-3 border-b border-[#F2F2EE] flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <span className="small-caps text-[13px] tracking-widest border border-[#F2F2EE] px-2.5 py-0.5 font-mono-code">
            Slide {safeIdx + 1} dari {activeSlides.length}
          </span>
          <span className="font-mono-code text-[13px] text-[#C2C2BC]">
            {slide.nomorVisual} · {stage.labelBlok}
          </span>
          {isSampleData && (
            <span className="font-mono-code text-[12px] border border-[#F2F2EE] px-2 py-0.5">
              DATA CONTOH
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* 8-minute countdown timer */}
          <div className="flex items-center gap-2 border border-[#4A4A46] px-3 py-1 font-mono-code tabular-nums">
            <span className="small-caps text-[11px] tracking-widest text-[#C2C2BC]">
              Waktu
            </span>
            <span className="text-[18px] font-bold">{mm}:{ss}</span>
            <button
              type="button"
              onClick={() => setTimerRunning((r) => !r)}
              className="text-[11px] underline ml-1 cursor-pointer"
            >
              {timerRunning ? 'Jeda' : 'Mulai'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSecondsLeft(8 * 60);
                setTimerRunning(true);
              }}
              className="text-[11px] underline cursor-pointer"
            >
              Ulang
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 font-mono-code text-[13px] border border-[#F2F2EE] hover:bg-[#F2F2EE] hover:text-[#111111] cursor-pointer fade-150"
          >
            Keluar (Esc)
          </button>
        </div>
      </header>

      {/* Main split body: visual left, code & interpretation right */}
      <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12">
        {/* Left: Visual */}
        <div className="lg:col-span-7 p-6 lg:border-r border-[#4A4A46] flex flex-col justify-between">
          <div>
            <h2 className="font-display text-[26px] font-bold leading-snug mb-4">
              {slide.nomorVisual}. {slide.judul}
            </h2>
            <div className="border border-[#4A4A46] p-4 bg-[#111111]">{renderVisual()}</div>
          </div>

          {slide.insightKey && insights[slide.insightKey] && (
            <div className="mt-4 border-t border-[#4A4A46] pt-3 text-[16px] text-[#C2C2BC]">
              <span className="small-caps text-[12px] tracking-widest text-[#F2F2EE] mr-2">
                Insight:
              </span>
              {insights[slide.insightKey]}
            </div>
          )}
        </div>

        {/* Right: Code + Interpretation + Script */}
        <div className="lg:col-span-5 p-6 flex flex-col space-y-5 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-[#4A4A46] pb-3">
            <div>
              <div className="small-caps text-[12px] tracking-widest text-[#C2C2BC]">
                Penanggung jawab: {stage.penanggungJawab}
              </div>
              <div className="font-display text-[19px] font-bold">{stage.judulTahap}</div>
            </div>
            <div className="flex border border-[#F2F2EE]">
              <button
                type="button"
                onClick={() => setRightTab('ringkas')}
                className={`px-3 py-1 font-mono-code text-[12px] cursor-pointer ${
                  rightTab === 'ringkas' ? 'bg-[#F2F2EE] text-[#111111] font-bold' : ''
                }`}
              >
                Interpretasi
              </button>
              <button
                type="button"
                onClick={() => setRightTab('kode')}
                className={`px-3 py-1 font-mono-code text-[12px] cursor-pointer ${
                  rightTab === 'kode' ? 'bg-[#F2F2EE] text-[#111111] font-bold' : ''
                }`}
              >
                Kode Python
              </button>
            </div>
          </div>

          {rightTab === 'ringkas' ? (
            <div className="space-y-5 text-[18px] leading-relaxed">
              <div>
                <h3 className="small-caps text-[12px] tracking-widest text-[#C2C2BC] mb-1">
                  Cara Membaca Keluaran
                </h3>
                <p className="border border-[#F2F2EE] p-3.5 bg-[#1A1A18] text-[17px]">
                  {dynamicInterp}
                </p>
              </div>

              <div>
                <h3 className="small-caps text-[12px] tracking-widest text-[#C2C2BC] mb-1">
                  Alasan Pemilihan Metode
                </h3>
                <p className="text-[16px] text-[#E0E0DA]">{stage.alasanPemilihanMetode}</p>
              </div>

              <div>
                <h3 className="small-caps text-[12px] tracking-widest text-[#C2C2BC] mb-1">
                  Skrip Presentasi (20–30 Detik)
                </h3>
                <p className="italic text-[17px] border-t border-[#4A4A46] pt-2">
                  “{stage.skripPresentasi}”
                </p>
              </div>
            </div>
          ) : (
            <CodeBlock
              code={stage.kodePython}
              isAutoGenerated={stage.isAutoGeneratedCode}
              compact={true}
            />
          )}
        </div>
      </div>

      {/* Bottom navigation footer */}
      <footer className="px-6 py-3 border-t border-[#F2F2EE] flex items-center justify-between shrink-0 bg-[#111111]">
        <button
          type="button"
          onClick={() => setSlideIdx((s) => Math.max(0, s - 1))}
          disabled={safeIdx === 0}
          className="px-4 py-1.5 font-mono-code text-[14px] border border-[#F2F2EE] disabled:opacity-40 cursor-pointer"
        >
          &larr; Sebelumnya
        </button>

        <div className="hidden md:flex items-center gap-1.5 font-mono-code text-[12px]">
          {activeSlides.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSlideIdx(idx)}
              className={`px-2 py-0.5 border cursor-pointer ${
                idx === safeIdx
                  ? 'bg-[#F2F2EE] text-[#111111] border-[#F2F2EE] font-bold'
                  : 'border-[#4A4A46] text-[#C2C2BC] hover:border-[#F2F2EE]'
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSlideIdx((s) => Math.min(activeSlides.length - 1, s + 1))}
          disabled={safeIdx === activeSlides.length - 1}
          className="px-4 py-1.5 font-mono-code text-[14px] border border-[#F2F2EE] disabled:opacity-40 cursor-pointer"
        >
          Berikutnya &rarr;
        </button>
      </footer>
    </div>
  );
};
