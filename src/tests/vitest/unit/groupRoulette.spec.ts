import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGroupRouletteController,
  createGroupRouletteRobotsContent,
  createGroupRouletteShareUrl,
  readHostTokenFromHash,
} from "@/composables/useGroupRoulette";

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  } as unknown as Storage;
};

const createRouter = () => ({
  replace: vi.fn(),
});

const roomState = (overrides: Record<string, unknown> = {}, revision = 1) => ({
  protocolVersion: 1,
  tool: "group-roulette",
  type: "roomState",
  roomId: "room_abc",
  revision,
  serverTime: "2026-05-08T09:30:00.000Z",
  payload: {
    status: "waiting",
    expiresAt: "2026-05-09T09:30:00Z",
    guestAddEnabled: true,
    activeOptions: [],
    currentSpin: null,
    ...overrides,
  },
});

const createApi = () => {
  const stateGet = vi.fn().mockResolvedValue(roomState());
  const joinPost = vi.fn().mockResolvedValue(
    roomState({
      member: {
        id: "member_1",
        displayName: "主催者",
        role: "host",
      },
    }),
  );
  const addOptionPost = vi.fn().mockResolvedValue(
    roomState({
      activeOptions: [{ id: "option_1", label: "Pizza", order: 1 }],
    }),
  );
  const removeOptionDelete = vi.fn().mockResolvedValue(roomState());
  const guestAddPatch = vi.fn().mockResolvedValue(
    roomState({
      guestAddEnabled: false,
    }),
  );
  const startPost = vi.fn().mockResolvedValue(
    roomState({
      status: "spinning",
      currentSpin: {
        id: "spin_1",
        startedAt: "2026-05-08T09:30:00Z",
        durationMs: 5000,
        options: [{ id: "option_1", label: "Pizza", order: 1 }],
      },
    }),
  );
  const stopPost = vi.fn().mockResolvedValue(
    roomState({
      status: "stopping",
      currentSpin: {
        id: "spin_1",
        startedAt: "2026-05-08T09:30:00Z",
        durationMs: 5000,
        options: [{ id: "option_1", label: "Pizza", order: 1 }],
        winnerOptionId: "option_1",
        stopAt: "2026-05-08T09:30:03Z",
      },
    }),
  );

  const roomApi = {
    state: { $get: stateGet },
    join: { $post: joinPost },
    options: {
      $post: addOptionPost,
      _optionId: () => ({ $delete: removeOptionDelete }),
    },
    guest_add_enabled: { $patch: guestAddPatch },
    spins: {
      start: { $post: startPost },
      stop: { $post: stopPost },
    },
  };

  return {
    api: {
      v1: {
        group_roulette: {
          rooms: {
            $post: vi.fn().mockResolvedValue({
              ...roomState({
                member: {
                  id: "member_1",
                  displayName: "ホスト",
                  role: "host",
                },
              }),
              hostToken: "host_secret",
            }),
            _roomId: vi.fn(() => roomApi),
          },
        },
      },
    },
    calls: {
      addOptionPost,
      guestAddPatch,
      joinPost,
      removeOptionDelete,
      startPost,
      stateGet,
      stopPost,
    },
  };
};

describe("group roulette polling state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T09:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a room as an already joined host and keeps share URL token-free", async () => {
    const storage = createStorage();
    const router = createRouter();
    const { api, calls } = createApi();
    const controller = createGroupRouletteController({
      api,
      getVisibilityState: () => "visible",
      location: {
        hash: "",
        origin: "https://tools.mcre.info",
        pathname: "/ja/group-roulette",
      },
      route: { path: "/ja/group-roulette", query: {} },
      router,
      storage,
    });

    await controller.createRoom();

    expect(storage.setItem).toHaveBeenCalledWith(
      "groupRouletteHostToken:room_abc",
      "host_secret",
    );
    expect(storage.setItem).toHaveBeenCalledWith(
      "groupRouletteMemberId:room_abc",
      "member_1",
    );
    expect(router.replace).toHaveBeenCalledWith({
      path: "/ja/group-roulette",
      query: { roomId: "room_abc" },
      hash: "",
    });
    expect(calls.joinPost).not.toHaveBeenCalled();
    expect(controller.shareUrl.value).toBe(
      "https://tools.mcre.info/ja/group-roulette?roomId=room_abc",
    );
    expect(controller.shareUrl.value).not.toContain("host_secret");
    expect(controller.member.value?.role).toBe("host");
    expect(controller.member.value?.displayName).toBe("ホスト");
  });

  it("polls roomState and changes interval by room status and tab visibility", async () => {
    const { api, calls } = createApi();
    let visibilityState: DocumentVisibilityState = "visible";
    calls.stateGet
      .mockResolvedValueOnce(roomState())
      .mockResolvedValueOnce(
        roomState({
          status: "spinning",
          currentSpin: {
            id: "spin_1",
            startedAt: "2026-05-08T09:30:00Z",
            durationMs: 5000,
            options: [],
          },
        }),
      )
      .mockResolvedValue(roomState({ status: "spinning" }));
    const controller = createGroupRouletteController({
      api,
      getVisibilityState: () => visibilityState,
      location: {
        hash: "",
        origin: "https://tools.mcre.info",
        pathname: "/ja/group-roulette",
      },
      route: { path: "/ja/group-roulette", query: { roomId: "room_abc" } },
      router: createRouter(),
      storage: createStorage(),
    });

    await controller.startPolling();
    expect(calls.stateGet).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3000);
    expect(calls.stateGet).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(calls.stateGet).toHaveBeenCalledTimes(3);

    visibilityState = "hidden";
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(29_000);
    expect(calls.stateGet).toHaveBeenCalledTimes(4);
  });

  it("refetches immediately after operations and applies only newer revisions", async () => {
    const { api, calls } = createApi();
    calls.stateGet
      .mockResolvedValueOnce(roomState({ activeOptions: [] }))
      .mockResolvedValueOnce(
        roomState(
          {
            activeOptions: [{ id: "option_1", label: "Pizza", order: 1 }],
          },
          2,
        ),
      )
      .mockResolvedValueOnce(
        roomState(
          {
            activeOptions: [{ id: "option_old", label: "Old", order: 1 }],
          },
          1,
        ),
      );
    const storage = createStorage();
    storage.setItem("groupRouletteMemberId:room_abc", "member_1");
    storage.setItem("groupRouletteHostToken:room_abc", "host_secret");
    const controller = createGroupRouletteController({
      api,
      getVisibilityState: () => "visible",
      location: {
        hash: "",
        origin: "https://tools.mcre.info",
        pathname: "/ja/group-roulette",
      },
      route: { path: "/ja/group-roulette", query: { roomId: "room_abc" } },
      router: createRouter(),
      storage,
    });

    await controller.startPolling();
    await controller.addOption("  Pizza  ");

    expect(calls.addOptionPost).toHaveBeenCalledWith({
      body: expect.objectContaining({
        label: "Pizza",
        memberId: "member_1",
      }),
    });
    expect(calls.stateGet).toHaveBeenCalledTimes(2);
    expect(controller.activeOptions.value).toEqual([
      { id: "option_1", label: "Pizza", order: 1 },
    ]);

    await controller.refetchNow("stale-test");
    expect(controller.activeOptions.value).toEqual([
      { id: "option_1", label: "Pizza", order: 1 },
    ]);
  });

  it("sends host-only REST operations with body hostToken and applies stop winner", async () => {
    const storage = createStorage();
    storage.setItem("groupRouletteMemberId:room_abc", "member_1");
    storage.setItem("groupRouletteHostToken:room_abc", "host_secret");
    const { api, calls } = createApi();
    calls.stateGet.mockResolvedValue(
      roomState(
        {
          status: "stopping",
          currentSpin: {
            id: "spin_1",
            startedAt: "2026-05-08T09:30:00Z",
            durationMs: 5000,
            options: [{ id: "option_1", label: "Pizza", order: 1 }],
            winnerOptionId: "option_1",
            stopAt: "2026-05-08T09:30:03Z",
          },
        },
        9,
      ),
    );
    const controller = createGroupRouletteController({
      api,
      getVisibilityState: () => "visible",
      location: {
        hash: "",
        origin: "https://tools.mcre.info",
        pathname: "/ja/group-roulette",
      },
      route: { path: "/ja/group-roulette", query: { roomId: "room_abc" } },
      router: createRouter(),
      storage,
    });

    await controller.setGuestAddEnabled(false);
    await controller.removeOption("option_1");
    await controller.startSpin();
    await controller.stopSpin();

    for (const apiCall of [
      calls.guestAddPatch,
      calls.removeOptionDelete,
      calls.startPost,
      calls.stopPost,
    ]) {
      expect(apiCall).toHaveBeenCalledWith({
        body: expect.objectContaining({
          hostToken: "host_secret",
          memberId: "member_1",
        }),
      });
    }
    expect(controller.status.value).toBe("stopping");
    expect(controller.winnerOption.value?.label).toBe("Pizza");
  });

  it("parses host token fragments and returns room URL noindex metadata", () => {
    expect(readHostTokenFromHash("#hostToken=host_secret")).toBe("host_secret");
    expect(
      createGroupRouletteShareUrl(
        "https://tools.mcre.info",
        "/ja/group-roulette",
        "room_abc",
      ),
    ).toBe("https://tools.mcre.info/ja/group-roulette?roomId=room_abc");
    expect(createGroupRouletteRobotsContent("room_abc")).toBe(
      "noindex,nofollow",
    );
    expect(createGroupRouletteRobotsContent(null)).toBe("all");
  });
});
