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
  lat: number;
  lon: number;
  kepadatan: number; // jiwa/km2
  klasterKecenderungan: number;
  jarakPusatKm: number;
}

const ZONES: KecamatanZone[] = [
  // Klaster 1: Pusat Komersial & Perkantoran Padat
  {nama: 'Genteng', lat: -7.2592, lon: 112.7426, kepadatan: 14800, klasterKecenderungan: 1, jarakPusatKm: 0.8},
  {nama: 'Tegalsari', lat: -7.2705, lon: 112.7358, kepadatan: 21500, klasterKecenderungan: 1, jarakPusatKm: 1.6},
  {nama: 'Bubutan', lat: -7.2469, lon: 112.7285, kepadatan: 23400, klasterKecenderungan: 1, jarakPusatKm: 1.9},
  {nama: 'Gubeng', lat: -7.2755, lon: 112.7555, kepadatan: 16900, klasterKecenderungan: 1, jarakPusatKm: 2.3},
  // Klaster 2: Kawasan Permukiman Padat & Kampus
  {nama: 'Sukolilo', lat: -7.2912, lon: 112.7924, kepadatan: 5400, klasterKecenderungan: 2, jarakPusatKm: 6.4},
  {nama: 'Mulyorejo', lat: -7.2698, lon: 112.7852, kepadatan: 6300, klasterKecenderungan: 2, jarakPusatKm: 5.5},
  {nama: 'Tambaksari', lat: -7.2512, lon: 112.7664, kepadatan: 24900, klasterKecenderungan: 2, jarakPusatKm: 3.4},
  {nama: 'Wonokromo', lat: -7.2974, lon: 112.7341, kepadatan: 18400, klasterKecenderungan: 2, jarakPusatKm: 4.1},
  {nama: 'Sawahan', lat: -7.2722, lon: 112.7165, kepadatan: 27800, klasterKecenderungan: 2, jarakPusatKm: 3.1},
  // Klaster 3: Simpul Hub Transit Regional / Terminal & Stasiun Utama
  {nama: 'Wonocolo', lat: -7.3228, lon: 112.7351, kepadatan: 12100, klasterKecenderungan: 3, jarakPusatKm: 7.2},
  {nama: 'Gayungan', lat: -7.3356, lon: 112.7262, kepadatan: 7800, klasterKecenderungan: 3, jarakPusatKm: 8.6},
  {nama: 'Krembangan', lat: -7.2295, lon: 112.7268, kepadatan: 13900, klasterKecenderungan: 3, jarakPusatKm: 4.0},
  {nama: 'Pabean Cantikan', lat: -7.2175, lon: 112.7346, kepadatan: 12400, klasterKecenderungan: 3, jarakPusatKm: 5.1},
  // Klaster 4: Pinggiran Berkembang & Akses Rendah
  {nama: 'Rungkut', lat: -7.3225, lon: 112.7845, kepadatan: 5800, klasterKecenderungan: 4, jarakPusatKm: 8.9},
  {nama: 'Gunung Anyar', lat: -7.3412, lon: 112.7905, kepadatan: 4900, klasterKecenderungan: 4, jarakPusatKm: 10.6},
  {nama: 'Tandes', lat: -7.2598, lon: 112.6775, kepadatan: 8300, klasterKecenderungan: 4, jarakPusatKm: 7.6},
  {nama: 'Lakarsantri', lat: -7.3032, lon: 112.6524, kepadatan: 3400, klasterKecenderungan: 4, jarakPusatKm: 10.8},
  {nama: 'Kenjeran', lat: -7.2286, lon: 112.7784, kepadatan: 19600, klasterKecenderungan: 4, jarakPusatKm: 6.1},
  {nama: 'Jambangan', lat: -7.3204, lon: 112.7125, kepadatan: 12900, klasterKecenderungan: 4, jarakPusatKm: 7.5},
  {nama: 'Dukuh Pakis', lat: -7.2886, lon: 112.6955, kepadatan: 6100, klasterKecenderungan: 2, jarakPusatKm: 5.4},
];

const NAMED_HUBS: Array<{
  nama: string;
  jenis: string;
  kecamatan: string;
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
    kecamatan: 'Gayungan',
    lat: -7.3514,
    lon: 112.7248,
    klaster: 3,
    poiTotal: 118,
    kepadatan: 7800,
    simpul500: 8,
    skorFasilitas: 4.7,
  },
  {
    nama: 'Terminal Joyoboyo',
    jenis: 'Terminal',
    kecamatan: 'Wonokromo',
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
    lat: -7.2194,
    lon: 112.6624,
    klaster: 3,
    poiTotal: 74,
    kepadatan: 8300,
    simpul500: 4,
    skorFasilitas: 3.9,
  },
  {
    nama: 'Halte Balai Pemuda',
    jenis: 'Halte Suroboyo Bus',
    kecamatan: 'Genteng',
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
    lat: -7.3054,
    lon: 112.6584,
    klaster: 4,
    poiTotal: 0,
    kepadatan: 3400,
    simpul500: 0,
    skorFasilitas: 1.4,
  },
];

const STREET_PREFIXES = [
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
  'Pucang Anom',
  'Rajawali',
  'Kembang Jepun',
  'Veteran',
  'Demak',
  'Manukan',
  'Benowo',
  'Kenjeran',
  'Wiyung',
  'Margorejo',
  'Jemursari',
  'Rungkut Industri',
  'Siwalankerto',
  'Ketintang',
  'Karah',
  'Kedungdoro',
  'Pasar Kembang',
  'Banyu Urip',
  'Kalijudan',
  'Sutorejo',
  'Keputih',
  'Semolowaru',
  'Medokan Ayu',
  'Kapas Krampung',
  'Tambakrejo',
  'Prapen',
  'Kutisari',
  'Karangpilang',
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
      id: `SBY-${String(idx + 1).padStart(3, '0')}`,
      nama_simpul: hub.nama,
      jenis_simpul: hub.jenis,
      lat: hub.lat,
      lon: hub.lon,
      kecamatan: hub.kecamatan,
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

  // Generate remaining nodes up to 120 total
  const targetCount = 120;
  for (let i = nodes.length; i < targetCount; i++) {
    const zone = ZONES[i % ZONES.length];
    // Add controlled spatial jitter around kecamatan centroid
    const lat = Number((zone.lat + (rand() - 0.5) * 0.018).toFixed(5));
    const lon = Number((zone.lon + (rand() - 0.5) * 0.022).toFixed(5));
    const klaster = zone.klasterKecenderungan;

    let jenis = 'Halte Suroboyo Bus';
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

    // Feature generation conditioned clearly on cluster profiles so K-Means & PCA reflect realistic structures
    let poiTotal = 0;
    let simpul500 = 0;
    let jarakTerdekat = 350;
    let persimpangan = 45;
    let skorFasilitas = 3.0;
    let rawProps = [0.2, 0.2, 0.2, 0.2, 0.2];

    if (klaster === 1) {
      // Pusat Bisnis & Komersial Padat
      poiTotal = Math.round(78 + rand() * 68);
      simpul500 = Math.round(3 + rand() * 4);
      jarakTerdekat = Math.round(140 + rand() * 190);
      persimpangan = Math.round(75 + rand() * 38);
      skorFasilitas = Number((3.4 + rand() * 1.2).toFixed(2));
      rawProps = [0.08 + rand() * 0.08, 0.08 + rand() * 0.08, 0.30 + rand() * 0.14, 0.34 + rand() * 0.14, 0.06 + rand() * 0.05];
    } else if (klaster === 2) {
      // Kawasan Pendidikan & Permukiman
      poiTotal = Math.round(34 + rand() * 38);
      simpul500 = Math.round(1 + rand() * 3);
      jarakTerdekat = Math.round(240 + rand() * 260);
      persimpangan = Math.round(48 + rand() * 26);
      skorFasilitas = Number((2.7 + rand() * 1.1).toFixed(2));
      rawProps = [0.36 + rand() * 0.22, 0.10 + rand() * 0.08, 0.10 + rand() * 0.08, 0.20 + rand() * 0.1, 0.14 + rand() * 0.08];
    } else if (klaster === 3) {
      // Hub Transit / Koridor Sibuk
      poiTotal = Math.round(62 + rand() * 58);
      simpul500 = Math.round(4 + rand() * 4);
      jarakTerdekat = Math.round(110 + rand() * 150);
      persimpangan = Math.round(60 + rand() * 30);
      skorFasilitas = Number((3.8 + rand() * 1.0).toFixed(2));
      rawProps = [0.14 + rand() * 0.08, 0.14 + rand() * 0.08, 0.24 + rand() * 0.1, 0.30 + rand() * 0.12, 0.12 + rand() * 0.06];
    } else {
      // Pinggiran Berkembang & Akses Terbatas
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

    const street = STREET_PREFIXES[i % STREET_PREFIXES.length];
    const suffix = i % 2 === 0 ? 'A' : 'B';
    const prefixLabel =
      jenis === 'Stasiun KAI' ? 'Stasiun' : jenis === 'Terminal' ? 'Terminal' : 'Halte';

    nodes.push({
      id: `SBY-${String(i + 1).padStart(3, '0')}`,
      nama_simpul: `${prefixLabel} ${street} ${suffix}`,
      jenis_simpul: jenis,
      lat,
      lon,
      kecamatan: zone.nama,
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
    jumlahTerdampak: '6 node (5,0%)',
    tindakan: 'Ditandai sebagai hub valid (tidak dibuang) dan ditransformasi log1p sebelum scaling',
    alasan: 'Stasiun Gubeng, Pasar Turi, dan Terminal Purabaya merupakan simpul utama nyata di Surabaya.',
  },
  {
    id: 'w5',
    masalah: 'Nama kecamatan di OSM tidak seragam kapitalisasi dan ejaan dengan tabel BPS',
    jumlahTerdampak: '9 baris (7,5%)',
    tindakan: 'Normalisasi huruf dan spatial join ke GeoJSON batas administrasi kecamatan BPS',
    alasan: 'Memastikan angka kepadatan penduduk BPS bergabung akurat ke setiap simpul.',
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
      'Penguatan integrasi transfer antar-moda (kereta api, bus kota, dan pengumpan/feeder), kejelasan penunjuk arah (wayfinding), dan sinkronisasi jadwal kedatangan.',
  },
  {
    klaster: 4,
    namaKlaster: 'Kawasan Pinggiran Berkembang & Akses Terbatas',
    arahStrategi:
      'Peningkatan kelengkapan prasarana dasar perhentian (penanda halte, penerangan, atap sederhana) serta penguatan koneksi rute pengumpan menuju koridor utama.',
  },
];

export const INITIAL_INSIGHTS: Record<string, string> = {
  peta: 'Sebaran simpul masih terkonsentrasi di koridor tengah utara-selatan Surabaya, sedangkan wilayah barat dan tenggara memiliki jarak antar-simpul lebih renggang.',
  missing: 'Atribut kelengkapan fasilitas fisik di OpenStreetMap memiliki tingkat kekosongan tertinggi sehingga memerlukan aturan imputasi yang terdokumentasi.',
  dedup: 'Penghapusan node berjarak <= 25 m memangkas bias penghitungan ganda halte dua arah pada ruas jalan arteri.',
  korelasi: 'Hubungan antarfitur kepadatan POI dan persimpangan perlu dipantau terhadap ambang |rho| > 0,85 guna mencegah pembobotan ganda pada jarak Euclidean.',
  log1p: 'Transformasi log1p meredam kemencengan kanan akibat keberadaan stasiun dan terminal besar tanpa membuang observasi sah.',
  outlier: 'Simpul yang tertandai metode IQR dan Isolation Forest seluruhnya bertepatan dengan hub transit utama, sehingga dipertahankan dalam pemodelan.',
  pemilihan_k: 'Nilai k = 4 dipilih sebagai titik kompromi antara kestabilan silhouette, penurunan inersia, dan keterbacaan profil kawasan.',
  pca: 'Proyeksi dua komponen utama merangkum variasi dominan karakteristik kawasan, meski penyebaran lanjutan tetap perlu dibaca melalui heatmap z-score.',
  heatmap_profil: 'Kontras z-score memperlihatkan pemisahan jelas antara kawasan berkepadatan POI tinggi dan kawasan pinggiran berjarak simpul jauh.',
  radar: 'Pola garis tiap klaster menunjukkan profil fitur yang tidak seragam, menandakan perbedaan karakter lingkungan sekitar simpul.',
  boxplot: 'Sebaran skor fasilitas pada klaster pinggiran cenderung lebih rendah dibandingkan klaster hub transit dan pusat kota.',
};
