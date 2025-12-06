// import { icons } from "./icons";
// export const menuConfig: {
//     id: string;
//     label?: string;
//     labelKey?: string;
//     icon?: keyof typeof icons;
//     children?: { id: string; label?: string; labelKey?: string; href: string }[];
//     type?: 'divider' | 'button';
//     action?: string;
//   }[] = [

//     {
//       id: 'dashboard',
//       labelKey: 'nav.dashboard',
//       icon: 'home',
//       children: [
//         { id: 'overview',  labelKey: 'nav.dashboard.overview', href: '/dashboard/overview'  },
//         { id: 'overview1', labelKey: 'nav.dashboard.overview1', href: '/dashboard/overview1' },
//       ],
//     },
//     {
//       id: 'assets',
//       labelKey: 'nav.assets',
//       icon: 'battery',
//       children: [
//         { id: 'bledevices',    labelKey: 'nav.assets.bledevices',    href: '/assets/ble-devices'     },
//         { id: 'fleetview',     labelKey: 'nav.assets.fleetview',     href: '/assets/fleet-view'      },
//         { id: 'devicelocator', labelKey: 'nav.assets.devicelocator', href: '/assets/devicelocator' },
//       ],
//     },
//     {
//       id: 'mydevices',
//       labelKey: 'nav.mydevices',
//       icon: 'battery',
//       children: [
//         { id: 'devices',    labelKey: 'nav.mydevices.devices',    href: '/mydevices/devices'},
//       ],
//     },
//     {
//       id: 'ota',
//       labelKey: 'nav.ota',
//       icon: 'cloud',
//       children: [
//         { id: 'upload',    labelKey: 'nav.ota.upload',    href: '/ota/upload'},
//         { id: 'deviceota',    labelKey: 'nav.ota.deviceota',    href: '/ota/deviceota'},
//       ],
//     },
//     {
//       id: 'rider',
//       labelKey: 'nav.rider',
//       icon: 'rider',
//       children: [
//         { id: 'serviceplan1', labelKey: 'nav.rider.serviceplan1', href: '/rider/serviceplan1'}
//       ],
//     },
//     {
//       id: 'payments',
//       labelKey: 'nav.payments',
//       icon: 'rider',
//       children: [
//         { id: 'payment',    labelKey: 'nav.payments.payment',    href: '/payments/payment'     },
//         { id: 'kenya',    labelKey: 'nav.payments.kenya',    href: '/payments/kenya'     }
//       ],
//     },
//     {
//       id: 'ticketing',
//       labelKey: 'nav.ticketing',
//       icon: 'help',
//       children: [
//         { id: 'support',    labelKey: 'nav.ticketing.support',    href: '/ticketing/support'     },
     
//       ],
//     },
//     {
//       id: 'keypad',
//       labelKey: 'nav.keypad',
//       icon: 'keypad',
//       children: [
//         { id: 'keypad',    labelKey: 'nav.keypad.keypad',    href: '/keypad/keypad'     },
//       ],
//     },
//      {
//       id: 'attendant',
//       labelKey: 'nav.attendant',
//       icon: 'usercircle',
//       children: [
//         { id: 'attendant',    labelKey: 'nav.attendant.attendant',    href: '/attendant/attendant'     },
//       ],
//     },
//     {
//       id: 'customers',
//       labelKey: 'nav.customers',
//       icon: 'barchart',
//       children: [
//         // { id: 'customerform', label: 'Customer Acquisition Form', href: '/customers/customerform' },
//         { id: 'myportfolio', labelKey: 'nav.customers.myportfolio', href: '/customers/myportfolio' },
//         { id: 'payments',    labelKey: 'nav.customers.payments',     href: '/customers/payments'    },
//       ],
//     },
//      {
//       id: 'location',
//       labelKey: 'nav.location',
//       icon: 'location',
//       children: [
//         { id: 'routes', labelKey: 'nav.location.routes', href: '/location/routes' },
//       ],
//     },
//     {
//       id: 'team',
//       labelKey: 'nav.team',
//       icon: 'users',
//       children: [
//         { id: 'members', labelKey: 'nav.team.members', href: '/team/members' },
//         { id: 'chat',    labelKey: 'nav.team.chat',    href: '/team/chat'    },
//       ],
//     },
//     {
//       id: 'company',
//       labelKey: 'nav.company',
//       icon: 'building',
//       children: [
//         { id: 'request', labelKey: 'nav.company.request', href: '/company/request' },
//         { id: 'updates', labelKey: 'nav.company.updates', href: '/company/updates' },
//       ],
//     },

//     { id: 'divider‑1', type: 'divider' },
  
//     {
//       id: 'myaccount',
//       labelKey: 'nav.myaccount',
//       icon: 'usercircle',
//       children: [
//         { id: 'resetpassword', labelKey: 'nav.myaccount.resetpassword', href: '/myaccount/resetpassword' },
//       ],
//     },
//     {
//       id: 'settings',
//       labelKey: 'nav.settings',
//       icon: 'settings',
//       children: [
//         { id: 'settings', labelKey: 'nav.settings.settings', href: '/settings' },
//       ],
//     },
  
//     { id: 'divider‑2', type: 'divider' },
  
//     {
//       id: 'debug',
//       labelKey: 'nav.debug',
//       icon: 'bugplay',
//       children: [
//         { id: 'console',     labelKey: 'nav.debug.console',      href: '/debug/console'     },
//         { id: 'reportissue', labelKey: 'nav.debug.reportissue', href: '/debug/reportissue' },
//       ],
//     },
  
//     { id: 'divider-3', type: 'divider' },
  
//     {
//       id: 'logout',
//       labelKey: 'common.logout',
//       icon: 'logout',
//       type: 'button',          
//       action: 'logout',         
//     },
//   ] as const;
  

import { icons } from "./icons";
export const menuConfig: {
    id: string;
    label?: string;
    labelKey?: string;
    icon?: keyof typeof icons;
    children?: { id: string; label?: string; labelKey?: string; href: string }[];
    type?: 'divider' | 'button';
    action?: string;
  }[] = [
    {
      id: 'assets',
      labelKey: 'nav.assets',
      icon: 'battery',
      children: [
        { id: 'bledevices',    labelKey: 'nav.assets.bledevices',    href: '/assets/ble-devices'     },
      ],
    },
    {
      id: 'mydevices',
      labelKey: 'nav.mydevices',
      icon: 'battery',
      children: [
        { id: 'devices',    labelKey: 'nav.mydevices.devices',    href: '/mydevices/devices'},
      ],
    },
    {
      id: 'rider',
      labelKey: 'nav.rider',
      icon: 'rider',
      children: [
        { id: 'serviceplan1', labelKey: 'nav.rider.serviceplan1', href: '/rider/serviceplan1'}
      ],
    },
    {
      id: 'ticketing',
      labelKey: 'nav.ticketing',
      icon: 'help',
      children: [
        { id: 'support',    labelKey: 'nav.ticketing.support',    href: '/ticketing/support'     },
     
      ],
    },
    {
      id: 'keypad',
      labelKey: 'nav.keypad',
      icon: 'keypad',
      children: [
        { id: 'keypad',    labelKey: 'nav.keypad.keypad',    href: '/keypad/keypad'     },
      ],
    },
     {
      id: 'attendant',
      labelKey: 'nav.attendant',
      icon: 'usercircle',
      children: [
        { id: 'attendant',    labelKey: 'nav.attendant.attendant',    href: '/attendant/attendant'     },
      ],
    },
     {
      id: 'location',
      labelKey: 'nav.location',
      icon: 'location',
      children: [
        { id: 'routes', labelKey: 'nav.location.routes', href: '/location/routes' },
      ],
    },

    { id: 'divider‑1', type: 'divider' },
  
  
    { id: 'divider-3', type: 'divider' },
  
    {
      id: 'logout',
      labelKey: 'common.logout',
      icon: 'logout',
      type: 'button',          
      action: 'logout',         
    },
  ] as const;
  