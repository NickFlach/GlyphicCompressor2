import { kmeans } from './utils.js';
import type { FactorizedPartition, FactorizationResult } from './factorize.js';
import type { PartitionResult } from './partition.js';

/**
 * Vector quantization and codebook generation
 */

export interface Codebook {
  partitionId: number;
  centroids: number[][];
  indices: number[];
  bits: number;
  isBoundary: boolean;
}

export interface QuantizationResult {
  codebooks: Codebook[];
  totalBits: number;
  averageBitsPerElement: number;
  compressionStats: {
    originalBits: number;
    quantizedBits: number;
    compressionRatio: number;
  };
}

/**
 * Quantize factorized partitions using k-means vector quantization
 */
export function quantizePartitions(
  factorization: FactorizationResult,
  partitionResult: PartitionResult,
  quantizationParams: {
    interiorBits: number;
    boundaryBits: number;
  }
): QuantizationResult {
  const codebooks: Codebook[] = [];
  let totalBits = 0;
  let totalElements = 0;
  
  for (const factorized of factorization.partitions) {
    const partition = partitionResult.partitions.find(p => p.id === factorized.partitionId);
    if (!partition) continue;
    
    const isBoundaryPartition = partition.boundaries.length > partition.interiorNodes.length;
    const targetBits = isBoundaryPartition ? quantizationParams.boundaryBits : quantizationParams.interiorBits;
    
    // Quantize each SVD component separately
    const UCodebook = quantizeMatrix(factorized.U, targetBits, factorized.partitionId + '_U');
    const SCodebook = quantizeVector(factorized.S, Math.max(targetBits, 6), factorized.partitionId + '_S'); // Higher precision for singular values
    const VCodebook = quantizeMatrix(factorized.V, targetBits, factorized.partitionId + '_V');
    
    codebooks.push(UCodebook, SCodebook, VCodebook);
    
    totalBits += UCodebook.indices.length * UCodebook.bits;
    totalBits += SCodebook.indices.length * SCodebook.bits;
    totalBits += VCodebook.indices.length * VCodebook.bits;
    
    totalElements += UCodebook.indices.length + SCodebook.indices.length + VCodebook.indices.length;
  }
  
  const originalBits = factorization.totalOriginalSize * 32; // Assuming 32-bit floats
  const compressionRatio = originalBits / totalBits;
  
  return {
    codebooks,
    totalBits,
    averageBitsPerElement: totalElements > 0 ? totalBits / totalElements : 0,
    compressionStats: {
      originalBits,
      quantizedBits: totalBits,
      compressionRatio
    }
  };
}

/**
 * Quantize a matrix using k-means clustering
 */
function quantizeMatrix(matrix: number[][], targetBits: number, id: string): Codebook {
  const k = Math.pow(2, targetBits);
  const flatData = matrix.flat();
  
  if (flatData.length === 0) {
    return {
      partitionId: parseInt(id.split('_')[0]),
      centroids: [[0]],
      indices: [],
      bits: targetBits,
      isBoundary: false
    };
  }
  
  // Prepare data for k-means (convert to 2D for clustering)
  const data = flatData.map(x => [x, 0]); // Add dummy dimension for k-means
  
  // Perform k-means clustering
  const { centroids, assignments } = kmeans(data, Math.min(k, flatData.length));
  
  return {
    partitionId: parseInt(id.split('_')[0]),
    centroids: centroids.map(c => [c[0]]), // Remove dummy dimension
    indices: assignments,
    bits: targetBits,
    isBoundary: id.includes('boundary')
  };
}

/**
 * Quantize a vector (for singular values)
 */
function quantizeVector(vector: number[], targetBits: number, id: string): Codebook {
  const k = Math.pow(2, targetBits);
  
  if (vector.length === 0) {
    return {
      partitionId: parseInt(id.split('_')[0]),
      centroids: [[0]],
      indices: [],
      bits: targetBits,
      isBoundary: false
    };
  }
  
  // Prepare data for k-means
  const data = vector.map(x => [x, 0]); // Add dummy dimension
  
  // Perform k-means clustering
  const { centroids, assignments } = kmeans(data, Math.min(k, vector.length));
  
  return {
    partitionId: parseInt(id.split('_')[0]),
    centroids: centroids.map(c => [c[0]]), // Remove dummy dimension
    indices: assignments,
    bits: targetBits,
    isBoundary: false
  };
}

/**
 * Apply boundary-specific quantization with delta residuals
 */
export function applyBoundaryQuantization(
  quantResult: QuantizationResult,
  partitionResult: PartitionResult,
  deltaThreshold: number = 0.1
): QuantizationResult {
  const enhancedCodebooks: Codebook[] = [];
  let additionalBits = 0;
  
  for (const codebook of quantResult.codebooks) {
    const partition = partitionResult.partitions.find(p => p.id === codebook.partitionId);
    
    if (partition && partition.boundaries.length > 0) {
      // Apply delta encoding for boundary precision
      const deltaCodebook = generateDeltaCodebook(codebook, deltaThreshold);
      enhancedCodebooks.push(deltaCodebook);
      
      additionalBits += deltaCodebook.indices.length * 2; // 2 bits for delta residuals
    } else {
      enhancedCodebooks.push(codebook);
    }
  }
  
  return {
    ...quantResult,
    codebooks: enhancedCodebooks,
    totalBits: quantResult.totalBits + additionalBits,
    averageBitsPerElement: (quantResult.totalBits + additionalBits) / quantResult.codebooks.reduce((sum, c) => sum + c.indices.length, 0)
  };
}

/**
 * Generate delta residual codebook for boundary precision
 */
function generateDeltaCodebook(codebook: Codebook, threshold: number): Codebook {
  const deltaIndices: number[] = [];
  const deltaResidualsNeeded = new Set<number>();
  
  // Identify values that need delta refinement
  for (let i = 0; i < codebook.indices.length; i++) {
    const centroidIndex = codebook.indices[i];
    const centroidValue = codebook.centroids[centroidIndex][0];
    
    // Simple heuristic: values near centroid boundaries need refinement
    const nearBoundary = Math.abs(centroidValue) % 0.25 < threshold;
    
    if (nearBoundary) {
      deltaResidualsNeeded.add(i);
    }
  }
  
  // Generate delta indices
  for (let i = 0; i < codebook.indices.length; i++) {
    if (deltaResidualsNeeded.has(i)) {
      deltaIndices.push(1); // Has delta residual
    } else {
      deltaIndices.push(0); // No delta residual
    }
  }
  
  return {
    ...codebook,
    indices: deltaIndices,
    isBoundary: true
  };
}

/**
 * Dequantize codebooks back to approximate original values
 */
export function dequantizePartitions(quantResult: QuantizationResult): {
  [partitionId: number]: {
    U: number[][];
    S: number[];
    V: number[][];
  }
} {
  const dequantized: { [partitionId: number]: { U: number[][]; S: number[]; V: number[][] } } = {};
  
  // Group codebooks by partition
  const partitionCodebooks: { [partitionId: number]: { [component: string]: Codebook } } = {};
  
  for (const codebook of quantResult.codebooks) {
    if (!partitionCodebooks[codebook.partitionId]) {
      partitionCodebooks[codebook.partitionId] = {};
    }
    
    // Determine component type from original structure
    const components = ['U', 'S', 'V'];
    const componentIndex = Object.keys(partitionCodebooks[codebook.partitionId]).length;
    const componentName = components[componentIndex % components.length];
    
    partitionCodebooks[codebook.partitionId][componentName] = codebook;
  }
  
  // Dequantize each partition
  for (const [partitionIdStr, codebooks] of Object.entries(partitionCodebooks)) {
    const partitionId = parseInt(partitionIdStr);
    
    const U = dequantizeCodebook(codebooks.U || codebooks['U_' + partitionId]);
    const S = dequantizeCodebook(codebooks.S || codebooks['S_' + partitionId]);
    const V = dequantizeCodebook(codebooks.V || codebooks['V_' + partitionId]);
    
    dequantized[partitionId] = {
      U: Array.isArray(U[0]) ? U as number[][] : [U as number[]],
      S: Array.isArray(S[0]) ? (S as number[][])[0] : S as number[],
      V: Array.isArray(V[0]) ? V as number[][] : [V as number[]]
    };
  }
  
  return dequantized;
}

/**
 * Dequantize a single codebook
 */
function dequantizeCodebook(codebook: Codebook): number[] | number[][] {
  if (!codebook) return [];
  
  const result: number[] = [];
  
  for (const index of codebook.indices) {
    if (index < codebook.centroids.length) {
      result.push(codebook.centroids[index][0]);
    } else {
      result.push(0); // Fallback for invalid indices
    }
  }
  
  return result;
}

/**
 * Analyze quantization quality and compression efficiency
 */
export function analyzeQuantizationQuality(
  original: FactorizationResult,
  quantized: QuantizationResult
): {
  partitionAnalysis: Array<{
    partitionId: number;
    originalSize: number;
    quantizedSize: number;
    compressionRatio: number;
    bits: number;
    isBoundary: boolean;
  }>;
  overallStats: {
    totalCompressionRatio: number;
    averageBitsPerPartition: number;
    boundaryPartitions: number;
    interiorPartitions: number;
  };
} {
  const partitionAnalysis = [];
  let boundaryCount = 0;
  let interiorCount = 0;
  
  // Analyze each partition's quantization
  const partitionSizes: { [id: number]: number } = {};
  for (const partition of original.partitions) {
    partitionSizes[partition.partitionId] = partition.originalSize * 32; // 32-bit original
  }
  
  const quantizedSizes: { [id: number]: { size: number; bits: number; isBoundary: boolean } } = {};
  for (const codebook of quantized.codebooks) {
    if (!quantizedSizes[codebook.partitionId]) {
      quantizedSizes[codebook.partitionId] = { size: 0, bits: codebook.bits, isBoundary: codebook.isBoundary };
    }
    quantizedSizes[codebook.partitionId].size += codebook.indices.length * codebook.bits;
  }
  
  for (const [partitionIdStr, originalSize] of Object.entries(partitionSizes)) {
    const partitionId = parseInt(partitionIdStr);
    const quantizedInfo = quantizedSizes[partitionId] || { size: 0, bits: 0, isBoundary: false };
    
    partitionAnalysis.push({
      partitionId,
      originalSize,
      quantizedSize: quantizedInfo.size,
      compressionRatio: originalSize / Math.max(quantizedInfo.size, 1),
      bits: quantizedInfo.bits,
      isBoundary: quantizedInfo.isBoundary
    });
    
    if (quantizedInfo.isBoundary) {
      boundaryCount++;
    } else {
      interiorCount++;
    }
  }
  
  const totalOriginalSize = Object.values(partitionSizes).reduce((sum, size) => sum + size, 0);
  const totalQuantizedSize = Object.values(quantizedSizes).reduce((sum, info) => sum + info.size, 0);
  
  return {
    partitionAnalysis,
    overallStats: {
      totalCompressionRatio: totalOriginalSize / Math.max(totalQuantizedSize, 1),
      averageBitsPerPartition: partitionAnalysis.reduce((sum, p) => sum + p.bits, 0) / partitionAnalysis.length,
      boundaryPartitions: boundaryCount,
      interiorPartitions: interiorCount
    }
  };
}
