export interface McpStatus {
  available: boolean;
  enabled: boolean;
  url?: string;
  requests: number;
  configuration?: {
    mcpServers: {
      ledger: { type: string; url: string; headers: { Authorization: string } };
    };
  };
}
