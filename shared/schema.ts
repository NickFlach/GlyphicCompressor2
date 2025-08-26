import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Core tensor model storage
export const models = pgTable("models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  shape: jsonb("shape").notNull(), // [rows, cols]
  tensors: jsonb("tensors").notNull(), // tensor data as JSON
  parameters: integer("parameters").notNull(),
  sparsity: real("sparsity"),
  entropy: real("entropy"),
  created_at: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Compression results storage
export const compressions = pgTable("compressions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  model_id: varchar("model_id").references(() => models.id).notNull(),
  glyph_png_base64: text("glyph_png_base64").notNull(),
  header_json: jsonb("header_json").notNull(),
  original_bytes: integer("original_bytes").notNull(),
  compressed_bytes: integer("compressed_bytes").notNull(),
  ecc_bytes: integer("ecc_bytes").notNull(),
  compression_ratio: real("compression_ratio").notNull(),
  sha256: text("sha256").notNull(),
  created_at: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Graph analysis results
export const graphs = pgTable("graphs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  model_id: varchar("model_id").references(() => models.id).notNull(),
  nodes: integer("nodes").notNull(),
  edges: integer("edges").notNull(),
  partitions: integer("partitions").notNull(),
  boundaries: integer("boundaries").notNull(),
  influence_data: jsonb("influence_data").notNull(),
  partition_data: jsonb("partition_data").notNull(),
  supergraph_data: jsonb("supergraph_data").notNull(),
});

// Schema validation
export const insertModelSchema = createInsertSchema(models).omit({
  id: true,
  created_at: true,
});

export const insertCompressionSchema = createInsertSchema(compressions).omit({
  id: true,
  created_at: true,
});

export const insertGraphSchema = createInsertSchema(graphs).omit({
  id: true,
});

// Types
export type Model = typeof models.$inferSelect;
export type InsertModel = z.infer<typeof insertModelSchema>;
export type Compression = typeof compressions.$inferSelect;
export type InsertCompression = z.infer<typeof insertCompressionSchema>;
export type Graph = typeof graphs.$inferSelect;
export type InsertGraph = z.infer<typeof insertGraphSchema>;

// API request/response schemas
export const generateSyntheticSchema = z.object({
  n: z.number().int().min(64).max(4096),
  density: z.number().min(0.1).max(1.0),
  seed: z.number().int().optional(),
});

export const encodeSchema = z.object({
  modelId: z.string().optional(),
  tensors: z.any().optional(),
  params: z.object({
    partitionSize: z.number().optional(),
    quant: z.object({
      interiorBits: z.number().int().min(2).max(8),
      boundaryBits: z.number().int().min(4).max(16),
    }),
    prime: z.object({
      mode: z.enum(['primes', 'ap', 'p2plus4q2']),
      start: z.number().int().optional(),
      limit: z.number().int().optional(),
      apLen: z.number().int().optional(),
    }),
  }),
});

export const decodeSchema = z.object({
  glyphPngBase64: z.string(),
  headerJson: z.any(),
});

export type GenerateSyntheticRequest = z.infer<typeof generateSyntheticSchema>;
export type EncodeRequest = z.infer<typeof encodeSchema>;
export type DecodeRequest = z.infer<typeof decodeSchema>;
