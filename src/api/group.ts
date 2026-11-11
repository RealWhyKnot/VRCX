import { groupManagementRequest } from "./group-request-management";
import { groupMembersRequest } from "./group-request-members";
import { groupRolesGalleryRequest } from "./group-request-roles-gallery";
import { groupCalendarRequest } from "./group-request-calendar";

const groupRequest = {
  ...groupManagementRequest,
  ...groupMembersRequest,
  ...groupRolesGalleryRequest,
  ...groupCalendarRequest,
};

export { groupRequest };
