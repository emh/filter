import { square, circle } from "./pixelizer.mjs";
import { voronoi } from "./voronoi.mjs";

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

const SQUARE = 1;
const CIRCLE = 2;
const VORONOI = 3;

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
        mode: SQUARE,
        pixelSize: 8
    };

    document.querySelectorAll('#controls > button').forEach(
        (button) => button.addEventListener('click', (e) => {
            state.mode = Number(e.target.innerHTML);
        })
    );

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;     
    });

    return state;
}
    
const run = () => {
    const state = init();
    const { canvas, video } = state;

    const filters = {
        [SQUARE]: (pixels) => square(pixels, state.pixelSize),
        [CIRCLE]: (pixels) => circle(pixels, state.pixelSize),
        [VORONOI]: voronoi
    };

    let lastTs = null;
    let fps = 0;

    const loop = (ts) => {
        requestAnimationFrame(loop);

        if (lastTs) fps = Math.round(1000 / (ts - lastTs));

        lastTs = ts;

        const ctx = canvas.getContext('2d');

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const pixels = getPixelData(video);
            const frame = filters[state.mode](pixels);

            if (frame) renderFrame(ctx, frame);
        }
    }

    requestAnimationFrame(loop);

    startPollingVideo(video);
}

run();