import { type Model, type InsertModel, type Compression, type InsertCompression, type Graph, type InsertGraph } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Model operations
  getModel(id: string): Promise<Model | undefined>;
  createModel(model: InsertModel): Promise<Model>;
  getAllModels(): Promise<Model[]>;

  // Compression operations
  getCompression(id: string): Promise<Compression | undefined>;
  getCompressionByModelId(modelId: string): Promise<Compression | undefined>;
  createCompression(compression: InsertCompression): Promise<Compression>;

  // Graph operations
  getGraph(id: string): Promise<Graph | undefined>;
  getGraphByModelId(modelId: string): Promise<Graph | undefined>;
  createGraph(graph: InsertGraph): Promise<Graph>;
  updateGraph(id: string, graph: Partial<InsertGraph>): Promise<Graph | undefined>;
}

export class MemStorage implements IStorage {
  private models: Map<string, Model>;
  private compressions: Map<string, Compression>;
  private graphs: Map<string, Graph>;

  constructor() {
    this.models = new Map();
    this.compressions = new Map();
    this.graphs = new Map();
  }

  // Model operations
  async getModel(id: string): Promise<Model | undefined> {
    return this.models.get(id);
  }

  async createModel(insertModel: InsertModel): Promise<Model> {
    const id = randomUUID();
    const model: Model = {
      ...insertModel,
      id,
      created_at: new Date().toISOString(),
    };
    this.models.set(id, model);
    return model;
  }

  async getAllModels(): Promise<Model[]> {
    return Array.from(this.models.values());
  }

  // Compression operations
  async getCompression(id: string): Promise<Compression | undefined> {
    return this.compressions.get(id);
  }

  async getCompressionByModelId(modelId: string): Promise<Compression | undefined> {
    return Array.from(this.compressions.values()).find(
      (compression) => compression.model_id === modelId
    );
  }

  async createCompression(insertCompression: InsertCompression): Promise<Compression> {
    const id = randomUUID();
    const compression: Compression = {
      ...insertCompression,
      id,
      created_at: new Date().toISOString(),
    };
    this.compressions.set(id, compression);
    return compression;
  }

  // Graph operations
  async getGraph(id: string): Promise<Graph | undefined> {
    return this.graphs.get(id);
  }

  async getGraphByModelId(modelId: string): Promise<Graph | undefined> {
    return Array.from(this.graphs.values()).find(
      (graph) => graph.model_id === modelId
    );
  }

  async createGraph(insertGraph: InsertGraph): Promise<Graph> {
    const id = randomUUID();
    const graph: Graph = { ...insertGraph, id };
    this.graphs.set(id, graph);
    return graph;
  }

  async updateGraph(id: string, updateGraph: Partial<InsertGraph>): Promise<Graph | undefined> {
    const existing = this.graphs.get(id);
    if (!existing) return undefined;
    
    const updated: Graph = { ...existing, ...updateGraph };
    this.graphs.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();
