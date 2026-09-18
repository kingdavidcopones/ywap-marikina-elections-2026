export type NominationStatus = 'Draft' | 'Scheduled' | 'Published' | 'Archived';

export const NOMINATION_AGE_GROUPS = [
  {value: 'teens', label: 'Teens', ages: 'Ages 13 to 17'},
  {value: 'young_people', label: 'Young People', ages: 'Ages 18 to 23'},
  {value: 'young_adults', label: 'Young Adults', ages: 'Ages 24 to 39'},
] as const;

export type NominationAgeGroup = (typeof NOMINATION_AGE_GROUPS)[number]['value'];

export function isNominationAgeGroup(value: unknown): value is NominationAgeGroup {
  return NOMINATION_AGE_GROUPS.some((group) => group.value === value);
}

export type NominationPosition = {
  id: string;
  name: string;
  eligibleAgeGroups: NominationAgeGroup[];
  showRoleDetails: boolean;
  aboutRole: string;
  responsibilities: string[];
};

export function positionVisibleToAgeGroup(position: NominationPosition, ageGroup: NominationAgeGroup) {
  return position.eligibleAgeGroups.length === 0 || position.eligibleAgeGroups.includes(ageGroup);
}

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
  nominatorName?: string;
  nominatorEmail?: string;
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
