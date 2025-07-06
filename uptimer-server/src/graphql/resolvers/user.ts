import { JWT_TOKEN } from './../../server/config';
import { INotificationDocument } from "@app/interfaces/notification.interface";
import { IUserDocument, IUserResponse } from "@app/interfaces/user.interface";
import { AppContext } from "@app/server/server";
import { createNotificationGroup, getAllNotificationGroups } from "@app/services/notification.service";
import { createNewUser, getUserByProp, getUserBySocialId, getUserByUsernameOrEmail } from "@app/services/user.service";
import { GraphQLError } from "graphql";
import { toLower, upperFirst } from "lodash";
import { sign } from "jsonwebtoken";
import { UserModel } from '@app/models/user.model';
import { authenticateGraphQLRoute, isEmail } from '@app/utils/utils';
import { Request } from 'express';
import { UserLoginRules, UserRegisterationRules } from '@app/validations';

export const UserResolver = {
    Query: {
        async checkCurrentUser(_: undefined, __: undefined, contextValue: AppContext) {
            const { req } = contextValue;
            authenticateGraphQLRoute(req);
            const notifications = await getAllNotificationGroups(req.currentUser!.id);
            return {
                user: {
                    id: req.currentUser?.id,
                    username: req.currentUser?.username,
                    email: req.currentUser?.email,
                    createdAt: new Date(),
                },
                notifications: notifications
            };
        }
    },
    Mutation: {
        async loginUser(_: undefined, args: { username: string, password: string }, contextValue: AppContext) {
            const { req } = contextValue;
            const { username, password } = args;
            try {
                await UserLoginRules.validate({ username, password }, { abortEarly: false });
            } catch (err) {
                if (err instanceof Error && 'errors' in err) {
                    // Yup ValidationError with multiple messages
                    const messages = (err as any).errors;
                    throw new GraphQLError(messages.join(', '));
                }
                // fallback
                throw new GraphQLError("Validation failed");
            }
            const isValidEmail = isEmail(username);
            const type: string = !isValidEmail ? 'username' : 'email';
            const existingUser: IUserDocument | undefined = await getUserByProp(username, type);
            if (!existingUser) {
                throw new GraphQLError('Invalid crendetials');
            }
            const passwordsMatch: boolean = await UserModel.prototype.comparePassword(password, existingUser.password!);
            if (!passwordsMatch) {
                throw new GraphQLError('Invalid crendetials');
            }
            const respponse: IUserResponse = await userReturnValue(req, existingUser, 'login');
            return respponse;
        },
        async registerUser(_: undefined, args: { user: IUserDocument }, contextValue: AppContext) {
            const { req } = contextValue;
            const { user } = args;
            try {
                await UserRegisterationRules.validate(user, { abortEarly: false });
            } catch (err) {
                if (err instanceof Error && 'errors' in err) {
                    const messages = (err as any).errors;
                    throw new GraphQLError(messages.join(', '));
                }
                throw new GraphQLError("Validation failed");
            }
            const { username, email, password } = user;
            const checkIfUserExist: IUserDocument | undefined = await getUserByUsernameOrEmail(username!, email!);
            if (checkIfUserExist) {
                throw new GraphQLError("User already registered with this username or email.");
            }
            const authData: IUserDocument = {
                username: upperFirst(username),
                email: toLower(email),
                password: password
            } as IUserDocument
            const result: IUserDocument | undefined = await createNewUser(authData)
            const respponse: IUserResponse = await userReturnValue(req, result!, 'register');
            return respponse;

        },
        async authSocialUser(_: undefined, args: { user: IUserDocument }, contextValue: AppContext) {
            const { req } = contextValue;
            const { user } = args;
            try {
                await UserRegisterationRules.validate(user, { abortEarly: false });
            } catch (err) {
                if (err instanceof Error && 'errors' in err) {
                    const messages = (err as any).errors;
                    throw new GraphQLError(messages.join(', '));
                }
                throw new GraphQLError("Validation failed");
            }
            const { username, email, socialId, type } = user;
            const checkIfUserExist: IUserDocument | undefined = await getUserBySocialId(socialId!, email!, type!);
            if (checkIfUserExist) {
                const respponse: IUserResponse = await userReturnValue(req, checkIfUserExist!, 'login');
                return respponse;
            } else {
                const authData: IUserDocument = {
                    username: upperFirst(username),
                    email: toLower(email),
                    ...(type === 'facebook' && { facebookId: socialId }),
                    ...(type === 'google' && { googleId: socialId }),
                } as IUserDocument
                const result: IUserDocument | undefined = await createNewUser(authData)
                const respponse: IUserResponse = await userReturnValue(req, result!, 'register');
                return respponse;
            }

        },
        logout(_: undefined, __: undefined, contextValue: AppContext) {
            const { req } = contextValue;
            req.session = null;
            req.currentUser = undefined;
            return null;

        },
    },
    User: {
        createdAt: (user: IUserDocument) => new Date(user.createdAt!).toISOString(),
    }
};

async function userReturnValue(req: Request, result: IUserDocument, type: string): Promise<IUserResponse> {
    let notifications: INotificationDocument[] = [];
    if (type === 'register' && result && result.id && result.email) {
        const notification = await createNotificationGroup({
            userId: result.id,
            groupName: 'default contact group',
            emails: JSON.stringify([result.email])
        });
        notifications.push(notification);

    } else if (type === 'login' && result && result.id && result.email) {
        notifications = await getAllNotificationGroups(result.id);
    }
    const userJwt: string = sign(
        {
            id: result.id,
            email: result.email,
            username: result.username
        },
        JWT_TOKEN
    );
    req.session = { jwt: userJwt, enableAutomaRefresh: false }
    const user: IUserDocument = {
        id: result.id,
        email: result.email,
        username: result.username,
        createdAt: result.createdAt,

    } as IUserDocument
    return {
        user,
        notifications
    };
}
