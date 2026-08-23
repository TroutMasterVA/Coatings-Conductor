import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { C as unlockedGoHours, S as tightnessLabel, _ as recordOutcome, a as catalogHelps, c as detectLimiters, d as inferSubstrate, f as isMoistureTolerant, g as peakExample, h as mitigationById, l as goHourCount, m as loadLearning, n as SUBSTRATES, o as compatibleMitigations, p as isRecommended, r as axisImpact, s as dayGoHoursNeeded, t as DEFAULT_CALIBRATION, u as inferProductRules, v as rescoreForecast, w as upsertCustomMitigation, x as substrateById, y as saveCalibration } from "./score-windows-494NVaej.mjs";
import { a as MapPin, c as Download, i as Printer, l as CloudSun, n as Upload, o as LoaderCircle, s as FileText, t as X } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Slot } from "../_libs/radix-ui__react-slot.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-Dx-OjphP.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[opacity,transform,background-color,color,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-40 active:not-disabled:scale-[0.96] [&_svg]:size-4 [&_svg]:shrink-0", {
	variants: {
		variant: {
			default: "bg-primary text-primary-fg hover:opacity-90",
			secondary: "bg-surface-2 text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:bg-surface",
			ghost: "text-fg hover:bg-surface-2",
			outline: "text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.10)] hover:bg-surface-2",
			rail: "bg-rail text-paper hover:opacity-90"
		},
		size: {
			default: "h-11 px-4",
			sm: "h-9 px-3 text-xs",
			lg: "h-12 px-5",
			icon: "size-11"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
var Button = import_react.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		ref,
		...props
	});
});
Button.displayName = "Button";
var STEP_RAIL = [
	{
		n: "01",
		id: "store",
		label: "Store"
	},
	{
		n: "02",
		id: "creds",
		label: "Qualify"
	},
	{
		n: "03",
		id: "prep",
		label: "Prep"
	},
	{
		n: "04",
		id: "ambnt",
		label: "Ambient"
	},
	{
		n: "05",
		id: "mix",
		label: "Mix"
	},
	{
		n: "06",
		id: "apply",
		label: "Apply"
	},
	{
		n: "07",
		id: "hold",
		label: "Hold"
	},
	{
		n: "08",
		id: "insp",
		label: "Inspect"
	},
	{
		n: "09",
		id: "cure",
		label: "Cure"
	},
	{
		n: "10",
		id: "safe",
		label: "Safety"
	}
];
var badgeVariants = cva("inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase", {
	variants: { variant: {
		default: "bg-surface-2 text-muted",
		go: "bg-go-soft text-go",
		caution: "bg-caution-soft text-caution",
		nogo: "bg-nogo-soft text-nogo",
		rail: "bg-rail text-paper",
		paper: "bg-paper-edge text-ink-muted"
	} },
	defaultVariants: { variant: "default" }
});
function Badge({ className, variant, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn(badgeVariants({ variant }), className),
		...props
	});
}
function join$1(items) {
	return (items ?? []).filter(Boolean).join(" · ");
}
function Cell({ label, value }) {
	if (!value) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[10px] font-medium uppercase tracking-[0.14em] text-ink-muted",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-0.5 text-sm leading-snug text-ink",
			children: value
		})]
	});
}
function Section({ n, title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "grid grid-cols-[2.5rem_1fr] gap-3 border-b border-paper-edge py-3 last:border-b-0 sm:grid-cols-[3.25rem_1fr] sm:gap-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "pt-0.5 font-mono text-xs font-medium text-rail",
			children: n
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-ink",
				children: title
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 space-y-2",
				children
			})]
		})]
	});
}
function FieldCardView({ card }) {
	const env = card.environmentals;
	const envLine = [
		env.ambientTempMinF != null || env.ambientTempMaxF != null ? `Air ${env.ambientTempMinF ?? "—"}–${env.ambientTempMaxF ?? "—"}°F` : null,
		env.substrateTempMinF != null || env.substrateTempMaxF != null ? `Substrate ${env.substrateTempMinF ?? "—"}–${env.substrateTempMaxF ?? "—"}°F` : null,
		env.dewPointSpreadMinF != null ? `Dew spread ≥ ${env.dewPointSpreadMinF}°F` : null,
		env.relativeHumidityMax != null ? `RH ≤ ${env.relativeHumidityMax}%` : null,
		env.relativeHumidityMin != null ? `RH ≥ ${env.relativeHumidityMin}%` : null,
		env.precipitationAllowed === false ? "No precipitation" : null,
		env.windMaxMph != null ? `Wind ≤ ${env.windMaxMph} mph` : null
	].filter(Boolean);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		id: "field-card-print",
		className: "print-sheet overflow-hidden rounded-xl bg-paper text-ink shadow-[0_0_0_1px_rgba(22,24,28,0.08),0_24px_60px_-32px_rgba(0,0,0,0.5)]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "caution-stripe h-1.5 w-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "hidden w-2.5 shrink-0 bg-rail sm:block" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1 p-5 sm:p-7",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
						className: "flex flex-wrap items-start justify-between gap-3 border-b border-rail/80 pb-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[10px] font-semibold uppercase tracking-[0.22em] text-rail",
								children: "Coatings Conductor · field card"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "mt-2 font-sans text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl",
								children: card.product.name || "Unnamed product"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm text-ink-muted",
								children: [
									card.product.manufacturer,
									card.product.productType,
									card.product.service
								].filter(Boolean).join(" · ") || "Manufacturer not stated"
							})
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col items-end gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
								variant: "paper",
								children: [card.confidence, " extract"]
							}), card.product.mixRatio ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-xs text-ink-muted",
								children: card.product.mixRatio
							}) : null]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "no-print mt-4 flex gap-1 overflow-x-auto pb-1",
						"aria-label": "Card sections",
						children: STEP_RAIL.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							href: `#step-${s.id}`,
							className: "shrink-0 rounded-sm px-2 py-1 font-mono text-[10px] text-ink-muted hover:bg-paper-edge hover:text-ink",
							children: [
								s.n,
								" ",
								s.label
							]
						}, s.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { id: "step-store" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
								n: "01",
								title: "Store & shelf life",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid gap-3 sm:grid-cols-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
												label: "Storage",
												value: card.storage.temperatureRange
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
												label: "Unopened shelf",
												value: card.shelfLife.unopened
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
												label: "Opened",
												value: card.shelfLife.opened
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
												label: "Mixed / pot life",
												value: card.shelfLife.mixedPotLife
											})
										]
									}),
									card.storage.conditions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm text-ink",
										children: join$1(card.storage.conditions)
									}) : null,
									card.storage.notes || card.shelfLife.notes ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm text-ink-muted",
										children: card.storage.notes || card.shelfLife.notes
									}) : null
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { id: "step-creds" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
								n: "02",
								title: "Qualify · credentials",
								children: [card.credentials.required.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "space-y-1 text-sm",
									children: card.credentials.required.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "flex gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mt-2 size-1 shrink-0 rounded-full bg-rail" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: c })]
									}, c))
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-ink-muted",
									children: "None stated in the PDS — follow the project spec."
								}), card.credentials.notes ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-ink-muted",
									children: card.credentials.notes
								}) : null]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { id: "step-prep" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
								n: "03",
								title: "Surface preparation",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid gap-3 sm:grid-cols-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
											label: "Substrates",
											value: join$1(card.surfacePrep.substrates)
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
											label: "Methods",
											value: join$1(card.surfacePrep.methods)
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
											label: "Profile",
											value: card.surfacePrep.profile
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
											label: "Cleanliness",
											value: card.surfacePrep.cleanliness
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
											label: "Moisture",
											value: card.surfacePrep.moisture
										})
									]
								}), card.surfacePrep.notes ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-ink-muted",
									children: card.surfacePrep.notes
								}) : null]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { id: "step-ambnt" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
								n: "04",
								title: "Ambient & environmentals",
								children: [
									envLine.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex flex-wrap gap-1.5",
										children: envLine.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "rounded-sm bg-paper-edge px-2 py-1 font-mono text-xs text-ink",
											children: item
										}, item))
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm text-ink-muted",
										children: "No numeric application window found."
									}),
									env.notes ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm text-ink-muted",
										children: env.notes
									}) : null,
									env.directSunNotes ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm text-ink-muted",
										children: env.directSunNotes
									}) : null
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { id: "step-mix" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
								n: "05",
								title: "Mix",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid gap-3 sm:grid-cols-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
											label: "Components",
											value: card.mixing.components
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
											label: "Ratio",
											value: card.mixing.ratio
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
											label: "Induction",
											value: card.mixing.inductionTime
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
											label: "Pot life",
											value: card.mixing.potLife
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
											label: "Thinning",
											value: card.mixing.thinning
										})
									]
								}), card.mixing.notes ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-ink-muted",
									children: card.mixing.notes
								}) : null]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { id: "step-apply" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
								n: "06",
								title: "Install / apply",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid gap-3 sm:grid-cols-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
												label: "Methods",
												value: join$1(card.installation.methods)
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
												label: "Film",
												value: card.installation.filmThickness
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
												label: "Coverage",
												value: card.installation.coverage
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
												label: "Coats",
												value: card.installation.numberOfCoats
											})
										]
									}),
									card.installation.sequence.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
										className: "space-y-1 text-sm",
										children: card.installation.sequence.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
											className: "flex gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-mono text-xs text-rail",
												children: String(i + 1).padStart(2, "0")
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: s })]
										}, s))
									}) : null,
									card.installation.notes ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm text-ink-muted",
										children: card.installation.notes
									}) : null
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { id: "step-hold" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
								n: "07",
								title: "Hold points",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
									className: "space-y-2.5",
									children: card.holdPoints.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "grid grid-cols-[1.5rem_1fr] gap-2 text-sm",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-mono text-xs text-rail",
											children: String(h.step).padStart(2, "0")
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-wrap items-baseline gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-medium",
													children: h.name
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-xs text-ink-muted",
													children: [h.owner, h.source === "inferred" ? " · inferred" : ""]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-ink-muted",
												children: h.criteria
											}),
											h.timing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-xs text-ink-muted",
												children: h.timing
											}) : null
										] })]
									}, `${h.step}-${h.name}`))
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { id: "step-insp" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
								n: "08",
								title: "Inspection",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
										label: "Methods",
										value: join$1(card.inspection.methods)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
										label: "Acceptance",
										value: join$1(card.inspection.acceptance)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
										label: "Record",
										value: card.inspection.documentation
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { id: "step-cure" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
								n: "09",
								title: "Cure & recoat",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid gap-3 sm:grid-cols-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
											label: "Touch",
											value: card.cure.touch
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
											label: "Handle",
											value: card.cure.handle
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
											label: "Recoat min",
											value: card.cure.recoatMin
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
											label: "Recoat max",
											value: card.cure.recoatMax
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
											label: "Full cure",
											value: card.cure.fullCure
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
											label: "Immersion",
											value: card.cure.immersionService
										})
									]
								}), card.cure.temperatureDependence ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-ink-muted",
									children: card.cure.temperatureDependence
								}) : null]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { id: "step-safe" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
								n: "10",
								title: "Safety",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
										label: "PPE",
										value: join$1(card.safety.ppe)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
										label: "Ventilation",
										value: card.safety.ventilation
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, {
										label: "Hazards",
										value: join$1(card.safety.hazards)
									})
								]
							})
						]
					}),
					card.extractionNotes.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: cn("mt-4 text-xs leading-relaxed text-ink-muted"),
						children: card.extractionNotes.join(" ")
					}) : null
				]
			})]
		})]
	});
}
function EmptyCardSkeleton() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "overflow-hidden rounded-xl bg-paper text-ink shadow-[0_0_0_1px_rgba(22,24,28,0.08)]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "caution-stripe h-1.5 w-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-h-[28rem]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "hidden w-2.5 shrink-0 bg-rail sm:block" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 p-5 sm:p-7",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: "/mascot.jpg",
							alt: "",
							className: "size-14 rounded-md object-cover object-top"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] font-semibold uppercase tracking-[0.22em] text-rail",
							children: "Coatings Conductor · waiting on PDS"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-2 text-2xl font-semibold tracking-tight",
							children: "Whistle ready. Paste a PDS."
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 max-w-md text-sm text-ink-muted",
						children: "The card fills in process order: store, qualify, prep, ambient, mix, apply, hold, inspect, cure, safety."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
						className: "mt-8 space-y-0",
						children: STEP_RAIL.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "grid grid-cols-[2.75rem_1fr] gap-3 border-b border-paper-edge py-2.5 text-sm last:border-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-xs text-rail",
								children: s.n
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium uppercase tracking-[0.14em] text-ink-muted",
								children: s.label
							})]
						}, s.id))
					})
				]
			})]
		})]
	});
}
var Input = import_react.forwardRef(({ className, type, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
	type,
	className: cn("flex h-11 w-full rounded-md bg-surface-2 px-3 text-sm text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition-[box-shadow] duration-150 placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40", className),
	ref,
	...props
}));
Input.displayName = "Input";
var rangeClass = "h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-primary [&::-webkit-slider-thumb]:size-4";
var AXIS_ORDER = [
	"solar",
	"thermal",
	"moisture",
	"precip",
	"wind"
];
function SliderRow({ label, value, onChange, disabled, impact }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("rounded-lg bg-surface-2 p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]", disabled && "opacity-40"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex justify-between text-xs text-muted",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium text-fg",
							children: label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-fg",
							children: Math.round(value * 100)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "mt-1 flex justify-between text-xs text-subtle",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Open" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Spec-hard" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "range",
						min: 0,
						max: 100,
						step: 1,
						disabled,
						className: cn(rangeClass, "mt-1.5 bg-border"),
						value: Math.round(value * 100),
						onChange: (e) => onChange(Number(e.target.value) / 100),
						"aria-label": label
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-xs font-medium leading-snug text-accent",
				children: impact.live
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs leading-relaxed text-muted",
				children: impact.why
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1.5 text-xs leading-snug text-subtle",
				children: [
					"Left: ",
					impact.left,
					". Right: ",
					impact.right,
					"."
				]
			})
		]
	});
}
function num(v) {
	if (v.trim() === "") return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}
function LearningPanel({ calibration, onCalibration, custom, customIds, onToggleCustom, onAddCustom, onLogOutcome, outcomeCount, product, zip, substrateLabel, mitigationsInPlay, forecast, disabled }) {
	const [logOpen, setLogOpen] = (0, import_react.useState)(false);
	const [addOpen, setAddOpen] = (0, import_react.useState)(false);
	const [actual, setActual] = (0, import_react.useState)("correct");
	const [measuredAir, setMeasuredAir] = (0, import_react.useState)("");
	const [measuredSteel, setMeasuredSteel] = (0, import_react.useState)("");
	const [measuredRh, setMeasuredRh] = (0, import_react.useState)("");
	const [measuredDew, setMeasuredDew] = (0, import_react.useState)("");
	const [logNotes, setLogNotes] = (0, import_react.useState)("");
	const [newLabel, setNewLabel] = (0, import_react.useState)("");
	const [newSummary, setNewSummary] = (0, import_react.useState)("");
	const [helps, setHelps] = (0, import_react.useState)([]);
	const [before, setBefore] = (0, import_react.useState)({
		air: "",
		steel: "",
		rh: "",
		dew: "",
		wind: ""
	});
	const [after, setAfter] = (0, import_react.useState)({
		air: "",
		steel: "",
		rh: "",
		dew: "",
		wind: ""
	});
	const [newNotes, setNewNotes] = (0, import_react.useState)("");
	const peak = forecast?.days[0]?.hours.find((h) => h.hour === 13) ?? forecast?.days[0]?.hours[0];
	const predicted = forecast ? forecast.days.some((d) => d.status === "go") && forecast.days.some((d) => d.status === "nogo") ? "mixed" : forecast.days[0]?.status ?? "unknown" : "unknown";
	function setMaster(n) {
		if (calibration.linked) onCalibration({
			...calibration,
			master: n,
			solar: n,
			thermal: n,
			moisture: n,
			precip: n,
			wind: n
		});
		else onCalibration({
			...calibration,
			master: n
		});
	}
	function setUnlocked(unlocked) {
		if (unlocked && calibration.linked) {
			onCalibration({
				...calibration,
				linked: false,
				solar: calibration.master,
				thermal: calibration.master,
				moisture: calibration.master,
				precip: calibration.master,
				wind: calibration.master
			});
			return;
		}
		onCalibration({
			...calibration,
			linked: !unlocked
		});
	}
	const goHoursNeed = dayGoHoursNeeded(calibration.master);
	const axisValue = {
		solar: calibration.solar,
		thermal: calibration.thermal,
		moisture: calibration.moisture,
		precip: calibration.precip,
		wind: calibration.wind
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-semibold uppercase tracking-wide text-accent",
						children: "Call tightness"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "NOAA + the PDS model will miss a thermometer on the steel. Open the call when field judgment has been right; harden it after a miss. Always measure air, substrate, RH, and dew point at the workface before you mix."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex justify-between text-xs text-muted",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Field judgment" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-mono text-fg",
										children: tightnessLabel(calibration.master)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Spec-hard" })
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "range",
								min: 0,
								max: 100,
								step: 1,
								className: cn(rangeClass, "mt-2"),
								value: Math.round(calibration.master * 100),
								onChange: (e) => setMaster(Number(e.target.value) / 100),
								disabled,
								"aria-label": "Call tightness"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-xs leading-relaxed text-muted",
								children: calibration.linked ? `All five limiters follow this slider. A calendar day is GO only with ${goHoursNeed} in-window hours.` : `Unlocked: this slider only sets the day call — GO needs ${goHoursNeed} in-window hours. Hour scoring uses the attribute sliders below.`
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "relative mt-3 flex min-h-11 cursor-pointer items-start gap-2.5 text-sm text-fg",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							className: "relative z-10 mt-0.5 size-4 shrink-0 accent-go",
							checked: !calibration.linked,
							onChange: (e) => setUnlocked(e.target.checked)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: "Unlock attributes"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-0.5 block text-xs leading-relaxed text-muted",
							children: "Score solar, temperature, dew/RH, rain, and wind on their own. Leave off to keep them locked to the master tightness."
						})] })]
					}),
					calibration.linked ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 space-y-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs leading-relaxed text-muted",
							children: "Left opens the window (NOAA + PDS tend conservative). Right hardens to the number the inspector will log. These do not rewrite the PDS limits — they change how close an hour must be before it flips caution or no-go, and how hard we bake the substrate in sun."
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid gap-3 sm:grid-cols-2",
							children: AXIS_ORDER.map((id) => {
								const impact = axisImpact(id, axisValue[id]);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderRow, {
									label: impact.label,
									value: axisValue[id],
									disabled,
									impact,
									onChange: (n) => onCalibration({
										...calibration,
										[id]: n
									})
								}, id);
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-3 font-mono text-xs text-muted",
						children: [
							outcomeCount,
							" field result",
							outcomeCount === 1 ? "" : "s",
							" logged — they nudge this model."
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "text-xs font-semibold uppercase tracking-wide text-accent",
					onClick: () => setLogOpen((v) => !v),
					children: [logOpen ? "Hide" : "Log", " field result"]
				}), logOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: "Tell the model if today’s call matched the workface. A false no-go opens the window; a failed go hardens it. Measured steel vs forecast steel trains solar gain."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-medium text-muted",
								children: "What happened"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								className: "mt-1 flex h-11 w-full rounded-md bg-surface-2 px-3 text-sm text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
								value: actual,
								onChange: (e) => setActual(e.target.value),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "correct",
										children: "Call was right"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "false_nogo",
										children: "No-go / caution — but we worked it and it was fine"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "false_go",
										children: "Go — but the workface was actually out"
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-muted",
									children: "Measured air °F"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									className: "mt-1 h-9 font-mono",
									value: measuredAir,
									onChange: (e) => setMeasuredAir(e.target.value),
									inputMode: "decimal"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-muted",
									children: "Measured substrate °F"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									className: "mt-1 h-9 font-mono",
									value: measuredSteel,
									onChange: (e) => setMeasuredSteel(e.target.value),
									inputMode: "decimal"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-muted",
									children: "Measured RH %"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									className: "mt-1 h-9 font-mono",
									value: measuredRh,
									onChange: (e) => setMeasuredRh(e.target.value),
									inputMode: "decimal"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-muted",
									children: "Measured dew °F"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									className: "mt-1 h-9 font-mono",
									value: measuredDew,
									onChange: (e) => setMeasuredDew(e.target.value),
									inputMode: "decimal"
								})] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							placeholder: "Notes — hold point, inspector, spec call",
							value: logNotes,
							onChange: (e) => setLogNotes(e.target.value)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "secondary",
							disabled,
							onClick: () => {
								onLogOutcome({
									product,
									zip,
									substrate: substrateLabel,
									mitigations: mitigationsInPlay,
									predicted,
									actual,
									forecastAir: peak?.tempF ?? null,
									forecastSteel: peak?.substrateF ?? null,
									measuredAir: num(measuredAir),
									measuredSteel: num(measuredSteel),
									measuredRh: num(measuredRh),
									measuredDew: num(measuredDew),
									notes: logNotes
								});
								setLogNotes("");
							},
							children: "Save result into the model"
						})
					]
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "text-xs font-semibold uppercase tracking-wide text-accent",
						onClick: () => setAddOpen((v) => !v),
						children: [addOpen ? "Hide" : "Add", " a field mitigation"]
					}),
					custom.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 flex flex-wrap gap-2",
						children: custom.map((c) => {
							const on = customIds.includes(c.id);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: cn("inline-flex h-9 items-center rounded-md px-2.5 text-xs", on ? "bg-go/20 font-medium text-go-soft shadow-[0_0_0_1px_rgba(63,125,92,0.65)]" : "bg-surface-2 text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"),
								onClick: () => onToggleCustom(c.id),
								children: [c.label, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "ml-1.5 font-mono text-[10px] opacity-70",
									children: ["n=", c.samples]
								})]
							}) }, c.id);
						})
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs text-muted",
						children: "None learned yet. Log before/after readings so the next job can use it."
					}),
					addOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 space-y-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "Name — e.g. Ice pig / evaporative fans",
								value: newLabel,
								onChange: (e) => setNewLabel(e.target.value)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "What it does on this workface",
								value: newSummary,
								onChange: (e) => setNewSummary(e.target.value)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-wrap gap-2",
								children: catalogHelps().map((h) => {
									const on = helps.includes(h);
									return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: cn("h-8 rounded-md px-2 text-xs", on ? "bg-go/20 text-go-soft" : "bg-surface-2 text-muted"),
										onClick: () => setHelps(on ? helps.filter((x) => x !== h) : [...helps, h]),
										children: h
									}, h);
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs font-medium text-muted",
								children: "Original conditions"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-5 gap-1.5",
								children: [
									"air",
									"steel",
									"rh",
									"dew",
									"wind"
								].map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] uppercase text-muted",
									children: k
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									className: "mt-1 h-9 font-mono",
									inputMode: "decimal",
									value: before[k],
									onChange: (e) => setBefore({
										...before,
										[k]: e.target.value
									})
								})] }, `b-${k}`))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs font-medium text-muted",
								children: "After mitigation"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-5 gap-1.5",
								children: [
									"air",
									"steel",
									"rh",
									"dew",
									"wind"
								].map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] uppercase text-muted",
									children: k
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									className: "mt-1 h-9 font-mono",
									inputMode: "decimal",
									value: after[k],
									onChange: (e) => setAfter({
										...after,
										[k]: e.target.value
									})
								})] }, `a-${k}`))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "Notes",
								value: newNotes,
								onChange: (e) => setNewNotes(e.target.value)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								disabled: disabled || newLabel.trim().length < 2,
								onClick: () => {
									onAddCustom({
										label: newLabel,
										summary: newSummary,
										helps,
										before: {
											air: num(before.air),
											steel: num(before.steel),
											rh: num(before.rh),
											dew: num(before.dew),
											wind: num(before.wind)
										},
										after: {
											air: num(after.air),
											steel: num(after.steel),
											rh: num(after.rh),
											dew: num(after.dew),
											wind: num(after.wind)
										},
										notes: newNotes
									});
									setNewLabel("");
									setNewSummary("");
									setHelps([]);
									setBefore({
										air: "",
										steel: "",
										rh: "",
										dew: "",
										wind: ""
									});
									setAfter({
										air: "",
										steel: "",
										rh: "",
										dew: "",
										wind: ""
									});
									setNewNotes("");
								},
								children: "Learn this mitigation"
							})
						]
					}) : null
				]
			})
		]
	});
}
var Label = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
	ref,
	className: cn("text-xs font-medium tracking-wide text-muted", className),
	...props
}));
Label.displayName = "Label";
var Textarea = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
	className: cn("flex min-h-40 w-full rounded-lg bg-surface-2 px-3 py-3 text-sm text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition-[box-shadow] duration-150 placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40", className),
	ref,
	...props
}));
Textarea.displayName = "Textarea";
function stamp(partial) {
	return {
		id: crypto.randomUUID(),
		extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
		...partial
	};
}
var SAMPLE_PDS_TEXT = {
	macropoxy: `PRODUCT DATA SHEET — Macropoxy 646 Fast Cure
Manufacturer: Sherwin-Williams Protective & Marine
Generic Type: Polyamide epoxy, two-component
Service: Atmospheric and immersion (when specified) on structural steel
Revision: Typical published PDS (illustrative field extract)

STORAGE
Store indoors at 40°F–100°F (4°C–38°C). Keep containers tightly closed. Protect from freezing and direct sunlight. Rotate stock FIFO.

SHELF LIFE
24 months unopened at 77°F (25°C). Mixed pot life approximately 2 hours at 77°F; shorter in heat.

CREDENTIALS
Coatings applied by personnel trained in plural-component or two-component epoxies. Immersion and critical structural steel: NACE CIP Level 2 / AMPP CIP or SSPC PCI equivalent recommended for hold-point inspection. Surface preparation per SSPC/NACE standards.

SURFACE PREPARATION
Substrates: carbon steel, previously coated steel in sound condition.
Atmospheric: SSPC-SP6 / NACE No. 3 Commercial Blast. Immersion / severe: SSPC-SP10 / NACE No. 2 Near-White.
Anchor profile: 1.5–3.0 mils (38–75 µm). Remove oil, dust, weld spatter. Do not apply over chloride-contaminated steel. Surface must be dry and dust-free.

ENVIRONMENTAL CONDITIONS
Air and surface temperature: 35°F minimum (Fast Cure), 120°F maximum.
Surface must be at least 5°F (3°C) above the dew point.
Relative humidity: no stated maximum if dew-point spread is met; do not apply to wet or ice-covered surfaces.
Do not apply if rain, snow, or fog is imminent before the coating reaches a water-resistant state.
Wind: avoid overspray; typical stop work above 25 mph for spray.

MIXING
Two components, 1:1 by volume. Power mix each part, then combine and mix 2–3 minutes. No induction (sweat-in) required for Fast Cure. Thinning: up to 10% with specified reducer if allowed by VOC / job spec. Do not exceed pot life.

INSTALLATION
Airless spray, brush, or roller. Typical DFT 5–10 mils (125–250 µm) per coat. WFT approximately 7–14 mils depending on volume solids. Two coats common for atmospheric; follow specification for stripe coat on edges, welds, and corners. Coverage theoretically ~160–225 sq ft/gal at 5–7 mils DFT.

HOLD POINTS (ITP)
1. Material receipt — verify batch, shelf life, storage temp.
2. Surface preparation inspection — standard, profile, cleanliness.
3. Ambient / substrate / dew point log immediately before application.
4. Mix start time and ratio check.
5. Stripe coat on welds and edges (hold before full coat if specified).
6. WFT checks during application.
7. DFT survey after cure (SSPC-PA 2).
8. Holiday / pinhole test if immersion or lining.
9. Recoat window verification before next coat or topcoat.

INSPECTION
Visual, WFT gauge, DFT (SSPC-PA 2), adhesion (ASTM D3359 / D4541 as specified), holiday detection (NACE SP0188) for immersion. Record batch numbers, mix times, ambients, and film thickness.

CURE (Fast Cure, 77°F / 50% RH, typical)
Touch: ~2 hours. Handle: ~5 hours. Recoat minimum: ~3.5 hours. Recoat maximum: 14 days (abrade if exceeded). Full cure: 7 days. Immersion service: consult current PDS; typically 7–14 days depending on temperature.

SAFETY
Organic vapor respirator as required, chemical goggles, gloves, protective clothing. Provide ventilation. Flammable solvents in reducers. Consult SDS.
`,
	sikadur: `PRODUCT DATA SHEET — Sikadur-31 Hi-Mod Gel
Manufacturer: Sika Corporation
Generic Type: Two-component, 100% solids, moisture-tolerant structural epoxy adhesive / paste
Service: Structural bonding, grouting, bolt anchoring, concrete repair paste, steel-to-concrete
Revision: Typical published PDS (illustrative field extract)

STORAGE
Store dry at 40°F–90°F (4°C–32°C) in original unopened containers. Do not freeze. Condition material to 65°F–75°F before mixing for best workability.

SHELF LIFE
24 months in original unopened containers. Mixed gel working time approximately 30–45 minutes at 73°F; decreases sharply above 90°F.

CREDENTIALS
Installers experienced in structural epoxy adhesives. For fracture-critical or fracture-repair work, engineer-approved procedure and certified applicator as specified. ITP hold points by project QC.

SURFACE PREPARATION
Concrete: sound, clean, SSD or dry as specified; remove laitance (SSP, shotblast, or needle scale). Steel: SSPC-SP6 minimum, SP10 preferred; profile 2–3 mils. Bonding surfaces free of oil, curing compound, standing water. Substrate temperature 40°F minimum and 5°F above dew point.

ENVIRONMENTAL CONDITIONS
Minimum substrate / ambient: 40°F (4°C). Maximum: 95°F (35°C) typical.
Dew point: substrate ≥ 5°F above dew point.
Do not apply to frozen or frost-covered concrete.
Relative humidity: no hard cap; avoid condensation on steel.
Precipitation: protect fresh epoxy from rain until tack-free.

MIXING
Ratio 1:1 by volume (Part A : Part B). Mix until uniform gray, no streaks, ~3 minutes. Mix only what can be placed within pot life. Do not thin.

INSTALLATION
Trowel, gloved hand, or caulk-style for paste. Contact pressure for bonding. Typical bond-line 1/32–1/8 in. For anchoring, follow hole diameter / depth per engineer. Sequence: prep → dry-fit → mix → place → clamp/support → hold point.

HOLD POINTS
1. Material conditioning and shelf-life check.
2. Substrate soundness / prep inspection.
3. Ambient and substrate temperature / dew point.
4. Mix uniformity and start time.
5. Placement / bond-line inspection before close-up.
6. Cure before load (engineer).

INSPECTION
Visual mix uniformity, bond-line squeeze-out, sounding after cure, proof-load of anchors if specified. Record lot numbers and temperatures.

CURE at 73°F
Tack-free ~1–2 hours. Initial set ~2–3 hours. Ready for light load ~8–12 hours. Full mechanical ~3 days (faster in heat, much slower near 40°F).

SAFETY
Avoid skin contact (sensitizer). Gloves, eye protection, long sleeves. Ventilate. See SDS.
`,
	dymonic: `PRODUCT DATA SHEET — Dymonic 100
Manufacturer: Tremco
Generic Type: High-performance, high-movement, single-component, moisture-cure polyurethane sealant
Service: Expansion joints, perimeter caulking, precast, metal panel, windows — building envelope
Revision: Typical published PDS (illustrative field extract)

STORAGE
Store unopened cartridges / sausages at 40°F–110°F. Keep dry. Do not open until ready to gun.

SHELF LIFE
12 months from manufacture in unopened containers stored under recommended conditions.

CREDENTIALS
Installers trained in joint design (width/depth, backing rod). Manufacturer training recommended for warranty work. QC joint inspection before and after tool-off.

SURFACE PREPARATION
Substrates: concrete, masonry, aluminum, steel, glass (verify primer). Joints clean, dry, frost-free. Remove old sealant, laitance, form-release. Use closed-cell backer rod; bond breaker as required. Primer where PDS / adhesion test requires.

ENVIRONMENTAL CONDITIONS
Application temperature typically 40°F–120°F. Do not apply to wet or frozen substrates.
Avoid rain on uncured sealant. High humidity accelerates skinning (plan tooling time).
Dew point: substrate dry, no condensation.

MIXING
Single component. No mixing. Condition cartridges to 60°F–80°F for consistent gunning.

INSTALLATION
Gun in one continuous pass. Tool immediately. Typical joint: width ¼–1½ in per data; depth ½ of width, min ¼ in. Two-sided adhesion only. Sequence: clean → primer (if req, with open time) → backer rod → gun → tool → skin.

HOLD POINTS
1. Joint geometry / backer rod check.
2. Cleanliness and primer open-time.
3. Ambient / substrate temperature.
4. Adhesion test (field pull) as specified.
5. Tooling and profile inspection.
6. Cure before water test / coating over (if overcoating allowed).

INSPECTION
Visual continuity, adhesion field tests, joint factor (width/depth), photo documentation.

CURE
Skins in 2–4 hours at 75°F / 50% RH. Tack-free ~24 hours. Full cure ~7 days for typical joints (longer in cold / low RH; faster in heat / high RH).

SAFETY
Use in well-ventilated areas. Gloves and eye protection. Uncured polyurethane — avoid skin. SDS.
`
};
var SAMPLES = [
	{
		key: "macropoxy",
		title: "Macropoxy 646 Fast Cure",
		blurb: "Structural steel epoxy — blast, dew point, DFT hold points",
		card: () => stamp({
			confidence: "high",
			extractionNotes: ["Loaded from the built-in steel-epoxy sample. Confirm numbers against the current manufacturer PDS before use."],
			product: {
				name: "Macropoxy 646 Fast Cure",
				manufacturer: "Sherwin-Williams Protective & Marine",
				productType: "Two-component polyamide epoxy",
				systemRole: "Intermediate / finish on structural steel (atmospheric or specified immersion)",
				revision: "Sample extract — verify current PDS",
				documentDate: "",
				voc: "Check current PDS / local VOC table",
				mixRatio: "1:1 by volume",
				colors: ["Standard industrial catalog"],
				service: "Atmospheric; immersion when specified"
			},
			storage: {
				temperatureRange: "40–100°F (4–38°C)",
				conditions: [
					"Indoors",
					"Tightly closed",
					"Protect from freeze and direct sun",
					"FIFO"
				],
				notes: "Do not store on a hot deck or in an unconditioned conex in summer heat."
			},
			shelfLife: {
				unopened: "24 months at 77°F",
				opened: "Use promptly; reseal and mark date",
				mixedPotLife: "~2 hours at 77°F (shorter in heat)",
				notes: "Discard mixed material that has bodyed or exceeded pot life."
			},
			credentials: {
				required: [
					"Two-component epoxy trained applicators",
					"NACE/AMPP CIP or SSPC PCI for critical / immersion hold points",
					"SSPC-SP competent blasters"
				],
				notes: "Match inspector credentials to the specification, not the PDS minimum."
			},
			surfacePrep: {
				substrates: ["Carbon steel", "Sound existing coating (when overcoating is allowed)"],
				methods: ["SSPC-SP6 / NACE No. 3 commercial blast (atmospheric)", "SSPC-SP10 / NACE No. 2 near-white (immersion / severe)"],
				profile: "1.5–3.0 mils",
				cleanliness: "Dust-free, oil-free, chloride-free per spec",
				moisture: "Dry; no ice, no visible moisture",
				notes: "Stripe coat welds, corners, and edges. Do not paint over mill scale or rust bloom after blast."
			},
			environmentals: {
				ambientTempMinF: 35,
				ambientTempMaxF: 120,
				substrateTempMinF: 35,
				substrateTempMaxF: 120,
				relativeHumidityMax: null,
				relativeHumidityMin: null,
				dewPointSpreadMinF: 5,
				precipitationAllowed: false,
				windMaxMph: 25,
				directSunNotes: "Steel in sun can exceed air temp — measure the substrate.",
				notes: "Fast Cure minimum 35°F. No rain/snow/fog until water-resistant. RH is governed by dew-point spread.",
				additional: ["Stop for visible moisture on steel", "Log air, steel, RH, dew point at each setup"]
			},
			mixing: {
				components: "Part A + Part B",
				ratio: "1:1 by volume",
				inductionTime: "None (Fast Cure)",
				potLife: "~2 hours at 77°F",
				thinning: "Only with specified reducer; typically ≤10% and only if VOC / spec allows",
				notes: "Power mix each component, then combine 2–3 minutes. Clock pot life at combine."
			},
			installation: {
				methods: [
					"Airless spray",
					"Brush",
					"Roller"
				],
				filmThickness: "5–10 mils DFT per coat (≈7–14 mils WFT, confirm volume solids)",
				coverage: "~160–225 ft²/gal at 5–7 mils DFT (theoretical; waste extra)",
				numberOfCoats: "Typically 2 atmospheric + stripe; follow the spec",
				sequence: [
					"Verify storage and shelf life",
					"Blast / prep and hold",
					"Log ambients",
					"Stripe welds and edges",
					"Full coat to WFT",
					"Cure and DFT",
					"Recoat / topcoat inside window"
				],
				notes: "Hold spray in high wind to protect adjacent surfaces and film build."
			},
			holdPoints: [
				{
					step: 1,
					name: "Material receipt",
					criteria: "Batch / lot, shelf life, storage temperature in range",
					owner: "QC / warehouse",
					timing: "Before staging to the workface",
					source: "inferred"
				},
				{
					step: 2,
					name: "Surface preparation",
					criteria: "Specified SSPC/NACE standard, profile 1.5–3.0 mils, cleanliness",
					owner: "QC + blaster",
					timing: "Immediately after blast, before bloom",
					source: "stated"
				},
				{
					step: 3,
					name: "Ambient / dew point",
					criteria: "Air and steel ≥35°F and ≤120°F; steel ≥5°F above dew point; no rain",
					owner: "Applicator + QC",
					timing: "Immediately before mix and every 4 hours / weather change",
					source: "stated"
				},
				{
					step: 4,
					name: "Mix & pot life",
					criteria: "1:1 by volume, start time marked, no exceeded pot life",
					owner: "Applicator",
					timing: "At combine",
					source: "stated"
				},
				{
					step: 5,
					name: "Stripe coat",
					criteria: "Welds, corners, edges, bolts stripe-coated",
					owner: "QC",
					timing: "Before or as specified with full coat",
					source: "inferred"
				},
				{
					step: 6,
					name: "WFT during apply",
					criteria: "WFT in range for target DFT",
					owner: "Applicator / QC",
					timing: "Continuous during application",
					source: "stated"
				},
				{
					step: 7,
					name: "DFT survey",
					criteria: "SSPC-PA 2 frequency and range",
					owner: "QC / third party",
					timing: "After dry-to-handle",
					source: "stated"
				},
				{
					step: 8,
					name: "Holiday test",
					criteria: "NACE SP0188 if immersion / lining",
					owner: "QC",
					timing: "After full cure of lining coats",
					source: "stated"
				},
				{
					step: 9,
					name: "Recoat window",
					criteria: "Min ~3.5 h at 77°F; max 14 days or abrade",
					owner: "QC",
					timing: "Before next coat or topcoat",
					source: "stated"
				}
			],
			inspection: {
				methods: [
					"Visual",
					"WFT gauge",
					"DFT (SSPC-PA 2)",
					"Adhesion ASTM D3359 / D4541 as specified",
					"Holiday NACE SP0188 (immersion)"
				],
				acceptance: [
					"DFT within spec range",
					"No holidays on linings",
					"No rust bloom, sags, or dry spray",
					"Ambients logged in range"
				],
				documentation: "Batch numbers, mix times, air/steel/RH/dew point, WFT/DFT, inspector, hold-point sign-off"
			},
			cure: {
				touch: "~2 hours at 77°F",
				handle: "~5 hours at 77°F",
				recoatMin: "~3.5 hours at 77°F",
				recoatMax: "14 days at 77°F (abrade if exceeded)",
				fullCure: "7 days at 77°F",
				immersionService: "Typically 7–14 days — confirm current PDS and spec",
				temperatureDependence: "Cold extends every clock; heat shortens pot life and recoat min"
			},
			safety: {
				ppe: [
					"Chemical goggles",
					"Solvent-resistant gloves",
					"Protective clothing",
					"Organic vapor respirator as required"
				],
				ventilation: "Required for confined space and indoor spray",
				hazards: [
					"Solvent vapors",
					"Skin sensitizer",
					"Reducer flammability"
				]
			}
		})
	},
	{
		key: "sikadur",
		title: "Sikadur-31 Hi-Mod Gel",
		blurb: "Structural epoxy paste — concrete/steel bond, 40°F floor",
		card: () => stamp({
			confidence: "high",
			extractionNotes: ["Loaded from the built-in structural-adhesive sample. Confirm against the current Sika PDS."],
			product: {
				name: "Sikadur-31 Hi-Mod Gel",
				manufacturer: "Sika Corporation",
				productType: "Two-component 100% solids structural epoxy paste",
				systemRole: "Bonding, grouting, anchoring, concrete repair paste",
				revision: "Sample extract — verify current PDS",
				documentDate: "",
				voc: "100% solids — confirm current PDS",
				mixRatio: "1:1 by volume",
				colors: ["Gray when mixed"],
				service: "Structural bond / repair"
			},
			storage: {
				temperatureRange: "40–90°F (4–32°C)",
				conditions: [
					"Dry",
					"Original containers",
					"Do not freeze",
					"Condition to 65–75°F before mix"
				],
				notes: "Cold material is stiff; overheated material has a short pot life."
			},
			shelfLife: {
				unopened: "24 months original unopened",
				opened: "Not for partial long-term storage once contaminated",
				mixedPotLife: "30–45 minutes at 73°F",
				notes: "Mix only a workable quantity."
			},
			credentials: {
				required: ["Structural epoxy experience", "Engineer-approved procedure for fracture-critical work"],
				notes: "Project QC / PE defines load-before-cure."
			},
			surfacePrep: {
				substrates: ["Sound concrete", "Carbon steel"],
				methods: ["Remove laitance (shotblast / needle scale)", "Steel SSPC-SP6 min, SP10 preferred"],
				profile: "Steel 2–3 mils; concrete ICRI CSP per spec",
				cleanliness: "Oil-free, curing-compound-free, no standing water",
				moisture: "SSD or dry per spec; no frost",
				notes: "Bonding to unsound concrete will fail the epoxy, not the spec."
			},
			environmentals: {
				ambientTempMinF: 40,
				ambientTempMaxF: 95,
				substrateTempMinF: 40,
				substrateTempMaxF: 95,
				relativeHumidityMax: null,
				relativeHumidityMin: null,
				dewPointSpreadMinF: 5,
				precipitationAllowed: false,
				windMaxMph: null,
				directSunNotes: "Shade dark steel and bags in summer; condition kits.",
				notes: "Do not place on frozen concrete. Protect from rain until tack-free.",
				additional: []
			},
			mixing: {
				components: "Part A + Part B",
				ratio: "1:1 by volume",
				inductionTime: "None",
				potLife: "30–45 min at 73°F",
				thinning: "Do not thin",
				notes: "Mix to uniform gray, no streaks, ~3 minutes."
			},
			installation: {
				methods: [
					"Trowel",
					"Gloved hand",
					"Cartridge / bulk gun"
				],
				filmThickness: "Bond line typically 1/32–1/8 in",
				coverage: "Depends on bond-line and geometry",
				numberOfCoats: "Single placement",
				sequence: [
					"Prep and dry-fit",
					"Log temps",
					"Mix",
					"Place",
					"Clamp / support",
					"Hold for cure"
				],
				notes: "Contact pressure required for structural bond."
			},
			holdPoints: [
				{
					step: 1,
					name: "Conditioning & shelf life",
					criteria: "Kits 65–75°F, unexpired",
					owner: "QC",
					timing: "Before mix",
					source: "stated"
				},
				{
					step: 2,
					name: "Substrate soundness",
					criteria: "Prep complete, no unsound concrete, steel profile",
					owner: "QC",
					timing: "Before mix",
					source: "stated"
				},
				{
					step: 3,
					name: "Ambient / dew point",
					criteria: "≥40°F, ≤95°F, steel ≥5°F above dew point",
					owner: "Applicator + QC",
					timing: "Immediately before mix",
					source: "stated"
				},
				{
					step: 4,
					name: "Mix uniformity",
					criteria: "Uniform gray, start time, quantity vs pot life",
					owner: "Applicator",
					timing: "At mix",
					source: "stated"
				},
				{
					step: 5,
					name: "Bond-line / placement",
					criteria: "Full contact, squeeze-out, support",
					owner: "QC",
					timing: "Before close-up",
					source: "inferred"
				},
				{
					step: 6,
					name: "Cure before load",
					criteria: "Engineer / PDS clock met",
					owner: "PE / QC",
					timing: "Before putting into service",
					source: "stated"
				}
			],
			inspection: {
				methods: [
					"Visual mix",
					"Bond-line squeeze-out",
					"Sounding after cure",
					"Proof load of anchors if specified"
				],
				acceptance: [
					"No unmixed streaks",
					"Full contact",
					"No frost/wet placement",
					"Cure clock completed"
				],
				documentation: "Lot numbers, substrate temps, mix time, PE hold if structural"
			},
			cure: {
				touch: "Tack-free ~1–2 hours at 73°F",
				handle: "Initial set ~2–3 hours",
				recoatMin: "N/A (single placement)",
				recoatMax: "N/A",
				fullCure: "~3 days at 73°F for full mechanical",
				immersionService: "N/A unless specified",
				temperatureDependence: "Near 40°F cure is much slower; heat cuts pot life"
			},
			safety: {
				ppe: [
					"Gloves",
					"Eye protection",
					"Long sleeves"
				],
				ventilation: "Avoid confined unventilated mix",
				hazards: ["Skin sensitizer", "Do not ingest"]
			}
		})
	},
	{
		key: "dymonic",
		title: "Dymonic 100",
		blurb: "PU joint sealant — gun, tool, humidity-aware cure",
		card: () => stamp({
			confidence: "high",
			extractionNotes: ["Loaded from the built-in sealant sample. Confirm against the current Tremco PDS."],
			product: {
				name: "Dymonic 100",
				manufacturer: "Tremco",
				productType: "Single-component moisture-cure polyurethane sealant",
				systemRole: "Expansion and perimeter joints, envelope",
				revision: "Sample extract — verify current PDS",
				documentDate: "",
				voc: "Check current PDS / SCAQMD table",
				mixRatio: "Single component",
				colors: ["Architectural catalog"],
				service: "Building envelope / joints"
			},
			storage: {
				temperatureRange: "40–110°F",
				conditions: ["Unopened cartridges / sausages", "Dry"],
				notes: "Do not open until gunning."
			},
			shelfLife: {
				unopened: "12 months from manufacture, unopened",
				opened: "Use opened sausages the same shift",
				mixedPotLife: "N/A (skins in the nozzle)",
				notes: "Expired material skins in the tube — discard."
			},
			credentials: {
				required: ["Joint-design trained installers", "Manufacturer training for warranted work"],
				notes: "Field adhesion tests as specified."
			},
			surfacePrep: {
				substrates: [
					"Concrete",
					"Masonry",
					"Aluminum",
					"Steel",
					"Glass (verify)"
				],
				methods: [
					"Clean, dry, frost-free",
					"Remove failed sealant",
					"Primer where PDS / test requires"
				],
				profile: "Joint factor: depth ≈ ½ width, min ¼ in",
				cleanliness: "No dust, form-release, or standing water",
				moisture: "Dry substrate",
				notes: "Closed-cell backer rod; two-sided adhesion only."
			},
			environmentals: {
				ambientTempMinF: 40,
				ambientTempMaxF: 120,
				substrateTempMinF: 40,
				substrateTempMaxF: 120,
				relativeHumidityMax: null,
				relativeHumidityMin: null,
				dewPointSpreadMinF: 5,
				precipitationAllowed: false,
				windMaxMph: null,
				directSunNotes: "Hot dark substrates skin faster — tool immediately.",
				notes: "High RH skins faster. No rain on uncured sealant. No condensation.",
				additional: []
			},
			mixing: {
				components: "Single component",
				ratio: "N/A",
				inductionTime: "None",
				potLife: "Tooling time shortens in heat / high RH",
				thinning: "Do not thin",
				notes: "Condition cartridges to 60–80°F."
			},
			installation: {
				methods: ["Gun", "Immediate tooling"],
				filmThickness: "Joint depth per design (min ¼ in)",
				coverage: "Depends on joint width × depth",
				numberOfCoats: "Single pass",
				sequence: [
					"Clean",
					"Primer + open time",
					"Backer rod",
					"Gun continuous",
					"Tool",
					"Skin"
				],
				notes: "One continuous bead; tool off to hourglass profile."
			},
			holdPoints: [
				{
					step: 1,
					name: "Joint geometry",
					criteria: "Width/depth, backer rod, bond breaker",
					owner: "QC",
					timing: "Before gunning",
					source: "stated"
				},
				{
					step: 2,
					name: "Cleanliness / primer",
					criteria: "Dry, primed, inside primer open time",
					owner: "Applicator + QC",
					timing: "Before gunning",
					source: "stated"
				},
				{
					step: 3,
					name: "Ambient",
					criteria: "40–120°F, dry substrate, no rain",
					owner: "Applicator",
					timing: "Before gunning",
					source: "stated"
				},
				{
					step: 4,
					name: "Field adhesion",
					criteria: "Pull test as specified",
					owner: "QC",
					timing: "After cure of test joints",
					source: "stated"
				},
				{
					step: 5,
					name: "Profile / continuity",
					criteria: "Tooled, no voids, two-sided adhesion only",
					owner: "QC",
					timing: "After tool-off",
					source: "inferred"
				}
			],
			inspection: {
				methods: [
					"Visual continuity",
					"Joint factor check",
					"Field adhesion pull",
					"Photos"
				],
				acceptance: [
					"Continuous tooled joint",
					"Adhesion pass",
					"Correct backer"
				],
				documentation: "Lot, joint ID, ambients, primer used, adhesion results"
			},
			cure: {
				touch: "Skins 2–4 hours at 75°F / 50% RH",
				handle: "Tack-free ~24 hours",
				recoatMin: "Only if overcoating is allowed — confirm PDS",
				recoatMax: "Confirm PDS",
				fullCure: "~7 days typical joint",
				immersionService: "Not a tank lining",
				temperatureDependence: "Cold / dry slows; heat / humid skins fast"
			},
			safety: {
				ppe: ["Gloves", "Eye protection"],
				ventilation: "Well-ventilated areas",
				hazards: ["Uncured polyurethane — skin irritant"]
			}
		})
	}
];
async function extractPdfText(file) {
	const pdfjs = await import("../_libs/pdfjs-dist.mjs").then((n) => n.t);
	const workerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
	pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
	const data = await file.arrayBuffer();
	const doc = await pdfjs.getDocument({ data }).promise;
	const max = Math.min(doc.numPages, 12);
	const chunks = [];
	for (let i = 1; i <= max; i += 1) {
		const line = (await (await doc.getPage(i)).getTextContent()).items.map((item) => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ").trim();
		if (line) chunks.push(line);
	}
	return chunks.join("\n\n");
}
function PdsIntake({ text, onText, onExtract, onSample, loading, recents, onOpenRecent }) {
	const fileRef = (0, import_react.useRef)(null);
	const [fileNote, setFileNote] = (0, import_react.useState)(null);
	async function onFile(file) {
		if (!file) return;
		setFileNote(null);
		if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
			try {
				const extracted = await extractPdfText(file);
				if (extracted.replace(/\s/g, "").length < 80) {
					setFileNote("This PDF has little extractable text (likely scanned). Paste the PDS text instead.");
					return;
				}
				onText(extracted);
				setFileNote(`Loaded ${file.name} (${extracted.length.toLocaleString()} characters).`);
			} catch {
				setFileNote("Could not read that PDF. Paste the text instead.");
			}
			return;
		}
		onText(await file.text());
		setFileNote(`Loaded ${file.name}.`);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "pds",
					children: "Product data sheet"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted",
					children: "Paste the PDS, or drop a PDF. Samples skip the wait."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						ref: fileRef,
						type: "file",
						accept: ".pdf,.txt,.md,application/pdf,text/plain",
						className: "sr-only",
						onChange: (e) => void onFile(e.target.files?.[0])
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						variant: "outline",
						size: "sm",
						onClick: () => fileRef.current?.click(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, {}), "PDF / text"]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
				id: "pds",
				value: text,
				onChange: (e) => onText(e.target.value),
				placeholder: "Paste the full PDS here — storage, ambients, dew point, mix, DFT, recoat, credentials…",
				className: "mt-3 min-h-44 font-mono text-[13px] leading-relaxed"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: fileNote ?? `${text.length.toLocaleString()} / 40,000` }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					onClick: onExtract,
					disabled: loading || text.trim().length < 40,
					children: [loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, {}), "Build job card"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] font-medium uppercase tracking-[0.16em] text-muted",
					children: "Sample products"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2 grid gap-2 sm:grid-cols-3",
					children: SAMPLES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: cn("rounded-lg bg-surface-2 px-3 py-3 text-left shadow-[0_0_0_1px_rgba(255,255,255,0.06)]", "transition-[background-color,box-shadow,transform] duration-150 ease-out hover:shadow-[0_0_0_1px_rgba(232,93,4,0.55)] active:scale-[0.98]"),
						onClick: () => onSample(s.card(), SAMPLE_PDS_TEXT[s.key] ?? ""),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block text-sm font-medium text-fg",
							children: s.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-1 block text-xs text-muted",
							children: s.blurb
						})]
					}, s.key))
				})]
			}),
			recents.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] font-medium uppercase tracking-[0.16em] text-muted",
					children: "Recent cards"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-2 divide-y divide-border",
					children: recents.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm hover:text-accent",
						onClick: () => onOpenRecent(r.card),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "truncate",
							children: r.card.product.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "shrink-0 font-mono text-xs text-muted",
							children: r.zip || "—"
						})]
					}) }, r.id))
				})]
			}) : null
		]
	});
}
var selectClass = "flex h-11 w-full rounded-md bg-surface-2 px-3 text-sm text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition-[box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40";
function statusVariant(s) {
	if (s === "go" || s === "caution" || s === "nogo") return s;
	return "default";
}
function statusFill(s) {
	if (s === "go") return "bg-go";
	if (s === "caution") return "bg-caution";
	if (s === "nogo") return "bg-nogo";
	return "bg-subtle";
}
function HourStrip({ hours, night }) {
	const usable = night ? hours : hours.filter((h) => h.hour >= 5 && h.hour <= 20);
	const [tip, setTip] = (0, import_react.useState)(null);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex h-7 overflow-hidden rounded-sm",
				children: usable.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					title: `${String(h.hour).padStart(2, "0")}:00 · ${h.status} · ${h.reasons[0] ?? ""}`,
					className: cn("hour-cell min-w-0 flex-1", statusFill(h.status)),
					onMouseEnter: () => setTip(h),
					onFocus: () => setTip(h),
					onMouseLeave: () => setTip(null),
					onBlur: () => setTip(null),
					"aria-label": `${h.hour}:00 ${h.status}`
				}, h.startIso))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-1 flex justify-between font-mono text-xs text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: night ? "00" : "05" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "12" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: night ? "23" : "20" })
				]
			}),
			tip ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 font-mono text-xs text-fg",
				children: [
					String(tip.hour).padStart(2, "0"),
					":00 · air ",
					tip.tempF ?? "—",
					"°F",
					tip.substrateF != null ? ` · sub ${tip.substrateF}°F` : "",
					tip.rh != null ? ` · ${tip.rh}% RH` : "",
					" · ",
					tip.reasons[0]
				]
			}) : null
		]
	});
}
function DayCard({ day, night }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "rounded-lg bg-surface-2 p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-medium uppercase tracking-wide text-muted",
					children: day.weekday
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-sm text-fg",
					children: day.dateLabel
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					variant: statusVariant(day.status),
					children: day.status
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 font-mono text-sm text-fg",
				children: day.bestRange ?? "No window"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-0.5 text-xs text-muted",
				children: [
					day.goHours,
					"h go · ",
					day.cautionHours,
					"h caution"
				]
			}),
			day.limiting[0] ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 line-clamp-2 text-xs text-muted",
				children: day.limiting[0]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HourStrip, {
					hours: day.hours,
					night
				})
			})
		]
	});
}
function numOrNull(v) {
	if (v.trim() === "") return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}
function Limit({ label, value, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "block",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-xs font-medium text-muted",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
			inputMode: "decimal",
			className: "mt-1 h-9 font-mono",
			value: value ?? "",
			onChange: (e) => onChange(numOrNull(e.target.value))
		})]
	});
}
function WeatherPanel({ zip, onZip, forecast, loading, error, onLoad, disabled, environmentals, onEnvironmentals, site, onSite }) {
	const days = forecast?.days ?? [];
	const night = site.mitigations.includes("night_shift");
	const sub = substrateById(site.substrate);
	const example = peakExample(site.substrate, 80);
	const available = compatibleMitigations({
		substrate: site.substrate,
		moistureTolerant: site.moistureTolerant,
		discipline: site.discipline
	});
	const limiters = (0, import_react.useMemo)(() => {
		if (!forecast || !environmentals) return [];
		return detectLimiters(forecast, environmentals, {
			...site,
			mitigations: []
		});
	}, [
		forecast,
		environmentals,
		site.substrate,
		site.discipline
	]);
	const recommendedIds = (0, import_react.useMemo)(() => {
		return available.filter((m) => {
			if (site.mitigations.includes(m.id)) return false;
			const unlocks = forecast && environmentals ? unlockedGoHours(forecast, environmentals, {
				...site,
				mitigations: [...site.mitigations, m.id]
			}) : 0;
			return isRecommended(m, {
				substrate: site.substrate,
				discipline: site.discipline,
				limiters,
				unlocksHours: unlocks
			});
		}).map((m) => m.id);
	}, [
		available,
		forecast,
		environmentals,
		site,
		limiters
	]);
	const summary = (0, import_react.useMemo)(() => {
		if (!forecast) return null;
		return {
			go: days.filter((d) => d.status === "go").length,
			total: days.length
		};
	}, [forecast, days]);
	function addMitigation(id) {
		const def = mitigationById(id);
		const next = site.mitigations.filter((m) => !def?.conflicts?.includes(m) && m !== id);
		next.push(id);
		onSite({
			...site,
			mitigations: next
		});
	}
	function hoursGained(id) {
		if (!forecast || !environmentals) return null;
		const withIt = {
			...site,
			mitigations: [.../* @__PURE__ */ new Set([...site.mitigations, id])]
		};
		return unlockedGoHours(forecast, environmentals, withIt) - unlockedGoHours(forecast, environmentals, site);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
		className: "flex flex-col gap-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 text-accent",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CloudSun, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-semibold uppercase tracking-wide",
						children: "NOAA application windows"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: "Score air, estimated substrate temperature in sun, RH, dew-point spread, wind, and rain. Pick the real substrate and the mitigations you will actually field."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex flex-col gap-3 sm:flex-row sm:items-end",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "zip",
							children: "Job-site ZIP"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative mt-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "zip",
								inputMode: "numeric",
								maxLength: 5,
								placeholder: "22202",
								className: "pl-9 font-mono tracking-widest",
								value: zip,
								onChange: (e) => onZip(e.target.value.replace(/\D/g, "").slice(0, 5)),
								onKeyDown: (e) => {
									if (e.key === "Enter") onLoad();
								}
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						variant: "secondary",
						onClick: onLoad,
						disabled: disabled || loading || zip.length !== 5,
						children: [loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "animate-spin" }) : null, "Load windows"]
					})]
				}),
				error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm text-nogo",
					children: error
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-5 border-t border-border pt-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium uppercase tracking-wide text-muted",
							children: "Substrate"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							id: "substrate",
							className: cn(selectClass, "mt-2"),
							value: site.substrate,
							onChange: (e) => onSite({
								...site,
								substrate: e.target.value,
								mitigations: site.mitigations.filter((id) => {
									const m = mitigationById(id);
									const next = substrateById(e.target.value);
									return !(m?.metalOnly && !next.metal);
								})
							}),
							children: SUBSTRATES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: s.id,
								children: s.label
							}, s.id))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-xs leading-relaxed text-muted",
							children: [
								sub.note,
								" On a sunny ",
								example.airF,
								"°F afternoon this face estimates about",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-mono text-fg",
									children: [example.substrateF, "°F"]
								}),
								example.gain ? ` (+${example.gain}° solar)` : "",
								".",
								environmentals?.substrateTempMaxF != null && example.substrateF > environmentals.substrateTempMaxF ? ` That is above the ${environmentals.substrateTempMaxF}°F PDS max without shade or a night shift.` : ""
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-baseline justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "mitigation",
								children: "Mitigation strategy"
							}), site.bodies?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs text-muted",
								children: [
									site.discipline ?? "coatings",
									" · ",
									site.bodies.join(" · ")
								]
							}) : null]
						}),
						recommendedIds.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs font-medium text-go-soft",
									children: "Recommended this week"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "mt-1.5 flex flex-wrap gap-2",
									children: recommendedIds.map((id) => {
										const m = mitigationById(id);
										const gained = hoursGained(id);
										return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											className: "inline-flex h-9 items-center gap-1.5 rounded-md bg-go/20 px-2.5 text-xs font-medium text-go-soft shadow-[0_0_0_1px_rgba(63,125,92,0.65)]",
											onClick: () => addMitigation(id),
											children: [m?.label ?? id, gained && gained > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "font-mono opacity-80",
												children: [
													"+",
													gained,
													"h"
												]
											}) : null]
										}) }, id);
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-xs leading-relaxed text-muted",
									children: recommendedIds.map((id) => mitigationById(id)?.citation).filter(Boolean).slice(0, 2).join(" ")
								})
							]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							id: "mitigation",
							className: cn(selectClass, "mt-2"),
							value: "",
							disabled,
							onChange: (e) => {
								const id = e.target.value;
								if (id) addMitigation(id);
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "",
								children: "Add a compatible mitigation…"
							}), available.slice().sort((a, b) => Number(recommendedIds.includes(b.id)) - Number(recommendedIds.includes(a.id))).map((m) => {
								const selected = site.mitigations.includes(m.id);
								const conflicted = m.conflicts?.some((c) => site.mitigations.includes(c));
								const rec = recommendedIds.includes(m.id);
								const gained = selected ? 0 : hoursGained(m.id);
								const extra = selected ? " · on" : conflicted ? " · conflicts" : rec ? gained && gained > 0 ? ` · recommended · +${gained}h` : " · recommended" : gained && gained > 0 ? ` · +${gained}h this week` : "";
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
									value: m.id,
									disabled: selected || conflicted,
									children: [
										rec ? "● " : "",
										m.label,
										extra
									]
								}, m.id);
							})]
						}),
						site.mitigations.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-2 flex flex-wrap gap-2",
							children: site.mitigations.map((id) => {
								const m = mitigationById(id);
								const rec = m && isRecommended(m, {
									substrate: site.substrate,
									discipline: site.discipline,
									limiters,
									unlocksHours: 1
								});
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: cn("inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs", rec ? "bg-go/20 font-medium text-go-soft shadow-[0_0_0_1px_rgba(63,125,92,0.65)]" : "bg-surface-2 text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"),
									onClick: () => onSite({
										...site,
										mitigations: site.mitigations.filter((x) => x !== id)
									}),
									children: [m?.label ?? id, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: cn("size-3.5", rec ? "text-go-soft" : "text-muted") })]
								}) }, id);
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 space-y-1",
							children: site.mitigations.map((id) => {
								const m = mitigationById(id);
								return m ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-xs text-muted",
									children: [
										m.summary,
										" ",
										m.citation
									]
								}, `${id}-note`) : null;
							})
						})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-xs text-muted",
							children: "None selected — calendar is unmitigated field conditions."
						}),
						forecast && environmentals && site.mitigations.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 font-mono text-xs text-accent",
							children: [
								unlockedGoHours(forecast, environmentals, site),
								"h reopened from no-go",
								" · ",
								goHourCount(forecast, environmentals, site),
								"h go this week"
							]
						}) : null
					]
				}),
				environmentals && onEnvironmentals ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-5 border-t border-border pt-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-medium uppercase tracking-wide text-muted",
						children: "Window limits (editable)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Limit, {
								label: "Air min °F",
								value: environmentals.ambientTempMinF,
								onChange: (n) => onEnvironmentals({
									...environmentals,
									ambientTempMinF: n
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Limit, {
								label: "Air max °F",
								value: environmentals.ambientTempMaxF,
								onChange: (n) => onEnvironmentals({
									...environmentals,
									ambientTempMaxF: n
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Limit, {
								label: "Substrate max °F",
								value: environmentals.substrateTempMaxF,
								onChange: (n) => onEnvironmentals({
									...environmentals,
									substrateTempMaxF: n
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Limit, {
								label: "Dew spread °F",
								value: environmentals.dewPointSpreadMinF,
								onChange: (n) => onEnvironmentals({
									...environmentals,
									dewPointSpreadMinF: n
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Limit, {
								label: "RH max %",
								value: environmentals.relativeHumidityMax,
								onChange: (n) => onEnvironmentals({
									...environmentals,
									relativeHumidityMax: n
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Limit, {
								label: "Wind max mph",
								value: environmentals.windMaxMph,
								onChange: (n) => onEnvironmentals({
									...environmentals,
									windMaxMph: n
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex items-end gap-2 pb-1 text-sm text-fg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "checkbox",
									className: "size-4 accent-go",
									checked: !environmentals.precipitationAllowed,
									onChange: (e) => onEnvironmentals({
										...environmentals,
										precipitationAllowed: !e.target.checked
									})
								}), "Dry only"]
							})
						]
					})]
				}) : null
			]
		}), forecast ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rise-in space-y-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-base font-medium leading-snug text-fg",
						children: forecast.headline
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-xs text-muted",
						children: [
							forecast.city,
							", ",
							forecast.state,
							" · ",
							forecast.source,
							summary ? ` · ${summary.go}/${summary.total} go-days` : "",
							` · ${sub.label}`
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs leading-relaxed text-muted",
						children: "Model call only. Confirm air, substrate, RH, dew point, and wind at the workface before you mix — the slider below opens or hardens this week when the model disagrees with a human inspector."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-wrap gap-3 text-xs text-muted",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "inline-flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "size-2.5 rounded-sm bg-go" }), " Go"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "inline-flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "size-2.5 rounded-sm bg-caution" }), " Caution"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "inline-flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "size-2.5 rounded-sm bg-nogo" }), " No-go"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: night ? "Strip is 00:00–23:00 (night shift)" : "Strip is 05:00–20:00 local" })
						]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-3 sm:grid-cols-2",
				children: days.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DayCard, {
					day: d,
					night
				}, d.date))
			})]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "rounded-xl bg-surface px-4 py-8 text-center shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Build a card, then load a ZIP. Mitigations will reopen days the sun would kill."
			})
		})]
	});
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var extractPds = createServerFn({ method: "POST" }).validator((input) => {
	const text = (input?.text ?? "").trim();
	if (text.length < 40) throw new Error("PDS text is too short.");
	if (text.length > 4e4) throw new Error("PDS text exceeds 40,000 characters.");
	return { text: text.slice(0, 24e3) };
}).handler(createSsrRpc("a1bccce983c3465caaf01eba3c27c8b93bb9183ed308a2efa75abbde3fc0552d"));
var loadForecast = createServerFn({ method: "POST" }).validator((input) => {
	const zip = (input?.zip ?? "").replace(/\D/g, "").slice(0, 5);
	if (zip.length !== 5) throw new Error("Enter a 5-digit US ZIP.");
	return {
		zip,
		environmentals: input.environmentals
	};
}).handler(createSsrRpc("dd0ffdd043195dddbd4cbc41ec11e49f69e12dfaf5d4c9ae5ca40747acb4b9d9"));
function wrap(doc, text, maxWidth) {
	const t = (text || "—").replace(/\s+/g, " ").trim();
	return doc.splitTextToSize(t, maxWidth);
}
function join(items, fallback = "—") {
	const list = (items ?? []).map((s) => s.trim()).filter(Boolean);
	return list.length ? list.join(" · ") : fallback;
}
async function downloadFieldCard(card, forecast, site) {
	const { jsPDF } = await import("../_libs/jspdf.mjs").then((n) => /* @__PURE__ */ __toESM(n.t()));
	const doc = new jsPDF({
		unit: "pt",
		format: "letter",
		orientation: "portrait"
	});
	const pageW = doc.internal.pageSize.getWidth();
	const margin = 36;
	const width = pageW - 72;
	const ink = {
		r: 22,
		g: 24,
		b: 28
	};
	const muted = {
		r: 92,
		g: 97,
		b: 104
	};
	const rail = {
		r: 196,
		g: 69,
		b: 10
	};
	const rule = {
		r: 210,
		g: 204,
		b: 192
	};
	const paper = {
		r: 243,
		g: 239,
		b: 230
	};
	doc.setFillColor(paper.r, paper.g, paper.b);
	doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), "F");
	doc.setFillColor(rail.r, rail.g, rail.b);
	doc.rect(0, 0, 14, doc.internal.pageSize.getHeight(), "F");
	let y = 44;
	doc.setTextColor(rail.r, rail.g, rail.b);
	doc.setFont("helvetica", "bold");
	doc.setFontSize(9);
	doc.text("COATINGS CONDUCTOR  ·  FIELD CARD", margin, y);
	doc.setTextColor(muted.r, muted.g, muted.b);
	doc.setFont("helvetica", "normal");
	doc.setFontSize(8);
	doc.text(card.product.revision || "Verify against current PDS", pageW - margin, y, { align: "right" });
	y += 22;
	doc.setTextColor(ink.r, ink.g, ink.b);
	doc.setFont("helvetica", "bold");
	doc.setFontSize(18);
	const nameLines = wrap(doc, card.product.name || "Unnamed product", width);
	doc.text(nameLines, margin, y);
	y += nameLines.length * 20 + 4;
	doc.setFont("helvetica", "normal");
	doc.setFontSize(10);
	doc.setTextColor(muted.r, muted.g, muted.b);
	const sub = [
		card.product.manufacturer,
		card.product.productType,
		card.product.service
	].filter(Boolean).join("  ·  ");
	doc.text(wrap(doc, sub || "—", width), margin, y);
	y += 18;
	doc.setDrawColor(rail.r, rail.g, rail.b);
	doc.setLineWidth(1.2);
	doc.line(margin, y, pageW - margin, y);
	y += 16;
	const env = card.environmentals;
	const envBits = [
		env.ambientTempMinF != null || env.ambientTempMaxF != null ? `Air ${env.ambientTempMinF ?? "—"}–${env.ambientTempMaxF ?? "—"}°F` : "",
		env.substrateTempMinF != null || env.substrateTempMaxF != null ? `Substrate ${env.substrateTempMinF ?? "—"}–${env.substrateTempMaxF ?? "—"}°F` : "",
		env.dewPointSpreadMinF != null ? `Dew spread ≥ ${env.dewPointSpreadMinF}°F` : "",
		env.relativeHumidityMax != null ? `RH ≤ ${env.relativeHumidityMax}%` : "",
		env.precipitationAllowed === false ? "No precip" : "",
		env.windMaxMph != null ? `Wind ≤ ${env.windMaxMph} mph` : ""
	].filter(Boolean).join("  ·  ");
	const rows = [
		{
			n: "01",
			title: "STORE",
			body: [
				card.storage.temperatureRange,
				join(card.storage.conditions, ""),
				card.storage.notes,
				`Shelf unopened: ${card.shelfLife.unopened || "—"}`,
				card.shelfLife.notes
			].filter(Boolean).join(" — ")
		},
		{
			n: "02",
			title: "QUALIFY",
			body: [join(card.credentials.required), card.credentials.notes].filter(Boolean).join(" — ")
		},
		{
			n: "03",
			title: "PREP",
			body: [
				join(card.surfacePrep.substrates),
				join(card.surfacePrep.methods),
				card.surfacePrep.profile ? `Profile ${card.surfacePrep.profile}` : "",
				card.surfacePrep.cleanliness,
				card.surfacePrep.moisture,
				card.surfacePrep.notes
			].filter(Boolean).join(" — ")
		},
		{
			n: "04",
			title: "AMBIENT",
			body: [
				envBits,
				env.notes,
				env.directSunNotes,
				...env.additional ?? []
			].filter(Boolean).join(" — ")
		},
		{
			n: "05",
			title: "MIX",
			body: [
				card.mixing.components,
				card.mixing.ratio ? `Ratio ${card.mixing.ratio}` : "",
				card.mixing.inductionTime ? `Induction ${card.mixing.inductionTime}` : "",
				card.mixing.potLife ? `Pot life ${card.mixing.potLife}` : "",
				card.mixing.thinning,
				`Mixed life ${card.shelfLife.mixedPotLife || "—"}`,
				card.mixing.notes
			].filter(Boolean).join(" — ")
		},
		{
			n: "06",
			title: "APPLY",
			body: [
				join(card.installation.methods),
				card.installation.filmThickness,
				card.installation.coverage,
				card.installation.numberOfCoats,
				join(card.installation.sequence, ""),
				card.installation.notes
			].filter(Boolean).join(" — ")
		},
		{
			n: "07",
			title: "HOLD",
			body: card.holdPoints.map((h) => `${h.step}. ${h.name} — ${h.criteria} (${h.owner}; ${h.timing}${h.source === "inferred" ? "; inferred" : ""})`).join("  |  ")
		},
		{
			n: "08",
			title: "INSPECT",
			body: [
				join(card.inspection.methods),
				join(card.inspection.acceptance, ""),
				card.inspection.documentation
			].filter(Boolean).join(" — ")
		},
		{
			n: "09",
			title: "CURE",
			body: [
				card.cure.touch ? `Touch ${card.cure.touch}` : "",
				card.cure.handle ? `Handle ${card.cure.handle}` : "",
				card.cure.recoatMin ? `Recoat min ${card.cure.recoatMin}` : "",
				card.cure.recoatMax ? `Recoat max ${card.cure.recoatMax}` : "",
				card.cure.fullCure ? `Full ${card.cure.fullCure}` : "",
				card.cure.immersionService,
				card.cure.temperatureDependence
			].filter(Boolean).join(" — ")
		},
		{
			n: "10",
			title: "SAFETY",
			body: [
				join(card.safety.ppe),
				card.safety.ventilation,
				join(card.safety.hazards, "")
			].filter(Boolean).join(" — ")
		}
	];
	const bottom = doc.internal.pageSize.getHeight() - 48;
	for (const row of rows) {
		const bodyLines = wrap(doc, row.body || "—", width - 78 - 8);
		const needed = Math.max(22, bodyLines.length * 11 + 14);
		if (y + needed > bottom) {
			footer(doc, card, 1);
			doc.addPage();
			doc.setFillColor(paper.r, paper.g, paper.b);
			doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), "F");
			doc.setFillColor(rail.r, rail.g, rail.b);
			doc.rect(0, 0, 14, doc.internal.pageSize.getHeight(), "F");
			y = 48;
		}
		doc.setFont("courier", "bold");
		doc.setFontSize(9);
		doc.setTextColor(rail.r, rail.g, rail.b);
		doc.text(row.n, margin, y + 9);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(8);
		doc.setTextColor(ink.r, ink.g, ink.b);
		doc.text(row.title, 58, y + 9);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8.5);
		doc.setTextColor(ink.r, ink.g, ink.b);
		doc.text(bodyLines, 114, y + 9);
		y += needed;
		doc.setDrawColor(rule.r, rule.g, rule.b);
		doc.setLineWidth(.6);
		doc.line(margin, y - 6, pageW - margin, y - 6);
	}
	footer(doc, card, 1);
	if (forecast) {
		doc.addPage();
		doc.setFillColor(paper.r, paper.g, paper.b);
		doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), "F");
		doc.setFillColor(rail.r, rail.g, rail.b);
		doc.rect(0, 0, 14, doc.internal.pageSize.getHeight(), "F");
		y = 44;
		doc.setFont("helvetica", "bold");
		doc.setFontSize(9);
		doc.setTextColor(rail.r, rail.g, rail.b);
		doc.text("APPLICATION WINDOWS  ·  NOAA", margin, y);
		doc.setFont("helvetica", "normal");
		doc.setTextColor(muted.r, muted.g, muted.b);
		doc.setFontSize(8);
		doc.text(`${forecast.city}, ${forecast.state}  ${forecast.zip}`, pageW - margin, y, { align: "right" });
		y += 20;
		doc.setFont("helvetica", "bold");
		doc.setFontSize(13);
		doc.setTextColor(ink.r, ink.g, ink.b);
		doc.text(wrap(doc, forecast.headline, width), margin, y);
		y += 28;
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8);
		doc.setTextColor(muted.r, muted.g, muted.b);
		const siteLine = [
			site ? `Substrate: ${substrateById(site.substrate).label}` : null,
			site?.mitigations.length ? `Mitigations: ${site.mitigations.map((id) => mitigationById(id)?.label ?? id).join(", ")}` : "Mitigations: none",
			"Est. substrate = air + solar gain (not a substitute for a surface thermometer)"
		].filter(Boolean).join("  ·  ");
		doc.text(wrap(doc, siteLine, width), margin, y);
		y += 22;
		drawCalendar(doc, forecast.days, margin, y, width);
		y += 210;
		doc.setFont("helvetica", "bold");
		doc.setFontSize(9);
		doc.setTextColor(ink.r, ink.g, ink.b);
		doc.text("FIELD AMBIENT LOG  (fill in)", margin, y);
		y += 12;
		const cols = [
			"Date / time",
			"Air °F",
			"Steel °F",
			"RH %",
			"Dew °F",
			"Spread",
			"Sky / wind",
			"Initials"
		];
		const colW = width / cols.length;
		doc.setFillColor(22, 24, 28);
		doc.rect(margin, y, width, 16, "F");
		doc.setFont("helvetica", "bold");
		doc.setFontSize(7);
		doc.setTextColor(243, 239, 230);
		cols.forEach((c, i) => doc.text(c, margin + i * colW + 4, y + 11));
		y += 16;
		doc.setTextColor(ink.r, ink.g, ink.b);
		doc.setDrawColor(rule.r, rule.g, rule.b);
		for (let r = 0; r < 10; r++) {
			doc.setLineWidth(.5);
			doc.rect(margin, y, width, 18);
			for (let i = 1; i < cols.length; i++) doc.line(margin + i * colW, y, margin + i * colW, y + 18);
			y += 18;
		}
		y += 16;
		doc.setFont("helvetica", "italic");
		doc.setFontSize(8);
		doc.setTextColor(muted.r, muted.g, muted.b);
		const caveats = wrap(doc, "Forecast is air at the ZIP. Substrate temperature is estimated from solar load and selected mitigations — measure steel at the workface. Windows are guidance — the PDS and project spec govern. " + (forecast.source || ""), width);
		doc.text(caveats, margin, y);
		footer(doc, card, 2);
	}
	const safe = (card.product.name || "field-card").replace(/[^\w]+/g, "-").slice(0, 48);
	doc.save(`${safe}-field-card.pdf`);
}
function footer(doc, card, page) {
	const pageW = doc.internal.pageSize.getWidth();
	const pageH = doc.internal.pageSize.getHeight();
	doc.setFont("helvetica", "normal");
	doc.setFontSize(7);
	doc.setTextColor(120, 124, 128);
	doc.text("Extracted from PDS for field reference. Confirm against the current manufacturer revision and the project specification. Not a substitute for the SDS or ITP.", 36, pageH - 22, { maxWidth: pageW - 90 });
	doc.text(`p.${page}`, pageW - 36, pageH - 22, { align: "right" });
}
function drawCalendar(doc, days, x, y, width) {
	const show = days.slice(0, 7);
	if (!show.length) return;
	const gap = 6;
	const w = (width - gap * (show.length - 1)) / show.length;
	show.forEach((d, i) => {
		const cx = x + i * (w + gap);
		const color = d.status === "go" ? {
			r: 63,
			g: 125,
			b: 92
		} : d.status === "caution" ? {
			r: 160,
			g: 122,
			b: 58
		} : d.status === "nogo" ? {
			r: 154,
			g: 78,
			b: 70
		} : {
			r: 120,
			g: 124,
			b: 128
		};
		doc.setDrawColor(210, 204, 192);
		doc.setFillColor(255, 252, 246);
		doc.roundedRect(cx, y, w, 188, 4, 4, "FD");
		doc.setFillColor(color.r, color.g, color.b);
		doc.rect(cx, y, w, 6, "F");
		doc.setFont("helvetica", "bold");
		doc.setFontSize(8);
		doc.setTextColor(22, 24, 28);
		doc.text(d.weekday.toUpperCase(), cx + w / 2, y + 22, { align: "center" });
		doc.setFont("helvetica", "normal");
		doc.setFontSize(9);
		doc.text(d.dateLabel, cx + w / 2, y + 36, { align: "center" });
		doc.setFont("helvetica", "bold");
		doc.setFontSize(8);
		doc.setTextColor(color.r, color.g, color.b);
		doc.text(d.status.toUpperCase(), cx + w / 2, y + 52, { align: "center" });
		doc.setFont("helvetica", "normal");
		doc.setTextColor(22, 24, 28);
		doc.setFontSize(7.5);
		doc.text(d.bestRange ?? "no window", cx + w / 2, y + 68, { align: "center" });
		doc.setTextColor(92, 97, 104);
		doc.setFontSize(6.5);
		doc.text(`${d.goHours}h go`, cx + w / 2, y + 82, { align: "center" });
		const limit = (d.limiting[0] || "—").slice(0, 28);
		const lines = doc.splitTextToSize(limit, w - 8);
		doc.text(lines.slice(0, 3), cx + w / 2, y + 100, { align: "center" });
		const stripY = y + 148;
		const usable = d.hours.filter((h) => h.hour >= 5 && h.hour <= 20);
		const cell = (w - 8) / Math.max(usable.length, 1);
		usable.forEach((h, idx) => {
			const fill = h.status === "go" ? {
				r: 63,
				g: 125,
				b: 92
			} : h.status === "caution" ? {
				r: 196,
				g: 154,
				b: 80
			} : {
				r: 180,
				g: 120,
				b: 114
			};
			doc.setFillColor(fill.r, fill.g, fill.b);
			doc.rect(cx + 4 + idx * cell, stripY, Math.max(cell - .6, 1), 10, "F");
		});
		doc.setFontSize(6);
		doc.setTextColor(120, 124, 128);
		doc.text("05h", cx + 4, stripY + 22);
		doc.text("20h", cx + w - 4, stripY + 22, { align: "right" });
	});
}
var KEY = "fieldcard.v1";
function read() {
	if (typeof window === "undefined") return {
		zip: "",
		recents: []
	};
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return {
			zip: "",
			recents: []
		};
		return JSON.parse(raw);
	} catch {
		return {
			zip: "",
			recents: []
		};
	}
}
function write(store) {
	localStorage.setItem(KEY, JSON.stringify(store));
}
function loadZip() {
	return read().zip;
}
function saveZip(zip) {
	const s = read();
	s.zip = zip;
	write(s);
}
function loadRecents() {
	return read().recents;
}
function pushRecent(card, zip) {
	const s = read();
	s.recents = [{
		id: card.id,
		savedAt: (/* @__PURE__ */ new Date()).toISOString(),
		card,
		zip
	}, ...s.recents.filter((r) => r.card.product.name !== card.product.name)].slice(0, 8);
	s.zip = zip || s.zip;
	write(s);
	return s.recents;
}
function siteFromCard(card, prev) {
	const notes = [
		card.product.name,
		card.product.productType,
		card.product.service,
		card.surfacePrep.notes,
		card.surfacePrep.moisture,
		card.surfacePrep.cleanliness,
		card.environmentals.notes,
		card.credentials.notes,
		...card.credentials.required,
		...card.surfacePrep.substrates,
		...card.inspection.methods
	].join(" ");
	const substrate = inferSubstrate(card.surfacePrep.substrates, card.product.productType);
	const rules = inferProductRules(notes);
	return {
		substrate,
		mitigations: (prev?.substrate === substrate ? prev.mitigations : []).filter((id) => Boolean(mitigationById(id))),
		customMitigationIds: prev?.customMitigationIds ?? [],
		moistureTolerant: isMoistureTolerant(notes),
		discipline: rules.discipline,
		bodies: rules.bodies
	};
}
function Home() {
	const [text, setText] = (0, import_react.useState)("");
	const [zip, setZip] = (0, import_react.useState)("");
	const [card, setCard] = (0, import_react.useState)(null);
	const [forecast, setForecast] = (0, import_react.useState)(null);
	const [extracting, setExtracting] = (0, import_react.useState)(false);
	const [wxLoading, setWxLoading] = (0, import_react.useState)(false);
	const [wxError, setWxError] = (0, import_react.useState)(null);
	const [recents, setRecents] = (0, import_react.useState)([]);
	const [downloading, setDownloading] = (0, import_react.useState)(false);
	const [site, setSite] = (0, import_react.useState)({
		substrate: "bare_steel",
		mitigations: []
	});
	const [calibration, setCalibration] = (0, import_react.useState)(DEFAULT_CALIBRATION);
	const [custom, setCustom] = (0, import_react.useState)([]);
	const [outcomeCount, setOutcomeCount] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => {
		setZip(loadZip());
		setRecents(loadRecents());
		const learned = loadLearning();
		setCalibration(learned.calibration);
		setCustom(learned.custom);
		setOutcomeCount(learned.outcomes.length);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!card) return;
		const node = document.getElementById("field-card-print");
		if (!node) return;
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		node.scrollIntoView({
			behavior: reduce ? "auto" : "smooth",
			block: "start"
		});
	}, [card?.id]);
	const scoringSite = (0, import_react.useMemo)(() => ({
		...site,
		calibration,
		customMitigations: custom
	}), [
		site,
		calibration,
		custom
	]);
	const scored = (0, import_react.useMemo)(() => {
		if (!forecast || !card) return forecast;
		return rescoreForecast(forecast, card.environmentals, scoringSite);
	}, [
		forecast,
		card,
		scoringSite
	]);
	function remember(next, nextZip) {
		setRecents(pushRecent(next, nextZip));
	}
	function applyCard(next) {
		setCard(next);
		setSite((prev) => siteFromCard(next, prev));
	}
	async function handleExtract() {
		setExtracting(true);
		try {
			const result = await extractPds({ data: { text } });
			if (!result.ok) {
				toast.error(result.error);
				return;
			}
			applyCard(result.card);
			remember(result.card, zip);
			toast.success(result.usedAi ? "Card on the stand." : "Card built with a fallback parse — review every field.");
			if (zip.length === 5) handleForecast(result.card, zip);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Extract failed");
		} finally {
			setExtracting(false);
		}
	}
	async function handleForecast(active = card, nextZip = zip) {
		if (!active) {
			toast.error("Build a card first.");
			return;
		}
		if (nextZip.length !== 5) {
			toast.error("Enter a 5-digit US ZIP.");
			return;
		}
		saveZip(nextZip);
		setWxLoading(true);
		setWxError(null);
		try {
			const result = await loadForecast({ data: {
				zip: nextZip,
				environmentals: active.environmentals
			} });
			if (!result.ok) {
				setWxError(result.error);
				return;
			}
			setForecast(result.forecast);
			remember(active, nextZip);
		} catch (err) {
			setWxError(err instanceof Error ? err.message : "Forecast failed");
		} finally {
			setWxLoading(false);
		}
	}
	async function handlePdf() {
		if (!card) return;
		setDownloading(true);
		try {
			await downloadFieldCard(card, scored, site);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "PDF failed");
		} finally {
			setDownloading(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "min-h-screen bg-bg text-fg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "no-print border-b border-border/80 bg-surface/90 backdrop-blur",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: "/mascot.jpg",
						alt: "Coatings Conductor mascot — hard-hat conductor blowing a whistle",
						className: "size-12 rounded-md object-cover object-top shadow-[0_0_0_1px_rgba(255,183,3,0.45)] sm:size-14"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] font-semibold uppercase tracking-[0.2em] text-accent",
							children: "Job-site conductor"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-base font-bold tracking-tight sm:text-lg",
							children: "Coatings Conductor"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: "PDS job card · NOAA windows · mitigations"
						})
					] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						variant: "outline",
						size: "sm",
						disabled: !card,
						onClick: () => window.print(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Printer, {}), "Print"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "button",
						size: "sm",
						disabled: !card || downloading,
						onClick: () => void handlePdf(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {}), "Download PDF"]
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "caution-stripe h-1 w-full" })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "no-print space-y-6 lg:col-start-1 lg:row-start-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "rise-in flex items-start gap-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: "/mascot.jpg",
							alt: "",
							className: "hidden size-20 shrink-0 rounded-lg object-cover object-top shadow-[0_0_0_1px_rgba(232,93,4,0.45)] sm:block"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "max-w-xl text-3xl font-bold tracking-tight sm:text-4xl",
							children: "Call the coating window."
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base",
							children: "Storage through safety in job order, then NOAA windows scored against the real substrate — steel in the sun is not air at the ZIP — and the mitigations you will field."
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PdsIntake, {
						text,
						onText: setText,
						onExtract: () => void handleExtract(),
						onSample: (next, raw) => {
							setText(raw);
							applyCard(next);
							remember(next, zip);
							if (zip.length === 5) handleForecast(next, zip);
						},
						loading: extracting,
						recents,
						onOpenRecent: (next) => applyCard(next)
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "min-w-0 lg:col-start-1 lg:row-start-2",
					children: card ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldCardView, { card }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyCardSkeleton, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "no-print space-y-4 lg:col-start-2 lg:row-start-1 lg:row-span-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WeatherPanel, {
						zip,
						onZip: setZip,
						forecast: scored,
						loading: wxLoading,
						error: wxError,
						onLoad: () => void handleForecast(),
						disabled: !card,
						environmentals: card?.environmentals,
						onEnvironmentals: card ? (env) => {
							setCard({
								...card,
								environmentals: env
							});
						} : void 0,
						site: scoringSite,
						onSite: setSite
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LearningPanel, {
						calibration,
						onCalibration: (c) => {
							setCalibration(c);
							saveCalibration(c);
						},
						custom,
						customIds: site.customMitigationIds ?? [],
						onToggleCustom: (id) => {
							const cur = site.customMitigationIds ?? [];
							setSite({
								...site,
								customMitigationIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
							});
						},
						onAddCustom: (input) => {
							const created = upsertCustomMitigation(input);
							setCustom(loadLearning().custom);
							const cur = site.customMitigationIds ?? [];
							setSite({
								...site,
								customMitigationIds: cur.includes(created.id) ? cur : [...cur, created.id]
							});
							toast.success(`${created.label} is in the catalog. Calendar will use the learned deltas.`);
						},
						onLogOutcome: (input) => {
							const result = recordOutcome(input, calibration);
							setCalibration(result.calibration);
							setOutcomeCount(result.count);
							toast.success("Logged. Tightness sliders moved with that result.");
						},
						outcomeCount,
						product: card?.product.name ?? "",
						zip,
						substrateLabel: substrateById(site.substrate).label,
						mitigationsInPlay: [...site.mitigations, ...custom.filter((c) => (site.customMitigationIds ?? []).includes(c.id)).map((c) => c.label)],
						forecast: scored,
						disabled: !card
					})]
				})
			]
		})]
	});
}
//#endregion
export { Home as component };
