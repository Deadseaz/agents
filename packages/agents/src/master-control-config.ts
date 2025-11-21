import { callable } from "./index";

/**
 * Configuration section types
 */
export type ConfigSection =
  | "security"
  | "mcp"
  | "knowledge"
  | "monitoring"
  | "network"
  | "storage"
  | "authentication"
  | "authorization"
  | "communication"
  | "general";

/**
 * Security configuration
 */
export type SecurityConfig = {
  /** Security level */
  level: "low" | "medium" | "high" | "critical";
  /** Whether to enable encryption */
  encryptionEnabled: boolean;
  /** Encryption algorithm */
  encryptionAlgorithm: "AES-256-GCM" | "ChaCha20-Poly1305";
  /** Session timeout in milliseconds */
  sessionTimeout: number;
  /** Maximum failed authentication attempts before lockout */
  maxFailedAuthAttempts: number;
  /** Lockout duration in milliseconds */
  lockoutDuration: number;
};

/**
 * MCP configuration
 */
export type MCPConfig = {
  /** Default MCP server timeout in milliseconds */
  defaultTimeout: number;
  /** Maximum number of concurrent MCP connections */
  maxConcurrentConnections: number;
  /** Whether to enable automatic reconnection */
  autoReconnect: boolean;
  /** Reconnection interval in milliseconds */
  reconnectionInterval: number;
  /** Maximum reconnection attempts */
  maxReconnectionAttempts: number;
};

/**
 * Knowledge base configuration
 */
export type KnowledgeConfig = {
  /** Maximum number of entries to keep in memory */
  maxEntries: number;
  /** Whether to enable full-text search */
  fullTextSearch: boolean;
  /** Default tags to apply to all entries */
  defaultTags: string[];
  /** Whether to enable automatic cleanup of old entries */
  autoCleanup: boolean;
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
};

/**
 * Monitoring configuration
 */
export type MonitoringConfig = {
  /** Whether to enable metrics collection */
  metricsEnabled: boolean;
  /** Metrics collection interval in milliseconds */
  metricsInterval: number;
  /** Whether to enable alerting */
  alertingEnabled: boolean;
  /** Alert evaluation interval in milliseconds */
  alertingInterval: number;
  /** Maximum number of logs to keep in memory */
  maxLogs: number;
  /** Log level threshold */
  logLevel: "debug" | "info" | "warn" | "error" | "fatal";
};

/**
 * Network configuration
 */
export type NetworkConfig = {
  /** Default port for the agent */
  port: number;
  /** Host address to bind to */
  host: string;
  /** Whether to enable HTTPS */
  httpsEnabled: boolean;
  /** SSL certificate file path */
  sslCertPath?: string;
  /** SSL private key file path */
  sslKeyPath?: string;
  /** CORS configuration */
  cors: {
    /** Whether to enable CORS */
    enabled: boolean;
    /** Allowed origins */
    allowedOrigins: string[];
    /** Allowed methods */
    allowedMethods: string[];
    /** Allowed headers */
    allowedHeaders: string[];
  };
};

/**
 * Storage configuration
 */
export type StorageConfig = {
  /** Storage type */
  type: "memory" | "file" | "database";
  /** Storage path (for file/database storage) */
  path?: string;
  /** Database connection string (for database storage) */
  connectionString?: string;
  /** Whether to enable encryption for stored data */
  encryptionEnabled: boolean;
  /** Backup configuration */
  backup: {
    /** Whether to enable automatic backups */
    enabled: boolean;
    /** Backup interval in milliseconds */
    interval: number;
    /** Backup retention count */
    retention: number;
  };
};

/**
 * Authentication configuration
 */
export type AuthConfig = {
  /** Default token expiration time in milliseconds */
  tokenExpiration: number;
  /** Refresh token expiration time in milliseconds */
  refreshTokenExpiration: number;
  /** Whether to enable multi-factor authentication */
  mfaEnabled: boolean;
  /** Supported authentication methods */
  methods: ("password" | "oauth" | "certificate" | "biometric")[];
  /** Password policy */
  passwordPolicy: {
    /** Minimum password length */
    minLength: number;
    /** Whether to require uppercase letters */
    requireUppercase: boolean;
    /** Whether to require lowercase letters */
    requireLowercase: boolean;
    /** Whether to require numbers */
    requireNumbers: boolean;
    /** Whether to require special characters */
    requireSpecial: boolean;
  };
};

/**
 * Authorization configuration
 */
export type AuthzConfig = {
  /** Default role for new users */
  defaultRole: string;
  /** Role hierarchy */
  roleHierarchy: Record<string, string[]>;
  /** Permission inheritance */
  permissionInheritance: boolean;
  /** Whether to enable attribute-based access control */
  abacEnabled: boolean;
};

/**
 * Communication configuration
 */
export type CommunicationConfig = {
  /** Default encryption algorithm */
  encryptionAlgorithm: "AES-256-GCM" | "ChaCha20-Poly1305";
  /** Default integrity algorithm */
  integrityAlgorithm: "SHA-256" | "SHA-384" | "SHA-512";
  /** Message timeout in milliseconds */
  messageTimeout: number;
  /** Maximum message size in bytes */
  maxMessageSize: number;
  /** Whether to enable message compression */
  compressionEnabled: boolean;
};

/**
 * General configuration
 */
export type GeneralConfig = {
  /** Application name */
  appName: string;
  /** Application version */
  version: string;
  /** Environment */
  environment: "development" | "staging" | "production";
  /** Debug mode */
  debug: boolean;
  /** Locale */
  locale: string;
  /** Timezone */
  timezone: string;
};

/**
 * Master Control Configuration
 */
export type MasterControlConfig = {
  /** Security configuration */
  security: SecurityConfig;
  /** MCP configuration */
  mcp: MCPConfig;
  /** Knowledge base configuration */
  knowledge: KnowledgeConfig;
  /** Monitoring configuration */
  monitoring: MonitoringConfig;
  /** Network configuration */
  network: NetworkConfig;
  /** Storage configuration */
  storage: StorageConfig;
  /** Authentication configuration */
  authentication: AuthConfig;
  /** Authorization configuration */
  authorization: AuthzConfig;
  /** Communication configuration */
  communication: CommunicationConfig;
  /** General configuration */
  general: GeneralConfig;
};

/**
 * Configuration Management system for Master Control Agent
 */
export class MasterControlConfigManager {
  /** Current configuration */
  private config: MasterControlConfig;

  /** Configuration version */
  private version = "1.0.0";

  /** Configuration last updated timestamp */
  private lastUpdated: number = Date.now();

  /** Configuration change listeners */
  private changeListeners: Array<
    (section: ConfigSection, key: string, value: any) => void
  > = [];

  /**
   * Initialize the configuration management system
   */
  constructor() {
    // Initialize with default configuration
    this.config = this.getDefaultConfig();
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): MasterControlConfig {
    return {
      security: {
        level: "high",
        encryptionEnabled: true,
        encryptionAlgorithm: "AES-256-GCM",
        sessionTimeout: 3600000, // 1 hour
        maxFailedAuthAttempts: 5,
        lockoutDuration: 900000 // 15 minutes
      },
      mcp: {
        defaultTimeout: 30000, // 30 seconds
        maxConcurrentConnections: 100,
        autoReconnect: true,
        reconnectionInterval: 5000, // 5 seconds
        maxReconnectionAttempts: 10
      },
      knowledge: {
        maxEntries: 10000,
        fullTextSearch: true,
        defaultTags: ["system", "master-control"],
        autoCleanup: true,
        cleanupInterval: 86400000 // 24 hours
      },
      monitoring: {
        metricsEnabled: true,
        metricsInterval: 60000, // 1 minute
        alertingEnabled: true,
        alertingInterval: 30000, // 30 seconds
        maxLogs: 10000,
        logLevel: "info"
      },
      network: {
        port: 3000,
        host: "localhost",
        httpsEnabled: false,
        cors: {
          enabled: true,
          allowedOrigins: ["*"],
          allowedMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
          allowedHeaders: ["Content-Type", "Authorization"]
        }
      },
      storage: {
        type: "memory",
        encryptionEnabled: true,
        backup: {
          enabled: true,
          interval: 3600000, // 1 hour
          retention: 7 // 7 backups
        }
      },
      authentication: {
        tokenExpiration: 3600000, // 1 hour
        refreshTokenExpiration: 86400000, // 24 hours
        mfaEnabled: false,
        methods: ["password", "oauth"],
        passwordPolicy: {
          minLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecial: true
        }
      },
      authorization: {
        defaultRole: "user",
        roleHierarchy: {
          admin: ["user", "guest"],
          user: ["guest"],
          guest: []
        },
        permissionInheritance: true,
        abacEnabled: false
      },
      communication: {
        encryptionAlgorithm: "AES-256-GCM",
        integrityAlgorithm: "SHA-256",
        messageTimeout: 30000, // 30 seconds
        maxMessageSize: 10485760, // 10MB
        compressionEnabled: true
      },
      general: {
        appName: "Master Control Agent",
        version: "1.0.0",
        environment: "development",
        debug: false,
        locale: "en-US",
        timezone: "UTC"
      }
    };
  }

  /**
   * Get configuration value
   */
  @callable({ description: "Get configuration value" })
  async getConfigValue(params: {
    section: ConfigSection;
    key: string;
  }): Promise<{
    success: boolean;
    message: string;
    value?: any;
  }> {
    try {
      // Navigate to the section
      const section = this.config[params.section];
      if (!section) {
        return {
          success: false,
          message: `Configuration section '${params.section}' not found`
        };
      }

      // Get the value
      const value = section[params.key as keyof typeof section];

      if (value === undefined) {
        return {
          success: false,
          message: `Configuration key '${params.key}' not found in section '${params.section}'`
        };
      }

      return {
        success: true,
        message: "Configuration value retrieved successfully",
        value
      };
    } catch (error) {
      console.error("Configuration value retrieval error:", error);
      return {
        success: false,
        message: "Failed to retrieve configuration value: Internal error"
      };
    }
  }

  /**
   * Set configuration value
   */
  @callable({ description: "Set configuration value" })
  async setConfigValue(params: {
    section: ConfigSection;
    key: string;
    value: any;
  }): Promise<{ success: boolean; message: string }> {
    try {
      // Navigate to the section
      const section = this.config[params.section];
      if (!section) {
        return {
          success: false,
          message: `Configuration section '${params.section}' not found`
        };
      }

      // Set the value
      (section as any)[params.key] = params.value;

      // Update last updated timestamp
      this.lastUpdated = Date.now();

      // Notify change listeners
      this.notifyChangeListeners(params.section, params.key, params.value);

      return {
        success: true,
        message: "Configuration value set successfully"
      };
    } catch (error) {
      console.error("Configuration value setting error:", error);
      return {
        success: false,
        message: "Failed to set configuration value: Internal error"
      };
    }
  }

  /**
   * Get entire configuration section
   */
  @callable({ description: "Get entire configuration section" })
  async getConfigSection(params: { section: ConfigSection }): Promise<{
    success: boolean;
    message: string;
    config?: Record<string, any>;
  }> {
    try {
      // Navigate to the section
      const section = this.config[params.section];
      if (!section) {
        return {
          success: false,
          message: `Configuration section '${params.section}' not found`
        };
      }

      return {
        success: true,
        message: "Configuration section retrieved successfully",
        config: section as Record<string, any>
      };
    } catch (error) {
      console.error("Configuration section retrieval error:", error);
      return {
        success: false,
        message: "Failed to retrieve configuration section: Internal error"
      };
    }
  }

  /**
   * Set entire configuration section
   */
  @callable({ description: "Set entire configuration section" })
  async setConfigSection(params: {
    section: ConfigSection;
    config: Record<string, any>;
  }): Promise<{ success: boolean; message: string }> {
    try {
      // Set the section
      (this.config as any)[params.section] = params.config;

      // Update last updated timestamp
      this.lastUpdated = Date.now();

      // Notify change listeners for each key
      for (const [key, value] of Object.entries(params.config)) {
        this.notifyChangeListeners(params.section, key, value);
      }

      return {
        success: true,
        message: "Configuration section set successfully"
      };
    } catch (error) {
      console.error("Configuration section setting error:", error);
      return {
        success: false,
        message: "Failed to set configuration section: Internal error"
      };
    }
  }

  /**
   * Get entire configuration
   */
  @callable({ description: "Get entire configuration" })
  async getFullConfig(): Promise<{
    success: boolean;
    message: string;
    config?: MasterControlConfig;
  }> {
    try {
      return {
        success: true,
        message: "Full configuration retrieved successfully",
        config: { ...this.config } // Return a copy to prevent direct modification
      };
    } catch (error) {
      console.error("Full configuration retrieval error:", error);
      return {
        success: false,
        message: "Failed to retrieve full configuration: Internal error"
      };
    }
  }

  /**
   * Update configuration from object
   */
  @callable({ description: "Update configuration from object" })
  async updateConfig(params: {
    config: Partial<MasterControlConfig>;
  }): Promise<{ success: boolean; message: string }> {
    try {
      // Update each section
      for (const [sectionName, sectionConfig] of Object.entries(
        params.config
      )) {
        if (sectionConfig) {
          // Update the section
          (this.config as any)[sectionName] = {
            ...(this.config as any)[sectionName],
            ...sectionConfig
          };

          // Notify change listeners for each key
          for (const [key, value] of Object.entries(sectionConfig)) {
            this.notifyChangeListeners(
              sectionName as ConfigSection,
              key,
              value
            );
          }
        }
      }

      // Update last updated timestamp
      this.lastUpdated = Date.now();

      return {
        success: true,
        message: "Configuration updated successfully"
      };
    } catch (error) {
      console.error("Configuration update error:", error);
      return {
        success: false,
        message: "Failed to update configuration: Internal error"
      };
    }
  }

  /**
   * Reset configuration to defaults
   */
  @callable({ description: "Reset configuration to defaults" })
  async resetConfig(): Promise<{ success: boolean; message: string }> {
    try {
      // Reset to default configuration
      this.config = this.getDefaultConfig();

      // Update last updated timestamp
      this.lastUpdated = Date.now();

      // Notify change listeners for each section
      for (const [sectionName, sectionConfig] of Object.entries(this.config)) {
        for (const [key, value] of Object.entries(sectionConfig)) {
          this.notifyChangeListeners(sectionName as ConfigSection, key, value);
        }
      }

      return {
        success: true,
        message: "Configuration reset to defaults successfully"
      };
    } catch (error) {
      console.error("Configuration reset error:", error);
      return {
        success: false,
        message: "Failed to reset configuration: Internal error"
      };
    }
  }

  /**
   * Validate configuration
   */
  @callable({ description: "Validate configuration" })
  async validateConfig(): Promise<{
    success: boolean;
    message: string;
    errors?: string[];
  }> {
    try {
      const errors: string[] = [];

      // Validate security configuration
      if (this.config.security.sessionTimeout <= 0) {
        errors.push("Security: sessionTimeout must be greater than 0");
      }

      if (this.config.security.maxFailedAuthAttempts <= 0) {
        errors.push("Security: maxFailedAuthAttempts must be greater than 0");
      }

      if (this.config.security.lockoutDuration <= 0) {
        errors.push("Security: lockoutDuration must be greater than 0");
      }

      // Validate MCP configuration
      if (this.config.mcp.defaultTimeout <= 0) {
        errors.push("MCP: defaultTimeout must be greater than 0");
      }

      if (this.config.mcp.maxConcurrentConnections <= 0) {
        errors.push("MCP: maxConcurrentConnections must be greater than 0");
      }

      if (this.config.mcp.reconnectionInterval <= 0) {
        errors.push("MCP: reconnectionInterval must be greater than 0");
      }

      if (this.config.mcp.maxReconnectionAttempts <= 0) {
        errors.push("MCP: maxReconnectionAttempts must be greater than 0");
      }

      // Validate knowledge configuration
      if (this.config.knowledge.maxEntries <= 0) {
        errors.push("Knowledge: maxEntries must be greater than 0");
      }

      if (this.config.knowledge.cleanupInterval <= 0) {
        errors.push("Knowledge: cleanupInterval must be greater than 0");
      }

      // Validate monitoring configuration
      if (this.config.monitoring.metricsInterval <= 0) {
        errors.push("Monitoring: metricsInterval must be greater than 0");
      }

      if (this.config.monitoring.alertingInterval <= 0) {
        errors.push("Monitoring: alertingInterval must be greater than 0");
      }

      if (this.config.monitoring.maxLogs <= 0) {
        errors.push("Monitoring: maxLogs must be greater than 0");
      }

      // Validate network configuration
      if (this.config.network.port <= 0 || this.config.network.port > 65535) {
        errors.push("Network: port must be between 1 and 65535");
      }

      // Validate storage configuration
      if (this.config.storage.backup.interval <= 0) {
        errors.push("Storage: backup.interval must be greater than 0");
      }

      if (this.config.storage.backup.retention <= 0) {
        errors.push("Storage: backup.retention must be greater than 0");
      }

      // Validate authentication configuration
      if (this.config.authentication.tokenExpiration <= 0) {
        errors.push("Authentication: tokenExpiration must be greater than 0");
      }

      if (this.config.authentication.refreshTokenExpiration <= 0) {
        errors.push(
          "Authentication: refreshTokenExpiration must be greater than 0"
        );
      }

      if (this.config.authentication.passwordPolicy.minLength <= 0) {
        errors.push(
          "Authentication: passwordPolicy.minLength must be greater than 0"
        );
      }

      // Validate authorization configuration
      if (!this.config.authorization.defaultRole) {
        errors.push("Authorization: defaultRole must be specified");
      }

      // Validate communication configuration
      if (this.config.communication.messageTimeout <= 0) {
        errors.push("Communication: messageTimeout must be greater than 0");
      }

      if (this.config.communication.maxMessageSize <= 0) {
        errors.push("Communication: maxMessageSize must be greater than 0");
      }

      if (errors.length > 0) {
        return {
          success: false,
          message: "Configuration validation failed",
          errors
        };
      }

      return {
        success: true,
        message: "Configuration validation passed"
      };
    } catch (error) {
      console.error("Configuration validation error:", error);
      return {
        success: false,
        message: "Failed to validate configuration: Internal error"
      };
    }
  }

  /**
   * Get configuration metadata
   */
  @callable({ description: "Get configuration metadata" })
  async getConfigMetadata(): Promise<{
    success: boolean;
    message: string;
    metadata?: {
      version: string;
      lastUpdated: number;
      sections: ConfigSection[];
    };
  }> {
    try {
      const sections = Object.keys(this.config) as ConfigSection[];

      return {
        success: true,
        message: "Configuration metadata retrieved successfully",
        metadata: {
          version: this.version,
          lastUpdated: this.lastUpdated,
          sections
        }
      };
    } catch (error) {
      console.error("Configuration metadata retrieval error:", error);
      return {
        success: false,
        message: "Failed to retrieve configuration metadata: Internal error"
      };
    }
  }

  /**
   * Add a configuration change listener
   */
  addChangeListener(
    listener: (section: ConfigSection, key: string, value: any) => void
  ): void {
    this.changeListeners.push(listener);
  }

  /**
   * Remove a configuration change listener
   */
  removeChangeListener(
    listener: (section: ConfigSection, key: string, value: any) => void
  ): void {
    const index = this.changeListeners.indexOf(listener);
    if (index !== -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  /**
   * Notify configuration change listeners
   */
  private notifyChangeListeners(
    section: ConfigSection,
    key: string,
    value: any
  ): void {
    for (const listener of this.changeListeners) {
      try {
        listener(section, key, value);
      } catch (error) {
        console.error("Configuration change listener error:", error);
      }
    }
  }

  /**
   * Export configuration to JSON
   */
  @callable({ description: "Export configuration to JSON" })
  async exportConfig(): Promise<{
    success: boolean;
    message: string;
    json?: string;
  }> {
    try {
      const json = JSON.stringify(this.config, null, 2);

      return {
        success: true,
        message: "Configuration exported successfully",
        json
      };
    } catch (error) {
      console.error("Configuration export error:", error);
      return {
        success: false,
        message: "Failed to export configuration: Internal error"
      };
    }
  }

  /**
   * Import configuration from JSON
   */
  @callable({ description: "Import configuration from JSON" })
  async importConfig(params: {
    json: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const importedConfig = JSON.parse(params.json);

      // Validate the imported configuration
      const validation = await this.validateConfig();
      if (!validation.success) {
        return {
          success: false,
          message: `Invalid configuration: ${validation.errors?.join(", ") || "Validation failed"}`
        };
      }

      // Update the configuration
      this.config = importedConfig;

      // Update last updated timestamp
      this.lastUpdated = Date.now();

      // Notify change listeners for each section
      for (const [sectionName, sectionConfig] of Object.entries(this.config)) {
        for (const [key, value] of Object.entries(sectionConfig)) {
          this.notifyChangeListeners(sectionName as ConfigSection, key, value);
        }
      }

      return {
        success: true,
        message: "Configuration imported successfully"
      };
    } catch (error) {
      console.error("Configuration import error:", error);
      return {
        success: false,
        message: "Failed to import configuration: Internal error"
      };
    }
  }
}
