'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Clock,
  Calendar,
  ClipboardList,
  MessageSquare,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  Shield,
  Menu,
  Bell,
  Sun,
  Moon,
  Binary,
  Radio,
  FileText,
  Edit,
  X,
  Download
} from 'lucide-react';
import { apiRequest, getAuthToken, removeAuthToken, getCurrentUser, getSocketUrl } from '../../utils/api';
import { playNotificationSound } from '../../utils/audio';
import { io, Socket } from 'socket.io-client';
import CallOverlay from '../../components/CallOverlay';
import { motion, AnimatePresence } from 'framer-motion';

const springTransition = { type: 'spring', stiffness: 200, damping: 22 } as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [clockedIn, setClockedIn] = useState(false);
  const [timeString, setTimeString] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Notifications and Call Socket
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [popupNotification, setPopupNotification] = useState<any>(null);
  const [globalSocket, setGlobalSocket] = useState<Socket | null>(null);

  // PWA installation states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    const handleAppInstalled = () => {
      setShowInstallBtn(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Force show install/download button for all mobile users on load
    if (typeof window !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent)) {
      setShowInstallBtn(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    // If user is on a mobile device, download the pre-compiled APK directly from backend
    if (typeof window !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent)) {
      window.location.href = `${getSocketUrl()}/app.apk`;
      return;
    }

    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User installation choice outcome: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'light') {
        document.body.classList.add('light');
      } else {
        document.body.classList.remove('light');
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'light') {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
  };

  useEffect(() => {
    setHydrated(true);
    const token = getAuthToken();
    if (!token) {
      router.push('/');
      return;
    }

    const fetchedUser = getCurrentUser();
    if (fetchedUser) {
      setUser(fetchedUser);
    }

    // Check time clock status
    const checkClockStatus = async () => {
      try {
        const data = await apiRequest('/clock/status');
        setClockedIn(data.clockedIn);
      } catch (err) {
        console.error('Error fetching clock status:', err);
      }
    };

    // Double check authentication with backend and sync roles
    const checkAuth = async () => {
      try {
        const userProfile = await apiRequest('/auth/me');
        setUser(userProfile);
        localStorage.setItem('user', JSON.stringify(userProfile));
        fetchNotifications();
        await checkClockStatus();
      } catch (err) {
        // Token might be invalid or expired
        removeAuthToken();
        router.push('/');
      }
    };
    checkAuth();

    // Running clock logic
    const updateTime = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [router]);

  useEffect(() => {
    if (!user) return;
    
    // Setup Global Socket for incoming calls & live notifications
    const socket = io(getSocketUrl());
    setGlobalSocket(socket);

    socket.on('connect', () => {
      socket.emit('join-room', user._id || user.id);
    });

    socket.on('new-notification', (notif) => {
      setNotifications(prev => {
        if (prev.some(n => n._id === notif._id)) return prev;
        
        // Execute side effects only if it's a new notification
        playNotificationSound();
        setPopupNotification(notif);
        setTimeout(() => {
          setPopupNotification((current: any) => current?._id === notif._id ? null : current);
        }, 5000);

        // Native Browser Notification
        if (typeof window !== 'undefined' && 'Notification' in window) {
          const fireNativeNotif = () => {
            try {
              new Notification(notif.title, { body: notif.message, icon: '/favicon.ico' });
            } catch (err) {
              if (navigator.serviceWorker) {
                navigator.serviceWorker.ready.then(reg => {
                  reg.showNotification(notif.title, { body: notif.message, icon: '/favicon.ico' });
                }).catch(() => {});
              }
            }
          };

          if (Notification.permission === 'granted') {
            fireNativeNotif();
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
              if (permission === 'granted') {
                fireNativeNotif();
              }
            });
          }
        }
        
        return [notif, ...prev];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const data = await apiRequest('/notifications/my');
      setNotifications(data);
    } catch (e) {
      console.error(e);
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const markAllRead = async () => {
    try {
      await apiRequest('/notifications/my/read-all', { method: 'PUT' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const clearAllNotifications = async () => {
    try {
      await apiRequest('/notifications/my/clear', { method: 'DELETE' });
      setNotifications([]);
    } catch (e) {
      console.error(e);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (!hydrated) return null;

  const handleLogout = () => {
    removeAuthToken();
    router.push('/');
  };

  const navItems = [
    { name: 'Dashboard', index: '01', href: '/dashboard', icon: LayoutDashboard, role: 'all' },
    { name: 'Colleague Registry', index: '02', href: '/dashboard/users', icon: Users, role: 'staff' },
    { name: 'Shift Telemetry', index: '03', href: '/dashboard/clock', icon: Clock, role: 'all' },
    { name: 'Leave logs', index: '04', href: '/dashboard/leaves', icon: Calendar, role: 'all' },
    { name: 'Operational Board', index: '05', href: '/dashboard/tasks', icon: ClipboardList, role: 'all' },
    { name: 'Payslip Generator', index: '06', href: '/dashboard/payslip', icon: FileText, role: 'staff' },
    { name: 'Encrypted Feeds', index: '07', href: '/dashboard/chat', icon: MessageSquare, role: 'all' },
    { name: 'Operational Calendar', index: '08', href: '/dashboard/calendar', icon: Calendar, role: 'all' },
    { name: 'Operational Notes', index: '09', href: '/dashboard/notes', icon: Edit, role: 'all' },
    { name: 'Communal Events', index: '10', href: '/dashboard/events', icon: Radio, role: 'all' },
  ];

  // Helper to determine if user can see nav link
  const canSeeLink = (itemRole: string) => {
    if (!user) return false;
    if (itemRole === 'all') return true;
    if (itemRole === 'staff') return user.role === 'admin' || user.role === 'superadmin';
    return false;
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'superadmin':
        return <span className="px-2 py-0.5 text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded font-mono select-none">ROOT_USER</span>;
      case 'admin':
        return <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-mono select-none">SYS_ADMIN</span>;
      default:
        return <span className="px-2 py-0.5 text-[9px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded font-mono select-none">OPERATOR</span>;
    }
  };

  return (
    <div className="min-h-screen flex scanlines cyber-grid-bg" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      <CallOverlay socket={globalSocket} currentUser={user} />

      {/* ── LEFT SIDEBAR (Desktop) ── */}
      <aside
        className={`hidden md:flex flex-col shrink-0 h-screen sticky top-0 transition-all duration-300 ${
          collapsed ? 'w-[72px]' : 'w-[260px]'
        } select-none`}
        style={{ background: 'var(--bg-subtle)', borderRight: '1px solid var(--border)' }}
      >
        {/* Logo area */}
        <div
          className="flex items-center shrink-0 relative overflow-hidden"
          style={{ height: 'var(--topbar-height)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="absolute top-1 left-2 text-[7px] font-mono opacity-25">CONSOLE_UPLINK</div>
          {!collapsed ? (
            <Link href="/dashboard" className="flex items-center select-none pt-2 pl-8">
              <img
                src={theme === 'dark' ? '/images/Markdot logo white.png' : '/images/Markdot logo black.png'}
                alt="Markdot Dotcore"
                className="h-8 object-contain"
              />
            </Link>
          ) : (
            <div className="mx-auto w-8 h-8 flex items-center justify-center pt-2">
              <img
                src={theme === 'dark' ? '/images/Markdot logo white.png' : '/images/Markdot logo black.png'}
                alt="Markdot Dotcore"
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`btn-icon shrink-0 cursor-pointer h-8 w-8 z-10 ${collapsed ? 'relative mx-auto pt-0 mt-2' : 'absolute right-4 top-1/2 -translate-y-1/2 mt-1'}`}
            title={collapsed ? 'EXPAND' : 'COLLAPSE'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4 text-cyan-400" /> : <ChevronLeft className="w-4 h-4 text-cyan-400" />}
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1 relative select-none">
          {navItems.filter(item => canSeeLink(item.role)).map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`nav-item relative ${collapsed ? 'justify-center px-0' : ''}`}
                style={{ color: isActive ? 'var(--brand)' : 'var(--text-secondary)' }}
                title={collapsed ? item.name : undefined}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-sidebar-indicator"
                    className="absolute inset-0 rounded -z-10 border"
                    style={{
                      backgroundColor: 'var(--brand-subtle)',
                      borderColor: 'var(--border-strong)'
                    }}
                    transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                  />
                )}
                {isActive && !collapsed && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 rounded-r" style={{ backgroundColor: 'var(--brand)' }} />
                )}
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && (
                  <div className="flex-1 flex justify-between items-center text-[12px] font-mono tracking-wide relative z-10">
                    <span className="truncate">{item.name}</span>
                    <span className="text-[9px] opacity-35">[{item.index}]</span>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User profile strip */}
        {user && (
          <div className="shrink-0 p-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
              <div
                className="w-9 h-9 rounded flex items-center justify-center shrink-0 border relative"
                style={{ background: 'var(--brand-subtle)', borderColor: 'var(--border)' }}
              >
                <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-emerald-500 animate-pulse border border-zinc-900" />
                <UserIcon className="w-4 h-4" style={{ color: 'var(--brand)' }} />
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1 select-none">
                  <p className="text-xs font-mono font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>{user.fullName}</p>
                  <p className="text-[10px] font-mono truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{user.jobTitle || 'OPERATOR'}</p>
                </div>
              )}
            </div>

            {!collapsed && (
              <div className="mt-3 flex items-center justify-between">
                {getRoleBadge(user.role)}
                <button onClick={handleLogout} className="btn-icon btn-icon-danger cursor-pointer h-7 w-7 rounded" title="DISCONNECT">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {collapsed && (
              <button onClick={handleLogout} className="btn-icon btn-icon-danger w-full mt-3 cursor-pointer h-8 rounded" title="DISCONNECT">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-y-auto">

        {/* Topbar */}
        <header
          className="topbar justify-between sticky top-0 z-40 select-none border-b"
          style={{ borderBottomColor: 'var(--border)', backgroundColor: 'rgba(2, 2, 4, 0.85)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="btn-icon md:!hidden cursor-pointer h-9 w-9"
            >
              <Menu className="w-4 h-4 text-cyan-400" />
            </button>
            {showInstallBtn && (
              <button
                onClick={handleInstallClick}
                className="flex md:hidden items-center gap-1.5 px-2.5 py-1 rounded text-[9px] font-mono font-bold tracking-wider select-none border border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444] animate-pulse uppercase cursor-pointer"
              >
                <Download className="w-3 h-3 text-[#ef4444]" />
                <span>DOWNLOAD APP</span>
              </button>
            )}
            <h2 className="text-xs font-mono font-extrabold uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
              // CONSOLE_UPLINK: {navItems.find(item => item.href === pathname)?.name || 'DASHBOARD'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {clockedIn && (
              <div
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono font-bold tracking-wider select-none border"
                style={{
                  background: 'var(--success-subtle)',
                  color: 'var(--success)',
                  borderColor: 'rgba(16,185,129,0.3)',
                }}
              >
                <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                <span>ACTIVE_SHIFT</span>
              </div>
            )}

            <div
              className="px-2.5 py-1 rounded font-mono text-[11px] font-bold select-none hidden sm:block border"
              style={{
                background: 'var(--bg-elevated)',
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              UPLINK_TIME: {timeString}
            </div>

            <div className="relative shrink-0 flex items-center">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-icon relative cursor-pointer h-9 w-9" 
                title="SYS_ALERTS"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell className="w-4 h-4 text-cyan-400" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-mono font-extrabold flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </motion.button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={springTransition}
                    className="fixed top-[60px] left-1/2 -translate-x-1/2 md:absolute md:top-full md:right-0 md:left-auto md:-translate-x-0 mt-3 rounded-xl shadow-2xl z-50 overflow-hidden border w-[95vw] md:w-[320px]"
                    style={{ 
                      display: 'flex',
                      flexDirection: 'column',
                      backgroundColor: 'var(--bg-elevated)', 
                      borderColor: 'var(--border-strong)',
                      boxShadow: '0 0 30px rgba(6, 182, 212, 0.15)'
                    }}
                  >
                    <div className="p-3.5 flex items-center justify-between shrink-0 font-mono text-[10px] font-extrabold uppercase border-b" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-cyan-400">// SECURITY_FEEDS</span>
                      {notifications.length > 0 && (
                        <button onClick={clearAllNotifications} className="text-[9px] text-[#f43f5e] hover:underline cursor-pointer">CLEAR_ALL</button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto flex-1 font-mono text-[10px]">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 italic select-none">NO ACTIVE LOGS</div>
                      ) : (
                        notifications.map(n => (
                          <div 
                            key={n._id} 
                            onClick={() => {
                              if (!n.isRead) markNotificationRead(n._id);
                              if (n.link) router.push(n.link);
                              setShowNotifications(false);
                            }}
                            className="p-3.5 cursor-pointer transition-all border-b hover:bg-cyan-500/5 select-none"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <div className="flex justify-between items-start mb-1 gap-2">
                              <span className="font-bold truncate flex-1" style={{ color: 'var(--text-primary)' }}>{n.title}</span>
                              {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5 animate-pulse"></span>}
                            </div>
                            <p className="text-[9px] line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push('/dashboard/profile')}
              className="btn-icon cursor-pointer h-9 w-9"
              title="MY_PROFILE"
            >
              <UserIcon className="w-4 h-4 text-emerald-400" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleTheme}
              className="btn-icon cursor-pointer h-9 w-9"
              title={theme === 'dark' ? 'LIGHT_DECK' : 'DARK_DECK'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-cyan-400" /> : <Moon className="w-4 h-4 text-teal-600" />}
            </motion.button>
          </div>
        </header>

        {/* Mobile Nav Drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <div className="fixed inset-0 z-50 md:hidden">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0"
                style={{ background: 'rgba(2,2,4,0.7)', backdropFilter: 'blur(4px)' }}
                onClick={() => setMobileOpen(false)}
              />
              
              {/* Drawer Container */}
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={springTransition}
                className="absolute left-0 top-0 w-64 h-screen flex flex-col max-w-[85vw] shadow-2xl z-10 border-r"
                style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border)' }}
              >
                <div
                  className="flex items-center shrink-0 relative"
                  style={{ height: 'var(--topbar-height)', borderBottom: '1px solid var(--border)' }}
                >
                  <Link href="/dashboard" className="flex items-center select-none pt-2 pl-8">
                    <img
                      src={theme === 'dark' ? '/images/Markdot logo white.png' : '/images/Markdot logo black.png'}
                      alt="Markdot Dotcore"
                      className="h-8 object-contain"
                    />
                  </Link>
                  <button onClick={() => setMobileOpen(false)} className="btn-icon cursor-pointer h-9 w-9 absolute right-5 top-1/2 -translate-y-1/2 mt-1 z-10">
                    <ChevronLeft className="w-4 h-4 text-cyan-400" />
                  </button>
                </div>
                <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1.5 select-none">
                  {navItems.filter(item => canSeeLink(item.role)).map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`nav-item relative ${isActive ? 'active' : ''}`}
                        style={{ color: isActive ? 'var(--brand)' : 'var(--text-secondary)' }}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <div className="flex-1 flex justify-between items-center text-[12px] font-mono">
                          <span>{item.name}</span>
                          <span className="text-[9px] opacity-35">[{item.index}]</span>
                        </div>
                      </Link>
                    );
                  })}
                </nav>
                {showInstallBtn && (
                  <div className="px-4 py-3 shrink-0 border-t" style={{ borderColor: 'var(--border)' }}>
                    <button
                      onClick={handleInstallClick}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded text-[11px] font-bold text-white bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 transition-all shadow-md cursor-pointer border-0 uppercase font-mono"
                      style={{ letterSpacing: '1px' }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>DOWNLOAD ANDROID APP</span>
                    </button>
                  </div>
                )}
                {user && (
                  <div className="p-4 shrink-0 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-9 h-9 rounded flex items-center justify-center shrink-0 border"
                        style={{ background: 'var(--brand-subtle)', border: '1px solid var(--border)' }}
                      >
                        <UserIcon className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                      </div>
                      <div className="min-w-0 font-mono">
                        <p className="text-xs font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>{user.fullName}</p>
                        <p className="text-[9px] truncate" style={{ color: 'var(--text-muted)' }}>{user.jobTitle || 'OPERATOR'}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      {getRoleBadge(user.role)}
                      <button onClick={handleLogout} className="btn-icon btn-icon-danger cursor-pointer h-7 w-7 rounded" title="DISCONNECT">
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* Page content */}
        <main className="flex-1 relative z-0 py-6 px-4 sm:py-8 sm:px-8 md:px-12 lg:px-16 xl:px-20">
          {children}
        </main>
      </div>

      {/* Pop-up Toast Message */}
      <AnimatePresence>
        {popupNotification && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: 50 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 50, x: 50 }}
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999] p-4 rounded-xl shadow-2xl border flex flex-col gap-1 w-[90vw] sm:w-[320px] cursor-pointer font-mono"
            style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-strong)' }}
            onClick={() => {
              if (popupNotification.link) router.push(popupNotification.link);
              setPopupNotification(null);
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-extrabold text-cyan-400 text-[10px] uppercase tracking-widest">{popupNotification.title}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); setPopupNotification(null); }} 
                className="text-slate-500 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-slate-300 leading-relaxed line-clamp-2">{popupNotification.message}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
