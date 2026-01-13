"use client";

import React, { useEffect } from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Swords, LayoutDashboard, Settings as SettingsIcon, LogIn } from "lucide-react";
import { useAuth, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [isUserLoading, user, auth]);

  const getInitials = (email?: string | null) => {
    if (!email) return "?";
    return email.substring(0, 2).toUpperCase();
  };

  return (
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2 p-2">
              <Swords className="w-8 h-8 text-sidebar-primary" />
              <span className="text-lg font-semibold">XOXO Arena</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/"}
                >
                  <Link href="/">
                    <Swords />
                    Game
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/dashboard"}
                >
                  <Link href="/dashboard">
                    <LayoutDashboard />
                    Dashboard
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/settings"}
                >
                  <Link href="/settings">
                    <SettingsIcon />
                    Settings
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
              <div className="flex items-center gap-2">
                  {isUserLoading ? (
                      <div className="flex items-center gap-2 p-2">
                          <Avatar>
                              <AvatarFallback>?</AvatarFallback>
                          </Avatar>
                          <span>Loading...</span>
                      </div>
                  ) : user ? (
                      <div className="flex items-center gap-2 p-2">
                           <Avatar>
                              <AvatarFallback>{getInitials(user.email ?? (user.isAnonymous ? 'AN' : 'G'))}</AvatarFallback>
                          </Avatar>
                          <span>{user.isAnonymous ? 'Anonymous' : (user.email ?? 'Guest')}</span>
                      </div>
                  ) : (
                      <Button onClick={() => initiateAnonymousSignIn(auth)} className="w-full">
                          <LogIn className="mr-2"/>
                          Sign In Anonymously
                      </Button>
                  )}
              </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-12 items-center justify-between border-b bg-background px-4 md:justify-end">
            <SidebarTrigger className="md:hidden" />
          </header>
          <main className="p-4 md:p-8">{children}</main>
        </SidebarInset>
      </SidebarProvider>
  );
}
