import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/api-error';
import { isValidCPF } from '../utils/cpf.validator';
import { validateOAB } from '../utils/oab.validator';

interface ValidationSchema {
  validate: (data: any) => { error: { details: { message: string }[] } | null };
}

export const validateRequest = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      return next(new ApiError(400, `Validation error: ${errorMessage}`));
    }
    
    next();
  };
};

export const validateQuery = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.query);
    
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      return next(new ApiError(400, `Query validation error: ${errorMessage}`));
    }
    
    next();
  };
};

export const validateParams = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.params);
    
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      return next(new ApiError(400, `Params validation error: ${errorMessage}`));
    }
    
    next();
  };
};

export const validateSearchRequest = (req: Request, res: Response, next: NextFunction) => {
    const { name, cpf, oab } = req.body;

    if (!name && !cpf && !oab) {
        return res.status(400).json({ error: 'At least one search parameter (name, CPF, or OAB) is required.' });
    }

    if (cpf && !isValidCPF(cpf)) {
        return res.status(400).json({ error: 'Invalid CPF format.' });
    }

    if (oab && !validateOAB(oab)) {
        return res.status(400).json({ error: 'Invalid OAB number format.' });
    }

    next();
};