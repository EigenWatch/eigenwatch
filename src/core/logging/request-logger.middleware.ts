import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { LoggerService } from "./logger.service";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const requestId = uuidv4();
    const startTime = Date.now();

    // Attach request ID to request object
    req["requestId"] = requestId;

    // Log incoming request
    this.logger.log({
      msg: "Incoming request",
      requestId,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Log response
    res.on("finish", () => {
      const duration = Date.now() - startTime;
      this.logger.log({
        msg: "Request completed",
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });
    });

    next();
  }
}
