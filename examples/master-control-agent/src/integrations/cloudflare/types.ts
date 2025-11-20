/**
 * Cloudflare Integration Types
 */

export interface WorkerConfig {
  name: string;
  script: string;
  bindings?: any[];
  routes?: string[];
  compatibilityDate?: string;
  compatibilityFlags?: string[];
}

export interface DomainConfig {
  zoneName: string;
  records: DNSRecord[];
}

export interface DNSRecord {
  type: "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "NS" | "SRV";
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
  priority?: number;
}

export interface WorkerDeployResult {
  success: boolean;
  workerUrl?: string;
  errors?: string[];
}

export interface CloudflareIntegration {
  workers: {
    deploy: (config: WorkerConfig) => Promise<WorkerDeployResult>;
    list: () => Promise<any[]>;
    delete: (name: string) => Promise<void>;
    getLogs: (name: string, limit?: number) => Promise<any[]>;
  };
  domains: {
    create: (domain: string) => Promise<void>;
    configure: (config: DomainConfig) => Promise<void>;
    addDNSRecord: (zoneId: string, record: DNSRecord) => Promise<void>;
    updateDNSRecord: (zoneId: string, recordId: string, record: DNSRecord) => Promise<void>;
    deleteDNSRecord: (zoneId: string, recordId: string) => Promise<void>;
    listZones: () => Promise<any[]>;
    handleCommand: (decision: any) => Promise<any>;
  };
  storage: {
    kv: {
      get: (namespace: string, key: string) => Promise<any>;
      put: (namespace: string, key: string, value: any) => Promise<void>;
      delete: (namespace: string, key: string) => Promise<void>;
      list: (namespace: string, prefix?: string) => Promise<string[]>;
    };
    r2: {
      get: (bucket: string, key: string) => Promise<any>;
      put: (bucket: string, key: string, value: any) => Promise<void>;
      delete: (bucket: string, key: string) => Promise<void>;
      list: (bucket: string, prefix?: string) => Promise<string[]>;
    };
  };
  aiGateway: {
    configure: (config: any) => Promise<void>;
    getStats: () => Promise<any>;
  };
  handleCommand: (decision: any) => Promise<any>;
}
