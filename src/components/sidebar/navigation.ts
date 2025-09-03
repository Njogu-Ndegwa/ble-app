
import { icons } from "./icons";
export const menuConfig: {
    id: string;
    label?: string;
    icon?: keyof typeof icons;
    children?: { id: string; label: string; href: string }[];
    type?: 'divider' | 'button';
    action?: string;
  }[] = [

    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: 'home',
      children: [
        { id: 'overview',  label: 'My Dash 1', href: '/dashboard/overview'  },
        { id: 'overview1', label: 'My Dash 2', href: '/dashboard/overview1' },
      ],
    },
    {
      id: 'assets',
      label: 'Assets',
      icon: 'battery',
      children: [
        { id: 'bledevices',    label: 'BLE Devices',    href: '/assets/ble-devices'     },
        { id: 'fleetview',     label: 'Fleet View',     href: '/assets/fleet-view'      },
        { id: 'devicelocator', label: 'Device Locator', href: '/assets/devicelocator' },
      ],
    },
     {
      id: 'mydevices',
      label: 'My Devices',
      icon: 'battery',
      children: [
        { id: 'devices',    label: 'My Device',    href: '/mydevices/devices'     },
        { id: 'pair', label: 'Pair Asset Account', href: '/mydevices/pair'},
        { id: 'unpair', label: 'UnPair Asset Account', href: '/mydevices/unpair'},
      ],
    },
     {
      id: 'ota',
      label: 'OTA',
      icon: 'cloud',
      children: [
        { id: 'upload',    label: 'Upload Files',    href: '/ota/upload'},
        { id: 'deviceota',    label: 'Device OTA',    href: '/ota/deviceota'},
      ],
    },
    {
      id: 'rider',
      label: 'Rider',
      icon: 'rider',
      children: [
        { id: 'routes',    label: 'Rider routes',    href: '/rider/routes'     },
        { id: 'station',    label: 'Swapper app',    href: '/rider/stations'     }
      ],
    },
        {
      id: 'keypad',
      label: 'Keypad',
      icon: 'keypad',
      children: [
        { id: 'keypad',    label: 'Keypad',    href: '/keypad/keypad'     },
      ],
    },
    {
      id: 'customers',
      label: 'Customers',
      icon: 'barchart',
      children: [
        { id: 'myportfolio', label: 'My Portfolio', href: '/customers/myportfolio' },
        { id: 'payments',    label: 'Payments',     href: '/customers/payments'    },
      ],
    },
     {
      id: 'location',
      label: 'Routes',
      icon: 'location',
      children: [
        { id: 'routes', label: 'My Routes', href: '/location/routes' },
      ],
    },
    {
      id: 'team',
      label: 'Team',
      icon: 'users',
      children: [
        { id: 'members', label: 'Members', href: '/team/members' },
        { id: 'chat',    label: 'Chat',    href: '/team/chat'    },
      ],
    },
    {
      id: 'company',
      label: 'Company',
      icon: 'building',
      children: [
        { id: 'request', label: 'Request', href: '/company/request' },
        { id: 'updates', label: 'Updates', href: '/company/updates' },
      ],
    },

    { id: 'divider‑1', type: 'divider' },
  
    {
      id: 'myaccount',
      label: 'My Account',
      icon: 'usercircle',
      children: [
        { id: 'resetpassword', label: 'Reset Password', href: '/myaccount/resetpassword' },
      ],
    },
    {
      id: 'settings',
      label: 'My Settings',
      icon: 'settings',
      children: [
        { id: 'settings', label: 'My Settings', href: '/settings' },
      ],
    },
  
    { id: 'divider‑2', type: 'divider' },
  
    {
      id: 'debug',
      label: 'Debug',
      icon: 'bugplay',
      children: [
        { id: 'console',     label: 'Console',      href: '/debug/console'     },
        { id: 'reportissue', label: 'Report Issue', href: '/debug/reportissue' },
      ],
    },
  
    { id: 'divider-3', type: 'divider' },
  
    {
      id: 'logout',
      label: 'Logout',
      icon: 'logout',
      type: 'button',          
      action: 'logout',         
    },
  ] as const;
  