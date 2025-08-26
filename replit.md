# Origamic Glyphic Compression (OGC) Demo

## Overview

This is a full-stack demo application for the Origamic Glyphic Compression (OGC) system - a novel compression paradigm inspired by origami folding, prime number theory, and graph partitioning algorithms. The system transforms AI models or datasets into colorful symbolic "glyphs" that serve as both visual artifacts and compressed data containers.

The application demonstrates the complete OGC pipeline: tensor synthesis, influence graph construction, prime-guided partitioning, SVD factorization, vector quantization, entropy coding, glyph generation, and reconstruction with error analysis.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for fast development and building
- **UI Library**: Tailwind CSS with shadcn/ui components for consistent, modern design
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Component Structure**: Modular component architecture with specialized panels for each OGC pipeline stage

### Backend Architecture
- **Runtime**: Node.js with Express.js serving both API endpoints and static assets
- **ML Processing**: TensorFlow.js (CPU) for tensor operations and mathematical computations
- **Storage**: In-memory storage with interface for future database integration via Drizzle ORM
- **Compression Pipeline**: Modular OGC implementation with separate modules for each processing stage
- **Build Strategy**: Single-process deployment where Vite builds the frontend and Express serves everything

### Data Processing Pipeline
- **Tensor Synthesis**: Generates synthetic models with configurable parameters, density, and block-diagonal structure
- **Influence Graph**: Builds weighted graphs using absolute values, Jacobian approximation, or block-diagonal methods
- **Partitioning**: √n-based graph partitioning with boundary node detection and supergraph construction
- **Prime Scheduling**: Uses standard primes, arithmetic progressions, or p²+4q² anchors for compression checkpoints
- **Factorization**: SVD-based low-rank approximation with rank determined by prime scheduling
- **Quantization**: K-means vector quantization with different precision tiers for interior vs boundary nodes
- **Entropy Coding**: Hilbert curve ordering with zlib compression and ECC parity
- **Glyph Generation**: PNG synthesis with embedded metadata, visual partition representation, and cryptographic headers

### Configuration Management
- **Development**: Uses tsx for TypeScript execution and Vite middleware for hot reloading
- **Production**: Builds frontend to dist/ and serves via Express static middleware
- **Database**: Drizzle ORM configured for PostgreSQL with migration support (currently using in-memory storage)
- **Styling**: PostCSS with Tailwind CSS, custom color variables for glyph visualization

## External Dependencies

### Core Technologies
- **@tensorflow/tfjs**: Client-side tensor operations and mathematical computations
- **express**: Web server framework for API and static file serving
- **vite**: Frontend build tool and development server
- **drizzle-orm**: Type-safe ORM for database operations with PostgreSQL dialect
- **@neondatabase/serverless**: Serverless PostgreSQL driver for production database

### UI and Visualization
- **@radix-ui/react-***: Headless UI primitives for accessible components
- **@tanstack/react-query**: Server state management and data fetching
- **recharts**: Chart library for data visualization and metrics display
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library for consistent iconography

### Compression and Encoding
- **pngjs**: PNG image manipulation for glyph generation
- **zlib**: Data compression for entropy coding stage
- **crypto**: Cryptographic operations for checksums and signatures
- **crc-32**: CRC32 checksum calculations for data integrity

### Development Tools
- **typescript**: Type safety and enhanced development experience
- **@replit/vite-plugin-***: Replit-specific development and debugging tools
- **wouter**: Lightweight routing for single-page application navigation