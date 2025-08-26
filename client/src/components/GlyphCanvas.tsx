import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Combine as Compress, Download, Code } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface GlyphCanvasProps {
  modelId?: string;
  onGlyphGenerated: (result: any) => void;
  glyphResult?: any;
}

export default function GlyphCanvas({ modelId, onGlyphGenerated, glyphResult }: GlyphCanvasProps) {
  const [interiorBits, setInteriorBits] = useState(4);
  const [boundaryBits, setBoundaryBits] = useState(8);
  const [compressionLevel, setCompressionLevel] = useState([6]);
  const [eccStrength, setEccStrength] = useState("standard");
  const [primeMode, setPrimeMode] = useState("primes");
  const { toast } = useToast();

  const encodeMutation = useMutation({
    mutationFn: async () => {
      if (!modelId) {
        throw new Error("No model selected");
      }

      const response = await apiRequest("POST", "/api/encode", {
        modelId,
        params: {
          quant: {
            interiorBits,
            boundaryBits,
          },
          prime: {
            mode: primeMode,
            limit: 1000,
            start: 2,
            apLen: 5,
          },
        },
      });
      return response.json();
    },
    onSuccess: (data) => {
      onGlyphGenerated(data);
      toast({
        title: "Glyph Generated",
        description: `Compression ratio: ${data.stats.compressionRatio.toFixed(2)}:1`,
      });
    },
    onError: (error) => {
      toast({
        title: "Encoding Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const downloadPNG = () => {
    if (glyphResult?.glyphPngBase64) {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${glyphResult.glyphPngBase64}`;
      link.download = 'glyph.png';
      link.click();
    }
  };

  const downloadHeader = () => {
    if (glyphResult?.headerJson) {
      const blob = new Blob([JSON.stringify(glyphResult.headerJson, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'header.json';
      link.click();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Encoding Parameters */}
      <div className="lg:col-span-1 space-y-6">
        <Card className="bg-white shadow-sm border border-slate-200">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Encoding Parameters</h3>
            
            <div className="space-y-4">
              <div>
                <Label className="block text-sm font-medium text-slate-700 mb-2">Quantization</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Interior Bits</span>
                    <Select value={interiorBits.toString()} onValueChange={(v) => setInteriorBits(Number(v))}>
                      <SelectTrigger className="w-16">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="4">4</SelectItem>
                        <SelectItem value="5">5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Boundary Bits</span>
                    <Select value={boundaryBits.toString()} onValueChange={(v) => setBoundaryBits(Number(v))}>
                      <SelectTrigger className="w-16">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6">6</SelectItem>
                        <SelectItem value="8">8</SelectItem>
                        <SelectItem value="12">12</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              <div>
                <Label className="block text-sm font-medium text-slate-700 mb-2">Compression Level</Label>
                <Slider
                  value={compressionLevel}
                  onValueChange={setCompressionLevel}
                  min={1}
                  max={9}
                  step={1}
                  className="w-full"
                  data-testid="slider-compression"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Fast</span>
                  <span className="font-medium">Balanced</span>
                  <span>Best</span>
                </div>
              </div>

              <div>
                <Label className="block text-sm font-medium text-slate-700 mb-2">ECC Strength</Label>
                <Select value={eccStrength} onValueChange={setEccStrength}>
                  <SelectTrigger data-testid="select-ecc-strength">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light (5% overhead)</SelectItem>
                    <SelectItem value="standard">Standard (10% overhead)</SelectItem>
                    <SelectItem value="strong">Strong (20% overhead)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="block text-sm font-medium text-slate-700 mb-2">Prime Mode</Label>
                <Select value={primeMode} onValueChange={setPrimeMode}>
                  <SelectTrigger data-testid="select-prime-mode-encode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primes">Standard Primes</SelectItem>
                    <SelectItem value="ap">Arithmetic Progression</SelectItem>
                    <SelectItem value="p2plus4q2">p² + 4q² Anchors</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={() => encodeMutation.mutate()}
                disabled={!modelId || encodeMutation.isPending}
                className="w-full bg-glyph-blue hover:bg-blue-700 font-medium"
                data-testid="button-encode"
              >
                <Compress className="w-4 h-4 mr-2" />
                {encodeMutation.isPending ? "Encoding..." : "Encode to Glyph"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Compression Stats */}
        {glyphResult && (
          <Card className="bg-white shadow-sm border border-slate-200">
            <CardContent className="p-6">
              <h4 className="font-semibold text-slate-900 mb-3">Compression Stats</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Original Size</span>
                  <span className="font-mono">{glyphResult.stats.origBytes} bytes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Compressed</span>
                  <span className="font-mono text-glyph-emerald">{glyphResult.stats.compBytes} bytes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">ECC Overhead</span>
                  <span className="font-mono">{glyphResult.stats.eccBytes} bytes</span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t border-slate-200">
                  <span>Total Size</span>
                  <span className="font-mono">{glyphResult.stats.compBytes + glyphResult.stats.eccBytes} bytes</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Ratio</span>
                  <span className="text-glyph-emerald font-mono">{glyphResult.stats.compressionRatio?.toFixed(1)}:1</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Glyph Visualization */}
      <div className="lg:col-span-2">
        <Card className="bg-white shadow-sm border border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Generated Glyph</h3>
              {glyphResult && (
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={downloadPNG} data-testid="button-download-png">
                    <Download className="w-3 h-3 mr-1" />
                    PNG
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadHeader} data-testid="button-download-header">
                    <Code className="w-3 h-3 mr-1" />
                    Header
                  </Button>
                </div>
              )}
            </div>
            
            {/* Glyph Canvas */}
            <div className="glyph-grid relative bg-slate-900 rounded-xl p-6 flex items-center justify-center" style={{ minHeight: '400px' }}>
              {glyphResult ? (
                <div className="relative" data-testid="glyph-display">
                  <img 
                    src={`data:image/png;base64,${glyphResult.glyphPngBase64}`}
                    alt="Generated Glyph"
                    className="w-48 h-48 animate-glow"
                  />
                </div>
              ) : (
                <div className="text-center text-slate-400">
                  <div className="w-48 h-48 border-2 border-dashed border-slate-600 rounded-full flex items-center justify-center mb-4">
                    <Compress className="w-16 h-16" />
                  </div>
                  <p className="text-sm">Generate a glyph to see visualization</p>
                  <p className="text-xs text-slate-500 mt-1">Encode a model to create the symbolic artifact</p>
                </div>
              )}
            </div>

            {/* Glyph Information */}
            {glyphResult && (
              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <div className="font-medium text-slate-900">Checksum</div>
                  <div className="font-mono text-xs text-slate-600 mt-1">
                    SHA256: {glyphResult.stats.sha256?.substring(0, 8)}...
                  </div>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <div className="font-medium text-slate-900">Dimensions</div>
                  <div className="font-mono text-xs text-slate-600 mt-1">512x512 px</div>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <div className="font-medium text-slate-900">Encoding</div>
                  <div className="font-mono text-xs text-slate-600 mt-1">PNG + JSON</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Header Preview */}
        {glyphResult && (
          <Card className="bg-white shadow-sm border border-slate-200 mt-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Header JSON Preview</h3>
              <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto max-h-64">
                <pre data-testid="header-json-preview">
                  {JSON.stringify(glyphResult.headerJson, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
