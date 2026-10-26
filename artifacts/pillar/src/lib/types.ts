// The thirteen core objects from SPEC.md section 3, plus small helpers.

export type Role = 'MD' | 'Principal' | 'VP' | 'Associate' | 'OP' | 'Management'
export const FIRM_ROLES: Role[] = ['MD', 'Principal', 'VP', 'Associate', 'OP']
export const DEAL_TEAM_ROLES: Role[] = ['MD', 'Principal', 'VP', 'Associate']

export type PlanStatus = 'Not started' | 'On track' | 'At risk' | 'Off track' | 'Complete'
export const PLAN_STATUSES: PlanStatus[] = ['Not started', 'On track', 'At risk', 'Off track', 'Complete']

export type PhaseStatus = 'Not started' | 'In progress' | 'Complete'
export const PHASE_STATUSES: PhaseStatus[] = ['Not started', 'In progress', 'Complete']

export type DataRequestStatus =
  | 'New'
  | 'In progress'
  | 'Sent to management'
  | 'Data received'
  | 'Delivered'
  | 'Closed'
export const DATA_REQUEST_STATUSES: DataRequestStatus[] = [
  'New',
  'In progress',
  'Sent to management',
  'Data received',
  'Delivered',
  'Closed',
]
export type QuestionStatus = 'Open' | 'In progress' | 'Answered' | 'Closed'
export const QUESTION_STATUSES: QuestionStatus[] = ['Open', 'In progress', 'Answered', 'Closed']
export type AskStatus = DataRequestStatus | QuestionStatus

export type Urgency = 'Critical' | 'High' | 'Standard' | 'Low'
export const URGENCIES: Urgency[] = ['Critical', 'High', 'Standard', 'Low']

/** Firm only (deal team and OPs) or Shared with management. */
export type Visibility = 'firm' | 'shared'
/** Updates and comments: Internal or Shared. */
export type PostVisibility = 'internal' | 'shared'

export type DocType = 'IC deck' | 'Model' | 'CIM' | 'QoE' | 'Diligence report' | 'Other'

export interface User {
  id: string
  name: string
  email: string
  title: string
  /** Relative to the app base path, e.g. "avatars/alex.jpg". Initials show when missing. */
  avatarUrl?: string
}

export interface Company {
  id: string
  name: string
  sector: string
  closeDate: string
  holdYears: number
  entryEbitda: number
  exitEbitda: number
  /** Incremental organic growth beyond entry, excluding pillar initiatives ($M). */
  organicTargetEbitda?: number
  organicRealizedEbitda?: number
  /** Relative to the app's public folder, e.g. "logos/fernhill.svg". */
  logoUrl?: string
}

export interface Membership {
  id: string
  userId: string
  companyId: string
  role: Role
}

export interface Attachment {
  id: string
  name: string
  size: number
  uploadedBy: string
  at: string
  /** For data requests: raw from management, final from the deal team, or context the deal team shared with management. */
  stage?: 'raw' | 'final' | 'context'
}

/** A pillar (and optionally one of its sub-pillars) a file belongs to. */
export interface WorkstreamRef {
  pillarId: string
  subPillarId: string | null
}

export interface Document {
  id: string
  companyId: string
  type: DocType
  name: string
  size: number
  uploadedBy: string
  date: string
  /** Set when the file was added to a workstream folder from the Files tab or moved there later. */
  workstream?: WorkstreamRef
  note?: string
}

export interface SignOff {
  userId: string
  at: string
}

export interface VCPVersion {
  id: string
  companyId: string
  version: number
  changeNote: string
  approverIds: string[]
  signOffs: SignOff[]
  alignmentRequestedAt?: string
  lockedAt?: string
  createdAt: string
}

export interface Pillar {
  id: string
  companyId: string
  name: string
  objective: string
  rationale: string
  sourceRef: string
  /** Only used when the pillar has no sub-pillars; otherwise both roll up. */
  targetImpact: number
  capturedImpact: number
  ownerIds: string[]
  status: PlanStatus
  visibility: Visibility
  order: number
  startDate: string
  targetDate: string
  lastUpdated: string
  retiredAt?: string
}

export interface SubPillar {
  id: string
  companyId: string
  pillarId: string
  name: string
  objective: string
  targetImpact: number
  capturedImpact: number
  ownerIds: string[]
  status: PlanStatus
  visibility: Visibility
  order: number
  startDate: string
  targetDate: string
  lastUpdated: string
}

export interface Phase {
  id: string
  companyId: string
  pillarId: string
  subPillarId: string | null
  name: string
  description: string
  deliverables: string[]
  startDate: string
  endDate: string
  status: PhaseStatus
  completedAt?: string
  order: number
}

export interface KPI {
  id: string
  companyId: string
  pillarId: string
  subPillarId: string | null
  name: string
  unit: string
  baseline: number
  target: number
  actuals: { date: string; value: number }[]
}

export interface Update {
  id: string
  companyId: string
  pillarId: string
  subPillarId: string | null
  phaseId: string | null
  authorId: string
  text: string
  statusChange?: { from: PlanStatus; to: PlanStatus }
  capturedChange?: { from: number; to: number }
  phaseCompleted?: { done: string; next: string }
  noChange?: boolean
  attachments: Attachment[]
  visibility: PostVisibility
  flaggedToMd?: boolean
  flagNote?: string
  flagResolvedAt?: string
  createdAt: string
}

export interface StatusEvent {
  status: AskStatus
  at: string
  by: string
  note?: string
}

export interface Ask {
  id: string
  companyId: string
  type: 'data_request' | 'question'
  title: string
  pillarId: string | null
  subPillarId: string | null
  createdBy: string
  /** Deal team owners. New asks go to the deal's associate; VP and above can add or swap people. */
  assigneeIds: string[]
  urgency: Urgency
  dueDate: string
  status: AskStatus
  flaggedToMd: boolean
  flagNote?: string
  flaggedBy?: string
  flaggedAt?: string
  flagResolvedAt?: string
  createdAt: string
  closedAt?: string
  history: StatusEvent[]
  // Data request
  description?: string
  mgmtTitle?: string
  mgmtDescription?: string
  mgmtApprovedBy?: string
  mgmtAssigneeId?: string
  attachments: Attachment[]
  // Question
  context?: string
  answer?: string
  answeredBy?: string
}

export type CommentParent = 'pillar' | 'subPillar' | 'update' | 'ask'

export interface Comment {
  id: string
  companyId: string
  parentType: CommentParent
  parentId: string
  authorId: string
  text: string
  visibility: PostVisibility
  createdAt: string
}

export interface Activity {
  id: string
  companyId: string
  actorId: string
  action: string
  objectType: 'pillar' | 'subPillar' | 'phase' | 'kpi' | 'update' | 'ask' | 'comment' | 'vcp' | 'document'
  objectId: string
  field?: string
  oldValue?: string | number
  newValue?: string | number
  at: string
}

/** OP commentary per pillar per Progress period, for the board supplement. */
export interface Commentary {
  id: string
  companyId: string
  pillarId: string
  periodKey: string
  text: string
  authorId: string
  updatedAt: string
}

export interface Settings {
  urgencyHours: Record<Urgency, number>
  defaultVisibility: Visibility
  staleDays: number
}

export interface DB {
  seedVersion: number
  users: User[]
  companies: Company[]
  memberships: Membership[]
  documents: Document[]
  vcpVersions: VCPVersion[]
  pillars: Pillar[]
  subPillars: SubPillar[]
  phases: Phase[]
  kpis: KPI[]
  updates: Update[]
  asks: Ask[]
  comments: Comment[]
  activity: Activity[]
  commentary: Commentary[]
  settings: Record<string, Settings>
  /** userId:companyId -> ISO time of the last dashboard visit. */
  visits: Record<string, string>
  /**
   * Workstream overrides for update and data-request attachments, by attachment id ("Move to folder"
   * in the Files tab). Optional so demo data saved before this field existed still loads.
   */
  fileTags?: Record<string, WorkstreamRef>
}
