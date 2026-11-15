import { DoctorModel } from '../doctors/doctor.schema';
import { PatientModel } from '../patients/patient.schema';
import {
  DashboardSummary,
  PatientPerDoctorStat,
  TimeSeriesPoint,
  ConditionStat,
  SpecializationStat,
} from './dashboard.types';

// Simple in-memory cache with TTL
class SimpleCache {
  private cache = new Map<string, { data: unknown; expiresAt: number }>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set(key: string, data: unknown, ttlMs: number): void {
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  clear(): void {
    this.cache.clear();
  }
}

const memoryCache = new SimpleCache();

export class DashboardService {
  async getSummary(): Promise<DashboardSummary> {
    const cacheKey = 'dashboard:summary';
    const cached = memoryCache.get<DashboardSummary>(cacheKey);
    if (cached) return cached;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalDoctors, totalPatients, newPatientsThisMonth, newDoctorsThisMonth] =
      await Promise.all([
        DoctorModel.countDocuments(),
        PatientModel.countDocuments(),
        PatientModel.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
        DoctorModel.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      ]);

    const avgPatientsPerDoctor =
      totalDoctors > 0 ? Number((totalPatients / totalDoctors).toFixed(1)) : 0;

    const summary: DashboardSummary = {
      totalDoctors,
      totalPatients,
      newPatientsThisMonth,
      newDoctorsThisMonth,
      avgPatientsPerDoctor,
    };

    memoryCache.set(cacheKey, summary, 30 * 1000); // 30 sec cache
    return summary;
  }

  async getPatientsPerDoctor(limit = 10): Promise<PatientPerDoctorStat[]> {
    const cacheKey = `dashboard:patients-per-doctor:${limit}`;
    const cached = memoryCache.get<PatientPerDoctorStat[]>(cacheKey);
    if (cached) return cached;

    const doctors = await DoctorModel.find(
      {},
      { name: 1, specialization: 1, hospital: 1, patientCount: 1 },
    )
      .sort({ patientCount: -1 })
      .limit(limit)
      .lean();

    const result: PatientPerDoctorStat[] = doctors.map((d) => ({
      doctorId: d._id.toString(),
      name: d.name,
      specialization: d.specialization,
      hospital: d.hospital,
      count: d.patientCount || 0,
    }));

    memoryCache.set(cacheKey, result, 30 * 1000);
    return result;
  }

  async getTimeseries(
    metric: 'patients' | 'doctors' = 'patients',
    interval: 'day' | 'week' | 'month' = 'day',
    fromDate?: Date,
    toDate?: Date,
  ): Promise<TimeSeriesPoint[]> {
    const to = toDate || new Date();
    const from = fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const model = metric === 'doctors' ? DoctorModel : PatientModel;
    const dateFormat = interval === 'month' ? '%Y-%m' : '%Y-%m-%d';

    const rawAgg = await model.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const dataMap = new Map<string, number>();
    rawAgg.forEach((item) => {
      dataMap.set(item._id, item.count);
    });

    // Zero-fill missing dates
    const points: TimeSeriesPoint[] = [];
    const current = new Date(from);

    if (interval === 'month') {
      while (current <= to) {
        const yearMonth = current.toISOString().substring(0, 7);
        if (!points.some((p) => p.date === yearMonth)) {
          points.push({
            date: yearMonth,
            count: dataMap.get(yearMonth) || 0,
          });
        }
        current.setMonth(current.getMonth() + 1);
      }
    } else {
      // Day by day
      while (current <= to) {
        const dateStr = current.toISOString().substring(0, 10);
        points.push({
          date: dateStr,
          count: dataMap.get(dateStr) || 0,
        });
        current.setDate(current.getDate() + 1);
      }
    }

    return points;
  }

  async getConditions(limit = 8): Promise<ConditionStat[]> {
    const cacheKey = `dashboard:conditions:${limit}`;
    const cached = memoryCache.get<ConditionStat[]>(cacheKey);
    if (cached) return cached;

    const rawAgg = await PatientModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$condition', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    const total = rawAgg.reduce((acc, curr) => acc + curr.count, 0);

    const result: ConditionStat[] = rawAgg.map((item) => ({
      condition: item._id,
      count: item.count,
      percentage: total > 0 ? Number(((item.count / total) * 100).toFixed(1)) : 0,
    }));

    memoryCache.set(cacheKey, result, 30 * 1000);
    return result;
  }

  async getSpecializations(): Promise<SpecializationStat[]> {
    const cacheKey = 'dashboard:specializations';
    const cached = memoryCache.get<SpecializationStat[]>(cacheKey);
    if (cached) return cached;

    const rawAgg = await DoctorModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$specialization', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const result: SpecializationStat[] = rawAgg.map((item) => ({
      specialization: item._id,
      count: item.count,
    }));

    memoryCache.set(cacheKey, result, 30 * 1000);
    return result;
  }

  clearCache(): void {
    memoryCache.clear();
  }
}

export const dashboardService = new DashboardService();
