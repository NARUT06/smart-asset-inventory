import {
  LayoutDashboard,
  Boxes,
  Tags,
  MapPin,
  ArrowLeftRight,
  ScanLine,
  Wrench,
  ClipboardList,
  Users,
  ScrollText,
  UserRound,
} from 'lucide-react';

export const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  PROCUREMENT: 'PROCUREMENT',
  CUSTODIAN: 'CUSTODIAN',
  TECHNICIAN: 'TECHNICIAN',
  AUDITOR: 'AUDITOR',
});

const ALL = Object.values(ROLES);

/**
 * Single source of truth for sidebar + route guards.
 * labelKey resolves through the i18n dictionary (ar/en).
 */
export const NAV_ITEMS = Object.freeze([
  { key: 'dashboard', labelKey: 'dashboard', href: '/dashboard', icon: LayoutDashboard, allowedRoles: [...ALL] },
  { key: 'assets', labelKey: 'assets', href: '/assets', icon: Boxes, allowedRoles: [...ALL] },
  { key: 'categories', labelKey: 'categories', href: '/categories', icon: Tags, allowedRoles: [ROLES.ADMIN, ROLES.PROCUREMENT, ROLES.AUDITOR] },
  { key: 'locations', labelKey: 'locations', href: '/locations', icon: MapPin, allowedRoles: [...ALL] },
  { key: 'transfers', labelKey: 'transfers', href: '/transfers', icon: ArrowLeftRight, allowedRoles: [ROLES.ADMIN, ROLES.CUSTODIAN, ROLES.AUDITOR] },
  { key: 'stocktake', labelKey: 'stocktake', href: '/stocktake', icon: ScanLine, allowedRoles: [ROLES.ADMIN, ROLES.PROCUREMENT, ROLES.AUDITOR, ROLES.CUSTODIAN] },
  { key: 'work-orders', labelKey: 'workOrders', href: '/work-orders', icon: Wrench, allowedRoles: [ROLES.ADMIN, ROLES.TECHNICIAN, ROLES.CUSTODIAN, ROLES.AUDITOR] },
  { key: 'templates', labelKey: 'templates', href: '/maintenance-templates', icon: ClipboardList, allowedRoles: [ROLES.ADMIN, ROLES.PROCUREMENT, ROLES.AUDITOR] },
  { key: 'users', labelKey: 'users', href: '/users', icon: Users, allowedRoles: [ROLES.ADMIN] },
  { key: 'audit', labelKey: 'audit', href: '/audit-logs', icon: ScrollText, allowedRoles: [ROLES.ADMIN] },
  { key: 'profile', labelKey: 'profile', href: '/profile', icon: UserRound, allowedRoles: [...ALL] },
]);

/** Sidebar helper: only items permitted for the role. Unknown role -> []. */
export const getAuthorizedNavItems = (role) => {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.allowedRoles.includes(role));
};

/** Route guard map (App.jsx consumes this). */
export const ROUTE_ROLES = Object.freeze(
  Object.fromEntries([...NAV_ITEMS.map((i) => [i.href, i.allowedRoles]), ['/assets/:id', [...ALL]]]),
);

export const canDo = (user, ...roles) => !!user && roles.includes(user.role);
