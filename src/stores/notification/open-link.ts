import { toast } from "vue-sonner";
import { showGroupDialog } from "../../coordinators/group-dialog-coordinator";
import { showUserDialog } from "../../coordinators/user-coordinator";

export function openNotificationLink(link: string | null | undefined) {
  if (!link) {
    return;
  }
  const [kind = "", target] = link.split(":");
  switch (kind) {
    case "group":
      if (target) {
        showGroupDialog(target);
      }
      break;
    case "user":
      showUserDialog(target);
      break;
    case "event": {
      const ids = (target ?? "").split(",");
      const [groupId] = ids;
      if (ids.length < 2 || groupId === undefined) {
        console.error("Invalid event notification link:", target);
        return;
      }

      showGroupDialog(groupId);

      break;
    }
    case "openNotificationLink":
    case "OpenSafetyCenter":
    default:
      toast.error(`Unsupported notification link type: "${link}"`);
      break;
  }
}
