# MemoMind Smart Glasses Installation Guide

This document provides instructions for installing and configuring the MemoMind Smart Glasses control features on an OpenClaw instance.

---

## Prerequisites

1. Ensure OpenClaw is installed on the target machine.
2. Ensure the glasses are paired via the OpenClaw Node client (install the OpenClaw App on a mobile device and complete the pairing process).

---

## Step 1: Install the Extension (`memomind-glasses`)

### Method A: Install via OpenClaw CLI (Recommended)

```bash
# Install the npm package
openclaw extensions install @memomind/memomind-glasses

# Or install directly using npx
npx @memomind/memomind-glasses
```

---

## Step 2: Install Skills

MemoMind requires 3 core skills:
- `memomind-voice-control` - Voice command parsing
- `memomind-notify` - Notification delivery
- `memomind-translate` - Translation mode

### Installation Method

```bash
# Navigate to the skills directory
cd ~/.openclaw/workspace/skills

# Clone the skills repository (if available)
# Or manually create the three skill directories and their respective SKILL.md files below
```

### Skill Files

#### 1. memomind-voice-control/SKILL.md

```markdown
---
name: memomind-voice-control
description: |
  MemoMind Smart Glasses voice control skill. Parses user's Chinese or English voice commands and outputs the corresponding JSON control commands.
  Trigger condition: When the user requests to control MemoMind Smart Glasses features (e.g., adjusting volume/brightness, switching dashboards, setting translation mode).
  Supported commands include: Phone Call, Translation, Volume/AI Voice Volume, Brightness, Height, Angle, Distance, Music Control, Screen Timeout, Reply Length, Time Format, Temperature Unit, Date Format, Shortcuts, Dashboard Switch, Binary Mode Switch, Stock Management, etc.
---

# MemoMind Voice Control

Parse user input and output the corresponding JSON control commands.

## Output Format

- Supported command: `[{"N":"XX","A":{...}}]`
- No matching command: `[{"N":"C"}]`
- **STRICT RULE**: Output ONLY a JSON array. Do NOT add any extra text, markdown code blocks, or explanations.

## Core Rules

1. **Explicit Intent**: Output commands ONLY when the user expresses a clear control intent.
2. **Command Recognition**: Supports Chinese (e.g., 打开, 关闭) and English (e.g., turn on, turn off, open, close).
3. **Value Extraction**: Extract numerical values explicitly stated by the user. Use the exact value even if it exceeds the recommended range.
4. **Single Command Processing**: Output only ONE most definitive command per user input.

## Command Families

### 1. Phone Call (CALL)
- **Trigger**: call someone, dial a number, 给某人打电话
- **Output**: `[{"N":"CALL","A":{"v":"Contact Name or Phone Number"}}]`

### 2. Translation Mode (LT)
- **Trigger**: translation mode, 翻译模式
- **Toggle**: Turn ON -> `v: 1`, Turn OFF -> `v: 0`
- **Language Setup**: `[{"N":"LT","A":{"from_language":"zh","to_language":"en"}}]`

### 3. Scalar Control
| Command Code | Function | Value Range (v) |
|--------------|----------|-----------------|
| QV/VU/VD/VS | Volume: Query/Up/Down/Set | 0-100 |
| AIQV/AIVU/AIVD/AIVS | AI Voice Volume: Query/Up/Down/Set | 0-100 |
| QB/BU/BD/BS | Brightness: Query/Up/Down/Set | 0-10 |
| QH/HU/HD/HS | Height: Query/Up/Down/Set | -4 to 4 |
| QA/AU/AD/AS | Angle: Query/Up/Down/Set | 0-90 |
| QD/DU/DD/DS | Distance: Query/Far/Near/Set | 1-5 |

### 4. Discrete Control
| Command Code | Function |
|--------------|----------|
| MN/MP | Next Track / Previous Track |
| MS/MPL | Stop / Play |
| SOT | Screen Timeout (5/10/15 minutes) |
| RL/RU/RD | Reply Length: Set/Longer/Shorter |
| TF/TFC | Time Format (12/24) / Toggle |
| TU/TUC | Temperature Unit (1: Fahrenheit / 2: Celsius) / Toggle |

### 5. Dashboard Switch
| Command Code | Page |
|--------------|------|
| ST | Stocks |
| NO | Notifications |
| SC | Schedule |
| TODO | To-Do List |
| ME | Media |
| MES | Memos |
| NEWS | News (0-6) |

### 6. Binary Mode Control
| Command Code | Function |
|--------------|----------|
| TP | Teleprompter |
| ND | Do Not Disturb (DND) |
| LS | Live Captions |
| MR | Meeting Records |
| AP | AI Captions |
| RC | Voice Recording |
| SLP | Sound Leakage Prevention |
| BA | Auto Brightness |
| LB | Long Battery Mode |
| WD | Wear Detection |
| HC | Head Tracking Control |
| CBN | Nod to Answer Call |
| VW | Voice Wakeup |
| KT | Keypad Tones |
| HM | Harman Master Audio |
| PS | Private Sound |
| AIR | AI Voice Reply |
| MDC | Multi-Device Connection |
| GN | Glasses Notifications |
| RN | Read Notifications Aloud |

### 7. Stock Management
- **SA**: Add Stock
- **SDE**: Delete Stock
```

---

## Node ID Retrieval

After installation, you must retrieve the Node ID of the paired glasses:

1. Open the OpenClaw App on the glasses/mobile device.
2. Ensure it is successfully paired with the Gateway.
3. Run the following command on the host:

```bash
openclaw nodes list
```

Alternatively, check the OpenClaw console to find the paired Node ID for the glasses.

---

## Step 3: Configure `TOOLS.md`

Add the following tool definitions to `~/.openclaw/workspace/TOOLS.md` on the target machine so the AI Agent can invoke them:

```markdown
## MemoMind Smart Glasses Commands

Call the `memomind.control` command using the `nodes` tool. 
**Payload Format**: `{"op": "Command_Code", "A": {...}}`

**Currently Connected Glasses Node ID**: `YOUR_NODE_ID_HERE`

### Scalar Control

| Command Code (op) | Description | Parameters (A) |
|-------------------|-------------|----------------|
| QV/VU/VD/VS | Volume: Query/Up/Down/Set | `v`: 0-100 |
| AIQV/AIVU/AIVD/AIVS | AI Volume: Query/Up/Down/Set | `v`: 0-100 |
| QB/BU/BD/BS | Brightness: Query/Up/Down/Set | `v`: 0-10 |
| QH/HU/HD/HS | Height: Query/Up/Down/Set | `v`: -4 to 4 |
| QA/AU/AD/AS | Angle: Query/Up/Down/Set | `v`: 0-90 |
| QD/DU/DD/DS | Distance: Query/Far/Near/Set | `v`: 1-5 |

### Discrete Control

| Command Code (op) | Description | Parameters (A) |
|-------------------|-------------|----------------|
| MN/MP | Next Track / Previous Track | `v`: 1 |
| MS/MPL | Stop / Play | `v`: 1 |
| SOT | Screen Timeout | `v`: 5 / 10 / 15 (minutes) |
| RL/RU/RD | Reply Length: Set/Longer/Shorter| `v`: 1-3 |
| TF/TFC | Time Format: Set/Toggle | `v`: 12 / 24 |
| TU/TUC | Temp Unit: Set/Toggle | `v`: 1 (F) / 2 (C) |

### Dashboard Switch

| Command Code (op) | Target Page | Parameters (A) |
|-------------------|-------------|----------------|
| ST | Stocks | None |
| NO | Notifications | None |
| SC | Schedule | None |
| TODO | To-Do List | None |
| ME | Media | None |
| MES | Memos | None |
| NEWS | News | `v`: 0-6 |

### Binary Mode (ON -> `v: 1` / OFF -> `v: 0`)

| Command Code (op) | Function |
|-------------------|----------|
| TP | Teleprompter |
| ND | Do Not Disturb (DND) |
| LS | Live Captions |
| MR | Meeting Records |
| AP | AI Captions |
| RC | Voice Recording |
| SLP | Sound Leakage Prevention |
| BA | Auto Brightness |
| LB | Long Battery Mode |
| WD | Wear Detection |
| HC | Head Tracking Control |
| CBN | Nod to Answer Call |
| VW | Voice Wakeup |
| KT | Keypad Tones |
| HM | Harman Master Audio |
| PS | Private Sound |
| AIR | AI Voice Reply |
| MDC | Multi-Device Connection |
| GN | Glasses Notifications |
| RN | Read Notifications Aloud |

### Notification Delivery

| Command Code (op) | Description | Parameters (A) |
|-------------------|-------------|----------------|
| NOTIFY | Send Notification | `title`, `content`, `appName`, `pkgName`, `style` |

**NOTIFY Parameter Details:**

| Parameter | Required | Default | Description |
| :-------- | :------- | :------ | :---------- |
| `content` | Yes | — | Notification body text |
| `title` | No | Empty | Sender / Title |
| `appName` | No | MemoMind | App name to display |
| `pkgName` | No | Empty | Application package name |
| `style` | No | 1 | 1 = Detailed, 2 = Concise |

### Miscellaneous

| Command Code (op) | Description | Parameters (A) |
|-------------------|-------------|----------------|
| LT | Translation Mode | `from_language`, `to_language` |
| CALL | Phone Call | `v`: "Contact Name or Number" |
| SA | Add Stock | None |
| SDE | Delete Stock | None |
```

---

## Step 4: Verify Installation

1. Restart the OpenClaw Gateway:
```bash
openclaw gateway restart
```

2. Test the node connection:
```bash
openclaw nodes list
```

3. Test sending a command (Replace `YOUR_NODE_ID` with the actual Node ID):
```bash
# Query Volume
nodes action=invoke node=YOUR_NODE_ID invokeCommand=memomind.control invokeParamsJson='{"op":"QV"}'

# Set Volume to 50
nodes action=invoke node=YOUR_NODE_ID invokeCommand=memomind.control invokeParamsJson='{"op":"VS","v":50}'
```

---

## FAQ

### Q: The glasses node shows as "Disconnected".
**A:** Ensure the OpenClaw App on the mobile device is running and active in the background. Verify that the mobile device and the Gateway are on the same local network (LAN).

### Q: Command sent successfully, but the glasses do not respond.
**A:** Check if the glasses firmware supports the specific command. Some features require the latest firmware update.

### Q: How do I find the current Node ID?
**A:** Run `openclaw nodes list` in the CLI or check the paired devices list in the OpenClaw Web Console.

---

## Related Resources
- MemoMind Extension Source Code: https://github.com/openclaw/memomind-glasses
```
