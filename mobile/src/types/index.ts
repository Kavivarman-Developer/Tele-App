export type UserRole = 'ADMIN' | 'MANAGER' | 'AGENT';
export type BranchName = 'Trichy' | 'Pudukkottai' | 'Chennai' | 'Madurai';

export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  branch?: string | null;
  managerId?: string | null;
  isActive: boolean;
  canReceiveLeads: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LeadStatus = 'OPEN' | 'CLOSED';
export type CustomerTemperature = 'HOT' | 'WARM' | 'COLD';

export interface Lead {
  _id: string;
  campaignId: string;
  campaign?: LeadCampaignSummary | Campaign;
  name: string;
  phone: string;
  email?: string;
  source: string;
  branch?: string | null;
  customProperties: Record<string, string>;
  assignedTo?: User | string | null;
  stage: string;
  tag?: string | null;
  temperature?: CustomerTemperature;
  status: LeadStatus;
  nextFollowUpAt?: string | null;
  followUpDue?: boolean;
  lastContactedAt?: string | null;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
}

export type DistributionMode = 'EQUAL' | 'CONDITIONAL';
export type CampaignPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type DuplicateMode = 'SKIP' | 'MERGE' | 'CREATE_NEW';

export type QuestionType =
  | 'TEXT'
  | 'SHORT_ANSWER'
  | 'NUMBER'
  | 'LONG_ANSWER'
  | 'DATE'
  | 'TIME'
  | 'MULTIPLE_CHOICE'
  | 'CHECKBOX'
  | 'DROPDOWN';

export interface EngagementQuestion {
  id: string;
  type: QuestionType;
  label: string;
  options: string[];
  required: boolean;
}

export interface ConditionalRule {
  field: string;
  value: string;
  agentIds: string[];
}

export interface Campaign {
  _id: string;
  name: string;
  pipelineId: string;
  managerId: string;
  agentIds: string[];
  distributionMode: DistributionMode;
  conditionalRules: ConditionalRule[];
  fallbackAgentId?: string | null;
  priority: CampaignPriority;
  duplicateMode: DuplicateMode;
  engagementForm: EngagementQuestion[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const NotConnectedReasons = [
  'DID_NOT_PICK',
  'BUSY',
  'USER_DISCONNECTED',
  'SWITCHED_OFF',
  'OUT_OF_COVERAGE',
  'CALL_NOT_COMPLETED',
  'OTHER',
  'INVALID_NUMBER',
  'INCOMING_NOT_AVAILABLE',
  'NUMBER_NOT_IN_USE',
] as const;

export type NotConnectedReason = (typeof NotConnectedReasons)[number];

export interface PipelineStage {
  name: string;
  isClosed: boolean;
  tags: string[];
  order: number;
}

export interface Pipeline {
  _id: string;
  name: string;
  stages: PipelineStage[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicSettings {
  allowDisposeWithoutFollowUp: boolean;
  followUpMandatoryForNotConnected: boolean;
}

export interface Setting {
  _id?: string;
  allowDisposeWithoutFollowUp: boolean;
  followUpMandatoryForNotConnected: boolean;
  reassignAfterHours?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RetryRuleStep {
  delayMinutes: number;
}

export interface RetryRule {
  _id: string;
  reason: NotConnectedReason;
  enabled: boolean;
  steps: RetryRuleStep[];
}

export interface LeadCampaignSummary {
  _id: string;
  name: string;
  priority: CampaignPriority;
  pipelineId: string;
  managerId?: string;
  engagementForm?: EngagementQuestion[];
}

export type LeadFilterType = 'ALL' | 'NEW' | 'FOLLOW_UP' | 'NOT_CONNECTED';

export interface DisposeLeadPayload {
  phone?: string | null;
  connected: boolean;
  notConnectedReason?: NotConnectedReason;
  stage?: string;
  tag?: string | null;
  followUpAt?: string | null;
  remark?: string | null;
  durationSeconds?: number;
  answers?: Array<{ questionId: string; value: unknown }>;
  reassignToUserId?: string;
  copyToCampaignId?: string;
}

export interface Activity {
  _id: string;
  leadId: string;
  campaignId: string;
  userId: User | string;
  phone?: string;
  customerName?: string;
  branch?: string | null;
  type: 'CALL';
  connected: boolean;
  notConnectedReason?: NotConnectedReason | null;
  stage: string;
  tag?: string | null;
  temperature?: CustomerTemperature;
  remark?: string | null;
  followUpAt?: string | null;
  durationSeconds: number;
  answers: Array<{ questionId: string; value: unknown }>;
  createdAt: string;
  updatedAt: string;
}

export interface DetectedCallResult {
  durationSeconds: number;
  connected: boolean;
  rawType?: string;
  matchedLog?: boolean;
}

export type RootStackParamList = {
  Login: undefined;
  CampaignSelect: undefined;
  Main: undefined;
  Home: undefined;
  MyLeads: { campaignId?: string; campaignName?: string } | undefined;
  FollowUps: undefined;
  CallHistory: undefined;
  Profile: undefined;
  Team: undefined;
  Campaigns: undefined;
  UploadLeads: undefined;
  Settings: undefined;
  RetryRules: undefined;
  AddWalkInLead: undefined;
  LeadDetail: {
    lead: Lead;
    queue?: Lead[];
    queueIndex?: number;
    initialTab?: 'LEAD INFO' | 'CAPTURE INFO' | 'DISPOSE LEAD' | 'OTHER';
  };
  Dispose: {
    lead: Lead;
    callDurationSeconds?: number;
    isCallConnected?: boolean;
    detectionMethod?: 'AUTOMATIC' | 'MANUAL';
    queue?: Lead[];
    queueIndex?: number;
    initialTab?: 'LEAD INFO' | 'CAPTURE INFO' | 'DISPOSE LEAD' | 'OTHER';
  };
};

export interface StageLeadCount {
  _id?: string;
  stage?: string;
  count: number;
}

export interface SourceLeadCount {
  _id?: string;
  source?: string;
  count: number;
}

export interface DashboardReportResponse {
  totalLeads: number;
  openLeads: number;
  closedLeads: number;
  callsMade: number;
  connectedCalls: number;
  connectRate: number;
  leadsBySource: SourceLeadCount[];
  leadsByStage: StageLeadCount[];
  followUpsDueToday: number;
  followUpsMissed: number;
}

export interface UserCallStats {
  userId: string;
  name: string;
  email: string;
  branch?: string;
  calls: number;
  connected: number;
  notConnected: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
}

export interface UserCallsReportResponse {
  agents: UserCallStats[];
}
