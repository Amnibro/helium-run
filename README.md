# Helium Run

Helium Run lets AI assistants write programs in [Helium](https://github.com/Amnibro/helium)
and run them on your computer. Helium is a compiled language: its programs run
at about the speed of C and Rust, often 10 to 70 times faster than Python, and
current Claude models write it correctly from a short primer
([measurements](https://github.com/Amnibro/helium/tree/main/bench/llm)).

It is an MCP server with three tools:

| Tool | What it does |
|---|---|
| `helium_learn` | Returns the language primer. The assistant reads it once per conversation. |
| `helium_run` | Compiles a program and runs it. Returns the output and timings, or the compiler's errors. |
| `helium_check` | Typechecks a program without running it. |

## Plans

- **Free:** 25 runs a day on each computer. `helium_learn` and `helium_check` are always free.
- **Unlimited:** $9 a month or $90 a year at [amni-scient.com/helium-run.html](https://amni-scient.com/helium-run.html).

## Install

Needs Node.js 18 or newer (Claude Desktop includes it). Runs on Linux x86-64,
and on macOS (Apple silicon or Intel) with the Xcode command line tools: run
`xcode-select --install` once. Windows is not supported yet.

**Linux, Claude Code**

```bash
curl -fsSL https://github.com/Amnibro/helium-run/releases/latest/download/helium-run-linux-x64.tar.gz | tar -xz -C ~
claude mcp add helium-run -- node ~/helium-run/server.mjs
```

**macOS, Claude Desktop:** download
[helium-run-macos.mcpb](https://github.com/Amnibro/helium-run/releases/latest/download/helium-run-macos.mcpb)
and open it. Claude Desktop asks to install it. If you have a license key,
paste it in the extension's settings.

**macOS, Claude Code**

```bash
curl -fsSL https://github.com/Amnibro/helium-run/releases/latest/download/helium-run-macos.tar.gz | tar -xz -C ~
claude mcp add helium-run -- node ~/helium-run/server.mjs
```

**Other MCP clients:** run `node /path/to/helium-run/server.mjs` as a stdio
server.

Check an install with `node ~/helium-run/server.mjs --selftest`.

## License key

After you subscribe, the page shows your key. Save it with

```bash
node ~/helium-run/server.mjs --key <your key>
```

or put it in the `HELIUM_RUN_KEY` environment variable (in Claude Desktop, the
extension's settings). Keys renew on their own while the subscription is
active. To change or cancel the subscription, use "Manage subscription" on the
same page.

## Safety

Programs run on your computer with your user's permissions, the same as code an
assistant runs in a terminal. Each run is stopped after its time limit (10
seconds by default, at most 120) and its output is capped at 512 KB. Review
what an assistant runs as you would any other code.

## Privacy

Helium Run works offline. It contacts the license server only to renew a paid
key in the last three days before it expires, and sends nothing but the key.
It keeps your key and the day's run count in `~/.config/helium-run`, and
compiled programs in `~/.cache/helium-run`, which is safe to delete.

## Licenses

Helium Run is copyright Amniscient, LLC; see [LICENSE](LICENSE). The Helium
compiler and library it bundles are Apache-2.0; see LICENSE-helium.txt in a
download.
