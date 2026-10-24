export interface EquipmentSpelling {
  id: string;
  text: string;
  seeded?: boolean;
  canRemove: boolean;
  inUse?: boolean;
}

export interface EquipmentItem {
  id: string;
  name: string;
  icon?: string | null;
  ownIcon?: boolean;
  canEdit: boolean;
  aliases: EquipmentSpelling[];
}
