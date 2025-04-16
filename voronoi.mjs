const clamp = (a, b, c) => Math.max(a, Math.min(c, b));

const getSeedPoints = (pixels) => {
    const startingSize = 128;
    const minSize = 8;
    const threshold = 80 ** 2;
    const height = pixels.length;
    const width = pixels[0].length;
    const seeds = [];

    const getSample = (x, y, size) => {
        const sample = [];

        for (let i = 0; i < size && (y+i) < height; i += minSize) {
            for (let j = 0; j < size && (x+j) < width; j += minSize) {
                sample.push(pixels[y+i][x+j]);
            }
        }

        return sample;
    };

    const isUniform = (sample) => {
        const dist = (a, b) => (b.r - a.r) ** 2 + (b.g - a.g) ** 2 + (b.b - a.b) ** 2;

        for (let a = 0; a < sample.length; a++) {
            for (let b = a; b < sample.length; b++) {
                if (a === b) continue;
                if (dist(sample[a], sample[b]) > threshold) return false;
            }    
        }

        return true;
    };

    const subDivide = (x, y, size) => {
        const mx = clamp(0, x + size / 2, width - 1);
        const my = clamp(0, y + size / 2, height - 1); 
        const midPoint = { x: mx, y: my, ...pixels[my][mx] };

        if (size <= minSize) {
            seeds.push(midPoint);
            return;
        }

        const sample = getSample(x, y, size);

        if (isUniform(sample)) {
            seeds.push(midPoint);
            return;
        }

        const newSize = size / 2;

        subDivide(x, y, newSize);
        subDivide(x + newSize, y, newSize);
        subDivide(x, y + newSize, newSize);
        subDivide(x + newSize, y + newSize, newSize);
    };

    for (let y = 0; y < height; y += startingSize) {
        for (let x = 0; x < width; x += startingSize) {
            subDivide(x, y, startingSize);
        }
    }

    return seeds;
};

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

const clipPoly = (poly, p, q) => {
    const newPoly = [];

    for (let i = 0; i < poly.length; i++) {
        const curr = poly[i];
        const next = poly[(i + 1) % poly.length];
        const currInside = dist2(curr, p) <= dist2(curr, q);
        const nextInside = dist2(next, p) <= dist2(next, q);
        
        if (currInside && nextInside) {
            newPoly.push(next);
        } else if (currInside && !nextInside) {
            const ip = intersectBisector(curr, next, p, q);
            if (ip) newPoly.push(ip);
        } else if (!currInside && nextInside) {
            const ip = intersectBisector(curr, next, p, q);
            if (ip) (newPoly.push(ip), newPoly.push(next));
        }
    }

    return newPoly;
};

const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const delta = (a, b) => ({ dx: b.x - a.x, dy: b.y - a.y });

const intersectBisector = (a, b, p, q) => {
    const m = mid(p, q);
    const { dx: abDx, dy: abDy } = delta(a, b);
    const { dx: pqDx, dy: pqDy } = delta(p, q);

    const denom = abDx * pqDx + abDy * pqDy;

    if (Math.abs(denom) < 1e-10) return null;

    const { dx: amDx, dy: amDy } = delta(a, m);

    const numer = (amDx * pqDx + amDy * pqDy);

    const t = numer / denom;

    if (t < 0 || t > 1) return null;

    return { x: a.x + t * abDx, y: a.y + t * abDy };
};

const computeCell = (p, points, bbox) => {
    let cell = [...bbox];

    for (const q of points) {
      if (q === p) continue;

      cell = clipPoly(cell, p, q);

      if (cell.length === 0) break;
    }

    return { points: cell, seed: p };
};

const getCells = (seeds, width, height) => {
    const cells = [];

    seeds.forEach((seed) => {
        const poly = computeCell(seed, seeds, getBoundingBox(width, height));

        if (poly) cells.push(poly);
    });

    return cells;
};

const getBoundingBox = (x, y) => [{ x: 0, y: 0 }, { x, y: 0 }, { x, y }, { x: 0, y }];

const renderCells = (cells, width, height) => {
    const canvas = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height

    const ctx = canvas.getContext('2d');

    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        
        if (!cell.points.length) continue;

        const { r, g, b } = cell.seed;

        ctx.beginPath();
        ctx.moveTo(cell.points[0].x, cell.points[0].y);
        for (let j = 1; j < cell.points.length; j++) {
          ctx.lineTo(cell.points[j].x, cell.points[j].y);
        }
        ctx.closePath();
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fill();
    }

    return canvas;
};

export const voronoi = (pixels) => {
    const width = pixels[0].length;
    const height = pixels.length;
    const seeds = getSeedPoints(pixels)
    const cells = getCells(seeds, width, height);

    return renderCells(cells, width, height);
};
