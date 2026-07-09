// Single source of truth for admin access. Both emails have identical,
// undifferentiated admin permissions — there is no primary/secondary
// distinction.
export const ADMIN_EMAILS = [
  'abdulxdiymamajonov@gmail.com',
  'otabekmuminov0427@gmail.com',
] as const

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return (ADMIN_EMAILS as readonly string[]).includes(email)
}
