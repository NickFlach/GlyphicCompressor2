import type { InfluenceGraph } from './influence.js';
import { dijkstra } from './utils.js';

/**
 * Graph partitioning and boundary detection
 */

export interface Partition {
  id: number;
  nodes: number[];
  boundaries: number[];
  interiorNodes: number[];
  size: number;
}

export interface SuperGraph {
  nodes: number[];
  edges: Array<{ source: number; target: number; weight: number }>;
  distances: number[][];
}

export interface PartitionResult {
  partitions: Partition[];
  boundaries: number[];
  supergraph: SuperGraph;
  stats: {
    totalPartitions: number;
    totalBoundaries: number;
    avgPartitionSize: number;
    maxPartitionSize: number;
    boundaryDensity: number;
  };
}

/**
 * Partition graph into √n blocks with boundary detection
 */
export function partitionGraph(
  graph: InfluenceGraph, 
  boundaryThreshold: number = 0.5
): PartitionResult {
  const { nodes, edges, weights } = graph;
  const partitionSize = Math.ceil(Math.sqrt(nodes));
  const numPartitions = Math.ceil(nodes / partitionSize);
  
  // Create initial partitions based on spatial layout
  const partitions: Partition[] = [];
  for (let i = 0; i < numPartitions; i++) {
    const startIdx = i * partitionSize;
    const endIdx = Math.min((i + 1) * partitionSize, nodes);
    const partitionNodes = Array.from({ length: endIdx - startIdx }, (_, j) => startIdx + j);
    
    partitions.push({
      id: i,
      nodes: partitionNodes,
      boundaries: [],
      interiorNodes: [],
      size: partitionNodes.length
    });
  }
  
  // Detect boundary nodes
  const allBoundaries = new Set<number>();
  
  for (const partition of partitions) {
    for (const node of partition.nodes) {
      let crossPartitionConnections = 0;
      let totalConnections = edges[node].length;
      
      if (totalConnections === 0) continue;
      
      // Check connections to other partitions
      for (const target of edges[node]) {
        const targetPartition = Math.floor(target / partitionSize);
        const currentPartition = Math.floor(node / partitionSize);
        
        if (targetPartition !== currentPartition) {
          crossPartitionConnections++;
        }
      }
      
      const boundaryRatio = crossPartitionConnections / totalConnections;
      
      if (boundaryRatio >= boundaryThreshold) {
        partition.boundaries.push(node);
        allBoundaries.add(node);
      } else {
        partition.interiorNodes.push(node);
      }
    }
  }
  
  // Build supergraph between boundary nodes
  const boundaryArray = Array.from(allBoundaries);
  const supergraph = buildSupergraph(graph, boundaryArray);
  
  // Calculate statistics
  const stats = {
    totalPartitions: partitions.length,
    totalBoundaries: boundaryArray.length,
    avgPartitionSize: partitions.reduce((sum, p) => sum + p.size, 0) / partitions.length,
    maxPartitionSize: Math.max(...partitions.map(p => p.size)),
    boundaryDensity: boundaryArray.length / nodes
  };
  
  return {
    partitions,
    boundaries: boundaryArray,
    supergraph,
    stats
  };
}

/**
 * Build supergraph connecting boundary nodes
 */
function buildSupergraph(graph: InfluenceGraph, boundaries: number[]): SuperGraph {
  const boundarySet = new Set(boundaries);
  const supergraphEdges: Array<{ source: number; target: number; weight: number }> = [];
  
  // Direct connections between boundary nodes
  for (let i = 0; i < boundaries.length; i++) {
    const sourceNode = boundaries[i];
    
    for (let j = 0; j < graph.edges[sourceNode].length; j++) {
      const targetNode = graph.edges[sourceNode][j];
      
      if (boundarySet.has(targetNode) && sourceNode !== targetNode) {
        const weight = graph.weights[sourceNode][j];
        supergraphEdges.push({
          source: sourceNode,
          target: targetNode,
          weight
        });
      }
    }
  }
  
  // Calculate shortest paths between all boundary nodes
  const distances: number[][] = [];
  
  for (let i = 0; i < boundaries.length; i++) {
    distances[i] = new Array(boundaries.length).fill(Infinity);
    distances[i][i] = 0;
    
    // Use Dijkstra to find shortest paths from this boundary node
    const nodeDistances = dijkstraOnGraph(graph, boundaries[i]);
    
    for (let j = 0; j < boundaries.length; j++) {
      if (i !== j) {
        distances[i][j] = nodeDistances[boundaries[j]];
      }
    }
  }
  
  return {
    nodes: boundaries,
    edges: supergraphEdges,
    distances
  };
}

/**
 * Dijkstra's algorithm on influence graph
 */
function dijkstraOnGraph(graph: InfluenceGraph, start: number): number[] {
  const { nodes, edges, weights } = graph;
  const dist = new Array(nodes).fill(Infinity);
  const visited = new Array(nodes).fill(false);
  
  dist[start] = 0;
  
  for (let count = 0; count < nodes - 1; count++) {
    let u = -1;
    for (let v = 0; v < nodes; v++) {
      if (!visited[v] && (u === -1 || dist[v] < dist[u])) {
        u = v;
      }
    }
    
    if (u === -1 || dist[u] === Infinity) break;
    
    visited[u] = true;
    
    for (let i = 0; i < edges[u].length; i++) {
      const v = edges[u][i];
      const weight = 1 / weights[u][i]; // Convert influence to distance
      
      if (!visited[v] && dist[u] + weight < dist[v]) {
        dist[v] = dist[u] + weight;
      }
    }
  }
  
  return dist;
}

/**
 * Optimize partitions using boundary feedback
 */
export function optimizePartitions(
  graph: InfluenceGraph,
  initialResult: PartitionResult,
  maxIterations: number = 5
): PartitionResult {
  let currentResult = initialResult;
  
  for (let iter = 0; iter < maxIterations; iter++) {
    let improved = false;
    
    // Try to reassign boundary nodes to reduce cross-partition connections
    for (const partition of currentResult.partitions) {
      for (let i = partition.boundaries.length - 1; i >= 0; i--) {
        const boundaryNode = partition.boundaries[i];
        const bestPartition = findBestPartitionForNode(graph, boundaryNode, currentResult.partitions);
        
        if (bestPartition && bestPartition.id !== partition.id) {
          // Move node to better partition
          partition.boundaries.splice(i, 1);
          partition.nodes = partition.nodes.filter(n => n !== boundaryNode);
          partition.size--;
          
          bestPartition.nodes.push(boundaryNode);
          bestPartition.boundaries.push(boundaryNode);
          bestPartition.size++;
          
          improved = true;
        }
      }
    }
    
    if (!improved) break;
    
    // Rebuild supergraph with updated partitions
    const allBoundaries = currentResult.partitions.flatMap(p => p.boundaries);
    currentResult.supergraph = buildSupergraph(graph, allBoundaries);
  }
  
  return currentResult;
}

/**
 * Find best partition for a node based on connection strength
 */
function findBestPartitionForNode(
  graph: InfluenceGraph,
  node: number,
  partitions: Partition[]
): Partition | null {
  let bestPartition: Partition | null = null;
  let bestScore = -1;
  
  for (const partition of partitions) {
    let connectionStrength = 0;
    
    for (let i = 0; i < graph.edges[node].length; i++) {
      const target = graph.edges[node][i];
      const weight = graph.weights[node][i];
      
      if (partition.nodes.includes(target)) {
        connectionStrength += weight;
      }
    }
    
    if (connectionStrength > bestScore) {
      bestScore = connectionStrength;
      bestPartition = partition;
    }
  }
  
  return bestPartition;
}

/**
 * Export partition visualization data
 */
export function exportPartitionVisualization(result: PartitionResult) {
  const { partitions, boundaries, supergraph } = result;
  
  return {
    partitions: partitions.map(p => ({
      id: p.id,
      nodes: p.nodes,
      boundaries: p.boundaries,
      interiorNodes: p.interiorNodes,
      size: p.size,
      color: `hsl(${(p.id * 137.5) % 360}, 70%, 75%)`
    })),
    boundaries: boundaries.map(nodeId => ({
      id: nodeId,
      partition: Math.floor(nodeId / Math.ceil(Math.sqrt(partitions.length))),
      isBoundary: true
    })),
    supergraphConnections: supergraph.edges.map(edge => ({
      source: edge.source,
      target: edge.target,
      weight: edge.weight,
      normalized: edge.weight
    }))
  };
}
