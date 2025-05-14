// app/page.tsx   ← new file, represents the index (“/”) route
import { redirect } from 'next/navigation';

/**
 * Whenever someone visits "/", they’ll get a 307 redirect
 * to your desired first screen.
 */
export default function Index() {
  redirect('/assets/bleDevices');   // ← change to whatever route you want
}
