import { Inject, Injectable } from '@nestjs/common';
import type { CreateHelpRequestDto, HelpRequest } from '@taxi/shared';

import { FileRepository, fileRepositoryToken } from '../persistence/file-repository';
import { HelpRequestVerifier } from './help-request.verifier';

/**
 * Application service for HelpRequest creation and lookup.
 *
 * Responsibilities:
 * - Run the anti-fraud verifier on every create() call. The verifier
 *   throws {@link NotFoundException} or {@link ForbiddenException} on
 *   mismatch; the service does NOT catch these so Nest's exception
 *   filter maps them to HTTP 404/403 unchanged.
 * - Stamp server-side fields (`createdAt`, `status`, `eligibility`) on
 *   the draft before handing it to the repository.
 * - Delegate id assignment and persistence to the injected
 *   {@link FileRepository}; the service must NOT set `id`.
 */
@Injectable()
export class HelpRequestService {
  constructor(
    @Inject(fileRepositoryToken('help-request'))
    private readonly repo: FileRepository<HelpRequest>,
    private readonly verifier: HelpRequestVerifier,
  ) {}

  async create(input: CreateHelpRequestDto): Promise<HelpRequest> {
    await this.verifier.verify(input);

    const draft: Omit<HelpRequest, 'id'> = {
      ...input,
      createdAt: new Date().toISOString(),
      status: 'eligible',
      eligibility: {
        eligible: true,
        reason: 'Booking verified against records.',
      },
    };

    return await this.repo.create(draft);
  }

  async findById(id: string): Promise<HelpRequest | null> {
    return this.repo.findById(id);
  }
}
