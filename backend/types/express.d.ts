import { IUser } from ".";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: IUser;
    }
  }
}