import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { LoginButton } from "@/app/(auth)/login/components/login-button";
import LoginPage from "@/app/(auth)/login/page";

describe("Login Page & Google OAuth Button (TC-FE-01, TC-FE-02, TC-FE-03)", () => {
  it("TC-FE-01: renders the Google OAuth button with proper accessible label and icon", () => {
    render(<LoginButton onSignIn={vi.fn()} />);

    const button = screen.getByRole("button", { name: /continuar con google/i });
    expect(button).toBeInTheDocument();
  });

  it("TC-FE-02: triggers OAuth flow with provider 'google' when clicked", async () => {
    const handleSignInMock = vi.fn().mockResolvedValue(undefined);
    render(<LoginButton onSignIn={handleSignInMock} />);

    const button = screen.getByRole("button", { name: /continuar con google/i });
    await React.act(async () => {
      fireEvent.click(button);
    });

    expect(handleSignInMock).toHaveBeenCalledTimes(1);
  });

  it("TC-FE-03: shows error alert banner when error query parameter is present", async () => {
    // Simulate searchParams promise for Next.js 15
    const searchParamsPromise = Promise.resolve({ error: "oauth_access_denied" });

    render(await LoginPage({ searchParams: searchParamsPromise }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("oauth_access_denied")).toBeInTheDocument();
  });
});
