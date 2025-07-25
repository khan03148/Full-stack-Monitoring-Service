import { ApolloServer, BaseContext } from "@apollo/server";
import http from "http";
import {
  Express,
  json,
  NextFunction,
  Request,
  Response,
  urlencoded,
} from "express";
import {
  CLIENT_URL,
  NODE_ENV,
  PORT,
  SECRET_KEY_ONE,
  SECRET_KEY_TWO,
} from "./config";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { ApolloServerPluginLandingPageDisabled } from "@apollo/server/plugin/disabled";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import cors from "cors";
import { expressMiddleware } from "@apollo/server/express4";
import cookieSession from "cookie-session";
import logger from "./logger";
import { mergedGQLSchema } from "@app/graphql/schema";
import { GraphQLSchema } from "graphql";
import { resolvers } from "@app/graphql/resolvers";
import { AppContext } from "@app/interfaces/monitor.interface";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customFormat from 'dayjs/plugin/customParseFormat';
import { enableAutoRefreshJob, startMonitors } from "@app/utils/utils";
import { WebSocketServer, Server as WSServer } from "ws";
import { useServer } from 'graphql-ws/use/ws';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customFormat);
export default class MonitorServer {
  private app: Express;
  private httpServer: http.Server;
  private server: ApolloServer;
  private wsServer: WSServer;

  constructor(app: Express) {
    this.app = app;
    this.httpServer = new http.Server(app);
    this.wsServer = new WebSocketServer({server: this.httpServer, path: '/graphql'});
    const schema: GraphQLSchema = makeExecutableSchema({ typeDefs:mergedGQLSchema, resolvers:resolvers });
    const serverCleanup = useServer(
    {
      schema
    },
    this.wsServer
  );
    this.server = new ApolloServer<BaseContext | AppContext>({
      schema,
      introspection: NODE_ENV !== "production",
      plugins: [
        // This plugin is used to drain the HTTP server gracefully when the Apollo Server is stopped.
        ApolloServerPluginDrainHttpServer({ httpServer: this.httpServer }),
        {
          //shutdown the websocket server
          async serverWillStart(){
            return{
              async drainServer(){
                await serverCleanup.dispose();
              }
            }
          }
        },
        NODE_ENV === "production"
          ? ApolloServerPluginLandingPageDisabled()
          : ApolloServerPluginLandingPageLocalDefault({ embed: true }),
      ],
    });
  }

  async start(): Promise<void> {
    //  Note that you must call the start() method on the ApolloServer instance before passing the instance to expressMiddleware
    await this.server.start();
    this.standardMiddleware(this.app);
    this.webSocketConnection();
    this.startServer();
  }

  private standardMiddleware(app: Express): void {
    app.set("trust proxy", 1); // trust first proxy
    app.use((_req: Request, res: Response, next: NextFunction) => {
      res.header("Cache-Control", "no-cache, no-store, must-revalidate");
      next();
    });
    app.use(
      cookieSession({
        name: "session",
        keys: [SECRET_KEY_ONE, SECRET_KEY_TWO],
        maxAge: 24 * 7 * 3600000, // 7d
        secure: NODE_ENV !== "development",
        ...(NODE_ENV !== "development" && {
          sameSite: "none",
        }),
      })
    );
    this.graphqlRoute(app);
    this.healthRoute(app);
  }

  private graphqlRoute(app: Express): void {
    app.use(
      `/graphql`,
      cors({
        origin: CLIENT_URL,
        credentials: true,
      }),
      json({ limit: "200mb" }),
      urlencoded({ extended: true, limit: "200mb" }),
      expressMiddleware(this.server, {
        context: async ({ req, res }: { req: Request; res: Response }) => {
          return { req, res };
        },
      })
    );
  }

  private healthRoute(app: Express): void {
    app.get("/health", (_req: Request, res: Response) => {
      res.status(200).send("uptimer server is healthy and ok");
    });
  }

   private webSocketConnection() {
    this.wsServer.on('connection', (_ws:WebSocket, req: http.IncomingMessage) => {
      if (req.headers && req.headers.cookie) {
        enableAutoRefreshJob(req.headers.cookie);
      }
    });
  }

  private async startServer(): Promise<void> {
    try {
      const SERVER_PORT: number = parseInt(PORT!, 10) || 5000;
      logger.info(`Server is starting on port ${process.pid}`);
      this.httpServer.listen(SERVER_PORT, () => {
        logger.info(`Server is running on port ${SERVER_PORT}`);
        startMonitors();
      });
    } catch (error) {
      logger.error("Error:", "startServer error method", error);
      throw error;
    }
  }
}
