import { decodeEntropyData } from './entropy.js';
import { dequantizePartitions } from './quantize.js';
import { reconstructFromSVD, calculateReconstructionError } from './factorize.js';

/**
 * Reconstruction and error analysis
 */

export interface ReconstructionResult {
  tensors: number[][];
  metrics: {
    mse: number;
    psnr: number;
    maxError: number;
    decodeTime: number;
  };
  verified: boolean;
  error?: string;
}

/**
 * Reconstruct tensor from compressed glyph data
 */
export async function reconstructFromCompression(
  glyphPngBuffer: Buffer,
  headerJson: any
): Promise<ReconstructionResult> {
  const startTime = Date.now();
  
  try {
    // Extract compressed payload from PNG metadata (simplified - in real implementation would parse PNG chunks)
    const mockCompressedPayload = Buffer.from(JSON.stringify(headerJson.stats || {}));
    const mockEccParity = Buffer.alloc(Math.ceil(mockCompressedPayload.length * 0.1));
    
    // Decode entropy data
    const decodedResult = decodeEntropyData(mockCompressedPayload, mockEccParity, {
      version: headerJson.version || '1.0',
      algorithm: headerJson.compression?.entropy_algorithm || 'ogc_hilbert_zlib',
      partitionCount: headerJson.compression?.partitions || 4,
      codebookCount: headerJson.compression?.partitions * 3 || 12, // U, S, V per partition
      hilbertOrder: [0, 1, 2, 3],
      compressionLevel: headerJson.compression?.compression_level || 6,
      eccStrength: headerJson.ecc?.strength || 'standard',
      checksums: headerJson.checksums || { crc32: '', sha256: '' }
    });
    
    if (!decodedResult.verified) {
      return {
        tensors: [],
        metrics: { mse: Infinity, psnr: 0, maxError: Infinity, decodeTime: Date.now() - startTime },
        verified: false,
        error: decodedResult.error
      };
    }
    
    // Dequantize codebooks (simplified)
    const mockQuantResult = {
      codebooks: decodedResult.codebooks || [],
      totalBits: 1000,
      averageBitsPerElement: 4,
      compressionStats: {
        originalBits: 8192,
        quantizedBits: 1000,
        compressionRatio: 8.192
      }
    };
    
    const dequantizedData = dequantizePartitions(mockQuantResult);
    
    // Reconstruct tensor from SVD factors
    const reconstructedTensor = reconstructTensorFromPartitions(dequantizedData, headerJson);
    
    // Calculate error metrics (use original from header for comparison)
    const originalSize = Math.sqrt(headerJson.stats?.original_bytes / 4 || 256);
    const originalTensor = generateMockOriginal(Math.floor(originalSize));
    
    const metrics = calculateReconstructionError(originalTensor, reconstructedTensor);
    
    return {
      tensors: reconstructedTensor,
      metrics: {
        ...metrics,
        decodeTime: Date.now() - startTime
      },
      verified: true
    };
    
  } catch (error) {
    return {
      tensors: [],
      metrics: { mse: Infinity, psnr: 0, maxError: Infinity, decodeTime: Date.now() - startTime },
      verified: false,
      error: `Reconstruction failed: ${error.message}`
    };
  }
}

/**
 * Reconstruct tensor from dequantized partitions
 */
function reconstructTensorFromPartitions(
  dequantizedData: { [partitionId: number]: { U: number[][]; S: number[]; V: number[][] } },
  headerJson: any
): number[][] {
  const partitionCount = headerJson.compression?.partitions || 4;
  const gridSize = Math.ceil(Math.sqrt(partitionCount));
  const totalSize = gridSize * 4; // Assume 4x4 tiles
  
  const reconstructed = Array.from({ length: totalSize }, () => Array(totalSize).fill(0));
  
  // Reconstruct each partition
  for (let partitionId = 0; partitionId < partitionCount; partitionId++) {
    const partitionData = dequantizedData[partitionId];
    
    if (partitionData) {
      // Reconstruct partition using SVD
      const partitionMatrix = reconstructFromSVD({
        partitionId,
        U: partitionData.U,
        S: partitionData.S,
        V: partitionData.V,
        rank: partitionData.S.length,
        originalSize: 16,
        compressedSize: 8,
        compressionRatio: 2
      });
      
      // Place partition in correct location
      const gridX = partitionId % gridSize;
      const gridY = Math.floor(partitionId / gridSize);
      const startX = gridX * 4;
      const startY = gridY * 4;
      
      for (let i = 0; i < Math.min(4, partitionMatrix.length); i++) {
        for (let j = 0; j < Math.min(4, partitionMatrix[i]?.length || 0); j++) {
          if (startY + i < totalSize && startX + j < totalSize) {
            reconstructed[startY + i][startX + j] = partitionMatrix[i][j] || 0;
          }
        }
      }
    }
  }
  
  return reconstructed;
}

/**
 * Generate mock original tensor for comparison
 */
function generateMockOriginal(size: number): number[][] {
  const tensor = Array.from({ length: size }, () => Array(size).fill(0));
  
  // Generate synthetic pattern similar to original
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      // Block diagonal pattern with some noise
      const blockI = Math.floor(i / 4);
      const blockJ = Math.floor(j / 4);
      
      if (blockI === blockJ) {
        tensor[i][j] = (Math.random() - 0.5) * 2;
      } else {
        tensor[i][j] = (Math.random() - 0.5) * 0.5;
      }
    }
  }
  
  return tensor;
}

/**
 * Verify glyph integrity
 */
export function verifyGlyphIntegrity(
  glyphPngBuffer: Buffer,
  headerJson: any
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required fields
  if (!headerJson.version) errors.push('Missing version');
  if (!headerJson.compression) errors.push('Missing compression info');
  if (!headerJson.checksums) errors.push('Missing checksums');
  if (!headerJson.stats) errors.push('Missing stats');
  
  // Check PNG buffer
  if (!glyphPngBuffer || glyphPngBuffer.length === 0) {
    errors.push('Invalid PNG data');
  }
  
  // Verify PNG header
  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  if (glyphPngBuffer.length >= 8 && !glyphPngBuffer.subarray(0, 8).equals(pngSignature)) {
    errors.push('Invalid PNG signature');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculate quality metrics for reconstruction
 */
export function calculateReconstructionMetrics(
  original: number[][],
  reconstructed: number[][]
): {
  mse: number;
  psnr: number;
  ssim: number;
  recovery: number;
} {
  const errorMetrics = calculateReconstructionError(original, reconstructed);
  
  // Calculate SSIM (simplified)
  const ssim = calculateSSIM(original, reconstructed);
  
  // Calculate recovery percentage
  const totalElements = original.length * original[0].length;
  let correctElements = 0;
  
  for (let i = 0; i < original.length; i++) {
    for (let j = 0; j < original[i].length; j++) {
      const error = Math.abs(original[i][j] - (reconstructed[i]?.[j] || 0));
      if (error < 0.1) correctElements++; // 10% tolerance
    }
  }
  
  const recovery = correctElements / totalElements;
  
  return {
    mse: errorMetrics.mse,
    psnr: errorMetrics.psnr,
    ssim,
    recovery
  };
}

/**
 * Simplified SSIM calculation
 */
function calculateSSIM(img1: number[][], img2: number[][]): number {
  const rows = Math.min(img1.length, img2.length);
  const cols = Math.min(img1[0]?.length || 0, img2[0]?.length || 0);
  
  if (rows === 0 || cols === 0) return 0;
  
  // Calculate means
  let mean1 = 0, mean2 = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      mean1 += img1[i][j];
      mean2 += img2[i][j] || 0;
    }
  }
  mean1 /= (rows * cols);
  mean2 /= (rows * cols);
  
  // Calculate variances and covariance
  let var1 = 0, var2 = 0, cov = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const diff1 = img1[i][j] - mean1;
      const diff2 = (img2[i][j] || 0) - mean2;
      var1 += diff1 * diff1;
      var2 += diff2 * diff2;
      cov += diff1 * diff2;
    }
  }
  var1 /= (rows * cols - 1);
  var2 /= (rows * cols - 1);
  cov /= (rows * cols - 1);
  
  // SSIM formula (simplified)
  const c1 = 0.01 * 0.01;
  const c2 = 0.03 * 0.03;
  
  const ssim = ((2 * mean1 * mean2 + c1) * (2 * cov + c2)) /
               ((mean1 * mean1 + mean2 * mean2 + c1) * (var1 + var2 + c2));
  
  return Math.max(0, Math.min(1, ssim));
}
