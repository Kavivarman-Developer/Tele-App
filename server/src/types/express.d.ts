import { IUserDoc } from '../models/user.model';

declare global {
  namespace Express {
    interface Request {
      user?: IUserDoc;
    }
  }
}
