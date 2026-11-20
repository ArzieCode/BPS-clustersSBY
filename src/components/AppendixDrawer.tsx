import React, {useEffect, useState} from 'react';
import {ComputedAnalytics, StageAppendix, StageKey} from '../types/report';
import {getDynamicInterpretation} from '../utils/analytics';
import {CodeBlock} from './CodeBlock';

interface AppendixDrawerProps {
  isOpen: boolean;
  stage: StageAppendix | null;
  visualTitle?: string;
  analytics: ComputedAnalytics;
  isSampleData: boolean;
  onClose: () => void;
  onUpdateStage: (key: StageKey, patch: Partial<StageAppendix>) => void;
}

type DrawerTab = 'kode' | 'interpretasi' | 'skrip' | 'penguji';

export const AppendixDrawer: React.FC<AppendixDrawerProps> = ({
  isOpen,
  stage,
  visualTitle,
  analytics,
  isSampleData,
  onClose,
  onUpdateStage,
}) => {
  const [activeTab, setActiveTab] = useState<DrawerTab>('kode');
  const [editingAlasan, setEditingAlasan] = useState(false);
  const [draftAlasan, setDraftAlasan] = useState('');
  const [editingSkrip, setEditingSkrip] = useState(false);
  const [draftSkrip, setDraftSkrip] = useState('');
  const [editingQAId, setEditingQAId] = useState<string | null>(null);
  const [draftQ, setDraftQ] = useState('');
  const [draftA, setDraftA] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    setEditingAlasan(false);
    setEditingSkrip(false);
    setEditingQAId(null);
  }, [stage?.key]);

  if (!isOpen || !stage) return null;

  const dynamicOutputRead = getDynamicInterpretation(stage.key, analytics, isSampleData);

  const tabs: Array<{id: DrawerTab; label: string}> = [
    {id: 'kode', label: 'Kode Python'},
    {id: 'interpretasi', label: 'Interpretasi'},
    {id: 'skrip', label: 'Skrip Presentasi'},
    {id: 'penguji', label: 'Pertanyaan Penguji'},
  ];

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 w-full lg:w-[45%] bg-[var(--paper)] text-[var(--ink)] double-box flex flex-col fade-150"
      role="dialog"
      aria-modal="false"
      aria-label={`Lembar Lampiran: ${stage.judulTahap}`}
    >
      {/* Top header */}
      <div className="px-5 py-4 border-b border-[var(--rule-strong)] flex items-start justify-between gap-4 bg-[var(--paper)]">
        <div className="min-w-0">
          <div className="small-caps text-[12px] tracking-widest text-[var(--ink-subtle)]">
            Lembar Lampiran · {stage.labelBlok}
          </div>
          <h2 className="font-display text-[21px] font-bold leading-snug mt-0.5">
            {stage.judulTahap}
          </h2>
          {visualTitle && (
            <p className="text-[13px] text-[var(--ink-muted)] mt-0.5">
              Rujukan visual: {visualTitle}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-[13px]">
            <label className="inline-flex items-center gap-2">
              <span className="small-caps text-[12px] tracking-widest text-[var(--ink-subtle)]">
                Penanggung jawab:
              </span>
              <input
                type="text"
                value={stage.penanggungJawab}
                onChange={(e) =>
                  onUpdateStage(stage.key, {penanggungJawab: e.target.value})
                }
                className="border-b border-[var(--rule-strong)] bg-transparent px-1 py-0.5 font-mono-code text-[13px] text-[var(--ink)] w-[160px]"
                aria-label="Penanggung jawab tahap"
              />
            </label>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-[13px] font-mono-code border border-[var(--rule-strong)] bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--paper)] shrink-0 cursor-pointer fade-150"
        >
          Tutup (Esc)
        </button>
      </div>

      {/* Book-style tabs */}
      <div
        className="flex overflow-x-auto border-b border-[var(--rule-strong)] bg-[var(--paper-alt)]"
        role="tablist"
        aria-label="Tab lembar lampiran"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 small-caps text-[13px] tracking-widest whitespace-nowrap shrink-0 border-r border-[var(--rule)] cursor-pointer fade-150 ${
                isActive
                  ? 'bg-[var(--paper)] text-[var(--ink)] font-bold border-b-2 border-b-[var(--paper)] -mb-[1px]'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {activeTab === 'kode' && (
          <div className="space-y-3">
            {stage.isAutoGeneratedCode && (
              <div className="border border-[var(--rule-strong)] bg-[var(--paper-alt)] px-3 py-2 text-[13px] font-mono-code">
                Catatan: <strong>kode otomatis, mohon diperiksa</strong> terhadap skema berkas lokal kelompok sebelum dijalankan.
              </div>
            )}
            <CodeBlock
              code={stage.kodePython}
              isAutoGenerated={stage.isAutoGeneratedCode}
              onSaveCode={(nextCode) => onUpdateStage(stage.key, {kodePython: nextCode})}
            />
          </div>
        )}

        {activeTab === 'interpretasi' && (
          <div className="space-y-6 text-[17px] leading-relaxed">
            <div>
              <h3 className="small-caps text-[13px] tracking-widest font-bold border-b border-[var(--rule)] pb-1 mb-2">
                1. Apa yang Dilakukan
              </h3>
              <p>{stage.apaYangDilakukan}</p>
            </div>

            <div>
              <h3 className="small-caps text-[13px] tracking-widest font-bold border-b border-[var(--rule)] pb-1 mb-2">
                2. Cara Membaca Keluaran (Otomatis dari Data Aktif)
              </h3>
              <div className="border border-[var(--rule-strong)] bg-[var(--paper-alt)] p-3.5 text-[16px]">
                {dynamicOutputRead}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between border-b border-[var(--rule)] pb-1 mb-2">
                <h3 className="small-caps text-[13px] tracking-widest font-bold">
                  3. Alasan Pemilihan Metode
                </h3>
                {!editingAlasan && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftAlasan(stage.alasanPemilihanMetode);
                      setEditingAlasan(true);
                    }}
                    className="font-mono-code text-[12px] underline cursor-pointer"
                  >
                    Ubah
                  </button>
                )}
              </div>
              {editingAlasan ? (
                <div className="space-y-2">
                  <textarea
                    value={draftAlasan}
                    onChange={(e) => setDraftAlasan(e.target.value)}
                    rows={4}
                    className="w-full border border-[var(--rule-strong)] bg-[var(--paper)] p-2.5 text-[16px]"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateStage(stage.key, {alasanPemilihanMetode: draftAlasan});
                        setEditingAlasan(false);
                      }}
                      className="px-3 py-1 font-mono-code text-[12px] bg-[var(--ink)] text-[var(--paper)] cursor-pointer"
                    >
                      Simpan
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingAlasan(false)}
                      className="px-3 py-1 font-mono-code text-[12px] border border-[var(--rule)] cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                <p>{stage.alasanPemilihanMetode}</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'skrip' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-2">
              <span className="small-caps text-[13px] tracking-widest font-bold">
                Naskah Bicara (20–30 Detik)
              </span>
              {!editingSkrip && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftSkrip(stage.skripPresentasi);
                    setEditingSkrip(true);
                  }}
                  className="font-mono-code text-[12px] underline cursor-pointer"
                >
                  Ubah Naskah
                </button>
              )}
            </div>

            {editingSkrip ? (
              <div className="space-y-2">
                <textarea
                  value={draftSkrip}
                  onChange={(e) => setDraftSkrip(e.target.value)}
                  rows={6}
                  className="w-full border border-[var(--rule-strong)] bg-[var(--paper)] p-3 text-[17px] leading-relaxed"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateStage(stage.key, {skripPresentasi: draftSkrip});
                      setEditingSkrip(false);
                    }}
                    className="px-3 py-1.5 font-mono-code text-[12px] bg-[var(--ink)] text-[var(--paper)] cursor-pointer"
                  >
                    Simpan
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingSkrip(false)}
                    className="px-3 py-1.5 font-mono-code text-[12px] border border-[var(--rule)] cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <blockquote className="border border-[var(--rule)] bg-[var(--paper-alt)] p-4 text-[18px] leading-relaxed italic">
                “{stage.skripPresentasi}”
              </blockquote>
            )}
          </div>
        )}

        {activeTab === 'penguji' && (
          <div className="space-y-4">
            <div className="small-caps text-[13px] tracking-widest font-bold border-b border-[var(--rule)] pb-2">
              Simulasi Tanya Jawab Dosen Penguji (3 Pertanyaan)
            </div>

            {stage.pertanyaanPenguji.map((qa, idx) => (
              <div key={qa.id} className="border border-[var(--rule)] p-3.5 space-y-2">
                {editingQAId === qa.id ? (
                  <div className="space-y-2">
                    <label className="block text-[12px] font-mono-code">Pertanyaan:</label>
                    <input
                      type="text"
                      value={draftQ}
                      onChange={(e) => setDraftQ(e.target.value)}
                      className="w-full border border-[var(--rule-strong)] bg-[var(--paper)] p-2 text-[15px]"
                    />
                    <label className="block text-[12px] font-mono-code">Jawaban:</label>
                    <textarea
                      value={draftA}
                      onChange={(e) => setDraftA(e.target.value)}
                      rows={3}
                      className="w-full border border-[var(--rule-strong)] bg-[var(--paper)] p-2 text-[15px]"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = stage.pertanyaanPenguji.map((item) =>
                            item.id === qa.id
                              ? {...item, pertanyaan: draftQ, jawaban: draftA}
                              : item
                          );
                          onUpdateStage(stage.key, {pertanyaanPenguji: updated});
                          setEditingQAId(null);
                        }}
                        className="px-3 py-1 font-mono-code text-[12px] bg-[var(--ink)] text-[var(--paper)] cursor-pointer"
                      >
                        Simpan
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingQAId(null)}
                        className="px-3 py-1 font-mono-code text-[12px] border border-[var(--rule)] cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-[16px]">
                        {idx + 1}. {qa.pertanyaan}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingQAId(qa.id);
                          setDraftQ(qa.pertanyaan);
                          setDraftA(qa.jawaban);
                        }}
                        className="font-mono-code text-[11px] underline shrink-0 cursor-pointer"
                      >
                        Ubah
                      </button>
                    </div>
                    <p className="text-[15px] text-[var(--ink-muted)] leading-relaxed">
                      <strong className="text-[var(--ink)]">Jawab:</strong> {qa.jawaban}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
