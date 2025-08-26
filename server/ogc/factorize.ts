import * as tf from '@tensorflow/tfjs';
import type { PartitionResult } from './partition.js';
import type { PrimeSchedule } from './primes.js';

/**
 * Tensor factorization and low-rank approximation
 */

export interface FactorizedPartition {
  partitionId: number;
  U: number[][];
  S: number[];
  V: number[][];
  rank: number;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export interface FactorizationResult {
  partitions: FactorizedPartition[];
  totalOriginalSize: number;
  totalCompressedSize: number;
  avgCompressionRatio: number;
}

/**
 * Perform SVD-based factorization on tensor partitions
 */
export async function factorizePartitions(
  tensor: tf.Tensor,
  partitionResult: PartitionResult,
  primeSchedule: PrimeSchedule
): Promise<FactorizationResult> {
  const tensorData = tensor.arraySync() as number[][];
  const [rows, cols] = tensor.shape;
  
  const factorizedPartitions: FactorizedPartition[] = [];
  let totalOriginalSize = 0;
  let totalCompressedSize = 0;
  
  for (const partition of partitionResult.partitions) {
    // Extract partition data
    const partitionMatrix = extractPartitionMatrix(tensorData, partition.nodes, rows, cols);
    
    // Determine rank based on prime schedule and supergraph centrality
    const targetRank = determinePartitionRank(
      partition, 
      partitionResult.supergraph, 
      primeSchedule, 
      partitionMatrix
    );
    
    // Perform SVD factorization
    const factorized = await svdFactorize(partitionMatrix, targetRank);
    
    const originalSize = partition.nodes.length * partition.nodes.length;
    const compressedSize = factorized.U.length * targetRank + targetRank + targetRank * factorized.V[0].length;
    
    factorizedPartitions.push({
      partitionId: partition.id,
      ...factorized,
      originalSize,
      compressedSize,
      compressionRatio: originalSize / compressedSize
    });
    
    totalOriginalSize += originalSize;
    totalCompressedSize += compressedSize;
  }
  
  return {
    partitions: factorizedPartitions,
    totalOriginalSize,
    totalCompressedSize,
    avgCompressionRatio: totalOriginalSize / totalCompressedSize
  };
}

/**
 * Extract matrix data for a specific partition
 */
function extractPartitionMatrix(
  tensorData: number[][], 
  partitionNodes: number[], 
  rows: number, 
  cols: number
): number[][] {
  const matrix: number[][] = [];
  
  for (const nodeRow of partitionNodes) {
    if (nodeRow >= rows) continue;
    
    const row: number[] = [];
    for (const nodeCol of partitionNodes) {
      if (nodeCol >= cols) continue;
      row.push(tensorData[nodeRow][nodeCol]);
    }
    matrix.push(row);
  }
  
  return matrix;
}

/**
 * Determine optimal rank for partition based on various factors
 */
function determinePartitionRank(
  partition: any,
  supergraph: any,
  primeSchedule: PrimeSchedule,
  matrix: number[][]
): number {
  const partitionSize = partition.nodes.length;
  const maxRank = Math.min(matrix.length, matrix[0]?.length || 0);
  
  if (maxRank === 0) return 1;
  
  // Base rank: fraction of partition size
  let baseRank = Math.ceil(partitionSize * 0.3);
  
  // Adjust based on boundary density
  const boundaryRatio = partition.boundaries.length / partitionSize;
  if (boundaryRatio > 0.3) {
    baseRank = Math.ceil(baseRank * 1.5); // More rank for boundary-heavy partitions
  }
  
  // Adjust based on supergraph centrality
  const partitionBoundaries = new Set(partition.boundaries);
  let centrality = 0;
  
  for (const edge of supergraph.edges) {
    if (partitionBoundaries.has(edge.source) || partitionBoundaries.has(edge.target)) {
      centrality += edge.weight;
    }
  }
  
  if (centrality > 0) {
    baseRank = Math.ceil(baseRank * (1 + centrality * 0.1));
  }
  
  // Prime schedule influence
  const isSpecialPartition = primeSchedule.checkpoints.includes(partition.id) || 
                            primeSchedule.anchors.includes(partition.id);
  
  if (isSpecialPartition) {
    baseRank = Math.ceil(baseRank * 1.2);
  }
  
  return Math.min(maxRank, Math.max(1, baseRank));
}

/**
 * Perform SVD factorization using TensorFlow.js
 */
async function svdFactorize(matrix: number[][], targetRank: number): Promise<{
  U: number[][];
  S: number[];
  V: number[][];
  rank: number;
}> {
  if (matrix.length === 0 || matrix[0].length === 0) {
    return {
      U: [[1]],
      S: [0],
      V: [[1]],
      rank: 1
    };
  }
  
  const tensor = tf.tensor2d(matrix);
  
  try {
    const { u, s, v } = tf.linalg.svd(tensor);
    
    const actualRank = Math.min(targetRank, s.shape[0]);
    
    // Truncate to target rank
    const UTrunc = u.slice([0, 0], [-1, actualRank]);
    const STrunc = s.slice([0], [actualRank]);
    const VTrunc = v.slice([0, 0], [actualRank, -1]);
    
    const UData = await UTrunc.array() as number[][];
    const SData = await STrunc.array() as number[];
    const VData = await VTrunc.array() as number[][];
    
    // Clean up tensors
    tensor.dispose();
    u.dispose();
    s.dispose();
    v.dispose();
    UTrunc.dispose();
    STrunc.dispose();
    VTrunc.dispose();
    
    return {
      U: UData,
      S: SData,
      V: VData,
      rank: actualRank
    };
    
  } catch (error) {
    // Fallback for singular matrices
    tensor.dispose();
    
    const rows = matrix.length;
    const cols = matrix[0].length;
    const rank = Math.min(targetRank, rows, cols);
    
    return {
      U: Array.from({ length: rows }, (_, i) => 
        Array.from({ length: rank }, (_, j) => i === j ? 1 : 0)
      ),
      S: Array.from({ length: rank }, () => 1),
      V: Array.from({ length: rank }, (_, i) =>
        Array.from({ length: cols }, (_, j) => i === j ? 1 : 0)
      ),
      rank
    };
  }
}

/**
 * Reconstruct matrix from SVD factors
 */
export function reconstructFromSVD(factorized: FactorizedPartition): number[][] {
  const { U, S, V } = factorized;
  
  const rows = U.length;
  const cols = V[0].length;
  const reconstructed: number[][] = [];
  
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      let value = 0;
      for (let k = 0; k < S.length; k++) {
        value += U[i][k] * S[k] * V[k][j];
      }
      row.push(value);
    }
    reconstructed.push(row);
  }
  
  return reconstructed;
}

/**
 * Calculate reconstruction error
 */
export function calculateReconstructionError(
  original: number[][],
  reconstructed: number[][]
): { mse: number; psnr: number; maxError: number } {
  if (original.length !== reconstructed.length || 
      original[0]?.length !== reconstructed[0]?.length) {
    throw new Error('Matrix dimensions do not match');
  }
  
  const rows = original.length;
  const cols = original[0].length;
  
  let mse = 0;
  let maxError = 0;
  let maxValue = 0;
  
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const orig = original[i][j];
      const recon = reconstructed[i][j];
      const error = Math.abs(orig - recon);
      
      mse += error * error;
      maxError = Math.max(maxError, error);
      maxValue = Math.max(maxValue, Math.abs(orig));
    }
  }
  
  mse /= (rows * cols);
  const psnr = maxValue > 0 ? 20 * Math.log10(maxValue / Math.sqrt(mse)) : Infinity;
  
  return { mse, psnr, maxError };
}

/**
 * Export factorization results for analysis
 */
export function exportFactorizationAnalysis(result: FactorizationResult) {
  return {
    summary: {
      totalPartitions: result.partitions.length,
      totalOriginalSize: result.totalOriginalSize,
      totalCompressedSize: result.totalCompressedSize,
      avgCompressionRatio: result.avgCompressionRatio
    },
    partitionDetails: result.partitions.map(p => ({
      id: p.partitionId,
      rank: p.rank,
      compressionRatio: p.compressionRatio,
      efficiency: p.compressedSize < p.originalSize,
      singularValues: p.S.slice(0, 5) // First 5 singular values
    })),
    rankDistribution: {
      min: Math.min(...result.partitions.map(p => p.rank)),
      max: Math.max(...result.partitions.map(p => p.rank)),
      avg: result.partitions.reduce((sum, p) => sum + p.rank, 0) / result.partitions.length
    }
  };
}
