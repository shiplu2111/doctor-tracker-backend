import { Schema, model, Types } from 'mongoose';

export type PatientGender = 'male' | 'female' | 'other';
export type PatientStatus = 'active' | 'recovered' | 'critical' | 'discharged';

export interface IPatient {
  _id: Types.ObjectId;
  name: string;
  age: number;
  gender: PatientGender;
  phone?: string;
  email?: string;
  condition: string;
  status: PatientStatus;
  notes?: string;
  doctorId: Types.ObjectId;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const patientSchema = new Schema<IPatient>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    age: {
      type: Number,
      required: true,
      min: 0,
      max: 130,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    condition: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    status: {
      type: String,
      enum: ['active', 'recovered', 'critical', 'discharged'],
      default: 'active',
      required: true,
    },
    notes: {
      type: String,
      maxlength: 1000,
      default: '',
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        ret.id = (ret._id as { toString(): string })?.toString();
        ret.doctorId = (ret.doctorId as { toString(): string })?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Compound indexes per docs/DATABASE.md
patientSchema.index({ doctorId: 1, createdAt: -1 });
patientSchema.index({ createdAt: -1 });
patientSchema.index({ condition: 1, createdAt: -1 });
patientSchema.index({ status: 1, createdAt: -1 });

export const PatientModel = model<IPatient>('Patient', patientSchema);
