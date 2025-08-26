import { PNG } from 'pngjs';
import type { EntropyResult } from './entropy.js';
import type { PartitionResult } from './partition.js';
import type { PrimeSchedule } from './primes.js';

/**
 * Glyph generation and PNG synthesis
 */

export interface GlyphResult {
  pngBase64: string;
  headerJson: any;
  glyphInfo: {
    width: number;
    height: number;
    tileCount: number;
    arcCount: number;
    legendSize: number;
  };
}

/**
 * Generate visual glyph from compression results
 */
export function generateGlyph(
  entropyResult: EntropyResult,
  partitionResult: PartitionResult,
  primeSchedule: PrimeSchedule,
  modelId: string
): GlyphResult {
  const glyphSize = 512;
  const tileGridSize = Math.ceil(Math.sqrt(partitionResult.partitions.length));
  const tileSize = Math.floor((glyphSize - 100) / tileGridSize); // Leave space for legend
  
  // Create PNG
  const png = new PNG({ width: glyphSize, height: glyphSize });
  
  // Fill with dark background
  fillBackground(png, glyphSize);
  
  // Draw partition tiles
  drawPartitionTiles(png, partitionResult, tileSize, tileGridSize);
  
  // Draw boundary connections
  drawBoundaryArcs(png, partitionResult, tileSize, tileGridSize);
  
  // Draw prime markers
  drawPrimeMarkers(png, primeSchedule, tileSize, tileGridSize);
  
  // Draw central symbol
  drawCentralSymbol(png, glyphSize);
  
  // Draw legend
  drawLegend(png, glyphSize, partitionResult, primeSchedule);
  
  // Convert to base64
  const pngBuffer = PNG.sync.write(png);
  const pngBase64 = pngBuffer.toString('base64');
  
  // Create header JSON
  const headerJson = createGlyphHeader(
    entropyResult,
    partitionResult,
    primeSchedule,
    modelId,
    glyphSize
  );
  
  return {
    pngBase64,
    headerJson,
    glyphInfo: {
      width: glyphSize,
      height: glyphSize,
      tileCount: partitionResult.partitions.length,
      arcCount: partitionResult.supergraph.edges.length,
      legendSize: 80
    }
  };
}

/**
 * Fill background with gradient
 */
function fillBackground(png: PNG, size: number) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      
      // Dark gradient background
      const centerX = size / 2;
      const centerY = size / 2;
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const normalizedDist = Math.min(dist / (size / 2), 1);
      
      const brightness = Math.floor(15 + normalizedDist * 25); // Very dark gradient
      
      png.data[idx] = brightness;     // Red
      png.data[idx + 1] = brightness; // Green  
      png.data[idx + 2] = brightness + 10; // Blue (slightly more blue)
      png.data[idx + 3] = 255;        // Alpha
    }
  }
}

/**
 * Draw partition tiles with colors based on properties
 */
function drawPartitionTiles(
  png: PNG,
  partitionResult: PartitionResult,
  tileSize: number,
  gridSize: number
) {
  const centerOffsetX = (png.width - gridSize * tileSize) / 2;
  const centerOffsetY = (png.height - gridSize * tileSize) / 2;
  
  for (const partition of partitionResult.partitions) {
    const gridX = partition.id % gridSize;
    const gridY = Math.floor(partition.id / gridSize);
    
    const startX = Math.floor(centerOffsetX + gridX * tileSize);
    const startY = Math.floor(centerOffsetY + gridY * tileSize);
    
    // Color based on partition properties
    const color = getPartitionColor(partition, partitionResult.stats.maxPartitionSize);
    
    drawTile(png, startX, startY, tileSize - 2, color);
    
    // Highlight boundaries
    if (partition.boundaries.length > 0) {
      drawTileBorder(png, startX, startY, tileSize - 2, { r: 234, g: 88, b: 12, a: 255 }); // Orange border
    }
  }
}

/**
 * Draw boundary connection arcs
 */
function drawBoundaryArcs(
  png: PNG,
  partitionResult: PartitionResult,
  tileSize: number,
  gridSize: number
) {
  const centerOffsetX = (png.width - gridSize * tileSize) / 2;
  const centerOffsetY = (png.height - gridSize * tileSize) / 2;
  
  for (const edge of partitionResult.supergraph.edges) {
    const sourcePartition = partitionResult.partitions.find(p => p.nodes.includes(edge.source));
    const targetPartition = partitionResult.partitions.find(p => p.nodes.includes(edge.target));
    
    if (!sourcePartition || !targetPartition) continue;
    
    const sourceX = centerOffsetX + (sourcePartition.id % gridSize) * tileSize + tileSize / 2;
    const sourceY = centerOffsetY + Math.floor(sourcePartition.id / gridSize) * tileSize + tileSize / 2;
    
    const targetX = centerOffsetX + (targetPartition.id % gridSize) * tileSize + tileSize / 2;
    const targetY = centerOffsetY + Math.floor(targetPartition.id / gridSize) * tileSize + tileSize / 2;
    
    // Draw curved arc
    drawArc(png, sourceX, sourceY, targetX, targetY, { r: 234, g: 88, b: 12, a: 200 });
  }
}

/**
 * Draw prime markers and checkpoints
 */
function drawPrimeMarkers(
  png: PNG,
  primeSchedule: PrimeSchedule,
  tileSize: number,
  gridSize: number
) {
  const centerOffsetX = (png.width - gridSize * tileSize) / 2;
  const centerOffsetY = (png.height - gridSize * tileSize) / 2;
  
  // Draw checkpoints as glowing dots
  for (let i = 0; i < Math.min(primeSchedule.checkpoints.length, gridSize * gridSize); i++) {
    const checkpoint = primeSchedule.checkpoints[i];
    const partitionIndex = i % (gridSize * gridSize);
    
    const gridX = partitionIndex % gridSize;
    const gridY = Math.floor(partitionIndex / gridSize);
    
    const x = centerOffsetX + gridX * tileSize + tileSize / 2;
    const y = centerOffsetY + gridY * tileSize + tileSize / 2;
    
    // Draw glowing checkpoint marker
    drawGlowingDot(png, x, y, 6, { r: 217, g: 119, b: 6, a: 255 }); // Gold
  }
  
  // Draw anchors as special markers
  for (let i = 0; i < Math.min(primeSchedule.anchors.length, 5); i++) {
    const partitionIndex = (i * 3) % (gridSize * gridSize);
    
    const gridX = partitionIndex % gridSize;
    const gridY = Math.floor(partitionIndex / gridSize);
    
    const x = centerOffsetX + gridX * tileSize + tileSize / 4;
    const y = centerOffsetY + gridY * tileSize + tileSize / 4;
    
    // Draw anchor as red square
    drawTile(png, x, y, 8, { r: 239, g: 68, b: 68, a: 255 });
  }
}

/**
 * Draw central prime symbol
 */
function drawCentralSymbol(png: PNG, size: number) {
  const centerX = size / 2;
  const centerY = size / 2;
  const symbolSize = 48;
  
  // Draw golden circle
  drawCircle(png, centerX, centerY, symbolSize, { r: 217, g: 119, b: 6, a: 255 });
  
  // Draw prime symbol "ℙ" as simple geometric shape
  const symbolX = centerX - 12;
  const symbolY = centerY - 16;
  
  // Draw simplified "P" shape
  drawRectangle(png, symbolX, symbolY, 4, 32, { r: 255, g: 255, b: 255, a: 255 });
  drawRectangle(png, symbolX, symbolY, 16, 4, { r: 255, g: 255, b: 255, a: 255 });
  drawRectangle(png, symbolX, symbolY + 14, 12, 4, { r: 255, g: 255, b: 255, a: 255 });
  drawRectangle(png, symbolX + 12, symbolY + 4, 4, 14, { r: 255, g: 255, b: 255, a: 255 });
}

/**
 * Draw legend explaining colors and symbols
 */
function drawLegend(
  png: PNG,
  size: number,
  partitionResult: PartitionResult,
  primeSchedule: PrimeSchedule
) {
  const legendY = size - 70;
  const legendHeight = 60;
  
  // Draw legend background
  drawRectangle(png, 10, legendY, size - 20, legendHeight, { r: 0, g: 0, b: 0, a: 180 });
  
  // Draw legend items
  let x = 20;
  const y = legendY + 10;
  
  // Partition tile
  drawTile(png, x, y, 12, { r: 124, g: 58, b: 237, a: 255 });
  x += 20;
  
  // Boundary marker  
  drawTileBorder(png, x, y, 12, { r: 234, g: 88, b: 12, a: 255 });
  x += 20;
  
  // Checkpoint
  drawGlowingDot(png, x + 6, y + 6, 4, { r: 217, g: 119, b: 6, a: 255 });
  x += 20;
  
  // Anchor
  drawTile(png, x, y, 8, { r: 239, g: 68, b: 68, a: 255 });
}

/**
 * Get partition color based on properties
 */
function getPartitionColor(partition: any, maxSize: number): { r: number; g: number; b: number; a: number } {
  const sizeRatio = partition.size / maxSize;
  const boundaryRatio = partition.boundaries.length / partition.size;
  
  // Base color: blue to purple gradient based on size
  let r = Math.floor(30 + sizeRatio * 94); // 30-124
  let g = Math.floor(64 - sizeRatio * 26); // 64-38  
  let b = Math.floor(175 + sizeRatio * 62); // 175-237
  
  // Modulate based on boundary density
  if (boundaryRatio > 0.3) {
    r += 30; // More red for boundary-heavy partitions
    g += 20;
  }
  
  return { r: Math.min(255, r), g: Math.min(255, g), b: Math.min(255, b), a: 255 };
}

/**
 * Draw a filled tile
 */
function drawTile(
  png: PNG,
  x: number,
  y: number,
  size: number,
  color: { r: number; g: number; b: number; a: number }
) {
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const pixelX = Math.floor(x + dx);
      const pixelY = Math.floor(y + dy);
      
      if (pixelX >= 0 && pixelX < png.width && pixelY >= 0 && pixelY < png.height) {
        const idx = (png.width * pixelY + pixelX) << 2;
        png.data[idx] = color.r;
        png.data[idx + 1] = color.g;
        png.data[idx + 2] = color.b;
        png.data[idx + 3] = color.a;
      }
    }
  }
}

/**
 * Draw tile border
 */
function drawTileBorder(
  png: PNG,
  x: number,
  y: number,
  size: number,
  color: { r: number; g: number; b: number; a: number }
) {
  // Top and bottom edges
  for (let dx = 0; dx < size; dx++) {
    setPixel(png, x + dx, y, color);
    setPixel(png, x + dx, y + size - 1, color);
  }
  
  // Left and right edges
  for (let dy = 0; dy < size; dy++) {
    setPixel(png, x, y + dy, color);
    setPixel(png, x + size - 1, y + dy, color);
  }
}

/**
 * Draw an arc between two points
 */
function drawArc(
  png: PNG,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: { r: number; g: number; b: number; a: number }
) {
  // Simple quadratic Bezier curve
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2 - 50; // Arc upward
  
  const steps = 50;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * midX + t * t * x2;
    const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * midY + t * t * y2;
    
    setPixel(png, Math.floor(x), Math.floor(y), color);
    
    // Make arc thicker
    setPixel(png, Math.floor(x + 1), Math.floor(y), color);
    setPixel(png, Math.floor(x), Math.floor(y + 1), color);
  }
}

/**
 * Draw a glowing dot
 */
function drawGlowingDot(
  png: PNG,
  centerX: number,
  centerY: number,
  radius: number,
  color: { r: number; g: number; b: number; a: number }
) {
  for (let dy = -radius * 2; dy <= radius * 2; dy++) {
    for (let dx = -radius * 2; dx <= radius * 2; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= radius * 2) {
        const alpha = Math.max(0, Math.min(255, color.a * (1 - dist / (radius * 2))));
        
        if (alpha > 0) {
          setPixel(png, centerX + dx, centerY + dy, {
            ...color,
            a: Math.floor(alpha)
          });
        }
      }
    }
  }
}

/**
 * Draw a circle
 */
function drawCircle(
  png: PNG,
  centerX: number,
  centerY: number,
  radius: number,
  color: { r: number; g: number; b: number; a: number }
) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= radius) {
        setPixel(png, centerX + dx, centerY + dy, color);
      }
    }
  }
}

/**
 * Draw a rectangle
 */
function drawRectangle(
  png: PNG,
  x: number,
  y: number,
  width: number,
  height: number,
  color: { r: number; g: number; b: number; a: number }
) {
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      setPixel(png, x + dx, y + dy, color);
    }
  }
}

/**
 * Set a single pixel with bounds checking
 */
function setPixel(
  png: PNG,
  x: number,
  y: number,
  color: { r: number; g: number; b: number; a: number }
) {
  const pixelX = Math.floor(x);
  const pixelY = Math.floor(y);
  
  if (pixelX >= 0 && pixelX < png.width && pixelY >= 0 && pixelY < png.height) {
    const idx = (png.width * pixelY + pixelX) << 2;
    
    // Alpha blending
    const srcAlpha = color.a / 255;
    const dstAlpha = png.data[idx + 3] / 255;
    const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);
    
    if (outAlpha > 0) {
      png.data[idx] = Math.floor((color.r * srcAlpha + png.data[idx] * dstAlpha * (1 - srcAlpha)) / outAlpha);
      png.data[idx + 1] = Math.floor((color.g * srcAlpha + png.data[idx + 1] * dstAlpha * (1 - srcAlpha)) / outAlpha);
      png.data[idx + 2] = Math.floor((color.b * srcAlpha + png.data[idx + 2] * dstAlpha * (1 - srcAlpha)) / outAlpha);
      png.data[idx + 3] = Math.floor(outAlpha * 255);
    }
  }
}

/**
 * Create glyph header JSON
 */
function createGlyphHeader(
  entropyResult: EntropyResult,
  partitionResult: PartitionResult,
  primeSchedule: PrimeSchedule,
  modelId: string,
  glyphSize: number
): any {
  return {
    version: '1.0',
    model_id: modelId,
    glyph: {
      width: glyphSize,
      height: glyphSize,
      format: 'png',
      encoding: 'base64'
    },
    compression: {
      algorithm: 'ogc_v1',
      prime_mode: primeSchedule.mode,
      partitions: partitionResult.partitions.length,
      boundaries: partitionResult.boundaries.length,
      entropy_algorithm: entropyResult.header.algorithm,
      compression_level: entropyResult.header.compressionLevel
    },
    checksums: entropyResult.header.checksums,
    ecc: {
      method: 'parity_stripes',
      strength: entropyResult.header.eccStrength,
      overhead_bytes: entropyResult.stats.eccBytes
    },
    stats: {
      original_bytes: entropyResult.stats.originalBytes,
      compressed_bytes: entropyResult.stats.compressedBytes,
      ecc_bytes: entropyResult.stats.eccBytes,
      total_bytes: entropyResult.stats.compressedBytes + entropyResult.stats.eccBytes,
      compression_ratio: entropyResult.stats.compressionRatio,
      entropy: entropyResult.stats.entropy
    },
    prime_schedule: {
      mode: primeSchedule.mode,
      total_primes: primeSchedule.stats.totalPrimes,
      checkpoints: primeSchedule.stats.checkpointCount,
      anchors: primeSchedule.stats.anchorCount,
      max_gap: primeSchedule.stats.maxGap
    },
    created_at: new Date().toISOString()
  };
}
