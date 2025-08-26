import * as tf from '@tensorflow/tfjs';
import { randomSeed } from './utils.js';
import * as fs from 'fs';
import * as path from 'path';

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
 * Create a realistic GPT-style model simulation using the actual GPT-OSS config
 */
export async function loadGPTOSSModel(modelPath: string = 'gpt-oss-20b'): Promise<TensorModel> {
  try {
    // Load the actual model config to get realistic dimensions
    const configPath = path.join(modelPath, 'original', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    console.log(`Creating GPT-OSS-20B simulation based on config:`, {
      hidden_size: config.hidden_size,
      num_hidden_layers: config.num_hidden_layers,
      vocab_size: config.vocab_size
    });
    
    // Create realistic transformer layer tensors based on actual architecture
    const tensors: tf.Tensor[] = [];
    let totalParams = 0;
    let allValues: number[] = [];
    
    // Embedding layer: vocab_size x hidden_size
    const embedSize = Math.min(config.vocab_size || 32768, 4096); // Limit for demo
    const hiddenSize = config.hidden_size || 2560;
    const embedTensor = tf.randomNormal([embedSize, Math.min(hiddenSize, 512)], 0, 0.02);
    tensors.push(embedTensor);
    totalParams += embedTensor.size;
    
    // Attention weights: hidden_size x hidden_size (Q, K, V projections)
    const attnSize = Math.min(hiddenSize, 256);
    const qTensor = tf.randomNormal([attnSize, attnSize], 0, 0.02);
    const kTensor = tf.randomNormal([attnSize, attnSize], 0, 0.02);
    const vTensor = tf.randomNormal([attnSize, attnSize], 0, 0.02);
    tensors.push(qTensor, kTensor, vTensor);
    totalParams += qTensor.size + kTensor.size + vTensor.size;
    
    // MLP weights: hidden_size x intermediate_size
    const mlpSize = Math.min(hiddenSize * 4, 1024);
    const mlpTensor = tf.randomNormal([attnSize, Math.min(mlpSize, 512)], 0, 0.02);
    tensors.push(mlpTensor);
    totalParams += mlpTensor.size;
    
    // Collect sample values for statistics
    for (const tensor of tensors) {
      const values = Array.from(tensor.dataSync()).slice(0, 1000); // Sample for stats
      allValues.push(...values);
    }
    
    const nonZeroValues = allValues.filter(x => Math.abs(x) > 1e-6);
    const sparsity = 1 - (nonZeroValues.length / allValues.length);
    const entropy = calculateEntropy(nonZeroValues);
    
    console.log(`Created GPT-OSS simulation with ${tensors.length} layers, ${totalParams} total parameters`);
    
    return {
      tensors,
      shape: Array.from(embedTensor.shape), // Use embedding shape as representative
      parameters: totalParams,
      sparsity,
      entropy,
      modelId: `gpt-oss-20b_simulation`
    };
    
  } catch (error) {
    console.error('Error creating GPT-OSS simulation:', error);
    throw new Error(`Failed to create GPT-OSS simulation: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
