import { mergeTypeDefs } from "@graphql-tools/merge";
import { userSchema } from "./user";
import { notificationSchema } from "./notification";
import { monitorSchema } from "./monitor";

export const mergedGQLSchema = mergeTypeDefs([
  // Add your individual schemas here
  userSchema,
  notificationSchema,
  monitorSchema,
]);