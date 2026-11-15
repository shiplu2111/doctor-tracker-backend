import { Request, Response } from 'express';
import { doctorService } from './doctor.service';
import { DoctorQueryFilter, DoctorStatus } from './doctor.types';

export class DoctorController {
  async create(req: Request, res: Response): Promise<void> {
    const doctor = await doctorService.createDoctor(req.body, req.user?.id);
    res.status(201).json({
      data: doctor,
    });
  }

  async list(req: Request, res: Response): Promise<void> {
    const filter: DoctorQueryFilter = {
      q: (req.query.q || req.query.search) as string,
      specialization: req.query.specialization as string,
      hospital: req.query.hospital as string,
      status: req.query.status as DoctorStatus,
      from: req.query.from ? new Date(req.query.from as string) : undefined,
      to: req.query.to ? new Date(req.query.to as string) : undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      sort: req.query.sort as string,
    };

    const result = await doctorService.listDoctors(filter);

    res.status(200).json({
      data: result.doctors,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        searchEngine: 'mongo',
      },
    });
  }

  async getById(req: Request, res: Response): Promise<void> {
    const doctor = await doctorService.getDoctorById(req.params.id);
    res.status(200).json({
      data: doctor,
    });
  }

  async update(req: Request, res: Response): Promise<void> {
    const doctor = await doctorService.updateDoctor(req.params.id, req.body);
    res.status(200).json({
      data: doctor,
    });
  }

  async delete(req: Request, res: Response): Promise<void> {
    const reassignTo = req.query.reassignTo as string | undefined;
    await doctorService.deleteDoctor(req.params.id, reassignTo, req.user?.id);
    res.status(204).send();
  }

  async specializations(_req: Request, res: Response): Promise<void> {
    const specializations = await doctorService.getSpecializations();
    res.status(200).json({
      data: specializations,
    });
  }

  async bulkImport(req: Request, res: Response): Promise<void> {
    const { doctors } = req.body;
    const result = await doctorService.bulkImport(doctors, req.user?.id);
    res.status(200).json({
      data: result,
    });
  }
}

export const doctorController = new DoctorController();
