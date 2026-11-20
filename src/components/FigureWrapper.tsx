import React, {useState} from 'react';
import {StageKey} from '../types/report';

interface FigureWrapperProps {
  id: string;
  kind: 'figure' | 'table';
  label: string; // e.g. "Gambar 1." or "Tabel 1."
  caption: string;
  source?: string;
  stageKey: StageKey;
  insightKey?: string;
  insightText?: string;
  onUpdateInsight?: (key: string, nextVal: string) => void;
  onOpenAppendix: (stageKey: StageKey, visualId: string) => void;
  interactiveInside?: boolean;
  children: React.ReactNode;
}

export const FigureWrapper: React.FC<FigureWrapperProps> = ({
  id,
  kind,
  label,
  caption,
  source = 'Sumber: OpenStreetMap contributors; BPS; olahan penulis.',
  stageKey,
  insightKey,
  insightText,
  onUpdateInsight,
  onOpenAppendix,
  interactiveInside = false,
  children,
}) => {
  const [editingInsight, setEditingInsight] = useState(false);
  const [draftInsight, setDraftInsight] = useState(insightText || '');

  const handleSaveInsight = () => {
    if (insightKey && onUpdateInsight) {
      onUpdateInsight(insightKey, draftInsight.trim() || insightText || '');
    }
    setEditingInsight(false);
  };

  const handleFigureClick = (e: React.MouseEvent) => {
    if (interactiveInside) return;
    // Do not hijack clicks on interactive form controls inside
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a')) return;
    onOpenAppendix(stageKey, id);
  };

  const CaptionBar = (
    <div className="flex items-start justify-between gap-4 py-2">
      <p className="text-[15px] leading-snug text-[var(--ink)]">
        <span className="font-semibold">{label}</span> {caption}
      </p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenAppendix(stageKey, id);
        }}
        className="font-mono-code text-[13px] underline underline-offset-4 shrink-0 whitespace-nowrap text-[var(--ink)] hover:opacity-70 fade-150 cursor-pointer"
        aria-label={`Buka kode Python dan interpretasi untuk ${label} ${caption}`}
      >
        [ Kode ]
      </button>
    </div>
  );

  return (
    <div id={id} className="my-8 lg:grid lg:grid-cols-[minmax(0,760px)_240px] lg:gap-8 lg:items-start">
      {/* Main reading column visual / table */}
      <div className="min-w-0">
        {kind === 'table' && (
          <div className="border-b border-[var(--rule-strong)] mb-2">{CaptionBar}</div>
        )}

        <div
          onClick={handleFigureClick}
          role={interactiveInside ? undefined : 'button'}
          tabIndex={interactiveInside ? undefined : 0}
          onKeyDown={
            interactiveInside
              ? undefined
              : (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    const target = e.target as HTMLElement;
                    if (target.closest('button, input, select, textarea, a')) return;
                    e.preventDefault();
                    onOpenAppendix(stageKey, id);
                  }
                }
          }
          className={`border border-[var(--rule)] bg-[var(--paper)] p-4 fade-150 ${
            interactiveInside
              ? ''
              : 'cursor-pointer hover:border-[var(--rule-strong)]'
          }`}
          aria-label={
            interactiveInside
              ? undefined
              : `${label} ${caption} — klik untuk membuka lampiran kode dan interpretasi`
          }
        >
          {children}
        </div>

        {kind === 'figure' && (
          <div className="border-t border-[var(--rule)] mt-2">{CaptionBar}</div>
        )}

        <p className="text-[13px] text-[var(--ink-subtle)] mt-1 font-body italic">
          {source}
        </p>
      </div>

      {/* Right marginalia column: editable Insight */}
      {insightKey && insightText !== undefined && (
        <aside
          aria-label={`Catatan pinggir ${label}`}
          className="mt-4 lg:mt-0 border-t lg:border-t-0 lg:border-l border-[var(--rule)] pt-3 lg:pt-0 lg:pl-4 text-[14px] leading-relaxed text-[var(--ink-muted)]"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="small-caps text-[12px] font-semibold text-[var(--ink)] tracking-widest">
              Insight
            </span>
            {onUpdateInsight && !editingInsight && (
              <button
                type="button"
                onClick={() => {
                  setDraftInsight(insightText);
                  setEditingInsight(true);
                }}
                className="font-mono-code text-[11px] underline underline-offset-2 text-[var(--ink-subtle)] hover:text-[var(--ink)] cursor-pointer"
              >
                Ubah
              </button>
            )}
          </div>
          {editingInsight ? (
            <div className="space-y-2">
              <textarea
                value={draftInsight}
                onChange={(e) => setDraftInsight(e.target.value)}
                rows={4}
                className="w-full border border-[var(--rule-strong)] bg-[var(--paper)] text-[var(--ink)] p-2 text-[14px] leading-snug"
                aria-label="Sunting insight visualisasi"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveInsight}
                  className="px-2.5 py-1 text-[12px] font-mono-code border border-[var(--rule-strong)] bg-[var(--ink)] text-[var(--paper)] cursor-pointer"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setEditingInsight(false)}
                  className="px-2.5 py-1 text-[12px] font-mono-code border border-[var(--rule)] text-[var(--ink)] cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[14px] leading-relaxed text-[var(--ink-muted)]">{insightText}</p>
          )}
        </aside>
      )}
    </div>
  );
};
