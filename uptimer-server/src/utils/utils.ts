import { IAuthPayload } from "@app/interfaces/user.interface";
import { JWT_TOKEN } from "@app/server/config";
import { Request} from "express";
import { GraphQLError } from "graphql";
import { verify } from "jsonwebtoken";


/**
 * Validates if the provided string is a valid email format.
 * @param {string} email - The email string to validate.
 * @returns {boolean} - Returns true if the email is valid, otherwise false.
 */
export const isEmail = (email: string): boolean => {
  const regexExp =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/gi;
  return regexExp.test(email);
};

/**
 * Authenticate GraphQL route by checking if the JWT token exists in the session.
 * @param req 
 * @returns {void}
 */
export const authenticateGraphQLRoute = (req: Request): void=> {
  if (!req.session?.jwt) {
    throw new GraphQLError("please login again");
  }
  try {
    const payload: IAuthPayload = verify(req.session?.jwt, JWT_TOKEN) as IAuthPayload;
    req.currentUser = payload;
  } 
  catch (error) {
    throw new GraphQLError("please login again");
  }
}