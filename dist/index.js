// src/control.ts
var TOGGLE_LABELS = {
  TP: "Teleprompter",
  ND: "Do Not Disturb",
  LS: "Live Captions",
  MR: "Meeting Minutes",
  SLP: "Sound Leakage Protection",
  RC: "Audio Recording",
  BA: "Auto Brightness"
};
var TOGGLE_DESCRIPTIONS = {
  TP: "show teleprompter text on the glasses display",
  ND: "mute or suppress interruptions and notifications",
  LS: "show live captions for current speech",
  MR: "capture meeting minutes or meeting notes",
  SLP: "reduce sound leakage so nearby people hear less audio",
  RC: "start or stop audio recording",
  BA: "enable or disable automatic brightness adjustment"
};
var TOGGLE_ALIASES = {
  TP: ["teleprompter", "speech", "prompter", "prompting", "read-along", "read-after", "\u8DDF\u8BFB"],
  ND: ["do-not-disturb", "dnd", "\u52FF\u6270", "\u514D\u6253\u6270"],
  LS: ["live-captions", "captions", "\u5B57\u5E55", "\u5B9E\u65F6\u5B57\u5E55"],
  MR: ["meeting-minutes", "minutes", "\u4F1A\u8BAE\u7EAA\u8981"],
  SLP: ["sound-leakage-protection", "leakage-protection", "\u6F0F\u97F3\u4FDD\u62A4"],
  RC: ["audio-recording", "recording", "\u5F55\u97F3"],
  BA: ["auto-brightness", "automatic-brightness", "\u81EA\u52A8\u4EAE\u5EA6"]
};
var ON_WORDS = [
  "turn on",
  "enter",
  "start",
  "enable",
  "open",
  "\u5F00\u542F",
  "\u6253\u5F00",
  "\u5F00\u59CB",
  "\u8FDB\u5165",
  "\u542F\u7528",
  "on"
];
var OFF_WORDS = [
  "turn off",
  "exit",
  "stop",
  "disable",
  "close",
  "\u5173\u95ED",
  "\u9000\u51FA",
  "\u505C\u6B62",
  "\u7981\u7528",
  "off"
];
var VOLUME_UP_TEXTS = ["louder", "turn it up", "\u97F3\u91CF\u63D0\u9AD8", "\u5927\u58F0\u4E00\u70B9"];
var VOLUME_DOWN_TEXTS = ["too loud", "quieter", "\u97F3\u91CF\u964D\u4F4E", "\u5C0F\u58F0\u4E00\u70B9"];
var VOLUME_QUERY_TEXTS = ["current volume", "query volume", "what is the volume", "\u5F53\u524D\u97F3\u91CF"];
var BRIGHTNESS_UP_TEXTS = ["brightness up", "brighter", "\u4EAE\u4E00\u70B9", "\u4EAE\u5EA6\u63D0\u9AD8"];
var BRIGHTNESS_DOWN_TEXTS = ["brightness down", "dimmer", "\u6697\u4E00\u70B9", "\u4EAE\u5EA6\u964D\u4F4E"];
var BRIGHTNESS_QUERY_TEXTS = [
  "current brightness",
  "query brightness",
  "what is the brightness",
  "\u5F53\u524D\u4EAE\u5EA6"
];
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function asTrimmedString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : void 0;
}
function asInteger(value) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isInteger(parsed) ? parsed : void 0;
  }
  return void 0;
}
function canonicalLocale(tag) {
  try {
    const normalized = Intl.getCanonicalLocales([tag])[0];
    return normalized ?? null;
  } catch {
    return null;
  }
}
function normalizeBoolLike(value) {
  if (value === 1 || value === true || value === "1") {
    return 1;
  }
  if (value === 0 || value === false || value === "0") {
    return 0;
  }
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!text) {
    return void 0;
  }
  if (ON_WORDS.some((word) => text.includes(word))) {
    return 1;
  }
  if (OFF_WORDS.some((word) => text.includes(word))) {
    return 0;
  }
  return void 0;
}
function normalizeTranslationValue(rawV, raw) {
  const obj = asRecord(rawV);
  const fromRaw = asTrimmedString(obj?.from_language) ?? asTrimmedString(obj?.fromLanguage) ?? asTrimmedString(raw.fromLanguage);
  const toRaw = asTrimmedString(obj?.to_language) ?? asTrimmedString(obj?.toLanguage) ?? asTrimmedString(raw.toLanguage);
  if (!fromRaw || !toRaw) {
    throw new Error("LT requires from_language and to_language.");
  }
  const from = canonicalLocale(fromRaw);
  const to = canonicalLocale(toRaw);
  if (!from || !to) {
    throw new Error("LT languages must be valid BCP 47 tags.");
  }
  return {
    from_language: from,
    to_language: to
  };
}
function normalizeVolumeValue(rawV) {
  const text = typeof rawV === "string" ? rawV.trim().toLowerCase() : "";
  if (text === "mute" || text === "silence" || text === "no sound" || text === "\u9759\u97F3") {
    return 0;
  }
  if (text === "minimum" || text === "minumum" || text === "\u6700\u5C0F") {
    return 10;
  }
  const v = asInteger(rawV);
  if (v == null || v < 0 || v > 100) {
    throw new Error("VS requires integer v in range 0-100.");
  }
  return v;
}
function normalizeBrightnessValue(rawV) {
  const v = asInteger(rawV);
  if (v == null || v < 0 || v > 10) {
    throw new Error("BS requires integer v in range 0-10.");
  }
  return v;
}
function includesAny(text, values) {
  return values.some((value) => text.includes(value));
}
function normalizeFromText(textRaw) {
  const text = textRaw.trim().toLowerCase();
  if (!text) {
    throw new Error("text is empty.");
  }
  if (includesAny(text, ["mute", "silence", "no sound", "\u9759\u97F3"])) {
    return { op: "VS", v: 0 };
  }
  if (includesAny(text, ["minimum", "minumum", "\u6700\u5C0F\u97F3\u91CF"])) {
    return { op: "VS", v: 10 };
  }
  if (includesAny(text, VOLUME_UP_TEXTS)) {
    return { op: "VU" };
  }
  if (includesAny(text, VOLUME_DOWN_TEXTS)) {
    return { op: "VD" };
  }
  if (includesAny(text, VOLUME_QUERY_TEXTS)) {
    return { op: "QV" };
  }
  if (includesAny(text, BRIGHTNESS_UP_TEXTS)) {
    return { op: "BU" };
  }
  if (includesAny(text, BRIGHTNESS_DOWN_TEXTS)) {
    return { op: "BD" };
  }
  if (includesAny(text, BRIGHTNESS_QUERY_TEXTS)) {
    return { op: "QB" };
  }
  for (const [code, aliases] of Object.entries(TOGGLE_ALIASES)) {
    if (!includesAny(text, aliases)) {
      continue;
    }
    if (includesAny(text, ON_WORDS)) {
      return { op: code, v: 1 };
    }
    if (includesAny(text, OFF_WORDS)) {
      return { op: code, v: 0 };
    }
    throw new Error(`${TOGGLE_LABELS[code]} matched, but no on/off intent was found.`);
  }
  if (includesAny(text, ["translation mode", "\u7FFB\u8BD1\u6A21\u5F0F"])) {
    throw new Error("Translation mode requires structured from_language and to_language values.");
  }
  throw new Error(`Could not normalize text: ${textRaw}`);
}
function normalizeStructured(raw) {
  const code = (raw.code ?? "").trim().toUpperCase();
  switch (code) {
    case "QV":
    case "QB":
    case "VU":
    case "VD":
    case "BU":
    case "BD":
      return { op: code };
    case "VS":
      return { op: "VS", v: normalizeVolumeValue(raw.v) };
    case "BS":
      return { op: "BS", v: normalizeBrightnessValue(raw.v) };
    case "LT":
      return { op: "LT", v: normalizeTranslationValue(raw.v, raw) };
    case "TP":
    case "ND":
    case "LS":
    case "MR":
    case "SLP":
    case "RC":
    case "BA": {
      const v = normalizeBoolLike(raw.v);
      if (v == null) {
        throw new Error(`${code} requires v=0|1 or an on/off style value.`);
      }
      return { op: code, v };
    }
    default:
      throw new Error(`Unsupported code: ${code || "<empty>"}`);
  }
}
function normalizeRequest(raw) {
  const text = asTrimmedString(raw.text);
  if (text) {
    return normalizeFromText(text);
  }
  return normalizeStructured(raw);
}
function tokenizeArgs(args) {
  return args.split(/\s+/).map((token) => token.trim()).filter(Boolean);
}
function normalizeToken(token) {
  return token.trim().toLowerCase().replace(/[_\s]+/g, "-");
}
function takeOptions(tokens) {
  const remaining = [];
  let nodeId;
  let timeoutMs;
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower.startsWith("node=")) {
      nodeId = token.slice(5).trim() || void 0;
      continue;
    }
    if (lower.startsWith("timeout=")) {
      timeoutMs = asInteger(token.slice(8));
      continue;
    }
    remaining.push(token);
  }
  return { nodeId, timeoutMs, remaining };
}
function buildRequestFromFriendlyTokens(tokens) {
  const [firstRaw, secondRaw, thirdRaw, fourthRaw] = tokens;
  const first = normalizeToken(firstRaw ?? "");
  const second = normalizeToken(secondRaw ?? "");
  const third = normalizeToken(thirdRaw ?? "");
  if (!first) {
    return null;
  }
  if (["qv", "qb", "vu", "vd", "bu", "bd"].includes(first)) {
    return { code: first.toUpperCase() };
  }
  if (first === "vs") {
    return { code: "VS", v: secondRaw };
  }
  if (first === "bs") {
    return { code: "BS", v: secondRaw };
  }
  if (first === "lt") {
    return {
      code: "LT",
      fromLanguage: secondRaw,
      toLanguage: thirdRaw
    };
  }
  if (Object.keys(TOGGLE_ALIASES).includes(first.toUpperCase())) {
    return { code: first.toUpperCase(), v: secondRaw };
  }
  if (first === "volume") {
    if (["query", "current", "status"].includes(second)) {
      return { code: "QV" };
    }
    if (["up", "increase", "louder"].includes(second)) {
      return { code: "VU" };
    }
    if (["down", "decrease", "quieter"].includes(second)) {
      return { code: "VD" };
    }
    if (["set", "to"].includes(second)) {
      return { code: "VS", v: thirdRaw };
    }
  }
  if (first === "brightness") {
    if (["query", "current", "status"].includes(second)) {
      return { code: "QB" };
    }
    if (["up", "increase", "brighter"].includes(second)) {
      return { code: "BU" };
    }
    if (["down", "decrease", "dimmer"].includes(second)) {
      return { code: "BD" };
    }
    if (["set", "to"].includes(second)) {
      return { code: "BS", v: thirdRaw };
    }
  }
  if (["translation", "translate", "translation-mode"].includes(first)) {
    const fromLanguage = secondRaw;
    const toLanguage = thirdRaw ?? fourthRaw;
    if (fromLanguage && toLanguage) {
      return { code: "LT", fromLanguage, toLanguage };
    }
  }
  for (const [code, aliases] of Object.entries(TOGGLE_ALIASES)) {
    if (!aliases.includes(first)) {
      continue;
    }
    return { code, v: secondRaw };
  }
  return null;
}
function parseCommandArgs(args) {
  const trimmed = args.trim();
  if (!trimmed || ["help", "-h", "--help"].includes(trimmed.toLowerCase())) {
    return { kind: "help" };
  }
  const tokens = tokenizeArgs(trimmed);
  const { nodeId, timeoutMs, remaining } = takeOptions(tokens);
  if (remaining.length === 0) {
    return { kind: "help" };
  }
  const request = buildRequestFromFriendlyTokens(remaining) ?? {
    text: remaining.join(" ")
  };
  return {
    kind: "dispatch",
    request: {
      ...request,
      ...nodeId ? { nodeId } : {},
      ...timeoutMs != null ? { timeoutMs } : {}
    }
  };
}
function formatCommandHelp() {
  const toggleLines = Object.entries(TOGGLE_LABELS).map(([code, label]) => `- ${code}: ${label} - ${TOGGLE_DESCRIPTIONS[code]}`).join("\n");
  return [
    "MemoMind smart glasses commands:",
    "",
    "/memomind qv",
    "/memomind vu",
    "/memomind vd",
    "/memomind vs <0-100|mute|silence|no sound|minimum>",
    "/memomind qb",
    "/memomind bu",
    "/memomind bd",
    "/memomind bs <0-10>",
    "/memomind lt <from_language> <to_language>",
    "/memomind <toggle> <on|off>",
    "",
    "Friendly aliases also work:",
    "/memomind volume query|up|down|set <value>",
    "/memomind brightness query|up|down|set <value>",
    "/memomind teleprompter on",
    "/memomind live-captions off",
    "",
    "Toggle codes:",
    toggleLines,
    "",
    "Options:",
    "- node=<nodeId>",
    "- timeout=<ms>"
  ].join("\n");
}

// index.ts
var TOOL_PARAMETERS = {
  type: "object",
  additionalProperties: false,
  properties: {
    nodeId: {
      type: "string",
      description: "Optional node id override. Falls back to plugin config defaultNodeId."
    },
    code: {
      type: "string",
      description: "Structured operation code: QV query volume; VU volume up; VD volume down; VS set volume; QB query brightness; BU brightness up; BD brightness down; BS set brightness; LT enter translation mode; TP toggle teleprompter; ND toggle Do Not Disturb; LS toggle Live Captions; MR toggle Meeting Minutes capture; SLP toggle Sound Leakage Protection; RC toggle audio recording; BA toggle auto brightness."
    },
    text: {
      type: "string",
      description: "Natural-language shortcut such as 'louder', 'too loud', or 'teleprompter on'."
    },
    v: {
      description: "Operation value. Use 0-100 for VS, 0-10 for BS, 0|1 for toggles. For toggles: TP teleprompter, ND Do Not Disturb, LS Live Captions, MR Meeting Minutes capture, SLP Sound Leakage Protection, RC audio recording, BA auto brightness. Use an LT object for translation mode."
    },
    fromLanguage: {
      type: "string",
      description: "BCP 47 source language tag for LT."
    },
    toLanguage: {
      type: "string",
      description: "BCP 47 target language tag for LT."
    },
    timeoutMs: {
      type: "integer",
      minimum: 1e3,
      maximum: 6e4,
      description: "Optional node invoke timeout override."
    },
    idempotencyKey: {
      type: "string",
      description: "Optional idempotency key forwarded to node.invoke."
    }
  }
};
function asStringList(value) {
  if (!Array.isArray(value)) {
    return void 0;
  }
  const list = value.map(asTrimmedString).filter((entry) => Boolean(entry));
  return list.length > 0 ? list : void 0;
}
function resolvePluginConfig(api) {
  const raw = api.pluginConfig && typeof api.pluginConfig === "object" && !Array.isArray(api.pluginConfig) ? api.pluginConfig : {};
  return {
    defaultNodeId: asTrimmedString(raw.defaultNodeId),
    nodeCommand: asTrimmedString(raw.nodeCommand) ?? "memomind.control",
    defaultTimeoutMs: asInteger(raw.defaultTimeoutMs) ?? 15e3,
    allowNodeIds: asStringList(raw.allowNodeIds)
  };
}
function sendFailure(respond, message, details) {
  respond(false, {
    ok: false,
    error: message,
    ...details ? { details } : {}
  });
}
function formatDispatchReply(response) {
  const resultText = response.result == null ? "" : `
Result:
${JSON.stringify(response.result, null, 2)}`;
  return `Sent ${response.payload.op} to ${response.nodeId}.${resultText}`;
}
function unwrapNodeInvokeResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return result;
  }
  const record = result;
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
async function dispatchToNode(api, pluginConfig, request) {
  const payload = normalizeRequest(request);
  const nodeId = asTrimmedString(request.nodeId) ?? pluginConfig.defaultNodeId;
  if (!nodeId) {
    throw new Error("nodeId is required (or configure defaultNodeId).");
  }
  if (Array.isArray(pluginConfig.allowNodeIds) && pluginConfig.allowNodeIds.length > 0 && !pluginConfig.allowNodeIds.includes(nodeId)) {
    throw new Error(`nodeId is not allowed by plugin config: ${nodeId}`);
  }
  const { nodes } = await api.runtime.nodes.list({ connected: true });
  const node = nodes.find((entry) => entry.nodeId === nodeId);
  if (!node) {
    throw new Error(`node not connected: ${nodeId}`);
  }
  if (!Array.isArray(node.commands) || !node.commands.includes(pluginConfig.nodeCommand)) {
    throw new Error(
      `node does not declare the required MemoMind command: ${pluginConfig.nodeCommand}`
    );
  }
  const timeoutMs = asInteger(request.timeoutMs) ?? pluginConfig.defaultTimeoutMs;
  const idempotencyKey = asTrimmedString(request.idempotencyKey);
  const result = await api.runtime.nodes.invoke({
    nodeId,
    command: pluginConfig.nodeCommand,
    params: payload,
    timeoutMs,
    ...idempotencyKey ? { idempotencyKey } : {}
  });
  return {
    ok: true,
    nodeId,
    nodeCommand: pluginConfig.nodeCommand,
    payload,
    result: unwrapNodeInvokeResult(result)
  };
}
var plugin = {
  id: "memomind-glasses",
  name: "MemoMind Smart Glasses",
  description: "Normalize MemoMind smart-glasses control requests and dispatch them to a paired node.",
  register(api) {
    const pluginConfig = resolvePluginConfig(api);
    api.registerGatewayMethod(
      "memomind.normalize",
      async ({ params, respond }) => {
        try {
          const payload = normalizeRequest(params);
          respond(true, { ok: true, payload });
        } catch (err) {
          sendFailure(respond, err instanceof Error ? err.message : String(err));
        }
      }
    );
    api.registerGatewayMethod(
      "memomind.dispatch",
      async ({ params, respond }) => {
        try {
          respond(true, await dispatchToNode(api, pluginConfig, params));
        } catch (err) {
          sendFailure(respond, err instanceof Error ? err.message : String(err));
        }
      }
    );
    api.registerCommand({
      name: "memomind",
      description: "Control a MemoMind smart-glasses node (volume, brightness, translation, and mode toggles).",
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
      }
    });
    api.registerTool({
      name: "memomind_control",
      label: "MemoMind Control",
      description: "Control a paired MemoMind smart-glasses node by volume, brightness, translation mode, or toggles.",
      parameters: TOOL_PARAMETERS,
      async execute(_toolCallId, params) {
        try {
          const response = await dispatchToNode(api, pluginConfig, params);
          return {
            content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
            details: response
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }],
            details: { error: message }
          };
        }
      }
    });
  }
};
var index_default = plugin;
export {
  index_default as default
};
