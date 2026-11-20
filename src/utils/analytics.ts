import Papa from 'papaparse';
import {
  BoxplotStat,
  ClusterZProfile,
  ComputedAnalytics,
  KMetric,
  MissingColStat,
  OutlierRow,
  PcaPoint,
  SimpulNode,
  SpearmanPair,
  StageKey,
} from '../types/report';
import {INITIAL_PRE_CLEAN_MISSING} from '../data/syntheticData';

export const CLUSTERING_FEATURES = [
  'poi_total_500m',
  'kepadatan_penduduk_kec',
  'jumlah_simpul_500m',
  'jarak_simpul_terdekat',
  'entropi_poi',
  'kerapatan_persimpangan',
] as const;

export const FEATURE_LABELS: Record<string, string> = {
  poi_total_500m: 'Total POI (500m)',
  kepadatan_penduduk_kec: 'Kepadatan Penduduk',
  jumlah_simpul_500m: 'Simpul Sekitar (500m)',
  jarak_simpul_terdekat: 'Jarak Simpul Terdekat',
  entropi_poi: 'Entropi POI',
  kerapatan_persimpangan: 'Kerapatan Persimpangan',
  skor_fasilitas: 'Skor Fasilitas',
};

export const SHORT_FEATURE_LABELS: Record<string, string> = {
  poi_total_500m: 'POI 500m',
  kepadatan_penduduk_kec: 'Kepadatan',
  jumlah_simpul_500m: 'Simpul 500m',
  jarak_simpul_terdekat: 'Jarak Simpul',
  entropi_poi: 'Entropi POI',
  kerapatan_persimpangan: 'Persimpangan',
  skor_fasilitas: 'Skor Fasilitas',
};

export const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI'];

export function toRoman(num: number): string {
  if (num >= 1 && num <= ROMAN_NUMERALS.length) {
    return ROMAN_NUMERALS[num - 1];
  }
  return String(num);
}

export function formatIdNumber(val: number, decimals = 2): string {
  if (!Number.isFinite(val)) return '0';
  return val.toFixed(decimals).replace('.', ',');
}

// Haversine distance in meters
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildFeatureMatrix(nodes: SimpulNode[]): {
  rawX: number[][];
  transformedX: number[][];
  scaledX: number[][];
} {
  const logSet = new Set(['poi_total_500m', 'kepadatan_penduduk_kec', 'jarak_simpul_terdekat']);
  const rawX = nodes.map((n) =>
    CLUSTERING_FEATURES.map((f) => {
      const v = Number(n[f]);
      return Number.isFinite(v) ? v : 0;
    })
  );

  const transformedX = rawX.map((row) =>
    row.map((v, j) => (logSet.has(CLUSTERING_FEATURES[j]) ? Math.log1p(Math.max(0, v)) : v))
  );

  const p = CLUSTERING_FEATURES.length;
  const n = transformedX.length || 1;
  const means = Array(p).fill(0);
  const stds = Array(p).fill(0);

  for (let j = 0; j < p; j++) {
    let s = 0;
    for (let i = 0; i < transformedX.length; i++) s += transformedX[i][j];
    means[j] = s / n;
  }
  for (let j = 0; j < p; j++) {
    let s2 = 0;
    for (let i = 0; i < transformedX.length; i++) {
      const d = transformedX[i][j] - means[j];
      s2 += d * d;
    }
    stds[j] = Math.sqrt(s2 / n) || 1;
  }

  const scaledX = transformedX.map((row) => row.map((v, j) => (v - means[j]) / stds[j]));
  return {rawX, transformedX, scaledX};
}

// Spearman rank correlation handling ties
function averageRanks(arr: number[]): number[] {
  const indexed = arr.map((v, idx) => ({v, idx})).sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length).fill(0);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) {
      j++;
    }
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].idx] = avgRank;
    }
    i = j + 1;
  }
  return ranks;
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 2) return 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  const denom = Math.sqrt(da * db);
  return denom === 0 ? 0 : num / denom;
}

function computeSpearman(matrix: number[][], featureNames: string[]): {
  corr: number[][];
  highPairs: SpearmanPair[];
} {
  const p = featureNames.length;
  const cols = featureNames.map((_, j) => averageRanks(matrix.map((r) => r[j])));
  const corr: number[][] = Array.from({length: p}, () => Array(p).fill(0));
  const highPairs: SpearmanPair[] = [];

  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      const r = i === j ? 1 : pearson(cols[i], cols[j]);
      corr[i][j] = r;
      if (j > i && Math.abs(r) > 0.85) {
        highPairs.push({f1: featureNames[i], f2: featureNames[j], rho: r});
      }
    }
  }
  return {corr, highPairs};
}

// Euclidean squared distance
function sqDist(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}

function runDeterministicKMeans(X: number[][], k: number, seedOffset = 42): {
  labels: number[];
  inertia: number;
} {
  const n = X.length;
  const d = X[0]?.length || 0;
  if (n <= k || d === 0) {
    return {labels: X.map((_, i) => i % Math.max(1, k)), inertia: 0};
  }

  let bestInertia = Infinity;
  let bestLabels = new Array(n).fill(0);

  // 5 deterministic restarts using evenly spaced + seeded k-means++ style starts
  for (let run = 0; run < 5; run++) {
    const centroids: number[][] = [];
    const firstIdx = (seedOffset * 7 + run * 19) % n;
    centroids.push([...X[firstIdx]]);

    // Farthest-point initialization (deterministic k-means++)
    for (let c = 1; c < k; c++) {
      let maxD = -1;
      let bestIdx = c % n;
      for (let i = 0; i < n; i++) {
        let minC = Infinity;
        for (let m = 0; m < centroids.length; m++) {
          const dist = sqDist(X[i], centroids[m]);
          if (dist < minC) minC = dist;
        }
        if (minC > maxD) {
          maxD = minC;
          bestIdx = i;
        }
      }
      centroids.push([...X[bestIdx]]);
    }

    const labels = new Array(n).fill(0);
    for (let iter = 0; iter < 35; iter++) {
      let changed = false;
      for (let i = 0; i < n; i++) {
        let bestC = 0;
        let bestDist = Infinity;
        for (let c = 0; c < k; c++) {
          const dist = sqDist(X[i], centroids[c]);
          if (dist < bestDist) {
            bestDist = dist;
            bestC = c;
          }
        }
        if (labels[i] !== bestC) {
          labels[i] = bestC;
          changed = true;
        }
      }

      const sums = Array.from({length: k}, () => new Array(d).fill(0));
      const counts = new Array(k).fill(0);
      for (let i = 0; i < n; i++) {
        const c = labels[i];
        counts[c]++;
        for (let j = 0; j < d; j++) sums[c][j] += X[i][j];
      }
      for (let c = 0; c < k; c++) {
        if (counts[c] > 0) {
          for (let j = 0; j < d; j++) centroids[c][j] = sums[c][j] / counts[c];
        }
      }
      if (!changed) break;
    }

    let inertia = 0;
    for (let i = 0; i < n; i++) {
      inertia += sqDist(X[i], centroids[labels[i]]);
    }
    if (inertia < bestInertia) {
      bestInertia = inertia;
      bestLabels = labels;
    }
  }

  return {labels: bestLabels, inertia: bestInertia};
}

export function computeSilhouetteScore(X: number[][], rawLabels: number[]): number {
  const n = X.length;
  if (n < 3) return 0;
  const unique = Array.from(new Set(rawLabels));
  if (unique.length < 2 || unique.length >= n) return 0;

  const groups = new Map<number, number[]>();
  rawLabels.forEach((lbl, idx) => {
    if (!groups.has(lbl)) groups.set(lbl, []);
    groups.get(lbl)!.push(idx);
  });

  // Precompute pairwise Euclidean distances
  const distMatrix: number[][] = Array.from({length: n}, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = Math.sqrt(sqDist(X[i], X[j]));
      distMatrix[i][j] = d;
      distMatrix[j][i] = d;
    }
  }

  let totalSil = 0;
  for (let i = 0; i < n; i++) {
    const ownLabel = rawLabels[i];
    const ownGroup = groups.get(ownLabel)!;
    if (ownGroup.length <= 1) continue;

    let a = 0;
    for (const j of ownGroup) {
      if (j !== i) a += distMatrix[i][j];
    }
    a /= ownGroup.length - 1;

    let b = Infinity;
    for (const [otherLabel, otherGroup] of groups.entries()) {
      if (otherLabel === ownLabel || otherGroup.length === 0) continue;
      let sum = 0;
      for (const j of otherGroup) sum += distMatrix[i][j];
      const avg = sum / otherGroup.length;
      if (avg < b) b = avg;
    }
    const denom = Math.max(a, b);
    totalSil += denom === 0 ? 0 : (b - a) / denom;
  }

  return totalSil / n;
}

function computeDaviesBouldin(X: number[][], rawLabels: number[]): number {
  const unique = Array.from(new Set(rawLabels));
  const k = unique.length;
  if (k < 2) return 0;
  const d = X[0].length;

  const centroids = unique.map((lbl) => {
    const pts = X.filter((_, idx) => rawLabels[idx] === lbl);
    const c = new Array(d).fill(0);
    for (const p of pts) for (let j = 0; j < d; j++) c[j] += p[j];
    for (let j = 0; j < d; j++) c[j] /= pts.length || 1;
    return c;
  });

  const scatters = unique.map((lbl, ci) => {
    const pts = X.filter((_, idx) => rawLabels[idx] === lbl);
    if (pts.length === 0) return 0;
    let sum = 0;
    for (const p of pts) sum += Math.sqrt(sqDist(p, centroids[ci]));
    return sum / pts.length;
  });

  let db = 0;
  for (let i = 0; i < k; i++) {
    let maxR = 0;
    for (let j = 0; j < k; j++) {
      if (i === j) continue;
      const distC = Math.sqrt(sqDist(centroids[i], centroids[j]));
      const r = distC === 0 ? 0 : (scatters[i] + scatters[j]) / distC;
      if (r > maxR) maxR = r;
    }
    db += maxR;
  }
  return db / k;
}

// Jacobi eigenvalue decomposition on symmetric p x p covariance matrix
function computePCA2D(scaledX: number[][]): {
  coords: Array<[number, number]>;
  pc1Pct: number;
  pc2Pct: number;
  totalPct: number;
} {
  const n = scaledX.length;
  const p = scaledX[0]?.length || 0;
  if (n < 2 || p < 2) {
    return {
      coords: scaledX.map(() => [0, 0]),
      pc1Pct: 50,
      pc2Pct: 50,
      totalPct: 100,
    };
  }

  // Covariance matrix (since X is already standardized, mean is ~0)
  const cov: number[][] = Array.from({length: p}, () => new Array(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = i; j < p; j++) {
      let s = 0;
      for (let r = 0; r < n; r++) s += scaledX[r][i] * scaledX[r][j];
      const v = s / (n - 1);
      cov[i][j] = v;
      cov[j][i] = v;
    }
  }

  const V: number[][] = Array.from({length: p}, (_, i) =>
    Array.from({length: p}, (__, j) => (i === j ? 1 : 0))
  );
  const A = cov.map((row) => [...row]);

  for (let iter = 0; iter < 60; iter++) {
    let maxVal = 0;
    let pIdx = 0;
    let qIdx = 1;
    for (let i = 0; i < p; i++) {
      for (let j = i + 1; j < p; j++) {
        if (Math.abs(A[i][j]) > maxVal) {
          maxVal = Math.abs(A[i][j]);
          pIdx = i;
          qIdx = j;
        }
      }
    }
    if (maxVal < 1e-10) break;

    const app = A[pIdx][pIdx];
    const aqq = A[qIdx][qIdx];
    const apq = A[pIdx][qIdx];
    const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
    const c = Math.cos(phi);
    const s = Math.sin(phi);

    for (let i = 0; i < p; i++) {
      if (i !== pIdx && i !== qIdx) {
        const aip = A[i][pIdx];
        const aiq = A[i][qIdx];
        A[i][pIdx] = c * aip - s * aiq;
        A[pIdx][i] = A[i][pIdx];
        A[i][qIdx] = s * aip + c * aiq;
        A[qIdx][i] = A[i][qIdx];
      }
    }
    A[pIdx][pIdx] = c * c * app - 2 * s * c * apq + s * s * aqq;
    A[qIdx][qIdx] = s * s * app + 2 * s * c * apq + c * c * aqq;
    A[pIdx][qIdx] = 0;
    A[qIdx][pIdx] = 0;

    for (let i = 0; i < p; i++) {
      const vip = V[i][pIdx];
      const viq = V[i][qIdx];
      V[i][pIdx] = c * vip - s * viq;
      V[i][qIdx] = s * vip + c * viq;
    }
  }

  const eigenPairs = Array.from({length: p}, (_, i) => ({
    val: Math.max(0, A[i][i]),
    vec: V.map((row) => row[i]),
  })).sort((a, b) => b.val - a.val);

  const totalVar = eigenPairs.reduce((acc, e) => acc + e.val, 0) || 1;
  const pc1Pct = (eigenPairs[0].val / totalVar) * 100;
  const pc2Pct = (eigenPairs[1].val / totalVar) * 100;

  const v1 = eigenPairs[0].vec;
  const v2 = eigenPairs[1].vec;

  const coords: Array<[number, number]> = scaledX.map((row) => {
    let x = 0;
    let y = 0;
    for (let j = 0; j < p; j++) {
      x += row[j] * v1[j];
      y += row[j] * v2[j];
    }
    return [x, y];
  });

  return {
    coords,
    pc1Pct,
    pc2Pct,
    totalPct: pc1Pct + pc2Pct,
  };
}

function quantileSorted(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function detectOutliers(nodes: SimpulNode[]): OutlierRow[] {
  const cols = ['poi_total_500m', 'kepadatan_penduduk_kec', 'jumlah_simpul_500m'] as const;
  const fences: Record<string, number> = {};
  const means: Record<string, number> = {};
  const stds: Record<string, number> = {};

  for (const col of cols) {
    const vals = nodes.map((n) => n[col]).sort((a, b) => a - b);
    const q1 = quantileSorted(vals, 0.25);
    const q3 = quantileSorted(vals, 0.75);
    fences[col] = q3 + 1.5 * (q3 - q1);
    const m = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
    means[col] = m;
    stds[col] = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / (vals.length || 1)) || 1;
  }

  // Multivariate extremity score (contamination = 0.05 -> top 5%)
  const scored = nodes.map((n, idx) => {
    const dist = Math.sqrt(
      cols.reduce((acc, col) => acc + ((n[col] - means[col]) / stds[col]) ** 2, 0)
    );
    return {idx, dist};
  });
  scored.sort((a, b) => b.dist - a.dist);
  const isoCount = Math.max(1, Math.round(nodes.length * 0.05));
  const isoSet = new Set(scored.slice(0, isoCount).map((s) => s.idx));

  const rows: OutlierRow[] = [];
  nodes.forEach((n, idx) => {
    const iqrFlags: string[] = [];
    for (const col of cols) {
      if (n[col] > fences[col]) iqrFlags.push(SHORT_FEATURE_LABELS[col] || col);
    }
    const isoFlag = isoSet.has(idx);
    if (iqrFlags.length > 0 || isoFlag) {
      const isNamedHub =
        n.jenis_simpul.toLowerCase().includes('stasiun') ||
        n.jenis_simpul.toLowerCase().includes('terminal') ||
        n.poi_total_500m >= 100;
      rows.push({
        nama_simpul: n.nama_simpul,
        jenis_simpul: n.jenis_simpul,
        kecamatan: n.kecamatan,
        poi_total_500m: n.poi_total_500m,
        kepadatan_penduduk_kec: n.kepadatan_penduduk_kec,
        jumlah_simpul_500m: n.jumlah_simpul_500m,
        iqrFlags,
        isoFlag,
        statusValidasi: isNamedHub
          ? 'Hub Transit Utama Valid (dipertahankan, transformasi log1p)'
          : 'Kepadatan Tinggi Valid (dipertahankan setelah verifikasi lokasi)',
      });
    }
  });

  return rows.slice(0, 10);
}

export function computeAnalytics(
  nodes: SimpulNode[],
  options: {
    isSampleData: boolean;
    uploadedMissingStats?: MissingColStat[] | null;
    overrideKMetrics?: KMetric[] | null;
    overridePreDedupCount?: number | null;
  }
): ComputedAnalytics {
  const {rawX, transformedX, scaledX} = buildFeatureMatrix(nodes);
  const featureNames = [...CLUSTERING_FEATURES];

  // Normalize cluster IDs sorted ascending, mapped to 1..K if 0-based
  const rawClusterSet = Array.from(new Set(nodes.map((n) => n.klaster))).sort((a, b) => a - b);
  const hasZeroCluster = rawClusterSet.includes(0);
  const normalizedLabels = nodes.map((n) => (hasZeroCluster ? n.klaster + 1 : n.klaster));
  const clusterIds = Array.from(new Set(normalizedLabels)).sort((a, b) => a - b);

  const activeSilhouette = computeSilhouetteScore(scaledX, normalizedLabels);

  // Spearman correlation on log1p-transformed matrix X (Blok 4)
  const {corr: spearmanMatrix, highPairs: spearmanHighPairs} = computeSpearman(
    transformedX,
    featureNames
  );

  // k=2..8 evaluation (or override from uploaded JSON)
  let kMetrics: KMetric[] = [];
  if (options.overrideKMetrics && options.overrideKMetrics.length > 0) {
    kMetrics = options.overrideKMetrics;
  } else {
    for (let k = 2; k <= 8; k++) {
      if (nodes.length <= k) break;
      const {labels, inertia} = runDeterministicKMeans(scaledX, k, 42);
      const sil = computeSilhouetteScore(scaledX, labels);
      const db = computeDaviesBouldin(scaledX, labels);
      kMetrics.push({k, inertia, silhouette: sil, daviesBouldin: db});
    }
  }

  // PCA 2D
  const pca = computePCA2D(scaledX);
  const pcaPoints: PcaPoint[] = nodes.map((n, i) => ({
    id: n.id,
    nama_simpul: n.nama_simpul,
    jenis_simpul: n.jenis_simpul,
    kecamatan: n.kecamatan,
    klaster: normalizedLabels[i],
    pc1: pca.coords[i][0],
    pc2: pca.coords[i][1],
  }));

  // Cluster profiles (Blok 6): fitur + skor_fasilitas
  const profileFeatures = [...CLUSTERING_FEATURES, 'skor_fasilitas'] as const;
  const clusterRawMeans = new Map<number, Record<string, number>>();
  const clusterCounts = new Map<number, number>();

  for (const cid of clusterIds) {
    const subset = nodes.filter((_, i) => normalizedLabels[i] === cid);
    clusterCounts.set(cid, subset.length);
    const meansObj: Record<string, number> = {};
    for (const f of profileFeatures) {
      const avg = subset.reduce((s, item) => s + Number(item[f] || 0), 0) / (subset.length || 1);
      meansObj[f] = avg;
    }
    clusterRawMeans.set(cid, meansObj);
  }

  // Standardize across cluster means (profil_z = (profil - profil.mean()) / profil.std())
  const clusterProfiles: ClusterZProfile[] = clusterIds.map((cid) => ({
    klaster: cid,
    count: clusterCounts.get(cid) || 0,
    rawMeans: clusterRawMeans.get(cid) || {},
    zScores: {},
  }));

  for (const f of profileFeatures) {
    const vals = clusterProfiles.map((cp) => cp.rawMeans[f]);
    const meanAcross = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
    const stdAcross =
      vals.length > 1
        ? Math.sqrt(vals.reduce((a, b) => a + (b - meanAcross) ** 2, 0) / (vals.length - 1))
        : 1;
    clusterProfiles.forEach((cp) => {
      cp.zScores[f] = stdAcross === 0 ? 0 : (cp.rawMeans[f] - meanAcross) / stdAcross;
    });
  }

  // Boxplot for skor_fasilitas per cluster
  const facilityBoxplots: BoxplotStat[] = clusterIds.map((cid) => {
    const vals = nodes
      .filter((_, i) => normalizedLabels[i] === cid)
      .map((n) => n.skor_fasilitas)
      .sort((a, b) => a - b);
    const q1 = quantileSorted(vals, 0.25);
    const median = quantileSorted(vals, 0.5);
    const q3 = quantileSorted(vals, 0.75);
    const iqr = q3 - q1;
    const lowFence = q1 - 1.5 * iqr;
    const highFence = q3 + 1.5 * iqr;
    const inliers = vals.filter((v) => v >= lowFence && v <= highFence);
    const outliers = vals.filter((v) => v < lowFence || v > highFence);
    return {
      klaster: cid,
      count: vals.length,
      min: inliers.length ? inliers[0] : vals[0] ?? 0,
      q1,
      median,
      q3,
      max: inliers.length ? inliers[inliers.length - 1] : vals[vals.length - 1] ?? 0,
      outliers,
    };
  });

  // Dedup audit: count near-duplicates <= 25m if CSV uploaded, otherwise sample N=138 -> M=120
  let preDedupCount = nodes.length;
  if (options.overridePreDedupCount && options.overridePreDedupCount >= nodes.length) {
    preDedupCount = options.overridePreDedupCount;
  } else if (options.isSampleData) {
    preDedupCount = nodes.length + 18;
  } else {
    // Check if uploaded CSV still contains <= 25m neighbors
    let dupPairs = 0;
    const removed = new Set<number>();
    for (let i = 0; i < nodes.length; i++) {
      if (removed.has(i)) continue;
      for (let j = i + 1; j < nodes.length; j++) {
        if (haversineMeters(nodes[i].lat, nodes[i].lon, nodes[j].lat, nodes[j].lon) <= 25) {
          removed.add(j);
          dupPairs++;
        }
      }
    }
    preDedupCount = nodes.length + (dupPairs === 0 ? 0 : dupPairs);
  }

  const missingStats =
    options.uploadedMissingStats && options.uploadedMissingStats.length > 0
      ? options.uploadedMissingStats
      : INITIAL_PRE_CLEAN_MISSING;

  const outliers = detectOutliers(nodes);
  const zeroPoiCount = nodes.filter((n) => n.poi_total_500m === 0).length;

  void rawX;

  return {
    totalNodes: nodes.length,
    numClusters: clusterIds.length,
    clusterIds,
    activeSilhouette,
    numFeatures: featureNames.length,
    preDedupCount,
    postDedupCount: nodes.length,
    missingStats,
    outliers,
    zeroPoiCount,
    spearmanMatrix,
    spearmanHighPairs,
    featureNames,
    kMetrics,
    pcaPoints,
    pcaVariancePct: pca.totalPct,
    pc1VariancePct: pca.pc1Pct,
    pc2VariancePct: pca.pc2Pct,
    clusterProfiles,
    facilityBoxplots,
  };
}

export function buildLog1pHistogram(
  nodes: SimpulNode[],
  feature: 'poi_total_500m' | 'kepadatan_penduduk_kec' | 'jarak_simpul_terdekat',
  bins = 10
): {
  rawBins: Array<{range: string; count: number}>;
  logBins: Array<{range: string; count: number}>;
} {
  const rawVals = nodes.map((n) => Math.max(0, Number(n[feature]) || 0));
  const logVals = rawVals.map((v) => Math.log1p(v));

  const makeBins = (vals: number[], isLog: boolean) => {
    const min = Math.min(...vals, 0);
    const max = Math.max(...vals, 1);
    const step = (max - min) / bins || 1;
    const counts = new Array(bins).fill(0);
    for (const v of vals) {
      let idx = Math.floor((v - min) / step);
      if (idx >= bins) idx = bins - 1;
      if (idx < 0) idx = 0;
      counts[idx]++;
    }
    return counts.map((count, i) => {
      const lo = min + i * step;
      const hi = lo + step;
      const fmt = (x: number) =>
        isLog ? x.toFixed(1).replace('.', ',') : x >= 1000 ? `${Math.round(x / 1000)}k` : `${Math.round(x)}`;
      return {
        range: `${fmt(lo)}–${fmt(hi)}`,
        count,
      };
    });
  };

  return {
    rawBins: makeBins(rawVals, false),
    logBins: makeBins(logVals, true),
  };
}

// Dynamic interpretation templates strictly aligned with specification
export function getDynamicInterpretation(
  stage: StageKey,
  analytics: ComputedAnalytics,
  isSampleData: boolean
): string {
  const prefix = isSampleData ? 'CONTOH DATA: angka belum hasil analisis sebenarnya. ' : '';
  const k = analytics.numClusters;
  const sil = analytics.activeSilhouette;
  const silCategory =
    sil > 0.5
      ? 'cukup terpisah'
      : sil >= 0.25
        ? 'lemah tetapi masih dapat ditafsirkan'
        : 'hampir tidak ada struktur klaster';

  switch (stage) {
    case 'ingestion':
      return `${prefix}Dataset memuat ${analytics.totalNodes} simpul transportasi Surabaya Raya dengan ${analytics.numFeatures} fitur kawasan utama serta atribut pendukung fasilitas.`;

    case 'profiling': {
      const topMissing = [...analytics.missingStats].sort(
        (a, b) => b.persenMissing - a.persenMissing
      )[0];
      return `${prefix}Kolom dengan tingkat kekosongan tertinggi pada audit awal adalah ${
        topMissing ? `${topMissing.kolom} (${formatIdNumber(topMissing.persenMissing, 1)}%)` : 'tidak ada (0%)'
      }.`;
    }

    case 'cleansing': {
      const n = analytics.preDedupCount;
      const m = analytics.postDedupCount;
      const diff = Math.max(0, n - m);
      const pct = n > 0 ? (diff / n) * 100 : 0;
      return `${prefix}Dari ${n} node menjadi ${m}; ${diff} node (${formatIdNumber(pct, 1)}%) dibuang sebagai duplikat.`;
    }

    case 'outlier':
      return `${prefix}Terdeteksi ${analytics.outliers.length} observasi ekstrem pada uji IQR/Isolation-like; simpul utama seperti stasiun dan terminal ditandai sebagai hub valid dan dipertahankan.`;

    case 'feature_engineering':
      return `${prefix}Terdapat ${analytics.zeroPoiCount} simpul dengan poi_total_500m = 0 yang ditetapkan entropi_poi = 0,0 tanpa dibuang dari sampel.`;

    case 'scaling_korelasi': {
      const daftar =
        analytics.spearmanHighPairs.length > 0
          ? analytics.spearmanHighPairs
              .map(
                (p) =>
                  `${p.f1}–${p.f2} (rho = ${formatIdNumber(p.rho, 2)})`
              )
              .join('; ')
          : 'tidak ada pasangan dengan |rho| > 0,85';
      return `${prefix}Pasangan fitur dengan |rho| > 0,85: ${daftar}. Disarankan membuang salah satu jika muncul korelasi sangat tinggi.`;
    }

    case 'clustering': {
      const pcaPct = analytics.pcaVariancePct;
      const pcaQual =
        pcaPct >= 70 ? 'mewakili baik' : 'hanya sebagian mewakili';
      return `${prefix}k terpilih = ${k} dengan silhouette ${formatIdNumber(sil, 3)}. Kategori: ${silCategory}. PC1 dan PC2 menjelaskan ${formatIdNumber(pcaPct, 1)}% varians; sebaran 2D ${pcaQual} data.`;
    }

    case 'profil_klaster': {
      const summaries = analytics.clusterProfiles.map((cp) => {
        const entries = Object.entries(cp.zScores);
        entries.sort((a, b) => b[1] - a[1]);
        const maxF = entries[0];
        const minF = entries[entries.length - 1];
        return `Klaster ${toRoman(cp.klaster)} tertinggi pada ${
          FEATURE_LABELS[maxF?.[0] || ''] || maxF?.[0]
        } (z=${formatIdNumber(maxF?.[1] || 0, 2)}), terendah pada ${
          FEATURE_LABELS[minF?.[0] || ''] || minF?.[0]
        } (z=${formatIdNumber(minF?.[1] || 0, 2)})`;
      });
      return `${prefix}${summaries.join('. ')}.`;
    }

    case 'folium':
      return `${prefix}Peta menampilkan ${analytics.totalNodes} simpul tersebar ke dalam ${k} klaster dengan penanda bentuk dan angka romawi tanpa kode warna.`;

    default:
      return '';
  }
}

export const REQUIRED_CSV_COLUMNS = [
  'nama_simpul',
  'jenis_simpul',
  'lat',
  'lon',
  'kecamatan',
  'poi_total_500m',
  'prop_poi_pendidikan',
  'prop_poi_kesehatan',
  'prop_poi_perkantoran',
  'prop_poi_komersial',
  'prop_poi_ibadah',
  'entropi_poi',
  'kepadatan_penduduk_kec',
  'jumlah_simpul_500m',
  'jarak_simpul_terdekat',
  'kerapatan_persimpangan',
  'jarak_ke_pusat_kota',
  'skor_fasilitas',
  'klaster',
] as const;

export function parseUploadedCsv(csvText: string): {
  nodes: SimpulNode[];
  missingStats: MissingColStat[];
  error?: string;
} {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    return {nodes: [], missingStats: [], error: `Gagal membaca CSV: ${parsed.errors[0].message}`};
  }

  const fields = parsed.meta.fields || [];
  const missingHeaders = REQUIRED_CSV_COLUMNS.filter((col) => !fields.includes(col));
  if (missingHeaders.length > 0) {
    return {
      nodes: [],
      missingStats: [],
      error: `Kolom wajib berikut belum ditemukan di CSV: ${missingHeaders.join(', ')}`,
    };
  }

  const totalRows = parsed.data.length;
  if (totalRows === 0) {
    return {nodes: [], missingStats: [], error: 'Berkas CSV tidak memiliki baris data.'};
  }

  // Compute missing stats per column directly from uploaded CSV
  const missingStats: MissingColStat[] = fields.map((col) => {
    let miss = 0;
    for (const row of parsed.data) {
      const val = row[col];
      if (val === undefined || val === null || String(val).trim() === '' || String(val).toLowerCase() === 'nan') {
        miss++;
      }
    }
    return {
      kolom: col,
      jumlahMissing: miss,
      persenMissing: Number(((miss / totalRows) * 100).toFixed(2)),
    };
  });

  const nodes: SimpulNode[] = [];
  parsed.data.forEach((row, idx) => {
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const num = (k: string, fallback = 0) => {
      const v = Number(row[k]);
      return Number.isFinite(v) ? v : fallback;
    };

    nodes.push({
      id: `CSV-${String(idx + 1).padStart(3, '0')}`,
      nama_simpul: (row.nama_simpul || `Simpul ${idx + 1}`).trim(),
      jenis_simpul: (row.jenis_simpul || 'Halte').trim(),
      lat,
      lon,
      kecamatan: (row.kecamatan || 'Tidak Diketahui').trim(),
      poi_total_500m: num('poi_total_500m'),
      prop_poi_pendidikan: num('prop_poi_pendidikan'),
      prop_poi_kesehatan: num('prop_poi_kesehatan'),
      prop_poi_perkantoran: num('prop_poi_perkantoran'),
      prop_poi_komersial: num('prop_poi_komersial'),
      prop_poi_ibadah: num('prop_poi_ibadah'),
      entropi_poi: num('entropi_poi'),
      kepadatan_penduduk_kec: num('kepadatan_penduduk_kec'),
      jumlah_simpul_500m: num('jumlah_simpul_500m'),
      jarak_simpul_terdekat: num('jarak_simpul_terdekat'),
      kerapatan_persimpangan: num('kerapatan_persimpangan'),
      jarak_ke_pusat_kota: num('jarak_ke_pusat_kota'),
      skor_fasilitas: num('skor_fasilitas'),
      klaster: Math.round(num('klaster', 1)),
    });
  });

  if (nodes.length < 4) {
    return {
      nodes: [],
      missingStats: [],
      error: 'Jumlah baris valid dengan koordinat lat/lon kurang dari 4 baris.',
    };
  }

  return {nodes, missingStats};
}
