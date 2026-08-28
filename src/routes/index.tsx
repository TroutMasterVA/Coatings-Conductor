import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, FolderOpen, Printer } from "lucide-react";
import { toast } from "sonner";
import { BootShell } from "@/components/boot-shell";
import { Button } from "@/components/ui/button";
import { EmptyCardSkeleton, FieldCardView } from "@/components/field-card-view";
import { LearningPanel } from "@/components/learning-panel";
import { PdsIntake } from "@/components/pds-intake";
import { ProjectHome } from "@/components/project-home";
import { WeatherPanel } from "@/components/weather-panel";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState, type AppUser } from "@/lib/auth/use-current-user";
import { buildCardFromPds } from "@/lib/on-device-extract";
import { loadForecast } from "@/lib/forecast";
import {
  DEFAULT_CALIBRATION,
  loadLegacyLearning,
  recordOutcome,
  type CustomMitigationInput,
} from "@/lib/learning";
import {
  inferProductRules,
  inferSubstrate,
  isMoistureTolerant,
  mitigationById,
  sanitizeMitigations,
  substrateById,
  type Limiter,
  type SiteContext,
} from "@/lib/mitigations";
import { downloadFieldCard } from "@/lib/pdf-card";
import {
  guestCreateProject,
  guestLoadWorkspace,
  guestOpenProject,
  guestSaveCustom,
  guestSaveProject,
  guestArchiveProject,
  guestDeleteProject,
  migrateGuestToAccount,
} from "@/lib/guest-workspace";
import {
  archiveProject,
  createProject,
  defaultSite,
  deleteProject,
  loadWorkspace,
  openProject,
  saveCustomMitigation,
  saveProject,
  type ProjectFull,
  type ProjectSummary,
} from "@/lib/project-store";
import { rescoreForecast } from "@/lib/score-windows";
import { loadZip } from "@/lib/storage";
import type { Calibration, CustomMitigation, FieldCardData, FieldOutcome, ForecastBundle, SavedCard } from "@/lib/types";

export const Route = createFileRoute("/")({ component: Home });
