import React, {useEffect, useMemo, useRef, useState} from 'react';
import {AppendixDrawer} from './components/AppendixDrawer';
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
} from './components/Charts';
import {CodeBlock} from './components/CodeBlock';
import {ClusterSymbol} from './components/ClusterSymbol';
import {FigureWrapper} from './components/FigureWrapper';
import {PresentationMode} from './components/PresentationMode';
import {SurabayaMap} from './components/SurabayaMap';
import {INITIAL_STAGE_APPENDICES} from './data/codeBlocks';
import {
  generateSyntheticDataset,
  INITIAL_GROUP_IDENTITY,
  INITIAL_INSIGHTS,
  INITIAL_RECOMMENDATIONS,
  INITIAL_WRANGLING_LOG,
} from './data/syntheticData';
import {
  ClusterRecommendation,
  GroupIdentity,
  KMetric,
  MissingColStat,
  SimpulNode,
  StageAppendix,
  StageKey,
  ThemeMode,
  WranglingLogEntry,
} from './types/report';
import {
  computeAnalytics,
  FEATURE_LABELS,
  formatIdNumber,
  getDynamicInterpretation,
  parseUploadedCsv,
  toRoman,
} from './utils/analytics';

const CHAPTERS = [
  {id: 'bab-1', roman: 'I', title: 'Ringkasan'},
  {id: 'bab-2', roman: 'II', title: 'Peta Sebaran'},
  {id: 'bab-3', roman: 'III', title: 'Data Wrangling'},
  {id: 'bab-4', roman: 'IV', title: 'Analisis Eksplorasi'},
  {id: 'bab-5', roman: 'V', title: 'Pemilihan k'},
  {id: 'bab-6', roman: 'VI', title: 'Hasil Klaster'},
  {id: 'bab-7', roman: 'VII', title: 'Rekomendasi'},
  {id: 'bab-8', roman: 'VIII', title: 'Lampiran Kode'},
] as const;

const PIPELINE_STEPS: Array<{
  num: string;
  judul: string;
  ringkas: string;
  stageKey: StageKey;
}> = [
  {
    num: '1',
    judul: 'Ingestion',
    ringkas: 'Overpass OSM, BPS, GeoJSON batas kecamatan',
    stageKey: 'ingestion',
  },
  {
    num: '2',
    judul: 'Profiling & Cleansing',
    ringkas: 'Audit missing & dedup BallTree radius 25 m',
    stageKey: 'cleansing',
  },
  {
    num: '3',
    judul: 'Feature Engineering',
    ringkas: 'POI 500 m, proporsi kategori, entropi Shannon',
    stageKey: 'feature_engineering',
  },
  {
    num: '4',
    judul: 'Transformasi & K-Means',
    ringkas: 'log1p, Spearman, Z-score, uji k=2–8 & PCA 2D',
    stageKey: 'clustering',
  },
  {
    num: '5',
    judul: 'Profil & Rekomendasi',
    ringkas: 'Z-score tiap klaster & arah strategi kawasan',
    stageKey: 'profil_klaster',
  },
];

const ALL_STAGE_ORDER: StageKey[] = [
  'ingestion',
  'profiling',
  'cleansing',
  'outlier',
  'feature_engineering',
  'scaling_korelasi',
  'clustering',
  'profil_klaster',
  'folium',
];

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>('cetak');
  const [nodes, setNodes] = useState<SimpulNode[]>(() => generateSyntheticDataset());
  const [isSampleData, setIsSampleData] = useState<boolean>(true);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedMissingStats, setUploadedMissingStats] = useState<MissingColStat[] | null>(null);
  const [overrideKMetrics, setOverrideKMetrics] = useState<KMetric[] | null>(null);
  const [overridePreDedupCount, setOverridePreDedupCount] = useState<number | null>(null);

  const [groupIdentity, setGroupIdentity] = useState<GroupIdentity>(INITIAL_GROUP_IDENTITY);
  const [editingGroup, setEditingGroup] = useState<boolean>(false);
  const [wranglingLog, setWranglingLog] = useState<WranglingLogEntry[]>(INITIAL_WRANGLING_LOG);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  const [recommendations, setRecommendations] =
    useState<ClusterRecommendation[]>(INITIAL_RECOMMENDATIONS);
  const [editingRecKlaster, setEditingRecKlaster] = useState<number | null>(null);

  const [insights, setInsights] = useState<Record<string, string>>(INITIAL_INSIGHTS);
  const [stages, setStages] = useState<Record<StageKey, StageAppendix>>(INITIAL_STAGE_APPENDICES);

  const [activeChapter, setActiveChapter] = useState<string>('bab-1');
  const [selectedRegion, setSelectedRegion] = useState<string>('semua');
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerStageKey, setDrawerStageKey] = useState<StageKey>('ingestion');
  const [drawerVisualTitle, setDrawerVisualTitle] = useState<string>('');
  const [presentationOpen, setPresentationOpen] = useState<boolean>(false);

  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  const isInverted = theme === 'terbalik';

  // Detect optional kabupaten_kota column and available regions from full dataset
  const {hasKabupatenKota, regionList} = useMemo(() => {
    const hasCol = nodes.some(
      (n) => typeof n.kabupaten_kota === 'string' && n.kabupaten_kota.trim().length > 0
    );
    const preferredOrder = ['Kota Surabaya', 'Kabupaten Sidoarjo', 'Kabupaten Gresik'];
    const set = new Set<string>();
    if (hasCol) {
      nodes.forEach((n) => {
        const reg = (n.kabupaten_kota || '').trim();
        if (reg) set.add(reg);
      });
    }
    const list = Array.from(set).sort((a, b) => {
      const ia = preferredOrder.indexOf(a);
      const ib = preferredOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b, 'id');
    });
    return {hasKabupatenKota: hasCol, regionList: list};
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    if (!hasKabupatenKota || selectedRegion === 'semua') return nodes;
    return nodes.filter((n) => (n.kabupaten_kota || '').trim() === selectedRegion);
  }, [nodes, hasKabupatenKota, selectedRegion]);

  // Compute all statistical outputs dynamically from active (and region-filtered) dataset
  const analytics = useMemo(
    () =>
      computeAnalytics(filteredNodes, {
        isSampleData,
        uploadedMissingStats,
        overrideKMetrics,
        overridePreDedupCount,
      }),
    [filteredNodes, isSampleData, uploadedMissingStats, overrideKMetrics, overridePreDedupCount]
  );

  // Sync recommendations array if uploaded CSV has different cluster count
  useEffect(() => {
    setRecommendations((prev) => {
      const byId = new Map(prev.map((r) => [r.klaster, r]));
      return analytics.clusterIds.map((cid) => {
        if (byId.has(cid)) return byId.get(cid)!;
        return {
          klaster: cid,
          namaKlaster: `Tipologi Kawasan Klaster ${toRoman(cid)}`,
          arahStrategi:
            'Penyesuaian prasarana dan integrasi layanan sesuai karakteristik kepadatan serta keberagaman fasilitas sekitar simpul.',
        };
      });
    });
  }, [analytics.clusterIds]);

  // Track active chapter in sticky TOC using IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveChapter(visible[0].target.id);
        }
      },
      {rootMargin: '-15% 0px -70% 0px', threshold: 0.05}
    );

    CHAPTERS.forEach((ch) => {
      const el = document.getElementById(ch.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const handleOpenAppendix = (stageKey: StageKey, visualLabel: string) => {
    setDrawerStageKey(stageKey);
    setDrawerVisualTitle(visualLabel);
    setDrawerOpen(true);
  };

  const handleUpdateStage = (key: StageKey, patch: Partial<StageAppendix>) => {
    setStages((prev) => ({
      ...prev,
      [key]: {...prev[key], ...patch},
    }));
  };

  const handleUpdateInsight = (key: string, nextVal: string) => {
    setInsights((prev) => ({...prev, [key]: nextVal}));
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const result = parseUploadedCsv(text);
      if (result.error) {
        setUploadError(result.error);
        return;
      }
      setNodes(result.nodes);
      setUploadedMissingStats(result.missingStats);
      setIsSampleData(false);
      setUploadedFileName(file.name);
      setOverridePreDedupCount(null);
      setSelectedRegion('semua');
    };
    reader.onerror = () => {
      setUploadError('Gagal membaca berkas CSV dari perangkat.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleJsonKUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '[]'));
        if (!Array.isArray(parsed)) {
          setUploadError('Berkas JSON metrik k=2–8 harus berupa array objek {k, inertia, silhouette, davies_bouldin}.');
          return;
        }
        const cleaned: KMetric[] = parsed
          .map((row: Record<string, unknown>) => ({
            k: Number(row.k),
            inertia: Number(row.inertia),
            silhouette: Number(row.silhouette),
            daviesBouldin: Number(row.davies_bouldin ?? row.daviesBouldin),
          }))
          .filter(
            (r) =>
              Number.isFinite(r.k) &&
              Number.isFinite(r.inertia) &&
              Number.isFinite(r.silhouette) &&
              Number.isFinite(r.daviesBouldin)
          )
          .sort((a, b) => a.k - b.k);
        if (cleaned.length === 0) {
          setUploadError('Struktur JSON metrik k tidak valid.');
          return;
        }
        setOverrideKMetrics(cleaned);
      } catch {
        setUploadError('Berkas JSON tidak dapat diparse.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetToSample = () => {
    setNodes(generateSyntheticDataset());
    setIsSampleData(true);
    setUploadedFileName(null);
    setUploadedMissingStats(null);
    setOverrideKMetrics(null);
    setOverridePreDedupCount(null);
    setUploadError(null);
    setSelectedRegion('semua');
  };

  return (
    <div
      className={`min-h-screen bg-[var(--paper)] text-[var(--ink)] fade-150 ${
        isInverted ? 'theme-inverted' : ''
      }`}
    >
      {/* Permanent Sample Data Banner (only removed once real CSV is uploaded) */}
      {isSampleData && (
        <div
          className="hatch-banner w-full py-2.5 px-4 flex items-center justify-center"
          role="status"
          aria-live="polite"
        >
          <div className="bg-[var(--paper)] border-2 border-[var(--rule-strong)] px-4 py-1 text-center">
            <span className="font-mono-code text-[14px] md:text-[15px] font-bold tracking-wider uppercase text-[var(--ink)]">
              DATA CONTOH. BUKAN HASIL ANALISIS SEBENARNYA.
            </span>
          </div>
        </div>
      )}

      {/* Editorial Top Toolbar */}
      <header className="border-b border-[var(--rule-strong)] bg-[var(--paper)]">
        <div className="max-w-[1380px] mx-auto px-4 md:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="text-[13px] font-mono-code text-[var(--ink-muted)] whitespace-nowrap">
            {isSampleData
              ? 'Sumber aktif: Data Sintetis Surabaya Raya (120 simpul)'
              : `Berkas aktif: ${uploadedFileName} (${nodes.length} simpul)`}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvUpload}
              className="hidden"
              aria-label="Unggah berkas CSV tabel fitur final"
            />
            <button
              type="button"
              onClick={() => csvInputRef.current?.click()}
              className="px-3.5 py-1.5 text-[13px] font-mono-code border border-[var(--rule-strong)] bg-[var(--ink)] text-[var(--paper)] hover:opacity-85 whitespace-nowrap shrink-0 cursor-pointer fade-150"
            >
              Unggah CSV
            </button>

            <input
              ref={jsonInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleJsonKUpload}
              className="hidden"
              aria-label="Unggah berkas JSON opsional metrik k=2-8"
            />
            <button
              type="button"
              onClick={() => jsonInputRef.current?.click()}
              className="px-3 py-1.5 text-[13px] font-mono-code border border-[var(--rule)] bg-[var(--paper)] text-[var(--ink)] hover:border-[var(--rule-strong)] whitespace-nowrap shrink-0 cursor-pointer fade-150"
              title="Opsional: unggah hasil k=2–8 dari notebook jika tidak memakai perhitungan klien"
            >
              {overrideKMetrics ? 'JSON k=2–8 Aktif' : 'Unggah JSON k (Opsional)'}
            </button>

            {!isSampleData && (
              <button
                type="button"
                onClick={handleResetToSample}
                className="px-3 py-1.5 text-[13px] font-mono-code border border-[var(--rule)] bg-[var(--paper)] text-[var(--ink)] hover:border-[var(--rule-strong)] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Kembali ke Data Contoh
              </button>
            )}

            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'cetak' ? 'terbalik' : 'cetak'))}
              className="px-3 py-1.5 text-[13px] font-mono-code border border-[var(--rule-strong)] bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--paper-alt)] whitespace-nowrap shrink-0 cursor-pointer fade-150"
              aria-pressed={isInverted}
            >
              Mode: {isInverted ? 'Terbalik' : 'Cetak'}
            </button>

            <button
              type="button"
              onClick={() => setPresentationOpen(true)}
              className="px-3.5 py-1.5 text-[13px] font-mono-code border border-[var(--rule-strong)] bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--paper)] whitespace-nowrap shrink-0 cursor-pointer fade-150 font-semibold"
            >
              Mode Presentasi
            </button>
          </div>
        </div>

        {/* Region Filter Bar (rendered ONLY if CSV/data includes kabupaten_kota) */}
        {hasKabupatenKota && regionList.length > 0 && (
          <div className="border-t border-[var(--rule)] bg-[var(--paper-alt)]">
            <div className="max-w-[1380px] mx-auto px-4 md:px-8 py-2 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="small-caps text-[12px] tracking-widest text-[var(--ink-muted)] mr-1">
                  Filter Wilayah (Peta &amp; Semua Grafik):
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedRegion('semua')}
                  className={`px-2.5 py-1 font-mono-code text-[12px] border cursor-pointer fade-150 ${
                    selectedRegion === 'semua'
                      ? 'border-[var(--rule-strong)] bg-[var(--ink)] text-[var(--paper)] font-semibold'
                      : 'border-[var(--rule)] bg-[var(--paper)] text-[var(--ink)] hover:border-[var(--rule-strong)]'
                  }`}
                >
                  Semua Wilayah ({nodes.length})
                </button>
                {regionList.map((reg) => {
                  const cnt = nodes.filter((n) => (n.kabupaten_kota || '').trim() === reg).length;
                  const active = selectedRegion === reg;
                  return (
                    <button
                      key={reg}
                      type="button"
                      onClick={() => setSelectedRegion(reg)}
                      className={`px-2.5 py-1 font-mono-code text-[12px] border cursor-pointer fade-150 ${
                        active
                          ? 'border-[var(--rule-strong)] bg-[var(--ink)] text-[var(--paper)] font-semibold'
                          : 'border-[var(--rule)] bg-[var(--paper)] text-[var(--ink)] hover:border-[var(--rule-strong)]'
                      }`}
                    >
                      {reg} ({cnt})
                    </button>
                  );
                })}
              </div>
              <span className="font-mono-code text-[12px] tabular-nums text-[var(--ink-subtle)]">
                Aktif: {filteredNodes.length} simpul
              </span>
            </div>
          </div>
        )}
      </header>

      {/* Upload Error Alert (monochrome, no window.alert) */}
      {uploadError && (
        <div className="max-w-[1380px] mx-auto px-4 md:px-8 pt-4">
          <div
            className="double-box bg-[var(--paper-alt)] px-4 py-3 flex items-center justify-between gap-4 text-[15px]"
            role="alert"
          >
            <div>
              <strong className="font-mono-code">Kesalahan Unggah Berkas:</strong> {uploadError}
            </div>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="font-mono-code text-[13px] underline cursor-pointer shrink-0"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Mobile Table of Contents Dropdown */}
      <div className="lg:hidden sticky top-0 z-30 border-b border-[var(--rule-strong)] bg-[var(--paper)] px-4 py-2.5">
        <label className="flex items-center justify-between gap-3">
          <span className="small-caps text-[12px] tracking-widest font-semibold">
            Daftar Isi Laporan
          </span>
          <select
            value={activeChapter}
            onChange={(e) => {
              const target = document.getElementById(e.target.value);
              if (target) target.scrollIntoView({behavior: 'smooth'});
            }}
            className="border border-[var(--rule-strong)] bg-[var(--paper)] text-[var(--ink)] px-2.5 py-1 font-mono-code text-[13px]"
          >
            {CHAPTERS.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.roman}. {ch.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Main Three-Column Journal Layout: Sticky Left TOC | Center Reading Column + Right Marginalia */}
      <div className="max-w-[1380px] mx-auto px-4 md:px-8 py-8 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        {/* Left Sticky Vertical TOC */}
        <aside className="hidden lg:block">
          <nav
            aria-label="Daftar isi bab laporan"
            className="sticky top-8 border-t border-[var(--rule-strong)] pt-4"
          >
            <div className="small-caps text-[12px] tracking-widest text-[var(--ink-subtle)] mb-3">
              Daftar Isi
            </div>
            <ul className="space-y-1.5">
              {CHAPTERS.map((ch) => {
                const isActive = activeChapter === ch.id;
                return (
                  <li key={ch.id}>
                    <a
                      href={`#${ch.id}`}
                      className={`block py-1 pl-3 text-[14px] fade-150 ${
                        isActive
                          ? 'border-l-[3px] border-[var(--rule-strong)] font-semibold text-[var(--ink)]'
                          : 'border-l border-[var(--rule)] text-[var(--ink-muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <span className="font-mono-code text-[12px] mr-1.5">{ch.roman}.</span>
                      {ch.title}
                    </a>
                  </li>
                );
              })}
            </ul>

            <div className="mt-8 pt-4 border-t border-[var(--rule)] text-[12px] text-[var(--ink-subtle)] leading-relaxed">
              Klik gambar, tabel, atau penanda <span className="font-mono-code underline">[ Kode ]</span> untuk membuka lembar lampiran Python &amp; interpretasi.
            </div>
          </nav>
        </aside>

        {/* Right Area: Chapters containing ~760px prose + 240px marginalia */}
        <main className="min-w-0 space-y-16 pb-20">
          {/* =====================================================
              BAB I. RINGKASAN
             ===================================================== */}
          <section id="bab-1" className="scroll-mt-8">
            <div className="max-w-[760px]">
              <div className="small-caps text-[13px] tracking-widest text-[var(--ink-muted)] mb-2">
                Laporan Project Akhir · {groupIdentity.mataKuliah}
              </div>
              <h1 className="font-display text-[32px] md:text-[40px] font-bold leading-[1.18] tracking-tight double-rule pb-4">
                Clustering Simpul Transportasi Surabaya Raya Berdasarkan Karakteristik Kawasan
              </h1>

              <p className="mt-5 text-[18px] leading-relaxed text-[var(--ink)]">
                Dokumen statistik ini menyajikan proses <em className="italic">data wrangling</em>{' '}
                dan pengelompokan (<em>K-Means clustering</em>) terhadap simpul halte, stasiun,
                serta terminal di kawasan <strong>Surabaya Raya</strong> (Kota Surabaya, Kabupaten
                Sidoarjo, dan Kabupaten Gresik) berdasarkan karakter kawasan sekitar menggunakan
                data OpenStreetMap (Overpass API), kepadatan penduduk per kecamatan dari BPS, dan
                batas administrasi GeoJSON. Hasil pengelompokan menggambarkan tipologi lingkungan
                kawasan sekitar simpul sebagai dasar penentuan arah strategi layanan yang berbeda,
                dan <strong>bukan</strong> bukti peringkat simpul yang paling membutuhkan pendanaan.
              </p>

              {/* Editable Group Identity Block */}
              <div className="mt-6 border border-[var(--rule-strong)] p-4 bg-[var(--paper-alt)]">
                <div className="flex items-center justify-between border-b border-[var(--rule)] pb-2 mb-3">
                  <span className="small-caps text-[13px] tracking-widest font-semibold">
                    Identitas Kelompok Penyusun
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingGroup((v) => !v)}
                    className="font-mono-code text-[12px] underline cursor-pointer"
                  >
                    {editingGroup ? 'Selesai Sunting' : 'Ubah Identitas'}
                  </button>
                </div>

                {editingGroup ? (
                  <div className="space-y-3 text-[15px]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="block">
                        <span className="small-caps text-[11px] tracking-widest block">
                          Nama Kelompok
                        </span>
                        <input
                          type="text"
                          value={groupIdentity.namaKelompok}
                          onChange={(e) =>
                            setGroupIdentity({...groupIdentity, namaKelompok: e.target.value})
                          }
                          className="w-full border border-[var(--rule-strong)] bg-[var(--paper)] px-2.5 py-1.5 mt-1"
                        />
                      </label>
                      <label className="block">
                        <span className="small-caps text-[11px] tracking-widest block">
                          Kelas
                        </span>
                        <input
                          type="text"
                          value={groupIdentity.kelas}
                          onChange={(e) =>
                            setGroupIdentity({...groupIdentity, kelas: e.target.value})
                          }
                          className="w-full border border-[var(--rule-strong)] bg-[var(--paper)] px-2.5 py-1.5 mt-1"
                        />
                      </label>
                    </div>
                    <div className="space-y-2">
                      <span className="small-caps text-[11px] tracking-widest block">
                        Anggota &amp; NIM
                      </span>
                      {groupIdentity.anggota.map((m, idx) => (
                        <div key={m.id} className="grid grid-cols-12 gap-2">
                          <input
                            type="text"
                            value={m.nama}
                            onChange={(e) => {
                              const next = [...groupIdentity.anggota];
                              next[idx] = {...m, nama: e.target.value};
                              setGroupIdentity({...groupIdentity, anggota: next});
                            }}
                            placeholder="Nama Lengkap"
                            className="col-span-6 border border-[var(--rule)] bg-[var(--paper)] px-2 py-1 text-[14px]"
                          />
                          <input
                            type="text"
                            value={m.nim}
                            onChange={(e) => {
                              const next = [...groupIdentity.anggota];
                              next[idx] = {...m, nim: e.target.value};
                              setGroupIdentity({...groupIdentity, anggota: next});
                            }}
                            placeholder="NIM"
                            className="col-span-4 border border-[var(--rule)] bg-[var(--paper)] px-2 py-1 font-mono-code text-[14px]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setGroupIdentity({
                                ...groupIdentity,
                                anggota: groupIdentity.anggota.filter((item) => item.id !== m.id),
                              })
                            }
                            className="col-span-2 border border-[var(--rule)] text-[12px] font-mono-code cursor-pointer"
                          >
                            Hapus
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setGroupIdentity({
                            ...groupIdentity,
                            anggota: [
                              ...groupIdentity.anggota,
                              {
                                id: `m-${Date.now()}`,
                                nama: 'Anggota Baru',
                                nim: '25031554000',
                              },
                            ],
                          })
                        }
                        className="px-3 py-1 text-[12px] font-mono-code border border-[var(--rule-strong)] bg-[var(--paper)] cursor-pointer"
                      >
                        + Tambah Anggota
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[16px]">
                    <div>
                      <div className="font-semibold">{groupIdentity.namaKelompok}</div>
                      <div className="text-[14px] text-[var(--ink-muted)] mt-0.5">
                        Kelas: {groupIdentity.kelas}
                      </div>
                    </div>
                    <div>
                      <ul className="space-y-0.5 text-[15px]">
                        {groupIdentity.anggota.map((m) => (
                          <li key={m.id} className="flex justify-between gap-4">
                            <span>{m.nama}</span>
                            <span className="font-mono-code tabular-nums text-[14px] text-[var(--ink-muted)]">
                              {m.nim}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Four Key Metrics in Thin-Ruled Table */}
              <div className="mt-7">
                <div className="text-[14px] font-semibold mb-1.5">
                  Ringkasan Numerik Dataset Aktif
                </div>
                <table className="w-full border-collapse border-y border-[var(--rule-strong)] tabular-nums">
                  <thead>
                    <tr className="border-b border-[var(--rule)] text-left small-caps text-[12px] tracking-widest text-[var(--ink-muted)]">
                      <th className="py-2 pr-4">Jumlah Simpul</th>
                      <th className="py-2 px-4">Jumlah Klaster (k)</th>
                      <th className="py-2 px-4">Silhouette Score</th>
                      <th className="py-2 pl-4">Jumlah Fitur Klaster</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono-code text-[22px] font-semibold">
                    <tr>
                      <td className="py-3 pr-4">{analytics.totalNodes}</td>
                      <td className="py-3 px-4">{analytics.numClusters}</td>
                      <td className="py-3 px-4">
                        {formatIdNumber(analytics.activeSilhouette, 3)}
                      </td>
                      <td className="py-3 pl-4">{analytics.numFeatures}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-[12px] text-[var(--ink-subtle)] mt-1 font-mono-code">
                  {isSampleData
                    ? 'Catatan: angka dihitung dari data contoh sintetis (120 simpul, 4 klaster).'
                    : `Dihitung langsung di peramban dari ${uploadedFileName}.`}
                </p>
              </div>

              {/* 5-Step Horizontal Numbered Pipeline Diagram */}
              <div className="mt-8">
                <div className="small-caps text-[12px] tracking-widest text-[var(--ink-subtle)] mb-3">
                  Alur Pipeline Data Wrangling &amp; Pemodelan (klik langkah untuk lihat kode)
                </div>
                <div className="border border-[var(--rule-strong)] p-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 md:gap-0 relative">
                    {PIPELINE_STEPS.map((step, idx) => (
                      <button
                        key={step.num}
                        type="button"
                        onClick={() =>
                          handleOpenAppendix(step.stageKey, `Pipeline Langkah ${step.num}: ${step.judul}`)
                        }
                        className={`text-left p-2.5 border border-[var(--rule)] md:border-y-0 md:border-l-0 ${
                          idx < PIPELINE_STEPS.length - 1 ? 'md:border-r md:border-[var(--rule)]' : 'md:border-r-0'
                        } hover:bg-[var(--paper-alt)] cursor-pointer fade-150 flex flex-col justify-between`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono-code text-[12px] font-bold border border-[var(--rule-strong)] px-1.5 py-0.5">
                              {step.num}
                            </span>
                            {idx < PIPELINE_STEPS.length - 1 && (
                              <span
                                className="hidden md:inline font-mono-code text-[14px] text-[var(--ink-subtle)]"
                                aria-hidden="true"
                              >
                                &rarr;
                              </span>
                            )}
                          </div>
                          <div className="font-display font-bold text-[15px] leading-tight mt-1">
                            {step.judul}
                          </div>
                        </div>
                        <p className="text-[12px] text-[var(--ink-muted)] leading-snug mt-1.5">
                          {step.ringkas}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <hr className="border-t border-[var(--rule)] max-w-[760px]" />

          {/* =====================================================
              BAB II. PETA SEBARAN
             ===================================================== */}
          <section id="bab-2" className="scroll-mt-8">
            <div className="max-w-[760px]">
              <div className="small-caps text-[13px] tracking-widest text-[var(--ink-subtle)]">
                Bab II
              </div>
              <h2 className="font-display text-[26px] md:text-[30px] font-bold double-rule pb-2 mt-1">
                II. Peta Sebaran Simpul Transportasi Surabaya Raya
              </h2>
              <p className="mt-4 text-[18px] leading-relaxed">
                Distribusi geografis seluruh simpul ditampilkan menggunakan simbol geometris dan
                angka romawi tanpa pembeda warna agar tetap terbaca pada cetakan monokrom. Gunakan
                penyaring klaster dan jenis simpul untuk meninjau sebaran per kategori, serta klik
                penanda peta untuk melihat rincian fitur kawasan.
              </p>
              <div className="mt-2 text-[14px] font-mono-code">
                Rujukan kode terkait:{' '}
                <button
                  type="button"
                  onClick={() => handleOpenAppendix('ingestion', 'Gambar 1. Ingestion Data Spasial')}
                  className="underline cursor-pointer mr-4"
                >
                  [ Kode Ingestion ]
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAppendix('folium', 'Gambar 1. Peta Klaster Folium')}
                  className="underline cursor-pointer"
                >
                  [ Kode Folium Peta Klaster ]
                </button>
              </div>
            </div>

            <FigureWrapper
              id="fig-peta"
              kind="figure"
              label="Gambar 1."
              caption="Peta sebaran simpul transportasi Surabaya Raya dengan penanda bentuk dan angka romawi tiap klaster."
              source="Sumber: OpenStreetMap contributors; BPS; olahan penulis."
              stageKey="ingestion"
              insightKey="peta"
              insightText={insights.peta}
              onUpdateInsight={handleUpdateInsight}
              onOpenAppendix={handleOpenAppendix}
              interactiveInside={true}
            >
              <SurabayaMap
                nodes={nodes}
                totalUnfilteredCount={nodes.length}
                clusterIds={analytics.clusterIds}
                isInverted={isInverted}
                hasKabupatenKota={hasKabupatenKota}
                regionList={regionList}
                selectedRegion={selectedRegion}
                onSelectRegion={setSelectedRegion}
              />
            </FigureWrapper>
          </section>

          <hr className="border-t border-[var(--rule)] max-w-[760px]" />

          {/* =====================================================
              BAB III. DATA WRANGLING
             ===================================================== */}
          <section id="bab-3" className="scroll-mt-8">
            <div className="max-w-[760px]">
              <div className="small-caps text-[13px] tracking-widest text-[var(--ink-subtle)]">
                Bab III
              </div>
              <h2 className="font-display text-[26px] md:text-[30px] font-bold double-rule pb-2 mt-1">
                III. Data Wrangling &amp; Pembersihan Kualitas Data
              </h2>
              <p className="mt-4 text-[18px] leading-relaxed">
                Data mentah dari OpenStreetMap mengandung pencatatan ganda pada halte dua arah,
                kekosongan atribut fasilitas fisik, serta perbedaan ejaan nama kecamatan. Setiap
                keputusan pembersihan dicatat dalam log wrangling agar dapat diaudit dan direplikasi.
              </p>
            </div>

            {/* Tabel 1: Editable Wrangling Log */}
            <FigureWrapper
              id="tbl-wrangling"
              kind="table"
              label="Tabel 1."
              caption="Log data wrangling: masalah kualitas data, jumlah terdampak, tindakan, dan alasan metodologis."
              source="Sumber: Audit data mentah OpenStreetMap & BPS; olahan penulis."
              stageKey="ingestion"
              onOpenAppendix={handleOpenAppendix}
              interactiveInside={true}
            >
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[14px]">
                  <thead>
                    <tr className="border-y border-[var(--rule-strong)] bg-[var(--paper-alt)] text-left">
                      <th className="p-2 font-semibold">Masalah</th>
                      <th className="p-2 font-semibold whitespace-nowrap">Jumlah Terdampak</th>
                      <th className="p-2 font-semibold">Tindakan</th>
                      <th className="p-2 font-semibold">Alasan</th>
                      <th className="p-2 font-semibold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wranglingLog.map((row) => {
                      const isEditing = editingLogId === row.id;
                      return (
                        <tr key={row.id} className="border-b border-[var(--rule)] align-top">
                          {isEditing ? (
                            <>
                              <td className="p-1.5">
                                <textarea
                                  rows={2}
                                  value={row.masalah}
                                  onChange={(e) =>
                                    setWranglingLog((prev) =>
                                      prev.map((r) =>
                                        r.id === row.id ? {...r, masalah: e.target.value} : r
                                      )
                                    )
                                  }
                                  className="w-full border border-[var(--rule-strong)] bg-[var(--paper)] p-1 text-[13px]"
                                />
                              </td>
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={row.jumlahTerdampak}
                                  onChange={(e) =>
                                    setWranglingLog((prev) =>
                                      prev.map((r) =>
                                        r.id === row.id
                                          ? {...r, jumlahTerdampak: e.target.value}
                                          : r
                                      )
                                    )
                                  }
                                  className="w-full border border-[var(--rule-strong)] bg-[var(--paper)] p-1 font-mono-code text-[12px]"
                                />
                              </td>
                              <td className="p-1.5">
                                <textarea
                                  rows={2}
                                  value={row.tindakan}
                                  onChange={(e) =>
                                    setWranglingLog((prev) =>
                                      prev.map((r) =>
                                        r.id === row.id ? {...r, tindakan: e.target.value} : r
                                      )
                                    )
                                  }
                                  className="w-full border border-[var(--rule-strong)] bg-[var(--paper)] p-1 text-[13px]"
                                />
                              </td>
                              <td className="p-1.5">
                                <textarea
                                  rows={2}
                                  value={row.alasan}
                                  onChange={(e) =>
                                    setWranglingLog((prev) =>
                                      prev.map((r) =>
                                        r.id === row.id ? {...r, alasan: e.target.value} : r
                                      )
                                    )
                                  }
                                  className="w-full border border-[var(--rule-strong)] bg-[var(--paper)] p-1 text-[13px]"
                                />
                              </td>
                              <td className="p-1.5 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setEditingLogId(null)}
                                  className="font-mono-code text-[12px] underline cursor-pointer mr-2"
                                >
                                  Selesai
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setWranglingLog((prev) =>
                                      prev.filter((r) => r.id !== row.id)
                                    );
                                    setEditingLogId(null);
                                  }}
                                  className="font-mono-code text-[12px] underline cursor-pointer text-[var(--ink-muted)]"
                                >
                                  Hapus
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-2">{row.masalah}</td>
                              <td className="p-2 font-mono-code text-[13px] whitespace-nowrap tabular-nums">
                                {row.jumlahTerdampak}
                              </td>
                              <td className="p-2">{row.tindakan}</td>
                              <td className="p-2 text-[var(--ink-muted)]">{row.alasan}</td>
                              <td className="p-2 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setEditingLogId(row.id)}
                                  className="font-mono-code text-[12px] underline cursor-pointer"
                                >
                                  Ubah
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const newId = `w-${Date.now()}`;
                    setWranglingLog((prev) => [
                      ...prev,
                      {
                        id: newId,
                        masalah: 'Masalah baru',
                        jumlahTerdampak: '0 baris',
                        tindakan: 'Tindakan penanganan',
                        alasan: 'Alasan metodologis',
                      },
                    ]);
                    setEditingLogId(newId);
                  }}
                  className="px-3 py-1 font-mono-code text-[12px] border border-[var(--rule-strong)] bg-[var(--paper)] hover:bg-[var(--paper-alt)] cursor-pointer"
                >
                  + Tambah Baris Log
                </button>
              </div>
            </FigureWrapper>

            {/* Gambar 2: Missing Value Percentage Bar Chart */}
            <FigureWrapper
              id="fig-missing"
              kind="figure"
              label="Gambar 2."
              caption="Persentase nilai kosong (missing) per kolom pada tahap profiling."
              source={
                isSampleData
                  ? 'Sumber: Audit data mentah contoh sebelum imputasi.'
                  : `Sumber: Audit kelengkapan kolom dari berkas ${uploadedFileName}.`
              }
              stageKey="profiling"
              insightKey="missing"
              insightText={insights.missing}
              onUpdateInsight={handleUpdateInsight}
              onOpenAppendix={handleOpenAppendix}
            >
              <MissingBarChart stats={analytics.missingStats} isInverted={isInverted} />
            </FigureWrapper>

            {/* Gambar 3: Before vs After Dedup */}
            <FigureWrapper
              id="fig-dedup"
              kind="figure"
              label="Gambar 3."
              caption="Perbandingan jumlah node sebelum (N) dan sesudah deduplikasi spasial 25 meter (M)."
              source="Sumber: OpenStreetMap contributors; olahan penulis (BallTree Haversine)."
              stageKey="cleansing"
              insightKey="dedup"
              insightText={insights.dedup}
              onUpdateInsight={handleUpdateInsight}
              onOpenAppendix={handleOpenAppendix}
            >
              <div className="space-y-3">
                {!isSampleData && (
                  <div className="flex flex-wrap items-center gap-3 pb-2 border-b border-[var(--rule)] text-[13px] font-mono-code">
                    <label className="inline-flex items-center gap-2">
                      <span>Jumlah node mentah sebelum dedup (N):</span>
                      <input
                        type="number"
                        min={filteredNodes.length}
                        value={overridePreDedupCount ?? analytics.preDedupCount}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isFinite(v) && v >= filteredNodes.length) {
                            setOverridePreDedupCount(v);
                          }
                        }}
                        className="w-24 border border-[var(--rule-strong)] bg-[var(--paper)] px-2 py-0.5 tabular-nums"
                      />
                    </label>
                  </div>
                )}
                <DedupComparisonChart
                  preCount={analytics.preDedupCount}
                  postCount={analytics.postDedupCount}
                  isInverted={isInverted}
                />
              </div>
            </FigureWrapper>
          </section>

          <hr className="border-t border-[var(--rule)] max-w-[760px]" />

          {/* =====================================================
              BAB IV. ANALISIS EKSPLORASI
             ===================================================== */}
          <section id="bab-4" className="scroll-mt-8">
            <div className="max-w-[760px]">
              <div className="small-caps text-[13px] tracking-widest text-[var(--ink-subtle)]">
                Bab IV
              </div>
              <h2 className="font-display text-[26px] md:text-[30px] font-bold double-rule pb-2 mt-1">
                IV. Analisis Eksplorasi, Transformasi &amp; Validasi Outlier
              </h2>
              <p className="mt-4 text-[18px] leading-relaxed">
                Pada tahap rekayasa fitur, dihitung jumlah POI dalam radius 500 m serta entropi
                keberagaman kawasan (terdapat{' '}
                <span className="font-mono-code font-semibold tabular-nums">
                  {analytics.zeroPoiCount}
                </span>{' '}
                simpul dengan <code className="font-mono-code text-[15px]">poi_total_500m = 0</code>{' '}
                yang diberi entropi 0 tanpa dibuang). Selanjutnya dilakukan pemeriksaan korelasi
                Spearman antarfitur, peredaman kemencengan melalui{' '}
                <code className="font-mono-code text-[15px]">log1p</code>, dan verifikasi
                observasi ekstrem.{' '}
                <button
                  type="button"
                  onClick={() =>
                    handleOpenAppendix(
                      'feature_engineering',
                      'Feature Engineering: POI 500 m & Entropi'
                    )
                  }
                  className="font-mono-code text-[14px] underline cursor-pointer"
                >
                  [ Kode Feature Engineering ]
                </button>
              </p>
            </div>

            {/* Gambar 4: Spearman Correlation Heatmap */}
            <FigureWrapper
              id="fig-korelasi"
              kind="figure"
              label="Gambar 4."
              caption="Matriks korelasi Spearman antarfitur pembentuk klaster setelah transformasi log1p."
              stageKey="scaling_korelasi"
              insightKey="korelasi"
              insightText={insights.korelasi}
              onUpdateInsight={handleUpdateInsight}
              onOpenAppendix={handleOpenAppendix}
            >
              <SpearmanHeatmap
                matrix={analytics.spearmanMatrix}
                featureNames={analytics.featureNames}
                isInverted={isInverted}
              />
            </FigureWrapper>

            {/* Gambar 5: Histogram log1p */}
            <FigureWrapper
              id="fig-log1p"
              kind="figure"
              label="Gambar 5."
              caption="Perbandingan distribusi fitur menceng kanan sebelum dan sesudah transformasi log1p."
              stageKey="scaling_korelasi"
              insightKey="log1p"
              insightText={insights.log1p}
              onUpdateInsight={handleUpdateInsight}
              onOpenAppendix={handleOpenAppendix}
            >
              <Log1pHistogramChart nodes={filteredNodes} isInverted={isInverted} />
            </FigureWrapper>

            {/* Tabel 2: Validated Hub Outliers */}
            <FigureWrapper
              id="tbl-outlier"
              kind="table"
              label="Tabel 2."
              caption="Daftar observasi ekstrem pada pemeriksaan IQR & kontaminasi 5% yang ditandai sebagai hub valid."
              stageKey="outlier"
              insightKey="outlier"
              insightText={insights.outlier}
              onUpdateInsight={handleUpdateInsight}
              onOpenAppendix={handleOpenAppendix}
            >
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px] tabular-nums">
                  <thead>
                    <tr className="border-y border-[var(--rule-strong)] bg-[var(--paper-alt)] text-left font-mono-code">
                      <th className="p-2">Nama Simpul</th>
                      <th className="p-2">Jenis</th>
                      <th className="p-2 text-right">POI 500m</th>
                      <th className="p-2 text-right">Kepadatan</th>
                      <th className="p-2 text-right">Simpul 500m</th>
                      <th className="p-2">Penandaan</th>
                      <th className="p-2">Keputusan Validasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.outliers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-[var(--ink-muted)]">
                          Tidak ditemukan observasi di luar batas pagar IQR pada dataset aktif.
                        </td>
                      </tr>
                    ) : (
                      analytics.outliers.map((o, idx) => (
                        <tr key={idx} className="border-b border-[var(--rule)]">
                          <td className="p-2 font-semibold">{o.nama_simpul}</td>
                          <td className="p-2 font-mono-code text-[12px]">{o.jenis_simpul}</td>
                          <td className="p-2 text-right font-mono-code">{o.poi_total_500m}</td>
                          <td className="p-2 text-right font-mono-code">
                            {o.kepadatan_penduduk_kec.toLocaleString('id-ID')}
                          </td>
                          <td className="p-2 text-right font-mono-code">{o.jumlah_simpul_500m}</td>
                          <td className="p-2 font-mono-code text-[11px]">
                            {[
                              o.iqrFlags.length > 0 ? `IQR(${o.iqrFlags.join(', ')})` : null,
                              o.isoFlag ? 'Iso(5%)' : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </td>
                          <td className="p-2 text-[var(--ink-muted)]">{o.statusValidasi}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </FigureWrapper>
          </section>

          <hr className="border-t border-[var(--rule)] max-w-[760px]" />

          {/* =====================================================
              BAB V. PEMILIHAN K
             ===================================================== */}
          <section id="bab-5" className="scroll-mt-8">
            <div className="max-w-[760px]">
              <div className="small-caps text-[13px] tracking-widest text-[var(--ink-subtle)]">
                Bab V
              </div>
              <h2 className="font-display text-[26px] md:text-[30px] font-bold double-rule pb-2 mt-1">
                V. Pemilihan Jumlah Klaster Optimal (k = 2–8)
              </h2>
              <p className="mt-4 text-[18px] leading-relaxed">
                Penentuan jumlah klaster dievaluasi untuk rentang{' '}
                <span className="font-mono-code">k = 2</span> hingga{' '}
                <span className="font-mono-code">k = 8</span> melalui tiga metrik: Elbow
                (Inertia), Silhouette Score, dan Davies-Bouldin Index. Garis vertikal menandai{' '}
                <span className="font-mono-code font-semibold">
                  k terpilih = {analytics.numClusters}
                </span>{' '}
                sesuai kolom klaster pada data aktif.{' '}
                {getDynamicInterpretation('clustering', analytics, isSampleData)}
              </p>
            </div>

            <FigureWrapper
              id="fig-pemilihan-k"
              kind="figure"
              label="Gambar 6."
              caption="Kurva Elbow (Inertia), Silhouette Score, dan Davies-Bouldin Index untuk k = 2–8."
              stageKey="clustering"
              insightKey="pemilihan_k"
              insightText={insights.pemilihan_k}
              onUpdateInsight={handleUpdateInsight}
              onOpenAppendix={handleOpenAppendix}
            >
              <SelectionKCharts
                metrics={analytics.kMetrics}
                selectedK={analytics.numClusters}
                isInverted={isInverted}
              />
            </FigureWrapper>
          </section>

          <hr className="border-t border-[var(--rule)] max-w-[760px]" />

          {/* =====================================================
              BAB VI. HASIL KLASTER
             ===================================================== */}
          <section id="bab-6" className="scroll-mt-8">
            <div className="max-w-[760px]">
              <div className="small-caps text-[13px] tracking-widest text-[var(--ink-subtle)]">
                Bab VI
              </div>
              <h2 className="font-display text-[26px] md:text-[30px] font-bold double-rule pb-2 mt-1">
                VI. Hasil Klaster &amp; Profil Karakteristik Kawasan
              </h2>
              <p className="mt-4 text-[18px] leading-relaxed">
                Struktur klaster yang terbentuk disajikan secara berurutan melalui proyeksi ruang
                reduksi dimensi PCA 2D, heatmap z-score antar-klaster, grafik radar pembeda gaya
                garis, dan boxplot distribusi skor fasilitas fisik perhentian.
              </p>
            </div>

            {/* Gambar 7: PCA 2D Scatter */}
            <FigureWrapper
              id="fig-pca"
              kind="figure"
              label="Gambar 7."
              caption={`Sebaran anggota klaster pada proyeksi dua komponen utama (varians dijelaskan PC1+PC2 = ${formatIdNumber(
                analytics.pcaVariancePct,
                1
              )}%).`}
              stageKey="clustering"
              insightKey="pca"
              insightText={insights.pca}
              onUpdateInsight={handleUpdateInsight}
              onOpenAppendix={handleOpenAppendix}
            >
              <PcaScatterChart
                points={analytics.pcaPoints}
                clusterIds={analytics.clusterIds}
                pc1Pct={analytics.pc1VariancePct}
                pc2Pct={analytics.pc2VariancePct}
                totalPct={analytics.pcaVariancePct}
                isInverted={isInverted}
              />
            </FigureWrapper>

            {/* Gambar 8: Z-Score Heatmap */}
            <FigureWrapper
              id="fig-heatmap-profil"
              kind="figure"
              label="Gambar 8."
              caption="Heatmap profil z-score rata-rata fitur kawasan dan skor fasilitas tiap klaster."
              stageKey="profil_klaster"
              insightKey="heatmap_profil"
              insightText={insights.heatmap_profil}
              onUpdateInsight={handleUpdateInsight}
              onOpenAppendix={handleOpenAppendix}
            >
              <ProfileZHeatmap profiles={analytics.clusterProfiles} isInverted={isInverted} />
            </FigureWrapper>

            {/* Gambar 9: Radar Chart */}
            <FigureWrapper
              id="fig-radar"
              kind="figure"
              label="Gambar 9."
              caption="Grafik radar perbandingan profil z-score per klaster menggunakan gaya garis berbeda."
              stageKey="profil_klaster"
              insightKey="radar"
              insightText={insights.radar}
              onUpdateInsight={handleUpdateInsight}
              onOpenAppendix={handleOpenAppendix}
            >
              <ClusterRadarChart profiles={analytics.clusterProfiles} isInverted={isInverted} />
            </FigureWrapper>

            {/* Gambar 10: Boxplot skor_fasilitas */}
            <FigureWrapper
              id="fig-boxplot"
              kind="figure"
              label="Gambar 10."
              caption="Boxplot sebaran nilai skor_fasilitas (skala 1–5) pada masing-masing klaster."
              stageKey="profil_klaster"
              insightKey="boxplot"
              insightText={insights.boxplot}
              onUpdateInsight={handleUpdateInsight}
              onOpenAppendix={handleOpenAppendix}
            >
              <FacilityBoxplotChart stats={analytics.facilityBoxplots} isInverted={isInverted} />
            </FigureWrapper>

            {/* Gambar 11: Sebaran Klaster per Kabupaten/Kota (Batang Bertumpuk tanpa warna; tampil hanya bila kolom kabupaten_kota ada) */}
            {analytics.hasKabupatenKota && analytics.clusterRegionCounts.length > 0 && (
              <FigureWrapper
                id="fig-sebaran-wilayah"
                kind="figure"
                label="Gambar 11."
                caption="Sebaran jumlah simpul tiap klaster per kabupaten/kota di Surabaya Raya menggunakan pola isi tanpa warna."
                stageKey="profil_klaster"
                insightKey="sebaran_wilayah"
                insightText={insights.sebaran_wilayah}
                onUpdateInsight={handleUpdateInsight}
                onOpenAppendix={handleOpenAppendix}
              >
                <ClusterRegionStackedBarChart
                  regionCounts={analytics.clusterRegionCounts}
                  clusterIds={analytics.clusterIds}
                  isInverted={isInverted}
                />
              </FigureWrapper>
            )}
          </section>

          <hr className="border-t border-[var(--rule)] max-w-[760px]" />

          {/* =====================================================
              BAB VII. REKOMENDASI
             ===================================================== */}
          <section id="bab-7" className="scroll-mt-8">
            <div className="max-w-[760px]">
              <div className="small-caps text-[13px] tracking-widest text-[var(--ink-subtle)]">
                Bab VII
              </div>
              <h2 className="font-display text-[26px] md:text-[30px] font-bold double-rule pb-2 mt-1">
                VII. Profil Klaster &amp; Arah Strategi Kawasan
              </h2>
              <p className="mt-4 text-[18px] leading-relaxed">
                Setiap lembar klaster merangkum ciri kuantitatif yang diturunkan langsung dari
                z-score fitur kawasan beserta arah strategi peningkatan yang disesuaikan dengan
                konteks lingkungannya.
                {isSampleData && (
                  <span className="font-mono-code text-[14px] block mt-2 border border-[var(--rule-strong)] px-3 py-1.5 bg-[var(--paper-alt)]">
                    Catatan: Selama data contoh aktif, penamaan dan angka ciri di bawah ini bersifat
                    ilustratif dan belum merupakan temuan lapangan final.
                  </span>
                )}
              </p>

              <div className="mt-6 space-y-5">
                {recommendations.map((rec) => {
                  const prof = analytics.clusterProfiles.find((p) => p.klaster === rec.klaster);
                  const sortedZ = prof
                    ? Object.entries(prof.zScores).sort((a, b) => b[1] - a[1])
                    : [];
                  const topF = sortedZ[0];
                  const lowF = sortedZ[sortedZ.length - 1];
                  const avgFacility = prof?.rawMeans['skor_fasilitas'] ?? 0;
                  const isEditing = editingRecKlaster === rec.klaster;

                  return (
                    <article
                      key={rec.klaster}
                      className="border border-[var(--rule-strong)] bg-[var(--paper)] p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rule)] pb-3">
                        <div className="flex items-center gap-3">
                          <ClusterSymbol cluster={rec.klaster} size={20} />
                          <div>
                            <div className="small-caps text-[11px] tracking-widest text-[var(--ink-subtle)]">
                              Lembar Klaster {toRoman(rec.klaster)} · {prof?.count ?? 0} simpul
                            </div>
                            {isEditing ? (
                              <input
                                type="text"
                                value={rec.namaKlaster}
                                onChange={(e) =>
                                  setRecommendations((prev) =>
                                    prev.map((item) =>
                                      item.klaster === rec.klaster
                                        ? {...item, namaKlaster: e.target.value}
                                        : item
                                    )
                                  )
                                }
                                className="border border-[var(--rule-strong)] bg-[var(--paper)] px-2 py-1 font-display text-[19px] font-bold w-full md:w-[420px] mt-0.5"
                              />
                            ) : (
                              <h3 className="font-display text-[20px] font-bold">
                                {rec.namaKlaster}
                              </h3>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingRecKlaster(isEditing ? null : rec.klaster)
                            }
                            className="font-mono-code text-[12px] underline cursor-pointer"
                          >
                            {isEditing ? 'Simpan' : 'Ubah'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenAppendix(
                                'profil_klaster',
                                `Lembar Rekomendasi Klaster ${toRoman(rec.klaster)}`
                              )
                            }
                            className="font-mono-code text-[12px] underline cursor-pointer"
                          >
                            [ Kode ]
                          </button>
                        </div>
                      </div>

                      <div className="text-[16px] leading-relaxed space-y-2">
                        <p>
                          <span className="small-caps text-[12px] tracking-widest font-semibold mr-2">
                            Ciri Terukur:
                          </span>
                          {prof ? (
                            <>
                              Tertinggi pada{' '}
                              <strong>{FEATURE_LABELS[topF?.[0] || ''] || topF?.[0]}</strong> (z ={' '}
                              <span className="font-mono-code tabular-nums">
                                {formatIdNumber(topF?.[1] || 0, 2)}
                              </span>
                              ), terendah pada{' '}
                              <strong>{FEATURE_LABELS[lowF?.[0] || ''] || lowF?.[0]}</strong> (z ={' '}
                              <span className="font-mono-code tabular-nums">
                                {formatIdNumber(lowF?.[1] || 0, 2)}
                              </span>
                              ), rata-rata skor fasilitas{' '}
                              <span className="font-mono-code tabular-nums">
                                {formatIdNumber(avgFacility, 2)}
                              </span>{' '}
                              / 5,00.
                            </>
                          ) : (
                            'Profil belum tersedia.'
                          )}
                        </p>

                        <div>
                          <span className="small-caps text-[12px] tracking-widest font-semibold block mb-1">
                            Arah Strategi Kawasan:
                          </span>
                          {isEditing ? (
                            <textarea
                              rows={3}
                              value={rec.arahStrategi}
                              onChange={(e) =>
                                setRecommendations((prev) =>
                                  prev.map((item) =>
                                    item.klaster === rec.klaster
                                      ? {...item, arahStrategi: e.target.value}
                                      : item
                                  )
                                )
                              }
                              className="w-full border border-[var(--rule-strong)] bg-[var(--paper)] p-2 text-[16px]"
                            />
                          ) : (
                            <p className="text-[var(--ink-muted)]">{rec.arahStrategi}</p>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Double-Ruled Limitations Box */}
              <div className="mt-8 double-box p-5 bg-[var(--paper-alt)]">
                <h3 className="font-display text-[20px] font-bold mb-2">
                  Keterbatasan Analisis &amp; Batasan Interpretasi
                </h3>
                <ul className="list-disc pl-5 space-y-1.5 text-[16px] leading-relaxed">
                  <li>
                    Hasil clustering <strong>hanya menggambarkan karakteristik kawasan sekitar simpul</strong>{' '}
                    berdasarkan kerapatan POI, kepadatan penduduk kecamatan, dan struktur jaringan
                    jalan; analisis ini <strong>tidak membuktikan</strong> simpul atau klaster mana
                    yang paling membutuhkan alokasi dana.
                  </li>
                  <li>
                    Data kelengkapan fasilitas halte dan sebaran POI berasal dari kontribusi sukarela
                    OpenStreetMap sehingga wilayah pinggiran berpotensi mengalami{' '}
                    <em>under-mapping</em>.
                  </li>
                  <li>
                    Variabel kepadatan penduduk BPS diagregasi pada tingkat kecamatan, sehingga
                    variasi kepadatan mikro antar-kelurahan di sekitar halte yang berjauhan dalam
                    satu kecamatan belum tertangkap secara terpisah.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <hr className="border-t border-[var(--rule)] max-w-[760px]" />

          {/* =====================================================
              BAB VIII. LAMPIRAN KODE
             ===================================================== */}
          <section id="bab-8" className="scroll-mt-8">
            <div className="max-w-[760px]">
              <div className="small-caps text-[13px] tracking-widest text-[var(--ink-subtle)]">
                Bab VIII
              </div>
              <h2 className="font-display text-[26px] md:text-[30px] font-bold double-rule pb-2 mt-1">
                VIII. Lampiran Kode Python Lengkap per Tahap
              </h2>
              <p className="mt-4 text-[18px] leading-relaxed">
                Seluruh blok kode Python yang digunakan dalam alur <em>data wrangling</em> hingga
                pembentukan profil klaster disusun di bawah ini sebagai akses alternatif selain
                mengklik masing-masing visualisasi. Kode hanya ditampilkan untuk dokumentasi dan
                tidak dieksekusi di peramban.
              </p>

              <div className="mt-6 space-y-8">
                {ALL_STAGE_ORDER.map((sKey) => {
                  const st = stages[sKey];
                  const dynInterp = getDynamicInterpretation(sKey, analytics, isSampleData);
                  return (
                    <div key={sKey} className="space-y-2.5 border-b border-[var(--rule)] pb-6">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <span className="small-caps text-[12px] tracking-widest text-[var(--ink-subtle)]">
                            {st.labelBlok} · Penanggung jawab: {st.penanggungJawab}
                          </span>
                          <h3 className="font-display text-[20px] font-bold">{st.judulTahap}</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenAppendix(sKey, st.labelBlok)}
                          className="font-mono-code text-[13px] underline cursor-pointer"
                        >
                          [ Buka Lembar Lampiran ]
                        </button>
                      </div>

                      <p className="text-[15px] text-[var(--ink-muted)]">{dynInterp}</p>

                      <CodeBlock
                        code={st.kodePython}
                        isAutoGenerated={st.isAutoGeneratedCode}
                        onSaveCode={(nextCode) => handleUpdateStage(sKey, {kodePython: nextCode})}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Right-Side Slide-Over Sheet: Lembar Lampiran */}
      <AppendixDrawer
        isOpen={drawerOpen}
        stage={stages[drawerStageKey] || null}
        visualTitle={drawerVisualTitle}
        analytics={analytics}
        isSampleData={isSampleData}
        onClose={() => setDrawerOpen(false)}
        onUpdateStage={handleUpdateStage}
      />

      {/* Fullscreen Mode Presentasi */}
      <PresentationMode
        isOpen={presentationOpen}
        onClose={() => setPresentationOpen(false)}
        nodes={filteredNodes}
        analytics={analytics}
        wranglingLog={wranglingLog}
        stages={stages}
        insights={insights}
        isSampleData={isSampleData}
      />
    </div>
  );
}
