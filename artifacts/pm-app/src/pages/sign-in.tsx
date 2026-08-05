import { SignIn } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignInPage() {
  return (
    <div className="pine-pattern relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-pine px-4 py-10">
      <div className="absolute inset-0 bg-gradient-to-br from-pine-deep/20 via-transparent to-pine-deep/60" />
      <div className="relative z-10">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
      </div>
    </div>
  );
}
