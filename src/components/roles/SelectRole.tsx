'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface RoleConfig {
  id: string;
  label: string;
  image: string;
  path: string;
  disabled?: boolean;
  badge?: string;
}

const roles: RoleConfig[] = [
  {
    id: 'attendant',
    label: 'Attendant',
    image: '/assets/Attendant.png',
    path: '/attendant/attendant',
  },
  {
    id: 'sales',
    label: 'Sales Rep',
    image: '/assets/Sales.png',
    path: '/customers/customerform',
  },
  {
    id: 'keypad',
    label: 'Keypad',
    image: '/assets/Keypad.png',
    path: '/keypad/keypad',
  },
  {
    id: 'rider',
    label: 'Rider',
    image: '/assets/Rider.png',
    path: '/rider/serviceplan1',
    disabled: true,
    badge: 'Coming Soon',
  },
];

export default function SelectRole() {
  const router = useRouter();

  const handleRoleClick = (role: RoleConfig) => {
    if (role.disabled) return;
    router.push(role.path);
  };

  return (
    <div className="select-role-container">
      {/* Background gradient */}
      <div className="select-role-bg-gradient" />

      <main className="select-role-main">
        <div className="role-selection">
          {/* Hero Section with Bikes */}
          <div className="role-hero">
            <div className="role-hero-image">
              <Image
                src="/assets/Bikes Oves.png"
                alt="Electric Bikes"
                width={320}
                height={200}
                priority
              />
            </div>
            {/* Atmospheric effects */}
            <div className="role-hero-atmosphere" />
            <div className="role-hero-mist" />
            <div className="role-hero-reflect" />
          </div>

          {/* Title Section */}
          <div className="role-header">
            <h1 className="role-title">Select Your Role</h1>
            <p className="role-description">
              Choose <strong>your role</strong> to access the right tools for your daily tasks.
            </p>
          </div>

          {/* Applet Grid */}
          <div className="role-grid">
            {roles.map((role) => (
              <div
                key={role.id}
                className={`role-applet ${role.disabled ? 'disabled' : ''}`}
                onClick={() => handleRoleClick(role)}
              >
                <div className="role-applet-image">
                  <Image
                    src={role.image}
                    alt={role.label}
                    width={100}
                    height={100}
                  />
                </div>
                <span className="role-applet-label">{role.label}</span>
                
                {role.badge && (
                  <span className="role-applet-badge">{role.badge}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
