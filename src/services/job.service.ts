import { v4 as uuidv4 } from 'uuid';
import { Job, CreateJobInput, UpdateJobInput } from '../domain/job.types';
import { IJobRepository, jobRepository } from '../repositories/job.repository';
import { INurseRepository, nurseRepository } from '../repositories/nurse.repository';
import { ISessionRepository, sessionRepository } from '../repositories/session.repository';
import { WhatsAppService, whatsappService } from './whatsapp.service';
import { PaginatedResult, PaginationQuery } from '../types';
import { NotFoundError, AppError } from '../utils/AppError';
import { StatusCodes } from 'http-status-codes';
import logger from '../utils/logger';

export class JobService {
  constructor(
    private readonly jobRepo: IJobRepository,
    private readonly nurseRepo: INurseRepository,
    private readonly sessionRepo: ISessionRepository,
    private readonly whatsapp: WhatsAppService,
  ) {}

  async createJob(input: CreateJobInput): Promise<Job> {
    const now = new Date().toISOString();
    const job = await this.jobRepo.create({ ...input, status: 'open', createdAt: now, updatedAt: now });
    await this.notifyMatchingNurses(job).catch((err) =>
      logger.error('Failed to notify nurses', { jobId: job.id, error: err }),
    );
    return job;
  }

  async notifyMatchingNurses(job: Job): Promise<void> {
    const nurses = await this.nurseRepo.findByLocation(job.location);
    const activeNurses = nurses.filter((n) => n.status === 'active');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    await Promise.allSettled(
      activeNurses.map(async (nurse) => {
        await this.sessionRepo.upsert({
          id: uuidv4(),
          whatsappNumber: nurse.whatsappNumber,
          flowId: 'job-response',
          currentStep: 'AWAITING_RESPONSE',
          data: {},
          jobId: job.id,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          expiresAt,
        });

        await this.whatsapp.sendInteractiveButtons({
          to: nurse.whatsappNumber,
          headerText: 'New Job Available',
          bodyText:
            `*Care type:* ${job.careType}\n` +
            `*Location:* ${job.location}\n` +
            `*Date:* ${job.date}\n` +
            `*Duration:* ${job.durationHours} hour(s)\n\n` +
            `Would you like to accept this job?`,
          buttons: [
            { id: `accept:${job.id}`, title: 'Accept' },
            { id: `decline:${job.id}`, title: 'Decline' },
          ],
        });
      }),
    );
  }

  async acceptJob(jobId: string, nurseId: string): Promise<Job> {
    const job = await this.jobRepo.findById(jobId);
    if (!job) throw new NotFoundError('Job');
    if (job.status !== 'open') throw new AppError('Job is no longer available', StatusCodes.CONFLICT);

    const updated = await this.jobRepo.update(jobId, {
      status: 'accepted',
      acceptedByNurseId: nurseId,
      updatedAt: new Date().toISOString(),
    });

    return updated!;
  }

  async getJobById(id: string): Promise<Job> {
    const job = await this.jobRepo.findById(id);
    if (!job) throw new NotFoundError('Job');
    return job;
  }

  async getAllJobs({ page = 1, limit = 20 }: PaginationQuery): Promise<PaginatedResult<Job>> {
    const all = await this.jobRepo.findAll();
    const total = all.length;
    const totalPages = Math.ceil(total / limit);
    const items = all.slice((page - 1) * limit, page * limit);
    return { items, total, page, limit, totalPages };
  }

  async updateJob(id: string, input: UpdateJobInput): Promise<Job> {
    const updated = await this.jobRepo.update(id, { ...input, updatedAt: new Date().toISOString() });
    if (!updated) throw new NotFoundError('Job');
    return updated;
  }

  async deleteJob(id: string): Promise<void> {
    const deleted = await this.jobRepo.delete(id);
    if (!deleted) throw new NotFoundError('Job');
  }
}

export const jobService = new JobService(jobRepository, nurseRepository, sessionRepository, whatsappService);
