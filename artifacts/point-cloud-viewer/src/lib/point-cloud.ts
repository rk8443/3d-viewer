export interface PointCloudData {
  positions: Float32Array;
  colors?: Float32Array;
  intensities?: Float32Array;
  pointCount: number;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };
}

export function parseCsv(text: string): PointCloudData {
  const lines = text.trim().split('\n');
  const positions: number[] = [];
  const intensities: number[] = [];
  
  let startIdx = 0;
  if (lines.length > 0 && isNaN(parseFloat(lines[0].split(/[,\s]+/)[0]))) {
    startIdx = 1;
  }
  
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].trim().split(/[,\s]+/);
    if (parts.length >= 3) {
      const x = parseFloat(parts[0]);
      const y = parseFloat(parts[1]);
      const z = parseFloat(parts[2]);
      
      if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
        positions.push(x, y, z);
        
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        maxZ = Math.max(maxZ, z);
        
        if (parts.length >= 4) {
          intensities.push(parseFloat(parts[3]));
        } else {
          intensities.push(1.0);
        }
      }
    }
  }

  const pointCount = positions.length / 3;

  return {
    positions: new Float32Array(positions),
    intensities: new Float32Array(intensities),
    pointCount,
    boundingBox: {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ]
    }
  };
}

export function generateDemoCloud(): PointCloudData {
  const pointCount = 100000;
  const positions = new Float32Array(pointCount * 3);
  const intensities = new Float32Array(pointCount);
  
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < pointCount; i++) {
    const u = Math.random() * Math.PI * 2;
    const v = Math.random() * Math.PI * 2;
    
    const R = 10;
    const r = 3;
    
    let x = (R + r * Math.cos(v)) * Math.cos(u);
    let y = (R + r * Math.cos(v)) * Math.sin(u);
    let z = r * Math.sin(v) + Math.sin(u * 5) * 1.5;
    
    const noise = 0.2;
    x += (Math.random() - 0.5) * noise;
    y += (Math.random() - 0.5) * noise;
    z += (Math.random() - 0.5) * noise;
    
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    
    intensities[i] = Math.random();
    
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }

  return {
    positions,
    intensities,
    pointCount,
    boundingBox: {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ]
    }
  };
}
