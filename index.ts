import type { GatewayRequestHandlerOptions, OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import {
  asInteger,
  asTrimmedString,
  formatCommandHelp,
  normalizeRequest,
  parseCommandArgs,
  type DispatchParams,
  type NodePayload,
} from "./src/control.js";

type PluginConfig = {
  defaultNodeId?: string;
  nodeCommand: string;
  defaultTimeoutMs: number;
  allowNodeIds?: string[];
};

type DispatchResponse = {
  ok: true;
  nodeId: string;
  nodeCommand: string;
  payload: NodePayload;
  result: unknown;
};

const TOOL_PARAMETERS = {
  type: "object",
  additionalProperties: false,
  properties: {
    nodeId: {
      type: "string",
      description: "Optional node id override. Falls back to plugin config defaultNodeId.",
    },
    code: {
      type: "string",
      description:
        "Structured operation code: QV query volume; VU volume up; VD volume down; VS set volume; QB query brightness; BU brightness up; BD brightness down; BS set brightness; LT enter translation mode; TP toggle teleprompter; ND toggle Do Not Disturb; LS toggle Live Captions; MR toggle Meeting Minutes capture; SLP toggle Sound Leakage Protection; RC toggle audio recording; BA toggle auto brightness.",
    },
    text: {
      type: "string",
      description: "Natural-language shortcut such as 'louder', 'too loud', or 'teleprompter on'.",
    },
    v: {
      description:
        "Operation value. Use 0-100 for VS, 0-10 for BS, 0|1 for toggles. For toggles: TP teleprompter, ND Do Not Disturb, LS Live Captions, MR Meeting Minutes capture, SLP Sound Leakage Protection, RC audio recording, BA auto brightness. Use an LT object for translation mode.",
    },
    fromLanguage: {
      type: "string",
      description: "BCP 47 source language tag for LT.",
    },
    toLanguage: {
      type: "string",
      description: "BCP 47 target language tag for LT.",
    },
    timeoutMs: {
      type: "integer",
      minimum: 1000,
      maximum: 60000,
      description: "Optional node invoke timeout override.",
    },
    idempotencyKey: {
      type: "string",
      description: "Optional idempotency key forwarded to node.invoke.",
    },
  },
} as const;

function asStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const list = value.map(asTrimmedString).filter((entry): entry is string => Boolean(entry));
  return list.length > 0 ? list : undefined;
}

function resolvePluginConfig(api: OpenClawPluginApi): PluginConfig {
  const raw =
    api.pluginConfig && typeof api.pluginConfig === "object" && !Array.isArray(api.pluginConfig)
      ? api.pluginConfig
      : {};

  return {
    defaultNodeId: asTrimmedString(raw.defaultNodeId),
    nodeCommand: asTrimmedString(raw.nodeCommand) ?? "memomind.control",
    defaultTimeoutMs: asInteger(raw.defaultTimeoutMs) ?? 15_000,
    allowNodeIds: asStringList(raw.allowNodeIds),
  };
}

function sendFailure(
  respond: GatewayRequestHandlerOptions["respond"],
  message: string,
  details?: Record<string, unknown>,
): void {
  respond(false, {
    ok: false,
    error: message,
    ...(details ? { details } : {}),
  });
}

function formatDispatchReply(response: DispatchResponse): string {
  const resultText =
    response.result == null ? "" : `\nResult:\n${JSON.stringify(response.result, null, 2)}`;
  return `Sent ${response.payload.op} to ${response.nodeId}.${resultText}`;
}

function unwrapNodeInvokeResult(result: unknown): unknown {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return result;
  }

  const record = result as Record<string, unknown>;
  if ("payload" in record) {
    return record.payload;
  }
  if (typeof record.payloadJSON === "string") {
    try {
      return JSON.parse(record.payloadJSON);
    } catch {
      return record.payloadJSON;
    }
  }
  return result;
}

async function dispatchToNode(
  api: OpenClawPluginApi,
  pluginConfig: PluginConfig,
  request: DispatchParams,
): Promise<DispatchResponse> {
  const payload = normalizeRequest(request);
  const nodeId = asTrimmedString(request.nodeId) ?? pluginConfig.defaultNodeId;
  if (!nodeId) {
    throw new Error("nodeId is required (or configure defaultNodeId).");
  }

  if (
    Array.isArray(pluginConfig.allowNodeIds) &&
    pluginConfig.allowNodeIds.length > 0 &&
    !pluginConfig.allowNodeIds.includes(nodeId)
  ) {
    throw new Error(`nodeId is not allowed by plugin config: ${nodeId}`);
  }

  const { nodes } = await api.runtime.nodes.list({ connected: true });
  const node = nodes.find((entry) => entry.nodeId === nodeId);
  if (!node) {
    throw new Error(`node not connected: ${nodeId}`);
  }

  if (!Array.isArray(node.commands) || !node.commands.includes(pluginConfig.nodeCommand)) {
    throw new Error(
      `node does not declare the required MemoMind command: ${pluginConfig.nodeCommand}`,
    );
  }

  const timeoutMs = asInteger(request.timeoutMs) ?? pluginConfig.defaultTimeoutMs;
  const idempotencyKey = asTrimmedString(request.idempotencyKey);
  const result = await api.runtime.nodes.invoke({
    nodeId,
    command: pluginConfig.nodeCommand,
    params: payload,
    timeoutMs,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  });

  return {
    ok: true,
    nodeId,
    nodeCommand: pluginConfig.nodeCommand,
    payload,
    result: unwrapNodeInvokeResult(result),
  };
}

const plugin = {
  id: "memomind-glasses",
  name: "MemoMind Smart Glasses",
  description: "Normalize MemoMind smart-glasses control requests and dispatch them to a paired node.",
  register(api: OpenClawPluginApi) {
    const pluginConfig = resolvePluginConfig(api);

    api.registerGatewayMethod(
      "memomind.normalize",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        try {
          const payload = normalizeRequest(params as DispatchParams);
          respond(true, { ok: true, payload });
        } catch (err) {
          sendFailure(respond, err instanceof Error ? err.message : String(err));
        }
      },
    );

    api.registerGatewayMethod(
      "memomind.dispatch",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        try {
          respond(true, await dispatchToNode(api, pluginConfig, params as DispatchParams));
        } catch (err) {
          sendFailure(respond, err instanceof Error ? err.message : String(err));
        }
      },
    );

    api.registerCommand({
      name: "memomind",
      description:
        "Control a MemoMind smart-glasses node (volume, brightness, translation, and mode toggles).",
      acceptsArgs: true,
      handler: async (ctx) => {
        const parsed = parseCommandArgs(ctx.args?.trim() ?? "");
        if (parsed.kind === "help") {
          return { text: formatCommandHelp() };
        }

        try {
          const response = await dispatchToNode(api, pluginConfig, parsed.request);
          return { text: formatDispatchReply(response) };
        } catch (err) {
          return { text: `Error: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    });

    api.registerTool({
      name: "memomind_control",
      label: "MemoMind Control",
      description:
        "Control a paired MemoMind smart-glasses node by volume, brightness, translation mode, or toggles.",
      parameters: TOOL_PARAMETERS,
      async execute(_toolCallId, params) {
        try {
          const response = await dispatchToNode(api, pluginConfig, params as DispatchParams);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }],
            details: response,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: message }, null, 2) }],
            details: { error: message },
          };
        }
      },
    });
  },
};

export default plugin;
