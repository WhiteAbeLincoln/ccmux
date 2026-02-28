export interface Session {
  id: string;
  project: string;
  slug: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  messageCount: number;
  firstMessage: string | null;
  projectPath: string | null;
  filePath: string | null;
}

export interface SessionMessage {
  uuid: string;
  parentUuid: string | null;
  timestamp: string;
  eventType: 'USER' | 'ASSISTANT' | 'PROGRESS' | 'SYSTEM' | 'FILE_HISTORY_SNAPSHOT' | 'QUEUE_OPERATION';
  cwd: string | null;
  gitBranch: string | null;
  isSidechain: boolean | null;
  slug: string | null;
  userContent: UserTextContent | UserToolResults | null;
  assistantContent: AssistantContent | null;
  systemInfo: SystemInfo | null;
}

export interface UserTextContent {
  __typename: 'UserTextContent';
  text: string;
}

export interface UserToolResults {
  __typename: 'UserToolResults';
  results: ToolResult[];
}

export interface ToolResult {
  toolUseId: string;
  content: string;
  isError: boolean | null;
}

export interface AssistantContent {
  model: string | null;
  stopReason: string | null;
  usage: UsageInfo | null;
  blocks: ContentBlock[];
}

export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock;

export interface TextBlock {
  __typename: 'TextBlock';
  text: string;
}

export interface ThinkingBlock {
  __typename: 'ThinkingBlock';
  thinking: string;
}

export interface ToolUseBlock {
  __typename: 'ToolUseBlock';
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResultBlock {
  __typename: 'ToolResultBlock';
  toolUseId: string;
  content: string;
  isError: boolean | null;
}

export interface UsageInfo {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreationInputTokens: number | null;
  cacheReadInputTokens: number | null;
}

export interface SystemInfo {
  subtype: string | null;
  durationMs: number | null;
}
