import { IUserDocument } from "@app/interfaces/user.interface";
import { UserModel } from "@app/models/user.model";
import { lowerCase, omit, toLower, upperCase, upperFirst } from "lodash";
import { Model, Op } from "sequelize";


export async function createNewUser(data: IUserDocument): Promise<IUserDocument> {
    try {
        const result: Model = await UserModel.create(data);
        const userData: IUserDocument = omit(result.dataValues, ["password"]);
        return userData;
    }
    catch (error) {
        throw new Error(`Error creating user: ${error.message}`);
    }   
 }
    
export async function getUserByUsernameOrEmail(username:string, email:string): Promise<IUserDocument | undefined> {
    try{
        const user: IUserDocument | undefined = await UserModel.findOne({
            raw: true,
            where: {
                [Op.or]: [{username: upperCase(username)}, {email: lowerCase(email)}]
            }
        }) as unknown as IUserDocument | undefined;
        return user;
    }
    catch (error) {
        throw new Error(`Error fetching user: ${error.message}`);
    }
}

export async function getUserBySocialId(socialId:string, email:string, type:string): Promise<IUserDocument | undefined> {
    try{
        const user: IUserDocument | undefined = await UserModel.findOne({
            raw: true,
            where: {
                [Op.or]: [
                    { ...(type ==='facebook' && {facebookId: socialId}),  
                    ...(type ==='google' && {googleId: socialId}) 
                },
                {email: lowerCase(email)}
                ]
            }
        }) as unknown as IUserDocument | undefined;
        return user;
    }
    catch (error) {
        throw new Error(`Error fetching user: ${error.message}`);
    }
}

export async function getUserByProp(prop:string, type:string): Promise<IUserDocument | undefined> {
    try{
        const user: IUserDocument | undefined = await UserModel.findOne({
            raw: true,
           where: {
                [Op.or]: [
                    { ...(type ==='username' && {username: upperFirst(prop)}),  
                    ...(type ==='email' && {email: toLower(prop)}) 
                },
                ]
            }
        }) as unknown as IUserDocument | undefined;
        return user;
    }
    catch (error) {
        throw new Error(`Error fetching user: ${error.message}`);
    }
}