import { Student, Vehicle } from "./types";

interface Point {
  lat: number;
  lng: number;
}

// ---------------------------------------------------------------------------
// Sabitler (MVP — öneri dokümanıyla uyumlu)
// ---------------------------------------------------------------------------

const OUTLIER_KM = 30;
const REBALANCE_COST_RATIO = 1.3;
const REBALANCE_MAX_ITER = 10;
const COST_WEIGHT_DISTANCE = 0.7;
const COST_WEIGHT_STOPS = 0.3;
const LNG_SCALE = 1.3;

function haversineDistance(a: Point, b: Point): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng *
      sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Şehir içi davranışı biraz daha iyi taklit eden tutarlı mesafe (API yok). */
function routeMetricDistance(a: Point, b: Point): number {
  return Math.abs(a.lat - b.lat) + Math.abs(a.lng - b.lng) * LNG_SCALE;
}

function centroid(points: Point[]): Point {
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

/** Okul merkezine göre sweep sıralaması (atan2). */
function sweepAngleFromSchool(school: Point, s: Student): number {
  return Math.atan2(s.lng - school.lng, s.lat - school.lat);
}

function tourLengthMetric(school: Point, order: Student[]): number {
  if (order.length === 0) return 0;
  let d = routeMetricDistance(school, order[0]);
  for (let i = 1; i < order.length; i++) {
    d += routeMetricDistance(order[i - 1], order[i]);
  }
  d += routeMetricDistance(order[order.length - 1], school);
  return d;
}

/** Araç önerisi tablosu için km cinsinden (mevcut UI). */
function tourLengthHaversineKm(school: Point, order: Student[]): number {
  if (order.length === 0) return 0;
  let d = haversineDistance(school, order[0]);
  for (let i = 1; i < order.length; i++) {
    d += haversineDistance(order[i - 1], order[i]);
  }
  d += haversineDistance(order[order.length - 1], school);
  return d;
}

function nearestNeighborOrder(students: Student[], school: Point): Student[] {
  if (students.length <= 1) return [...students];

  const remaining = [...students];
  const ordered: Student[] = [];
  let current: Point = school;

  while (remaining.length > 0) {
    let minDist = Infinity;
    let nearest = 0;
    for (let i = 0; i < remaining.length; i++) {
      const dist = routeMetricDistance(current, remaining[i]);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    }
    const next = remaining.splice(nearest, 1)[0];
    ordered.push(next);
    current = next;
  }

  return ordered;
}

/**
 * 2-opt: öğrenci sırası üzerinde komşu olmayan segment ters çevirerek iyileştir.
 */
function twoOptImproveOrder(school: Point, order: Student[]): Student[] {
  if (order.length < 4) return order;

  let best = order.slice();
  let bestLen = tourLengthMetric(school, best);
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 2; j < best.length; j++) {
        const next = best.slice();
        // reverse [i+1 .. j]
        let a = i + 1;
        let b = j;
        while (a < b) {
          const t = next[a];
          next[a] = next[b];
          next[b] = t;
          a++;
          b--;
        }
        const len = tourLengthMetric(school, next);
        if (len + 1e-9 < bestLen) {
          best = next;
          bestLen = len;
          improved = true;
        }
      }
    }
  }

  return best;
}

function optimizeClusterRoute(school: Point, cluster: Student[]): Student[] {
  if (cluster.length === 0) return [];
  const nn = nearestNeighborOrder(cluster, school);
  return twoOptImproveOrder(school, nn);
}

/**
 * Tek araçtaki durak kümesi için okul çıkışlı NN + 2-opt sıra.
 * (Öğrenci pasif / silindiğinde günlük dağıtımda yalnız bu aracın sırasını yenilemek için.)
 */
export function optimizeStopOrderFromSchool(
  school: { lat: number; lng: number },
  students: Student[],
): Student[] {
  return optimizeClusterRoute(school, students);
}

/** Eşit toplam böl — öğrenciler açısal sıraya göre ardışık bloklar. */
function sweepInitialClusters(sorted: Student[], k: number): Student[][] {
  const n = sorted.length;
  if (k <= 0) return [];
  if (k >= n) {
    return sorted.map((s) => [s]);
  }

  const clusters: Student[][] = Array.from({ length: k }, () => []);
  const base = Math.floor(n / k);
  const extra = n % k;
  let idx = 0;
  for (let c = 0; c < k; c++) {
    const size = base + (c < extra ? 1 : 0);
    for (let t = 0; t < size; t++) {
      clusters[c].push(sorted[idx++]);
    }
  }
  return clusters;
}

/**
 * Küme boyları (azalan) ile kapasiteler (azalan) eşleşebilir mi?
 */
function clustersFitCapacities(clusterSizes: number[], capacitiesDesc: number[]): boolean {
  const s = [...clusterSizes].sort((a, b) => b - a);
  const c = [...capacitiesDesc].sort((a, b) => b - a);
  for (let i = 0; i < s.length; i++) {
    if (s[i] > (c[i] ?? 0)) return false;
  }
  return true;
}

function clusterSizesOf(clusters: Student[][]): number[] {
  return clusters.map((cl) => cl.length);
}

/**
 * balancedKMeansCluster — kapasite uyumsuzluğunda geri dönüş.
 */
function balancedKMeansCluster(
  students: Student[],
  k: number,
  capacities: number[],
  maxIter = 25,
): Student[][] {
  if (students.length <= k) {
    return students.map((s) => [s]);
  }

  const n = students.length;
  const idealSize = Math.ceil(n / k);
  const balanceBuffer = Math.max(1, Math.floor(n * 0.2));

  const maxSizes = capacities.map((cap) => Math.min(cap, idealSize + balanceBuffer));

  const sorted = [...students].sort((a, b) => a.lat + a.lng - (b.lat + b.lng));
  const step = Math.floor(n / k);
  let centroids: Point[] = Array.from({ length: k }, (_, i) => ({
    lat: sorted[Math.min(i * step, n - 1)].lat,
    lng: sorted[Math.min(i * step, n - 1)].lng,
  }));

  let bestClusters: Student[][] = Array.from({ length: k }, () => []);

  for (let iter = 0; iter < maxIter; iter++) {
    const distMatrix: number[][] = students.map((s) => centroids.map((c) => haversineDistance(s, c)));

    const clusters: Student[][] = Array.from({ length: k }, () => []);
    const sizes = new Array(k).fill(0);

    const assignOrder = students
      .map((_, i) => {
        const dists = [...distMatrix[i]].sort((a, b) => a - b);
        return { i, gap: dists.length > 1 ? dists[1] - dists[0] : 0 };
      })
      .sort((a, b) => a.gap - b.gap);

    for (const { i } of assignOrder) {
      const prefs = centroids
        .map((_, ci) => ({ ci, dist: distMatrix[i][ci] }))
        .sort((a, b) => a.dist - b.dist);

      let placed = false;
      for (const { ci } of prefs) {
        if (sizes[ci] < maxSizes[ci]) {
          clusters[ci].push(students[i]);
          sizes[ci]++;
          placed = true;
          break;
        }
      }
      if (!placed) {
        const minIdx = sizes.indexOf(Math.min(...sizes));
        clusters[minIdx].push(students[i]);
        sizes[minIdx]++;
      }
    }

    bestClusters = clusters;

    const newCentroids = clusters.map((cl, i) => (cl.length > 0 ? centroid(cl) : centroids[i]));

    const moved = newCentroids.some((nc, i) => haversineDistance(nc, centroids[i]) > 0.001);
    centroids = newCentroids;
    if (!moved) break;
  }

  rebalanceClustersLegacy(bestClusters, maxSizes, centroids);

  return bestClusters;
}

function rebalanceClustersLegacy(
  clusters: Student[][],
  maxSizes: number[],
  centroids: Point[],
): void {
  const k = clusters.length;
  const total = clusters.reduce((sum, cl) => sum + cl.length, 0);
  const minSize = Math.floor(total / k);

  let changed = true;
  let safety = 0;
  while (changed && safety < 50) {
    changed = false;
    safety++;

    const largestIdx = clusters.reduce(
      (max, cl, i) => (cl.length > clusters[max].length ? i : max),
      0,
    );
    const smallestIdx = clusters.reduce(
      (min, cl, i) => (cl.length < clusters[min].length ? i : min),
      0,
    );

    if (clusters[largestIdx].length - clusters[smallestIdx].length <= 1) break;
    if (clusters[largestIdx].length <= minSize + 1) break;

    const targetCentroid = centroids[smallestIdx];
    let bestStudentIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < clusters[largestIdx].length; i++) {
      const dist = haversineDistance(clusters[largestIdx][i], targetCentroid);
      if (dist < bestDist) {
        bestDist = dist;
        bestStudentIdx = i;
      }
    }

    const [moved] = clusters[largestIdx].splice(bestStudentIdx, 1);
    clusters[smallestIdx].push(moved);
    changed = true;

    centroids[largestIdx] =
      clusters[largestIdx].length > 0 ? centroid(clusters[largestIdx]) : centroids[largestIdx];
    centroids[smallestIdx] = centroid(clusters[smallestIdx]);
  }
}

function normalizedClusterCosts(routeLens: number[], stopCounts: number[]): number[] {
  const k = routeLens.length;
  if (k === 0) return [];
  const avgLen = routeLens.reduce((a, b) => a + b, 0) / k || 1;
  const avgStops = stopCounts.reduce((a, b) => a + b, 0) / k || 1;
  return routeLens.map((len, i) => {
    const nd = len / avgLen;
    const ns = stopCounts[i] / avgStops;
    return nd * COST_WEIGHT_DISTANCE + ns * COST_WEIGHT_STOPS;
  });
}

function costImbalanceRatio(costs: number[]): number {
  const finite = costs.filter((c) => c > 0);
  if (finite.length < 2) return 1;
  return Math.max(...finite) / Math.min(...finite);
}

// ---------------------------------------------------------------------------
// Genel sonuç
// ---------------------------------------------------------------------------

export interface DistributionResult {
  assignments: { studentId: string; vehicleId: string; order: number }[];
  /** Uyarılar (ör. okuldan çok uzak koordinat); istemci/üst katman isteğe bağlı kullanır. */
  warnings?: string[];
}

export interface VehicleRecommendation {
  /** 1..N: kaç araçla denendi */
  vehicleCount: number;
  /** Her aracın turu için Haversine km (en uzundan kısaya sıralı) */
  routeLengths: number[];
  maxRouteKm: number;
  totalRouteKm: number;
}

export interface VehicleCountSuggestion {
  recommended: number;
  totalVehicles: number;
  studentCount: number;
  simulations: VehicleRecommendation[];
}

function collectOutlierWarnings(students: Student[], school: Point): string[] {
  const w: string[] = [];
  for (const s of students) {
    const km = haversineDistance(school, s);
    if (km > OUTLIER_KM) {
      w.push(
        `${s.name || s.label || s.id}: okuldan yaklaşık ${km.toFixed(1)} km — konum şüpheli olabilir (eşik ${OUTLIER_KM} km).`,
      );
    }
  }
  return w;
}

function assignVehiclesToClusters(
  clusters: Student[][],
  routes: Student[][],
  vehiclesSorted: Vehicle[],
): DistributionResult["assignments"] {
  const idxPairs = clusters
    .map((cluster, index) => ({ cluster, route: routes[index], index }))
    .sort((a, b) => b.cluster.length - a.cluster.length);

  const assignments: DistributionResult["assignments"] = [];
  for (let i = 0; i < idxPairs.length; i++) {
    const vehicle = vehiclesSorted[i];
    const ordered = idxPairs[i].route;
    ordered.forEach((student, order) => {
      assignments.push({
        studentId: student.id,
        vehicleId: vehicle.id,
        order,
      });
    });
  }
  return assignments;
}

/** K-means + NN (metrik) — sweep mümkün değilse. */
function distributeStudentsClassic(
  students: Student[],
  vehicles: Vehicle[],
  school: Point,
): DistributionResult {
  const active = students.filter((s) => s.isActive);
  if (active.length === 0 || vehicles.length === 0) {
    return { assignments: [] };
  }

  const k = Math.min(vehicles.length, active.length);
  const vehiclesSorted = [...vehicles].slice(0, k).sort((a, b) => b.capacity - a.capacity);
  const capacities = vehiclesSorted.map((v) => v.capacity);
  const clusters = balancedKMeansCluster(active, k, capacities);

  const clustersSorted = clusters
    .map((cluster, index) => ({ cluster, index }))
    .sort((a, b) => b.cluster.length - a.cluster.length);

  const assignments: DistributionResult["assignments"] = [];
  for (let i = 0; i < clustersSorted.length; i++) {
    const vehicle = vehiclesSorted[i];
    const ordered = nearestNeighborOrder(clustersSorted[i].cluster, school);
    ordered.forEach((student, order) => {
      assignments.push({
        studentId: student.id,
        vehicleId: vehicle.id,
        order,
      });
    });
  }

  return { assignments };
}

/**
 * Sweep + NN + 2-opt + maliyet rebalance (ücretli Maps API yok).
 */
function distributeStudentsSweep(
  students: Student[],
  vehicles: Vehicle[],
  school: Point,
  warnings: string[],
): DistributionResult | null {
  const active = students.filter((s) => s.isActive);
  if (active.length === 0 || vehicles.length === 0) {
    return { assignments: [] };
  }

  const k = Math.min(vehicles.length, active.length);
  const vehiclesSorted = [...vehicles].slice(0, k).sort((a, b) => b.capacity - a.capacity);
  const capacities = vehiclesSorted.map((v) => v.capacity);
  const totalCap = capacities.reduce((a, b) => a + b, 0);
  if (totalCap < active.length) {
    warnings.push("Toplam araç kapasitesi öğrenci sayısından küçük; klasik dağıtıma dönülüyor.");
    return null;
  }

  const sortedByAngle = [...active].sort(
    (a, b) => sweepAngleFromSchool(school, a) - sweepAngleFromSchool(school, b),
  );

  let clusters = sweepInitialClusters(sortedByAngle, k);
  if (!clustersFitCapacities(clusterSizesOf(clusters), capacities)) {
    return null;
  }

  let routes = clusters.map((cl) => optimizeClusterRoute(school, cl));

  for (let iter = 0; iter < REBALANCE_MAX_ITER; iter++) {
    const routeLens = routes.map((r) => tourLengthMetric(school, r));
    const stopCounts = clusters.map((cl) => cl.length);
    const costs = normalizedClusterCosts(routeLens, stopCounts);

    let maxIdx = 0;
    let minIdx = 0;
    for (let i = 0; i < costs.length; i++) {
      if (costs[i] > costs[maxIdx]) maxIdx = i;
      if (costs[i] < costs[minIdx]) minIdx = i;
    }

    if (maxIdx === minIdx) break;
    if (costs[minIdx] <= 0) break;
    if (costs[maxIdx] <= costs[minIdx] * REBALANCE_COST_RATIO) break;

    const cheapCentroid = centroid(clusters[minIdx]);
    const expensive = clusters[maxIdx];
    if (expensive.length <= 1) break;

    const sizesIfMove = clusterSizesOf(clusters);
    sizesIfMove[maxIdx]--;
    sizesIfMove[minIdx]++;
    if (!clustersFitCapacities(sizesIfMove, capacities)) {
      break;
    }

    const beforeRatio = costImbalanceRatio(costs);
    let bestSi = -1;
    let bestRatio = Infinity;
    let bestTieDist = Infinity;

    for (let si = 0; si < expensive.length; si++) {
      const trialClusters = clusters.map((cl) => cl.slice());
      trialClusters[maxIdx].splice(si, 1);
      const stu = expensive[si];
      trialClusters[minIdx].push(stu);

      if (!clustersFitCapacities(clusterSizesOf(trialClusters), capacities)) continue;

      const trialRoutes = trialClusters.map((cl, ci) =>
        ci === maxIdx || ci === minIdx ? optimizeClusterRoute(school, cl) : routes[ci].slice(),
      );

      const trLens = trialRoutes.map((r) => tourLengthMetric(school, r));
      const tStops = trialClusters.map((cl) => cl.length);
      const tCosts = normalizedClusterCosts(trLens, tStops);
      const ratio = costImbalanceRatio(tCosts);

      if (ratio >= beforeRatio - 1e-9) continue;

      const distToCheap = routeMetricDistance(stu, cheapCentroid);
      if (ratio < bestRatio - 1e-9 || (Math.abs(ratio - bestRatio) <= 1e-9 && distToCheap < bestTieDist)) {
        bestRatio = ratio;
        bestSi = si;
        bestTieDist = distToCheap;
      }
    }

    if (bestSi < 0) break;

    const [moved] = clusters[maxIdx].splice(bestSi, 1);
    clusters[minIdx].push(moved);
    routes = clusters.map((cl, ci) =>
      ci === maxIdx || ci === minIdx ? optimizeClusterRoute(school, cl) : routes[ci],
    );
  }

  return { assignments: assignVehiclesToClusters(clusters, routes, vehiclesSorted) };
}

/**
 * Aktif öğrencileri araçlara böler; durak sırası üretir.
 * Önce sweep tabanlı yöntem, kapasite / uygunluk yoksa klasik K-means + NN.
 */
export function distributeStudents(students: Student[], vehicles: Vehicle[], school: Point): DistributionResult {
  const active = students.filter((s) => s.isActive);
  const warnings = collectOutlierWarnings(active, school);

  const sweep = distributeStudentsSweep(students, vehicles, school, warnings);
  if (sweep) {
    return warnings.length ? { ...sweep, warnings } : sweep;
  }

  const classic = distributeStudentsClassic(students, vehicles, school);
  warnings.push("Sweep / maliyet dengesi uygun değil; klasik coğrafi kümeleme kullanıldı.");
  return warnings.length ? { ...classic, warnings } : classic;
}

/**
 * Araç sayısı önerisi — `distributeStudents` ile aynı motor; tabloda km için Haversine tur uzunluğu.
 */
export function suggestVehicleCount(
  students: Student[],
  vehicles: Vehicle[],
  school: Point,
  improvementThreshold = 0.25,
): VehicleCountSuggestion {
  const active = students.filter((s) => s.isActive);
  if (active.length === 0 || vehicles.length === 0) {
    return { recommended: 0, totalVehicles: vehicles.length, studentCount: 0, simulations: [] };
  }

  const sortedVehicles = [...vehicles].sort((a, b) => b.capacity - a.capacity);
  const maxK = Math.min(sortedVehicles.length, active.length);
  const simulations: VehicleRecommendation[] = [];

  for (let k = 1; k <= maxK; k++) {
    const subset = sortedVehicles.slice(0, k);
    const totalCap = subset.reduce((s, v) => s + v.capacity, 0);
    if (totalCap < active.length) {
      simulations.push({
        vehicleCount: k,
        routeLengths: [],
        maxRouteKm: Infinity,
        totalRouteKm: Infinity,
      });
      continue;
    }

    const res = distributeStudents(active, subset, school);
    const byId = new Map(active.map((s) => [s.id, s] as const));
    const tmp = new Map<string, { order: number; student: Student }[]>();
    for (const v of subset) tmp.set(v.id, []);
    for (const a of res.assignments) {
      const st = byId.get(a.studentId);
      if (st) tmp.get(a.vehicleId)!.push({ order: a.order, student: st });
    }
    const lengths = subset
      .map((v) => {
        const row = (tmp.get(v.id) ?? [])
          .sort((x, y) => x.order - y.order)
          .map((x) => x.student);
        return tourLengthHaversineKm(school, row);
      })
      .sort((a, b) => b - a);

    simulations.push({
      vehicleCount: k,
      routeLengths: lengths,
      maxRouteKm: lengths[0] ?? 0,
      totalRouteKm: lengths.reduce((s, l) => s + l, 0),
    });
  }

  let recommended = 1;
  for (let i = 0; i < simulations.length; i++) {
    if (simulations[i].maxRouteKm === Infinity) {
      continue;
    }
    recommended = simulations[i].vehicleCount;
    break;
  }

  for (let i = recommended; i < simulations.length; i++) {
    const prev = simulations[i - 1];
    const cur = simulations[i];
    if (prev.maxRouteKm === Infinity || prev.maxRouteKm === 0) {
      if (cur.maxRouteKm < Infinity) recommended = cur.vehicleCount;
      continue;
    }
    const improvement = (prev.maxRouteKm - cur.maxRouteKm) / prev.maxRouteKm;
    if (improvement >= improvementThreshold) {
      recommended = cur.vehicleCount;
    } else {
      break;
    }
  }

  return {
    recommended,
    totalVehicles: vehicles.length,
    studentCount: active.length,
    simulations,
  };
}
