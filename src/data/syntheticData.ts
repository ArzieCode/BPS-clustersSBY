import {
  ClusterRecommendation,
  GroupIdentity,
  MissingColStat,
  SimpulNode,
  WranglingLogEntry,
} from '../types/report';

// Deterministic PRNG (Mulberry32) so synthetic dataset is reproducible across renders
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface KecamatanZone {
  nama: string;
  kabupaten_kota: 'Kota Surabaya' | 'Kabupaten Sidoarjo' | 'Kabupaten Gresik';
  lat: number;
  lon: number;
  kepadatan: number; // jiwa/km2
  klasterKecenderungan: number;
  weight: number; // proportional sampling weight (majority in Kota Surabaya)
}

const ZONES: KecamatanZone[] = [
  // Kota Surabaya (~65% titik)
  {nama: 'Genteng', kabupaten_kota: 'Kota Surabaya', lat: -7.2592, lon: 112.7426, kepadatan: 14800, klasterKecenderungan: 1, weight: 4},
  {nama: 'Tegalsari', kabupaten_kota: 'Kota Surabaya', lat: -7.2705, lon: 112.7358, kepadatan: 21500, klasterKecenderungan: 1, weight: 4},
  {nama: 'Bubutan', kabupaten_kota: 'Kota Surabaya', lat: -7.2469, lon: 112.7285, kepadatan: 23400, klasterKecenderungan: 1, weight: 3},
  {nama: 'Gubeng', kabupaten_kota: 'Kota Surabaya', lat: -7.2755, lon: 112.7555, kepadatan: 16900, klasterKecenderungan: 1, weight: 4},
  {nama: 'Sukolilo', kabupaten_kota: 'Kota Surabaya', lat: -7.2912, lon: 112.7924, kepadatan: 5400, klasterKecenderungan: 2, weight: 3},
  {nama: 'Mulyorejo', kabupaten_kota: 'Kota Surabaya', lat: -7.2698, lon: 112.7852, kepadatan: 6300, klasterKecenderungan: 2, weight: 3},
  {nama: 'Tambaksari', kabupaten_kota: 'Kota Surabaya', lat: -7.2512, lon: 112.7664, kepadatan: 24900, klasterKecenderungan: 2, weight: 3},
  {nama: 'Wonokromo', kabupaten_kota: 'Kota Surabaya', lat: -7.2974, lon: 112.7341, kepadatan: 18400, klasterKecenderungan: 3, weight: 4},
  {nama: 'Sawahan', kabupaten_kota: 'Kota Surabaya', lat: -7.2722, lon: 112.7165, kepadatan: 27800, klasterKecenderungan: 2, weight: 3},
  {nama: 'Wonocolo', kabupaten_kota: 'Kota Surabaya', lat: -7.3228, lon: 112.7351, kepadatan: 12100, klasterKecenderungan: 3, weight: 3},
  {nama: 'Gayungan', kabupaten_kota: 'Kota Surabaya', lat: -7.3356, lon: 112.7262, kepadatan: 7800, klasterKecenderungan: 2, weight: 2},
  {nama: 'Krembangan', kabupaten_kota: 'Kota Surabaya', lat: -7.2295, lon: 112.7268, kepadatan: 13900, klasterKecenderungan: 3, weight: 3},
  {nama: 'Rungkut', kabupaten_kota: 'Kota Surabaya', lat: -7.3225, lon: 112.7845, kepadatan: 5800, klasterKecenderungan: 4, weight: 3},
  {nama: 'Tandes', kabupaten_kota: 'Kota Surabaya', lat: -7.2598, lon: 112.6775, kepadatan: 8300, klasterKecenderungan: 4, weight: 3},
  {nama: 'Lakarsantri', kabupaten_kota: 'Kota Surabaya', lat: -7.3032, lon: 112.6524, kepadatan: 3400, klasterKecenderungan: 4, weight: 2},
  {nama: 'Kenjeran', kabupaten_kota: 'Kota Surabaya', lat: -7.2286, lon: 112.7784, kepadatan: 19600, klasterKecenderungan: 4, weight: 2},
  // Kabupaten Sidoarjo (~20% titik)
  {nama: 'Waru', kabupaten_kota: 'Kabupaten Sidoarjo', lat: -7.3532, lon: 112.7325, kepadatan: 7850, klasterKecenderungan: 3, weight: 4},
  {nama: 'Taman', kabupaten_kota: 'Kabupaten Sidoarjo', lat: -7.3568, lon: 112.6942, kepadatan: 7300, klasterKecenderungan: 2, weight: 3},
  {nama: 'Gedangan', kabupaten_kota: 'Kabupaten Sidoarjo', lat: -7.3924, lon: 112.7261, kepadatan: 5600, klasterKecenderungan: 2, weight: 2},
  {nama: 'Buduran', kabupaten_kota: 'Kabupaten Sidoarjo', lat: -7.4242, lon: 112.7245, kepadatan: 2450, klasterKecenderungan: 4, weight: 2},
  {nama: 'Sidoarjo', kabupaten_kota: 'Kabupaten Sidoarjo', lat: -7.4478, lon: 112.7183, kepadatan: 3320, klasterKecenderungan: 1, weight: 3},
  {nama: 'Sedati', kabupaten_kota: 'Kabupaten Sidoarjo', lat: -7.3812, lon: 112.7734, kepadatan: 1380, klasterKecenderungan: 4, weight: 2},
  // Kabupaten Gresik (~15% titik)
  {nama: 'Kebomas', kabupaten_kota: 'Kabupaten Gresik', lat: -7.1715, lon: 112.6335, kepadatan: 3820, klasterKecenderungan: 3, weight: 3},
  {nama: 'Gresik', kabupaten_kota: 'Kabupaten Gresik', lat: -7.1564, lon: 112.6552, kepadatan: 14100, klasterKecenderungan: 1, weight: 3},
  {nama: 'Manyar', kabupaten_kota: 'Kabupaten Gresik', lat: -7.1258, lon: 112.6075, kepadatan: 1240, klasterKecenderungan: 4, weight: 2},
  {nama: 'Driyorejo', kabupaten_kota: 'Kabupaten Gresik', lat: -7.3562, lon: 112.6258, kepadatan: 2150, klasterKecenderungan: 4, weight: 2},
  {nama: 'Menganti', kabupaten_kota: 'Kabupaten Gresik', lat: -7.2985, lon: 112.5892, kepadatan: 1950, klasterKecenderungan: 4, weight: 2},
];

const NAMED_HUBS: Array<{
  nama: string;
  jenis: string;
  kecamatan: string;
  kabupaten_kota: 'Kota Surabaya' | 'Kabupaten Sidoarjo' | 'Kabupaten Gresik';
  lat: number;
  lon: number;
  klaster: number;
  poiTotal: number;
  kepadatan: number;
  simpul500: number;
  skorFasilitas: number;
}> = [
  {
    nama: 'Stasiun Surabaya Gubeng',
    jenis: 'Stasiun KAI',
    kecamatan: 'Gubeng',
    kabupaten_kota: 'Kota Surabaya',
    lat: -7.2653,
    lon: 112.7521,
    klaster: 3,
    poiTotal: 148,
    kepadatan: 16900,
    simpul500: 7,
    skorFasilitas: 4.8,
  },
  {
    nama: 'Stasiun Surabaya Pasar Turi',
    jenis: 'Stasiun KAI',
    kecamatan: 'Bubutan',
    kabupaten_kota: 'Kota Surabaya',
    lat: -7.2484,
    lon: 112.7311,
    klaster: 3,
    poiTotal: 132,
    kepadatan: 23400,
    simpul500: 6,
    skorFasilitas: 4.5,
  },
  {
    nama: 'Terminal Purabaya (Bungurasih)',
    jenis: 'Terminal',
    kecamatan: 'Waru',
    kabupaten_kota: 'Kabupaten Sidoarjo',
    lat: -7.3514,
    lon: 112.7248,
    klaster: 3,
    poiTotal: 118,
    kepadatan: 7850,
    simpul500: 8,
    skorFasilitas: 4.7,
  },
  {
    nama: 'Terminal Joyoboyo',
    jenis: 'Terminal',
    kecamatan: 'Wonokromo',
    kabupaten_kota: 'Kota Surabaya',
    lat: -7.2981,
    lon: 112.7376,
    klaster: 3,
    poiTotal: 109,
    kepadatan: 18400,
    simpul500: 6,
    skorFasilitas: 4.2,
  },
  {
    nama: 'Stasiun Wonokromo',
    jenis: 'Stasiun KAI',
    kecamatan: 'Wonokromo',
    kabupaten_kota: 'Kota Surabaya',
    lat: -7.3029,
    lon: 112.7381,
    klaster: 3,
    poiTotal: 96,
    kepadatan: 18400,
    simpul500: 5,
    skorFasilitas: 4.1,
  },
  {
    nama: 'Terminal Tambak Osowilangon',
    jenis: 'Terminal',
    kecamatan: 'Tandes',
    kabupaten_kota: 'Kota Surabaya',
    lat: -7.2194,
    lon: 112.6624,
    klaster: 3,
    poiTotal: 74,
    kepadatan: 8300,
    simpul500: 4,
    skorFasilitas: 3.9,
  },
  {
    nama: 'Stasiun Sidoarjo',
    jenis: 'Stasiun KAI',
    kecamatan: 'Sidoarjo',
    kabupaten_kota: 'Kabupaten Sidoarjo',
    lat: -7.4463,
    lon: 112.7166,
    klaster: 3,
    poiTotal: 92,
    kepadatan: 3320,
    simpul500: 5,
    skorFasilitas: 4.2,
  },
  {
    nama: 'Terminal Larangan Sidoarjo',
    jenis: 'Terminal',
    kecamatan: 'Sidoarjo',
    kabupaten_kota: 'Kabupaten Sidoarjo',
    lat: -7.4628,
    lon: 112.7145,
    klaster: 3,
    poiTotal: 84,
    kepadatan: 3320,
    simpul500: 5,
    skorFasilitas: 4.0,
  },
  {
    nama: 'Terminal Bunder Gresik',
    jenis: 'Terminal',
    kecamatan: 'Kebomas',
    kabupaten_kota: 'Kabupaten Gresik',
    lat: -7.1672,
    lon: 112.6012,
    klaster: 3,
    poiTotal: 76,
    kepadatan: 3820,
    simpul500: 4,
    skorFasilitas: 4.1,
  },
  {
    nama: 'Halte Alun-Alun Gresik',
    jenis: 'Halte Trans Jatim',
    kecamatan: 'Gresik',
    kabupaten_kota: 'Kabupaten Gresik',
    lat: -7.1566,
    lon: 112.6559,
    klaster: 1,
    poiTotal: 88,
    kepadatan: 14100,
    simpul500: 4,
    skorFasilitas: 3.7,
  },
  {
    nama: 'Halte Balai Pemuda',
    jenis: 'Halte Suroboyo Bus',
    kecamatan: 'Genteng',
    kabupaten_kota: 'Kota Surabaya',
    lat: -7.2636,
    lon: 112.7453,
    klaster: 1,
    poiTotal: 138,
    kepadatan: 14800,
    simpul500: 5,
    skorFasilitas: 4.0,
  },
  {
    nama: 'Halte Tunjungan Plaza',
    jenis: 'Halte Suroboyo Bus',
    kecamatan: 'Tegalsari',
    kabupaten_kota: 'Kota Surabaya',
    lat: -7.2624,
    lon: 112.7393,
    klaster: 1,
    poiTotal: 142,
    kepadatan: 21500,
    simpul500: 6,
    skorFasilitas: 4.3,
  },
  {
    nama: 'Halte ITS Bundaran',
    jenis: 'Halte Suroboyo Bus',
    kecamatan: 'Sukolilo',
    kabupaten_kota: 'Kota Surabaya',
    lat: -7.2823,
    lon: 112.7945,
    klaster: 2,
    poiTotal: 64,
    kepadatan: 5400,
    simpul500: 3,
    skorFasilitas: 3.4,
  },
  {
    nama: 'Halte UNAIR Kampus C',
    jenis: 'Halte Suroboyo Bus',
    kecamatan: 'Mulyorejo',
    kabupaten_kota: 'Kota Surabaya',
    lat: -7.2676,
    lon: 112.7848,
    klaster: 2,
    poiTotal: 58,
    kepadatan: 6300,
    simpul500: 3,
    skorFasilitas: 3.5,
  },
  {
    nama: 'Halte Rungkut Madya',
    jenis: 'Halte Feeder',
    kecamatan: 'Rungkut',
    kabupaten_kota: 'Kota Surabaya',
    lat: -7.3315,
    lon: 112.7894,
    klaster: 4,
    poiTotal: 22,
    kepadatan: 5800,
    simpul500: 1,
    skorFasilitas: 2.1,
  },
  {
    nama: 'Halte Lakarsantri Timur',
    jenis: 'Halte Feeder',
    kecamatan: 'Lakarsantri',
    kabupaten_kota: 'Kota Surabaya',
    lat: -7.3054,
    lon: 112.6584,
    klaster: 4,
    poiTotal: 0,
    kepadatan: 3400,
    simpul500: 0,
    skorFasilitas: 1.4,
  },
];

const STREET_PREFIXES_SBY = [
  'Darmo',
  'Basuki Rahmat',
  'Panglima Sudirman',
  'Pemuda',
  'Ahmad Yani',
  'Diponegoro',
  'Raya Merr',
  'Kertajaya',
  'Manyar Kertoarjo',
  'Mayjen Sungkono',
  'HR Muhammad',
  'Ngagel Jaya',
  'Rajawali',
  'Kembang Jepun',
  'Veteran',
  'Manukan',
  'Kenjeran',
  'Margorejo',
  'Jemursari',
  'Rungkut Industri',
  'Siwalankerto',
  'Ketintang',
  'Kedungdoro',
  'Keputih',
  'Semolowaru',
];

const STREET_PREFIXES_SDA = [
  'Raya Waru',
  'Brigjen Katamso',
  'Letjen Sutoyo',
  'Raya Taman',
  'Raya Gedangan',
  'Raya Buduran',
  'Pahlawan Sidoarjo',
  'Gajah Mada',
  'Jenggolo',
  'Juanda',
];

const STREET_PREFIXES_GRS = [
  'DR Wahidin',
  'Kartini Gresik',
  'Veteran Gresik',
  'Panglima Sudirman',
  'Raya Manyar',
  'Raya Driyorejo',
  'Raya Menganti',
  'Usman Sadar',
];

export function generateSyntheticDataset(): SimpulNode[] {
  const rand = mulberry32(20261120);
  const nodes: SimpulNode[] = [];

  NAMED_HUBS.forEach((hub, idx) => {
    const isHub = hub.klaster === 3;
    const isCore = hub.klaster === 1;
    const isCampus = hub.klaster === 2;

    let props = [0.2, 0.15, 0.25, 0.3, 0.1];
    if (isCore) props = [0.1, 0.1, 0.36, 0.38, 0.06];
    else if (isCampus) props = [0.48, 0.12, 0.1, 0.2, 0.1];
    else if (isHub) props = [0.12, 0.14, 0.26, 0.36, 0.12];
    else props = [0.18, 0.08, 0.12, 0.34, 0.28];

    const entropi =
      hub.poiTotal === 0
        ? 0
        : -props.reduce((acc, p) => (p > 0 ? acc + p * Math.log(p) : acc), 0) / Math.log(5);

    nodes.push({
      id: `SBR-${String(idx + 1).padStart(3, '0')}`,
      nama_simpul: hub.nama,
      jenis_simpul: hub.jenis,
      lat: hub.lat,
      lon: hub.lon,
      kecamatan: hub.kecamatan,
      kabupaten_kota: hub.kabupaten_kota,
      poi_total_500m: hub.poiTotal,
      prop_poi_pendidikan: Number(props[0].toFixed(3)),
      prop_poi_kesehatan: Number(props[1].toFixed(3)),
      prop_poi_perkantoran: Number(props[2].toFixed(3)),
      prop_poi_komersial: Number(props[3].toFixed(3)),
      prop_poi_ibadah: Number(props[4].toFixed(3)),
      entropi_poi: Number(entropi.toFixed(3)),
      kepadatan_penduduk_kec: hub.kepadatan,
      jumlah_simpul_500m: hub.simpul500,
      jarak_simpul_terdekat: isHub ? Math.round(140 + rand() * 90) : Math.round(180 + rand() * 350),
      kerapatan_persimpangan: isCore ? Math.round(88 + rand() * 24) : isHub ? Math.round(62 + rand() * 25) : Math.round(28 + rand() * 25),
      jarak_ke_pusat_kota: Number((Math.hypot((hub.lat + 7.2575) * 111, (hub.lon - 112.7521) * 110)).toFixed(2)),
      skor_fasilitas: hub.skorFasilitas,
      klaster: hub.klaster,
    });
  });

  // Build weighted zone pool so ~65% are in Kota Surabaya, ~20% Kabupaten Sidoarjo, ~15% Kabupaten Gresik
  const weightedZones: KecamatanZone[] = [];
  ZONES.forEach((z) => {
    for (let w = 0; w < z.weight; w++) {
      weightedZones.push(z);
    }
  });

  const targetCount = 120;
  for (let i = nodes.length; i < targetCount; i++) {
    const zone = weightedZones[(i * 7) % weightedZones.length];
    const lat = Number((zone.lat + (rand() - 0.5) * 0.018).toFixed(5));
    const lon = Number((zone.lon + (rand() - 0.5) * 0.022).toFixed(5));
    const klaster = zone.klasterKecenderungan;

    let jenis = 'Halte Suroboyo Bus';
    if (zone.kabupaten_kota === 'Kota Surabaya') {
      if (klaster === 4) {
        jenis = rand() > 0.25 ? 'Halte Feeder' : 'Halte Suroboyo Bus';
      } else if (klaster === 3) {
        const r = rand();
        jenis = r > 0.72 ? 'Terminal' : r > 0.48 ? 'Stasiun KAI' : 'Halte Suroboyo Bus';
      } else if (klaster === 2) {
        jenis = rand() > 0.45 ? 'Halte Suroboyo Bus' : 'Halte Feeder';
      } else {
        jenis = rand() > 0.2 ? 'Halte Suroboyo Bus' : 'Halte Feeder';
      }
    } else {
      // Sidoarjo & Gresik mostly served by Trans Jatim, KAI Commuter, Terminal, and Feeder
      if (klaster === 3) {
        jenis = rand() > 0.55 ? 'Stasiun KAI' : 'Halte Trans Jatim';
      } else if (klaster === 4) {
        jenis = rand() > 0.35 ? 'Halte Feeder' : 'Halte Trans Jatim';
      } else {
        jenis = 'Halte Trans Jatim';
      }
    }

    let poiTotal = 0;
    let simpul500 = 0;
    let jarakTerdekat = 350;
    let persimpangan = 45;
    let skorFasilitas = 3.0;
    let rawProps = [0.2, 0.2, 0.2, 0.2, 0.2];

    if (klaster === 1) {
      poiTotal = Math.round(78 + rand() * 68);
      simpul500 = Math.round(3 + rand() * 4);
      jarakTerdekat = Math.round(140 + rand() * 190);
      persimpangan = Math.round(75 + rand() * 38);
      skorFasilitas = Number((3.4 + rand() * 1.2).toFixed(2));
      rawProps = [0.08 + rand() * 0.08, 0.08 + rand() * 0.08, 0.30 + rand() * 0.14, 0.34 + rand() * 0.14, 0.06 + rand() * 0.05];
    } else if (klaster === 2) {
      poiTotal = Math.round(34 + rand() * 38);
      simpul500 = Math.round(1 + rand() * 3);
      jarakTerdekat = Math.round(240 + rand() * 260);
      persimpangan = Math.round(48 + rand() * 26);
      skorFasilitas = Number((2.7 + rand() * 1.1).toFixed(2));
      rawProps = [0.36 + rand() * 0.22, 0.10 + rand() * 0.08, 0.10 + rand() * 0.08, 0.20 + rand() * 0.1, 0.14 + rand() * 0.08];
    } else if (klaster === 3) {
      poiTotal = Math.round(62 + rand() * 58);
      simpul500 = Math.round(4 + rand() * 4);
      jarakTerdekat = Math.round(110 + rand() * 150);
      persimpangan = Math.round(60 + rand() * 30);
      skorFasilitas = Number((3.8 + rand() * 1.0).toFixed(2));
      rawProps = [0.14 + rand() * 0.08, 0.14 + rand() * 0.08, 0.24 + rand() * 0.1, 0.30 + rand() * 0.12, 0.12 + rand() * 0.06];
    } else {
      const isZeroPoi = i % 29 === 0;
      poiTotal = isZeroPoi ? 0 : Math.round(4 + rand() * 22);
      simpul500 = Math.round(rand() * 1.4);
      jarakTerdekat = Math.round(520 + rand() * 680);
      persimpangan = Math.round(14 + rand() * 22);
      skorFasilitas = Number((1.3 + rand() * 1.2).toFixed(2));
      rawProps = [0.18 + rand() * 0.15, 0.06 + rand() * 0.1, 0.08 + rand() * 0.1, 0.28 + rand() * 0.18, 0.26 + rand() * 0.18];
    }

    const sumP = rawProps.reduce((a, b) => a + b, 0);
    const props = poiTotal === 0 ? [0, 0, 0, 0, 0] : rawProps.map((v) => v / sumP);
    const entropi =
      poiTotal === 0
        ? 0
        : -props.reduce((acc, p) => (p > 0 ? acc + p * Math.log(p) : acc), 0) / Math.log(5);

    const streetPool =
      zone.kabupaten_kota === 'Kabupaten Sidoarjo'
        ? STREET_PREFIXES_SDA
        : zone.kabupaten_kota === 'Kabupaten Gresik'
          ? STREET_PREFIXES_GRS
          : STREET_PREFIXES_SBY;
    const street = streetPool[i % streetPool.length];
    const suffix = i % 2 === 0 ? 'A' : 'B';
    const prefixLabel =
      jenis === 'Stasiun KAI' ? 'Stasiun' : jenis === 'Terminal' ? 'Terminal' : 'Halte';

    nodes.push({
      id: `SBR-${String(i + 1).padStart(3, '0')}`,
      nama_simpul: `${prefixLabel} ${street} ${suffix}`,
      jenis_simpul: jenis,
      lat,
      lon,
      kecamatan: zone.nama,
      kabupaten_kota: zone.kabupaten_kota,
      poi_total_500m: poiTotal,
      prop_poi_pendidikan: Number(props[0].toFixed(3)),
      prop_poi_kesehatan: Number(props[1].toFixed(3)),
      prop_poi_perkantoran: Number(props[2].toFixed(3)),
      prop_poi_komersial: Number(props[3].toFixed(3)),
      prop_poi_ibadah: Number(props[4].toFixed(3)),
      entropi_poi: Number(entropi.toFixed(3)),
      kepadatan_penduduk_kec: Math.round(zone.kepadatan * (0.94 + rand() * 0.12)),
      jumlah_simpul_500m: simpul500,
      jarak_simpul_terdekat: jarakTerdekat,
      kerapatan_persimpangan: persimpangan,
      jarak_ke_pusat_kota: Number(
        Math.hypot((lat + 7.2575) * 111, (lon - 112.7521) * 110).toFixed(2)
      ),
      skor_fasilitas: Math.min(5, Math.max(1, skorFasilitas)),
      klaster: klaster,
    });
  }

  return nodes;
}

export const INITIAL_GROUP_IDENTITY: GroupIdentity = {
  namaKelompok: 'Kelompok 04 — Analisis Spasial Transportasi',
  kelas: 'Sains Data 2024 A',
  mataKuliah: 'Data Wrangling & Eksplorasi Spasial',
  anggota: [
    {id: 'm1', nama: 'Anggota A (Ketua)', nim: '25031554001'},
    {id: 'm2', nama: 'Anggota B', nim: '25031554002'},
    {id: 'm3', nama: 'Anggota C', nim: '25031554003'},
  ],
};

export const INITIAL_WRANGLING_LOG: WranglingLogEntry[] = [
  {
    id: 'w1',
    masalah: 'Node halte dua arah tercatat ganda dalam radius 10–20 m di ruas jalan yang sama',
    jumlahTerdampak: '18 node (13,0%)',
    tindakan: 'Deduplikasi spasial BallTree (metrik Haversine, ambang radius 25 m)',
    alasan: 'Mencegah penghitungan ganda halte berseberangan yang menggelembungkan jumlah_simpul_500m.',
  },
  {
    id: 'w2',
    masalah: 'Atribut fasilitas halte (shelter, tempat duduk, pencahayaan) kosong di OSM',
    jumlahTerdampak: '14 node (11,7%)',
    tindakan: 'Imputasi skor_fasilitas berdasarkan standar jenis simpul & pemeriksaan citra jalan',
    alasan: 'Menjaga kelengkapan skor fasilitas tanpa menghapus simpul pinggiran yang memang minim tag.',
  },
  {
    id: 'w3',
    masalah: 'Simpul tanpa POI dalam radius 500 m menghasilkan pembagian 0 pada proporsi POI',
    jumlahTerdampak: '3 node (2,5%)',
    tindakan: 'Mengisi proporsi dengan 0 dan menetapkan entropi_poi = 0,0',
    alasan: 'Ketiadaan POI merupakan informasi karakter kawasan pinggiran yang sah, bukan data rusak.',
  },
  {
    id: 'w4',
    masalah: 'Nilai ekstrem pada poi_total_500m & jumlah_simpul_500m di stasiun/terminal utama',
    jumlahTerdampak: '8 node (6,7%)',
    tindakan: 'Ditandai sebagai hub valid (tidak dibuang) dan ditransformasi log1p sebelum scaling',
    alasan: 'Stasiun Gubeng, Pasar Turi, Terminal Purabaya, dan Terminal Bunder merupakan simpul utama nyata di Surabaya Raya.',
  },
  {
    id: 'w5',
    masalah: 'Nama kecamatan & kabupaten/kota di OSM tidak seragam dengan tabel BPS Surabaya Raya',
    jumlahTerdampak: '11 baris (9,2%)',
    tindakan: 'Normalisasi huruf dan spatial join ke GeoJSON batas kecamatan Kota Surabaya, Sidoarjo, dan Gresik',
    alasan: 'Memastikan angka kepadatan penduduk BPS bergabung akurat ke setiap simpul lintas wilayah.',
  },
];

export const INITIAL_PRE_CLEAN_MISSING: MissingColStat[] = [
  {kolom: 'skor_fasilitas', persenMissing: 11.7, jumlahMissing: 14},
  {kolom: 'nama_simpul', persenMissing: 6.7, jumlahMissing: 8},
  {kolom: 'kecamatan', persenMissing: 4.2, jumlahMissing: 5},
  {kolom: 'kerapatan_persimpangan', persenMissing: 1.7, jumlahMissing: 2},
  {kolom: 'poi_total_500m', persenMissing: 0.0, jumlahMissing: 0},
  {kolom: 'kepadatan_penduduk_kec', persenMissing: 0.0, jumlahMissing: 0},
  {kolom: 'lat / lon', persenMissing: 0.0, jumlahMissing: 0},
];

export const INITIAL_RECOMMENDATIONS: ClusterRecommendation[] = [
  {
    klaster: 1,
    namaKlaster: 'Kawasan Pusat Bisnis & Komersial Padat',
    arahStrategi:
      'Penataan aksesibilitas pejalan kaki, integrasi papan informasi rute terpadu, dan pengaturan manajemen antrean antar-moda di koridor pusat kota tanpa memperluas lahan fisik halte.',
  },
  {
    klaster: 2,
    namaKlaster: 'Kawasan Pendidikan & Permukiman Padat',
    arahStrategi:
      'Penyesuaian jadwal frekuensi keberangkatan pada jam sibuk sekolah/kampus serta penyediaan peneduh dan ruang tunggu yang memadai bagi komuter harian.',
  },
  {
    klaster: 3,
    namaKlaster: 'Simpul Transit Regional & Hub Antar-Moda',
    arahStrategi:
      'Penguatan integrasi transfer antar-moda (kereta api, bus kota, Trans Jatim, dan pengumpan/feeder), kejelasan penunjuk arah (wayfinding), dan sinkronisasi jadwal kedatangan.',
  },
  {
    klaster: 4,
    namaKlaster: 'Kawasan Pinggiran Berkembang & Akses Terbatas',
    arahStrategi:
      'Peningkatan kelengkapan prasarana dasar perhentian (penanda halte, penerangan, atap sederhana) serta penguatan koneksi rute pengumpan menuju koridor utama Surabaya Raya.',
  },
];

export const INITIAL_INSIGHTS: Record<string, string> = {
  peta: 'Sebaran simpul terkonsentrasi di Kota Surabaya, sedangkan koridor penghubung ke Kabupaten Sidoarjo dan Kabupaten Gresik bertumpu pada jalur arteri serta terminal regional.',
  missing: 'Atribut kelengkapan fasilitas fisik di OpenStreetMap memiliki tingkat kekosongan tertinggi sehingga memerlukan aturan imputasi yang terdokumentasi.',
  dedup: 'Penghapusan node berjarak <= 25 m memangkas bias penghitungan ganda halte dua arah pada ruas jalan arteri.',
  korelasi: 'Hubungan antarfitur kepadatan POI dan persimpangan perlu dipantau terhadap ambang |rho| > 0,85 guna mencegah pembobotan ganda pada jarak Euclidean.',
  log1p: 'Transformasi log1p meredam kemencengan kanan akibat keberadaan stasiun dan terminal besar tanpa membuang observasi sah.',
  outlier: 'Simpul yang tertandai metode IQR dan Isolation Forest seluruhnya bertepatan dengan hub transit utama Surabaya Raya, sehingga dipertahankan dalam pemodelan.',
  pemilihan_k: 'Nilai k = 4 dipilih sebagai titik kompromi antara kestabilan silhouette, penurunan inersia, dan keterbacaan profil kawasan.',
  pca: 'Proyeksi dua komponen utama merangkum variasi dominan karakteristik kawasan, meski penyebaran lanjutan tetap perlu dibaca melalui heatmap z-score.',
  heatmap_profil: 'Kontras z-score memperlihatkan pemisahan jelas antara kawasan berkepadatan POI tinggi dan kawasan pinggiran berjarak simpul jauh.',
  radar: 'Pola garis tiap klaster menunjukkan profil fitur yang tidak seragam, menandakan perbedaan karakter lingkungan sekitar simpul.',
  boxplot: 'Sebaran skor fasilitas pada klaster pinggiran cenderung lebih rendah dibandingkan klaster hub transit dan pusat kota.',
  sebaran_wilayah: 'Komposisi klaster di Kota Surabaya lebih beragam hingga pusat bisnis padat, sedangkan simpul di Sidoarjo dan Gresik lebih banyak mengisi klaster hub transit dan kawasan berkembang.',
};
