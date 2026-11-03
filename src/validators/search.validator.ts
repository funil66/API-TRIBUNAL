// Simple validation schemas without Joi for now
export const searchRequestSchema = {
  validate: (data: any) => {
    const errors: string[] = [];
    
    if (!data.type) {
      errors.push('Search type is required');
    } else if (!['name', 'cpf', 'oab'].includes(data.type)) {
      errors.push('Search type must be one of: name, cpf, oab');
    }
    
    if (!data.term || typeof data.term !== 'string') {
      errors.push('Search term is required');
    } else if (data.term.trim().length < 2) {
      errors.push('Search term must be at least 2 characters long');
    }
    
    if (!data.sources || !Array.isArray(data.sources) || data.sources.length === 0) {
      errors.push('At least one source must be specified');
    }
    
    return {
      error: errors.length > 0 ? { details: errors.map(msg => ({ message: msg })) } : null
    };
  }
};

export const searchHistoryQuerySchema = {
  validate: (data: any) => {
    const errors: string[] = [];
    
    if (data.page && (isNaN(parseInt(data.page)) || parseInt(data.page) < 1)) {
      errors.push('Page must be a positive integer');
    }
    
    if (data.limit && (isNaN(parseInt(data.limit)) || parseInt(data.limit) < 1 || parseInt(data.limit) > 100)) {
      errors.push('Limit must be between 1 and 100');
    }
    
    if (data.status && !['pending', 'running', 'completed', 'failed'].includes(data.status)) {
      errors.push('Status must be one of: pending, running, completed, failed');
    }
    
    return {
      error: errors.length > 0 ? { details: errors.map(msg => ({ message: msg })) } : null
    };
  }
};

export const searchIdParamSchema = {
  validate: (data: any) => {
    const errors: string[] = [];
    
    if (!data.id) {
      errors.push('Search ID is required');
    } else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.id)) {
      errors.push('Invalid search ID format');
    }
    
    return {
      error: errors.length > 0 ? { details: errors.map(msg => ({ message: msg })) } : null
    };
  }
};
