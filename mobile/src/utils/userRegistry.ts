import { User, UserRole } from '../types';
import { storage } from './storage';

export interface RegisteredUserRecord extends User {
  password?: string;
}

const REGISTRY_STORAGE_KEY = 'tele_registered_users_v2';

export const INITIAL_PRESET_USERS: RegisteredUserRecord[] = [
  {
    _id: 'u-admin',
    name: 'System Admin',
    email: 'admin@example.com',
    phone: '9876543200',
    password: 'Admin@123',
    role: 'ADMIN',
    branch: null,
    isActive: true,
    canReceiveLeads: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    _id: 'u-mgr-trichy',
    name: 'Trichy Manager',
    email: 'manager.trichy@company.com',
    phone: '9876543230',
    password: 'Manager@123',
    role: 'MANAGER',
    branch: 'Trichy',
    isActive: true,
    canReceiveLeads: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    _id: 'u-kavin',
    name: 'Kavin',
    email: 'kavin@company.com',
    phone: '9876543220',
    password: 'Agent@123',
    role: 'AGENT',
    branch: 'Trichy',
    isActive: true,
    canReceiveLeads: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    _id: 'u-sarah',
    name: 'Sarah Telecaller',
    email: 'sarah@company.com',
    phone: '9876543211',
    password: 'Agent@123',
    role: 'AGENT',
    branch: 'Trichy',
    isActive: true,
    canReceiveLeads: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    _id: 'u-mgr-pudukkottai',
    name: 'Pudukkottai Manager',
    email: 'manager.pudukkottai@company.com',
    phone: '9876543240',
    password: 'Manager@123',
    role: 'MANAGER',
    branch: 'Pudukkottai',
    isActive: true,
    canReceiveLeads: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    _id: 'u-john',
    name: 'John Agent',
    email: 'john@company.com',
    phone: '9876543210',
    password: 'Agent@123',
    role: 'AGENT',
    branch: 'Pudukkottai',
    isActive: true,
    canReceiveLeads: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    _id: 'u-alex',
    name: 'Alex Outreach',
    email: 'alex@company.com',
    phone: '9876543212',
    password: 'Agent@123',
    role: 'AGENT',
    branch: 'Pudukkottai',
    isActive: true,
    canReceiveLeads: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export class UserRegistry {
  /**
   * Retrieves all users from persistent storage, merging with initial preset users.
   */
  public static async getAllUsers(): Promise<RegisteredUserRecord[]> {
    try {
      const stored = await storage.getItem(REGISTRY_STORAGE_KEY);
      if (!stored) {
        await storage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(INITIAL_PRESET_USERS));
        return INITIAL_PRESET_USERS;
      }
      const parsed: RegisteredUserRecord[] = JSON.parse(stored);
      // Ensure preset users exist in registry
      const existingEmails = new Set(parsed.map((u) => u.email.toLowerCase()));
      let updated = false;
      for (const preset of INITIAL_PRESET_USERS) {
        if (!existingEmails.has(preset.email.toLowerCase())) {
          parsed.push(preset);
          updated = true;
        }
      }
      if (updated) {
        await storage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      return INITIAL_PRESET_USERS;
    }
  }

  /**
   * Saves or updates a registered user in local persistent storage.
   */
  public static async saveUser(
    userData: {
      name: string;
      email: string;
      phone: string;
      password?: string;
      role: UserRole;
      branch?: string | null;
      canReceiveLeads?: boolean;
      isActive?: boolean;
    },
    explicitId?: string,
  ): Promise<RegisteredUserRecord> {
    const users = await this.getAllUsers();
    const cleanEmail = userData.email.trim().toLowerCase();
    const existingIndex = users.findIndex((u) => u.email.toLowerCase() === cleanEmail);

    const now = new Date().toISOString();
    const newUserRecord: RegisteredUserRecord = {
      _id: explicitId || (existingIndex >= 0 ? users[existingIndex]._id : `u-${Date.now()}`),
      name: userData.name.trim(),
      email: cleanEmail,
      phone: userData.phone.trim(),
      password: userData.password,
      role: userData.role,
      branch: userData.branch || null,
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      canReceiveLeads:
        userData.canReceiveLeads !== undefined
          ? userData.canReceiveLeads
          : userData.role === 'AGENT',
      createdAt: existingIndex >= 0 ? users[existingIndex].createdAt : now,
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      users[existingIndex] = {
        ...users[existingIndex],
        ...newUserRecord,
        password: userData.password || users[existingIndex].password,
      };
    } else {
      users.push(newUserRecord);
    }

    await storage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(users));
    return newUserRecord;
  }

  /**
   * Finds a user by email.
   */
  public static async findByEmail(email: string): Promise<RegisteredUserRecord | null> {
    const cleanEmail = email.trim().toLowerCase();
    const users = await this.getAllUsers();
    return users.find((u) => u.email.toLowerCase() === cleanEmail) || null;
  }

  /**
   * Verifies credentials against local registry.
   */
  public static async verifyCredentials(
    email: string,
    password: string,
  ): Promise<RegisteredUserRecord | null> {
    const cleanEmail = email.trim().toLowerCase();
    const users = await this.getAllUsers();
    const user = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      return null;
    }

    if (!user.isActive) {
      throw new Error('This account has been deactivated.');
    }

    // Check exact password or allow common test patterns
    if (user.password && user.password !== password) {
      return null;
    }

    return user;
  }

  /**
   * Returns users scoped by branch. If branch is null/undefined, returns all.
   */
  public static async getUsersByBranch(
    branch?: string | null,
    role?: UserRole,
  ): Promise<RegisteredUserRecord[]> {
    const users = await this.getAllUsers();
    return users.filter((u) => {
      if (branch && u.branch !== branch) return false;
      if (role && u.role !== role) return false;
      return true;
    });
  }
}
