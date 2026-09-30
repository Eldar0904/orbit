import { useEffect, useRef } from "react";
import { ClerkProvider, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Router } from "./router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// REQUIRED — copy verbatim. Resolves the key from window.location.hostname so
// the same build serves multiple Clerk custom domains.
const clerkPubKey =
  publishableKeyFromHost(
    window.location.hostname,
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  ) ?? import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// REQUIRED — copy verbatim. Empty in dev (Clerk hits dev FAPI directly).
// Proxy only works for pk_live with the domain registered in Clerk; pk_test
// instances must not use proxyUrl or FAPI calls fail with host_invalid.
const clerkProxyUrl = clerkPubKey.startsWith("pk_live_")
  ? import.meta.env.VITE_CLERK_PROXY_URL
  : undefined;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Clerk passes full paths to routerPush/routerReplace, but wouter's
// setLocation prepends the base — strip it to avoid doubling.
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#3b898e",
    colorForeground: "#173b3d",
    colorMutedForeground: "#587375",
    colorDanger: "#e11d48",
    colorBackground: "#ffffff",
    colorInput: "#ffffff",
    colorInputForeground: "#0f172a",
    colorNeutral: "#dedbd3",
    fontFamily: "'Montserrat', sans-serif",
    borderRadius: "0.375rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl border border-slate-200",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#173b3d] font-semibold",
    headerSubtitle: "text-[#587375]",
    socialButtonsBlockButtonText: "text-slate-700 font-medium",
    formFieldLabel: "text-slate-700 font-medium",
    footerActionLink: "text-[#3b898e] font-medium hover:text-[#286a6e]",
    footerActionText: "text-slate-500",
    dividerText: "text-slate-400",
    identityPreviewEditButton: "text-[#3b898e]",
    formFieldSuccessText: "text-emerald-600",
    alertText: "text-slate-700",
    logoBox: "mb-1",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton: "border border-slate-200 hover:bg-slate-50 transition-colors",
    formButtonPrimary: "bg-[#3b898e] hover:bg-[#286a6e] text-white font-medium transition-colors",
    formFieldInput: "border-[#dedbd3] focus:ring-[#3b898e] focus:border-[#3b898e] bg-white text-[#173b3d]",
    footerAction: "bg-[#f8f7f3]",
    dividerLine: "bg-slate-200",
    alert: "border-red-100 bg-red-50",
    otpCodeFieldInput: "border-slate-200",
    formFieldRow: "gap-3",
    main: "gap-5",
  },
};

// Invalidates the QueryClient cache when the signed-in user changes.
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: t("auth.signInTitle"),
            subtitle: t("auth.signInSubtitle"),
          },
        },
        signUp: {
          start: {
            title: t("auth.signUpTitle"),
            subtitle: t("auth.signUpSubtitle"),
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryClientCacheInvalidator />
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
