import * as tf from '@tensorflow/tfjs';
import { randomSeed } from './utils.js';

/**
 * Tensor model synthesis and loading utilities
 */

export interface TensorModel {
  tensors: tf.Tensor[];
  shape: number[];
  parameters: number;
  sparsity: number;
  entropy: number;
  modelId: string;
}

/**
 * Generate a synthetic tensor model with specified characteristics
 */
export async function generateSynthetic(n: number, density: number, seed?: number): Promise<TensorModel> {
  const rng = randomSeed(seed);
  const size = Math.ceil(Math.sqrt(n));
  const actualSize = size * size;
  
  // Create block-diagonal structure with cross-block couplers
  const data = new Float32Array(actualSize);
  let nonZeroCount = 0;
  
  // Fill with structured data
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const idx = i * size + j;
      
      // Block diagonal structure
      const blockI = Math.floor(i / 4);
      const blockJ = Math.floor(j / 4);
      
      let value = 0;
      if (blockI === blockJ) {
        // Intra-block connections (higher density)
        if (rng() < density * 1.5) {
          value = (rng() - 0.5) * 2;
        }
      } else {
        // Cross-block connections (sparse)
        if (rng() < density * 0.3) {
          value = (rng() - 0.5) * 0.5;
        }
      }
      
      data[idx] = value;
      if (Math.abs(value) > 1e-6) nonZeroCount++;
    }
  }
  
  const tensor = tf.tensor2d(data, [size, size]);
  const actualSparsity = 1 - (nonZeroCount / actualSize);
  
  // Calculate entropy (simplified)
  const values = Array.from(data).filter(x => Math.abs(x) > 1e-6);
  const entropy = calculateEntropy(values);
  
  return {
    tensors: [tensor],
    shape: [size, size],
    parameters: actualSize,
    sparsity: actualSparsity,
    entropy,
    modelId: `synthetic_${n}_${seed || 'random'}`
  };
}

/**
 * Load tensor model from uploaded JSON data
 */
export async function loadFromJSON(jsonData: any): Promise<TensorModel> {
  const { tensors: tensorData, shape, modelId } = jsonData;
  
  if (!Array.isArray(tensorData) || !Array.isArray(shape)) {
    throw new Error('Invalid tensor JSON format');
  }
  
  const tensors = tensorData.map((data: number[][]) => tf.tensor2d(data));
  const parameters = tensors.reduce((sum, t) => sum + t.size, 0);
  
  // Calculate sparsity and entropy
  const allValues = tensors.flatMap(t => Array.from(t.dataSync()));
  const nonZeroValues = allValues.filter(x => Math.abs(x) > 1e-6);
  const sparsity = 1 - (nonZeroValues.length / allValues.length);
  const entropy = calculateEntropy(nonZeroValues);
  
  return {
    tensors,
    shape,
    parameters,
    sparsity,
    entropy,
    modelId: modelId || `uploaded_${Date.now()}`
  };
}

/**
 * Convert tensor model to serializable format
 */
export function serializeTensors(model: TensorModel): any {
  return {
    tensors: model.tensors.map(t => t.arraySync()),
    shape: model.shape,
    parameters: model.parameters,
    sparsity: model.sparsity,
    entropy: model.entropy,
    modelId: model.modelId
  };
}

/**
 * Calculate entropy of numeric values
 */
function calculateEntropy(values: number[]): number {
  if (values.length === 0) return 0;
  
  // Quantize values to calculate histogram
  const bins = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  
  if (range === 0) return 0;
  
  const hist = new Array(bins).fill(0);
  for (const value of values) {
    const bin = Math.min(bins - 1, Math.floor(((value - min) / range) * bins));
    hist[bin]++;
  }
  
  // Calculate entropy
  let entropy = 0;
  for (const count of hist) {
    if (count > 0) {
      const p = count / values.length;
      entropy -= p * Math.log2(p);
    }
  }
  
  return entropy;
}

/**
 * Get tensor statistics for visualization
 */
export function getTensorStats(model: TensorModel) {
  const tensor = model.tensors[0];
  const data = tensor.dataSync();
  
  return {
    min: tf.min(tensor).dataSync()[0],
    max: tf.max(tensor).dataSync()[0],
    mean: tf.mean(tensor).dataSync()[0],
    std: tf.moments(tensor).variance.sqrt().dataSync()[0],
    shape: model.shape,
    parameters: model.parameters,
    sparsity: model.sparsity,
    entropy: model.entropy,
    memoryKB: (model.parameters * 4) / 1024
  };
}
