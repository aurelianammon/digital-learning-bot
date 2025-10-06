/**
 * PDF.js polyfills for Node.js environment
 * This file MUST be imported before any pdfjs-dist imports
 */
import canvas from "canvas";

// Setup polyfills for browser APIs that pdfjs-dist needs
if (typeof globalThis.DOMMatrix === "undefined") {
    (globalThis as any).DOMMatrix = canvas.DOMMatrix;
    console.log("✅ DOMMatrix polyfill set from canvas");
}

if (typeof globalThis.ImageData === "undefined") {
    (globalThis as any).ImageData = canvas.ImageData;
    console.log("✅ ImageData polyfill set from canvas");
}

if (typeof globalThis.Path2D === "undefined") {
    (globalThis as any).Path2D = class Path2D {
        moveTo() {}
        lineTo() {}
        bezierCurveTo() {}
        quadraticCurveTo() {}
        closePath() {}
        rect() {}
        arc() {}
    };
    console.log("✅ Path2D polyfill set");
}

if (typeof globalThis.CanvasRenderingContext2D === "undefined") {
    (globalThis as any).CanvasRenderingContext2D =
        canvas.CanvasRenderingContext2D;
    console.log("✅ CanvasRenderingContext2D polyfill set from canvas");
}

console.log("✅ All PDF.js polyfills initialized");
