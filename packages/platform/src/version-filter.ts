import { InternalServerErrorException, VERSION_NEUTRAL, VersioningType, type VersioningOptions } from '@nestjs/common';
import type { VersionValue } from '@nestjs/common/internal';
import type { BunRequest } from './request.js';
import type { BunResponse } from './response.js';
import type { NextFunction } from './router.js';
import { isString, isNil } from './utils.js';

type Handler = (req: BunRequest, res: BunResponse, next: NextFunction) => unknown;

/** Same logic as the Express adapter: wrap the handler so non-matching versions fall through. */
export function applyVersionFilter(handler: Function, version: VersionValue, versioningOptions: VersioningOptions): Handler {
  const callNext = (_req: BunRequest, _res: BunResponse, next?: NextFunction) => {
    if (!next) throw new InternalServerErrorException('HTTP adapter does not support filtering on version');
    return next();
  };
  const run = (req: BunRequest, res: BunResponse, next: NextFunction) => handler(req, res, next);

  if (version === VERSION_NEUTRAL || versioningOptions.type === VersioningType.URI) {
    return run;
  }

  if (versioningOptions.type === VersioningType.CUSTOM) {
    return (req, res, next) => {
      const extracted = versioningOptions.extractor(req);
      if (Array.isArray(version)) {
        if (Array.isArray(extracted) && version.some((v) => extracted.includes(v as string))) return run(req, res, next);
        if (isString(extracted) && (version as string[]).includes(extracted)) return run(req, res, next);
      } else if (isString(version)) {
        if (Array.isArray(extracted) && extracted.includes(version)) return run(req, res, next);
        if (isString(extracted) && version === extracted) return run(req, res, next);
      }
      return callNext(req, res, next);
    };
  }

  if (versioningOptions.type === VersioningType.MEDIA_TYPE) {
    return (req, res, next) => {
      const accept = req.headers['accept'];
      const param = accept ? accept.split(';')[1] : undefined;
      if (isNil(param)) {
        if (Array.isArray(version) && version.includes(VERSION_NEUTRAL)) return run(req, res, next);
      } else {
        const headerVersion = param.split(versioningOptions.key)[1];
        if (Array.isArray(version) && version.includes(headerVersion as string)) return run(req, res, next);
        if (isString(version) && version === headerVersion) return run(req, res, next);
      }
      return callNext(req, res, next);
    };
  }

  if (versioningOptions.type === VersioningType.HEADER) {
    return (req, res, next) => {
      const headerVersion = req.headers[versioningOptions.header.toLowerCase()];
      if (isNil(headerVersion)) {
        if (Array.isArray(version) && version.includes(VERSION_NEUTRAL)) return run(req, res, next);
      } else {
        if (Array.isArray(version) && version.includes(headerVersion)) return run(req, res, next);
        if (isString(version) && version === headerVersion) return run(req, res, next);
      }
      return callNext(req, res, next);
    };
  }

  throw new Error('Unsupported versioning options');
}
