import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../src/config/config.js";
import type {
  GatewayRequestHandler,
  GatewayRequestHandlerOptions,
} from "../../src/gateway/server-methods/types.js";
import type {
  OpenClawPluginApi,
  OpenClawPluginCommandDefinition,
} from "../../src/plugins/types.js";
import plugin from "./index.js";
import {
  formatCommandHelp,
  normalizeRequest,
  normalizeTranslationValue,
  normalizeVolumeValue,
  parseCommandArgs,
} from "./src/control.js";

type RegisteredTool = {
  execute: (toolCallId: string, params: unknown) => Promise<{
    content: Array<{ type: "text"; text: string }>;
    details?: unknown;
  }>;
};

function createApiHarness() {
  const gatewayRequest = vi.fn();
  const nodeList = vi.fn().mockResolvedValue({
    nodes: [
      {
        nodeId: "phone-node",
        connected: true,
        commands: ["memomind.control"],
      },
    ],
  });
  const nodeInvoke = vi.fn().mockResolvedValue({ payload: null });
  const commands: OpenClawPluginCommandDefinition[] = [];
  const tools: RegisteredTool[] = [];
  const gatewayHandlers = new Map<string, GatewayRequestHandler>();

  const api = {
    id: "memomind-glasses",
    name: "MemoMind Smart Glasses",
    source: "test",
    config: {} as OpenClawConfig,
    pluginConfig: {
      defaultNodeId: "phone-node",
      nodeCommand: "memomind.control",
      defaultTimeoutMs: 15_000,
      allowNodeIds: ["phone-node"],
    },
    runtime: {
      gateway: {
        request: gatewayRequest,
      },
      nodes: {
        list: nodeList,
        invoke: nodeInvoke,
      },
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    registerTool: (tool: unknown) => {
      tools.push(tool as RegisteredTool);
    },
    registerHook: vi.fn(),
    registerHttpRoute: vi.fn(),
    registerChannel: vi.fn(),
    registerGatewayMethod: (method: string, handler: GatewayRequestHandler) => {
      gatewayHandlers.set(method, handler);
    },
    registerCli: vi.fn(),
    registerService: vi.fn(),
    registerProvider: vi.fn(),
    registerCommand: (command: OpenClawPluginCommandDefinition) => {
      commands.push(command);
    },
    registerContextEngine: vi.fn(),
    resolvePath: (input: string) => input,
    on: vi.fn(),
  } as unknown as OpenClawPluginApi;

  plugin.register(api);

  return {
    api,
    commands,
    gatewayRequest,
    gatewayHandlers,
    nodeInvoke,
    nodeList,
    tool: tools[0],
  };
}

describe("memomind smart glasses control helpers", () => {
  it("maps volume aliases to their special numeric values", () => {
    expect(normalizeVolumeValue("mute")).toBe(0);
    expect(normalizeVolumeValue("silence")).toBe(0);
    expect(normalizeVolumeValue("minimum")).toBe(10);
    expect(normalizeVolumeValue("minumum")).toBe(10);
  });

  it("normalizes natural-language shortcuts", () => {
    expect(normalizeRequest({ text: "louder" })).toEqual({ op: "VU" });
    expect(normalizeRequest({ text: "too loud" })).toEqual({ op: "VD" });
    expect(normalizeRequest({ text: "teleprompter on" })).toEqual({ op: "TP", v: 1 });
  });

  it("validates translation mode locales", () => {
    expect(
      normalizeTranslationValue(undefined, {
        fromLanguage: "en-us",
        toLanguage: "zh-cn",
      }),
    ).toEqual({
      from_language: "en-US",
      to_language: "zh-CN",
    });

    expect(() =>
      normalizeTranslationValue(undefined, {
        fromLanguage: "en_US",
        toLanguage: "zh-CN",
      }),
    ).toThrow("BCP 47");
  });

  it("parses friendly chat command aliases and options", () => {
    expect(parseCommandArgs("volume set mute node=phone-node timeout=2500")).toEqual({
      kind: "dispatch",
      request: {
        code: "VS",
        v: "mute",
        nodeId: "phone-node",
        timeoutMs: 2500,
      },
    });

    expect(parseCommandArgs("lt en-US zh-CN")).toEqual({
      kind: "dispatch",
      request: {
        code: "LT",
        fromLanguage: "en-US",
        toLanguage: "zh-CN",
      },
    });
  });

  it("renders command help", () => {
    expect(formatCommandHelp()).toContain("/memomind qv");
    expect(formatCommandHelp()).toContain("TP: Teleprompter - show teleprompter text on the glasses display");
    expect(formatCommandHelp()).toContain("ND: Do Not Disturb - mute or suppress interruptions and notifications");
  });
});

describe("memomind smart glasses plugin", () => {
  it("registers gateway methods, command, and tool", () => {
    const harness = createApiHarness();
    expect(harness.gatewayHandlers.has("memomind.normalize")).toBe(true);
    expect(harness.gatewayHandlers.has("memomind.dispatch")).toBe(true);
    expect(harness.commands.map((entry) => entry.name)).toContain("memomind");
    expect(harness.tool).toBeDefined();
  });

  it("routes the /memomind command through runtime.nodes.invoke", async () => {
    const harness = createApiHarness();
    harness.nodeInvoke.mockResolvedValue({ payload: { volume: 0 } });

    const command = harness.commands[0];
    const result = await command.handler({
      channel: "telegram",
      commandBody: "/memomind volume set mute",
      config: {} as OpenClawConfig,
      isAuthorizedSender: true,
      args: "volume set mute",
    });

    expect(harness.nodeList).toHaveBeenCalledWith({ connected: true });
    expect(harness.nodeInvoke).toHaveBeenCalledWith({
      nodeId: "phone-node",
      command: "memomind.control",
      params: { op: "VS", v: 0 },
      timeoutMs: 15000,
    });
    expect(harness.gatewayRequest).not.toHaveBeenCalled();
    expect(result.text).toContain("Sent VS");
    expect(result.text).toContain('"volume": 0');
  });

  it("routes the agent tool through runtime.nodes.invoke", async () => {
    const harness = createApiHarness();
    harness.nodeInvoke.mockResolvedValue({ payload: { volume: 75 } });

    const result = await harness.tool.execute("call-1", { text: "louder" });
    expect(harness.nodeInvoke).toHaveBeenCalledWith({
      nodeId: "phone-node",
      command: "memomind.control",
      params: { op: "VU" },
      timeoutMs: 15000,
    });
    expect(harness.gatewayRequest).not.toHaveBeenCalled();
    expect(result.content[0]?.text).toContain('"op": "VU"');
    expect(result.content[0]?.text).toContain('"volume": 75');
  });

  it("normalizes and dispatches directly inside the gateway handler", async () => {
    const harness = createApiHarness();
    const handler = harness.gatewayHandlers.get("memomind.dispatch");
    expect(handler).toBeDefined();

    const respond = vi.fn();
    harness.nodeInvoke.mockResolvedValue({ payload: { volume: 42 } });

    await handler?.({
      req: { type: "req", id: "1", method: "memomind.dispatch", params: {} },
      params: { text: "louder" },
      client: null,
      isWebchatConnect: () => false,
      respond,
      context: {},
    } as unknown as GatewayRequestHandlerOptions);

    expect(harness.nodeInvoke).toHaveBeenCalledWith({
      command: "memomind.control",
      nodeId: "phone-node",
      params: { op: "VU" },
      timeoutMs: 15000,
    });
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        nodeId: "phone-node",
        payload: { op: "VU" },
      }),
    );
  });

  it("rejects nodes that do not declare the configured command", async () => {
    const harness = createApiHarness();
    harness.nodeList.mockResolvedValue({
      nodes: [{ nodeId: "phone-node", connected: true, commands: [] }],
    });

    const result = await harness.tool.execute("call-1", { text: "louder" });

    expect(harness.nodeInvoke).not.toHaveBeenCalled();
    expect(result.content[0]?.text).toContain(
      "node does not declare the required MemoMind command: memomind.control",
    );
  });
});
