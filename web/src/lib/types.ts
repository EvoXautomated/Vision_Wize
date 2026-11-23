export type Role = "owner" | "reception" | "doctor" | "seller"
export type VisitStatus = "reception" | "exam" | "sale" | "ready" | "delivered" | "cancelled"
export type ContactPref = "sms" | "email" | "call" | "none"
export type AppointmentStatus = "scheduled" | "confirmed" | "arrived" | "no_show" | "cancelled"

export interface User {
  id: string
  fullName: string
  initials: string
  role: Role
  email?: string | null
  phone?: string | null
  active?: boolean
  hasPin?: boolean
}

export interface PersonRef {
  id: string
  fullName: string
  initials: string
}

export interface Tag {
  id: string
  name: string
  color: string
  clients?: number
}

export interface Client {
  id: string
  firstName: string
  lastName: string
  fullName: string
  phone: string | null
  email: string | null
  birthDate: string | null
  address: string | null
  contactPref: ContactPref
  smsConsentAt: string | null
  emailConsentAt: string | null
  unsubscribedAt: string | null
  seller: PersonRef | null
  priorExamAt: string | null
  lastExamAt: string | null
  nextExamDue: string | null
  firstVisitAt: string | null
  source: string | null
  tags: Tag[]
  createdAt: string
  updatedAt: string
  matches?: ("phone" | "email" | "name")[]
}

export interface Visit {
  id: string
  status: VisitStatus
  client: { id: string; fullName: string; phone: string | null; sellerId: string | null }
  seller: PersonRef | null
  doctor: PersonRef | null
  examDate: string | null
  frame?: string | null
  notes: string | null
  appointmentId: string | null
  statusAt: string
  readyAt: string | null
  deliveredAt: string | null
  createdAt: string
}

export interface Appointment {
  id: string
  startsAt: string
  endsAt: string
  durationMin: number
  status: AppointmentStatus
  client: { id: string; fullName: string; phone: string | null }
  doctor: PersonRef | null
  notes: string | null
  visit: { id: string; status: VisitStatus } | null
}

export interface TimelineItem {
  at: string
  type: "note" | "visit" | "appointment" | "message" | "change"
  title: string
  detail?: string | null
  by?: string | null
}

export interface CallItem {
  id: string
  kind: string
  createdAt: string
  body: string
  client: { id: string; firstName: string; lastName: string; phone: string | null; lastExamAt: string | null }
}

export interface Settings {
  business: { name: string; phone: string; email: string; address: string; website: string; googleReviewUrl: string }
  examReminderMonths: number
  secondReminderDays: number
  appointmentMinutes: number
  messages: {
    enabled: Record<string, boolean>
    sendFromHour: number
    sendToHour: number
    signature: string
    smsPlainText: boolean
    templates: Record<string, string>
  }
  permissions: Partial<Record<string, Role[]>>
}

export interface Segment {
  tags?: string[]
  sellerId?: string
  birthdayMonth?: boolean
  inactiveMonths?: number
  examOverdue?: boolean
}

export interface Campaign {
  id: string
  name: string
  channel: "sms" | "email"
  subject: string | null
  body: string
  segment: Segment
  status: "draft" | "sent"
  sentAt: string | null
  recipients: number
  createdAt: string
  stats: { queued: number; sent: number; delivered: number; failed: number; unsubscribed: number }
}

export interface CampaignPreview {
  matched: number
  reachable: number
  unsubscribed: number
  noConsent: number
  sample: string[]
}

export interface Device {
  id: string
  name: string
  createdAt: string
  lastSeenAt: string | null
  current: boolean
}
