export type NominationStatus = 'Draft' | 'Scheduled' | 'Published' | 'Archived';

export type NominationPosition = {
  id: string;
  name: string;
  showRoleDetails: boolean;
  aboutRole: string;
  responsibilities: string[];
};

export type YouthRecord = {
  id: string;
  memberId: string;
  name: string;
  firstName: string;
  lastName: string;
  ageGroup: string;
  gender?: string;
  age?: number;
  birthDate?: string;
  attributes: Record<string, string>;
  importedAt: string;
};

export type NominationEntry = {
  id: string;
  nomineeName: string;
  positionId: string;
  positionName: string;
  youthRecordId?: string;
  submittedAt: string;
};

export type Nomination = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: NominationStatus;
  opensAt: string;
  closesAt: string;
  createdAt: string;
  updatedAt: string;
  positions: NominationPosition[];
  nomineeCount: number;
  youthRecordCount: number;
  youthRecords: YouthRecord[];
  nominees: NominationEntry[];
};

export type NominationSummary = Pick<Nomination, 'id' | 'slug' | 'name' | 'description' | 'status' | 'opensAt' | 'closesAt' | 'createdAt'> & {
  positionCount: number;
  nomineeCount: number;
  youthRecordCount: number;
};
