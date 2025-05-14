'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { menuConfig } from './navigation';
import { icons } from './icons';

type Props = { onClose?: () => void };

export default function Sidebar({ onClose }: Props) {
    const path = usePathname();
    const [open, setOpen] = useState<Record<string, boolean>>({ assets: true });

    return (
        <aside className="fixed left-0 top-0 h-screen w-4/5 max-w-xs bg-[#1c1f22] z-50">
            <header className="flex items-center justify-between px-6 py-6">
                <h2 className="text-lg font-semibold text-white">Menu</h2>
                <button onClick={onClose} className="text-sm text-gray-400 hover:text-white">
                    Close
                </button>
            </header>

            <nav className="flex-1 overflow-y-auto">
                {menuConfig.map(item => {
                    /* handle dividers first */
                    if (item.type === 'divider') {
                        return <hr key={item.id} className="border-gray-800 my-2" />;
                    }

                    /* handle the logout (button) row */
                    if (item.type === 'button') {
                        const Icon = icons[item.icon!];          // icon is guaranteed here
                        return (
                            <button /* … */ key={item.id}>
                                <Icon size={18} />
                                {item.label}
                            </button>
                        );
                    }

                    /* normal expandable section */
                    if (!item.icon || !item.children) return null;  // extra safety
                    const { id, label, icon, children } = item;
                    const Icon = icons[icon];                       // icon is now defined
                    const expanded = open[id] ?? false;

                    return (
                        <div key={id}>
                            {/* top‑level row */}
                            <button
                                onClick={() => setOpen((p) => ({ ...p, [id]: !expanded }))}
                                className={`flex w-full items-center justify-between px-6 py-3 ${path.startsWith(`/${id}`) ? 'bg-[#2a2d31]' : 'hover:bg-[#2a2d31]'
                                    }`}
                            >
                                <span className="flex items-center gap-3">
                                    <Icon size={18} className={path.startsWith(`/${id}`) ? 'text-blue-500' : 'text-gray-400'} />
                                    <span className={path.startsWith(`/${id}`) ? 'text-white' : 'text-gray-200'}>
                                        {label}
                                    </span>
                                </span>
                                {expanded ? <icons.chevronup size={16} /> : <icons.chevrondown size={16} />}
                            </button>

                            {/* sub‑links */}
                            {expanded && (
                                <ul className="bg-[#161a1d]">
                                    {children.map(({ id: subId, label: subLabel, href }) => {
                                        const active = path === href;
                                        return (
                                            <li key={subId}>
                                                <Link
                                                    href={href}
                                                    onClick={onClose}
                                                    className={`block pl-12 pr-6 py-2 ${active ? 'bg-[#2d4c6d] text-white' : 'hover:bg-[#252a2e] text-gray-400'
                                                        }`}
                                                >
                                                    {subLabel}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </nav>

            <footer className="mt-auto border-t border-gray-800 px-6 py-4">
                <p className="text-xs text-gray-500">Version 1.2.5</p>
            </footer>
        </aside>
    );
}
