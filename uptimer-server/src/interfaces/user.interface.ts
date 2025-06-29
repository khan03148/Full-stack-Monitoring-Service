import { INotificationDocument } from "./notification.interface";

declare global {
  namespace Express {
    interface Request {
        currentUser?: IAuthPayload;
    }
  }
}

export interface IAuthPayload {
  id: string;
  username: string;
  email: string;
  iat?: number;
}

export interface IUserDocument {
    id?: string;
    username?: string;
    googleId?: string;
    facebookId?: string;
    email?: string;
    password?: string;
    createdAt?: Date;
    comparePassword?: (password: string, hashedPassword:string) => Promise<boolean>;
    hashPassword?: (password: string) => Promise<string>;

}
export interface IUserResponse {
    user: IUserDocument;
    notifications: INotificationDocument[];
}