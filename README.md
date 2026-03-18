# MemoMind Smart Glasses Plugin

`@memomind/memomind-glasses` is an OpenClaw plugin that normalizes MemoMind smart-glasses control requests and dispatches them to a paired node command.

For implementation details and node integration guidance, see
[`DEVELOPER.md`](./DEVELOPER.md).

For a beginner-friendly installation guide, see [`INSTALL.md`](./INSTALL.md).

## What it provides

- Gateway methods:
  - `memomind.normalize`
  - `memomind.dispatch`
- Chat command:
  - `/memomind ...`
- Agent tool:
  - `memomind_control`

## Required node contract

Your mobile app should connect as an OpenClaw node and declare:

```json
{
  "commands": ["memomind.control"]
}
```

The plugin sends normalized payloads like:

```json
{ "op": "QV" }
{ "op": "VS", "v": 0 }
{ "op": "BS", "v": 7 }
{ "op": "TP", "v": 1 }
{ "op": "LT", "v": { "from_language": "en-US", "to_language": "zh-CN" } }
```

## Operation reference

Use these operation codes when calling `memomind.dispatch`, `/memomind`, or
`memomind_control`:

| Code | Meaning | Value |
| --- | --- | --- |
| `QV` | Query current volume | none |
| `VU` | Increase volume by one step | none |
| `VD` | Decrease volume by one step | none |
| `VS` | Set absolute volume | `v: 0-100` |
| `QB` | Query current brightness | none |
| `BU` | Increase brightness by one step | none |
| `BD` | Decrease brightness by one step | none |
| `BS` | Set absolute brightness | `v: 0-10` |
| `LT` | Enter translation mode and choose languages | `v.from_language`, `v.to_language` |
| `TP` | Teleprompter mode. Show prompting text on the glasses display. | `v: 1` on, `v: 0` off |
| `ND` | Do Not Disturb. Suppress interruptions or notifications. | `v: 1` on, `v: 0` off |
| `LS` | Live Captions. Show live subtitles for current speech. | `v: 1` on, `v: 0` off |
| `MR` | Meeting Minutes. Capture meeting notes or meeting summaries. | `v: 1` start, `v: 0` stop |
| `SLP` | Sound Leakage Protection. Reduce audio leakage to nearby people. | `v: 1` on, `v: 0` off |
| `RC` | Audio Recording. Start or stop recording. | `v: 1` start, `v: 0` stop |
| `BA` | Auto Brightness. Let the glasses adjust brightness automatically. | `v: 1` on, `v: 0` off |

For toggle-style operations, the same `v` meaning is used across chat commands,
gateway calls, and tool calls, so OpenClaw should prefer explicit requests such
as "turn on live captions", "start recording", or "disable Do Not Disturb".

## Plugin config

## Installation

1. Install the plugin:

```bash
openclaw plugins install ./extensions/memomind-glasses
```

2. After installation, add MemoMind command guidance to your workspace
   `tools.md` so OpenClaw can remember the command meanings and use the plugin
   more reliably.

Suggested `tools.md` entry:

```md
## MemoMind Smart Glasses

Use `memomind_control` or `/memomind` to control the MemoMind glasses node.
The target node command is `memomind.control`.

Codes:
- Volume: `QV`, `VU`, `VD`, `VS`
- Brightness: `QB`, `BU`, `BD`, `BS`
- Translation: `LT`
- Toggles: `TP`, `ND`, `LS`, `MR`, `SLP`, `RC`, `BA`

Values:
- `VS`: `v: 0-100`
- `BS`: `v: 0-10`
- `LT`: `from_language`, `to_language`
- Toggles: `v: 1` = on/start, `v: 0` = off/stop

Toggle meanings:
- `TP`: teleprompter
- `ND`: Do Not Disturb
- `LS`: Live Captions
- `MR`: Meeting Minutes
- `SLP`: Sound Leakage Protection
- `RC`: audio recording
- `BA`: auto brightness

Prefer explicit requests like "turn on live captions", "start recording", or
"set brightness to 7".
```

Configure under `plugins.entries.memomind-glasses.config`:

```json5
{
  "plugins": {
    "entries": {
      "memomind-glasses": {
        "enabled": true,
        "config": {
          "defaultNodeId": "my-phone-node",
          "nodeCommand": "memomind.control",
          "defaultTimeoutMs": 15000,
          "allowNodeIds": ["my-phone-node"]
        }
      }
    }
  }
}
```

## Command examples

```text
/memomind qv
/memomind vs mute
/memomind bs 7
/memomind teleprompter on
/memomind lt en-US zh-CN
/memomind volume up node=my-phone-node
```

## Tool examples

```json
{
  "nodeId": "my-phone-node",
  "code": "VS",
  "v": 40
}
```

```json
{
  "nodeId": "my-phone-node",
  "text": "louder"
}
```
