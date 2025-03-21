// 'use client'

// import React, { useState, useEffect } from 'react';
// import { useRouter } from 'next/navigation';
// import { Lock, Mail, EyeOff, Eye } from 'lucide-react';
// // import { isTokenValid } from '';
// import {isTokenValid} from './authUtils'
// import { Toaster, toast } from 'react-hot-toast';

// const LoginPage = () => {
//   const router = useRouter();
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [isLoading, setIsLoading] = useState(false);
//   const [showPassword, setShowPassword] = useState(false);
//   const [rememberMe, setRememberMe] = useState(false);

//   useEffect(() => {
//     // Check if user is already logged in with a valid token
//     const token = localStorage.getItem('auth_token');
//     if (token && isTokenValid(token)) {
//       router.push('/');
//     }
//   }, [router]);

//   const handleLogin = async (e: React.FormEvent) => {
//     e.preventDefault();
    
//     if (!email || !password) {
//       toast.error('Please enter both email and password');
//       return;
//     }
//     console.log(email, "Email----33")
//     console.log(password, "Password -----34")
//     setIsLoading(true);
    
//     try {
//       // Replace with your actual API endpoint
//       const response = await fetch('https://api.example.com/auth/login', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ email, password }),
//       });
      
      
//       const data = await response.json();
      
//       if (response.ok) {
//         // Store token in localStorage
//         localStorage.setItem('auth_token', data.token);
        
//         // Store user data if needed
//         if (data.user) {
//           localStorage.setItem('user_data', JSON.stringify(data.user));
//         }
        
//         toast.success('Login successful!');
        
//         // Redirect to main page
//         setTimeout(() => {
//           router.push('/');
//         }, 1000);
//       } else {
//         toast.error(data.message || 'Login failed. Please check your credentials.');
//       }
//     } catch (error) {
//       console.error('Login error:', error);
//       toast.error('An error occurred. Please try again later.');
//     } finally {
//       setIsLoading(false);
//     }
//   };
  
//   const togglePasswordVisibility = () => {
//     setShowPassword(!showPassword);
//   };

//   return (
//     <div className="max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen flex flex-col justify-center">
//       <Toaster
//         position="top-center"
//         toastOptions={{
//           duration: 3000,
//           style: {
//             background: '#333',
//             color: '#fff',
//             padding: '16px',
//             borderRadius: '8px',
//           },
//           success: {
//             iconTheme: {
//               primary: '#10B981',
//               secondary: 'white',
//             },
//           },
//           error: {
//             iconTheme: {
//               primary: '#EF4444',
//               secondary: 'white',
//             },
//           },
//         }}
//       />
      
//       <div className="p-8">
//         {/* Logo/Header */}
//         <div className="text-center mb-8">
//           <h1 className="text-white text-2xl font-bold mb-2">BLE Device Manager</h1>
//           <p className="text-gray-400 text-sm">Sign in to access your devices</p>
//         </div>
        
//         {/* Login Form */}
//         <form onSubmit={handleLogin} className="space-y-6">
//           {/* Email Input */}
//           <div className="relative">
//             <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
//               <Mail className="h-5 w-5 text-gray-500" />
//             </div>
//             <input
//               type="email"
//               className="w-full px-4 py-3 pl-10 border border-gray-700 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
//               placeholder="Email address"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//               required
//             />
//           </div>
          
//           {/* Password Input */}
//           <div className="relative">
//             <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
//               <Lock className="h-5 w-5 text-gray-500" />
//             </div>
//             <input
//               type={showPassword ? "text" : "password"}
//               className="w-full px-4 py-3 pl-10 pr-10 border border-gray-700 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
//               placeholder="Password"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               required
//             />
//             <button
//               type="button"
//               className="absolute inset-y-0 right-0 flex items-center pr-3"
//               onClick={togglePasswordVisibility}
//             >
//               {showPassword ? (
//                 <EyeOff className="h-5 w-5 text-gray-500" />
//               ) : (
//                 <Eye className="h-5 w-5 text-gray-500" />
//               )}
//             </button>
//           </div>
          
//           {/* Remember Me & Forgot Password */}
//           <div className="flex items-center justify-between">
//             <div className="flex items-center">
//               <input
//                 id="remember-me"
//                 type="checkbox"
//                 className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
//                 checked={rememberMe}
//                 onChange={() => setRememberMe(!rememberMe)}
//               />
//               <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-400">
//                 Remember me
//               </label>
//             </div>
//             <div className="text-sm">
//               <a href="#" className="text-blue-500 hover:text-blue-400">
//                 Forgot password?
//               </a>
//             </div>
//           </div>
          
//           {/* Login Button */}
//           <button
//             type="submit"
//             disabled={isLoading}
//             className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${
//               isLoading 
//                 ? 'bg-blue-700 cursor-not-allowed' 
//                 : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
//             }`}
//           >
//             {isLoading ? (
//               <>
//                 <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
//                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
//                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
//                 </svg>
//                 Signing in...
//               </>
//             ) : (
//               'Sign in'
//             )}
//           </button>
//         </form>
        
//         {/* Create Account Link */}
//         <div className="mt-8 text-center">
//           <p className="text-gray-400 text-sm">
//             Don't have an account?{' '}
//             <a href="#" className="text-blue-500 hover:text-blue-400">
//               Contact support
//             </a>
//           </p>
//         </div>
        
//         {/* Version Info */}
//         <div className="mt-8 text-center text-xs text-gray-500">
//           <p>Version 1.2.5</p>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default LoginPage;


'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, EyeOff, Eye } from 'lucide-react';
import { isTokenValid, loginWithGraphQL } from './authUtils';
import { Toaster, toast } from 'react-hot-toast';

const LoginPage = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    // Check if user is already logged in with a valid token
    const token = localStorage.getItem('auth_token');
    if (token && isTokenValid(token)) {
      router.push('/');
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Use GraphQL login mutation
      const result = await loginWithGraphQL(email, password);
      
      if (result.success) {
        // Extract the token from the response
        const authData = result.data;
        const token = authData.accessToken;
        
        // Store token in localStorage
        localStorage.setItem('auth_token', token);
        
        // Store user data if needed
        localStorage.setItem('user_data', JSON.stringify(authData));
        
        toast.success('Login successful!');
        
        // Redirect to main page
        setTimeout(() => {
          router.push('/');
        }, 1000);
      } else {
        toast.error(result.error || 'Login failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('An error occurred. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen flex flex-col justify-center">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
          },
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: 'white',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: 'white',
            },
          },
        }}
      />
      
      <div className="p-8">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-white text-2xl font-bold mb-2">BLE Device Manager</h1>
          <p className="text-gray-400 text-sm">Sign in to access your devices</p>
        </div>
        
        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          {/* Email Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Mail className="h-5 w-5 text-gray-500" />
            </div>
            <input
              type="email"
              className="w-full px-4 py-3 pl-10 border border-gray-700 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          {/* Password Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Lock className="h-5 w-5 text-gray-500" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              className="w-full px-4 py-3 pl-10 pr-10 border border-gray-700 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3"
              onClick={togglePasswordVisibility}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-gray-500" />
              ) : (
                <Eye className="h-5 w-5 text-gray-500" />
              )}
            </button>
          </div>
          
          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-400">
                Remember me
              </label>
            </div>
            <div className="text-sm">
              <a href="#" className="text-blue-500 hover:text-blue-400">
                Forgot password?
              </a>
            </div>
          </div>
          
          {/* Login Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${
              isLoading 
                ? 'bg-blue-700 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
        
        {/* Create Account Link */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            Don&apos;t have an account?{' '}
            <a href="#" className="text-blue-500 hover:text-blue-400">
              Contact support
            </a>
          </p>
        </div>
        
        {/* Version Info */}
        <div className="mt-8 text-center text-xs text-gray-500">
          <p>Version 1.2.5</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;