import { deflateSync, inflateSync } from 'zlib';
import { createECCParity, verifyECCParity, hilbertIndex } from './utils.js';
import type { QuantizationResult } from './quantize.js';
import type { PartitionResult } from './partition.js';

/**
 * Entropy coding and payload ordering
 */

export interface EntropyResult {
  compressedPayload: Buffer;
  eccParity: Buffer;
  header: EntropyHeader;
  stats: {
    originalBytes: number;
    compressedBytes: number;
    eccBytes: number;
    compressionRatio: number;
    entropy: number;
  };
}

export interface EntropyHeader {
  version: string;
  algorithm: string;
  partitionCount: number;
  codebookCount: number;
  hilbertOrder: number[];
  compressionLevel: number;
  eccStrength: 'light' | 'standard' | 'strong';
  checksums: {
    crc32: string;
    sha256: string;
  };
}

/**
 * Apply entropy coding to quantized data with supergraph ordering
 */
export async function applyEntropyCoding(
  quantization: QuantizationResult,
  partitionResult: PartitionResult,
  options: {
    compressionLevel?: number;
    eccStrength?: 'light' | 'standard' | 'strong';
  } = {}
): Promise<EntropyResult> {
  const { compressionLevel = 6, eccStrength = 'standard' } = options;
  
  // Order data streams using Hilbert-like indexing
  const orderedData = orderDataStreams(quantization, partitionResult);
  
  // Serialize ordered data
  const serializedData = serializeOrderedData(orderedData);
  
  // Apply zlib compression
  const compressedPayload = deflateSync(serializedData, { level: compressionLevel });
  
  // Generate ECC parity
  const eccParity = createECCParity(compressedPayload, eccStrength);
  
  // Calculate checksums
  const crypto = await import('crypto');
  const crc32 = await import('crc-32');
  
  const crcHash = crc32.default.buf(compressedPayload).toString(16);
  const sha256Hash = crypto.createHash('sha256').update(compressedPayload).digest('hex');
  
  // Create header
  const header: EntropyHeader = {
    version: '1.0',
    algorithm: 'ogc_hilbert_zlib',
    partitionCount: partitionResult.partitions.length,
    codebookCount: quantization.codebooks.length,
    hilbertOrder: orderedData.hilbertOrder,
    compressionLevel,
    eccStrength,
    checksums: {
      crc32: crcHash,
      sha256: sha256Hash
    }
  };
  
  const stats = {
    originalBytes: serializedData.length,
    compressedBytes: compressedPayload.length,
    eccBytes: eccParity.length,
    compressionRatio: serializedData.length / compressedPayload.length,
    entropy: calculateDataEntropy(serializedData)
  };
  
  return {
    compressedPayload,
    eccParity,
    header,
    stats
  };
}

/**
 * Order data streams using supergraph-guided Hilbert indexing
 */
function orderDataStreams(
  quantization: QuantizationResult,
  partitionResult: PartitionResult
): {
  orderedCodebooks: any[];
  hilbertOrder: number[];
} {
  const partitionCount = partitionResult.partitions.length;
  const gridSize = Math.ceil(Math.sqrt(partitionCount));
  
  // Calculate Hilbert indices for partitions
  const hilbertOrder: number[] = [];
  const partitionIndices: Array<{ partitionId: number; hilbertIndex: number }> = [];
  
  for (const partition of partitionResult.partitions) {
    const x = partition.id % gridSize;
    const y = Math.floor(partition.id / gridSize);
    const hilbertIdx = hilbertIndex(x, y, gridSize);
    
    partitionIndices.push({
      partitionId: partition.id,
      hilbertIndex: hilbertIdx
    });
  }
  
  // Sort by Hilbert index
  partitionIndices.sort((a, b) => a.hilbertIndex - b.hilbertIndex);
  
  // Order codebooks according to Hilbert traversal
  const orderedCodebooks: any[] = [];
  
  for (const { partitionId } of partitionIndices) {
    hilbertOrder.push(partitionId);
    
    // Find all codebooks for this partition
    const partitionCodebooks = quantization.codebooks.filter(
      cb => cb.partitionId === partitionId
    );
    
    // Sort codebooks within partition (boundary first for priority)
    partitionCodebooks.sort((a, b) => {
      if (a.isBoundary && !b.isBoundary) return -1;
      if (!a.isBoundary && b.isBoundary) return 1;
      return 0;
    });
    
    orderedCodebooks.push(...partitionCodebooks);
  }
  
  return {
    orderedCodebooks,
    hilbertOrder
  };
}

/**
 * Serialize ordered data into byte stream
 */
function serializeOrderedData(orderedData: { orderedCodebooks: any[]; hilbertOrder: number[] }): Buffer {
  const chunks: Buffer[] = [];
  
  // Serialize Hilbert order
  const hilbertBuffer = Buffer.alloc(orderedData.hilbertOrder.length * 4);
  for (let i = 0; i < orderedData.hilbertOrder.length; i++) {
    hilbertBuffer.writeUInt32LE(orderedData.hilbertOrder[i], i * 4);
  }
  chunks.push(hilbertBuffer);
  
  // Serialize codebooks
  for (const codebook of orderedData.orderedCodebooks) {
    const codebookBuffer = serializeCodebook(codebook);
    chunks.push(codebookBuffer);
  }
  
  return Buffer.concat(chunks);
}

/**
 * Serialize a single codebook
 */
function serializeCodebook(codebook: any): Buffer {
  const chunks: Buffer[] = [];
  
  // Header: partition ID, bits, boundary flag, sizes
  const header = Buffer.alloc(16);
  header.writeUInt32LE(codebook.partitionId, 0);
  header.writeUInt8(codebook.bits, 4);
  header.writeUInt8(codebook.isBoundary ? 1 : 0, 5);
  header.writeUInt32LE(codebook.centroids.length, 8);
  header.writeUInt32LE(codebook.indices.length, 12);
  chunks.push(header);
  
  // Centroids (as float32)
  const centroidsBuffer = Buffer.alloc(codebook.centroids.length * codebook.centroids[0].length * 4);
  let offset = 0;
  for (const centroid of codebook.centroids) {
    for (const value of centroid) {
      centroidsBuffer.writeFloatLE(value, offset);
      offset += 4;
    }
  }
  chunks.push(centroidsBuffer);
  
  // Indices (packed according to bits)
  const indicesBuffer = packIndices(codebook.indices, codebook.bits);
  chunks.push(indicesBuffer);
  
  return Buffer.concat(chunks);
}

/**
 * Pack indices efficiently based on bit count
 */
function packIndices(indices: number[], bitsPerIndex: number): Buffer {
  if (bitsPerIndex >= 8) {
    // Use byte-aligned encoding for high bit counts
    const buffer = Buffer.alloc(indices.length * Math.ceil(bitsPerIndex / 8));
    for (let i = 0; i < indices.length; i++) {
      if (bitsPerIndex === 8) {
        buffer.writeUInt8(indices[i], i);
      } else if (bitsPerIndex === 16) {
        buffer.writeUInt16LE(indices[i], i * 2);
      } else {
        buffer.writeUInt32LE(indices[i], i * 4);
      }
    }
    return buffer;
  }
  
  // Bit-packed encoding for low bit counts
  const totalBits = indices.length * bitsPerIndex;
  const bufferSize = Math.ceil(totalBits / 8);
  const buffer = Buffer.alloc(bufferSize);
  
  let bitOffset = 0;
  for (const index of indices) {
    const byteIndex = Math.floor(bitOffset / 8);
    const bitInByte = bitOffset % 8;
    
    // Simple bit packing (can be optimized further)
    for (let bit = 0; bit < bitsPerIndex; bit++) {
      const bitValue = (index >> bit) & 1;
      const targetByteIndex = Math.floor((bitOffset + bit) / 8);
      const targetBitInByte = (bitOffset + bit) % 8;
      
      if (targetByteIndex < bufferSize) {
        if (bitValue) {
          buffer[targetByteIndex] |= (1 << targetBitInByte);
        }
      }
    }
    
    bitOffset += bitsPerIndex;
  }
  
  return buffer;
}

/**
 * Decode entropy-coded data
 */
export async function decodeEntropyData(
  compressedPayload: Buffer,
  eccParity: Buffer,
  header: EntropyHeader
): Promise<{
  codebooks: any[];
  verified: boolean;
  error?: string;
}> {
  try {
    // Verify ECC first
    const eccVerified = verifyECCParity(compressedPayload, eccParity);
    if (!eccVerified) {
      return {
        codebooks: [],
        verified: false,
        error: 'ECC verification failed'
      };
    }
    
    // Verify checksums
    const crypto = await import('crypto');
    const crc32 = await import('crc-32');
    
    const calculatedCRC = crc32.default.buf(compressedPayload).toString(16);
    const calculatedSHA256 = crypto.createHash('sha256').update(compressedPayload).digest('hex');
    
    if (calculatedCRC !== header.checksums.crc32 || calculatedSHA256 !== header.checksums.sha256) {
      return {
        codebooks: [],
        verified: false,
        error: 'Checksum verification failed'
      };
    }
    
    // Decompress payload
    const decompressedData = inflateSync(compressedPayload);
    
    // Deserialize data
    const codebooks = deserializeData(decompressedData, header);
    
    return {
      codebooks,
      verified: true
    };
    
  } catch (error) {
    return {
      codebooks: [],
      verified: false,
      error: `Decoding error: ${error.message}`
    };
  }
}

/**
 * Deserialize data back to codebooks
 */
function deserializeData(data: Buffer, header: EntropyHeader): any[] {
  const codebooks: any[] = [];
  let offset = 0;
  
  // Read Hilbert order
  const hilbertOrderSize = header.partitionCount * 4;
  const hilbertOrder: number[] = [];
  for (let i = 0; i < header.partitionCount; i++) {
    hilbertOrder.push(data.readUInt32LE(offset + i * 4));
  }
  offset += hilbertOrderSize;
  
  // Read codebooks
  for (let i = 0; i < header.codebookCount; i++) {
    const codebook = deserializeCodebook(data, offset);
    codebooks.push(codebook.codebook);
    offset = codebook.nextOffset;
  }
  
  return codebooks;
}

/**
 * Deserialize a single codebook
 */
function deserializeCodebook(data: Buffer, offset: number): { codebook: any; nextOffset: number } {
  // Read header
  const partitionId = data.readUInt32LE(offset);
  const bits = data.readUInt8(offset + 4);
  const isBoundary = data.readUInt8(offset + 5) === 1;
  const centroidsCount = data.readUInt32LE(offset + 8);
  const indicesCount = data.readUInt32LE(offset + 12);
  offset += 16;
  
  // Read centroids
  const centroids: number[][] = [];
  for (let i = 0; i < centroidsCount; i++) {
    const centroid = [data.readFloatLE(offset)];
    centroids.push(centroid);
    offset += 4;
  }
  
  // Read indices
  const indicesBuffer = data.subarray(offset, offset + Math.ceil(indicesCount * bits / 8));
  const indices = unpackIndices(indicesBuffer, indicesCount, bits);
  offset += indicesBuffer.length;
  
  return {
    codebook: {
      partitionId,
      bits,
      isBoundary,
      centroids,
      indices
    },
    nextOffset: offset
  };
}

/**
 * Unpack bit-packed indices
 */
function unpackIndices(buffer: Buffer, count: number, bitsPerIndex: number): number[] {
  const indices: number[] = [];
  
  if (bitsPerIndex >= 8) {
    // Byte-aligned unpacking
    for (let i = 0; i < count; i++) {
      if (bitsPerIndex === 8) {
        indices.push(buffer.readUInt8(i));
      } else if (bitsPerIndex === 16) {
        indices.push(buffer.readUInt16LE(i * 2));
      } else {
        indices.push(buffer.readUInt32LE(i * 4));
      }
    }
  } else {
    // Bit-packed unpacking
    let bitOffset = 0;
    for (let i = 0; i < count; i++) {
      let index = 0;
      
      for (let bit = 0; bit < bitsPerIndex; bit++) {
        const byteIndex = Math.floor((bitOffset + bit) / 8);
        const bitInByte = (bitOffset + bit) % 8;
        
        if (byteIndex < buffer.length) {
          const bitValue = (buffer[byteIndex] >> bitInByte) & 1;
          index |= (bitValue << bit);
        }
      }
      
      indices.push(index);
      bitOffset += bitsPerIndex;
    }
  }
  
  return indices;
}

/**
 * Calculate entropy of data
 */
function calculateDataEntropy(data: Buffer): number {
  const freq = new Array(256).fill(0);
  
  for (let i = 0; i < data.length; i++) {
    freq[data[i]]++;
  }
  
  let entropy = 0;
  for (const count of freq) {
    if (count > 0) {
      const p = count / data.length;
      entropy -= p * Math.log2(p);
    }
  }
  
  return entropy;
}
