export type QueryCode = "QV" | "QB";
export type StepCode = "VU" | "VD" | "BU" | "BD";
export type SetCode = "VS" | "BS";
export type ToggleCode = "TP" | "ND" | "LS" | "MR" | "SLP" | "RC" | "BA";
export type TranslationCode = "LT";
export type OpCode = QueryCode | StepCode | SetCode | ToggleCode | TranslationCode;

export type TranslationValue = {
  from_language: string;
  to_language: string;
};

export type NodePayload =
  | { op: "QV" }
  | { op: "QB" }
  | { op: "VU" }
  | { op: "VD" }
  | { op: "BU" }
  | { op: "BD" }
  | { op: "VS"; v: number }
  | { op: "BS"; v: number }
  | { op: "LT"; v: TranslationValue }
  | { op: ToggleCode; v: 0 | 1 };

export type DispatchParams = {
  nodeId?: string;
  code?: string;
  text?: string;
  v?: unknown;
  fromLanguage?: string;
  toLanguage?: string;
  timeoutMs?: number;
  idempotencyKey?: string;
};

export type ParsedCommand =
  | { kind: "help" }
  | { kind: "dispatch"; request: DispatchParams };

const TOGGLE_LABELS: Record<ToggleCode, string> = {
  TP: "Teleprompter",
  ND: "Do Not Disturb",
  LS: "Live Captions",
  MR: "Meeting Minutes",
  SLP: "Sound Leakage Protection",
  RC: "Audio Recording",
  BA: "Auto Brightness",
};

const TOGGLE_DESCRIPTIONS: Record<ToggleCode, string> = {
  TP: "show teleprompter text on the glasses display",
  ND: "mute or suppress interruptions and notifications",
  LS: "show live captions for current speech",
  MR: "capture meeting minutes or meeting notes",
  SLP: "reduce sound leakage so nearby people hear less audio",
  RC: "start or stop audio recording",
  BA: "enable or disable automatic brightness adjustment",
};

const TOGGLE_ALIASES: Record<ToggleCode, string[]> = {
  TP: ["teleprompter", "speech", "prompter", "prompting", "read-along", "read-after", "跟读"],
  ND: ["do-not-disturb", "dnd", "勿扰", "免打扰"],
  LS: ["live-captions", "captions", "字幕", "实时字幕"],
  MR: ["meeting-minutes", "minutes", "会议纪要"],
  SLP: ["sound-leakage-protection", "leakage-protection", "漏音保护"],
  RC: ["audio-recording", "recording", "录音"],
  BA: ["auto-brightness", "automatic-brightness", "自动亮度"],
};

const ON_WORDS = [
  "turn on",
  "enter",
  "start",
  "enable",
  "open",
  "开启",
  "打开",
  "开始",
  "进入",
  "启用",
  "on",
];

const OFF_WORDS = [
  "turn off",
  "exit",
  "stop",
  "disable",
  "close",
  "关闭",
  "退出",
  "停止",
  "禁用",
  "off",
];

const VOLUME_UP_TEXTS = ["louder", "turn it up", "音量提高", "大声一点"];
const VOLUME_DOWN_TEXTS = ["too loud", "quieter", "音量降低", "小声一点"];
const VOLUME_QUERY_TEXTS = ["current volume", "query volume", "what is the volume", "当前音量"];
const BRIGHTNESS_UP_TEXTS = ["brightness up", "brighter", "亮一点", "亮度提高"];
const BRIGHTNESS_DOWN_TEXTS = ["brightness down", "dimmer", "暗一点", "亮度降低"];
const BRIGHTNESS_QUERY_TEXTS = [
  "current brightness",
  "query brightness",
  "what is the brightness",
  "当前亮度",
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function asInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isInteger(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function canonicalLocale(tag: string): string | null {
  try {
    const normalized = Intl.getCanonicalLocales([tag])[0];
    return normalized ?? null;
  } catch {
    return null;
  }
}

export function normalizeBoolLike(value: unknown): 0 | 1 | undefined {
  if (value === 1 || value === true || value === "1") {
    return 1;
  }
  if (value === 0 || value === false || value === "0") {
    return 0;
  }

  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!text) {
    return undefined;
  }
  if (ON_WORDS.some((word) => text.includes(word))) {
    return 1;
  }
  if (OFF_WORDS.some((word) => text.includes(word))) {
    return 0;
  }
  return undefined;
}

export function normalizeTranslationValue(rawV: unknown, raw: DispatchParams): TranslationValue {
  const obj = asRecord(rawV);
  const fromRaw =
    asTrimmedString(obj?.from_language) ??
    asTrimmedString(obj?.fromLanguage) ??
    asTrimmedString(raw.fromLanguage);
  const toRaw =
    asTrimmedString(obj?.to_language) ??
    asTrimmedString(obj?.toLanguage) ??
    asTrimmedString(raw.toLanguage);

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
    to_language: to,
  };
}

export function normalizeVolumeValue(rawV: unknown): number {
  const text = typeof rawV === "string" ? rawV.trim().toLowerCase() : "";
  if (text === "mute" || text === "silence" || text === "no sound" || text === "静音") {
    return 0;
  }
  if (text === "minimum" || text === "minumum" || text === "最小") {
    return 10;
  }

  const v = asInteger(rawV);
  if (v == null || v < 0 || v > 100) {
    throw new Error("VS requires integer v in range 0-100.");
  }
  return v;
}

export function normalizeBrightnessValue(rawV: unknown): number {
  const v = asInteger(rawV);
  if (v == null || v < 0 || v > 10) {
    throw new Error("BS requires integer v in range 0-10.");
  }
  return v;
}

function includesAny(text: string, values: string[]): boolean {
  return values.some((value) => text.includes(value));
}

export function normalizeFromText(textRaw: string): NodePayload {
  const text = textRaw.trim().toLowerCase();
  if (!text) {
    throw new Error("text is empty.");
  }

  if (includesAny(text, ["mute", "silence", "no sound", "静音"])) {
    return { op: "VS", v: 0 };
  }
  if (includesAny(text, ["minimum", "minumum", "最小音量"])) {
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

  for (const [code, aliases] of Object.entries(TOGGLE_ALIASES) as Array<[ToggleCode, string[]]>) {
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

  if (includesAny(text, ["translation mode", "翻译模式"])) {
    throw new Error("Translation mode requires structured from_language and to_language values.");
  }

  throw new Error(`Could not normalize text: ${textRaw}`);
}

export function normalizeStructured(raw: DispatchParams): NodePayload {
  const code = (raw.code ?? "").trim().toUpperCase() as OpCode;

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

export function normalizeRequest(raw: DispatchParams): NodePayload {
  const text = asTrimmedString(raw.text);
  if (text) {
    return normalizeFromText(text);
  }
  return normalizeStructured(raw);
}

function tokenizeArgs(args: string): string[] {
  return args
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeToken(token: string): string {
  return token.trim().toLowerCase().replace(/[_\s]+/g, "-");
}

function takeOptions(tokens: string[]): {
  nodeId?: string;
  timeoutMs?: number;
  remaining: string[];
} {
  const remaining: string[] = [];
  let nodeId: string | undefined;
  let timeoutMs: number | undefined;

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower.startsWith("node=")) {
      nodeId = token.slice(5).trim() || undefined;
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

function buildRequestFromFriendlyTokens(tokens: string[]): DispatchParams | null {
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
      toLanguage: thirdRaw,
    };
  }

  if ((Object.keys(TOGGLE_ALIASES) as ToggleCode[]).includes(first.toUpperCase() as ToggleCode)) {
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

  for (const [code, aliases] of Object.entries(TOGGLE_ALIASES) as Array<[ToggleCode, string[]]>) {
    if (!aliases.includes(first)) {
      continue;
    }
    return { code, v: secondRaw };
  }

  return null;
}

export function parseCommandArgs(args: string): ParsedCommand {
  const trimmed = args.trim();
  if (!trimmed || ["help", "-h", "--help"].includes(trimmed.toLowerCase())) {
    return { kind: "help" };
  }

  const tokens = tokenizeArgs(trimmed);
  const { nodeId, timeoutMs, remaining } = takeOptions(tokens);
  if (remaining.length === 0) {
    return { kind: "help" };
  }

  const request =
    buildRequestFromFriendlyTokens(remaining) ?? ({
      text: remaining.join(" "),
    } satisfies DispatchParams);

  return {
    kind: "dispatch",
    request: {
      ...request,
      ...(nodeId ? { nodeId } : {}),
      ...(timeoutMs != null ? { timeoutMs } : {}),
    },
  };
}

export function formatCommandHelp(): string {
  const toggleLines = (Object.entries(TOGGLE_LABELS) as Array<[ToggleCode, string]>)
    .map(([code, label]) => `- ${code}: ${label} - ${TOGGLE_DESCRIPTIONS[code]}`)
    .join("\n");

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
    "- timeout=<ms>",
  ].join("\n");
}
