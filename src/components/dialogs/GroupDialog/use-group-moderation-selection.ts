import type { ModerationRow, ModerationSelection, SelectedRow } from "./group-moderation-types";

export function useGroupModerationSelection(groupMemberModeration: ModerationSelection) {
  function setSelectedUsers(userId: string, user: SelectedRow | null | undefined) {
    if (!user) return;
    groupMemberModeration.selectedUsers[userId] = user;
    groupMemberModeration.selectedUsersArray = Object.values(groupMemberModeration.selectedUsers);
  }

  function deselectedUsers(userId: string | null | undefined, isAll = false) {
    if (isAll) {
      for (const id of Object.keys(groupMemberModeration.selectedUsers)) {
        Reflect.deleteProperty(groupMemberModeration.selectedUsers, id);
      }
    } else if (typeof userId === "string" && Object.hasOwn(groupMemberModeration.selectedUsers, userId)) {
      Reflect.deleteProperty(groupMemberModeration.selectedUsers, userId);
    }
    groupMemberModeration.selectedUsersArray = Object.values(groupMemberModeration.selectedUsers);
  }

  function onSelectionChange(row: ModerationRow) {
    const userId = row.userId;
    if (!userId) return;
    if (row.$selected && !groupMemberModeration.selectedUsers[userId]) {
      setSelectedUsers(userId, row);
    } else if (!row.$selected && groupMemberModeration.selectedUsers[userId]) {
      deselectedUsers(userId);
    }
  }

  function deselectInTables(userId?: string | null) {
    const allTables = [
      groupMemberModeration.tables.members,
      groupMemberModeration.tables.bans,
      groupMemberModeration.tables.invites,
      groupMemberModeration.tables.joinRequests,
      groupMemberModeration.tables.blocked,
    ];
    for (const table of allTables) {
      if (userId) {
        const row = table.data.find((item) => item.userId === userId);
        if (row) {
          row.$selected = false;
        }
      } else {
        table.data.forEach((row) => {
          if (row.$selected) {
            row.$selected = false;
          }
        });
      }
    }
  }

  function deleteSelectedUser(user: SelectedRow) {
    deselectedUsers(user.userId);
    deselectInTables(user.userId);
  }

  function clearAllSelected() {
    deselectedUsers(null, true);
    deselectInTables();
  }

  function selectAll(tableData: ModerationRow[]) {
    tableData.forEach((row) => {
      row.$selected = true;
      if (row.userId) {
        setSelectedUsers(row.userId, row);
      }
    });
  }

  return {
    setSelectedUsers,
    deselectedUsers,
    onSelectionChange,
    deselectInTables,
    deleteSelectedUser,
    clearAllSelected,
    selectAll,
  };
}
