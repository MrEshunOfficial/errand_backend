// types/express/index.d.ts

import { IUser } from ".";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      userId?: string;
    }
  }
}