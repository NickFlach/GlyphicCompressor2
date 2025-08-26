import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Upload, Wand2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface UploadPanelProps {
  onModelGenerated: (model: any) => void;
}

export default function UploadPanel({ onModelGenerated }: UploadPanelProps) {
  const [parameters, setParameters] = useState(256);
  const [density, setDensity] = useState([0.3]);
  const [seed, setSeed] = useState(42);
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async (params: { n: number; density: number; seed: number }) => {
      const response = await apiRequest("POST", "/api/generate_synthetic", params);
      return response.json();
    },
    onSuccess: (data) => {
      onModelGenerated(data);
      toast({
        title: "Model Generated",
        description: `Created synthetic model with ${data.stats.parameters} parameters`,
      });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (tensors: number[][]) => {
      const response = await apiRequest("POST", "/api/upload_model", { tensors });
      return response.json();
    },
    onSuccess: (data) => {
      onModelGenerated(data);
      toast({
        title: "Model Uploaded",
        description: "Model uploaded successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      n: parameters,
      density: density[0],
      seed
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonData = JSON.parse(e.target?.result as string);
          if (jsonData.tensors && Array.isArray(jsonData.tensors)) {
            uploadMutation.mutate(jsonData.tensors);
          } else {
            toast({
              title: "Invalid File",
              description: "File must contain a 'tensors' array",
              variant: "destructive",
            });
          }
        } catch (error) {
          toast({
            title: "Parse Error",
            description: "Invalid JSON file",
            variant: "destructive",
          });
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <Card className="bg-white shadow-sm border border-slate-200">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Model Input</h3>
        
        {/* Upload Section */}
        <div className="mb-6">
          <Label className="block text-sm font-medium text-slate-700 mb-2">Upload Model</Label>
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-glyph-blue transition-colors cursor-pointer">
            <Upload className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <p className="text-sm text-slate-600 mb-1">Drop JSON tensor file or click to browse</p>
            <p className="text-xs text-slate-500">Max size: 1MB</p>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              data-testid="input-file-upload"
            />
          </div>
        </div>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-white text-slate-500">or</span>
          </div>
        </div>

        {/* Synthetic Generation */}
        <div className="space-y-4">
          <Label className="block text-sm font-medium text-slate-700">Generate Synthetic Model</Label>
          
          <div className="space-y-3">
            <div>
              <Label className="block text-xs font-medium text-slate-600 mb-1">Parameters (n)</Label>
              <Input
                type="number"
                value={parameters}
                onChange={(e) => setParameters(Number(e.target.value))}
                min={64}
                max={4096}
                className="w-full"
                data-testid="input-parameters"
              />
            </div>
            
            <div>
              <Label className="block text-xs font-medium text-slate-600 mb-1">Density</Label>
              <Slider
                value={density}
                onValueChange={setDensity}
                min={0.1}
                max={1.0}
                step={0.1}
                className="w-full"
                data-testid="slider-density"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>0.1</span>
                <span className="font-medium">{density[0]}</span>
                <span>1.0</span>
              </div>
            </div>
            
            <div>
              <Label className="block text-xs font-medium text-slate-600 mb-1">Seed</Label>
              <Input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                className="w-full"
                data-testid="input-seed"
              />
            </div>
          </div>
          
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="w-full bg-glyph-emerald hover:bg-emerald-700"
            data-testid="button-generate"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            {generateMutation.isPending ? "Generating..." : "Generate Model"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
