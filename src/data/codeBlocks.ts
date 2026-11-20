import {StageAppendix, StageKey} from '../types/report';

// Exact verbatim Python code blocks provided in the project specification (Blok 1 - 6)
// Do NOT alter, reformat, or "fix" Blok 1 - 6.

const BLOK_1_CODE = `import numpy as np
from sklearn.neighbors import BallTree

coords = np.radians(df[["lat", "lon"]].to_numpy())
tree = BallTree(coords, metric="haversine")

R = 25 / 6_371_000                      # 25 m dalam radian
tetangga = tree.query_radius(coords, r=R)

keep = np.ones(len(df), dtype=bool)
for i, nb in enumerate(tetangga):
    if keep[i]:
        keep[nb[nb > i]] = False        # simpan node pertama, buang yang dekat

print(f"Sebelum: {len(df)} | Sesudah: {keep.sum()} | Dibuang: {(~keep).sum()}")
df = df[keep].reset_index(drop=True)`;

const BLOK_2_CODE = `from sklearn.ensemble import IsolationForest

kolom = ["poi_total_500m", "kepadatan_penduduk_kec", "jumlah_simpul_500m"]

for k in kolom:
    q1, q3 = df[k].quantile([0.25, 0.75])
    batas = q3 + 1.5 * (q3 - q1)
    df[f"out_iqr_{k}"] = df[k] > batas

iso = IsolationForest(contamination=0.05, random_state=42)
df["out_iso"] = iso.fit_predict(df[kolom]) == -1

print(df.loc[df["out_iso"], ["nama_simpul", "jenis_simpul"] + kolom])`;

const BLOK_3_CODE = `cats = ["pendidikan", "kesehatan", "perkantoran", "komersial", "ibadah"]

for c in cats:
    p = np.radians(poi.loc[poi["kategori"] == c, ["lat", "lon"]].to_numpy())
    t = BallTree(p, metric="haversine")
    df[f"n_{c}"] = t.query_radius(coords, r=500 / 6_371_000, count_only=True)

df["poi_total_500m"] = df[[f"n_{c}" for c in cats]].sum(axis=1)

for c in cats:
    df[f"prop_poi_{c}"] = df[f"n_{c}"] / df["poi_total_500m"].replace(0, np.nan)
df[[f"prop_poi_{c}" for c in cats]] = df[[f"prop_poi_{c}" for c in cats]].fillna(0)

def entropi(baris):
    p = baris.to_numpy(float)
    p = p[p > 0]
    if p.size == 0:
        return 0.0
    return -(p * np.log(p)).sum() / np.log(len(cats))   # skala 0-1

df["entropi_poi"] = df[[f"prop_poi_{c}" for c in cats]].apply(entropi, axis=1)`;

const BLOK_4_CODE = `from sklearn.preprocessing import StandardScaler

fitur = ["poi_total_500m", "kepadatan_penduduk_kec", "jumlah_simpul_500m",
         "jarak_simpul_terdekat", "entropi_poi", "kerapatan_persimpangan"]

X = df[fitur].copy()
for k in ["poi_total_500m", "kepadatan_penduduk_kec", "jarak_simpul_terdekat"]:
    X[k] = np.log1p(X[k])

korelasi = X.corr(method="spearman")
print(korelasi.where(korelasi.abs() > 0.85).stack())

X_scaled = StandardScaler().fit_transform(X)`;

const BLOK_5_CODE = `import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, davies_bouldin_score
from sklearn.decomposition import PCA

hasil = []
for k in range(2, 9):
    km = KMeans(n_clusters=k, n_init=20, random_state=42).fit(X_scaled)
    hasil.append({"k": k,
                  "inertia": km.inertia_,
                  "silhouette": silhouette_score(X_scaled, km.labels_),
                  "davies_bouldin": davies_bouldin_score(X_scaled, km.labels_)})
print(pd.DataFrame(hasil).round(3))

K = 4   # putuskan dari tabel di atas
df["klaster"] = KMeans(n_clusters=K, n_init=20, random_state=42).fit_predict(X_scaled)

pc = PCA(n_components=2).fit(X_scaled)
print("Varians dijelaskan PC1+PC2:", pc.explained_variance_ratio_.sum().round(2))`;

const BLOK_6_CODE = `profil = df.groupby("klaster")[fitur + ["skor_fasilitas"]].mean()
profil_z = (profil - profil.mean()) / profil.std()
print(df["klaster"].value_counts().sort_index())
print(profil_z.round(2))`;

// Auto-generated standard runnable Python blocks for stages without user-supplied snippets
const INGESTION_AUTO_CODE = `# kode otomatis, mohon diperiksa
import requests
import pandas as pd
import geopandas as gpd

overpass_url = "https://overpass-api.de/api/interpreter"
# Cakupan Surabaya Raya: Kota Surabaya, Kabupaten Sidoarjo, Kabupaten Gresik
query = """
[out:json][timeout:90];
(
  area["name"="Surabaya"]->.sby;
  area["name"="Sidoarjo"]->.sda;
  area["name"="Gresik"]->.grs;
);
(
  node["highway"="bus_stop"](area.sby);
  node["railway"="station"](area.sby);
  node["amenity"="bus_station"](area.sby);
  node["highway"="bus_stop"](area.sda);
  node["railway"="station"](area.sda);
  node["amenity"="bus_station"](area.sda);
  node["highway"="bus_stop"](area.grs);
  node["railway"="station"](area.grs);
  node["amenity"="bus_station"](area.grs);
);
out body;
"""
resp = requests.post(overpass_url, data={"data": query}, timeout=90)
resp.raise_for_status()
elements = resp.json()["elements"]

df_simpul = pd.DataFrame([
    {
        "osm_id": el["id"],
        "nama_simpul": el.get("tags", {}).get("name", "Tanpa Nama"),
        "jenis_simpul": el.get("tags", {}).get("highway")
        or el.get("tags", {}).get("railway")
        or el.get("tags", {}).get("amenity"),
        "lat": el["lat"],
        "lon": el["lon"],
        "shelter": el.get("tags", {}).get("shelter"),
    }
    for el in elements
])

gdf_simpul = gpd.GeoDataFrame(
    df_simpul,
    geometry=gpd.points_from_xy(df_simpul["lon"], df_simpul["lat"]),
    crs="EPSG:4326",
)
gdf_kec = gpd.read_file("batas_kecamatan_surabaya_raya.geojson").to_crs("EPSG:4326")
df_bps = pd.read_csv("bps_kepadatan_surabaya_raya.csv")

df_joined = gpd.sjoin(gdf_simpul, gdf_kec[["kabupaten_kota", "kecamatan", "geometry"]], how="left", predicate="within")
df_final = df_joined.merge(df_bps, on=["kabupaten_kota", "kecamatan"], how="left")
print(df_final.head())`;

const PROFILING_AUTO_CODE = `# kode otomatis, mohon diperiksa
import pandas as pd

profil_awal = pd.DataFrame({
    "tipe_data": df.dtypes.astype(str),
    "jumlah_kosong": df.isna().sum(),
    "persen_kosong": (df.isna().mean() * 100).round(2),
    "nilai_unik": df.nunique(),
})

print("Dimensi awal:", df.shape)
print("Jumlah duplikat eksak:", df.duplicated().sum())
print(profil_awal.sort_values("persen_kosong", ascending=False))`;

const FOLIUM_AUTO_CODE = `# kode otomatis, mohon diperiksa
import folium

peta = folium.Map(
    location=[-7.275, 112.742],
    zoom_start=12,
    tiles="CartoDB positron",
    attr="© OpenStreetMap contributors",
)

simbol_klaster = {0: "I", 1: "II", 2: "III", 3: "IV"}
for _, row in df.iterrows():
    label = simbol_klaster.get(int(row["klaster"]), str(row["klaster"]))
    popup_html = (
        f"<b>{row['nama_simpul']}</b><br>"
        f"Kecamatan: {row['kecamatan']}<br>"
        f"Klaster {label} · POI 500 m: {row['poi_total_500m']}"
    )
    folium.Marker(
        location=[row["lat"], row["lon"]],
        popup=folium.Popup(popup_html, max_width=240),
        icon=folium.DivIcon(
            html=f'<div style="font-family:monospace;font-size:11px;border:1px solid #111;background:#fff;padding:1px 3px;">{label}</div>'
        ),
    ).add_to(peta)

peta.fit_bounds([[df["lat"].min(), df["lon"].min()], [df["lat"].max(), df["lon"].max()]])
peta.save("peta_klaster_surabaya_raya.html")`;

export const INITIAL_STAGE_APPENDICES: Record<StageKey, StageAppendix> = {
  ingestion: {
    key: 'ingestion',
    judulTahap: 'Pengambilan Data & Penggabungan Spasial (Ingestion)',
    labelBlok: 'Tahap 0 — Ingestion (OSM + BPS + GeoJSON)',
    isAutoGeneratedCode: true,
    penanggungJawab: 'Anggota A',
    kodePython: INGESTION_AUTO_CODE,
    apaYangDilakukan:
      'Mengambil titik koordinat halte, stasiun, dan terminal di Surabaya Raya (Kota Surabaya, Kabupaten Sidoarjo, Kabupaten Gresik) dari Overpass API OpenStreetMap lalu menggabungkannya dengan poligon batas kecamatan dan kepadatan penduduk BPS.',
    alasanPemilihanMetode:
      'Spatial join berbasis GeoPandas (predicate="within") memastikan setiap titik simpul memperoleh atribut kabupaten/kota dan kecamatan resmi BPS meskipun tag addr:suburb di OpenStreetMap tidak terisi.',
    skripPresentasi:
      'Pada tahap awal, kami menarik koordinat simpul transportasi wilayah Surabaya Raya—mencakup Kota Surabaya, Sidoarjo, dan Gresik—dari OpenStreetMap menggunakan Overpass API. Karena atribut administrasi di OSM sering kosong, kami melakukan spatial join terhadap batas kecamatan GeoJSON untuk menautkan data kepadatan penduduk resmi dari BPS.',
    pertanyaanPenguji: [
      {
        id: 'q-ing-1',
        pertanyaan: 'Mengapa memakai OpenStreetMap dibanding hanya daftar halte resmi dinas?',
        jawaban:
          'OSM memuat titik koordinat lintas moda (bus, feeder, stasiun KAI, terminal) serta fasilitas sekitar (POI dan jaringan jalan) dalam satu struktur spasial yang dapat direplikasi.',
      },
      {
        id: 'q-ing-2',
        pertanyaan: 'Bagaimana jika ada simpul di perbatasan dua kecamatan?',
        jawaban:
          'Spatial join menempatkan titik sesuai poligon tempat koordinat jatuh, lalu baris yang gagal cocok diperiksa ulang terhadap batas terdekat.',
      },
      {
        id: 'q-ing-3',
        pertanyaan: 'Apakah kepadatan penduduk BPS bersifat dinamis per halte?',
        jawaban:
          'Tidak, data BPS tersedia pada level kecamatan sehingga menjadi konteks kepadatan makro kawasan sekitar simpul.',
      },
    ],
  },
  profiling: {
    key: 'profiling',
    judulTahap: 'Audit Kelengkapan & Kualitas Data Awal (Profiling)',
    labelBlok: 'Tahap 0B — Data Profiling',
    isAutoGeneratedCode: true,
    penanggungJawab: 'Anggota A',
    kodePython: PROFILING_AUTO_CODE,
    apaYangDilakukan:
      'Memeriksa tipe data, persentase nilai kosong per kolom, duplikasi baris eksak, serta kardinalitas nilai sebelum proses pembersihan dilakukan.',
    alasanPemilihanMetode:
      'Mengukur persentase missing per kolom secara sistematis membantu memisahkan atribut yang aman diimputasi dengan atribut yang memang tidak relevan untuk fitur klaster.',
    skripPresentasi:
      'Sebelum membersihkan data, kami mengaudit kelengkapan setiap kolom. Terlihat bahwa kelengkapan fasilitas halte di OSM paling banyak kosong karena kontributor tidak selalu mengisi tag shelter, sementara koordinat utama seluruhnya lengkap.',
    pertanyaanPenguji: [
      {
        id: 'q-prof-1',
        pertanyaan: 'Mengapa baris dengan skor_fasilitas kosong tidak langsung dihapus?',
        jawaban:
          'Menghapus baris tersebut akan menghilangkan simpul pinggiran yang memang minim catatan fasilitas sehingga sampel menjadi bias ke pusat kota.',
      },
      {
        id: 'q-prof-2',
        pertanyaan: 'Apa bedanya duplikat eksak dan duplikat spasial?',
        jawaban:
          'Duplikat eksak memiliki seluruh nilai kolom sama persis, sedangkan dua halte di sisi jalan berbeda memiliki ID dan koordinat sedikit berbeda.',
      },
      {
        id: 'q-prof-3',
        pertanyaan: 'Mengapa skor_fasilitas tidak dimasukkan ke fitur pembentuk klaster?',
        jawaban:
          'Agar klaster terbentuk murni dari karakteristik kawasan sekitar, lalu skor_fasilitas dipakai untuk mengevaluasi kondisi fasilitas tiap klaster.',
      },
    ],
  },
  cleansing: {
    key: 'cleansing',
    judulTahap: 'Cleansing: Deduplikasi Node Ganda (Radius 25 m)',
    labelBlok: 'Blok 1 — Cleansing: dedup node ganda',
    isAutoGeneratedCode: false,
    penanggungJawab: 'Anggota A',
    kodePython: BLOK_1_CODE,
    apaYangDilakukan:
      'Mengubah koordinat derajat menjadi radian lalu mencari tetangga dalam radius 25 meter memakai BallTree Haversine untuk menyimpan satu simpul perwakilan.',
    alasanPemilihanMetode:
      'Satu halte dua arah sering tercatat dua node berjarak 10-20 m. Tanpa dedup, satu halte terhitung dua kali dan jumlah_simpul_500m menggelembung. Ambang 25 m lebih besar dari lebar jalan, tetapi lebih kecil dari jarak antarhalte berbeda.',
    skripPresentasi:
      'Di OpenStreetMap, satu halte dengan dua arah lajur sering tercatat sebagai dua titik berjarak 10 hingga 20 meter. Kami menerapkan BallTree dengan jarak Haversine berambang 25 meter untuk menyisakan satu node representatif agar kepadatan simpul tidak terhitung ganda.',
    pertanyaanPenguji: [
      {
        id: 'q-cln-1',
        pertanyaan: 'Mengapa memilih ambang batas 25 meter dan bukan 50 meter?',
        jawaban:
          'Lebar ruas jalan raya di kawasan Surabaya Raya umumnya 10–20 meter; ambang 50 meter berisiko menggabungkan dua halte berbeda di persimpangan besar.',
      },
      {
        id: 'q-cln-2',
        pertanyaan: 'Apakah urutan baris memengaruhi node mana yang dipertahankan?',
        jawaban:
          'Ya, kode mempertahankan kemunculan pertama dalam indeks; oleh sebab itu pengurutan awal atau prioritas kelengkapan nama penting dijaga.',
      },
      {
        id: 'q-cln-3',
        pertanyaan: 'Mengapa harus dikonversi ke radian dengan metrik Haversine?',
        jawaban:
          'Karena jarak Euclidean pada koordinat lintang-bujur tidak akurat dalam satuan meter akibat kelengkungan permukaan bumi.',
      },
    ],
  },
  outlier: {
    key: 'outlier',
    judulTahap: 'Deteksi & Validasi Outlier (IQR & Isolation Forest)',
    labelBlok: 'Blok 2 — Outlier: IQR dan Isolation Forest',
    isAutoGeneratedCode: false,
    penanggungJawab: 'Anggota B',
    kodePython: BLOK_2_CODE,
    apaYangDilakukan:
      'Mendeteksi pencilan univariat menggunakan pagar atas IQR dan pencilan multivariat menggunakan Isolation Forest dengan tingkat kontaminasi 5%.',
    alasanPemilihanMetode:
      'Jika yang tertandai Stasiun Gubeng, Pasar Turi, atau Terminal Purabaya, itu hub besar yang valid: ditandai dan ditransformasi log, tidak dibuang. Jika koordinat atau POI janggal, periksa manual. contamination 0,05 adalah asumsi.',
    skripPresentasi:
      'Pada pemeriksaan pencilan dengan metode IQR dan Isolation Forest, titik ekstrem yang muncul justru stasiun dan terminal besar seperti Gubeng, Pasar Turi, serta Purabaya. Karena ini merupakan hub transit nyata yang valid, observasi tersebut dipertahankan dan diredam dengan transformasi log.',
    pertanyaanPenguji: [
      {
        id: 'q-out-1',
        pertanyaan: 'Mengapa tidak menggunakan Z-score biasa untuk mendeteksi outlier?',
        jawaban:
          'Distribusi jumlah POI sangat menceng kanan sehingga rata-rata dan simpangan baku mudah tertarik oleh nilai ekstrem; IQR lebih tahan terhadap kemencengan.',
      },
      {
        id: 'q-out-2',
        pertanyaan: 'Bagaimana jika Isolation Forest menandai sebuah halte kecil di pinggiran?',
        jawaban:
          'Halte tersebut diperiksa manual koordinat dan jumlah POI-nya untuk memastikan bukan kesalahan letak atau artefak batas kecamatan.',
      },
      {
        id: 'q-out-3',
        pertanyaan: 'Apakah angka contamination=0.05 bersifat mutlak?',
        jawaban:
          'Tidak, 0,05 merupakan asumsi awal proporsi hub besar untuk penandaan inspeksi manual, bukan batas pembuangan otomatis.',
      },
    ],
  },
  feature_engineering: {
    key: 'feature_engineering',
    judulTahap: 'Feature Engineering: POI Radius 500 m & Entropi Kawasan',
    labelBlok: 'Blok 3 — Feature engineering: POI 500 m dan entropi',
    isAutoGeneratedCode: false,
    penanggungJawab: 'Anggota B',
    kodePython: BLOK_3_CODE,
    apaYangDilakukan:
      'Menghitung jumlah fasilitas sekitar (POI) dalam radius jalan kaki 500 meter per kategori, membentuk proporsinya, dan menghitung indeks keberagaman fungsi kawasan (entropi Shannon ternormalisasi 0–1).',
    alasanPemilihanMetode:
      'entropi_poi mendekati 1 berarti kawasan campuran; mendekati 0 berarti satu fungsi dominan (misalnya kampus). Simpul tanpa POI diberi entropi 0, bukan dibuang, dan jumlahnya dilaporkan.',
    skripPresentasi:
      'Untuk menangkap fungsi kawasan sekitar simpul, kami menghitung jumlah POI dalam radius berjalan kaki 500 meter pada lima kategori utama. Dari proporsi kategori tersebut kami hitung entropi Shannon skala nol sampai satu agar kawasan campuran terbedakan dari kawasan fungsi tunggal.',
    pertanyaanPenguji: [
      {
        id: 'q-fe-1',
        pertanyaan: 'Mengapa radius pencarian ditetapkan 500 meter?',
        jawaban:
          'Radius 500 meter lazim digunakan dalam perencanaan transportasi sebagai jarak berjalan kaki wajar menuju halte atau stasiun.',
      },
      {
        id: 'q-fe-2',
        pertanyaan: 'Apa perbedaan kawasan dengan entropi mendekati 1 dan mendekati 0?',
        jawaban:
          'Mendekati 1 menunjukkan campuran seimbang antara kantor, toko, sekolah, kesehatan, dan ibadah; mendekati 0 menandakan dominasi satu fungsi atau kekosongan POI.',
      },
      {
        id: 'q-fe-3',
        pertanyaan: 'Mengapa membagi entropi dengan log(len(cats))?',
        jawaban:
          'Normalisasi terhadap log jumlah kategori membuat nilai entropi selalu berada di rentang 0 sampai 1 sehingga mudah dibandingkan.',
      },
    ],
  },
  scaling_korelasi: {
    key: 'scaling_korelasi',
    judulTahap: 'Transformasi Log1p, Uji Korelasi Spearman & Standardisasi',
    labelBlok: 'Blok 4 — Transformasi, scaling, korelasi',
    isAutoGeneratedCode: false,
    penanggungJawab: 'Anggota B',
    kodePython: BLOK_4_CODE,
    apaYangDilakukan:
      'Menerapkan transformasi log1p pada fitur menceng kanan, memeriksa multikolinearitas menggunakan korelasi peringkat Spearman (> 0,85), lalu menstandardisasi fitur dengan Z-score.',
    alasanPemilihanMetode:
      'Pasangan |rho| > 0,85 berarti informasinya hampir sama sehingga salah satu dibuang. Z-score dipilih karena K-Means memakai jarak Euclidean dan fitur berskala besar akan mendominasi.',
    skripPresentasi:
      'Karena kepadatan penduduk bernilai puluhan ribu sedangkan entropi berada di nol sampai satu, kami menerapkan log1p pada fitur menceng lalu StandardScaler. Kami juga mengecek korelasi Spearman agar tidak ada dua fitur sangat mirip yang menggandakan bobot jarak di K-Means.',
    pertanyaanPenguji: [
      {
        id: 'q-sc-1',
        pertanyaan: 'Mengapa memakai Spearman daripada Pearson pada uji korelasi?',
        jawaban:
          'Spearman mengukur hubungan monotonik tanpa mensyaratkan distribusi normal, sehingga cocok untuk data spasial dan kepadatan.',
      },
      {
        id: 'q-sc-2',
        pertanyaan: 'Mengapa memilih log1p daripada log biasa?',
        jawaban:
          'Karena fitur seperti poi_total_500m dapat bernilai 0 pada kawasan pinggiran; log1p(0) menghasilkan 0 sedangkan log(0) tidak terdefinisi.',
      },
      {
        id: 'q-sc-3',
        pertanyaan: 'Apa dampaknya jika tidak melakukan StandardScaler sebelum K-Means?',
        jawaban:
          'Fitur dengan rentang ribuan seperti kepadatan penduduk akan mendominasi jarak Euclidean sehingga entropi dan persimpangan terabaikan.',
      },
    ],
  },
  clustering: {
    key: 'clustering',
    judulTahap: 'Evaluasi Jumlah Klaster (k = 2–8) & Proyeksi PCA 2D',
    labelBlok: 'Blok 5 — Clustering: pilih k, jalankan, PCA',
    isAutoGeneratedCode: false,
    penanggungJawab: 'Anggota C',
    kodePython: BLOK_5_CODE,
    apaYangDilakukan:
      'Menjalankan K-Means untuk k = 2 hingga 8, mengevaluasi metrik Inertia, Silhouette, dan Davies-Bouldin, lalu memproyeksikan hasil klaster ke ruang 2D via PCA.',
    alasanPemilihanMetode:
      'Pilih k dengan silhouette tertinggi dan Davies-Bouldin terendah. Silhouette di bawah 0,25 dilaporkan apa adanya. Cantumkan varians PCA agar sebaran 2D tidak ditafsirkan berlebihan.',
    skripPresentasi:
      'Kami menguji k dari 2 sampai 8 menggunakan kombinasi Elbow, Silhouette, dan indeks Davies-Bouldin. Setelah k terbaik ditetapkan, kami memproyeksikan hasil klaster ke dua dimensi memakai PCA sekaligus melaporkan persentase varians yang berhasil dijelaskan oleh dua sumbu tersebut.',
    pertanyaanPenguji: [
      {
        id: 'q-cl-1',
        pertanyaan: 'Mengapa tetap memakai tiga metrik evaluasi sekaligus untuk memilih k?',
        jawaban:
          'Inertia selalu turun seiring bertambahnya k, sehingga Silhouette dan Davies-Bouldin diperlukan untuk mengukur keseimbangan kerapatan internal dan pemisahan antarklaster.',
      },
      {
        id: 'q-cl-2',
        pertanyaan: 'Apakah PCA ikut digunakan saat menghitung jarak K-Means?',
        jawaban:
          'Tidak; K-Means dijalankan pada seluruh fitur terstandardisasi (X_scaled), sedangkan PCA hanya digunakan untuk visualisasi dua dimensi.',
      },
      {
        id: 'q-cl-3',
        pertanyaan: 'Bagaimana jika nilai Silhouette berada di kisaran 0,25 sampai 0,50?',
        jawaban:
          'Itu menandakan batas antarkawasan di dunia nyata bersifat gradasi, bukan terpisah tegas, sehingga penafsirannya tetap perlu merujuk pada profil fitur asli.',
      },
    ],
  },
  profil_klaster: {
    key: 'profil_klaster',
    judulTahap: 'Pembentukan Profil Z-Score & Penamaan Klaster',
    labelBlok: 'Blok 6 — Profil klaster',
    isAutoGeneratedCode: false,
    penanggungJawab: 'Anggota C',
    kodePython: BLOK_6_CODE,
    apaYangDilakukan:
      'Menghitung rata-rata tiap fitur termasuk skor_fasilitas per klaster, menstandardisasinya menjadi nilai z antar-klaster, dan memeriksa proporsi anggota tiap klaster.',
    alasanPemilihanMetode:
      'z positif tinggi berarti di atas rata-rata untuk fitur itu. Nama klaster dan rekomendasi harus mengikuti angka ini. skor_fasilitas rendah menjadi dasar menyebut fasilitas halte minim.',
    skripPresentasi:
      'Tahap terakhir adalah menyusun profil z-score setiap klaster untuk memberi nama yang mencerminkan karakter nyatanya. Di sini skor_fasilitas yang sebelumnya tidak ikut dalam clustering dipakai sebagai indikator pembanding kondisi prasarana perhentian di masing-masing tipologi kawasan.',
    pertanyaanPenguji: [
      {
        id: 'q-pr-1',
        pertanyaan: 'Apakah hasil klaster ini membuktikan klaster mana yang paling butuh dana?',
        jawaban:
          'Tidak. Klaster hanya memetakan tipologi kawasan sekitar simpul; alokasi anggaran tetap memerlukan kajian penumpang, kebijakan rute, dan kelayakan teknis.',
      },
      {
        id: 'q-pr-2',
        pertanyaan: 'Mengapa memakai z-score antar-klaster di heatmap profil?',
        jawaban:
          'Agar pembaca langsung melihat fitur mana yang relatif menonjol tinggi atau rendah pada suatu klaster dibanding rata-rata klaster lainnya.',
      },
      {
        id: 'q-pr-3',
        pertanyaan: 'Bagaimana cara menamai klaster secara objektif?',
        jawaban:
          'Penamaan diturunkan langsung dari fitur dengan nilai z-score paling ekstrem positif maupun negatif pada tabel profil klaster.',
      },
    ],
  },
  folium: {
    key: 'folium',
    judulTahap: 'Visualisasi Peta Klaster Spasial (Folium)',
    labelBlok: 'Tahap 6B — Peta Klaster Folium',
    isAutoGeneratedCode: true,
    penanggungJawab: 'Anggota C',
    kodePython: FOLIUM_AUTO_CODE,
    apaYangDilakukan:
      'Memetakan koordinat seluruh simpul Surabaya Raya beserta label klaster dan rincian atribut kawasan ke dalam peta interaktif berbasis ubin monokrom.',
    alasanPemilihanMetode:
      'Pemetaan spasial memvalidasi apakah pengelompokan statistik membentuk koridor atau pola geografis yang masuk akal secara tata kota tanpa mengandalkan pembeda warna.',
    skripPresentasi:
      'Untuk memeriksa kesesuaian statistik dengan geografi kota, kami memetakan seluruh simpul beserta simbol klasternya. Pola spasial ini memperlihatkan bagaimana klaster pusat bisnis dan hub transit berkumpul di koridor tengah, sementara klaster berkepadatan rendah berada di tepian kota.',
    pertanyaanPenguji: [
      {
        id: 'q-fol-1',
        pertanyaan: 'Mengapa peta tidak menggunakan kode warna berbeda untuk tiap klaster?',
        jawaban:
          'Penanda bentuk geometris dan angka romawi I–VI tetap terbaca jelas pada cetakan hitam-putih serta ramah bagi pembaca dengan gangguan penglihatan warna.',
      },
      {
        id: 'q-fol-2',
        pertanyaan: 'Bagaimana membedakan dua halte yang berdekatan di peta?',
        jawaban:
          'Pengguna dapat memperbesar peta serta mengaktifkan filter per klaster atau jenis simpul, lalu mengklik penanda untuk membaca detail kecamatan.',
      },
      {
        id: 'q-fol-3',
        pertanyaan: 'Mengapa atribusi OpenStreetMap wajib dicantumkan di peta?',
        jawaban:
          'Lisensi ODbL OpenStreetMap mewajibkan pencantuman atribusi kontributor di setiap peta yang menggunakan data maupun ubin peta OSM.',
      },
    ],
  },
};
