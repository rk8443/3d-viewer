import React, { useState, useRef } from 'react';
import { PointCloudCanvas } from '@/components/PointCloudCanvas';
import { parseCsv, generateDemoCloud, PointCloudData } from '@/lib/point-cloud';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';

export default function Home() {
  const [data, setData] = useState<PointCloudData | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [pointSize, setPointSize] = useState<number>(2);
  const [colorMode, setColorMode] = useState<'height' | 'intensity' | 'uniform'>('height');
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    processFile(file);
  };

  const processFile = (file: File) => {
    setFilename(file.name);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsv(text);
      setData(parsed);
    };
    
    reader.readAsText(file);
  };

  const loadDemo = () => {
    setData(generateDemoCloud());
    setFilename('demo_torus.bin');
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const formatNumber = (num: number) => new Intl.NumberFormat().format(num);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden dark text-foreground">
      {/* Sidebar Controls */}
      <div className="w-80 border-r border-border bg-card flex flex-col z-10 shrink-0">
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-mono font-semibold tracking-tight text-primary">LMI INSPECT // 3D</h1>
          <p className="text-xs text-muted-foreground mt-1">Precision Point Cloud Viewer</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Data Source</Label>
            <div 
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/50'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".csv,.txt,.xyz,.lmi,.bin"
                onChange={handleFileUpload}
              />
              <p className="text-sm font-medium">Click or drag file here</p>
              <p className="text-xs text-muted-foreground mt-1">CSV, TXT, XYZ</p>
            </div>
            <Button variant="outline" className="w-full text-xs" onClick={loadDemo}>
              Load Demo Dataset
            </Button>
          </div>

          <Separator />

          <div className="space-y-4">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Visualization</Label>
            
            <div className="space-y-3">
              <Label className="text-sm">Color Map</Label>
              <RadioGroup 
                value={colorMode} 
                onValueChange={(v) => setColorMode(v as any)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="height" id="r1" />
                  <Label htmlFor="r1" className="text-sm font-normal">Height (Z-Axis)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="intensity" id="r2" />
                  <Label htmlFor="r2" className="text-sm font-normal">Intensity (Greyscale)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="uniform" id="r3" />
                  <Label htmlFor="r3" className="text-sm font-normal">Uniform (Cyan)</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex justify-between">
                <Label className="text-sm">Point Size</Label>
                <span className="text-xs text-muted-foreground font-mono">{pointSize.toFixed(1)}</span>
              </div>
              <Slider 
                value={[pointSize]} 
                min={0.5} 
                max={10} 
                step={0.1}
                onValueChange={(v) => setPointSize(v[0])}
              />
            </div>
          </div>
          
          <Separator />
          
          {data && (
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Dataset Info</Label>
              <div className="bg-muted rounded-md p-3 space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">File</span>
                  <span className="truncate max-w-[120px]" title={filename}>{filename}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Points</span>
                  <span>{formatNumber(data.pointCount)}</span>
                </div>
                <div className="pt-1 border-t border-border mt-1">
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">X Range</span>
                    <span>{(data.boundingBox.max[0] - data.boundingBox.min[0]).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Y Range</span>
                    <span>{(data.boundingBox.max[1] - data.boundingBox.min[1]).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Z Range</span>
                    <span>{(data.boundingBox.max[2] - data.boundingBox.min[2]).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative bg-[#0a0f18]">
        {!data ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-24 h-24 mb-6 border border-muted-foreground/20 rounded-full flex items-center justify-center">
              <div className="w-16 h-16 border border-muted-foreground/30 rounded-full animate-pulse flex items-center justify-center">
                <div className="w-8 h-8 border border-muted-foreground/40 rounded-full" />
              </div>
            </div>
            <p className="text-lg font-medium tracking-tight">No point cloud loaded</p>
            <p className="text-sm mt-2 opacity-70">Upload a file or load the demo dataset to begin</p>
          </div>
        ) : (
          <PointCloudCanvas 
            data={data} 
            pointSize={pointSize} 
            colorMode={colorMode} 
          />
        )}
      </div>
    </div>
  );
}
