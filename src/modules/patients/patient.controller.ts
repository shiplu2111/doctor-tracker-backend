import { Request, Response } from 'express';
import { patientService } from './patient.service';
import { PatientQueryFilter } from './patient.types';
import { PatientGender, PatientStatus } from './patient.schema';

export class PatientController {
  async create(req: Request, res: Response): Promise<void> {
    const doctorId = req.params.id || req.body.doctorId;
    const patient = await patientService.createPatient(
      {
        ...req.body,
        doctorId,
      },
      req.user?.id,
    );
    res.status(201).json({
      data: patient,
    });
  }

  async list(req: Request, res: Response): Promise<void> {
    const doctorId = req.params.id || (req.query.doctorId as string | undefined);
    const filter: PatientQueryFilter = {
      q: (req.query.q || req.query.search) as string,
      doctorId,
      condition: req.query.condition as string,
      status: req.query.status as PatientStatus,
      gender: req.query.gender as PatientGender,
      from: req.query.from ? new Date(req.query.from as string) : undefined,
      to: req.query.to ? new Date(req.query.to as string) : undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      sort: req.query.sort as string,
    };

    const result = await patientService.listPatients(filter);

    res.status(200).json({
      data: result.patients,
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
    const patient = await patientService.getPatientById(req.params.id || req.params.patientId);
    res.status(200).json({
      data: patient,
    });
  }

  async update(req: Request, res: Response): Promise<void> {
    const patient = await patientService.updatePatient(
      req.params.id || req.params.patientId,
      req.body,
    );
    res.status(200).json({
      data: patient,
    });
  }

  async delete(req: Request, res: Response): Promise<void> {
    await patientService.deletePatient(req.params.id || req.params.patientId);
    res.status(204).send();
  }

  async conditions(_req: Request, res: Response): Promise<void> {
    const conditions = await patientService.getConditions();
    res.status(200).json({
      data: conditions,
    });
  }
}

export const patientController = new PatientController();
