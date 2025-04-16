const pixelize = (pixels, size) => {
    const blocks = Array.from({ length: Math.floor(pixels.length / size) }, () => Array(Math.floor(pixels[0].length / size)));

    for (let y = 0; y < blocks.length; y++) {
        for(let x = 0; x < blocks[0].length; x++) {
            let rt = 0, gt = 0, bt = 0, count = 0;
    
            for (let dy = 0; dy < size; dy++) {
                for (let dx = 0; dx < size; dx++) {
                    const px = (x * size) + dx;
                    const py = (y * size) + dy;

                    if (py >= pixels.length || px >= pixels[0].length) continue;

                    const { r, g, b } = pixels[py][px];

                    rt += r;
                    gt += g;
                    bt += b;
                    count++;
                }
            }

            blocks[y][x] = { r: rt / count, g: gt / count, b: bt / count };
        }
    }

    return blocks;
};

const squarePixel = (ctx, { r, g, b }, size) => {
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, 0, size, size);
};

const circlePixel = (ctx, { r, g, b }, size) => {
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    const radius = (brightness / 255) * (size / 2);

    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
    ctx.fill();
};

const renderBlocks = (blocks, size, renderer) => {
    const canvas = document.createElement('canvas');

    if (blocks.length === 0 || blocks[0].length === 0) return canvas;

    canvas.width = blocks[0].length * size;
    canvas.height = blocks.length * size;

    const ctx = canvas.getContext('2d');

    for (let y = 0; y < blocks.length; y++) {
        for(let x = 0; x < blocks[0].length; x++) {
            const block = blocks[y][x];

            ctx.save();
            ctx.translate(x * size, y * size);
            renderer(ctx, block, size);
            ctx.restore();
        }
    }

    return canvas;
};

export const square = (pixels, pixelSize) => renderBlocks(pixelize(pixels, pixelSize), pixelSize, squarePixel)

export const circle = (pixels, pixelSize) => renderBlocks(pixelize(pixels, pixelSize), pixelSize, circlePixel)
