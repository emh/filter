const getPixelData = (video) => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    if(!vw || !vh) return [];

    const oc = document.createElement('canvas');
    oc.width = vw;
    oc.height = vh;

    const octx = oc.getContext('2d');

    octx.drawImage(video, 0, 0, vw, vh);

    const frame = octx.getImageData(0, 0, vw, vh);
    const data = frame.data;

    const pixels = Array.from({ length: vh }, () => Array(vw));

    for (let i = 0; i < data.length; i += 4) {
        const n = i >> 2;
        const y = Math.floor(n / vw);
        const x = n % vw;
        const [r, g, b] = data.slice(i, i+3); // rgba but ignore the alpha

        pixels[y][x] = { r, g, b };
    }

    return pixels;
};

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

const quantize = (blocks, palette) => blocks.map(row =>
    row.map(({ r, g, b }) => {
        let minDist = Infinity;
        let closest = palette[0];

        for (const color of palette) {
            const dr = r - color.r;
            const dg = g - color.g;
            const db = b - color.b;
            const dist = dr * dr + dg * dg + db * db;

            if (dist < minDist) {
                minDist = dist;
                closest = color;
            }
        }

        return closest;
    })
);

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

const renderCircles = (blocks, size) => {
    const canvas = document.createElement('canvas');

    if (blocks.length === 0 || blocks[0].length === 0) return canvas;

    canvas.width = blocks[0].length * size;
    canvas.height = blocks.length * size;

    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, blocks[0].length * size, blocks.length * size);

    for (let y = 0; y < blocks.length; y++) {
        for(let x = 0; x < blocks[0].length; x++) {
            const block = blocks[y][x];
            const { r, g, b } = block;
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            const radius = (brightness / 255) * (size / 2);

            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.beginPath();
            ctx.arc(x * size + size / 2, y * size + size / 2, radius, 0, Math.PI*2);
            ctx.fill();
        }
    }

    return canvas;
};

const renderFrame = (ctx, frame) => {
    const canvas = ctx.canvas;

    if (!canvas) return;

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sourceAspect = frame.width / frame.height;
    const targetAspect = canvas.width / canvas.height;

    let sx = 0, sy = 0, sw = frame.width, sh = frame.height;

    if (sourceAspect > targetAspect) {
        sw = frame.height * targetAspect;
        sx = (frame.width - sw) / 2;
    } else {
        sh = frame.width / targetAspect;
        sy = (frame.height - sh) / 2;
    }

    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(frame, sx, sy, sw, sh, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();
};

const startVideo = (video) => {
    navigator.mediaDevices.getUserMedia({ video: true }).then(
        (stream) => {
            video.srcObject = stream;

            return new Promise(resolve => {
                video.onloadedmetadata = () => {
                    video.play();
                    resolve();
                };
            });
        }, 
        (e) => console.warn('Error starting video - will retry.', e)
    );
};

const startPollingVideo = (video) => {
    startVideo(video);

    setInterval(() => {
        const stream = video.srcObject;
        const isDead = !stream
            || !stream.active
            || stream.getVideoTracks().some(track => track.readyState === 'ended');
    
        if (isDead) {
            startVideo(video);
        }
    }, 1000);    
}        

const popArtPalette = [
    { r: 255, g: 0,   b: 0 },   // Red
    { r: 0,   g: 0,   b: 255 }, // Blue
    { r: 0,   g: 255, b: 0 },   // Green
    { r: 255, g: 255, b: 0 },   // Yellow
    { r: 255, g: 165, b: 0 },   // Orange
    { r: 128, g: 0,   b: 128 }, // Purple
    { r: 255, g: 192, b: 203 }, // Pink
    { r: 255, g: 255, b: 255 }, // White
    { r: 0,   g: 0,   b: 0 },   // Black
    { r: 128, g: 128, b: 128 }, // Gray
    { r: 210, g: 180, b: 140 }, // Tan (light skin tone)
    { r: 160, g: 82,  b: 45 },  // Brown (medium skin tone)
    { r: 105, g: 57,  b: 30 },  // Dark brown (darker skin tone)
    { r: 0,   g: 255, b: 255 }, // Cyan
    { r: 255, g: 0,   b: 255 }, // Magenta
    { r: 255, g: 240, b: 245 }  // Linen (light pinkish-neutral)
];

const SQUARE = 1;
const CIRCLE = 2;

const init = () => {
    const canvas = document.querySelector('canvas');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const video = document.createElement('video');
    
    video.autoplay = true;
    video.playsInline = true;

    const state = {
        canvas, 
        video,
        mode: 1,
        pixelSize: 8,
        palette: popArtPalette
    };

    document.getElementById('square').addEventListener('click', () => {
        state.mode = SQUARE;
    }); 

    document.getElementById('circle').addEventListener('click', () => {
        state.mode = CIRCLE;
    }); 

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;     
    });

    return state;
}

const run = () => {
    const state = init();
    const { canvas, video } = state;

    const loop = () => {
        requestAnimationFrame(loop);

        const ctx = canvas.getContext('2d');

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const pixels = getPixelData(video);
            const blocks = pixelize(pixels, state.pixelSize);
            const frame = renderBlocks(blocks, state.pixelSize, state.mode === SQUARE ? squarePixel : circlePixel);

            renderFrame(ctx, frame);
        }
    }

    requestAnimationFrame(loop);

    startPollingVideo(video);
}

run();