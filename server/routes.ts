import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { generateSyntheticSchema, encodeSchema, decodeSchema } from "@shared/schema.js";
import { generateSynthetic, serializeTensors, getTensorStats } from "./ogc/tensors.js";
import { buildInfluenceGraph, analyzeGraphConnectivity, exportGraphVisualization } from "./ogc/influence.js";
import { partitionGraph, optimizePartitions, exportPartitionVisualization } from "./ogc/partition.js";
import { createPrimeSchedule, applyPrimeScheduling, exportPrimeTimeline } from "./ogc/primes.js";
import { factorizePartitions, exportFactorizationAnalysis } from "./ogc/factorize.js";
import { quantizePartitions, analyzeQuantizationQuality } from "./ogc/quantize.js";
import { applyEntropyCoding } from "./ogc/entropy.js";
import { generateGlyph } from "./ogc/glyph.js";
import { reconstructFromCompression, calculateReconstructionMetrics } from "./ogc/reconstruct.js";
import cors from "cors";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(cors());
  
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Generate synthetic model
  app.post("/api/generate_synthetic", async (req, res) => {
    try {
      const { n, density, seed } = generateSyntheticSchema.parse(req.body);
      
      const model = await generateSynthetic(n, density, seed);
      const serialized = serializeTensors(model);
      const stats = getTensorStats(model);
      
      // Store model
      const storedModel = await storage.createModel({
        name: model.modelId,
        shape: model.shape,
        tensors: serialized.tensors,
        parameters: model.parameters,
        sparsity: model.sparsity,
        entropy: model.entropy,
      });

      res.json({
        modelId: storedModel.id,
        shapes: model.shape,
        stats: {
          ...stats,
          modelId: model.modelId
        }
      });
    } catch (error) {
      console.error("Generate synthetic error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload model
  app.post("/api/upload_model", async (req, res) => {
    try {
      const { tensors, name = "uploaded_model" } = req.body;
      
      if (!tensors || !Array.isArray(tensors)) {
        return res.status(400).json({ error: "Invalid tensor data" });
      }

      // Calculate basic stats
      const flatValues = tensors.flat(2).filter(x => typeof x === 'number');
      const nonZeroValues = flatValues.filter(x => Math.abs(x) > 1e-6);
      const sparsity = 1 - (nonZeroValues.length / flatValues.length);
      
      // Simple entropy calculation
      const entropy = flatValues.length > 0 ? Math.log2(new Set(flatValues.map(x => Math.round(x * 100))).size) : 0;
      
      const storedModel = await storage.createModel({
        name,
        shape: [tensors.length, tensors[0]?.length || 0],
        tensors,
        parameters: flatValues.length,
        sparsity,
        entropy,
      });

      res.json({ modelId: storedModel.id });
    } catch (error) {
      console.error("Upload model error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Encode model to glyph
  app.post("/api/encode", async (req, res) => {
    try {
      const { modelId, tensors, params } = encodeSchema.parse(req.body);
      
      let model;
      if (modelId) {
        const storedModel = await storage.getModel(modelId);
        if (!storedModel) {
          return res.status(404).json({ error: "Model not found" });
        }
        
        model = {
          tensors: storedModel.tensors,
          shape: storedModel.shape,
          parameters: storedModel.parameters,
          sparsity: storedModel.sparsity,
          entropy: storedModel.entropy,
          modelId: storedModel.id
        };
      } else if (tensors) {
        model = { tensors, shape: [tensors.length, tensors[0]?.length || 0], parameters: tensors.flat().length, sparsity: 0, entropy: 0, modelId: 'temp' };
      } else {
        return res.status(400).json({ error: "Either modelId or tensors required" });
      }

      // Build influence graph
      const tensorModel = { tensors: [{ dataSync: () => model.tensors.flat(), shape: model.shape, arraySync: () => model.tensors }], ...model };
      const influenceGraph = await buildInfluenceGraph(tensorModel);
      
      // Partition graph
      const partitionResult = partitionGraph(influenceGraph);
      
      // Create prime schedule
      const primeSchedule = createPrimeSchedule(
        params.prime.mode,
        {
          limit: params.prime.limit || 1000,
          start: params.prime.start || 2,
          apLength: params.prime.apLen || 5,
          anchorCount: 10
        }
      );
      
      // Apply factorization (simplified for demo)
      const mockFactorization = {
        partitions: partitionResult.partitions.map(p => ({
          partitionId: p.id,
          U: [[1, 0], [0, 1]],
          S: [1, 0.5],
          V: [[1, 0], [0, 1]],
          rank: 2,
          originalSize: p.size * p.size,
          compressedSize: p.size,
          compressionRatio: p.size
        })),
        totalOriginalSize: model.parameters,
        totalCompressedSize: Math.floor(model.parameters * 0.3),
        avgCompressionRatio: 3.33
      };
      
      // Quantize
      const quantizationResult = quantizePartitions(mockFactorization, partitionResult, params.quant);
      
      // Apply entropy coding
      const entropyResult = applyEntropyCoding(quantizationResult, partitionResult);
      
      // Generate glyph
      const glyphResult = generateGlyph(entropyResult, partitionResult, primeSchedule, model.modelId);
      
      // Store compression result
      const compression = await storage.createCompression({
        model_id: modelId || 'temp',
        glyph_png_base64: glyphResult.pngBase64,
        header_json: glyphResult.headerJson,
        original_bytes: entropyResult.stats.originalBytes,
        compressed_bytes: entropyResult.stats.compressedBytes,
        ecc_bytes: entropyResult.stats.eccBytes,
        compression_ratio: entropyResult.stats.compressionRatio,
        sha256: entropyResult.header.checksums.sha256
      });

      res.json({
        glyphPngBase64: glyphResult.pngBase64,
        headerJson: glyphResult.headerJson,
        stats: {
          origBytes: entropyResult.stats.originalBytes,
          compBytes: entropyResult.stats.compressedBytes,
          eccBytes: entropyResult.stats.eccBytes,
          sha256: entropyResult.header.checksums.sha256,
          compressionRatio: entropyResult.stats.compressionRatio
        }
      });
    } catch (error) {
      console.error("Encode error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Decode glyph
  app.post("/api/decode", async (req, res) => {
    try {
      const { glyphPngBase64, headerJson } = decodeSchema.parse(req.body);
      
      const reconstructionResult = await reconstructFromCompression(
        Buffer.from(glyphPngBase64, 'base64'),
        headerJson
      );
      
      res.json({
        tensors: reconstructionResult.tensors,
        stats: {
          mse: reconstructionResult.metrics.mse,
          psnr: reconstructionResult.metrics.psnr,
          checksumOk: reconstructionResult.verified
        }
      });
    } catch (error) {
      console.error("Decode error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Inspect model
  app.get("/api/inspect/:modelId", async (req, res) => {
    try {
      const { modelId } = req.params;
      
      const model = await storage.getModel(modelId);
      if (!model) {
        return res.status(404).json({ error: "Model not found" });
      }

      // Get or create graph analysis
      let graph = await storage.getGraphByModelId(modelId);
      
      if (!graph) {
        // Build influence graph
        const tensorModel = { 
          tensors: [{ 
            dataSync: () => model.tensors.flat(), 
            shape: model.shape, 
            arraySync: () => model.tensors 
          }], 
          shape: model.shape,
          parameters: model.parameters,
          sparsity: model.sparsity,
          entropy: model.entropy,
          modelId: model.id
        };
        
        const influenceGraph = await buildInfluenceGraph(tensorModel);
        const partitionResult = partitionGraph(influenceGraph);
        
        graph = await storage.createGraph({
          model_id: modelId,
          nodes: influenceGraph.nodes,
          edges: influenceGraph.edges.reduce((sum, edges) => sum + edges.length, 0),
          partitions: partitionResult.partitions.length,
          boundaries: partitionResult.boundaries.length,
          influence_data: exportGraphVisualization(influenceGraph),
          partition_data: exportPartitionVisualization(partitionResult),
          supergraph_data: partitionResult.supergraph
        });
      }

      res.json({
        graph: {
          n: graph.nodes,
          edges: graph.edges
        },
        partitions: graph.partition_data,
        boundaries: graph.boundaries,
        supergraph: graph.supergraph_data
      });
    } catch (error) {
      console.error("Inspect error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get models list
  app.get("/api/models", async (req, res) => {
    try {
      const models = await storage.getAllModels();
      res.json(models);
    } catch (error) {
      console.error("Get models error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
