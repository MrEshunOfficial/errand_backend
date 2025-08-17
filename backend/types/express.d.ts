// types/express/index.d.ts
import { Types } from "mongoose";

declare global {
  namespace Express {
    interface UserPayload {
      id?: string | Types.ObjectId;
      userId?: string | Types.ObjectId;
    }

    interface Request {
      user?: UserPayload;
    }
  }
}
