import { callable } from "./index";

/**
 * User roles in the system
 */
export type UserRole = "admin" | "user" | "guest" | "service";

/**
 * Permission types
 */
export type Permission =
  | "master-control"
  | "security"
  | "mcp-management"
  | "knowledge-base"
  | "audit"
  | "configuration";

/**
 * User information
 */
export type User = {
  /** Unique user identifier */
  id: string;
  /** Username */
  username: string;
  /** User roles */
  roles: UserRole[];
  /** User permissions */
  permissions: Permission[];
  /** Timestamp when user was created */
  createdAt: number;
  /** Timestamp of last login */
  lastLogin?: number;
  /** Whether the user is active */
  active: boolean;
};

/**
 * Authentication token
 */
export type AuthToken = {
  /** Token value */
  token: string;
  /** User ID associated with token */
  userId: string;
  /** Permissions granted by this token */
  permissions: Permission[];
  /** Timestamp when token was created */
  createdAt: number;
  /** Timestamp when token expires */
  expiresAt: number;
  /** IP address that requested the token */
  ipAddress?: string;
};

/**
 * Authentication and Authorization system for Master Control Agent
 */
export class MasterControlAuth {
  /** In-memory storage for users (in a real implementation, this would use durable storage) */
  private users: Map<string, User> = new Map();

  /** In-memory storage for authentication tokens */
  private tokens: Map<string, AuthToken> = new Map();

  /** Default permissions by role */
  private rolePermissions: Record<UserRole, Permission[]> = {
    admin: [
      "master-control",
      "security",
      "mcp-management",
      "knowledge-base",
      "audit",
      "configuration"
    ],
    user: ["master-control", "mcp-management", "knowledge-base"],
    guest: ["master-control"],
    service: ["master-control", "mcp-management"]
  };

  /**
   * Initialize the authentication system with default users
   */
  constructor() {
    this.initializeDefaultUsers();
  }

  /**
   * Initialize default users
   */
  private initializeDefaultUsers(): void {
    // Create a default admin user
    const adminUser: User = {
      id: "admin-001",
      username: "admin",
      roles: ["admin"],
      permissions: this.rolePermissions.admin,
      createdAt: Date.now(),
      active: true
    };

    this.users.set(adminUser.id, adminUser);

    // Create a default service user
    const serviceUser: User = {
      id: "service-001",
      username: "mcp-service",
      roles: ["service"],
      permissions: this.rolePermissions.service,
      createdAt: Date.now(),
      active: true
    };

    this.users.set(serviceUser.id, serviceUser);
  }

  /**
   * Authenticate a user with username and password
   */
  @callable({ description: "Authenticate a user with username and password" })
  async authenticateUser(params: {
    username: string;
    password: string;
    ipAddress?: string;
  }): Promise<{
    success: boolean;
    message: string;
    token?: string;
    userId?: string;
    permissions?: Permission[];
  }> {
    try {
      // In a real implementation, this would check against a secure password store
      // For this example, we'll use a simple check
      let user: User | undefined;

      // Find user by username
      for (const u of this.users.values()) {
        if (u.username === params.username && u.active) {
          user = u;
          break;
        }
      }

      if (!user) {
        return {
          success: false,
          message: "Invalid username or password"
        };
      }

      // In a real implementation, we would verify the password against a hash
      // For this example, we'll assume the password is correct if the username exists
      // and is one of our default users
      if (params.username !== "admin" && params.username !== "mcp-service") {
        return {
          success: false,
          message: "Invalid username or password"
        };
      }

      // Update last login timestamp
      user.lastLogin = Date.now();
      this.users.set(user.id, user);

      // Generate authentication token
      const token = this.generateSecureToken();
      const permissions = this.getUserPermissions(user);

      const authToken: AuthToken = {
        token,
        userId: user.id,
        permissions,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000, // 1 hour
        ipAddress: params.ipAddress
      };

      this.tokens.set(token, authToken);

      return {
        success: true,
        message: "Authentication successful",
        token,
        userId: user.id,
        permissions
      };
    } catch (error) {
      console.error("Authentication error:", error);
      return {
        success: false,
        message: "Authentication failed: Internal error"
      };
    }
  }

  /**
   * Generate a secure token
   */
  private generateSecureToken(): string {
    // In a real implementation, this would use a cryptographically secure method
    // For this example, we'll use a simplified approach
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Validate an authentication token
   */
  @callable({ description: "Validate an authentication token" })
  async validateToken(params: { token: string }): Promise<{
    success: boolean;
    message: string;
    userId?: string;
    permissions?: Permission[];
  }> {
    try {
      const authToken = this.tokens.get(params.token);

      if (!authToken) {
        return {
          success: false,
          message: "Invalid token"
        };
      }

      // Check if token is expired
      if (Date.now() > authToken.expiresAt) {
        this.tokens.delete(params.token);
        return {
          success: false,
          message: "Token expired"
        };
      }

      const user = this.users.get(authToken.userId);
      if (!user || !user.active) {
        this.tokens.delete(params.token);
        return {
          success: false,
          message: "User not found or inactive"
        };
      }

      return {
        success: true,
        message: "Token valid",
        userId: user.id,
        permissions: authToken.permissions
      };
    } catch (error) {
      console.error("Token validation error:", error);
      return {
        success: false,
        message: "Token validation failed: Internal error"
      };
    }
  }

  /**
   * Revoke an authentication token
   */
  @callable({ description: "Revoke an authentication token" })
  async revokeToken(params: {
    token: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const authToken = this.tokens.get(params.token);

      if (!authToken) {
        return {
          success: false,
          message: "Token not found"
        };
      }

      this.tokens.delete(params.token);

      return {
        success: true,
        message: "Token revoked successfully"
      };
    } catch (error) {
      console.error("Token revocation error:", error);
      return {
        success: false,
        message: "Token revocation failed: Internal error"
      };
    }
  }

  /**
   * Create a new user
   */
  @callable({ description: "Create a new user" })
  async createUser(params: {
    username: string;
    roles: UserRole[];
    active?: boolean;
    creatorToken: string;
  }): Promise<{ success: boolean; message: string; userId?: string }> {
    try {
      // Validate creator token
      const creatorValidation = await this.validateToken({
        token: params.creatorToken
      });
      if (!creatorValidation.success) {
        return {
          success: false,
          message: "Invalid creator token"
        };
      }

      // Check if creator has admin permissions
      if (
        !creatorValidation.permissions?.includes("master-control") ||
        !creatorValidation.permissions?.includes("configuration")
      ) {
        return {
          success: false,
          message: "Insufficient permissions to create users"
        };
      }

      // Check if username already exists
      for (const user of this.users.values()) {
        if (user.username === params.username) {
          return {
            success: false,
            message: "Username already exists"
          };
        }
      }

      // Create new user
      const userId = this.generateSecureToken().substring(0, 10);
      const user: User = {
        id: userId,
        username: params.username,
        roles: params.roles,
        permissions: this.getUserPermissionsFromRoles(params.roles),
        createdAt: Date.now(),
        active: params.active !== undefined ? params.active : true
      };

      this.users.set(userId, user);

      return {
        success: true,
        message: "User created successfully",
        userId
      };
    } catch (error) {
      console.error("User creation error:", error);
      return {
        success: false,
        message: "User creation failed: Internal error"
      };
    }
  }

  /**
   * Get user permissions from roles
   */
  private getUserPermissionsFromRoles(roles: UserRole[]): Permission[] {
    const permissions = new Set<Permission>();

    for (const role of roles) {
      const rolePerms = this.rolePermissions[role] || [];
      for (const perm of rolePerms) {
        permissions.add(perm);
      }
    }

    return Array.from(permissions);
  }

  /**
   * Get user permissions
   */
  private getUserPermissions(user: User): Permission[] {
    // Start with role-based permissions
    const permissions = new Set<Permission>(
      this.getUserPermissionsFromRoles(user.roles)
    );

    // Add any additional permissions the user might have
    for (const perm of user.permissions) {
      permissions.add(perm);
    }

    return Array.from(permissions);
  }

  /**
   * Update user roles
   */
  @callable({ description: "Update user roles" })
  async updateUserRoles(params: {
    userId: string;
    roles: UserRole[];
    updaterToken: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      // Validate updater token
      const updaterValidation = await this.validateToken({
        token: params.updaterToken
      });
      if (!updaterValidation.success) {
        return {
          success: false,
          message: "Invalid updater token"
        };
      }

      // Check if updater has admin permissions
      if (
        !updaterValidation.permissions?.includes("master-control") ||
        !updaterValidation.permissions?.includes("configuration")
      ) {
        return {
          success: false,
          message: "Insufficient permissions to update user roles"
        };
      }

      // Find user
      const user = this.users.get(params.userId);
      if (!user) {
        return {
          success: false,
          message: "User not found"
        };
      }

      // Update user roles
      user.roles = params.roles;
      user.permissions = this.getUserPermissionsFromRoles(params.roles);

      this.users.set(params.userId, user);

      // Revoke all tokens for this user to force re-authentication
      for (const [token, authToken] of this.tokens.entries()) {
        if (authToken.userId === params.userId) {
          this.tokens.delete(token);
        }
      }

      return {
        success: true,
        message: "User roles updated successfully"
      };
    } catch (error) {
      console.error("User role update error:", error);
      return {
        success: false,
        message: "User role update failed: Internal error"
      };
    }
  }

  /**
   * Deactivate a user
   */
  @callable({ description: "Deactivate a user" })
  async deactivateUser(params: {
    userId: string;
    deactivatorToken: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      // Validate deactivator token
      const deactivatorValidation = await this.validateToken({
        token: params.deactivatorToken
      });
      if (!deactivatorValidation.success) {
        return {
          success: false,
          message: "Invalid deactivator token"
        };
      }

      // Check if deactivator has admin permissions
      if (
        !deactivatorValidation.permissions?.includes("master-control") ||
        !deactivatorValidation.permissions?.includes("configuration")
      ) {
        return {
          success: false,
          message: "Insufficient permissions to deactivate users"
        };
      }

      // Find user
      const user = this.users.get(params.userId);
      if (!user) {
        return {
          success: false,
          message: "User not found"
        };
      }

      // Deactivate user
      user.active = false;
      this.users.set(params.userId, user);

      // Revoke all tokens for this user
      for (const [token, authToken] of this.tokens.entries()) {
        if (authToken.userId === params.userId) {
          this.tokens.delete(token);
        }
      }

      return {
        success: true,
        message: "User deactivated successfully"
      };
    } catch (error) {
      console.error("User deactivation error:", error);
      return {
        success: false,
        message: "User deactivation failed: Internal error"
      };
    }
  }

  /**
   * Get user information
   */
  @callable({ description: "Get user information" })
  async getUserInfo(params: {
    userId: string;
    requesterToken: string;
  }): Promise<{
    success: boolean;
    message: string;
    user?: Omit<User, "permissions">;
  }> {
    try {
      // Validate requester token
      const requesterValidation = await this.validateToken({
        token: params.requesterToken
      });
      if (!requesterValidation.success) {
        return {
          success: false,
          message: "Invalid requester token"
        };
      }

      // Check if requester has appropriate permissions
      if (!requesterValidation.permissions?.includes("master-control")) {
        return {
          success: false,
          message: "Insufficient permissions to get user information"
        };
      }

      // Find user
      const user = this.users.get(params.userId);
      if (!user) {
        return {
          success: false,
          message: "User not found"
        };
      }

      // Return user info without permissions (for security)
      const { permissions, ...userInfo } = user;

      return {
        success: true,
        message: "User information retrieved successfully",
        user: userInfo
      };
    } catch (error) {
      console.error("User info retrieval error:", error);
      return {
        success: false,
        message: "User info retrieval failed: Internal error"
      };
    }
  }

  /**
   * List all users
   */
  @callable({ description: "List all users" })
  async listUsers(params: { requesterToken: string }): Promise<{
    success: boolean;
    message: string;
    users?: Omit<User, "permissions">[];
  }> {
    try {
      // Validate requester token
      const requesterValidation = await this.validateToken({
        token: params.requesterToken
      });
      if (!requesterValidation.success) {
        return {
          success: false,
          message: "Invalid requester token"
        };
      }

      // Check if requester has appropriate permissions
      if (
        !requesterValidation.permissions?.includes("master-control") ||
        !requesterValidation.permissions?.includes("configuration")
      ) {
        return {
          success: false,
          message: "Insufficient permissions to list users"
        };
      }

      // Get all users without permissions (for security)
      const users = Array.from(this.users.values()).map((user) => {
        const { permissions, ...userInfo } = user;
        return userInfo;
      });

      return {
        success: true,
        message: "Users retrieved successfully",
        users
      };
    } catch (error) {
      console.error("Users listing error:", error);
      return {
        success: false,
        message: "Users listing failed: Internal error"
      };
    }
  }

  /**
   * Check if a user has a specific permission
   */
  @callable({ description: "Check if a user has a specific permission" })
  async checkPermission(params: {
    userId: string;
    permission: Permission;
    checkerToken: string;
  }): Promise<{ success: boolean; message: string; hasPermission?: boolean }> {
    try {
      // Validate checker token
      const checkerValidation = await this.validateToken({
        token: params.checkerToken
      });
      if (!checkerValidation.success) {
        return {
          success: false,
          message: "Invalid checker token"
        };
      }

      // Check if checker has appropriate permissions
      if (!checkerValidation.permissions?.includes("master-control")) {
        return {
          success: false,
          message: "Insufficient permissions to check permissions"
        };
      }

      // Find user
      const user = this.users.get(params.userId);
      if (!user) {
        return {
          success: false,
          message: "User not found"
        };
      }

      // Get user permissions
      const permissions = this.getUserPermissions(user);
      const hasPermission = permissions.includes(params.permission);

      return {
        success: true,
        message: "Permission check completed",
        hasPermission
      };
    } catch (error) {
      console.error("Permission check error:", error);
      return {
        success: false,
        message: "Permission check failed: Internal error"
      };
    }
  }
}
