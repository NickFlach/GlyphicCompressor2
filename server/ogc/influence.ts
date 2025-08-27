import * as tf from '@tensorflow/tfjs';
import type { TensorModel } from './tensors.js';

/**
 * Influence graph construction and analysis
 */

export interface InfluenceGraph {
  nodes: number;
  edges: number[][];
  weights: number[][];
  influences: number[];
}

/**
 * Build influence graph from tensor model
 */
export async function buildInfluenceGraph(model: TensorModel, method: 'abs' | 'jacobian' | 'diagonal' = 'abs'): Promise<InfluenceGraph> {
  const tensor = model.tensors[0];
  const [rows, cols] = tensor.shape;
  const nodes = rows;
  
  switch (method) {
    case 'abs':
      return buildAbsoluteInfluenceGraph(tensor);
    case 'jacobian':
      return buildJacobianInfluenceGraph(tensor);
    case 'diagonal':
      return buildBlockDiagonalGraph(tensor);
    default:
      throw new Error(`Unknown influence method: ${method}`);
  }
}

/**
 * Build influence graph using absolute values |A|
 */
function buildAbsoluteInfluenceGraph(tensor: tf.Tensor): InfluenceGraph {
  const data = tensor.arraySync();
  const shape = tensor.shape;
  
  // Handle different tensor shapes - flatten if needed
  let flatData: number[];
  let rows: number, cols: number;
  
  if (shape.length === 1) {
    // 1D tensor - reshape to square-ish matrix
    flatData = data as number[];
    rows = Math.ceil(Math.sqrt(flatData.length));
    cols = Math.ceil(flatData.length / rows);
  } else if (shape.length === 2) {
    // 2D tensor - use directly
    flatData = (data as number[][]).flat();
    [rows, cols] = shape;
  } else {
    // Higher dimensional - flatten and reshape
    flatData = tensor.dataSync() as number[];
    rows = Math.ceil(Math.sqrt(flatData.length));
    cols = Math.ceil(flatData.length / rows);
  }
  
  const edges: number[][] = [];
  const weights: number[][] = [];
  const influences = new Array(rows).fill(0);
  
  for (let i = 0; i < rows; i++) {
    edges[i] = [];
    weights[i] = [];
    
    for (let j = 0; j < cols; j++) {
      const idx = i * cols + j;
      if (idx >= flatData.length) break;
      
      const weight = Math.abs(flatData[idx]);
      if (weight > 1e-6) {
        edges[i].push(j);
        weights[i].push(weight);
        influences[i] += weight;
      }
    }
  }
  
  return {
    nodes: rows,
    edges,
    weights,
    influences
  };
}

/**
 * Build influence graph using random probe Jacobian approximation
 */
function buildJacobianInfluenceGraph(tensor: tf.Tensor): InfluenceGraph {
  const [rows, cols] = tensor.shape;
  const numProbes = Math.min(10, Math.ceil(Math.sqrt(rows)));
  
  const edges: number[][] = [];
  const weights: number[][] = [];
  const influences = new Array(rows).fill(0);
  
  for (let i = 0; i < rows; i++) {
    edges[i] = [];
    weights[i] = [];
  }
  
  // Perform random probes
  for (let probe = 0; probe < numProbes; probe++) {
    const input = tf.randomNormal([cols]);
    const output = tf.matMul(tensor, input.expandDims(1)).squeeze();
    
    const inputData = input.dataSync();
    const outputData = output.dataSync();
    
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const influence = Math.abs(outputData[i] * inputData[j]);
        if (influence > 1e-6) {
          const existingIdx = edges[i].indexOf(j);
          if (existingIdx >= 0) {
            weights[i][existingIdx] = Math.max(weights[i][existingIdx], influence);
          } else {
            edges[i].push(j);
            weights[i].push(influence);
          }
          influences[i] += influence / numProbes;
        }
      }
    }
    
    input.dispose();
    output.dispose();
  }
  
  return {
    nodes: rows,
    edges,
    weights,
    influences
  };
}

/**
 * Build block diagonal influence graph with cross-block couplers
 */
function buildBlockDiagonalGraph(tensor: tf.Tensor): InfluenceGraph {
  const data = tensor.arraySync() as number[][];
  const [rows, cols] = tensor.shape;
  const blockSize = Math.ceil(Math.sqrt(rows));
  
  const edges: number[][] = [];
  const weights: number[][] = [];
  const influences = new Array(rows).fill(0);
  
  for (let i = 0; i < rows; i++) {
    edges[i] = [];
    weights[i] = [];
    
    const blockI = Math.floor(i / blockSize);
    
    for (let j = 0; j < cols; j++) {
      const blockJ = Math.floor(j / blockSize);
      const weight = Math.abs(data[i][j]);
      
      // Enhanced coupling for cross-block connections
      let adjustedWeight = weight;
      if (blockI !== blockJ) {
        adjustedWeight *= 2; // Amplify cross-block influences
      }
      
      if (adjustedWeight > 1e-6) {
        edges[i].push(j);
        weights[i].push(adjustedWeight);
        influences[i] += adjustedWeight;
      }
    }
  }
  
  return {
    nodes: rows,
    edges,
    weights,
    influences
  };
}

/**
 * Analyze graph connectivity and centrality
 */
export function analyzeGraphConnectivity(graph: InfluenceGraph) {
  const { nodes, edges, weights, influences } = graph;
  
  // Calculate degree centrality
  const degreeCentrality = edges.map(nodeEdges => nodeEdges.length / (nodes - 1));
  
  // Calculate weighted centrality
  const weightedCentrality = influences.map(inf => inf / Math.max(...influences));
  
  // Calculate clustering coefficient (simplified)
  const clustering = new Array(nodes).fill(0);
  for (let i = 0; i < nodes; i++) {
    const neighbors = edges[i];
    if (neighbors.length < 2) continue;
    
    let triangles = 0;
    let possibleTriangles = (neighbors.length * (neighbors.length - 1)) / 2;
    
    for (let j = 0; j < neighbors.length; j++) {
      for (let k = j + 1; k < neighbors.length; k++) {
        const neighbor1 = neighbors[j];
        const neighbor2 = neighbors[k];
        
        if (edges[neighbor1].includes(neighbor2)) {
          triangles++;
        }
      }
    }
    
    clustering[i] = possibleTriangles > 0 ? triangles / possibleTriangles : 0;
  }
  
  return {
    totalEdges: edges.reduce((sum, nodeEdges) => sum + nodeEdges.length, 0),
    avgDegree: degreeCentrality.reduce((sum, d) => sum + d, 0) / nodes,
    maxInfluence: Math.max(...influences),
    avgInfluence: influences.reduce((sum, inf) => sum + inf, 0) / nodes,
    clustering: clustering.reduce((sum, c) => sum + c, 0) / nodes,
    degreeCentrality,
    weightedCentrality
  };
}

/**
 * Export graph for visualization
 */
export function exportGraphVisualization(graph: InfluenceGraph) {
  const { nodes, edges, weights, influences } = graph;
  
  const nodeData = [];
  const edgeData = [];
  
  // Prepare node data
  for (let i = 0; i < nodes; i++) {
    nodeData.push({
      id: i,
      influence: influences[i],
      degree: edges[i].length,
      x: i % Math.ceil(Math.sqrt(nodes)),
      y: Math.floor(i / Math.ceil(Math.sqrt(nodes)))
    });
  }
  
  // Prepare edge data
  for (let i = 0; i < nodes; i++) {
    for (let j = 0; j < edges[i].length; j++) {
      const target = edges[i][j];
      const weight = weights[i][j];
      
      edgeData.push({
        source: i,
        target,
        weight,
        normalized: weight / Math.max(...influences)
      });
    }
  }
  
  return { nodes: nodeData, edges: edgeData };
}
