import type { AvatarRef } from "../../../shared/utils/avatar-transforms";

export type SetAvatarTagsState = {
  visible: boolean;
  loading: boolean;
  ownAvatars: AvatarRef[];
  selectedAvatarIds: string[];
  selectedTags: string[];
  selectedTagsCsv: string;
  contentHorror: boolean;
  contentGore: boolean;
  contentViolence: boolean;
  contentAdult: boolean;
  contentSex: boolean;
};

export type SetAvatarStylesState = {
  visible: boolean;
  loading: boolean;
  avatarId: string;
  initialPrimaryStyle: string;
  initialSecondaryStyle: string;
  primaryStyle: string;
  secondaryStyle: string;
  availableAvatarStyles: string[];
  availableAvatarStylesMap: Map<string, string>;
  initialTags: string[];
  authorTags: string;
};

export type ContentFlagKey = "contentHorror" | "contentGore" | "contentViolence" | "contentAdult" | "contentSex";
