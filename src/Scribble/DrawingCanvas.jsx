import { useEffect, useRef } from "react";
import { SIZE_LEVELS } from "./scribbleService";

/* ─────────────────────────────────────────────
   DrawingCanvas — <canvas> thuần dùng Pointer Events
   (hỗ trợ chuột + cảm ứng).
   - Replay toàn bộ stroke hợp lệ (bỏ qua undone:true) mỗi khi `strokes` đổi.
   - Flood-fill chạy độc lập nội bộ khi gặp stroke tool:"fill".
   - Preview hình học khi kéo chuột (circle/square/triangle).
   - Toạ độ luôn chuẩn hoá 0..1 theo canvas thật; replay nội bộ vẽ ở
     "css-resolution" (offscreen) để flood-fill khớp pixel giữa các client.
───────────────────────────────────────────── */

function hexToRgba(hex) {
  let h = String(hex || "#000000").replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 255 };
}

function floodFill(ctx, W, H, sx, sy, fillHex) {
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
  const img = ctx.getImageData(0, 0, W, H);
  const data = img.data;
  const ti = (sy * W + sx) * 4;
  const tr = data[ti], tg = data[ti + 1], tb = data[ti + 2], ta = data[ti + 3];
  const fill = hexToRgba(fillHex);
  if (tr === fill.r && tg === fill.g && tb === fill.b && ta === fill.a) return;
  const visited = new Uint8Array(W * H);
  const same = i => data[i * 4] === tr && data[i * 4 + 1] === tg && data[i * 4 + 2] === tb && data[i * 4 + 3] === ta;
  const stack = [sy * W + sx];
  visited[sy * W + sx] = 1;
  while (stack.length) {
    const i = stack.pop();
    const x = i % W, y = (i / W) | 0;
    data[i * 4] = fill.r; data[i * 4 + 1] = fill.g; data[i * 4 + 2] = fill.b; data[i * 4 + 3] = fill.a;
    if (x > 0) { const ni = i - 1; if (!visited[ni] && same(ni)) { visited[ni] = 1; stack.push(ni); } }
    if (x < W - 1) { const ni = i + 1; if (!visited[ni] && same(ni)) { visited[ni] = 1; stack.push(ni); } }
    if (y > 0) { const ni = i - W; if (!visited[ni] && same(ni)) { visited[ni] = 1; stack.push(ni); } }
    if (y < H - 1) { const ni = i + W; if (!visited[ni] && same(ni)) { visited[ni] = 1; stack.push(ni); } }
  }
  ctx.putImageData(img, 0, 0);
}

function drawPenStroke(ctx, s, W, H) {
  const pts = s.points || [];
  if (pts.length < 2) return;
  const width = Math.max(1, (s.size ?? SIZE_LEVELS[1]) * Math.min(W, H));
  ctx.globalCompositeOperation = s.tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = s.color || "#000000";
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0].x * W, pts[0].y * H);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * W, pts[i].y * H);
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}

function drawShapeStroke(ctx, s, W, H) {
  const f = s.from, t = s.to;
  if (!f || !t) return;
  const k = Math.min(W, H);
  const width = Math.max(1, (s.size ?? SIZE_LEVELS[1]) * k);
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = s.color || "#000000";
  ctx.lineWidth = width;
  const x0 = f.x * W, y0 = f.y * H, x1 = t.x * W, y1 = t.y * H;
  const left = Math.min(x0, x1), top = Math.min(y0, y1);
  const rw = Math.abs(x1 - x0), rh = Math.abs(y1 - y0);
  if (s.tool === "circle") {
    ctx.beginPath();
    ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.max(0.5, rw / 2), Math.max(0.5, rh / 2), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (s.tool === "square") {
    ctx.strokeRect(left, top, rw, rh);
  } else if (s.tool === "triangle") {
    ctx.beginPath();
    ctx.moveTo(left + rw / 2, top);
    ctx.lineTo(left + rw, top + rh);
    ctx.lineTo(left, top + rh);
    ctx.closePath();
    ctx.stroke();
  }
}

const shapeTools = new Set(["circle", "square", "triangle"]);

export default function DrawingCanvas({
  strokes = [],
  live = null,
  editable = false,
  activeTool = "pen",
  activeColor = "#000000",
  activeSize = 1,
  onLiveChange,
  onStrokeCommit,
}) {
  const wrapRef = useRef(null);
  const canRef = useRef(null);
  const imgRef = useRef(null); // offscreen css-resolution buffer (nền tảng replay)
  const sizeRef = useRef({ w: 0, h: 0 });
  const pendingRef = useRef(null); // nét đang vẽ dở (drawer)
  const lastLiveRef = useRef(0);
  const commitRef = useRef({ onLiveChange, onStrokeCommit });
  const propsRef = useRef({ strokes, live, editable, activeTool, activeColor, activeSize });
  const redrawRef = useRef(null);

  const syncSizes = () => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width < 2 || rect.height < 2) return;
    const w = Math.floor(rect.width), h = Math.floor(rect.height);
    sizeRef.current = { w, h };
    const dpr = window.devicePixelRatio || 1;
    const img = imgRef.current, can = canRef.current;
    img.width = w; img.height = h;
    can.width = Math.round(w * dpr); can.height = Math.round(h * dpr);
  };

  const bake = () => {
    const img = imgRef.current, s = sizeRef.current;
    if (!img || !s.w) return;
    const ctx = img.getContext("2d");
    ctx.globalCompositeOperation = "source-over";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, s.w, s.h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, s.w, s.h);
    for (const st of propsRef.current.strokes) {
      if (st.undone) continue;
      if (st.tool === "pen" || st.tool === "eraser") drawPenStroke(ctx, st, s.w, s.h);
      else if (st.tool === "fill") {
        const p = st.points?.[0];
        if (p) floodFill(ctx, s.w, s.h, Math.round(p.x * s.w), Math.round(p.y * s.h), st.color);
      } else drawShapeStroke(ctx, st, s.w, s.h);
    }
  };

  const paintOverlay = (ctx, st, W, H, alpha) => {
    if (st.tool === "pen" || st.tool === "eraser") drawPenStroke(ctx, st, W, H);
    else if (shapeTools.has(st.tool)) {
      ctx.save();
      ctx.globalAlpha = alpha ?? 1;
      drawShapeStroke(ctx, st, W, H);
      ctx.restore();
    }
  };

  const render = () => {
    const can = canRef.current, s = sizeRef.current;
    if (!can || !s.w) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = can.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, s.w, s.h);
    ctx.drawImage(imgRef.current, 0, 0, s.w, s.h);
    const p = propsRef.current;
    const pending = pendingRef.current;
    if (pending) paintOverlay(ctx, pending, s.w, s.h, pending.tool === "pen" || pending.tool === "eraser" ? 1 : 0.45);
    else if (p.live) paintOverlay(ctx, p.live, s.w, s.h, p.live.tool === "pen" || p.live.tool === "eraser" ? 1 : 0.45);
  };

  // bake + render (dùng khi listener đổi / resize / fill)
  const refresh = () => { bake(); render(); };

  // Đồng bộ props/handlers mới nhất vào ref trước mọi effect vẽ.
  useEffect(() => {
    commitRef.current = { onLiveChange, onStrokeCommit };
    propsRef.current = { strokes, live, editable, activeTool, activeColor, activeSize };
    redrawRef.current = refresh;
  });

  useEffect(() => {
    refresh();
  }, [strokes, live]);

  useEffect(() => {
    syncSizes();
    refresh();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { syncSizes(); redrawRef.current(); }) : null;
    ro?.observe(wrapRef.current);
    return () => ro?.disconnect();
  }, []);

  const getPoint = (e) => {
    const rect = canRef.current.getBoundingClientRect();
    const s = sizeRef.current;
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / s.w)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / s.h)),
    };
  };

  const throttleLive = () => {
    const p = pendingRef.current;
    if (!p) return;
    const now = Date.now();
    if (now - lastLiveRef.current < 55) return;
    lastLiveRef.current = now;
    commitRef.current.onLiveChange?.({
      tool: p.tool, color: p.color, size: p.size,
      points: [...(p.points || [])], from: p.from ? { ...p.from } : null, to: p.to ? { ...p.to } : null,
    });
  };

  const onPointerDown = (e) => {
    if (!propsRef.current.editable) return;
    const p = propsRef.current;
    const pt = getPoint(e);
    const size = SIZE_LEVELS[Math.max(0, Math.min(2, p.activeSize))];

    if (p.activeTool === "fill") {
      const s = sizeRef.current;
      const ctx = imgRef.current.getContext("2d");
      floodFill(ctx, s.w, s.h, Math.round(pt.x * s.w), Math.round(pt.y * s.h), p.activeColor);
      commitRef.current.onStrokeCommit?.({ tool: "fill", points: [pt], color: p.activeColor, size });
      refresh();
      return;
    }

    e.preventDefault();
    canRef.current.setPointerCapture(e.pointerId);
    pendingRef.current = {
      tool: p.activeTool,
      color: p.activeColor,
      size,
      points: p.activeTool === "pen" || p.activeTool === "eraser" ? [pt] : [],
      origin: { ...pt },
      from: shapeTools.has(p.activeTool) ? { ...pt } : null,
      to: shapeTools.has(p.activeTool) ? { ...pt } : null,
    };
    render();
  };

  const onPointerMove = (e) => {
    const pen = pendingRef.current;
    if (!pen) return;
    const pt = getPoint(e);
    if (pen.tool === "pen" || pen.tool === "eraser") {
      pen.points.push(pt);
    } else {
      pen.from = pen.origin;
      pen.to = pt;
    }
    throttleLive();
    render();
  };

  const endStroke = () => {
    const pen = pendingRef.current;
    if (!pen) return;
    pendingRef.current = null;
    const s = sizeRef.current;
    const ctx = imgRef.current.getContext("2d");
    if (pen.points.length > 1) drawPenStroke(ctx, pen, s.w, s.h);
    else if (pen.to) drawShapeStroke(ctx, pen, s.w, s.h);
    commitRef.current.onLiveChange?.(null);
    commitRef.current.onStrokeCommit?.({
      tool: pen.tool,
      points: pen.points || [],
      from: pen.from ? { ...pen.from } : null,
      to: pen.to ? { ...pen.to } : null,
      color: pen.color,
      size: pen.size,
    });
    render();
  };

  const shapeCursor = shapeTools.has(activeTool);
  const cursor = !editable ? "default" : activeTool === "fill" ? "cell" : shapeCursor ? "crosshair" : "crosshair";

  return (
    <div className="sb-canvas" ref={wrapRef}>
      <canvas ref={imgRef} aria-hidden="true" style={{ display: "none" }} />
      <canvas
        ref={canRef}
        className="sb-canvas-el"
        style={{ cursor, touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onContextMenu={e => e.preventDefault()}
      />
    </div>
  );
}