import React, {useEffect, useMemo, useRef, useState} from 'react';
import L from 'leaflet';
import {SimpulNode} from '../types/report';
import {formatIdNumber, toRoman} from '../utils/analytics';
import {CLUSTER_SHAPE_NAMES, ClusterSymbol, createLeafletMarkerHtml} from './ClusterSymbol';

interface SurabayaMapProps {
  nodes: SimpulNode[];
  totalUnfilteredCount?: number;
  clusterIds: number[];
  isInverted: boolean;
  heightClass?: string;
  hasKabupatenKota?: boolean;
  regionList?: string[];
  selectedRegion?: string;
  onSelectRegion?: (region: string) => void;
}

export const SurabayaMap: React.FC<SurabayaMapProps> = ({
  nodes,
  totalUnfilteredCount,
  clusterIds,
  isInverted,
  heightClass = 'h-[440px]',
  hasKabupatenKota = false,
  regionList = [],
  selectedRegion = 'semua',
  onSelectRegion,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [selectedCluster, setSelectedCluster] = useState<string>('semua');
  const [selectedJenis, setSelectedJenis] = useState<string>('semua');

  const hasZeroCluster = useMemo(() => nodes.some((n) => n.klaster === 0), [nodes]);

  const normalizedNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        normKlaster: hasZeroCluster ? n.klaster + 1 : n.klaster,
      })),
    [nodes, hasZeroCluster]
  );

  const jenisOptions = useMemo(() => {
    const set = new Set(nodes.map((n) => n.jenis_simpul));
    return Array.from(set).sort();
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    return normalizedNodes.filter((n) => {
      const matchCluster =
        selectedCluster === 'semua' || n.normKlaster === Number(selectedCluster);
      const matchJenis = selectedJenis === 'semua' || n.jenis_simpul === selectedJenis;
      const matchRegion =
        !hasKabupatenKota ||
        selectedRegion === 'semua' ||
        (n.kabupaten_kota || '').trim() === selectedRegion;
      return matchCluster && matchJenis && matchRegion;
    });
  }, [normalizedNodes, selectedCluster, selectedJenis, hasKabupatenKota, selectedRegion]);

  // Initialize Leaflet map and fit bounds to all initial points (Surabaya, Sidoarjo, Gresik)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      scrollWheelZoom: false,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    if (nodes.length > 1) {
      const initialBounds = L.latLngBounds(nodes.map((n) => [n.lat, n.lon] as [number, number]));
      map.fitBounds(initialBounds, {padding: [30, 30]});
    } else if (nodes.length === 1) {
      map.setView([nodes[0].lat, nodes[0].lon], 13);
    } else {
      map.setView([-7.28, 112.71], 10);
    }

    const layerGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    markersLayerRef.current = layerGroup;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers and fitBounds whenever filteredNodes or theme changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const bounds: L.LatLngExpression[] = [];

    filteredNodes.forEach((node) => {
      const roman = toRoman(node.normKlaster);
      const shapeName = CLUSTER_SHAPE_NAMES[node.normKlaster] || `Klaster ${roman}`;
      const icon = L.divIcon({
        html: createLeafletMarkerHtml(node.normKlaster, isInverted),
        className: 'custom-monochrome-marker',
        iconSize: [34, 20],
        iconAnchor: [17, 10],
      });

      const marker = L.marker([node.lat, node.lon], {
        icon,
        title: `${node.nama_simpul} (Klaster ${roman})`,
        alt: `${node.nama_simpul}, Klaster ${roman} (${shapeName})`,
      });

      const regionHtml =
        hasKabupatenKota && node.kabupaten_kota
          ? `<div><strong>Kab./Kota:</strong> ${node.kabupaten_kota}</div>`
          : '';

      const popupHtml = `
        <div style="font-family:'Source Serif 4',Georgia,serif;font-size:14px;line-height:1.45;min-width:215px;">
          <div style="font-weight:700;font-size:15px;border-bottom:1px solid currentColor;padding-bottom:4px;margin-bottom:6px;">
            ${node.nama_simpul}
          </div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;">
            <div><strong>Klaster:</strong> ${roman} (${shapeName})</div>
            <div><strong>Jenis:</strong> ${node.jenis_simpul}</div>
            ${regionHtml}
            <div><strong>Kecamatan:</strong> ${node.kecamatan}</div>
            <div><strong>POI 500 m:</strong> ${node.poi_total_500m} titik</div>
            <div><strong>Entropi POI:</strong> ${formatIdNumber(node.entropi_poi, 2)}</div>
            <div><strong>Kepadatan Kec.:</strong> ${node.kepadatan_penduduk_kec.toLocaleString('id-ID')}/km&sup2;</div>
            <div><strong>Skor Fasilitas:</strong> ${formatIdNumber(node.skor_fasilitas, 2)} / 5</div>
          </div>
        </div>
      `;
      marker.bindPopup(popupHtml);
      marker.addTo(layer);
      bounds.push([node.lat, node.lon]);
    });

    if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), {padding: [30, 30]});
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 13);
    }
  }, [filteredNodes, isInverted, hasKabupatenKota]);

  const denomCount = totalUnfilteredCount ?? nodes.length;

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rule)] pb-3 text-[14px]">
        <div className="flex flex-wrap items-center gap-3">
          {hasKabupatenKota && regionList.length > 0 && onSelectRegion && (
            <label className="flex items-center gap-2">
              <span className="small-caps text-[12px] tracking-widest text-[var(--ink-muted)]">
                Wilayah
              </span>
              <select
                value={selectedRegion}
                onChange={(e) => onSelectRegion(e.target.value)}
                className="border border-[var(--rule-strong)] bg-[var(--paper)] text-[var(--ink)] px-2.5 py-1 font-mono-code text-[13px]"
              >
                <option value="semua">Semua wilayah</option>
                {regionList.map((reg) => (
                  <option key={reg} value={reg}>
                    {reg}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex items-center gap-2">
            <span className="small-caps text-[12px] tracking-widest text-[var(--ink-muted)]">
              Klaster
            </span>
            <select
              value={selectedCluster}
              onChange={(e) => setSelectedCluster(e.target.value)}
              className="border border-[var(--rule-strong)] bg-[var(--paper)] text-[var(--ink)] px-2.5 py-1 font-mono-code text-[13px]"
            >
              <option value="semua">Semua ({nodes.length})</option>
              {clusterIds.map((cid) => (
                <option key={cid} value={String(cid)}>
                  Klaster {toRoman(cid)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="small-caps text-[12px] tracking-widest text-[var(--ink-muted)]">
              Jenis Simpul
            </span>
            <select
              value={selectedJenis}
              onChange={(e) => setSelectedJenis(e.target.value)}
              className="border border-[var(--rule-strong)] bg-[var(--paper)] text-[var(--ink)] px-2.5 py-1 font-mono-code text-[13px]"
            >
              <option value="semua">Semua jenis</option>
              {jenisOptions.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </label>
        </div>

        <span className="font-mono-code text-[13px] tabular-nums text-[var(--ink-muted)]">
          Menampilkan {filteredNodes.length} dari {denomCount} simpul
        </span>
      </div>

      {/* Monochrome Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[var(--ink)]">
        <span className="small-caps text-[12px] tracking-widest text-[var(--ink-subtle)]">
          Legenda:
        </span>
        {clusterIds.map((cid) => (
          <span key={cid} className="inline-flex items-center gap-1.5">
            <ClusterSymbol cluster={cid} size={15} />
            <span className="text-[12px] text-[var(--ink-muted)]">
              ({CLUSTER_SHAPE_NAMES[cid] || `Bentuk ${cid}`})
            </span>
          </span>
        ))}
      </div>

      {/* Map container */}
      <div
        ref={mapContainerRef}
        className={`w-full ${heightClass} border border-[var(--rule-strong)] leaflet-grayscale-tiles relative z-0`}
        aria-label="Peta sebaran simpul transportasi Surabaya Raya dalam skala abu-abu"
      />
    </div>
  );
};
