import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { v as Link, x as require_jsx_runtime, y as Navigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as signIn, t as authClient } from "./client-B40BzJxt.mjs";
import { t as GROK_PROVIDERS } from "./server-Cdz9EoOm.mjs";
import { n as Route$1 } from "./router-DNTh6cKA.mjs";
import { i as Label, n as Button, r as Input, s as useCurrentUserState, t as BootShell } from "./use-current-user-DPix4aJl.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-BY_M3W8S.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Login() {
	const { user, isPending } = useCurrentUserState();
	const search = Route$1.useSearch();
	const [mode, setMode] = (0, import_react.useState)(search.mode);
	const [email, setEmail] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BootShell, { message: "Opening the stand…" });
	if (user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, { to: "/" });
	async function handleEmail(e) {
		e.preventDefault();
		setError(null);
		setBusy(true);
		try {
			const mail = email.trim().toLowerCase();
			if (!mail || password.length < 8) throw new Error("Email and a password of at least 8 characters.");
			if (mode === "up") {
				const { error: err } = await authClient.signUp.email({
					email: mail,
					password,
					name: mail.split("@")[0] || "Conductor"
				});
				if (err) throw new Error(err.message ?? "Could not create the account.");
			} else {
				const { error: err } = await authClient.signIn.email({
					email: mail,
					password
				});
				if (err) throw new Error(err.message ?? "Sign-in failed.");
			}
			await authClient.getSession();
			window.location.href = "/";
		} catch (err) {
			setError(err instanceof Error ? err.message : "Sign-in failed.");
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "min-h-screen bg-bg text-fg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "border-b border-border/80 bg-surface/90 backdrop-blur",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/",
					className: "flex min-w-0 items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: "/mascot.jpg",
						alt: "Coatings Conductor mascot — hard-hat conductor blowing a whistle",
						className: "size-12 rounded-md object-cover object-top shadow-[0_0_0_1px_rgba(255,183,3,0.45)]"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] font-semibold uppercase tracking-[0.2em] text-accent",
							children: "Job-site conductor"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-base font-bold tracking-tight",
							children: "Coatings Conductor"
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					variant: "ghost",
					size: "sm",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						children: "Continue without an account"
					})
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "caution-stripe h-1 w-full" })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mx-auto grid max-w-md place-items-start px-4 py-10 sm:place-items-center",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-full rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-lg font-bold tracking-tight",
						children: mode === "up" ? "Create account" : "Sign in"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm leading-relaxed text-muted",
						children: "Optional. Email and a password — that’s it. Without an account, jobs stay on this device."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							className: "mt-5 space-y-3",
							onSubmit: (e) => void handleEmail(e),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "block",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
										htmlFor: "email",
										children: "Email"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										id: "email",
										type: "email",
										autoComplete: "username",
										className: "mt-1.5",
										value: email,
										onChange: (e) => setEmail(e.target.value),
										required: true
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "block",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
										htmlFor: "password",
										children: "Password"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										id: "password",
										type: "password",
										autoComplete: mode === "up" ? "new-password" : "current-password",
										className: "mt-1.5",
										value: password,
										onChange: (e) => setPassword(e.target.value),
										minLength: 8,
										required: true
									})]
								}),
								error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-nogo",
									children: error
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "submit",
									className: "w-full",
									disabled: busy,
									children: busy ? "Working…" : mode === "up" ? "Create account" : "Sign in"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "mt-3 w-full text-center text-sm text-muted hover:text-fg",
							onClick: () => {
								setMode(mode === "in" ? "up" : "in");
								setError(null);
							},
							children: mode === "in" ? "New here? Create an account" : "Have an account? Sign in"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-5 flex items-center gap-3 text-xs text-subtle",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px flex-1 bg-border" }),
								"or",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px flex-1 bg-border" })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 space-y-2",
							children: GROK_PROVIDERS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								type: "button",
								variant: "secondary",
								className: "w-full",
								disabled: busy,
								onClick: () => {
									setBusy(true);
									signIn(p.providerId, { callbackURL: "/" }).catch((err) => {
										setError(err instanceof Error ? err.message : "Sign-in failed.");
										setBusy(false);
									});
								},
								children: ["Continue with ", p.label]
							}, p.providerId))
						})
					] })
				]
			})
		})]
	});
}
//#endregion
export { Login as component };
