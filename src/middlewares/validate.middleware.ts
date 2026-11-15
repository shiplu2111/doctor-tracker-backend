import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

interface ValidationTargets {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}

export const validate = (schemas: ValidationTargets | AnyZodObject) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if ('parseAsync' in schemas) {
        req.body = await schemas.parseAsync(req.body);
      } else {
        if (schemas.body) {
          req.body = await schemas.body.parseAsync(req.body);
        }
        if (schemas.query) {
          req.query = (await schemas.query.parseAsync(req.query)) as Request['query'];
        }
        if (schemas.params) {
          req.params = (await schemas.params.parseAsync(req.params)) as Request['params'];
        }
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(error);
      } else {
        next(error);
      }
    }
  };
};
