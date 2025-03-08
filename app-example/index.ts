import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { openAIAgent } from "@graphai/openai_agent";
import * as vanilla_agents from "@graphai/vanilla";
import {
  CallToolResultSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { GraphAI } from "graphai";
import dotenv from "dotenv";
dotenv.config();

const transport = new StdioClientTransport({
  command:
  process.env.COMMAND_PATH || "",
  args: [
    process.env.DIR_PATH || "",
  ],
});

const graph_data = {
  version: 0.5,
  loop: {
    while: ":continue",
  },
  nodes: {
    messages: {
      // Holds the conversation, array of messages.
      value: [
        {
          role: "system",
          content:
            "You are a assistants. please support users following instrunctions",
        },
      ],
      update: ":reducer.array.$0",
      isResult: true,
    },
    userInput: {
      value: "",
    },
    tools: {
      agent: async () => {
        const result = await client.request(
          { method: "tools/list" },
          ListToolsResultSchema
        );
        const tools = result.tools.map((tool) => ({
          type: "function",
          function: {
            name: tool?.name,
            description: tool?.description,
            parameters: tool?.inputSchema,
          },
        }));
        return tools;
      },
    },
    llm_prompt: {
      agent: "openAIAgent",
      inputs: { messages: ":messages", tools: ":tools", prompt: ":userInput" },
    },
    tool_call: {
      agent: async (inputs: any) => {
        console.log(`${inputs.tool.name} is called`);
        const resourceContent = await client.request(
          {
            method: "tools/call",
            params: inputs.tool,
          },
          CallToolResultSchema
        );
        return resourceContent;
      },
      inputs: { tool: ":llm_prompt.tool" },
      if: ":llm_prompt.tool.name",
    },
    messagesWithToolRes: {
      // Appends that message to the messages.
      agent: "pushAgent",
      inputs: {
        array: ":llm_prompt.messages",
        item: {
          role: "tool",
          tool_call_id: ":llm_prompt.tool.id",
          name: ":llm_prompt.tool.name",
          content: ":tool_call.content",
        },
      },
      if: ":llm_prompt.tool.name",
    },
    llm_post_call: {
      agent: "openAIAgent",
      inputs: {
        messages: ":messagesWithToolRes.array",
      },
      if: ":llm_prompt.tool.name",
    },
    output: {
      // Displays the response to the user.
      agent: "stringTemplateAgent",
      console: {
        after: true,
      },
      inputs: {
        text: "\x1b[32mAgent\x1b[0m: ${:llm_post_call.text}",
      },
    },
    reducer: {
      // Receives messages from either case.
      agent: "copyAgent",
      anyInput: true,
      inputs: { array: [":messagesWithToolRes.array"] },
    },
  },
};

const graph = new GraphAI(graph_data, { ...vanilla_agents, openAIAgent });
const client = new Client(
  {
    name: "example-client",
    version: "1.0.0",
  },
  {
    capabilities: {},
  }
);
const chat = async (message: string, result?: any) => {
  if (result) {
    graph.initializeGraphAI(); // 必要に応じてグラフを初期化
    graph.injectValue("messages", result.messages);
  }
  graph.injectValue("userInput", message);
  const x = await graph.run();
  return x;
};

export async function main() {
  const ai = await callAssistant();
  let response = await ai("dirs");
  let userInput = "";
  console.log(`please input or say bye`);
  while (userInput !== "bye") {
    userInput = await new Promise<string>((resolve) => {
      process.stdin.once("data", (data) => resolve(data.toString().trim()));
    });
    if (userInput !== "bye") {
      response = await ai(userInput, response);
    }
  }
}

export async function callAssistant() {
  await client.connect(transport);
  return async (message: string, result?: any) => {
    return chat(message, result);
  };
}

if (process.argv[1] === __filename) {
  main();
}
