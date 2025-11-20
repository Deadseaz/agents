# Master Control Agent Architecture

## Overview
The Master Control Agent is an autonomous, multi-functional system designed to manage infrastructure, services, and subagents through a natural language interface. Built on Cloudflare's Agents framework with Durable Objects for global distribution and persistence.

## Architecture Layers

### 1. Core Agent Layer
**Location**: `src/core/master-agent.ts`

The foundational MasterControlAgent class extends the base Agent class with:
- Autonomous decision-making capabilities
- Multi-domain task orchestration
- State persistence with dual-backup strategy
- Real-time WebSocket communication
- RPC method exposure for programmatic control

### 2. Security Layer
**Location**: `src/security/`

Multi-layered zero-trust security implementation:

#### 2.1 Prompt Injection Protection
- **Primary**: Cloudflare AI Gateway with firewall rules
- **Secondary**: Local validation and sanitization
- **Tertiary**: Rate limiting and anomaly detection

#### 2.2 Authentication & Authorization
- BYOK (Bring Your Own Key) support
- Authenticated headers validation
- OAuth 2.1 for MCP servers
- Cloudflare Zero Trust Access integration
- JWT token management with refresh patterns

#### 2.3 Network Security
- Tailscale VPN integration for secure host access
- Zero Trust Network Access (ZTNA) policies
- mTLS for service-to-service communication

### 3. Knowledge Base Layer
**Location**: `src/knowledge-base/`

Persistent, distributed knowledge management:

#### 3.1 Primary Storage
- **SQLite on Durable Objects**: Auto-persisted agent state
- **Cloudflare KV**: Distributed key-value for quick lookups
- **Cloudflare R2**: Object storage for large data/files

#### 3.2 Secondary/Backup Storage
- **Cloudflare AI Gateway**: Acts as fallback knowledge cache
- **LobeChat Server-Side Knowledge Base**: Full document persistence
- Automatic synchronization between primary and secondary

#### 3.3 Knowledge Operations
- Semantic search capabilities
- Vector embeddings for intelligent retrieval
- Automatic versioning and rollback
- Cross-agent knowledge sharing

### 4. Integration Layer
**Location**: `src/integrations/`

Modular integration system for external services:

#### 4.1 Cloudflare Services
- **Workers**: Deploy and manage Cloudflare Workers
- **Durable Objects**: Create and orchestrate DO instances
- **KV/R2/D1**: Data storage management
- **DNS/Domains**: Domain registration and DNS configuration
- **Pages**: Static site deployment
- **AI Gateway**: LLM request routing and caching
- **Vectorize**: Vector database operations
- **Queues**: Asynchronous task processing
- **Workers Analytics**: Monitoring and metrics

#### 4.2 Container Management
- **Docker**: Container lifecycle management
- **Docker Hub**: Image registry operations
- **Docker Compose**: Multi-container orchestration

#### 4.3 MCP Hub
- Dynamic MCP server deployment
- OAuth authentication for MCP connections
- Tool/Resource/Prompt discovery and routing
- Cloudflare Zero Trust MCP profiles
- Server health monitoring and auto-recovery

#### 4.4 Workflow Automation
- **Zapier**: Trigger-action workflows
- **n8n**: Complex workflow orchestration
- Custom webhook integrations

#### 4.5 LobeChat Integration
- Server-side deployment management
- Knowledge base synchronization
- Plugin system integration
- Agent marketplace connection

#### 4.6 Network Services
- **Tailscale**: VPN configuration and policy management
- Host access and service discovery

### 5. Subagent Management Layer
**Location**: `src/subagents/`

Hierarchical agent orchestration:

#### 5.1 Subagent Types
- **Worker Agents**: Lightweight task-specific agents
- **Specialist Agents**: Domain-focused (DevOps, Security, etc.)
- **Integration Agents**: Service-specific controllers
- **Monitoring Agents**: Health checks and observability

#### 5.2 Deployment System
- Dynamic agent instantiation
- Resource allocation and limits
- Version management
- Blue-green deployment support
- Automatic scaling based on load

#### 5.3 Communication
- Agent-to-agent RPC
- Pub/sub messaging patterns
- Task delegation and result aggregation
- Hierarchical command structure

### 6. Observability Layer
**Location**: `src/audit/`

Comprehensive monitoring and logging:

#### 6.1 OpenTelemetry Integration
- Distributed tracing
- Metrics collection
- Log aggregation
- Custom instrumentation

#### 6.2 Audit Trail
- Immutable command log
- State change tracking
- Decision reasoning capture
- Compliance reporting

#### 6.3 Error Handling
- Structured error types
- Automatic retry with exponential backoff
- Graceful degradation
- Circuit breaker patterns
- Dead letter queue for failed operations

#### 6.4 Monitoring
- Health checks
- Performance metrics
- Resource utilization
- Cost tracking
- Security event monitoring

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Natural Language Interface                │
│              (User → LobeChat UI → Master Agent)            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   Security Gateway Layer                     │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────┐ │
│  │ AI Gateway   │  │ Zero Trust     │  │ Prompt Injection│ │
│  │ Protection   │  │ Authentication │  │ Detection       │ │
│  └──────────────┘  └────────────────┘  └─────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              Master Control Agent (Durable Object)           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Decision Engine (Anthropic Claude via Workers AI)   │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Task Queue   │  │ State Manager│  │ Knowledge Base  │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
└────────┬────────────────┬──────────────────┬───────────────┘
         │                │                  │
         ↓                ↓                  ↓
┌────────────────┐ ┌──────────────┐ ┌──────────────────┐
│   Subagents    │ │ Integrations │ │ MCP Hub          │
│                │ │              │ │                  │
│ • Worker       │ │ • Cloudflare │ │ • MCP Servers    │
│ • Specialist   │ │ • Docker     │ │ • OAuth          │
│ • Integration  │ │ • Zapier     │ │ • Tool Routing   │
│ • Monitor      │ │ • n8n        │ │                  │
└────────────────┘ └──────────────┘ └──────────────────┘
         │                │                  │
         └────────────────┴──────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    Audit & Observability                     │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────┐ │
│  │ OTEL Traces  │  │ Audit Logs     │  │ Metrics/Alerts  │ │
│  └──────────────┘  └────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Storage Strategy

### Primary Storage (Durable Objects)
```
cf_agents_state (SQLite)
├── agent_config         # Master agent configuration
├── subagent_registry    # Active subagent instances
├── task_history         # Completed task log
├── integration_state    # Service connection states
└── security_events      # Security audit trail

cf_agents_queues (SQLite)
├── pending_tasks        # FIFO task queue
├── retry_queue          # Failed operations for retry
└── dlq                  # Dead letter queue

cf_agents_schedules (SQLite)
├── cron_jobs            # Scheduled maintenance
├── health_checks        # Monitoring schedules
└── backup_schedules     # Data synchronization
```

### Secondary Storage
```
Cloudflare KV
├── mcp_server_cache     # MCP discovery cache
├── docker_image_meta    # Image metadata
├── domain_config        # DNS configurations
└── api_key_vault        # Encrypted credentials

Cloudflare R2
├── backups/             # Full state backups
├── logs/                # Long-term log storage
└── knowledge/           # Document repository

AI Gateway Cache
├── prompt_templates     # Reusable prompts
├── response_cache       # Frequently accessed responses
└── embeddings/          # Vector representations
```

## Security Implementation

### Defense in Depth

1. **Edge Protection** (Cloudflare AI Gateway)
   - Prompt injection detection
   - Rate limiting per user/API key
   - Content filtering
   - Request/response logging

2. **Application Layer** (Master Agent)
   - Input sanitization
   - Command validation
   - Authorization checks per operation
   - Secure secret management

3. **Network Layer** (Zero Trust + Tailscale)
   - mTLS for all internal communication
   - VPN for host access
   - Network segmentation
   - IP allowlisting

4. **Data Layer** (Encryption)
   - At-rest encryption (automatic in DO)
   - In-transit TLS
   - BYOK for sensitive operations
   - Key rotation policies

### BYOK Implementation
```typescript
// User provides their own API keys
// Master Agent stores encrypted in KV
// Keys never logged or exposed
// Rotation support with zero downtime
```

## Integration Architecture

### Cloudflare Service Management
```typescript
interface CloudflareIntegration {
  workers: WorkerManager;      // Deploy/update/delete Workers
  durableObjects: DOManager;   // Manage DO instances
  domains: DomainManager;      // DNS and domain operations
  storage: StorageManager;     // KV/R2/D1 operations
  aiGateway: AIGatewayManager; // Gateway configuration
  analytics: AnalyticsClient;  // Metrics and logs
}
```

### Docker Integration
```typescript
interface DockerIntegration {
  containers: ContainerManager;  // Lifecycle management
  images: ImageRegistry;         // Pull/push/build
  networks: NetworkManager;      // Network configuration
  volumes: VolumeManager;        // Persistent storage
  compose: ComposeOrchestrator;  // Multi-container apps
}
```

### MCP Hub Architecture
```typescript
interface MCPHub {
  servers: MCPServerRegistry;    // Available MCP servers
  deploy: (config: MCPServerConfig) => Promise<MCPServer>;
  authenticate: (server: string, credentials: OAuthCreds) => Promise<void>;
  callTool: (server: string, tool: string, args: any) => Promise<any>;
  getResource: (server: string, resource: string) => Promise<any>;
  listCapabilities: (server: string) => Promise<ServerCapabilities>;
}
```

## Autonomous Behavior

### Decision Loop
```typescript
async function autonomousLoop() {
  while (true) {
    // 1. Check task queue
    const tasks = await this.queue.peek();

    // 2. Evaluate priority and dependencies
    const nextTask = await this.prioritize(tasks);

    // 3. Allocate resources
    const resources = await this.allocateResources(nextTask);

    // 4. Execute (via subagent or directly)
    const result = await this.execute(nextTask, resources);

    // 5. Update knowledge base
    await this.knowledge.learn(nextTask, result);

    // 6. Audit trail
    await this.audit.log(nextTask, result);

    // 7. Health check
    await this.monitor.healthCheck();
  }
}
```

### Self-Healing
- Automatic retry on failures
- Subagent restart on crash
- Connection pool management
- Resource cleanup
- State reconciliation

## Deployment Architecture

### Production Setup
```
Cloudflare Workers (Edge)
├── Master Control Agent (DO)
│   ├── Subagent Pool (DOs)
│   └── MCP Server Farm (Workers)
├── LobeChat Frontend (Pages)
├── LobeChat Backend (Worker)
└── Integration Workers
    ├── Docker Gateway Worker
    ├── Zapier Webhook Worker
    └── n8n Connector Worker

External Services
├── Docker Host (via Tailscale)
├── Zapier Account
├── n8n Instance
└── Custom APIs
```

## API Surface

### Natural Language Interface
```typescript
// User sends natural language commands
await agent.command("Deploy a new worker for image processing to production");
await agent.command("Create a subdomain api.example.com pointing to the worker");
await agent.command("Set up monitoring with alerts for errors > 1%");
```

### Programmatic API
```typescript
// RPC methods for programmatic control
await agent.deployWorker(config);
await agent.createSubagent({ type: 'specialist', domain: 'devops' });
await agent.configureDomain({ domain: 'example.com', dns: [...] });
await agent.scheduleTask({ cron: '0 0 * * *', task: 'backup' });
```

### MCP Integration
```typescript
// Master Agent exposes MCP interface
const mcpServer = new McpAgent({
  name: 'master-control-agent',
  version: '1.0.0',
  tools: [
    { name: 'deploy_worker', schema: WorkerSchema },
    { name: 'create_domain', schema: DomainSchema },
    // ...
  ],
  resources: [
    { uri: 'agent://state', schema: StateSchema },
    { uri: 'agent://subagents', schema: SubagentListSchema },
    // ...
  ]
});
```

## Scalability

### Horizontal Scaling
- Durable Objects automatically distributed globally
- Subagents can be spawned on-demand
- Integration workers scale independently
- MCP servers deployed per-region

### Performance Optimization
- Response caching in AI Gateway
- Connection pooling for external services
- Lazy loading of integrations
- Batch operations where possible
- WebSocket for real-time updates

## Disaster Recovery

### Backup Strategy
1. **Real-time**: Automatic DO persistence
2. **Hourly**: KV snapshot to R2
3. **Daily**: Full state export to R2
4. **Weekly**: Off-site backup

### Recovery Procedures
1. State restoration from most recent backup
2. Subagent re-deployment
3. Integration reconnection
4. Knowledge base sync
5. Audit trail verification

## Non-OpenAI Implementation

### LLM Provider: Anthropic Claude
- Primary: Anthropic Claude via Workers AI binding
- Fallback: Direct Anthropic API (BYOK)
- Models: Claude 3.5 Sonnet, Claude 3 Opus

### AI SDK Configuration
```typescript
import { anthropic } from '@ai-sdk/anthropic';

const model = anthropic('claude-3-5-sonnet-20241022', {
  // No OpenAI dependencies
});
```

## File Structure

```
examples/master-control-agent/
├── ARCHITECTURE.md                 # This file
├── README.md                       # Setup and usage guide
├── package.json
├── tsconfig.json
├── wrangler.jsonc                  # Cloudflare Workers config
├── src/
│   ├── server.ts                   # Entry point, routing
│   ├── core/
│   │   ├── master-agent.ts         # Main MasterControlAgent class
│   │   ├── task-queue.ts           # Task management
│   │   ├── state-manager.ts        # State persistence
│   │   └── decision-engine.ts      # AI decision making
│   ├── security/
│   │   ├── ai-gateway.ts           # AI Gateway integration
│   │   ├── zero-trust.ts           # Access authentication
│   │   ├── prompt-injection.ts     # Input validation
│   │   ├── byok.ts                 # Key management
│   │   └── tailscale.ts            # VPN integration
│   ├── knowledge-base/
│   │   ├── primary-storage.ts      # DO SQLite + KV + R2
│   │   ├── secondary-storage.ts    # AI Gateway + LobeChat
│   │   ├── vector-store.ts         # Embeddings
│   │   └── sync.ts                 # Backup synchronization
│   ├── integrations/
│   │   ├── cloudflare/
│   │   │   ├── workers.ts
│   │   │   ├── durable-objects.ts
│   │   │   ├── domains.ts
│   │   │   ├── storage.ts
│   │   │   └── analytics.ts
│   │   ├── docker/
│   │   │   ├── client.ts
│   │   │   ├── containers.ts
│   │   │   ├── images.ts
│   │   │   └── compose.ts
│   │   ├── mcp-hub/
│   │   │   ├── registry.ts
│   │   │   ├── deployer.ts
│   │   │   ├── authenticator.ts
│   │   │   └── router.ts
│   │   ├── workflow/
│   │   │   ├── zapier.ts
│   │   │   └── n8n.ts
│   │   └── lobechat/
│   │       ├── deployment.ts
│   │       ├── knowledge-sync.ts
│   │       └── plugin-manager.ts
│   ├── subagents/
│   │   ├── base-subagent.ts        # Subagent base class
│   │   ├── deployer.ts             # Deployment system
│   │   ├── registry.ts             # Active subagent tracking
│   │   └── types/
│   │       ├── worker-agent.ts
│   │       ├── specialist-agent.ts
│   │       └── integration-agent.ts
│   ├── audit/
│   │   ├── otel.ts                 # OpenTelemetry setup
│   │   ├── logger.ts               # Structured logging
│   │   ├── metrics.ts              # Performance metrics
│   │   └── tracer.ts               # Distributed tracing
│   └── types/
│       ├── agent.ts                # Type definitions
│       ├── integrations.ts
│       └── subagents.ts
└── client/
    ├── index.html
    ├── src/
    │   ├── main.tsx                # React entry point
    │   ├── components/
    │   │   ├── Chat.tsx            # Main chat interface
    │   │   ├── Dashboard.tsx       # Agent dashboard
    │   │   └── SubagentMonitor.tsx # Subagent status
    │   └── hooks/
    │       └── useAgent.ts         # Agent connection hook
    └── package.json
```

## Next Steps

1. Implement core MasterControlAgent class
2. Set up security layers
3. Implement Cloudflare integrations
4. Build MCP hub management
5. Add Docker integration
6. Implement knowledge base system
7. Create subagent deployment system
8. Add workflow automation integrations
9. Deploy LobeChat integration
10. Set up observability and audit trail
11. Testing and validation
12. Documentation and deployment guide
