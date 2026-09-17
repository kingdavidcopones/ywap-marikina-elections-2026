'use client';

import {FormEvent, useEffect, useState} from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import {usePathname} from 'next/navigation';
import {CalendarCheckIcon} from '@phosphor-icons/react/CalendarCheck';
import {SidebarSimpleIcon} from '@phosphor-icons/react/SidebarSimple';
import {ChartBarIcon} from '@phosphor-icons/react/ChartBar';
import {ClipboardTextIcon} from '@phosphor-icons/react/ClipboardText';
import {PlusIcon} from '@phosphor-icons/react/Plus';
import {UserPlusIcon} from '@phosphor-icons/react/UserPlus';
import {SignOutIcon} from '@phosphor-icons/react/SignOut';
import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {FormLayout} from '@astryxdesign/core/FormLayout';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack} from '@astryxdesign/core/HStack';
import {Section} from '@astryxdesign/core/Section';
import {
  SideNav,
  SideNavCollapseButton,
  SideNavItem,
  SideNavSection,
} from '@astryxdesign/core/SideNav';
import {Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {VStack} from '@astryxdesign/core/VStack';
import {isNetworkError, reportNetworkError} from '@/lib/network-error';

const destinations = [
  {label: 'Elections', href: '/admin', icon: CalendarCheckIcon},
  {label: 'Nominations', href: '/admin/nominations', icon: UserPlusIcon},
  {label: 'Live results', href: '/admin/results', icon: ChartBarIcon},
  {label: 'Audit log', href: '/admin/audit', icon: ClipboardTextIcon},
];

const CreateElectionDialog = dynamic(() => import('@/components/create-election').then((module) => module.CreateElectionDialog));

function isDestinationSelected(pathname: string, href: string) {
  if (href === '/admin') {
    return pathname === '/admin' || pathname.startsWith('/admin/elections/');
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdminSignIn({onSignIn}: {onSignIn: () => void}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username, password}),
      });
      if (response.ok) {
        setError('');
        onSignIn();
      } else {
        const body = await response.json().catch(() => ({})) as {message?: string};
        setError(body.message ?? 'That username and password don’t match. Check both and try again.');
      }
    } catch (cause) {
      if (isNetworkError(cause)) reportNetworkError();
      setError('We couldn’t reach the server. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AppShell height="fill" variant="surface" contentPadding={0}>
      <Section className="admin-sign-in" variant="transparent" padding={4} minHeight="100%" width="100%">
        <VStack className="admin-sign-in-stack" gap={6} hAlign="center" width="100%">
          <Image
            src="/brand/ywap-marikina-admin-logo-word.svg"
            alt="YWAP Marikina Elections Admin"
            width={171}
            height={50}
            priority
          />

          <Card className="admin-sign-in-card" maxWidth={440} padding={8} width="100%">
            <VStack gap={6}>
              <VStack gap={1} hAlign="center">
                <Heading level={1} justify="center">Welcome back</Heading>
                <Text color="secondary">Sign in to manage YWAP Marikina elections.</Text>
              </VStack>

              <form onSubmit={handleSubmit} className="admin-sign-in-form" noValidate>
                <VStack gap={5}>
                  <FormLayout direction="vertical" defaultOptionality="required">
                    <TextInput
                      label="Username"
                      value={username}
                      onChange={(value) => {
                        setUsername(value);
                        setError('');
                      }}
                      placeholder="Enter your username"
                      autoComplete="username"
                      hasAutoFocus
                      width="100%"
                    />
                    <TextInput
                      label="Password"
                      type="password"
                      value={password}
                      onChange={(value) => {
                        setPassword(value);
                        setError('');
                      }}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      status={error ? {type: 'error', message: error} : undefined}
                      statusVariant="detached"
                      width="100%"
                    />
                  </FormLayout>

                  <Button
                    label="Sign in"
                    type="submit"
                    variant="primary"
                    width="100%"
                    isLoading={isLoading}
                  />
                </VStack>
              </form>
            </VStack>
          </Card>
        </VStack>
      </Section>
    </AppShell>
  );
}

export function AdminShell({children}: {children: React.ReactNode}) {
  const pathname = usePathname();
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  useEffect(() => {
    fetch('/api/admin/session', {cache: 'no-store'})
      .then((response) => response.json())
      .then((body: {authenticated?: boolean}) => setIsSignedIn(Boolean(body.authenticated)))
      .catch((cause) => {
        if (isNetworkError(cause)) reportNetworkError();
        setIsSignedIn(false);
      });
  }, []);

  useEffect(() => {
    const openCreateDialog = () => setIsCreateDialogOpen(true);
    if (new URLSearchParams(window.location.search).get('create') === 'election') {
      openCreateDialog();
    }
    window.addEventListener('open-create-election', openCreateDialog);
    return () => window.removeEventListener('open-create-election', openCreateDialog);
  }, []);

  function setCreateDialogOpen(open: boolean) {
    setIsCreateDialogOpen(open);
    if (!open && new URLSearchParams(window.location.search).has('create')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('create');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }

  if (isSignedIn === null) {
    return null;
  }

  if (!isSignedIn) {
    return <AdminSignIn onSignIn={() => setIsSignedIn(true)} />;
  }

  const collapsible = {
    isCollapsed: isNavCollapsed,
    onCollapsedChange: setIsNavCollapsed,
  };

  async function handleLogout() {
    try {
      await fetch('/api/admin/session', {method: 'DELETE'});
      setIsLogoutOpen(false);
      setIsSignedIn(false);
    } catch (cause) {
      if (isNetworkError(cause)) reportNetworkError();
    }
  }

  return (
    <>
      <AppShell
        height="fill"
        variant="section"
        contentPadding={0}
        mobileNav={{breakpoint: 'md'}}
        sideNav={
          <SideNav
            aria-label="Admin navigation"
            header={
              <HStack
                className="admin-nav-brand"
                gap={2}
                align="center"
                justify={isNavCollapsed ? 'center' : 'between'}
              >
                {!isNavCollapsed ? (
                  <Image
                    src="/brand/ywap-marikina-admin-logo-word.svg"
                    alt="YWAP Marikina Elections Admin"
                    width={152}
                    height={44}
                    priority
                  />
                ) : null}
                <SideNavCollapseButton collapsible={collapsible} size="sm">
                  <SidebarSimpleIcon />
                </SideNavCollapseButton>
              </HStack>
            }
            topContent={
              <Button
                label="Create election"
                variant="primary"
                icon={<PlusIcon />}
                onClick={() => setIsCreateDialogOpen(true)}
                isIconOnly={isNavCollapsed}
                tooltip={isNavCollapsed ? 'Create election' : undefined}
                width={isNavCollapsed ? undefined : '100%'}
              />
            }
            footer={
              <SideNavItem
                label="Log out"
                icon={SignOutIcon}
                onClick={() => setIsLogoutOpen(true)}
              />
            }
            collapsible={{...collapsible, hasButton: false}}
          >
            <SideNavSection title="Operations" isHeaderHidden>
              {destinations.map((destination) => (
                <SideNavItem
                  key={destination.href}
                  label={destination.label}
                  href={destination.href}
                  icon={destination.icon}
                  selectedIcon={destination.icon}
                  isSelected={isDestinationSelected(pathname, destination.href)}
                />
              ))}
            </SideNavSection>
          </SideNav>
        }
      >
        {children}
      </AppShell>
      {isCreateDialogOpen ? <CreateElectionDialog isOpen onOpenChange={setCreateDialogOpen} /> : null}

      <AlertDialog
        isOpen={isLogoutOpen}
        onOpenChange={setIsLogoutOpen}
        title="Log out of admin?"
        description="You’ll return to the sign-in screen and need the admin credentials to come back."
        actionLabel="Log out"
        actionVariant="destructive"
        onAction={handleLogout}
      />
    </>
  );
}
