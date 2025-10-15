'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { redirect, usePathname } from 'next/navigation';
import { menuConfig } from './navigation';
import { icons } from './icons';
import { useMenuVisibility } from '@/lib/auth';
type Props = { onClose?: () => void };

export default function Sidebar({ onClose }: Props) {
    const path = usePathname();
    const [open, setOpen] = useState<Record<string, boolean>>({ assets: true });
    const { canViewMenu, userType } = useMenuVisibility();
    const isCustomer = userType === 'CUSTOMER';
    // const router = useRouter();
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
        <aside className="fixed top-0 left-0 bg-[#1c1f22] h-screen w-4/5 max-w-xs z-50 flex flex-col overflow-hidden">
            <div className="py-6 flex flex-col h-full overflow-hidden">
                {/* ---------- Header ---------- */}
                <div className="px-6 mb-6 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">Menu</h2>
                        <button
                            onClick={onClose}
                            className="text-sm text-gray-400 hover:text-white"
                        >
                            Close
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
                                    <div className="border-t border-gray-700" />
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
                            const label = showLogin ? 'Login' : item.label;

                            return (
                                <div key={item.id} className="px-6 py-2">
                                    <button
                                        onClick={click}
                                        className="flex items-center w-full px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                                    >
                                        <span className="mr-3 text-white">
                                            <Icon size={18} />          {/* keep same icon or swap if you wish */}
                                        </span>
                                        {label}
                                    </button>
                                </div>
                            );
                        }

                        /* ── Standard expandable section ──────────────────────── */
                        if (!item.icon || !item.children) return null;
                        const { id, label, icon, children } = item;
                        const Icon = icons[icon];
                        const expanded = open[id] ?? false;
                        const isActive = path.startsWith(`/${id}`);

                                                // Keep only children the user may view
                        const allowedChildren = children.filter(child =>
                            canViewMenu(child.id),
                        );
                        console.log(allowedChildren, "Allowed Children---358---")
                        if (allowedChildren.length === 0) return null;

                        return (
                            <div key={id} className="mb-1">
                                {/* Section header */}
                                <div
                                    className={`flex items-center justify-between px-6 py-3 cursor-pointer ${isActive ? 'bg-[#2a2d31]' : 'hover:bg-[#2a2d31]'
                                        }`}
                                    onClick={() =>
                                        setOpen(prev => ({ ...prev, [id]: !expanded }))
                                    }
                                >
                                    <div className="flex items-center">
                                        <span
                                            className={`mr-3 ${isActive ? 'text-blue-500' : 'text-gray-400'
                                                }`}
                                        >
                                            <Icon size={18} />
                                        </span>
                                        <span className={isActive ? 'text-white' : 'text-gray-200'}>
                                            {label}
                                        </span>
                                    </div>
                                    <span className="text-gray-400">
                                        {expanded ? (
                                            <icons.chevronup size={16} />
                                        ) : (
                                            <icons.chevrondown size={16} />
                                        )}
                                    </span>
                                </div>

                                {/* Section children */}
                                {expanded && (
                                    <div className="bg-[#161a1d] overflow-hidden">
                                        {allowedChildren.map(sub => {
                                            const subActive = path === sub.href;
                                            return (
                                                <Link
                                                    key={sub.id}
                                                    href={sub.href}
                                                    onClick={onClose}
                                                    className={`block pl-12 pr-6 py-2 cursor-pointer ${subActive
                                                        ? 'bg-[#2d4c6d] text-white'
                                                        : 'hover:bg-[#252a2e] text-gray-400'
                                                        }`}
                                                >
                                                    {sub.label}
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
                <div className="px-6 pt-4 border-t border-gray-800 flex-shrink-0">
                    <p className="text-xs text-gray-500">Version 1.2.5</p>
                </div>
            </div>
        </aside>
    );
}
