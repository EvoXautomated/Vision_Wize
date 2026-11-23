import type { User } from '../generated/prisma/client.js';

export const toUserJson = (u: User) => ({
  id: u.id,
  fullName: u.fullName,
  initials: u.initials,
  role: u.role,
  email: u.email,
  phone: u.phone,
  active: u.active,
  hasPin: !!u.pinHash,
});

export const initialsOf = (fullName: string) =>
  fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
