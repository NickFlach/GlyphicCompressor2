/**
 * Prime number generation and scheduling algorithms
 */

export interface PrimeSchedule {
  primes: number[];
  checkpoints: number[];
  anchors: number[];
  gaps: number[];
  mode: 'primes' | 'ap' | 'p2plus4q2';
  stats: {
    totalPrimes: number;
    maxGap: number;
    avgGap: number;
    checkpointCount: number;
    anchorCount: number;
  };
}

/**
 * Generate primes up to limit using Sieve of Eratosthenes
 */
export function generatePrimes(limit: number): number[] {
  if (limit < 2) return [];
  
  const sieve = new Array(limit + 1).fill(true);
  sieve[0] = sieve[1] = false;
  
  for (let i = 2; i * i <= limit; i++) {
    if (sieve[i]) {
      for (let j = i * i; j <= limit; j += i) {
        sieve[j] = false;
      }
    }
  }
  
  const primes: number[] = [];
  for (let i = 2; i <= limit; i++) {
    if (sieve[i]) {
      primes.push(i);
    }
  }
  
  return primes;
}

/**
 * Generate arithmetic progression of primes
 */
export function generateArithmeticProgression(
  length: number, 
  startPrime: number = 5, 
  maxSearch: number = 10000
): number[] {
  const primes = generatePrimes(maxSearch);
  const primeSet = new Set(primes);
  
  // Find arithmetic progressions starting from startPrime
  for (const prime of primes) {
    if (prime < startPrime) continue;
    
    for (let diff = 2; diff <= 100; diff += 2) { // Even differences only for odd primes
      const progression = [prime];
      let current = prime;
      
      for (let i = 1; i < length; i++) {
        current += diff;
        if (current > maxSearch || !primeSet.has(current)) {
          break;
        }
        progression.push(current);
      }
      
      if (progression.length >= length) {
        return progression.slice(0, length);
      }
    }
  }
  
  // Fallback to first few primes if no AP found
  return primes.slice(0, Math.min(length, primes.length));
}

/**
 * Generate p² + 4q² form anchors
 */
export function generateP2Plus4Q2Anchors(count: number, limit: number = 1000): number[] {
  const primes = generatePrimes(Math.ceil(Math.sqrt(limit)));
  const anchors = new Set<number>();
  
  for (let i = 0; i < primes.length && anchors.size < count; i++) {
    for (let j = i; j < primes.length && anchors.size < count; j++) {
      const p = primes[i];
      const q = primes[j];
      const anchor = p * p + 4 * q * q;
      
      if (anchor <= limit) {
        anchors.add(anchor);
      } else {
        break;
      }
    }
  }
  
  return Array.from(anchors).sort((a, b) => a - b).slice(0, count);
}

/**
 * Create prime-based scheduling for compression
 */
export function createPrimeSchedule(
  mode: 'primes' | 'ap' | 'p2plus4q2',
  params: {
    limit?: number;
    start?: number;
    apLength?: number;
    anchorCount?: number;
  } = {}
): PrimeSchedule {
  const {
    limit = 1000,
    start = 2,
    apLength = 5,
    anchorCount = 10
  } = params;
  
  let primes: number[];
  let checkpoints: number[] = [];
  let anchors: number[] = [];
  
  switch (mode) {
    case 'primes':
      primes = generatePrimes(limit).filter(p => p >= start);
      // Every 5th prime is a checkpoint
      checkpoints = primes.filter((_, i) => i % 5 === 4);
      break;
      
    case 'ap':
      const ap = generateArithmeticProgression(apLength, start, limit);
      primes = generatePrimes(limit).filter(p => p >= start);
      checkpoints = ap;
      break;
      
    case 'p2plus4q2':
      primes = generatePrimes(limit).filter(p => p >= start);
      anchors = generateP2Plus4Q2Anchors(anchorCount, limit);
      checkpoints = primes.filter((_, i) => i % 3 === 2);
      break;
      
    default:
      throw new Error(`Unknown prime mode: ${mode}`);
  }
  
  // Calculate gaps
  const gaps: number[] = [];
  for (let i = 1; i < primes.length; i++) {
    gaps.push(primes[i] - primes[i - 1]);
  }
  
  const stats = {
    totalPrimes: primes.length,
    maxGap: gaps.length > 0 ? Math.max(...gaps) : 0,
    avgGap: gaps.length > 0 ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : 0,
    checkpointCount: checkpoints.length,
    anchorCount: anchors.length
  };
  
  return {
    primes,
    checkpoints,
    anchors,
    gaps,
    mode,
    stats
  };
}

/**
 * Apply prime schedule to partition precision allocation
 */
export function applyPrimeScheduling(
  schedule: PrimeSchedule,
  partitionCount: number,
  baseBits: { interior: number; boundary: number }
): Array<{ partitionId: number; interiorBits: number; boundaryBits: number; isCheckpoint: boolean; isAnchor: boolean }> {
  const allocations = [];
  
  for (let i = 0; i < partitionCount; i++) {
    let interiorBits = baseBits.interior;
    let boundaryBits = baseBits.boundary;
    
    const isCheckpoint = schedule.checkpoints.includes(i) || schedule.checkpoints.includes(i + 1);
    const isAnchor = schedule.anchors.includes(i) || schedule.anchors.includes(i + 1);
    
    // Boost precision for special partitions
    if (isCheckpoint) {
      interiorBits += 1;
      boundaryBits += 2;
    }
    
    if (isAnchor) {
      interiorBits += 2;
      boundaryBits += 4;
    }
    
    // Prime-gap based modulation
    const gapIndex = i % schedule.gaps.length;
    const gap = schedule.gaps[gapIndex];
    
    if (gap > schedule.stats.avgGap) {
      // Large gaps get less precision
      interiorBits = Math.max(2, interiorBits - 1);
    } else if (gap < schedule.stats.avgGap / 2) {
      // Small gaps get more precision
      interiorBits += 1;
      boundaryBits += 1;
    }
    
    allocations.push({
      partitionId: i,
      interiorBits: Math.min(8, Math.max(2, interiorBits)),
      boundaryBits: Math.min(16, Math.max(4, boundaryBits)),
      isCheckpoint,
      isAnchor
    });
  }
  
  return allocations;
}

/**
 * Export prime timeline for visualization
 */
export function exportPrimeTimeline(schedule: PrimeSchedule) {
  const { primes, checkpoints, anchors, gaps } = schedule;
  
  const timeline = primes.map((prime, index) => {
    const isCheckpoint = checkpoints.includes(prime);
    const isAnchor = anchors.includes(prime);
    const gap = index > 0 ? gaps[index - 1] : 0;
    
    return {
      value: prime,
      index,
      isCheckpoint,
      isAnchor,
      gap,
      type: isAnchor ? 'anchor' : isCheckpoint ? 'checkpoint' : 'prime'
    };
  });
  
  return {
    timeline,
    stats: schedule.stats,
    mode: schedule.mode
  };
}

/**
 * Verify prime properties for testing
 */
export function verifyPrimeProperties(numbers: number[]): boolean {
  for (const num of numbers) {
    if (num < 2) return false;
    
    for (let i = 2; i <= Math.sqrt(num); i++) {
      if (num % i === 0) return false;
    }
  }
  
  return true;
}

/**
 * Find next prime after a given number
 */
export function nextPrime(n: number): number {
  let candidate = n + 1;
  
  while (true) {
    if (isPrime(candidate)) {
      return candidate;
    }
    candidate++;
  }
}

/**
 * Check if a number is prime
 */
function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  
  for (let i = 3; i <= Math.sqrt(n); i += 2) {
    if (n % i === 0) return false;
  }
  
  return true;
}
