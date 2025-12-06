// 'use client';

// import { useState, useMemo } from 'react';
// import Link from 'next/link';
// import { redirect, usePathname } from 'next/navigation';
// import { X } from 'lucide-react';
// import { menuConfig } from './navigation';
// import { icons } from './icons';
// import { useMenuVisibility } from '@/lib/auth';
// import { useI18n } from '@/i18n';
// import { useRouter } from 'next/router';
// type Props = { onClose?: () => void };

// export default function Sidebar({ onClose }: Props) {
//     const path = usePathname();
//     const [open, setOpen] = useState<Record<string, boolean>>({ assets: true });
//     const { canViewMenu, userType } = useMenuVisibility();
//     const isCustomer = userType === 'CUSTOMER';
//     const { t } = useI18n();
//     // const router = useRouter();
//     /** ------------------------------------------------------------------
//      *  Build a “clean” menu:
//      *    1.  Filter out items the user should not see.
//      *    2.  Collapse duplicate / leading / trailing dividers.
//      * ------------------------------------------------------------------*/

//     const visibleMenu = useMemo(() => {
//         const filtered = menuConfig.filter(
//             item =>
//                 item.type === 'divider' ||
//                 item.type === 'button' ||
//                 canViewMenu(item.id),
//         );

//         return filtered.filter(
//             (item, idx, arr) =>
//                 item.type !== 'divider' ||
//                 (idx > 0 &&
//                     idx < arr.length - 1 &&
//                     arr[idx - 1].type !== 'divider' &&
//                     arr[idx + 1].type !== 'divider'),
//         );
//     }, [canViewMenu]);

//     console.log(visibleMenu, "Visible Menu")
//     /** ------------------------------------------------------------------*/
//     const handleOnLogOut = () => {
//         localStorage.removeItem('access_token');
//         onClose?.();
//         // TODO: navigate to “/signin” (or call your logout API) here
//     };
//     /** ------------------------------------------------------------------*/

//     const handleOnLogin = () => {               // ④ new
//         onClose?.();
//         redirect('/signin');
//     };
//     return (
//         <aside className="fixed top-0 left-0 h-screen w-4/5 max-w-xs z-50 flex flex-col overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
//             <div className="py-6 flex flex-col h-full overflow-hidden">
//                 {/* ---------- Header ---------- */}
//                 <div className="px-6 mb-6 flex-shrink-0">
//                     <div className="flex items-center justify-between">
//                         <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('common.menu')}</h2>
//                         <button
//                             onClick={onClose}
//                             className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
//                             style={{ 
//                                 color: 'var(--text-secondary)',
//                                 background: 'transparent',
//                             }}
//                             onMouseEnter={(e) => {
//                                 e.currentTarget.style.color = 'var(--text-primary)';
//                                 e.currentTarget.style.background = 'var(--bg-tertiary)';
//                             }}
//                             onMouseLeave={(e) => {
//                                 e.currentTarget.style.color = 'var(--text-secondary)';
//                                 e.currentTarget.style.background = 'transparent';
//                             }}
//                             aria-label={t('common.close')}
//                         >
//                             <X className="w-5 h-5" />
//                         </button>
//                     </div>
//                 </div>

//                 {/* ---------- Menu body ---------- */}
//                 <div className="flex-1 overflow-y-auto overflow-x-hidden">
//                     {visibleMenu.map(item => {
//                         /* ── Divider ────────────────────────────────────────────── */
//                         if (item.type === 'divider') {
//                             return (
//                                 <div key={item.id} className="px-6 py-2">
//                                     <div className="border-t" style={{ borderColor: 'var(--border)' }} />
//                                 </div>
//                             );
//                         }

//                         /* ── Action button (e.g. Logout) ───────────────────────── */
//                         // if (item.type === 'button') {
//                         //     const Icon = icons[item.icon!];
//                         //     return (
//                         //         <div key={item.id} className="px-6 py-2">
//                         //             <button
//                         //                 className="flex items-center w-full px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
//                         //                 onClick={handleOnLogOut}
//                         //             >
//                         //                 <span className="mr-3 text-white">
//                         //                     <Icon size={18} />
//                         //                 </span>
//                         //                 {item.label}
//                         //             </button>
//                         //         </div>
//                         //     );
//                         // }
//                         if (item.type === 'button') {
//                             const Icon = icons[item.icon!];

//                             /* Show “Login” instead of “Logout” for customers */
//                             const showLogin = isCustomer && item.id === 'logout';

//                             const click = showLogin ? handleOnLogin : handleOnLogOut;
//                             const label = showLogin ? t('common.login') : t('common.logout');

//                             return (
//                                 <div key={item.id} className="px-6 py-2">
//                                     <button
//                                         onClick={click}
//                                         className="btn btn-secondary flex items-center w-full px-4 py-2 rounded-md transition-colors"
//                                         style={{ 
//                                             background: 'rgba(239, 68, 68, 0.15)',
//                                             color: '#ef4444',
//                                             border: '1px solid rgba(239, 68, 68, 0.3)',
//                                         }}
//                                         onMouseEnter={(e) => {
//                                             e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
//                                             e.currentTarget.style.borderColor = '#ef4444';
//                                         }}
//                                         onMouseLeave={(e) => {
//                                             e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
//                                             e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
//                                         }}
//                                     >
//                                         <span className="mr-3">
//                                             <Icon size={18} />
//                                         </span>
//                                         {label}
//                                     </button>
//                                 </div>
//                             );
//                         }

//                         /* ── Standard expandable section ──────────────────────── */
//                         if (!item.icon || !item.children) return null;
//                         const { id, label, labelKey, icon, children } = item;
//                         const Icon = icons[icon];
//                         const expanded = open[id] ?? false;
//                         const isActive = path.startsWith(`/${id}`);

//                                                 // Keep only children the user may view
//                         const allowedChildren = children.filter(child =>
//                             canViewMenu(child.id),
//                         );
//                         console.log(allowedChildren, "Allowed Children---358---")
//                         if (allowedChildren.length === 0) return null;

//                         return (
//                             <div key={id} className="mb-1">
//                                 {/* Section header */}
//                                 <div
//                                     className="flex items-center justify-between px-6 py-3 cursor-pointer transition-colors"
//                                     style={{
//                                         background: isActive ? 'var(--bg-elevated)' : 'transparent',
//                                     }}
//                                     onMouseEnter={(e) => {
//                                         if (!isActive) {
//                                             e.currentTarget.style.background = 'var(--bg-tertiary)';
//                                         }
//                                     }}
//                                     onMouseLeave={(e) => {
//                                         if (!isActive) {
//                                             e.currentTarget.style.background = 'transparent';
//                                         }
//                                     }}
//                                     onClick={() =>
//                                         setOpen(prev => ({ ...prev, [id]: !expanded }))
//                                     }
//                                 >
//                                     <div className="flex items-center">
//                                         <span
//                                             className="mr-3"
//                                             style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}
//                                         >
//                                             <Icon size={18} />
//                                         </span>
//                                         <span style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
//                                             {labelKey ? t(labelKey) : label}
//                                         </span>
//                                     </div>
//                                     <span style={{ color: 'var(--text-secondary)' }}>
//                                         {expanded ? (
//                                             <icons.chevronup size={16} />
//                                         ) : (
//                                             <icons.chevrondown size={16} />
//                                         )}
//                                     </span>
//                                 </div>

//                                 {/* Section children */}
//                                 {expanded && (
//                                     <div className="overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
//                                         {allowedChildren.map(sub => {
//                                             const subActive = path === sub.href;
//                                             return (
//                                                 <Link
//                                                     key={sub.id}
//                                                     href={sub.href}
//                                                     onClick={onClose}
//                                                     className="block pl-12 pr-6 py-2 cursor-pointer transition-colors"
//                                                     style={{
//                                                         background: subActive ? 'var(--accent-soft)' : 'transparent',
//                                                         color: subActive ? 'var(--accent)' : 'var(--text-secondary)',
//                                                         borderLeft: subActive ? '3px solid var(--accent)' : '3px solid transparent',
//                                                     }}
//                                                     onMouseEnter={(e) => {
//                                                         if (!subActive) {
//                                                             e.currentTarget.style.background = 'var(--bg-elevated)';
//                                                             e.currentTarget.style.color = 'var(--text-primary)';
//                                                         }
//                                                     }}
//                                                     onMouseLeave={(e) => {
//                                                         if (!subActive) {
//                                                             e.currentTarget.style.background = 'transparent';
//                                                             e.currentTarget.style.color = 'var(--text-secondary)';
//                                                         }
//                                                     }}
//                                                 >
//                                                     {sub.labelKey ? t(sub.labelKey) : sub.label}
//                                                 </Link>
//                                             );
//                                         })}
//                                     </div>
//                                 )}
//                             </div>
//                         );
//                     })}
//                 </div>

//                 {/* ---------- Footer ---------- */}
//                 <div className="px-6 pt-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
//                     <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('common.version', { version: '1.2.5' })}</p>
//                 </div>
//             </div>
//         </aside>
//     );
// }


'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { redirect, usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { menuConfig } from './navigation';
import { icons } from './icons';
import { useMenuVisibility } from '@/lib/auth';
import { useI18n } from '@/i18n';
type Props = { onClose?: () => void };

export default function Sidebar({ onClose }: Props) {
    const path = usePathname();
    const router = useRouter();
    const [open, setOpen] = useState<Record<string, boolean>>({ assets: true });
    const { canViewMenu, userType } = useMenuVisibility();
    const isCustomer = userType === 'CUSTOMER';
    const { t } = useI18n();
    /** ------------------------------------------------------------------
     *  Build a “clean” menu:
     *    1.  Filter out items the user should not see.
     *    2.  Collapse duplicate / leading / trailing dividers.
     * ------------------------------------------------------------------*/

    const visibleMenu = useMemo(() => {
        const filtered = menuConfig.filter(
            item =>
                item.type === 'divider' ||
                item.type === 'button' ||
                canViewMenu(item.id),
        );

        return filtered.filter(
            (item, idx, arr) =>
                item.type !== 'divider' ||
                (idx > 0 &&
                    idx < arr.length - 1 &&
                    arr[idx - 1].type !== 'divider' &&
                    arr[idx + 1].type !== 'divider'),
        );
    }, [canViewMenu]);

    console.log(visibleMenu, "Visible Menu")
    /** ------------------------------------------------------------------*/
    const handleOnLogOut = () => {
        localStorage.removeItem('access_token');
        onClose?.();
        // TODO: navigate to “/signin” (or call your logout API) here
    };
    /** ------------------------------------------------------------------*/

    const handleOnLogin = () => {               // ④ new
        onClose?.();
        redirect('/signin');
    };
    return (
        <aside className="fixed top-0 left-0 h-screen w-4/5 max-w-xs z-50 flex flex-col overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
            <div className="py-6 flex flex-col h-full overflow-hidden">
                {/* ---------- Header ---------- */}
                <div className="px-6 mb-6 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('common.menu')}</h2>
                        <button
                            onClick={onClose}
                            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
                            style={{ 
                                color: 'var(--text-secondary)',
                                background: 'transparent',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'var(--text-primary)';
                                e.currentTarget.style.background = 'var(--bg-tertiary)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-secondary)';
                                e.currentTarget.style.background = 'transparent';
                            }}
                            aria-label={t('common.close')}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* ---------- Menu body ---------- */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    {visibleMenu.map(item => {
                        /* ── Divider ────────────────────────────────────────────── */
                        if (item.type === 'divider') {
                            return (
                                <div key={item.id} className="px-6 py-2">
                                    <div className="border-t" style={{ borderColor: 'var(--border)' }} />
                                </div>
                            );
                        }

                        /* ── Action button (e.g. Logout) ───────────────────────── */
                        // if (item.type === 'button') {
                        //     const Icon = icons[item.icon!];
                        //     return (
                        //         <div key={item.id} className="px-6 py-2">
                        //             <button
                        //                 className="flex items-center w-full px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                        //                 onClick={handleOnLogOut}
                        //             >
                        //                 <span className="mr-3 text-white">
                        //                     <Icon size={18} />
                        //                 </span>
                        //                 {item.label}
                        //             </button>
                        //         </div>
                        //     );
                        // }
                        if (item.type === 'button') {
                            const Icon = icons[item.icon!];

                            /* Show “Login” instead of “Logout” for customers */
                            const showLogin = isCustomer && item.id === 'logout';

                            const click = showLogin ? handleOnLogin : handleOnLogOut;
                            const label = showLogin ? t('common.login') : t('common.logout');

                            return (
                                <div key={item.id} className="px-6 py-2">
                                    <button
                                        onClick={click}
                                        className="btn btn-secondary flex items-center w-full px-4 py-2 rounded-md transition-colors"
                                        style={{ 
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            color: '#ef4444',
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                                            e.currentTarget.style.borderColor = '#ef4444';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                                        }}
                                    >
                                        <span className="mr-3">
                                            <Icon size={18} />
                                        </span>
                                        {label}
                                    </button>
                                </div>
                            );
                        }

                        /* ── Standard expandable section ──────────────────────── */
                        if (!item.icon || !item.children) return null;
                        const { id, label, labelKey, icon, children } = item;
                        const Icon = icons[icon];
                        const expanded = open[id] ?? false;
                        const isActive = path.startsWith(`/${id}`);

                        // Keep only children the user may view
                        const allowedChildren = children.filter(child =>
                            canViewMenu(child.id),
                        );
                        console.log(allowedChildren, "Allowed Children---358---")
                        if (allowedChildren.length === 0) return null;

                        // If only one child, navigate directly to it
                        const hasSingleChild = allowedChildren.length === 1;
                        const handleParentClick = () => {
                            if (hasSingleChild) {
                                // Navigate directly to the single child
                                router.push(allowedChildren[0].href);
                                onClose?.();
                            } else {
                                // Toggle expand/collapse for multiple children
                                setOpen(prev => ({ ...prev, [id]: !expanded }));
                            }
                        };

                        return (
                            <div key={id} className="mb-1">
                                {/* Section header */}
                                <div
                                    className="flex items-center justify-between px-6 py-3 cursor-pointer transition-colors"
                                    style={{
                                        background: isActive ? 'var(--bg-elevated)' : 'transparent',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.background = 'var(--bg-tertiary)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.background = 'transparent';
                                        }
                                    }}
                                    onClick={handleParentClick}
                                >
                                    <div className="flex items-center">
                                        <span
                                            className="mr-3"
                                            style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}
                                        >
                                            <Icon size={18} />
                                        </span>
                                        <span style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                            {labelKey ? t(labelKey) : label}
                                        </span>
                                    </div>
                                    {!hasSingleChild && (
                                        <span style={{ color: 'var(--text-secondary)' }}>
                                            {expanded ? (
                                                <icons.chevronup size={16} />
                                            ) : (
                                                <icons.chevrondown size={16} />
                                            )}
                                        </span>
                                    )}
                                </div>

                                {/* Section children - only show if multiple children */}
                                {!hasSingleChild && expanded && (
                                    <div className="overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                                        {allowedChildren.map(sub => {
                                            const subActive = path === sub.href;
                                            return (
                                                <Link
                                                    key={sub.id}
                                                    href={sub.href}
                                                    onClick={onClose}
                                                    className="block pl-12 pr-6 py-2 cursor-pointer transition-colors"
                                                    style={{
                                                        background: subActive ? 'var(--accent-soft)' : 'transparent',
                                                        color: subActive ? 'var(--accent)' : 'var(--text-secondary)',
                                                        borderLeft: subActive ? '3px solid var(--accent)' : '3px solid transparent',
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (!subActive) {
                                                            e.currentTarget.style.background = 'var(--bg-elevated)';
                                                            e.currentTarget.style.color = 'var(--text-primary)';
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (!subActive) {
                                                            e.currentTarget.style.background = 'transparent';
                                                            e.currentTarget.style.color = 'var(--text-secondary)';
                                                        }
                                                    }}
                                                >
                                                    {sub.labelKey ? t(sub.labelKey) : sub.label}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ---------- Footer ---------- */}
                <div className="px-6 pt-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('common.version', { version: '1.2.5' })}</p>
                </div>
            </div>
        </aside>
    );
}