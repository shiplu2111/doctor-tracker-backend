import { Request, Response } from 'express';
import { dashboardService } from './dashboard.service';

export class DashboardController {
  async summary(_req: Request, res: Response): Promise<void> {
    const summary = await dashboardService.getSummary();
    res.status(200).json({
      data: summary,
    });
  }

  async patientsPerDoctor(req: Request, res: Response): Promise<void> {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const stats = await dashboardService.getPatientsPerDoctor(limit);
    res.status(200).json({
      data: stats,
    });
  }

  async timeseries(req: Request, res: Response): Promise<void> {
    const metric = (req.query.metric as 'patients' | 'doctors') || 'patients';
    const interval = (req.query.interval as 'day' | 'week' | 'month') || 'day';
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;

    const points = await dashboardService.getTimeseries(metric, interval, from, to);
    res.status(200).json({
      data: points,
    });
  }

  async conditions(req: Request, res: Response): Promise<void> {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 8;
    const stats = await dashboardService.getConditions(limit);
    res.status(200).json({
      data: stats,
    });
  }

  async specializations(_req: Request, res: Response): Promise<void> {
    const stats = await dashboardService.getSpecializations();
    res.status(200).json({
      data: stats,
    });
  }
}

export const dashboardController = new DashboardController();
