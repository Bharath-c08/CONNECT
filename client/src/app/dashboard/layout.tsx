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
  Moon
} from 'lucide-react';
import { apiRequest, getAuthToken, removeAuthToken, getCurrentUser } from '../../utils/api';
import { io, Socket } from 'socket.io-client';
import CallOverlay from '../../components/CallOverlay';

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
  const [globalSocket, setGlobalSocket] = useState<Socket | null>(null);

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

    // Double check authentication with backend and sync roles
    const checkAuth = async () => {
      try {
        const userProfile = await apiRequest('/auth/me');
        setUser(userProfile);
        localStorage.setItem('user', JSON.stringify(userProfile));
        fetchNotifications();
      } catch (err) {
        // Token might be invalid or expired
        removeAuthToken();
        router.push('/');
      }
    };
    checkAuth();

    // Check time clock status
    const checkClockStatus = async () => {
      try {
        const data = await apiRequest('/clock/status');
        setClockedIn(data.clockedIn);
      } catch (err) {
        console.error('Error fetching clock status:', err);
      }
    };
    checkClockStatus();

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
    const socket = io('http://localhost:5000');
    setGlobalSocket(socket);

    socket.on('connect', () => {
      socket.emit('join-room', user._id || user.id);
    });

    socket.on('new-notification', (notif) => {
      setNotifications(prev => [notif, ...prev]);
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

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (!hydrated) return null;

  const handleLogout = () => {
    removeAuthToken();
    router.push('/');
  };

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, role: 'all' },
    { name: 'Employee Directory', href: '/dashboard/users', icon: Users, role: 'staff' },
    { name: 'Timesheets', href: '/dashboard/clock', icon: Clock, role: 'all' },
    { name: 'Leave / Time Off', href: '/dashboard/leaves', icon: Calendar, role: 'all' },
    { name: 'Task Board', href: '/dashboard/tasks', icon: ClipboardList, role: 'all' },
    { name: 'Teams & Chat', href: '/dashboard/chat', icon: MessageSquare, role: 'all' },
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
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md">Super Admin</span>;
      case 'admin':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md">Admin</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md">Employee</span>;
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      <CallOverlay socket={globalSocket} currentUser={user} />

      {/* ── LEFT SIDEBAR (Desktop) ── */}
      <aside
        className={`hidden md:flex flex-col shrink-0 h-screen sticky top-0 transition-all duration-300 ${
          collapsed ? 'w-[72px]' : 'w-[260px]'
        }`}
        style={{ background: 'var(--bg-subtle)', borderRight: '1px solid var(--border)' }}
      >
        {/* Logo area */}
        <div
          className="flex items-center justify-between px-4 shrink-0"
          style={{ height: 'var(--topbar-height)', borderBottom: '1px solid var(--border)' }}
        >
          {!collapsed ? (
            <Link href="/dashboard" className="flex items-center select-none">
              <img
                src={theme === 'dark' ? '/images/Markdot logo white.png' : '/images/Markdot logo black.png'}
                alt="Logo"
                className="h-8 object-contain"
              />
            </Link>
          ) : (
            <div className="mx-auto w-8 h-8 flex items-center justify-center">
              <img
                src={theme === 'dark' ? '/images/Markdot logo white.png' : '/images/Markdot logo black.png'}
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="btn-icon ml-2 shrink-0"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
          {navItems.filter(item => canSeeLink(item.role)).map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`nav-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
                title={collapsed ? item.name : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User profile strip */}
        {user && (
          <div className="shrink-0 p-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--brand-subtle)', border: '1px solid var(--border)' }}
              >
                <UserIcon className="w-4.5 h-4.5" style={{ color: 'var(--brand)' }} />
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{user.fullName}</p>
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{user.jobTitle || 'Staff'}</p>
                </div>
              )}
            </div>

            {!collapsed && (
              <div className="mt-3 flex items-center justify-between">
                {getRoleBadge(user.role)}
                <button onClick={handleLogout} className="btn-icon btn-icon-danger" title="Logout">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            {collapsed && (
              <button onClick={handleLogout} className="btn-icon btn-icon-danger w-full mt-3" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-y-auto">

        {/* Topbar */}
        <header
          className="topbar justify-between sticky top-0 z-40"
          style={{ backdropFilter: 'blur(12px)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="btn-icon md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-base font-semibold hidden sm:block" style={{ color: 'var(--text-primary)' }}>
              {navItems.find(item => item.href === pathname)?.name || 'Management Panel'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {clockedIn && (
              <div
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold clock-active-glow select-none"
                style={{
                  background: 'var(--success-subtle)',
                  color: 'var(--success)',
                  border: '1px solid rgba(16,185,129,0.2)',
                }}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>SHIFT ACTIVE</span>
              </div>
            )}

            <div
              className="px-3 py-1.5 rounded-lg font-mono text-sm select-none hidden sm:block"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                letterSpacing: '0.05em',
              }}
            >
              {timeString}
            </div>

            <div className="relative">
              <button 
                className="btn-icon relative" 
                title="Notifications"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell className="w-4.5 h-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div 
                  className="absolute top-full right-0 mt-3 w-80 rounded-2xl shadow-2xl z-50 overflow-hidden border border-white/10 anim-fade-up"
                  style={{ background: 'var(--bg-elevated)' }}
                >
                  <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <h3 className="font-bold text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-brand hover:underline">Mark all read</button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">No new notifications</div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n._id} 
                          onClick={() => {
                            if (!n.isRead) markNotificationRead(n._id);
                            if (n.link) router.push(n.link);
                            setShowNotifications(false);
                          }}
                          className={`p-4 border-b border-white/5 cursor-pointer transition-colors hover:bg-white/5 ${!n.isRead ? 'bg-brand/5' : ''}`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold truncate pr-2">{n.title}</span>
                            {!n.isRead && <span className="w-2 h-2 rounded-full bg-brand shrink-0"></span>}
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-2">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={toggleTheme}
              className="btn-icon"
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>
          </div>
        </header>

        {/* Mobile Nav Drawer */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 md:hidden"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setMobileOpen(false)}
          >
            <aside
              className="w-64 h-screen flex flex-col max-w-[85vw]"
              style={{ background: 'var(--bg-subtle)', borderRight: '1px solid var(--border)' }}
              onClick={e => e.stopPropagation()}
            >
              <div
                className="flex items-center justify-between px-5 shrink-0"
                style={{ height: 'var(--topbar-height)', borderBottom: '1px solid var(--border)' }}
              >
                <img
                  src={theme === 'dark' ? '/images/Markdot logo white.png' : '/images/Markdot logo black.png'}
                  alt="Logo"
                  className="h-8 object-contain"
                />
                <button onClick={() => setMobileOpen(false)} className="btn-icon">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
                {navItems.filter(item => canSeeLink(item.role)).map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`nav-item ${isActive ? 'active' : ''}`}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
              {user && (
                <div className="p-4 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'var(--brand-subtle)', border: '1px solid var(--border)' }}
                    >
                      <UserIcon className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{user.fullName}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user.jobTitle || 'Staff'}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    {getRoleBadge(user.role)}
                    <button onClick={handleLogout} className="btn-icon btn-icon-danger" title="Logout">
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 p-8 relative z-0">
          {children}
        </main>
      </div>
    </div>
  );
}


