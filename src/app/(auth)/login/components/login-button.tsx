"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface LoginButtonProps {
  onSignIn?: () => Promise<void> | void;
}

export function LoginButton({ onSignIn }: LoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      if (onSignIn) {
        await onSignIn();
        return;
      }

      const supabase = createClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });

      if (error) {
        console.error("OAuth sign-in error:", error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      isLoading={isLoading}
      onClick={handleClick}
      className="w-full flex items-center justify-center gap-3 py-3 font-medium shadow-sm hover:bg-muted/60 transition-all text-sm sm:text-base border-border"
      aria-label="Continuar con Google"
    >
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          fill="#EA4335"
          d="M12 5c1.54 0 2.93.56 4.02 1.48l3.01-3.01C17.21 1.76 14.77 1 12 1 7.42 1 3.53 3.61 1.63 7.39l3.69 2.86C6.2 7.49 8.87 5 12 5z"
        />
        <path
          fill="#4285F4"
          d="M23.49 12.28c0-.79-.07-1.54-.19-2.28H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.71 2.87c2.16-2 3.71-4.94 3.71-8.68z"
        />
        <path
          fill="#FBBC05"
          d="M5.32 14.75c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18L1.63 7.53C.59 9.6.01 11.73.01 14s.58 4.4 1.62 6.47l3.69-2.86v-2.86z"
        />
        <path
          fill="#34A853"
          d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.71-2.87c-1.08.72-2.45 1.16-4.22 1.16-3.13 0-5.8-2.49-6.68-5.25L1.63 15.99C3.53 19.77 7.42 23 12 23z"
        />
      </svg>
      <span>Continuar con Google</span>
    </Button>
  );
}
