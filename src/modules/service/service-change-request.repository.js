import { BaseRepository } from '../../common/base/BaseRepository.js';
import { ServiceChangeRequestStatus } from '../../common/constants/enums.js';

const LIST_SELECT = '-__v';

export class ServiceChangeRequestRepository extends BaseRepository {
  constructor(changeRequestModel) {
    super(changeRequestModel);
  }

  async findByIdAny(id) {
    return this.findOne({ _id: id }, { lean: true, select: LIST_SELECT });
  }

  async findPendingByServiceId(serviceId) {
    return this.findOne(
      { serviceId, status: ServiceChangeRequestStatus.PENDING },
      { lean: true, select: LIST_SELECT },
    );
  }

  buildListFilter(query = {}, { requestedBy = null } = {}) {
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.serviceId) filter.serviceId = query.serviceId;
    if (requestedBy) filter.requestedBy = requestedBy;
    else if (query.requestedBy) filter.requestedBy = query.requestedBy;
    return filter;
  }

  async list(filter, options = {}) {
    return this.findAndCount(filter, {
      skip: options.skip ?? 0,
      limit: options.limit ?? 10,
      sort: options.sort || '-createdAt',
      select: LIST_SELECT,
    });
  }
}
