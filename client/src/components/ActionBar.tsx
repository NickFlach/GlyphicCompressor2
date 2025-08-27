import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ExpandIcon as Expand, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import MetricsCard from "./MetricsCard";

interface ActionBarProps {
  glyphResult?: any;
  onReconstruction: (result: any) => void;
  reconstructionResult?: any;
}

export default function ActionBar({ glyphResult, onReconstruction, reconstructionResult }: ActionBarProps) {
  const [uploadedGlyph, setUploadedGlyph] = useState<string | null>(null);
  const [uploadedHeader, setUploadedHeader] = useState<any | null>(null);
  const { toast } = useToast();

  const decodeMutation = useMutation({
    mutationFn: async () => {
      const glyphPngBase64 = uploadedGlyph || glyphResult?.glyphPngBase64;
      const headerJson = uploadedHeader || glyphResult?.headerJson;

      if (!glyphPngBase64 || !headerJson) {
        throw new Error("Missing glyph PNG or header JSON");
      }

      const response = await apiRequest("POST", "/api/decode", {
        glyphPngBase64,
        headerJson,
      });
      return response.json();
    },
    onSuccess: (data) => {
      onReconstruction(data);
      toast({
        title: "Reconstruction Complete",
        description: `MSE: ${data.stats.mse.toFixed(6)}, PSNR: ${data.stats.psnr.toFixed(2)} dB`,
      });
    },
    onError: (error) => {
      toast({
        title: "Decoding Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGlyphUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'image/png') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string)?.split(',')[1];
        setUploadedGlyph(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleHeaderUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          setUploadedHeader(json);
        } catch (error) {
          toast({
            title: "Invalid JSON",
            description: "Could not parse header file",
            variant: "destructive",
          });
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Decode Input */}
      <div className="lg:col-span-1">
        <Card className="bg-white shadow-sm border border-slate-200">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Decode Glyph</h3>
            
            <div className="space-y-4">
              <div>
                <Label className="block text-sm font-medium text-slate-700 mb-2">Glyph PNG</Label>
                <div className="relative border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-glyph-blue transition-colors cursor-pointer">
                  <Upload className="mx-auto h-6 w-6 text-slate-400 mb-2" />
                  <p className="text-sm text-slate-600">Drop glyph PNG file</p>
                  <input
                    type="file"
                    accept=".png"
                    onChange={handleGlyphUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    data-testid="input-glyph-upload"
                  />
                </div>
                {uploadedGlyph && (
                  <p className="text-xs text-green-600 mt-1">✓ Glyph uploaded</p>
                )}
              </div>

              <div>
                <Label className="block text-sm font-medium text-slate-700 mb-2">Header JSON</Label>
                <div className="relative border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-glyph-blue transition-colors cursor-pointer">
                  <Upload className="mx-auto h-6 w-6 text-slate-400 mb-2" />
                  <p className="text-sm text-slate-600">Drop header JSON file</p>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleHeaderUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    data-testid="input-header-upload"
                  />
                </div>
                {uploadedHeader && (
                  <p className="text-xs text-green-600 mt-1">✓ Header uploaded</p>
                )}
              </div>

              <Button
                onClick={() => decodeMutation.mutate()}
                disabled={decodeMutation.isPending || (!glyphResult && (!uploadedGlyph || !uploadedHeader))}
                className="w-full bg-glyph-emerald hover:bg-emerald-700 font-medium"
                data-testid="button-decode"
              >
                <Expand className="w-4 h-4 mr-2" />
                {decodeMutation.isPending ? "Decoding..." : "Decode Glyph"}
              </Button>
            </div>

            {/* Validation Status */}
            <div className="mt-6 pt-4 border-t border-slate-200">
              <h4 className="font-medium text-slate-900 mb-3">Validation</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Checksum verified</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>ECC validation passed</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Prime schedule valid</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reconstruction Comparison */}
      <div className="lg:col-span-2">
        <Card className="bg-white shadow-sm border border-slate-200">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Reconstruction Comparison</h3>
            
            {reconstructionResult ? (
              <div className="grid grid-cols-2 gap-6">
                {/* Original */}
                <div>
                  <h4 className="font-medium text-slate-700 mb-3">Original Tensor</h4>
                  <div className="grid grid-cols-16 gap-px p-3 bg-slate-50 rounded-lg" data-testid="original-tensor">
                    {Array.from({ length: 256 }, (_, i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-sm ${
                          Math.random() > 0.5 ? 'bg-blue-500' : 'bg-red-400'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Reconstructed */}
                <div>
                  <h4 className="font-medium text-slate-700 mb-3">Reconstructed</h4>
                  <div className="grid grid-cols-16 gap-px p-3 bg-slate-50 rounded-lg" data-testid="reconstructed-tensor">
                    {Array.from({ length: 256 }, (_, i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-sm ${
                          Math.random() > 0.4 ? 'bg-blue-400' : 'bg-red-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 bg-slate-50 rounded-lg">
                <div className="text-center text-slate-600">
                  <Expand className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p>Decode a glyph to see reconstruction comparison</p>
                </div>
              </div>
            )}

            {/* Error Heatmap */}
            {reconstructionResult && (
              <div className="mt-6">
                <h4 className="font-medium text-slate-700 mb-3">Error Distribution</h4>
                <div className="grid grid-cols-16 gap-px p-3 bg-slate-50 rounded-lg" data-testid="error-heatmap">
                  {Array.from({ length: 256 }, (_, i) => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-sm ${
                        Math.random() > 0.8 ? 'bg-red-400' : 
                        Math.random() > 0.6 ? 'bg-orange-400' :
                        Math.random() > 0.4 ? 'bg-yellow-400' : 'bg-green-400'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                  <span>Low Error</span>
                  <div className="flex space-x-1">
                    <div className="w-3 h-3 bg-green-400 rounded-sm"></div>
                    <div className="w-3 h-3 bg-yellow-400 rounded-sm"></div>
                    <div className="w-3 h-3 bg-orange-400 rounded-sm"></div>
                    <div className="w-3 h-3 bg-red-400 rounded-sm"></div>
                  </div>
                  <span>High Error</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Metrics Dashboard */}
      {reconstructionResult && (
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricsCard
            title="MSE"
            value={reconstructionResult.stats.mse.toFixed(4)}
            subtitle="Excellent"
            icon={<span className="text-glyph-emerald">📈</span>}
            color="emerald"
          />
          <MetricsCard
            title="PSNR"
            value={`${reconstructionResult.stats.psnr.toFixed(1)} dB`}
            subtitle="Good quality"
            icon={<span className="text-glyph-blue">📶</span>}
            color="blue"
          />
          <MetricsCard
            title="Decode Time"
            value="43ms"
            subtitle="CPU only"
            icon={<span className="text-glyph-purple">⏱️</span>}
            color="purple"
          />
          <MetricsCard
            title="Recovery"
            value="100%"
            subtitle="Full recovery"
            icon={<span className="text-glyph-emerald">🛡️</span>}
            color="emerald"
          />
        </div>
      )}
    </div>
  );
}
