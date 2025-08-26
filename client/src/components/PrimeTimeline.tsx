import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator } from "lucide-react";

export default function PrimeTimeline() {
  const [primeMode, setPrimeMode] = useState("primes");
  const [rangeLimit, setRangeLimit] = useState(1000);
  const [startPrime, setStartPrime] = useState(2);
  const [apLength, setApLength] = useState(5);

  // Mock prime data
  const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37];
  const checkpoints = [5, 11, 23];
  const anchors = [5, 13, 29];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Prime Configuration */}
      <div className="lg:col-span-1">
        <Card className="bg-white shadow-sm border border-slate-200">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Prime Scheduling</h3>
            
            <div className="space-y-4">
              <div>
                <Label className="block text-sm font-medium text-slate-700 mb-2">Mode</Label>
                <Select value={primeMode} onValueChange={setPrimeMode}>
                  <SelectTrigger data-testid="select-prime-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primes">Standard Primes</SelectItem>
                    <SelectItem value="ap">Arithmetic Progression</SelectItem>
                    <SelectItem value="p2plus4q2">p² + 4q² Anchors</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="block text-sm font-medium text-slate-700 mb-2">Range Limit</Label>
                <Input
                  type="number"
                  value={rangeLimit}
                  onChange={(e) => setRangeLimit(Number(e.target.value))}
                  min={100}
                  max={10000}
                  data-testid="input-range-limit"
                />
              </div>

              <div>
                <Label className="block text-sm font-medium text-slate-700 mb-2">Start Prime</Label>
                <Input
                  type="number"
                  value={startPrime}
                  onChange={(e) => setStartPrime(Number(e.target.value))}
                  min={2}
                  data-testid="input-start-prime"
                />
              </div>

              <div>
                <Label className="block text-sm font-medium text-slate-700 mb-2">AP Length (if applicable)</Label>
                <Input
                  type="number"
                  value={apLength}
                  onChange={(e) => setApLength(Number(e.target.value))}
                  min={3}
                  max={20}
                  data-testid="input-ap-length"
                />
              </div>

              <Button className="w-full bg-glyph-purple hover:bg-purple-800" data-testid="button-generate-schedule">
                <Calculator className="w-4 h-4 mr-2" />
                Generate Schedule
              </Button>
            </div>

            {/* Prime Statistics */}
            <div className="mt-6 pt-4 border-t border-slate-200 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Total Primes</span>
                <span className="font-medium">168</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Checkpoints</span>
                <span className="font-medium text-prime-gold">23</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Anchors</span>
                <span className="font-medium text-glyph-purple">7</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Max Gap</span>
                <span className="font-medium">14</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Prime Timeline */}
      <div className="lg:col-span-3">
        <Card className="bg-white shadow-sm border border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Prime Timeline</h3>
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <span>Range: 2 - {rangeLimit}</span>
                <span>•</span>
                <span>Active: 168 primes</span>
              </div>
            </div>
            
            {/* Timeline Visualization */}
            <div className="relative">
              <div className="flex items-center space-x-1 overflow-x-auto pb-4" data-testid="prime-timeline">
                {primes.map((prime, index) => {
                  const isCheckpoint = checkpoints.includes(prime);
                  const isAnchor = anchors.includes(prime);
                  
                  return (
                    <div key={prime} className="flex items-center">
                      <div className="flex-shrink-0 flex flex-col items-center">
                        <div 
                          className={`w-3 h-3 rounded-full ${
                            isAnchor 
                              ? 'bg-red-500 animate-pulse' 
                              : isCheckpoint 
                                ? 'bg-prime-gold animate-pulse' 
                                : 'bg-glyph-purple'
                          }`}
                          data-testid={`prime-marker-${prime}`}
                        />
                        <span className="text-xs text-slate-500 mt-1">{prime}</span>
                        {(isCheckpoint || isAnchor) && (
                          <span className="text-xs font-medium text-prime-gold">✓</span>
                        )}
                      </div>
                      {index < primes.length - 1 && (
                        <div className="flex-shrink-0 w-4 h-px bg-slate-300 mx-1"></div>
                      )}
                    </div>
                  );
                })}
                <span className="text-slate-400 text-sm ml-4">...</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center space-x-6 mt-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-glyph-purple rounded-full"></div>
                <span className="text-slate-600">Standard Prime</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-prime-gold rounded-full"></div>
                <span className="text-slate-600">Checkpoint</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-slate-600">Anchor (p² + 4q²)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Precision Allocation Preview */}
        <Card className="bg-white shadow-sm border border-slate-200 mt-6">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Precision Tier Allocation</h3>
            <div className="grid grid-cols-8 gap-2" data-testid="precision-allocation">
              {[
                { bits: 3, color: 'from-green-200 to-green-400', text: 'green-800' },
                { bits: 3, color: 'from-green-200 to-green-400', text: 'green-800' },
                { bits: 4, color: 'from-yellow-200 to-yellow-400', text: 'yellow-800' },
                { bits: 6, color: 'from-orange-200 to-orange-400', text: 'orange-800' },
                { bits: 3, color: 'from-green-200 to-green-400', text: 'green-800' },
                { bits: 4, color: 'from-yellow-200 to-yellow-400', text: 'yellow-800' },
                { bits: 8, color: 'from-red-200 to-red-400', text: 'red-800' },
                { bits: 6, color: 'from-orange-200 to-orange-400', text: 'orange-800' },
              ].map((tier, index) => (
                <div
                  key={index}
                  className={`h-16 bg-gradient-to-t ${tier.color} rounded-lg flex items-center justify-center text-sm font-medium text-${tier.text}`}
                  data-testid={`precision-tier-${index}`}
                >
                  {tier.bits}-bit
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
