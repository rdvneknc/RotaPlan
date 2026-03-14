import { Student, Vehicle } from "./types";

interface Point {
  lat: number;
  lng: number;
}

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
      sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function centroid(points: Point[]): Point {
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

/**
 * Capacity-constrained K-means: clusters students geographically
 * while keeping cluster sizes balanced and within vehicle capacities.
 */
function balancedKMeansCluster(
  students: Student[],
  k: number,
  capacities: number[],
  maxIter = 25
): Student[][] {
  if (students.length <= k) {
    return students.map((s) => [s]);
  }

  const n = students.length;
  const idealSize = Math.ceil(n / k);
  const balanceBuffer = Math.max(1, Math.floor(n * 0.2));

  // Per-cluster max: respects vehicle capacity, but also limits imbalance
  const maxSizes = capacities.map((cap) =>
    Math.min(cap, idealSize + balanceBuffer)
  );

  // Pick initial centroids spread across students by coordinate sum
  const sorted = [...students].sort(
    (a, b) => a.lat + a.lng - (b.lat + b.lng)
  );
  const step = Math.floor(n / k);
  let centroids: Point[] = Array.from({ length: k }, (_, i) => ({
    lat: sorted[Math.min(i * step, n - 1)].lat,
    lng: sorted[Math.min(i * step, n - 1)].lng,
  }));

  let bestClusters: Student[][] = Array.from({ length: k }, () => []);

  for (let iter = 0; iter < maxIter; iter++) {
    // Distance from every student to every centroid
    const distMatrix: number[][] = students.map((s) =>
      centroids.map((c) => haversineDistance(s, c))
    );

    const clusters: Student[][] = Array.from({ length: k }, () => []);
    const sizes = new Array(k).fill(0);

    // Assign contested students first (small gap between 1st and 2nd choice)
    // so they get their preferred cluster before it fills up
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

    // Recalculate centroids
    const newCentroids = clusters.map((cl, i) =>
      cl.length > 0 ? centroid(cl) : centroids[i]
    );

    const moved = newCentroids.some(
      (nc, i) => haversineDistance(nc, centroids[i]) > 0.001
    );
    centroids = newCentroids;
    if (!moved) break;
  }

  // Post-processing: rebalance any remaining imbalance
  rebalanceClusters(bestClusters, maxSizes, centroids);

  return bestClusters;
}

/**
 * Moves students from oversized clusters to undersized ones,
 * picking the student closest to the target cluster's centroid.
 */
function rebalanceClusters(
  clusters: Student[][],
  maxSizes: number[],
  centroids: Point[]
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
      0
    );
    const smallestIdx = clusters.reduce(
      (min, cl, i) => (cl.length < clusters[min].length ? i : min),
      0
    );

    if (clusters[largestIdx].length - clusters[smallestIdx].length <= 1) break;
    if (clusters[largestIdx].length <= minSize + 1) break;

    // From the largest cluster, pick the student closest to the smallest cluster's centroid
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

    // Update centroids after move
    centroids[largestIdx] =
      clusters[largestIdx].length > 0
        ? centroid(clusters[largestIdx])
        : centroids[largestIdx];
    centroids[smallestIdx] = centroid(clusters[smallestIdx]);
  }
}

/**
 * Nearest-neighbor ordering: starting from school, visit the closest
 * unvisited student, repeat.
 */
function nearestNeighborOrder(students: Student[], school: Point): Student[] {
  if (students.length <= 1) return [...students];

  const remaining = [...students];
  const ordered: Student[] = [];
  let current: Point = school;

  while (remaining.length > 0) {
    let minDist = Infinity;
    let nearest = 0;
    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineDistance(current, remaining[i]);
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

export interface DistributionResult {
  assignments: { studentId: string; vehicleId: string; order: number }[];
}

/**
 * Distributes active students across vehicles by balanced geographic clustering,
 * then orders each cluster for an efficient route.
 */
export function distributeStudents(
  students: Student[],
  vehicles: Vehicle[],
  school: Point
): DistributionResult {
  const active = students.filter((s) => s.isActive);

  if (active.length === 0 || vehicles.length === 0) {
    return { assignments: [] };
  }

  const k = Math.min(vehicles.length, active.length);
  const vehiclesSorted = [...vehicles]
    .slice(0, k)
    .sort((a, b) => b.capacity - a.capacity);

  const capacities = vehiclesSorted.map((v) => v.capacity);
  const clusters = balancedKMeansCluster(active, k, capacities);

  // Pair largest cluster with highest-capacity vehicle
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
