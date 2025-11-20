# Master Control Agent

An autonomous, multi-functional agent system for managing infrastructure, services, and subagents through natural language commands. Built on Cloudflare's distributed platform with comprehensive security, persistent knowledge base, and zero-trust architecture.

## Features

### Core Capabilities
- **Autonomous Operations**: Self-directed task execution with intelligent decision-making
- **Natural Language Interface**: Control everything through conversational commands
- **Multi-Domain Management**: Cloudflare Workers, Docker, domains, MCP servers, and more
- **Subagent Orchestration**: Deploy and manage specialized subagents for complex tasks
- **Persistent Knowledge Base**: Dual-backup storage with SQLite, KV, R2, and AI Gateway caching

### Security & Compliance
- **Zero-Trust Architecture**: Cloudflare Access integration with JWT validation
- **Prompt Injection Protection**: Multi-layered detection and sanitization
- **AI Gateway Integration**: Request caching, rate limiting, and firewall rules
- **BYOK Support**: Bring your own API keys with secure encrypted storage
- **Comprehensive Audit Trail**: Full logging with OpenTelemetry integration

### Integrations
- **Cloudflare**: Workers, Durable Objects, Domains, KV, R2, D1, AI Gateway, Analytics
- **Docker**: Container management, image registry, compose orchestration
- **MCP Hub**: Dynamic MCP server deployment with OAuth authentication
- **Workflow Automation**: Zapier, n8n, and custom webhooks
- **Network Security**: Tailscale VPN for secure host access
- **LobeChat**: Server-side knowledge base deployment and synchronization

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────┐
│              Natural Language Interface              │
│                  (User Commands)                     │
└───────────────────────┬─────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────┐
│               Security Gateway Layer                 │
│   • AI Gateway      • Zero Trust    • Prompt Guard  │
└───────────────────────┬─────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────┐
│          Master Control Agent (Durable Object)       │
│   • Decision Engine  • Task Queue  • State Manager  │
└─────┬──────────┬──────────┬──────────┬─────────────┘
      │          │          │          │
      ↓          ↓          ↓          ↓
┌──────────┐ ┌─────────┐ ┌────────┐ ┌───────────┐
│Subagents │ │MCP Hub  │ │Docker  │ │Cloudflare │
└──────────┘ └─────────┘ └────────┘ └───────────┘
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm
- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- [Anthropic API key](https://console.anthropic.com/) (for BYOK mode)

### Installation

1. **Clone and Navigate**
   ```bash
   cd examples/master-control-agent
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Cloudflare Resources**

   Create the required Cloudflare resources:

   ```bash
   # Create KV namespace
   wrangler kv:namespace create "master-control-agent-kv"

   # Create R2 bucket
   wrangler r2 bucket create master-control-agent-storage

   # Create D1 database
   wrangler d1 create master-control-agent-db

   # Create Vectorize index
   wrangler vectorize create master-control-agent-vectors \
     --dimensions=1536 \
     --metric=cosine

   # Create Queue
   wrangler queues create master-control-agent-queue
   ```

4. **Update wrangler.jsonc**

   Replace the placeholder IDs in `wrangler.jsonc` with the IDs from the commands above:

   ```jsonc
   {
     "kv_namespaces": [
       {
         "binding": "KV",
         "id": "YOUR_KV_NAMESPACE_ID"  // Replace this
       }
     ],
     "d1_databases": [
       {
         "binding": "DB",
         "database_name": "master-control-agent-db",
         "database_id": "YOUR_D1_DATABASE_ID"  // Replace this
       }
     ]
   }
   ```

5. **Set Secrets**

   ```bash
   # Anthropic API key (for BYOK mode)
   wrangler secret put ANTHROPIC_API_KEY

   # Cloudflare API token (for managing resources)
   wrangler secret put CLOUDFLARE_API_TOKEN

   # Optional: Docker host connection
   wrangler secret put DOCKER_HOST

   # Optional: Tailscale key
   wrangler secret put TAILSCALE_KEY

   # Optional: Integration API keys
   wrangler secret put ZAPIER_API_KEY
   wrangler secret put N8N_API_KEY
   ```

6. **Deploy**

   ```bash
   # Development mode
   npm run dev

   # Production deployment
   npm run deploy
   ```

## Usage

### Command Line Interface

Once deployed, you can interact with the Master Control Agent through:

1. **WebSocket Connection** (recommended for interactive use)
2. **REST API** (for programmatic access)
3. **LobeChat UI** (coming soon)

### Example Commands

```javascript
// Connect via WebSocket
const ws = new WebSocket('wss://master-control-agent.your-account.workers.dev');

// Send natural language commands
ws.send(JSON.stringify({
  type: 'command',
  command: 'Deploy a new worker for image processing'
}));

ws.send(JSON.stringify({
  type: 'command',
  command: 'Create a subdomain api.example.com and point it to the worker'
}));

ws.send(JSON.stringify({
  type: 'command',
  command: 'Set up monitoring with alerts for errors > 1%'
}));

ws.send(JSON.stringify({
  type: 'command',
  command: 'Show me the status of all running subagents'
}));
```

### REST API Examples

```bash
# Get agent status
curl https://master-control-agent.your-account.workers.dev/api/status

# Execute command
curl -X POST https://master-control-agent.your-account.workers.dev/api/command \
  -H "Content-Type: application/json" \
  -d '{"command": "List all deployed workers"}'

# Query knowledge base
curl -X POST https://master-control-agent.your-account.workers.dev/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "how to deploy a worker"}'

# Get audit logs
curl https://master-control-agent.your-account.workers.dev/api/logs

# Get metrics
curl https://master-control-agent.your-account.workers.dev/api/metrics
```

### Programmatic RPC Access

```typescript
// Get Durable Object stub
const id = env.MasterControlAgent.idFromName('default');
const agent = env.MasterControlAgent.get(id);

// Call RPC methods directly
await agent.deployWorker({
  name: 'my-worker',
  script: workerCode,
  routes: ['example.com/*']
});

await agent.createSubagent({
  type: 'specialist',
  domain: 'devops'
});

await agent.configureDomain({
  zoneName: 'example.com',
  records: [
    { type: 'A', name: 'api', content: '192.0.2.1' }
  ]
});

const results = await agent.queryKnowledge('deployment best practices');
```

## Configuration

### Agent Configuration

The Master Control Agent can be configured through natural language commands or by updating the configuration directly:

```typescript
{
  // Security
  byokEnabled: false,              // Use your own Anthropic API key
  zeroTrustEnabled: true,          // Require Cloudflare Access auth
  aiGatewayId: 'your-gateway-id',  // AI Gateway for caching/protection

  // Features
  autonomousMode: true,            // Enable autonomous task processing
  maxConcurrentTasks: 10,          // Max parallel tasks

  // Subagents
  maxSubagents: 50,                // Max active subagents
  subagentDefaults: {
    memory: 128,                   // MB
    cpu: 1,                        // vCPU
    timeout: 30000                 // ms
  },

  // Knowledge Base
  knowledgeBackupSchedule: '0 * * * *',  // Hourly backups (cron)

  // Integrations
  cloudflareAccountId: 'your-account-id',
  dockerHost: 'tcp://docker.example.com:2376'
}
```

### Zero Trust Setup

1. **Create a Cloudflare Access Application**

   Go to Cloudflare Zero Trust Dashboard → Access → Applications

   - Application name: Master Control Agent
   - Application domain: master-control-agent.your-account.workers.dev
   - Identity providers: Configure your IdP (Google, GitHub, etc.)

2. **Create Access Policies**

   Define who can access the agent:
   - Allow: email ends with @yourcompany.com
   - Require: groups include "admin"

3. **Update Agent Configuration**

   ```bash
   # Set your team name
   export ZERO_TRUST_TEAM_NAME="yourcompany"

   # Update in code or via environment
   ```

### AI Gateway Setup

1. **Create AI Gateway** in Cloudflare Dashboard

   Go to AI → AI Gateway → Create Gateway

   - Name: master-control-agent-gateway
   - Provider: Anthropic

2. **Configure Firewall Rules**

   - Add prompt injection detection rules
   - Set rate limits per user
   - Configure caching TTL

3. **Update Configuration**

   ```typescript
   aiGatewayId: 'your-gateway-id',
   aiGatewayAccountId: 'your-account-id'
   ```

## MCP Server Integration

The Master Control Agent includes a full MCP hub for deploying and managing Model Context Protocol servers.

### Deploying MCP Servers

```javascript
// Deploy an MCP server
ws.send(JSON.stringify({
  type: 'command',
  command: 'Deploy the Cloudflare MCP server with my API credentials'
}));

// List available MCP servers
ws.send(JSON.stringify({
  type: 'command',
  command: 'Show me all deployed MCP servers'
}));

// Call an MCP tool
ws.send(JSON.stringify({
  type: 'command',
  command: 'Use the cloudflare-mcp server to list all my workers'
}));
```

### Available MCP Servers

The system includes integrations for:

- **Cloudflare MCP** - Manage Cloudflare resources
- **GitHub MCP** - Repository and issue management
- **Playwright MCP** - Browser automation
- **Custom MCP Servers** - Deploy your own

See the [MCP Hub documentation](./docs/mcp-hub.md) for more details.

## Docker Integration

Connect the Master Control Agent to your Docker host for container management.

### Setup

1. **Expose Docker API**

   ```bash
   # Option 1: Local Docker socket (development)
   export DOCKER_HOST=unix:///var/run/docker.sock

   # Option 2: Remote Docker with TLS
   export DOCKER_HOST=tcp://docker.example.com:2376
   export DOCKER_TLS_VERIFY=1
   ```

2. **Secure with Tailscale** (recommended for production)

   ```bash
   # Install Tailscale on Docker host
   curl -fsSL https://tailscale.com/install.sh | sh
   tailscale up

   # Get Tailscale IP
   tailscale ip

   # Update agent configuration
   export DOCKER_HOST=tcp://100.x.x.x:2376
   ```

### Docker Commands

```javascript
// List containers
ws.send(JSON.stringify({
  type: 'command',
  command: 'Show me all running Docker containers'
}));

// Deploy container
ws.send(JSON.stringify({
  type: 'command',
  command: 'Deploy a PostgreSQL container with persistent storage'
}));

// Manage Docker Compose
ws.send(JSON.stringify({
  type: 'command',
  command: 'Deploy the application stack defined in docker-compose.yml'
}));
```

## Knowledge Base

The Master Control Agent maintains a persistent knowledge base that learns from every interaction.

### Knowledge Storage

- **Primary**: Durable Objects SQLite (auto-persisted)
- **Cache**: Cloudflare KV (fast access)
- **Backup**: Cloudflare R2 (hourly backups)
- **Fallback**: AI Gateway cache

### Querying Knowledge

```javascript
// Natural language query
ws.send(JSON.stringify({
  type: 'query',
  query: 'How do I deploy a worker with custom domains?'
}));

// The agent learns from executions
ws.send(JSON.stringify({
  type: 'command',
  command: 'Deploy worker-api with domain api.example.com'
}));
// Future queries will reference this execution
```

### Manual Knowledge Management

```javascript
// Add knowledge
ws.send(JSON.stringify({
  type: 'command',
  command: 'Remember that our production workers should always use wrangler.prod.toml'
}));

// Backup knowledge base
ws.send(JSON.stringify({
  type: 'command',
  command: 'Create a backup of the knowledge base'
}));
```

## Monitoring & Observability

### Built-in Monitoring

The agent provides comprehensive observability:

- **OpenTelemetry**: Distributed tracing for all operations
- **Audit Logs**: Complete history of commands and decisions
- **Metrics**: Task completion rates, error rates, subagent health
- **Analytics**: Cloudflare Workers Analytics Engine integration

### Viewing Logs

```bash
# Get recent logs
curl https://master-control-agent.your-account.workers.dev/api/logs

# Search logs
curl https://master-control-agent.your-account.workers.dev/api/logs?search=error

# Get logs by trace ID
curl https://master-control-agent.your-account.workers.dev/api/logs?trace=abc123
```

### Metrics Dashboard

```bash
# Get current metrics
curl https://master-control-agent.your-account.workers.dev/api/metrics

# Example response:
{
  "tasksCompleted": 1523,
  "tasksFailed": 12,
  "tasksActive": 3,
  "subagentsActive": 8,
  "lastHealthCheck": 1234567890
}
```

### Health Checks

```bash
# Health check endpoint
curl https://master-control-agent.your-account.workers.dev/health

# Detailed status
curl https://master-control-agent.your-account.workers.dev/api/status
```

## Subagent System

The Master Control Agent can deploy specialized subagents for complex tasks.

### Subagent Types

1. **Worker Agents** - Lightweight, task-specific
2. **Specialist Agents** - Domain experts (DevOps, Security, etc.)
3. **Integration Agents** - Service-specific controllers
4. **Monitor Agents** - Health checks and observability

### Creating Subagents

```javascript
// Create a specialist subagent
ws.send(JSON.stringify({
  type: 'command',
  command: 'Create a DevOps specialist subagent to manage our CI/CD pipeline'
}));

// Deploy subagent for specific task
ws.send(JSON.stringify({
  type: 'command',
  command: 'Deploy a monitoring subagent to watch for API errors'
}));

// List active subagents
ws.send(JSON.stringify({
  type: 'command',
  command: 'Show me all active subagents and their current tasks'
}));
```

## Security Best Practices

1. **Enable Zero Trust** - Always use Cloudflare Access for authentication
2. **Use BYOK** - Bring your own API keys for sensitive operations
3. **Enable AI Gateway** - Add prompt injection protection and rate limiting
4. **Rotate Secrets** - Regularly rotate API keys and tokens
5. **Review Audit Logs** - Monitor all agent actions
6. **Network Isolation** - Use Tailscale for secure host access
7. **Principle of Least Privilege** - Grant minimal required permissions

## Troubleshooting

### Common Issues

**Agent not starting**
```bash
# Check Durable Object logs
wrangler tail --format=json | grep MasterControlAgent

# Verify all bindings are configured
wrangler whoami
```

**Commands failing**
```bash
# Check agent logs
curl https://master-control-agent.your-account.workers.dev/api/logs?level=error

# Verify secrets are set
wrangler secret list
```

**Slow responses**
```bash
# Check AI Gateway cache hit rate
# Go to Cloudflare Dashboard → AI → AI Gateway → Analytics

# Verify Workers AI is available
curl https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/ai/models
```

### Debug Mode

Enable verbose logging:

```bash
# Set in wrangler.jsonc
{
  "vars": {
    "LOG_LEVEL": "debug"
  }
}
```

## Development

### Local Development

```bash
# Start development server
npm run dev

# Run in new window
wrangler dev --remote

# Test locally
curl http://localhost:8787/health
```

### Running Tests

```bash
# Type checking
npm run typecheck

# Build
npm run build
```

### Project Structure

```
src/
├── core/
│   ├── master-agent.ts       # Main agent class
│   ├── task-queue.ts         # Task management
│   ├── state-manager.ts      # State persistence
│   └── decision-engine.ts    # AI decision making
├── security/
│   ├── ai-gateway.ts         # AI Gateway integration
│   ├── zero-trust.ts         # Access authentication
│   └── prompt-injection.ts   # Input validation
├── knowledge-base/
│   └── primary-storage.ts    # Knowledge management
├── integrations/
│   ├── cloudflare/           # Cloudflare services
│   ├── docker/               # Docker integration
│   ├── mcp-hub/              # MCP server management
│   └── workflow/             # Zapier, n8n
├── subagents/
│   ├── deployer.ts           # Subagent deployment
│   └── types/                # Subagent implementations
├── audit/
│   ├── logger.ts             # Structured logging
│   └── otel.ts               # OpenTelemetry
└── server.ts                 # Entry point
```

## Roadmap

- [ ] LobeChat UI integration
- [ ] Enhanced semantic search with embeddings
- [ ] Multi-agent collaboration protocols
- [ ] Advanced workflow automation
- [ ] Plugin marketplace
- [ ] Mobile app
- [ ] Voice interface
- [ ] GitOps integration

## Contributing

This is part of the Cloudflare Agents monorepo. See the main [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](../../LICENSE)

## Support

- **Documentation**: [Cloudflare Agents Docs](https://agents.cloudflare.com)
- **Discord**: [Cloudflare Developers](https://discord.gg/cloudflaredev)
- **Issues**: [GitHub Issues](https://github.com/cloudflare/agents/issues)

## Acknowledgments

Built with:
- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Anthropic Claude](https://www.anthropic.com/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [PartyServer](https://github.com/partykit/partyserver)

---

**Note**: This is an advanced system that requires careful configuration and monitoring. Start with the development environment and gradually enable features as you become familiar with the system.
