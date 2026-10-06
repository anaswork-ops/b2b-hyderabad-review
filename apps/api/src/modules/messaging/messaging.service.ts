import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import type {
  CustomRequestInput,
  StartConversationInput,
} from '@b2b/validation/messaging';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../platform/db/prisma.js';
import { encrypt } from '../auth/crypto.js';
import { AuditService } from '../audit/audit.service.js';
import { FilesService } from '../files/files.service.js';
import { NotificationService } from '../notifications/notification.service.js';
@Injectable()
export class MessagingService {
  private readonly db = getDatabase();
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(NotificationService)
    private readonly notifications: NotificationService,
    @Inject(FilesService) private readonly files: FilesService,
  ) {}
  private async business(user: User) {
    if (user.role !== 'BUSINESS_USER')
      throw new ForbiddenException('Access denied');
    const business = await this.db.business.findFirst({
      where: { primaryOwnerId: user.id, status: 'APPROVED' },
      select: { id: true },
    });
    if (!business) throw new ForbiddenException('Approved business required');
    return business;
  }
  private async context(input: StartConversationInput) {
    if (input.contextType === 'BUSINESS') {
      const p = await this.db.businessProfile.findFirst({
        where: {
          publicSlug: input.contextId,
          business: { status: 'APPROVED' },
        },
        select: { businessId: true },
      });
      if (!p) throw new NotFoundException('Business not found');
      return {
        target: p.businessId,
        data: {
          contextType: 'BUSINESS' as const,
          contextBusinessId: p.businessId,
        },
      };
    }
    if (input.contextType === 'PACKAGE') {
      const x = await this.db.package.findFirst({
        where: {
          id: input.contextId,
          status: 'PUBLISHED',
          moderationHidden: false,
          profile: { business: { status: 'APPROVED' } },
        },
        select: { id: true, profile: { select: { businessId: true } } },
      });
      if (!x) throw new NotFoundException('Package not found');
      return {
        target: x.profile.businessId,
        data: { contextType: 'PACKAGE' as const, contextPackageId: x.id },
      };
    }
    if (input.contextType === 'SERVICE') {
      const x = await this.db.service.findFirst({
        where: {
          id: input.contextId,
          status: 'PUBLISHED',
          moderationHidden: false,
          profile: { business: { status: 'APPROVED' } },
        },
        select: { id: true, profile: { select: { businessId: true } } },
      });
      if (!x) throw new NotFoundException('Service not found');
      return {
        target: x.profile.businessId,
        data: { contextType: 'SERVICE' as const, contextServiceId: x.id },
      };
    }
    if (input.contextType === 'TOURISM_PACKAGE') {
      const x = await this.db.tourismPackage.findFirst({
        where: {
          id: input.contextId,
          status: 'PUBLISHED',
          moderationHidden: false,
          profile: { business: { status: 'APPROVED' } },
        },
        select: { id: true, profile: { select: { businessId: true } } },
      });
      if (!x) throw new NotFoundException('Tourism package not found');
      return {
        target: x.profile.businessId,
        data: {
          contextType: 'TOURISM_PACKAGE' as const,
          contextTourismId: x.id,
        },
      };
    }
    if (input.contextType === 'VISA_SERVICE') {
      const x = await this.db.visaService.findFirst({
        where: {
          id: input.contextId,
          status: 'PUBLISHED',
          moderationHidden: false,
          profile: { business: { status: 'APPROVED' } },
        },
        select: { id: true, profile: { select: { businessId: true } } },
      });
      if (!x) throw new NotFoundException('Visa service not found');
      return {
        target: x.profile.businessId,
        data: { contextType: 'VISA_SERVICE' as const, contextVisaId: x.id },
      };
    }
    const x = await this.db.offer.findFirst({
      where: {
        id: input.contextId,
        active: true,
        moderationHidden: false,
        OR: [
          { package: { status: 'PUBLISHED', moderationHidden: false } },
          { service: { status: 'PUBLISHED', moderationHidden: false } },
        ],
        profile: { business: { status: 'APPROVED' } },
      },
      select: { id: true, profile: { select: { businessId: true } } },
    });
    if (!x) throw new NotFoundException('Offer not found');
    return {
      target: x.profile.businessId,
      data: { contextType: 'OFFER' as const, contextOfferId: x.id },
    };
  }
  private async blocked(
    a: string,
    b: string,
    tx: Prisma.TransactionClient = this.db,
  ) {
    return Boolean(
      await tx.businessBlock.findFirst({
        where: {
          OR: [
            { blockerBusinessId: a, blockedBusinessId: b },
            { blockerBusinessId: b, blockedBusinessId: a },
          ],
        },
        select: { blockerBusinessId: true },
      }),
    );
  }
  private async notify(
    recipientBusinessId: string,
    conversationId: string,
    tx: Prisma.TransactionClient,
  ) {
    const recipient = await tx.business.findUniqueOrThrow({
      where: { id: recipientBusinessId },
      select: { primaryOwnerId: true },
    });
    await this.notifications.statusChanged(
      recipient.primaryOwnerId,
      'MESSAGE_RECEIVED',
      encrypt(conversationId),
      tx,
    );
  }
  async start(user: User, input: StartConversationInput) {
    const sender = await this.business(user),
      context = await this.context(input);
    if (sender.id === context.target)
      throw new BadRequestException('Cannot message your own business');
    if (await this.blocked(sender.id, context.target))
      throw new ForbiddenException('Messaging unavailable');
    return this.db.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          ...context.data,
          participants: {
            create: [
              { businessId: sender.id, lastReadAt: new Date() },
              { businessId: context.target },
            ],
          },
          messages: {
            create: { senderBusinessId: sender.id, body: input.message },
          },
          lastMessageAt: new Date(),
        },
        include: { messages: true },
      });
      await this.notify(context.target, conversation.id, tx);
      await this.audit.record(
        user.id,
        'message.conversation_started',
        'conversation',
        'success',
        tx,
      );
      return conversation;
    });
  }
  async custom(user: User, input: CustomRequestInput) {
    const { providerSlug, ...details } = input;
    const requester = await this.business(user),
      provider = await this.db.businessProfile.findFirst({
        where: {
          publicSlug: providerSlug,
          business: { status: 'APPROVED' },
        },
        select: { businessId: true },
      });
    if (!provider) throw new NotFoundException('Provider not found');
    if (provider.businessId === requester.id)
      throw new BadRequestException('Cannot request from your own business');
    if (await this.blocked(requester.id, provider.businessId))
      throw new ForbiddenException('Messaging unavailable');
    return this.db.$transaction(async (tx) => {
      const request = await tx.customPackageRequest.create({
        data: {
          ...details,
          requesterBusinessId: requester.id,
          providerBusinessId: provider.businessId,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
        },
      });
      const conversation = await tx.conversation.create({
        data: {
          contextType: 'CUSTOM_REQUEST',
          customRequestId: request.id,
          participants: {
            create: [
              { businessId: requester.id, lastReadAt: new Date() },
              { businessId: provider.businessId },
            ],
          },
          messages: {
            create: {
              senderBusinessId: requester.id,
              body: input.requirements,
            },
          },
          lastMessageAt: new Date(),
        },
      });
      await this.notify(provider.businessId, conversation.id, tx);
      await this.audit.record(
        user.id,
        'custom_request.created',
        'custom_package_request',
        'success',
        tx,
      );
      return { request, conversationId: conversation.id };
    });
  }
  async list(user: User, q?: string) {
    const business = await this.business(user);
    const conversations = await this.db.conversation.findMany({
      where: {
        participants: { some: { businessId: business.id } },
        ...(q
          ? {
              OR: [
                {
                  messages: {
                    some: { body: { contains: q, mode: 'insensitive' } },
                  },
                },
                {
                  participants: {
                    some: {
                      business: {
                        profile: { name: { contains: q, mode: 'insensitive' } },
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        participants: {
          include: {
            business: {
              select: {
                id: true,
                profile: { select: { name: true, publicSlug: true } },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          select: { body: true, createdAt: true, senderBusinessId: true },
        },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
    return conversations.map((conversation) => {
      const lastReadAt =
          conversation.participants.find((p) => p.businessId === business.id)
            ?.lastReadAt ?? new Date(0),
        unreadCount = conversation.messages.filter(
          (message) =>
            message.senderBusinessId !== business.id &&
            message.createdAt > lastReadAt,
        ).length;
      return {
        ...conversation,
        messages: conversation.messages.slice(0, 1),
        unreadCount,
      };
    });
  }
  async detail(user: User, id: string) {
    const business = await this.business(user),
      participant = await this.db.conversationParticipant.findUnique({
        where: {
          conversationId_businessId: {
            conversationId: id,
            businessId: business.id,
          },
        },
      });
    if (!participant) throw new NotFoundException('Conversation not found');
    const result = await this.db.conversation.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            business: {
              select: {
                id: true,
                profile: { select: { name: true, publicSlug: true } },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            attachments: {
              select: {
                id: true,
                filename: true,
                contentType: true,
                sizeBytes: true,
              },
            },
            senderBusiness: {
              select: { id: true, profile: { select: { name: true } } },
            },
          },
        },
        customRequest: true,
        reports: { where: { reporterBusinessId: business.id } },
      },
    });
    await this.db.conversationParticipant.update({
      where: {
        conversationId_businessId: {
          conversationId: id,
          businessId: business.id,
        },
      },
      data: { lastReadAt: new Date() },
    });
    return result;
  }
  private async participant(user: User, id: string) {
    const business = await this.business(user),
      p = await this.db.conversationParticipant.findUnique({
        where: {
          conversationId_businessId: {
            conversationId: id,
            businessId: business.id,
          },
        },
        include: { conversation: { include: { participants: true } } },
      });
    if (!p) throw new NotFoundException('Conversation not found');
    return { business, conversation: p.conversation };
  }
  async send(user: User, id: string, body: string) {
    const { business, conversation } = await this.participant(user, id),
      recipient = conversation.participants.find(
        (x) => x.businessId !== business.id,
      );
    if (!recipient) throw new BadRequestException('Recipient missing');
    if (await this.blocked(business.id, recipient.businessId))
      throw new ForbiddenException('Messaging unavailable');
    return this.db.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: { conversationId: id, senderBusinessId: business.id, body },
      });
      await tx.conversation.update({
        where: { id },
        data: { lastMessageAt: message.createdAt },
      });
      await tx.conversationParticipant.update({
        where: {
          conversationId_businessId: {
            conversationId: id,
            businessId: business.id,
          },
        },
        data: { lastReadAt: message.createdAt },
      });
      if (
        conversation.contextType === 'CUSTOM_REQUEST' &&
        conversation.customRequestId
      ) {
        await tx.customPackageRequest.updateMany({
          where: {
            id: conversation.customRequestId,
            providerBusinessId: business.id,
            status: 'OPEN',
          },
          data: { status: 'RESPONDED' },
        });
      }
      await this.notify(recipient.businessId, id, tx);
      return message;
    });
  }
  async close(user: User, id: string) {
    const { business, conversation } = await this.participant(user, id);
    if (!conversation.customRequestId)
      throw new BadRequestException('Custom request missing');
    const result = await this.db.customPackageRequest.updateMany({
      where: {
        id: conversation.customRequestId,
        requesterBusinessId: business.id,
        status: { not: 'CLOSED' },
      },
      data: { status: 'CLOSED' },
    });
    if (!result.count) throw new ForbiddenException('Request cannot be closed');
    await this.audit.record(
      user.id,
      'custom_request.closed',
      'custom_package_request',
      'success',
    );
    return { closed: true };
  }
  async block(user: User, id: string) {
    const { business, conversation } = await this.participant(user, id),
      other = conversation.participants.find(
        (x) => x.businessId !== business.id,
      );
    if (!other) throw new BadRequestException('Recipient missing');
    await this.db.businessBlock.upsert({
      where: {
        blockerBusinessId_blockedBusinessId: {
          blockerBusinessId: business.id,
          blockedBusinessId: other.businessId,
        },
      },
      create: {
        blockerBusinessId: business.id,
        blockedBusinessId: other.businessId,
      },
      update: {},
    });
    await this.audit.record(
      user.id,
      'message.business_blocked',
      'business',
      'success',
    );
    return { blocked: true };
  }
  async report(user: User, id: string, reason: string) {
    const { business } = await this.participant(user, id);
    const report = await this.db.conversationReport.upsert({
      where: {
        conversationId_reporterBusinessId: {
          conversationId: id,
          reporterBusinessId: business.id,
        },
      },
      create: { conversationId: id, reporterBusinessId: business.id, reason },
      update: { reason, status: 'OPEN' },
    });
    await this.audit.record(
      user.id,
      'message.conversation_reported',
      'conversation',
      'success',
    );
    return report;
  }
  async attach(
    user: User,
    conversationId: string,
    messageId: string,
    filename: string,
    contentType: string,
    body: unknown,
  ) {
    const { business } = await this.participant(user, conversationId);
    const message = await this.db.message.findFirst({
      where: { id: messageId, conversationId, senderBusinessId: business.id },
    });
    if (!message) throw new ForbiddenException('Attachment access denied');
    const bytes = await this.files.receive(user.id, body, contentType);
    if (!Buffer.isBuffer(bytes)) return bytes;
    if (!bytes.length || bytes.length > 5 * 1024 * 1024)
      throw new BadRequestException('Invalid attachment size');
    const valid =
      contentType === 'application/pdf'
        ? bytes.subarray(0, 5).toString() === '%PDF-'
        : contentType === 'image/png'
          ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
          : contentType === 'image/jpeg'
            ? bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))
            : false;
    if (!valid) throw new BadRequestException('Unsupported attachment type');
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    if (!safe) throw new BadRequestException('Invalid filename');
    const storageKey = 'messages/' + conversationId + '/' + randomUUID();
    await this.files.put(storageKey, bytes, contentType);
    return this.db.messageAttachment.create({
      data: {
        messageId,
        storageKey,
        filename: safe,
        contentType,
        sizeBytes: bytes.length,
      },
    });
  }
  async attachment(user: User, conversationId: string, id: string) {
    await this.participant(user, conversationId);
    const item = await this.db.messageAttachment.findFirst({
      where: { id, message: { conversationId } },
    });
    if (!item) throw new NotFoundException('Attachment not found');
    return { ...item, ...(await this.files.download(item.storageKey)) };
  }

  async adminReports(q: import('@b2b/validation/admin').AdminQuery) {
    const where = q.q
      ? { reason: { contains: q.q, mode: 'insensitive' as const } }
      : {};
    const [items, total] = await Promise.all([
      this.db.conversationReport.findMany({
        where,
        skip: (q.page - 1) * 25,
        take: 25,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          conversationId: true,
          reporterBusinessId: true,
          reason: true,
          status: true,
          createdAt: true,
          conversation: {
            select: {
              contextType: true,
              participants: { select: { businessId: true } },
            },
          },
        },
      }),
      this.db.conversationReport.count({ where }),
    ]);
    return { items, total, page: q.page };
  }
  async resolveReport(admin: User, id: string, reason: string) {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(admin.role))
      throw new ForbiddenException('Access denied');
    return this.db.$transaction(async (tx) => {
      const changed = await tx.conversationReport.updateMany({
        where: { id, status: 'OPEN' },
        data: { status: 'REVIEWED' },
      });
      if (!changed.count)
        throw new BadRequestException('Report missing or already resolved');
      await this.audit.record(
        admin.id,
        'report.resolved',
        'conversation_report',
        'success',
        tx,
        { resourceId: id, reason },
      );
      return { status: 'REVIEWED' };
    });
  }
  async adminHealth() {
    return {
      openReports: await this.db.conversationReport.count({
        where: { status: 'OPEN' },
      }),
      status: 'up' as const,
    };
  }
}
