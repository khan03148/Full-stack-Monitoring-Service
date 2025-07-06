export interface INotificationDocument {
    id?: string;
    userId?: number;    
    groupName: string;
    emails: string;
    createdAt?: Date;
}

export interface IEmailLocals {
    sender?: string;
    appLink: string;
    AppIcon: string;
    AppName: string;
    subject?: string;
    username?: string;
}