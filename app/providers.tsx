'use client';

import {useEffect} from 'react';
import NextLink from 'next/link';
import {ArrowDownIcon} from '@phosphor-icons/react/ArrowDown';
import {ArrowsDownUpIcon} from '@phosphor-icons/react/ArrowsDownUp';
import {ArrowSquareOutIcon} from '@phosphor-icons/react/ArrowSquareOut';
import {ArrowUpIcon} from '@phosphor-icons/react/ArrowUp';
import {CalendarBlankIcon} from '@phosphor-icons/react/CalendarBlank';
import {CaretDoubleLeftIcon} from '@phosphor-icons/react/CaretDoubleLeft';
import {CaretDoubleRightIcon} from '@phosphor-icons/react/CaretDoubleRight';
import {CaretDownIcon} from '@phosphor-icons/react/CaretDown';
import {CaretLeftIcon} from '@phosphor-icons/react/CaretLeft';
import {CaretRightIcon} from '@phosphor-icons/react/CaretRight';
import {CheckCircleIcon} from '@phosphor-icons/react/CheckCircle';
import {CheckIcon} from '@phosphor-icons/react/Check';
import {ChecksIcon} from '@phosphor-icons/react/Checks';
import {ClockIcon} from '@phosphor-icons/react/Clock';
import {ColumnsIcon} from '@phosphor-icons/react/Columns';
import {CopyIcon} from '@phosphor-icons/react/Copy';
import {DotsThreeIcon} from '@phosphor-icons/react/DotsThree';
import {EyeSlashIcon} from '@phosphor-icons/react/EyeSlash';
import {FunnelIcon} from '@phosphor-icons/react/Funnel';
import {InfoIcon} from '@phosphor-icons/react/Info';
import {ListIcon} from '@phosphor-icons/react/List';
import {MagnifyingGlassIcon} from '@phosphor-icons/react/MagnifyingGlass';
import {MicrophoneIcon} from '@phosphor-icons/react/Microphone';
import {StopCircleIcon} from '@phosphor-icons/react/StopCircle';
import {WarningCircleIcon} from '@phosphor-icons/react/WarningCircle';
import {WrenchIcon} from '@phosphor-icons/react/Wrench';
import {WifiXIcon} from '@phosphor-icons/react/WifiX';
import {XCircleIcon} from '@phosphor-icons/react/XCircle';
import {XIcon} from '@phosphor-icons/react/X';
import {HStack} from '@astryxdesign/core/HStack';
import {Icon} from '@astryxdesign/core/Icon';
import {LayerProvider} from '@astryxdesign/core/Layer';
import {LinkProvider} from '@astryxdesign/core/Link';
import {Text} from '@astryxdesign/core/Text';
import {useToast} from '@astryxdesign/core/Toast';
import {Theme} from '@astryxdesign/core/theme';
import type {DefinedTheme} from '@astryxdesign/core/theme';
import {ywapMarikinaTheme} from '@/lib/ywap-marikina';
import {NETWORK_ERROR_EVENT} from '@/lib/network-error';

const ywapPhosphorTheme = {
  ...ywapMarikinaTheme,
  icons: {
    ...ywapMarikinaTheme.icons,
    close: <XIcon />,
    chevronDown: <CaretDownIcon />,
    chevronLeft: <CaretLeftIcon />,
    chevronRight: <CaretRightIcon />,
    chevronsLeft: <CaretDoubleLeftIcon />,
    chevronsRight: <CaretDoubleRightIcon />,
    check: <CheckIcon />,
    success: <CheckCircleIcon />,
    error: <XCircleIcon />,
    warning: <WarningCircleIcon />,
    info: <InfoIcon />,
    calendar: <CalendarBlankIcon />,
    clock: <ClockIcon />,
    externalLink: <ArrowSquareOutIcon />,
    menu: <ListIcon />,
    moreHorizontal: <DotsThreeIcon />,
    search: <MagnifyingGlassIcon />,
    arrowUp: <ArrowUpIcon />,
    arrowDown: <ArrowDownIcon />,
    arrowsUpDown: <ArrowsDownUpIcon />,
    funnel: <FunnelIcon />,
    eyeSlash: <EyeSlashIcon />,
    viewColumns: <ColumnsIcon />,
    copy: <CopyIcon />,
    checkDouble: <ChecksIcon />,
    wrench: <WrenchIcon />,
    stop: <StopCircleIcon />,
    microphone: <MicrophoneIcon />,
  },
} satisfies DefinedTheme;

function NetworkErrorListener() {
  const toast = useToast();

  useEffect(() => {
    const showNetworkError = () => {
      toast({
        body: (
          <HStack gap={2} align="center">
            <Icon icon={WifiXIcon} color="error" size="sm" />
            <Text>Network error. Check your Wi-Fi connection and try again.</Text>
          </HStack>
        ),
        type: 'error',
        uniqueID: 'network-error',
        collisionBehavior: 'ignore',
      });
    };

    window.addEventListener('offline', showNetworkError);
    window.addEventListener(NETWORK_ERROR_EVENT, showNetworkError);
    return () => {
      window.removeEventListener('offline', showNetworkError);
      window.removeEventListener(NETWORK_ERROR_EVENT, showNetworkError);
    };
  }, [toast]);

  return null;
}

export function Providers({children}: {children: React.ReactNode}) {
  return (
    <Theme theme={ywapPhosphorTheme} mode="light">
      <LinkProvider component={NextLink}>
        <LayerProvider>
          <NetworkErrorListener />
          {children}
        </LayerProvider>
      </LinkProvider>
    </Theme>
  );
}
