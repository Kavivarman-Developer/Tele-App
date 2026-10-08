import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { User, IUserDoc, UserRole } from '../models/user.model';
import {
  CreateUserInput,
  UpdateUserInput,
  BulkCreateUsersInput,
  ListUsersQueryInput,
} from '../validations/user.validation';
import { AppError } from '../utils/AppError';

export class UserService {
  public static async createUser(
    requester: IUserDoc,
    input: CreateUserInput,
  ): Promise<IUserDoc> {
    if (requester.role === 'MANAGER') {
      if (input.role !== 'AGENT') {
        throw new AppError('Managers can only create AGENT users', 403);
      }
      if (!input.managerId) {
        input.managerId = requester._id.toString();
      }
    }

    const existingUser = await User.findOne({ email: input.email.toLowerCase() });
    if (existingUser) {
      throw new AppError('A user with this email already exists', 400);
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(input.password, saltRounds);

    const user = await User.create({
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      passwordHash,
      role: input.role,
      managerId: input.managerId ? new Types.ObjectId(input.managerId) : null,
      isActive: input.isActive ?? true,
      canReceiveLeads: input.canReceiveLeads ?? true,
    });

    return user;
  }

  public static async listUsers(query: ListUsersQueryInput): Promise<IUserDoc[]> {
    const filter: { role?: UserRole; isActive?: boolean } = {};

    if (query.role) {
      filter.role = query.role;
    }

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    const users = await User.find(filter)
      .populate('managerId', 'name email role')
      .sort({ createdAt: -1 });

    return users;
  }

  public static async updateUser(
    requester: IUserDoc,
    userId: string,
    updates: UpdateUserInput,
  ): Promise<IUserDoc> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (updates.role !== undefined && requester.role !== 'ADMIN') {
      throw new AppError('Only administrators can change user roles', 403);
    }

    if (requester.role === 'MANAGER' && user.role !== 'AGENT') {
      throw new AppError('Managers can only modify AGENT users', 403);
    }

    if (updates.name !== undefined) user.name = updates.name;
    if (updates.phone !== undefined) user.phone = updates.phone;
    if (updates.role !== undefined) user.role = updates.role;
    if (updates.isActive !== undefined) user.isActive = updates.isActive;
    if (updates.canReceiveLeads !== undefined) user.canReceiveLeads = updates.canReceiveLeads;
    if (updates.managerId !== undefined) {
      user.managerId = updates.managerId ? new Types.ObjectId(updates.managerId) : null;
    }

    await user.save();
    return user;
  }

  public static async resetPassword(userId: string, newPassword: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const saltRounds = 10;
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await user.save();
  }

  public static async bulkCreateUsers(
    usersInput: BulkCreateUsersInput,
  ): Promise<IUserDoc[]> {
    const emailsInPayload = usersInput.map((u) => u.email.toLowerCase());
    const uniqueEmails = new Set(emailsInPayload);

    if (uniqueEmails.size !== emailsInPayload.length) {
      throw new AppError('Duplicate email addresses detected in the provided users array', 400);
    }

    const existingUsers = await User.find({ email: { $in: Array.from(uniqueEmails) } });
    if (existingUsers.length > 0) {
      const duplicateList = existingUsers.map((u) => u.email).join(', ');
      throw new AppError(
        `The following email addresses already exist: ${duplicateList}`,
        400,
      );
    }

    const saltRounds = 10;
    const usersToCreate = await Promise.all(
      usersInput.map(async (u) => {
        const passwordHash = await bcrypt.hash(u.password, saltRounds);
        return {
          name: u.name,
          email: u.email.toLowerCase(),
          phone: u.phone,
          passwordHash,
          role: u.role,
          managerId: u.managerId ? new Types.ObjectId(u.managerId) : null,
          isActive: u.isActive ?? true,
          canReceiveLeads: u.canReceiveLeads ?? true,
        };
      }),
    );

    const createdUsers = await User.insertMany(usersToCreate);
    return createdUsers;
  }
}
