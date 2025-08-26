/**
 * Utility functions for the OGC system
 */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function randomSeed(seed?: number): () => number {
  let s = seed ?? Math.floor(Math.random() * 2147483647);
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function createSHA256(data: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function createCRC32(data: Buffer): string {
  const crc32 = require('crc-32');
  return crc32.buf(data).toString(16);
}

export function hilbertIndex(x: number, y: number, n: number): number {
  // Simplified Hilbert curve index calculation
  let rx: number, ry: number, s: number, d = 0;
  for (s = n / 2; s >= 1; s /= 2) {
    rx = (x & s) > 0 ? 1 : 0;
    ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) {
        x = n - 1 - x;
        y = n - 1 - y;
      }
      [x, y] = [y, x];
    }
  }
  return d;
}

export function dijkstra(graph: number[][], start: number): number[] {
  const n = graph.length;
  const dist = new Array(n).fill(Infinity);
  const visited = new Array(n).fill(false);
  
  dist[start] = 0;
  
  for (let count = 0; count < n - 1; count++) {
    let u = -1;
    for (let v = 0; v < n; v++) {
      if (!visited[v] && (u === -1 || dist[v] < dist[u])) {
        u = v;
      }
    }
    
    visited[u] = true;
    
    for (let v = 0; v < n; v++) {
      if (!visited[v] && graph[u][v] !== 0 && dist[u] + graph[u][v] < dist[v]) {
        dist[v] = dist[u] + graph[u][v];
      }
    }
  }
  
  return dist;
}

export function kmeans(data: number[][], k: number, maxIters = 100): { centroids: number[][], assignments: number[] } {
  const n = data.length;
  const d = data[0].length;
  
  // Initialize centroids randomly
  const centroids: number[][] = [];
  for (let i = 0; i < k; i++) {
    const centroid: number[] = [];
    for (let j = 0; j < d; j++) {
      centroid.push(Math.random() * 2 - 1);
    }
    centroids.push(centroid);
  }
  
  let assignments = new Array(n).fill(0);
  
  for (let iter = 0; iter < maxIters; iter++) {
    const newAssignments = new Array(n);
    
    // Assign points to nearest centroid
    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      let bestCluster = 0;
      
      for (let j = 0; j < k; j++) {
        let dist = 0;
        for (let dim = 0; dim < d; dim++) {
          const diff = data[i][dim] - centroids[j][dim];
          dist += diff * diff;
        }
        
        if (dist < minDist) {
          minDist = dist;
          bestCluster = j;
        }
      }
      
      newAssignments[i] = bestCluster;
    }
    
    // Update centroids
    for (let j = 0; j < k; j++) {
      const clusterPoints = data.filter((_, i) => newAssignments[i] === j);
      if (clusterPoints.length > 0) {
        for (let dim = 0; dim < d; dim++) {
          centroids[j][dim] = clusterPoints.reduce((sum, point) => sum + point[dim], 0) / clusterPoints.length;
        }
      }
    }
    
    // Check convergence
    let converged = true;
    for (let i = 0; i < n; i++) {
      if (assignments[i] !== newAssignments[i]) {
        converged = false;
        break;
      }
    }
    
    assignments = newAssignments;
    if (converged) break;
  }
  
  return { centroids, assignments };
}

export function createECCParity(data: Buffer, strength: 'light' | 'standard' | 'strong' = 'standard'): Buffer {
  // Simple Reed-Solomon-like parity generation
  const parityRates = { light: 0.05, standard: 0.1, strong: 0.2 };
  const rate = parityRates[strength];
  const paritySize = Math.ceil(data.length * rate);
  
  const parity = Buffer.alloc(paritySize);
  for (let i = 0; i < paritySize; i++) {
    let xor = 0;
    for (let j = i; j < data.length; j += paritySize) {
      xor ^= data[j];
    }
    parity[i] = xor;
  }
  
  return parity;
}

export function verifyECCParity(data: Buffer, parity: Buffer): boolean {
  const paritySize = parity.length;
  
  for (let i = 0; i < paritySize; i++) {
    let xor = 0;
    for (let j = i; j < data.length; j += paritySize) {
      xor ^= data[j];
    }
    if (xor !== parity[i]) {
      return false;
    }
  }
  
  return true;
}
