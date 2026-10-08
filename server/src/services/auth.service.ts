import jwt from 'jsonwebtoken';
import { User, IUserDoc } from '../models/user.model';
import { LoginInput } from '../validations/auth.validation';
import { AppError } from '../utils/AppError';

export interface AuthResponse {
  token: string;
  user: IUserDoc;
}

export class AuthService {
  public static async login(credentials: LoginInput): Promise<AuthResponse> {
    const { email, password } = credentials;

    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.isActive) {
      throw new AppError('User account has been deactivated. Please contact an administrator.', 401);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401);
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new AppError('JWT_SECRET is not configured on the server', 500);
    }

    const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];

    const token = jwt.sign(
      {
        id: user._id.toString(),
        role: user.role,
      },
      jwtSecret,
      { expiresIn },
    );

    return {
      token,
      user,
    };
  }
}
