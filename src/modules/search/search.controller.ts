import { Request, Response } from 'express';
import { searchService } from './search.service';

export class SearchController {
  async search(req: Request, res: Response): Promise<void> {
    const q = (req.query.q as string) || '';
    const type = (req.query.type as 'all' | 'doctors' | 'patients') || 'all';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;

    const result = await searchService.search(q, type, limit);

    res.status(200).json({
      data: {
        doctors: result.doctors,
        patients: result.patients,
      },
      meta: {
        searchEngine: result.searchEngine,
      },
    });
  }
}

export const searchController = new SearchController();
