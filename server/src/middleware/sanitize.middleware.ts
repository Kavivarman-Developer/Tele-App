import { Request, Response, NextFunction } from 'express';

const cleanObject = (obj: unknown): unknown => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  }

  const recordObj = obj as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};
  for (const key of Object.keys(recordObj)) {
    // Prohibit keys starting with '$' or containing '.' which can be used in MongoDB query injection
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    cleaned[key] = cleanObject(recordObj[key]);
  }
  return cleaned;
};

export const sanitizeNoSql = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body) {
    req.body = cleanObject(req.body);
  }
  if (req.query) {
    req.query = cleanObject(req.query) as Request['query'];
  }
  if (req.params) {
    req.params = cleanObject(req.params) as Request['params'];
  }
  next();
};
