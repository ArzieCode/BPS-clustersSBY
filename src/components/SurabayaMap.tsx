import React, {useEffect, useMemo, useRef, useState} from 'react';
import L from 'leaflet';
import {SimpulNode} from '../types/report';
import {formatIdNumber, toRoman} from '../utils/analytics';
import {CLUSTER_SHAPE_NAMES, ClusterSymbol, createLeafletMarkerHtml} from './ClusterSymbol';

interface SurabayaMapProps {
  nodes: SimpulNode[];
  clusterIds: number[];
  isInverted: boolean;
  heightClass?: string;
}

export const SurabayaMap: React.FC<SurabayaMapProps> = ({
  nodes,
  clusterIds,
  isInverted,
  heightClass = 'h-[440px]',
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
      return matchCluster && matchJenis;
    });
  }, [normalizedNodes, selectedCluster, selectedJenis]);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [-7.275, 112.742],
      zoom: 12,
      scrollWheelZoom: false,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    markersLayerRef.current = layerGroup;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  // Update markers when filteredNodes or theme changes
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

      const popupHtml = `
        <div style="font-family:'Source Serif 4',Georgia,serif;font-size:14px;line-height:1.45;min-width:210px;">
          <div style="font-weight:700;font-size:15px;border-bottom:1px solid currentColor;padding-bottom:4px;margin-bottom:6px;">
            ${node.nama_simpul}
          </div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;">
            <div><strong>Klaster:</strong> ${roman} (${shapeName})</div>
            <div><strong>Jenis:</strong> ${node.jenis_simpul}</div>
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
      map.fitBounds(L.latLngBounds(bounds), {padding: [28, 28], maxZoom: 13});
    }
  }, [filteredNodes, isInverted]);

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rule)] pb-3 text-[14px]">
        <div className="flex flex-wrap items-center gap-3">
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
          Menampilkan {filteredNodes.length} dari {nodes.length} simpul
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
