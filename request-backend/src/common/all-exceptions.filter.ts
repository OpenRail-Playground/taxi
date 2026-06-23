import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { randomUUID } from 'node:crypto';

interface ErrorResponseBody {
  statusCode: number;
  message: string;
  requestId: string;
  timestamp: string;
  path: string;
}

interface CauseLink {
  name: string;
  message: string;
  status?: number;
  bodyExcerpt?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const req = ctx.getRequest();
    const res = ctx.getResponse();

    const headers = (req?.headers ?? {}) as Record<string, unknown>;
    const incomingIdRaw = headers['x-request-id'];
    const incomingId =
      typeof incomingIdRaw === 'string' && incomingIdRaw.length > 0 ? incomingIdRaw : null;
    const requestId = incomingId ?? randomUUID();

    const isHttp = exception instanceof HttpException;
    const statusCode = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let clientMessage = 'Internal server error';
    if (isHttp) {
      const r = exception.getResponse();
      if (typeof r === 'string') {
        clientMessage = r;
      } else if (r && typeof r === 'object' && 'message' in r) {
        const m = (r as { message: unknown }).message;
        clientMessage = Array.isArray(m) ? m.join('; ') : String(m);
      }
    }

    const path =
      (typeof httpAdapter.getRequestUrl === 'function'
        ? (httpAdapter.getRequestUrl(req) as string | undefined)
        : undefined) ??
      (typeof req?.url === 'string' ? (req.url as string) : '');

    const body: ErrorResponseBody = {
      statusCode,
      message: clientMessage,
      requestId,
      timestamp: new Date().toISOString(),
      path,
    };

    const causes = unwrapCauseChain(exception, 3);
    const logPayload = {
      requestId,
      statusCode,
      method: typeof req?.method === 'string' ? req.method : undefined,
      path,
      exception: {
        name: exception instanceof Error ? exception.name : 'NonError',
        message: exception instanceof Error ? exception.message : String(exception),
      },
      causes,
    };

    if (statusCode >= 500) {
      this.logger.error(
        logPayload,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (statusCode >= 400) {
      this.logger.warn(logPayload);
    } else {
      this.logger.log(logPayload);
    }

    httpAdapter.reply(res, body, statusCode);
  }
}

function unwrapCauseChain(start: unknown, maxDepth: number): CauseLink[] {
  const chain: CauseLink[] = [];
  let cur: unknown =
    start instanceof Error && 'cause' in start ? (start as Error).cause : undefined;
  let depth = 0;
  while (cur !== undefined && cur !== null && depth < maxDepth) {
    if (cur instanceof Error) {
      const link: CauseLink = { name: cur.name, message: cur.message };
      const anyErr = cur as unknown as Record<string, unknown>;
      if (typeof anyErr.status === 'number') link.status = anyErr.status as number;
      if (typeof anyErr.bodyExcerpt === 'string') {
        link.bodyExcerpt = (anyErr.bodyExcerpt as string).slice(0, 512);
      }
      chain.push(link);
      cur = (cur as { cause?: unknown }).cause;
    } else {
      chain.push({ name: 'NonError', message: String(cur) });
      cur = undefined;
    }
    depth++;
  }
  return chain;
}
