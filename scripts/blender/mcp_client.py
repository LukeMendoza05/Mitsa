"""Call the installed Blender Lab MCP tools through the official MCP SDK.

The scene is owned by Blender's installed MCP extension, not a direct authoring
subprocess. The bridge source is pinned in the user's repaired Codex config.
"""

import argparse
import asyncio
import json
from pathlib import Path
import tomllib

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def run():
    parser = argparse.ArgumentParser()
    parser.add_argument("--list-tools", action="store_true")
    parser.add_argument("--catalog")
    parser.add_argument("--tool")
    parser.add_argument("--arguments-file")
    parser.add_argument("--result-file")
    args = parser.parse_args()
    config = tomllib.loads((Path.home() / ".codex/config.toml").read_text())
    blender = config["mcp_servers"]["blender"]
    server = StdioServerParameters(command=blender["command"], args=blender["args"])
    async with stdio_client(server) as (reader, writer):
        async with ClientSession(reader, writer) as session:
            initialized = await session.initialize()
            tools = await session.list_tools()
            if args.catalog:
                Path(args.catalog).write_text(tools.model_dump_json(indent=2))
            if args.list_tools:
                print(json.dumps({"server": initialized.serverInfo.model_dump(), "tools": [{"name": tool.name, "description": tool.description, "inputSchema": tool.inputSchema} for tool in tools.tools]}, indent=2))
            if args.tool:
                if args.tool not in {tool.name for tool in tools.tools}:
                    raise RuntimeError("Requested tool is not advertised by the server")
                arguments = json.loads(Path(args.arguments_file).read_text(encoding="utf-8-sig")) if args.arguments_file else {}
                result = await session.call_tool(args.tool, arguments=arguments)
                if args.result_file:
                    Path(args.result_file).write_text(result.model_dump_json(indent=2))
                payload = result.structuredContent
                print(json.dumps(payload, indent=2) if payload else result.model_dump_json(indent=2))
                if result.isError or (isinstance(payload, dict) and payload.get("status") == "error"):
                    raise RuntimeError("Blender MCP tool returned an error")


if __name__ == "__main__":
    asyncio.run(run())
