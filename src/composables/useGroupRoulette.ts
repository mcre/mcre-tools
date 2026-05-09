import type {
  GroupRouletteMember,
  GroupRouletteOption,
  GroupRouletteRoomStateResponse,
  GroupRouletteSpin,
} from "@/apis/@types";
import type { RouteLocationNormalizedLoaded, Router } from "vue-router";

export const GROUP_ROULETTE_TOOL = "group-roulette";
export const HOST_TOKEN_STORAGE_PREFIX = "groupRouletteHostToken:";
export const MEMBER_ID_STORAGE_PREFIX = "groupRouletteMemberId:";

type GroupRouletteApi = any;

export type GroupRouletteStatus =
  | "idle"
  | "waiting"
  | "spinning"
  | "stopping"
  | "result"
  | "expired";

type LocationLike = Pick<Location, "hash" | "origin" | "pathname">;

type ControllerDeps = {
  api: GroupRouletteApi;
  getVisibilityState?: () => DocumentVisibilityState;
  location: LocationLike;
  route: Pick<RouteLocationNormalizedLoaded, "path" | "query">;
  router: Pick<Router, "replace">;
  storage: Storage;
};

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};

const requestId = () => {
  const cryptoLike = globalThis.crypto;
  if (cryptoLike?.randomUUID) {
    return cryptoLike.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const roomIdFromQuery = (query: Record<string, unknown>) => {
  const value = query.roomId;
  return typeof value === "string" && value ? value : null;
};

const hostTokenStorageKey = (roomId: string) =>
  `${HOST_TOKEN_STORAGE_PREFIX}${roomId}`;

const memberIdStorageKey = (roomId: string) =>
  `${MEMBER_ID_STORAGE_PREFIX}${roomId}`;

const cleanText = (value: string, maxLength: number) =>
  [...value.normalize("NFKC")]
    .filter((char) => char >= " " && char !== "\u007F")
    .join("")
    .trim()
    .slice(0, maxLength);

const pollingIntervalMs = (
  status: GroupRouletteStatus,
  visibilityState: DocumentVisibilityState,
) => {
  if (status === "expired" || status === "idle") return null;
  if (visibilityState === "hidden") return 30_000;
  if (status === "spinning" || status === "stopping") return 1000;
  return 3000;
};

export const readHostTokenFromHash = (hash: string) => {
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(normalizedHash);
  return params.get("hostToken");
};

export const createGroupRouletteShareUrl = (
  origin: string,
  path: string,
  roomId: string | null,
) => {
  const url = new URL(path, origin);
  if (roomId) {
    url.searchParams.set("roomId", roomId);
  }
  url.hash = "";
  return url.toString();
};

export const createGroupRouletteRobotsContent = (roomId: string | null) =>
  roomId ? "noindex,nofollow" : "all";

export const createGroupRouletteController = (deps: ControllerDeps) => {
  const roomId = ref<string | null>(roomIdFromQuery(deps.route.query));
  const status = ref<GroupRouletteStatus>(roomId.value ? "idle" : "idle");
  const activeOptions = ref<GroupRouletteOption[]>([]);
  const currentSpin = ref<GroupRouletteSpin | null>(null);
  const member = ref<GroupRouletteMember | null>(null);
  const guestAddEnabled = ref(true);
  const expiresAt = ref<string | null>(null);
  const errorMessage = ref<string | null>(null);
  const connected = ref(false);
  const revision = ref(0);
  const serverTimeOffsetMs = ref(0);
  const pollingTimer = shallowRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingStarted = ref(false);
  const hostToken = ref<string | null>(
    roomId.value
      ? deps.storage.getItem(hostTokenStorageKey(roomId.value))
      : null,
  );
  const memberId = ref<string | null>(
    roomId.value
      ? deps.storage.getItem(memberIdStorageKey(roomId.value))
      : null,
  );

  const fragmentHostToken = readHostTokenFromHash(deps.location.hash);
  if (roomId.value && fragmentHostToken) {
    deps.storage.setItem(hostTokenStorageKey(roomId.value), fragmentHostToken);
    hostToken.value = fragmentHostToken;
    deps.router.replace({
      path: deps.route.path,
      query: deps.route.query,
      hash: "",
    });
  }

  const getVisibilityState = () =>
    deps.getVisibilityState?.() ??
    (import.meta.env.SSR ? "visible" : document.visibilityState);

  const roomApi = () => {
    if (!roomId.value) return null;
    return deps.api.v1.group_roulette.rooms._roomId(roomId.value);
  };

  const shareUrl = computed(() =>
    createGroupRouletteShareUrl(
      deps.location.origin,
      deps.route.path,
      roomId.value,
    ),
  );
  const robotsContent = computed(() =>
    createGroupRouletteRobotsContent(roomId.value),
  );
  const isHost = computed(() => member.value?.role === "host");
  const winnerOption = computed(() => {
    const winnerOptionId = currentSpin.value?.winnerOptionId;
    if (!winnerOptionId) return null;
    return (
      currentSpin.value?.options.find(
        (option) => option.id === winnerOptionId,
      ) ??
      activeOptions.value.find((option) => option.id === winnerOptionId) ??
      null
    );
  });
  const canEditOptions = computed(
    () => status.value === "waiting" || status.value === "result",
  );
  const canAddOption = computed(
    () =>
      canEditOptions.value &&
      Boolean(memberId.value) &&
      (guestAddEnabled.value || isHost.value),
  );

  const applyEnvelope = (envelope: GroupRouletteRoomStateResponse) => {
    if (envelope.type === "roomExpired") {
      status.value = "expired";
    }
    if (envelope.revision < revision.value) {
      return;
    }
    revision.value = envelope.revision;
    const serverTime = Date.parse(envelope.serverTime);
    if (Number.isFinite(serverTime)) {
      serverTimeOffsetMs.value = serverTime - Date.now();
    }

    const payload = envelope.payload;
    status.value = payload.status;
    expiresAt.value = payload.expiresAt ?? null;
    guestAddEnabled.value = payload.guestAddEnabled;
    activeOptions.value = payload.activeOptions;
    currentSpin.value = payload.currentSpin;
    if (payload.member) {
      member.value = payload.member;
      memberId.value = payload.member.id;
      if (roomId.value) {
        deps.storage.setItem(
          memberIdStorageKey(roomId.value),
          payload.member.id,
        );
      }
    }
    connected.value = Boolean(member.value);
    errorMessage.value = null;
  };

  const handleError = (error: unknown) => {
    errorMessage.value =
      error instanceof Error ? error.message : "roomState request failed";
  };

  const clearPollingTimer = () => {
    if (pollingTimer.value) {
      clearTimeout(pollingTimer.value);
      pollingTimer.value = null;
    }
  };

  const scheduleNextPoll = () => {
    clearPollingTimer();
    if (!pollingStarted.value) return;
    const interval = pollingIntervalMs(status.value, getVisibilityState());
    if (interval === null) return;
    pollingTimer.value = setTimeout(() => {
      void refetchNow("poll");
    }, interval);
  };

  const refetchNow = async (_reason = "manual") => {
    const api = roomApi();
    if (!api) return;
    try {
      const envelope = await api.state.$get({
        query: memberId.value ? { memberId: memberId.value } : undefined,
      });
      applyEnvelope(envelope);
    } catch (error) {
      handleError(error);
    } finally {
      scheduleNextPoll();
    }
  };

  const handleRevisionHint = async (hintRevision: number) => {
    if (hintRevision > revision.value) {
      await refetchNow("revision-hint");
    }
  };

  const startPolling = async () => {
    if (!roomId.value) return;
    pollingStarted.value = true;
    await refetchNow("start");
  };

  const stopPolling = () => {
    pollingStarted.value = false;
    clearPollingTimer();
  };

  const mutationBody = (extra: Record<string, unknown> = {}) => ({
    requestId: requestId(),
    memberId: memberId.value ?? undefined,
    hostToken: hostToken.value ?? undefined,
    ...extra,
  });

  const mutateAndRefetch = async (
    mutation: () => Promise<GroupRouletteRoomStateResponse>,
  ) => {
    try {
      const envelope = await mutation();
      applyEnvelope(envelope);
      await refetchNow("mutation");
    } catch (error) {
      handleError(error);
    }
  };

  const joinRoom = async (displayName = "") => {
    const api = roomApi();
    if (!api) return;
    await mutateAndRefetch(() =>
      api.join.$post({
        body: {
          requestId: requestId(),
          memberId: memberId.value ?? undefined,
          displayName: cleanText(displayName, 40),
          hostToken: hostToken.value ?? undefined,
        },
      }),
    );
    pollingStarted.value = true;
    scheduleNextPoll();
  };

  const createRoom = async () => {
    const envelope = await deps.api.v1.group_roulette.rooms.$post();
    roomId.value = envelope.roomId;
    hostToken.value = envelope.hostToken;
    deps.storage.setItem(
      hostTokenStorageKey(envelope.roomId),
      envelope.hostToken,
    );
    applyEnvelope(envelope);
    await deps.router.replace({
      path: deps.route.path,
      query: { roomId: envelope.roomId },
      hash: "",
    });
    pollingStarted.value = true;
    scheduleNextPoll();
  };

  const addOption = async (label: string) => {
    const api = roomApi();
    const cleaned = cleanText(label, 80);
    if (!api || !cleaned || !memberId.value) return;
    await mutateAndRefetch(() =>
      api.options.$post({
        body: mutationBody({ label: cleaned }),
      }),
    );
  };

  const removeOption = async (optionId: string) => {
    const api = roomApi();
    if (!api || !memberId.value) return;
    await mutateAndRefetch(() =>
      api.options._optionId(optionId).$delete({
        body: mutationBody(),
      }),
    );
  };

  const setGuestAddEnabled = async (enabled: boolean) => {
    const api = roomApi();
    if (!api || !memberId.value) return;
    await mutateAndRefetch(() =>
      api.guest_add_enabled.$patch({
        body: mutationBody({ enabled }),
      }),
    );
  };

  const startSpin = async () => {
    const api = roomApi();
    if (!api || !memberId.value) return;
    await mutateAndRefetch(() =>
      api.spins.start.$post({
        body: mutationBody(),
      }),
    );
  };

  const stopSpin = async () => {
    const api = roomApi();
    if (!api || !memberId.value) return;
    await mutateAndRefetch(() =>
      api.spins.stop.$post({
        body: mutationBody(),
      }),
    );
  };

  const serverNow = () => Date.now() + serverTimeOffsetMs.value;

  return {
    activeOptions: readonly(activeOptions),
    addOption,
    canAddOption,
    canEditOptions,
    connected: readonly(connected),
    createRoom,
    currentSpin: readonly(currentSpin),
    errorMessage: readonly(errorMessage),
    expiresAt: readonly(expiresAt),
    guestAddEnabled: readonly(guestAddEnabled),
    handleRevisionHint,
    isHost,
    joinRoom,
    member: readonly(member),
    refetchNow,
    removeOption,
    robotsContent,
    roomId: readonly(roomId),
    serverNow,
    setGuestAddEnabled,
    shareUrl,
    startPolling,
    startSpin,
    status: readonly(status),
    stopPolling,
    stopSpin,
    winnerOption,
  };
};

export const useGroupRoulette = () => {
  const route = useRoute();
  const router = useRouter();
  const fallbackLocation = {
    hash: "",
    origin: `https://${import.meta.env.VITE_DISTRIBUTION_DOMAIN_NAME}`,
    pathname: route.path,
  };

  const controller = createGroupRouletteController({
    api: useApi(),
    location: import.meta.env.SSR ? fallbackLocation : window.location,
    route,
    router,
    storage: import.meta.env.SSR
      ? createMemoryStorage()
      : window.sessionStorage,
  });

  if (!import.meta.env.SSR) {
    const onVisibilityChange = () => {
      void controller.refetchNow("visibility");
    };
    onMounted(() => {
      document.addEventListener("visibilitychange", onVisibilityChange);
    });
    onUnmounted(() => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      controller.stopPolling();
    });
  }

  return controller;
};
