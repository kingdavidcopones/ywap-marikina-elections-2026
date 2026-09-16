'use client';

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
import {XCircleIcon} from '@phosphor-icons/react/XCircle';
import {XIcon} from '@phosphor-icons/react/X';
import {Theme} from '@astryxdesign/core/theme';
import type {DefinedTheme} from '@astryxdesign/core/theme';
import {ywapMarikinaTheme} from '@/lib/ywap-marikina';

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

export function Providers({children}: {children: React.ReactNode}) {
  return (
    <Theme theme={ywapPhosphorTheme} mode="light">
      {children}
    </Theme>
  );
}
