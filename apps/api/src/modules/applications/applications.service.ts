import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  BusinessApplication,
  BusinessStatus,
  Prisma,
  User,
} from '@prisma/client';
import type {
  ApplicationDraft,
  ReviewAction,
  DocumentRequirementInput,
} from '@b2b/validation/application';
import { getDatabase } from '../../platform/db/prisma.js';
import { BusinessesPolicy } from '../businesses/businesses.policy.js';
import { NotificationService } from '../notifications/notification.service.js';
import { AuditService } from '../audit/audit.service.js';
import { encrypt } from '../auth/crypto.js';
import { FilesService } from '../files/files.service.js';
import { AuthService } from '../auth/auth.service.js';
import { randomUUID } from 'node:crypto';

const editable = new Set<BusinessStatus>(['DRAFT', 'REQUEST_INFORMATION']);
const requiredText: (keyof BusinessApplication)[] = [
  'legalName',
  'tradingName',
  'address',
  'country',
  'state',
  'city',
  'contactEmail',
  'contactMobile',
  'licenceNumber',
  'licenceIssuer',
];

@Injectable()
export class ApplicationsService {
  private readonly db = getDatabase();
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(BusinessesPolicy) private readonly businesses: BusinessesPolicy,
    @Inject(NotificationService)
    private readonly notifications: NotificationService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(FilesService) private readonly files: FilesService,
  ) {}

  private async owned(user: User) {
    if (user.role !== 'BUSINESS_USER')
      throw new ForbiddenException('Access denied');
    return this.db.businessApplication.findFirst({
      where: { ownerId: user.id },
      include: { documents: true, reviews: { orderBy: { createdAt: 'asc' } } },
    });
  }

  private applicantView(
    application: NonNullable<Awaited<ReturnType<ApplicationsService['owned']>>>,
  ) {
    return {
      ...application,
      documents: application.documents.map(
        ({ id, kind, filename, contentType, sizeBytes, createdAt }) => ({
          id,
          kind,
          filename,
          contentType,
          sizeBytes,
          createdAt,
        }),
      ),
      reviews: application.reviews.map(
        ({ id, fromStatus, toStatus, note, createdAt }) => ({
          id,
          fromStatus,
          toStatus,
          createdAt,
          note: toStatus === 'REQUEST_INFORMATION' ? note : null,
        }),
      ),
    };
  }

  notificationsFor(user: User) {
    return this.notifications.mine(user.id);
  }
  async mine(user: User) {
    const application = await this.owned(user);
    return application ? this.applicantView(application) : null;
  }

  async save(user: User, data: ApplicationDraft) {
    if (user.role !== 'BUSINESS_USER')
      throw new ForbiddenException('Access denied');
    const current = await this.owned(user);
    if (current && !editable.has(current.status))
      throw new BadRequestException('Application cannot be edited');
    const fields = { ...data, website: data.website || null };
    if (current)
      return this.db.businessApplication.update({
        where: { id: current.id },
        data: fields,
      });
    return this.db.$transaction(async (tx) => {
      const business = await this.businesses.createDraft(user.id, tx);
      return tx.businessApplication.create({
        data: { ...fields, businessId: business.id, ownerId: user.id },
      });
    });
  }

  async preview(user: User) {
    const application = await this.owned(user);
    if (!application) throw new NotFoundException('Application not found');
    const requirements =
      application.businessType && application.country
        ? await this.requirements(application.country, application.businessType)
        : [];
    return {
      application: this.applicantView(application),
      requirements,
      missing: this.missing(application, requirements),
    };
  }

  private async requirements(
    market: string,
    businessType: NonNullable<BusinessApplication['businessType']>,
  ) {
    const configured = await this.db.documentRequirement.findMany({
      where: { businessType, market: { in: ['*', market] }, enabled: true },
    });
    const byKind = new Map(
      configured
        .filter((item) => item.market === '*')
        .map((item) => [item.kind, item]),
    );
    for (const item of configured.filter((item) => item.market === market))
      byKind.set(item.kind, item);
    return [...byKind.values()];
  }

  private missing(
    application: Awaited<
      ReturnType<ApplicationsService['owned']>
    > extends infer T
      ? NonNullable<T>
      : never,
    requirements: Awaited<ReturnType<ApplicationsService['requirements']>>,
  ) {
    const missing = requiredText
      .filter((field) => !application[field])
      .map(String);
    if (!application.businessType) missing.push('businessType');
    if (application.yearsOperating === null) missing.push('yearsOperating');
    if (!application.capabilities.length) missing.push('capabilities');
    if (!application.sourceMarkets.length) missing.push('sourceMarkets');
    if (!application.saudiDestinations.length)
      missing.push('saudiDestinations');
    for (const requirement of requirements) {
      if (
        requirement.required &&
        !application.documents.some(
          (document) => document.kind === requirement.kind,
        )
      )
        missing.push(`document:${requirement.kind}`);
    }
    if (!requirements.length) missing.push('documentRequirements');
    return missing;
  }

  async submit(user: User) {
    const result = await this.preview(user);
    const application = result.application;
    if (!editable.has(application.status))
      throw new BadRequestException('Invalid application transition');
    if (result.missing.length)
      throw new BadRequestException({
        message: 'Application incomplete',
        missing: result.missing,
      });
    if (
      !user.emailVerifiedAt ||
      user.email !== application.contactEmail?.toLowerCase() ||
      !user.mobileVerifiedAt ||
      user.mobile !== application.contactMobile
    )
      throw new BadRequestException(
        'Verify email and application mobile before submission',
      );
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      const changed = await tx.businessApplication.updateMany({
        where: { id: application.id, status: application.status },
        data: { status: 'SUBMITTED', submittedAt: now },
      });
      if (!changed.count)
        throw new BadRequestException('Application changed; reload');
      await this.businesses.setStatus(application.businessId, 'SUBMITTED', tx);
      await tx.applicationReview.create({
        data: {
          applicationId: application.id,
          actorId: user.id,
          fromStatus: application.status,
          toStatus: 'SUBMITTED',
        },
      });
      await this.notifications.statusChanged(
        user.id,
        'APPLICATION_SUBMITTED',
        encrypt('SUBMITTED'),
        tx,
      );
      await this.audit.record(
        user.id,
        'application.submitted',
        'application',
        'success',
        tx,
      );
    });
    return { status: 'SUBMITTED' };
  }

  async upload(
    user: User,
    kind: 'REGISTRATION_LICENCE' | 'SUPPORTING',
    filename: string,
    contentType: string,
    bytes: Buffer,
  ) {
    const application = await this.owned(user);
    if (!application || !editable.has(application.status))
      throw new BadRequestException('Application cannot accept documents');
    if (!bytes.length || bytes.length > 5 * 1024 * 1024)
      throw new BadRequestException('Invalid document size');
    const valid =
      contentType === 'application/pdf'
        ? bytes.subarray(0, 5).toString() === '%PDF-'
        : contentType === 'image/png'
          ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
          : contentType === 'image/jpeg'
            ? bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))
            : false;
    if (!valid) throw new BadRequestException('Unsupported document type');
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    if (!safeName) throw new BadRequestException('Invalid filename');
    const storageKey = `applications/${application.id}/${randomUUID()}`;
    await this.files.put(storageKey, bytes, contentType);
    try {
      return await this.db.applicationDocument.create({
        data: {
          applicationId: application.id,
          kind,
          storageKey,
          filename: safeName,
          contentType,
          sizeBytes: bytes.length,
        },
      });
    } catch (error) {
      await this.files.delete(storageKey).catch(() => undefined);
      throw error;
    }
  }

  async document(user: User, documentId: string, applicationId?: string) {
    const application = applicationId
      ? await this.detail(applicationId)
      : await this.owned(user);
    if (!application) throw new NotFoundException('Document not found');
    const document = application.documents.find(
      (item) => item.id === documentId,
    );
    if (!document) throw new NotFoundException('Document not found');
    return {
      filename: document.filename,
      contentType: document.contentType,
      bytes: await this.files.get(document.storageKey),
    };
  }
  listRequirements() {
    return this.db.documentRequirement.findMany({
      orderBy: [{ market: 'asc' }, { businessType: 'asc' }, { kind: 'asc' }],
    });
  }
  async setRequirement(admin: User, input: DocumentRequirementInput) {
    return this.db.$transaction(async (tx) => {
      const result = await tx.documentRequirement.upsert({
        where: {
          market_businessType_kind: {
            market: input.market,
            businessType: input.businessType,
            kind: input.kind,
          },
        },
        create: input,
        update: { required: input.required, enabled: input.enabled },
      });
      await this.audit.record(
        admin.id,
        'application.document_requirement_changed',
        'document_requirement',
        'success',
        tx,
      );
      return result;
    });
  }
  async list(status?: BusinessStatus, page = 1) {
    return this.db.businessApplication.findMany({
      where: status ? { status } : { status: { not: 'DRAFT' } },
      select: {
        id: true,
        legalName: true,
        tradingName: true,
        businessType: true,
        status: true,
        submittedAt: true,
        updatedAt: true,
      },
      orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
      take: 25,
      skip: (page - 1) * 25,
    });
  }

  async adminDetail(id: string) {
    const item = await this.detail(id);
    return {
      ...item,
      documents: item.documents.map(
        ({ storageKey: _key, ...document }) => document,
      ),
    };
  }
  async detail(id: string) {
    const application = await this.db.businessApplication.findUnique({
      where: { id },
      include: {
        documents: true,
        reviews: { orderBy: { createdAt: 'asc' } },
        owner: {
          select: {
            email: true,
            emailVerifiedAt: true,
            mobileVerifiedAt: true,
          },
        },
      },
    });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  async review(admin: User, id: string, command: ReviewAction) {
    const application = await this.detail(id);
    if (command.action === 'SUSPEND' || command.action === 'REACTIVATE')
      return this.changeBusinessStatus(
        admin,
        application.businessId,
        command.action,
        command.note ?? 'Application review decision',
      );
    const targets: Record<
      ReviewAction['action'],
      [BusinessStatus[], BusinessStatus]
    > = {
      START_REVIEW: [['SUBMITTED'], 'UNDER_REVIEW'],
      REQUEST_INFORMATION: [
        ['SUBMITTED', 'UNDER_REVIEW'],
        'REQUEST_INFORMATION',
      ],
      APPROVE: [['SUBMITTED', 'UNDER_REVIEW'], 'APPROVED'],
      REJECT: [['SUBMITTED', 'UNDER_REVIEW'], 'REJECTED'],
      SUSPEND: [['APPROVED'], 'SUSPENDED'],
      REACTIVATE: [['SUSPENDED'], 'APPROVED'],
    };
    const [allowed, next] = targets[command.action];
    if (!allowed.includes(application.status))
      throw new BadRequestException('Invalid application transition');
    if (command.action === 'REQUEST_INFORMATION' && !command.note?.trim())
      throw new BadRequestException('A correction note is required');
    await this.db.$transaction(async (tx) => {
      const changed = await tx.businessApplication.updateMany({
        where: { id, status: application.status },
        data: { status: next, reviewedAt: new Date() },
      });
      if (!changed.count)
        throw new BadRequestException('Application changed; reload');
      await this.businesses.setStatus(application.businessId, next, tx);
      await tx.applicationReview.create({
        data: {
          applicationId: id,
          actorId: admin.id,
          fromStatus: application.status,
          toStatus: next,
          note: command.note,
        },
      });
      await this.notifications.statusChanged(
        application.ownerId,
        `APPLICATION_${next}`,
        encrypt(next),
        tx,
      );
      await this.audit.record(
        admin.id,
        `application.${command.action.toLowerCase()}`,
        'application',
        'success',
        tx,
      );
    });
    return { status: next };
  }

  async adminCounts() {
    return {
      pending: await this.db.businessApplication.count({
        where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      }),
      informationRequested: await this.db.businessApplication.count({
        where: { status: 'REQUEST_INFORMATION' },
      }),
    };
  }
  async changeBusinessStatus(
    admin: User,
    id: string,
    action: 'SUSPEND' | 'REACTIVATE',
    reason: string,
  ) {
    await this.auth.assertRole(admin, 'ADMIN');
    const business = await this.businesses.adminDetail(id);
    if (!business) throw new NotFoundException('Business not found');
    const expected = action === 'SUSPEND' ? 'APPROVED' : 'SUSPENDED',
      next = action === 'SUSPEND' ? 'SUSPENDED' : 'APPROVED';
    if (business.status !== expected)
      throw new BadRequestException('Invalid business transition');
    await this.db.$transaction(async (tx) => {
      await this.businesses.changeApprovedStatus(id, expected, next, tx);
      if (business.application) {
        const changed = await tx.businessApplication.updateMany({
          where: { id: business.application.id, status: expected },
          data: { status: next, reviewedAt: new Date() },
        });
        if (!changed.count)
          throw new BadRequestException('Application state changed; reload');
        await tx.applicationReview.create({
          data: {
            applicationId: business.application.id,
            actorId: admin.id,
            fromStatus: expected,
            toStatus: next,
            note: reason,
          },
        });
      }
      if (next === 'SUSPENDED')
        await this.auth.revokeUserSessions(business.primaryOwnerId, tx);
      await this.audit.record(
        admin.id,
        `business.${action.toLowerCase()}`,
        'business',
        'success',
        tx,
        { resourceId: id, reason },
      );
      await this.notifications.statusChanged(
        business.primaryOwnerId,
        `APPLICATION_${next}`,
        encrypt(next),
        tx,
      );
    });
    return { status: next };
  }
}
