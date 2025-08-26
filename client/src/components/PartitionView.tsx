import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Eye, Share, Table } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface PartitionViewProps {
  modelId?: string;
}

export default function PartitionView({ modelId }: PartitionViewProps) {
  const [boundaryThreshold, setBoundaryThreshold] = useState([0.5]);
  const [algorithm, setAlgorithm] = useState("abs");
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [showSupergraph, setShowSupergraph] = useState(false);

  const { data: graphData, isLoading } = useQuery({
    queryKey: ["/api/inspect", modelId],
    enabled: !!modelId,
  });

  const gridSize = 16;
  const partitionColors = [
    "bg-purple-200 border-purple-300",
    "bg-blue-200 border-blue-300", 
    "bg-green-200 border-green-300",
    "bg-yellow-200 border-yellow-300",
    "bg-red-200 border-red-300",
    "bg-indigo-200 border-indigo-300",
    "bg-pink-200 border-pink-300",
    "bg-teal-200 border-teal-300"
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Partition Configuration */}
      <div className="lg:col-span-1">
        <Card className="bg-white shadow-sm border border-slate-200">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Partition Settings</h3>
            
            <div className="space-y-4">
              <div>
                <Label className="block text-sm font-medium text-slate-700 mb-2">Block Size</Label>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-slate-600">√n =</span>
                  <span className="px-2 py-1 bg-slate-100 rounded font-mono text-sm">16</span>
                  <span className="text-sm text-slate-600">blocks</span>
                </div>
              </div>
              
              <div>
                <Label className="block text-sm font-medium text-slate-700 mb-2">Boundary Threshold</Label>
                <Slider
                  value={boundaryThreshold}
                  onValueChange={setBoundaryThreshold}
                  min={0.1}
                  max={2.0}
                  step={0.1}
                  className="w-full"
                  data-testid="slider-boundary-threshold"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>0.1</span>
                  <span className="font-medium">{boundaryThreshold[0]}</span>
                  <span>2.0</span>
                </div>
              </div>

              <div>
                <Label className="block text-sm font-medium text-slate-700 mb-2">Algorithm</Label>
                <Select value={algorithm} onValueChange={setAlgorithm}>
                  <SelectTrigger data-testid="select-algorithm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="abs">Influence Graph (|A|)</SelectItem>
                    <SelectItem value="jacobian">Random Probe Jacobian</SelectItem>
                    <SelectItem value="diagonal">Block Diagonal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full bg-glyph-blue hover:bg-blue-700" data-testid="button-recompute">
                <Table className="w-4 h-4 mr-2" />
                Recompute Graph
              </Button>
            </div>

            {/* Graph Statistics */}
            {graphData && (
              <div className="mt-6 pt-4 border-t border-slate-200 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Nodes</span>
                  <span className="font-medium">{graphData.graph?.n || 256}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Edges</span>
                  <span className="font-medium">{graphData.graph?.edges || 1843}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Boundaries</span>
                  <span className="font-medium text-boundary-orange">{graphData.boundaries || 47}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Partitions</span>
                  <span className="font-medium text-glyph-purple">{graphData.partitions?.length || 16}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Partition Heatmap */}
      <div className="lg:col-span-2">
        <Card className="bg-white shadow-sm border border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Partition View</h3>
              <div className="flex items-center space-x-2">
                <Button
                  variant={showBoundaries ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowBoundaries(!showBoundaries)}
                  data-testid="button-toggle-boundaries"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Boundaries
                </Button>
                <Button
                  variant={showSupergraph ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowSupergraph(!showSupergraph)}
                  data-testid="button-toggle-supergraph"
                >
                  <Share className="w-3 h-3 mr-1" />
                  Supergraph
                </Button>
              </div>
            </div>
            
            {/* Partition Grid */}
            <div className="relative">
              <div className="grid grid-cols-16 gap-1 p-4 bg-slate-50 rounded-lg" data-testid="partition-grid">
                {Array.from({ length: 256 }, (_, i) => {
                  const partitionId = Math.floor(i / 16);
                  const colorClass = partitionColors[partitionId % partitionColors.length];
                  const isBoundary = Math.random() > 0.7; // Simulate boundary detection
                  
                  return (
                    <div
                      key={i}
                      className={`
                        w-4 h-4 rounded-sm transition-all duration-300 hover:scale-105 hover:z-10
                        ${colorClass}
                        ${isBoundary && showBoundaries ? 'border-2 border-boundary-orange' : 'border'}
                      `}
                      data-testid={`partition-cell-${i}`}
                    />
                  );
                })}
              </div>
              
              {/* SVG Overlay for Boundary Connections */}
              {showSupergraph && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none" data-testid="boundary-arcs">
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="#ea580c" />
                    </marker>
                  </defs>
                  <path 
                    d="M 60 40 Q 100 20 140 40" 
                    stroke="#ea580c" 
                    strokeWidth="2" 
                    fill="none" 
                    strokeDasharray="5,5"
                    markerEnd="url(#arrowhead)"
                  />
                  <path 
                    d="M 80 80 Q 120 60 160 80" 
                    stroke="#ea580c" 
                    strokeWidth="2" 
                    fill="none" 
                    strokeDasharray="5,5"
                    markerEnd="url(#arrowhead)"
                  />
                  <path 
                    d="M 40 120 Q 80 100 120 120" 
                    stroke="#ea580c" 
                    strokeWidth="2" 
                    fill="none" 
                    strokeDasharray="5,5"
                    markerEnd="url(#arrowhead)"
                  />
                </svg>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between mt-4 text-sm">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-purple-200 border border-purple-300 rounded-sm"></div>
                  <span className="text-xs text-slate-600">Partition 0</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-blue-200 border border-blue-300 rounded-sm"></div>
                  <span className="text-xs text-slate-600">Partition 1</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 border-2 border-boundary-orange rounded-sm bg-white"></div>
                  <span className="text-xs text-slate-600">Boundary</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Supergraph Minimap */}
        <Card className="bg-white shadow-sm border border-slate-200 mt-6">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Supergraph Connectivity</h3>
            <div className="flex items-center justify-center h-32 bg-slate-50 rounded-lg">
              <div className="text-center text-slate-600">
                <Share className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm">Interactive supergraph visualization</p>
                <p className="text-xs text-slate-500">Shows connections between boundary nodes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
