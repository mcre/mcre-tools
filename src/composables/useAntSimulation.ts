import type { Stroke } from "@/lib/ants/edit";
import type { AntMapId } from "@/lib/ants/maps";
import type { EditTool, Point, Simulation } from "@/lib/ants/types";
import type { Ref } from "vue";
import { FixedClock } from "@/lib/ants/clock";
import { createStroke, extendStroke } from "@/lib/ants/edit";
import { createMapLayout } from "@/lib/ants/maps";
import { createSimulation, step, summarize } from "@/lib/ants/model";
import { createAntRenderer } from "@/lib/ants/renderer";

export const useAntSimulation = (
  canvas: Ref<HTMLCanvasElement | undefined>,
) => {
  const ready = ref(false),
    isRunning = ref(false),
    isHidden = ref(false);
  const speed = ref(1),
    tool = ref<EditTool>("food");
  const mapId = ref<AntMapId>("open");
  const brushSize = ref(11),
    brushPoint = shallowRef<Point>();
  const cellSize = ref(0);
  const brushDiameter = computed(() => brushSize.value * cellSize.value);
  const stats = shallowRef({ tick: 0, ground: 0, carrying: 0, delivered: 0 });
  const notice = ref("");
  let world: Simulation | undefined,
    renderer: ReturnType<typeof createAntRenderer> | undefined;
  let observer: ResizeObserver | undefined, frameId: number | undefined;
  let alive = true,
    lastStats = -Infinity;
  let stroke: Stroke | undefined, pointerId: number | undefined;
  const clock = new FixedClock();
  const brushStyle = computed(() => {
    if (!brushPoint.value || !world) return undefined;
    return {
      left: `${((Math.floor(brushPoint.value.x) + 0.5) / world.layout.columns) * 100}%`,
      top: `${((Math.floor(brushPoint.value.y) + 0.5) / world.layout.rows) * 100}%`,
      width: `${(brushSize.value / world.layout.columns) * 100}%`,
      height: `${(brushSize.value / world.layout.rows) * 100}%`,
    };
  });
  const refresh = (force = false) => {
    if (world) {
      renderer?.draw(world, true, force);
      stats.value = summarize(world);
    }
  };
  const cancelLoop = () => {
    if (frameId !== undefined) cancelAnimationFrame(frameId);
    frameId = undefined;
    clock.reset();
  };
  const frame = (now: number) => {
    frameId = undefined;
    if (!alive || !world || !isRunning.value || isHidden.value) return;
    clock.consume(now, speed.value, () => step(world!));
    renderer?.draw(world, true);
    if (now - lastStats >= 250) {
      stats.value = summarize(world);
      lastStats = now;
    }
    frameId = requestAnimationFrame(frame);
  };
  const startLoop = () => {
    if (
      alive &&
      world &&
      ready.value &&
      isRunning.value &&
      !isHidden.value &&
      frameId === undefined
    )
      frameId = requestAnimationFrame(frame);
  };
  const pause = () => {
    isRunning.value = false;
    cancelLoop();
    refresh();
  };
  const resume = () => {
    if (!ready.value || !alive) return;
    isRunning.value = true;
    startLoop();
  };
  const visibility = () => {
    isHidden.value = document.hidden;
    if (isHidden.value) cancelLoop();
    else {
      clock.reset();
      startLoop();
    }
  };
  const resize = () => {
    renderer?.resize();
    if (canvas.value && world)
      cellSize.value =
        canvas.value.getBoundingClientRect().width / world.layout.columns;
    refresh(true);
  };
  const finishStroke = () => {
    const id = pointerId;
    pointerId = undefined;
    stroke = undefined;
    if (id !== undefined && canvas.value?.hasPointerCapture(id))
      canvas.value.releasePointerCapture(id);
  };
  const replace = (simulation: Simulation) => {
    pause();
    finishStroke();
    brushPoint.value = undefined;
    world = simulation;
    lastStats = -Infinity;
    refresh(true);
  };
  const reset = () => replace(createSimulation(createMapLayout(mapId.value)));
  const selectMap = (id: AntMapId) => {
    mapId.value = id;
    reset();
  };
  const point = (event: PointerEvent) => {
    const rect = canvas.value!.getBoundingClientRect(),
      l = world!.layout;
    return {
      x: Math.min(
        l.columns - 0.0001,
        Math.max(0, ((event.clientX - rect.left) / rect.width) * l.columns),
      ),
      y: Math.min(
        l.rows - 0.0001,
        Math.max(0, ((event.clientY - rect.top) / rect.height) * l.rows),
      ),
    };
  };
  const pointerDown = (event: PointerEvent) => {
    if (!ready.value || !world || pointerId !== undefined || event.button !== 0)
      return;
    pointerId = event.pointerId;
    brushPoint.value = point(event);
    stroke = createStroke(tool.value, 100, brushSize.value);
    canvas.value?.setPointerCapture(event.pointerId);
    extendStroke(world, stroke, brushPoint.value);
    refresh(true);
  };
  const pointerMove = (event: PointerEvent) => {
    if (!ready.value || !world) return;
    if (pointerId !== undefined && pointerId !== event.pointerId) return;
    brushPoint.value = point(event);
    if (!stroke) return;
    extendStroke(world, stroke, brushPoint.value);
    refresh(true);
  };
  const pointerEnd = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    finishStroke();
    if (event.pointerType !== "mouse") brushPoint.value = undefined;
  };
  const pointerLeave = () => {
    if (pointerId === undefined) brushPoint.value = undefined;
  };
  watch(speed, () => clock.reset());
  onMounted(() => {
    // No browser resources or model work are created during SSG.
    if (!canvas.value) return;
    try {
      renderer = createAntRenderer(canvas.value);
    } catch {
      notice.value = "canvas";
      return;
    }
    world = createSimulation(createMapLayout(mapId.value));
    observer = new ResizeObserver(resize);
    observer.observe(canvas.value);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", cancelLoop);
    window.addEventListener("pageshow", visibility);
    window.addEventListener("resize", resize);
    isHidden.value = document.hidden;
    ready.value = true;
    resize();
    isRunning.value = !window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    startLoop();
  });
  onBeforeUnmount(() => {
    alive = false;
    cancelLoop();
    finishStroke();
    observer?.disconnect();
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("pagehide", cancelLoop);
    window.removeEventListener("pageshow", visibility);
    window.removeEventListener("resize", resize);
  });
  return {
    ready,
    isRunning,
    isHidden,
    speed,
    mapId: readonly(mapId),
    tool,
    brushSize,
    brushDiameter,
    brushStyle,
    stats,
    notice,
    pause,
    resume,
    reset,
    selectMap,
    pointerDown,
    pointerMove,
    pointerEnd,
    pointerLeave,
  };
};
