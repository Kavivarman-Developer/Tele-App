import { Branch } from '../types';
import { storage } from './storage';

const BRANCH_STORAGE_KEY = 'tele_registered_branches_v2';

export const INITIAL_PRESET_BRANCHES: Branch[] = [
  {
    _id: 'b-trichy',
    name: 'Trichy',
    code: 'TRZ',
    address: 'Trichy Main Office',
    isActive: true,
  },
  {
    _id: 'b-pudukkottai',
    name: 'Pudukkottai',
    code: 'PDK',
    address: 'Pudukkottai Branch Office',
    isActive: true,
  },
  {
    _id: 'b-coimbatore',
    name: 'Coimbatore',
    code: 'CJB',
    address: 'Coimbatore Regional Office',
    isActive: true,
  },
  {
    _id: 'b-chennai',
    name: 'Chennai',
    code: 'MAA',
    address: 'Chennai Regional Office',
    isActive: true,
  },
  {
    _id: 'b-madurai',
    name: 'Madurai',
    code: 'IXM',
    address: 'Madurai Branch Office',
    isActive: true,
  },
];

export class BranchRegistry {
  /**
   * Retrieves all branches from local storage, auto-seeding default branches if empty.
   */
  public static async getAllBranches(): Promise<Branch[]> {
    try {
      const raw = await storage.getItem(BRANCH_STORAGE_KEY);
      if (!raw) {
        await storage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(INITIAL_PRESET_BRANCHES));
        return INITIAL_PRESET_BRANCHES;
      }
      const parsed: Branch[] = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        await storage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(INITIAL_PRESET_BRANCHES));
        return INITIAL_PRESET_BRANCHES;
      }

      // Ensure preset branches exist
      let updated = false;
      const existingNames = new Set(parsed.map((b) => b.name.toLowerCase()));
      for (const preset of INITIAL_PRESET_BRANCHES) {
        if (!existingNames.has(preset.name.toLowerCase())) {
          parsed.push(preset);
          updated = true;
        }
      }
      if (updated) {
        await storage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      return INITIAL_PRESET_BRANCHES;
    }
  }

  /**
   * Saves or adds a branch to local persistent storage.
   */
  public static async saveBranch(branchData: {
    name: string;
    code?: string;
    address?: string;
  }): Promise<Branch> {
    const branches = await this.getAllBranches();
    const cleanName = branchData.name.trim();

    const existingIndex = branches.findIndex(
      (b) => b.name.toLowerCase() === cleanName.toLowerCase(),
    );

    const now = new Date().toISOString();
    const newRecord: Branch = {
      _id: existingIndex >= 0 ? branches[existingIndex]._id : `b-${Date.now()}`,
      name: cleanName,
      code: branchData.code?.trim().toUpperCase() || '',
      address: branchData.address?.trim() || '',
      isActive: true,
      createdAt: existingIndex >= 0 ? branches[existingIndex].createdAt : now,
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      branches[existingIndex] = {
        ...branches[existingIndex],
        ...newRecord,
      };
    } else {
      branches.push(newRecord);
    }

    await storage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(branches));
    return newRecord;
  }

  /**
   * Deletes a branch by ID from local storage.
   */
  public static async deleteBranch(id: string): Promise<void> {
    const branches = await this.getAllBranches();
    const filtered = branches.filter((b) => b._id !== id);
    await storage.setItem(BRANCH_STORAGE_KEY, JSON.stringify(filtered));
  }
}
