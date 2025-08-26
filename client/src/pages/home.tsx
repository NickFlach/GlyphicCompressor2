import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import UploadPanel from "@/components/UploadPanel";
import PartitionView from "@/components/PartitionView";
import PrimeTimeline from "@/components/PrimeTimeline";
import GlyphCanvas from "@/components/GlyphCanvas";
import MetricsCard from "@/components/MetricsCard";
import ActionBar from "@/components/ActionBar";
import { Box, Projector as ProjectDiagram, Calculator, Combine, Expand, Download } from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState("model");
  const [currentModel, setCurrentModel] = useState(null);
  const [glyphResult, setGlyphResult] = useState(null);
  const [reconstructionResult, setReconstructionResult] = useState(null);
  const { toast } = useToast();

  const handleModelGenerated = (model) => {
    setCurrentModel(model);
    toast({
      title: "Model Generated",
      description: "Synthetic model created successfully",
    });
  };

  const handleGlyphGenerated = (result) => {
    setGlyphResult(result);
    toast({
      title: "Glyph Generated",
      description: "Compression completed successfully",
    });
  };

  const handleReconstruction = (result) => {
    setReconstructionResult(result);
    toast({
      title: "Reconstruction Complete",
      description: "Glyph decoded successfully",
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-glyph-purple to-glyph-blue rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">Φ</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Origamic Glyphic Compression</h1>
                <p className="text-sm text-slate-600">Mathematical artifact compression system</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>System Ready</span>
              </div>
              <Button 
                className="bg-glyph-blue hover:bg-blue-700" 
                data-testid="button-export"
                disabled={!glyphResult}
              >
                <Download className="w-4 h-4 mr-2" />
                Export Results
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="model" data-testid="tab-model">
              <Box className="w-4 h-4 mr-2" />
              Model
            </TabsTrigger>
            <TabsTrigger value="graph" data-testid="tab-graph">
              <ProjectDiagram className="w-4 h-4 mr-2" />
              Graph
            </TabsTrigger>
            <TabsTrigger value="primes" data-testid="tab-primes">
              <Calculator className="w-4 h-4 mr-2" />
              Primes
            </TabsTrigger>
            <TabsTrigger value="encode" data-testid="tab-encode">
              <Combine className="w-4 h-4 mr-2" />
              Encode
            </TabsTrigger>
            <TabsTrigger value="decode" data-testid="tab-decode">
              <Expand className="w-4 h-4 mr-2" />
              Decode
            </TabsTrigger>
          </TabsList>

          {/* Model Tab */}
          <TabsContent value="model" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <UploadPanel onModelGenerated={handleModelGenerated} />
              </div>
              <div className="lg:col-span-2">
                <Card className="bg-white shadow-sm border border-slate-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-slate-900">Tensor Heatmap</h3>
                      {currentModel && (
                        <div className="flex items-center space-x-2 text-sm text-slate-600">
                          <span>Shape: [{currentModel.shapes?.join(', ')}]</span>
                          <span>•</span>
                          <span>{currentModel.stats?.parameters} parameters</span>
                        </div>
                      )}
                    </div>
                    
                    {currentModel ? (
                      <div className="grid grid-cols-16 gap-1 p-4 bg-slate-50 rounded-lg" data-testid="tensor-heatmap">
                        {Array.from({ length: 256 }, (_, i) => (
                          <div
                            key={i}
                            className={`w-4 h-4 rounded-sm ${
                              Math.random() > 0.5 ? 'bg-blue-400' : 'bg-red-300'
                            }`}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-64 bg-slate-50 rounded-lg">
                        <div className="text-center text-slate-600">
                          <Box className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                          <p>Generate or upload a model to view tensor heatmap</p>
                        </div>
                      </div>
                    )}

                    {currentModel && (
                      <div className="flex items-center justify-between mt-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-600">Value Range:</span>
                          <div className="flex items-center space-x-1">
                            <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                            <span className="text-xs text-slate-500">-2.1</span>
                            <div className="w-8 bg-gradient-to-r from-red-500 via-white to-blue-600 h-3 rounded-sm mx-2"></div>
                            <span className="text-xs text-slate-500">+2.1</span>
                            <div className="w-3 h-3 bg-blue-600 rounded-sm"></div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" data-testid="button-export-heatmap">
                          <Download className="w-3 h-3 mr-1" />
                          Export
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Model Statistics */}
            {currentModel && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MetricsCard
                  title="Parameters"
                  value={currentModel.stats?.parameters?.toLocaleString() || "0"}
                  icon={<span className="text-glyph-blue">#</span>}
                  color="blue"
                />
                <MetricsCard
                  title="Memory"
                  value={`${currentModel.stats?.memoryKB?.toFixed(2) || "0"} KB`}
                  icon={<span className="text-glyph-emerald">💾</span>}
                  color="emerald"
                />
                <MetricsCard
                  title="Sparsity"
                  value={`${Math.round((currentModel.stats?.sparsity || 0) * 100)}%`}
                  icon={<span className="text-glyph-purple">📊</span>}
                  color="purple"
                />
                <MetricsCard
                  title="Entropy"
                  value={`${currentModel.stats?.entropy?.toFixed(1) || "0"} bits`}
                  icon={<span className="text-boundary-orange">📈</span>}
                  color="orange"
                />
              </div>
            )}
          </TabsContent>

          {/* Graph Tab */}
          <TabsContent value="graph" className="space-y-6">
            <PartitionView modelId={currentModel?.modelId} />
          </TabsContent>

          {/* Primes Tab */}
          <TabsContent value="primes" className="space-y-6">
            <PrimeTimeline />
          </TabsContent>

          {/* Encode Tab */}
          <TabsContent value="encode" className="space-y-6">
            <GlyphCanvas 
              modelId={currentModel?.modelId}
              onGlyphGenerated={handleGlyphGenerated}
              glyphResult={glyphResult}
            />
          </TabsContent>

          {/* Decode Tab */}
          <TabsContent value="decode" className="space-y-6">
            <ActionBar 
              glyphResult={glyphResult}
              onReconstruction={handleReconstruction}
              reconstructionResult={reconstructionResult}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
