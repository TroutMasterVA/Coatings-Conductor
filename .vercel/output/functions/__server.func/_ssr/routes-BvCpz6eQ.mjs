import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { v as Link, x as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as getServerFnById, i as TSS_SERVER_FUNCTION, r as createServerFn } from "./ssr.mjs";
import { i as signOut } from "./client-B40BzJxt.mjs";
import { a as dayGoHoursNeeded, c as mergeCustomMitigation, i as catalogHelps, l as recordOutcome, r as axisImpact, s as loadLegacyLearning, t as DEFAULT_CALIBRATION, u as tightnessLabel } from "./learning-CQdNi_eK.mjs";
import { _ as selectMitigation, a as detectLimiters, c as inferSubstrate, d as isRecommended, f as mitigationById, h as sanitizeMitigations, i as coveringPackage, l as isConflicted, m as rescoreForecast, o as goHourCount, p as peakExample, r as compatibleMitigations, s as inferProductRules, t as SUBSTRATES, u as isMoistureTolerant, v as substrateById, y as unlockedGoHours } from "./score-windows-CQikBYHv.mjs";
import { a as Plus, c as FolderOpen, d as CloudSun, f as Check, i as Printer, l as FileText, o as MapPin, p as Archive, r as Trash2, s as LoaderCircle, t as Upload, u as Download } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { a as cn, i as Label, n as Button, o as useCurrentUser, r as Input, s as useCurrentUserState, t as BootShell } from "./use-current-user-DPix4aJl.mjs";
import { t as authMiddleware } from "./middleware-DEdNZdDP.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BvCpz6eQ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
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
	const predicted = forecast ? forecast.days[0]?.status ?? "unknown" : "unknown";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
		className: "rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-semibold uppercase tracking-wide text-accent",
				children: "Field learning"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-muted",
				children: "This project’s model only. Logged results nudge these sliders — they do not travel to your other jobs. Custom methods you add stay in your library for every project."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 font-mono text-xs text-fg",
				children: [
					tightnessLabel(calibration.master),
					" · ",
					dayGoHoursNeeded(calibration.master),
					"h needed for a go-day ·",
					" ",
					outcomeCount,
					" logged"
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex items-center justify-between gap-3 text-sm text-fg",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Unlock attributes" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						className: "size-4 accent-go",
						checked: !calibration.linked,
						onChange: (e) => onCalibration({
							...calibration,
							linked: !e.target.checked
						}),
						disabled
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1.5 text-xs leading-relaxed text-muted",
					children: "Linked uses one tightness. Unlock to move solar, thermal, moisture, rain, and wind on their own."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 space-y-2",
				children: calibration.linked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderRow, {
					label: "Master tightness",
					value: calibration.master,
					disabled,
					impact: axisImpact("thermal", calibration.master),
					onChange: (n) => onCalibration({
						...calibration,
						master: n,
						solar: n,
						thermal: n,
						moisture: n,
						precip: n,
						wind: n
					})
				}) : AXIS_ORDER.map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SliderRow, {
					label: axisImpact(id, calibration[id]).label,
					value: calibration[id],
					disabled,
					impact: axisImpact(id, calibration[id]),
					onChange: (n) => onCalibration({
						...calibration,
						[id]: n
					})
				}, id))
			}),
			custom.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 border-t border-border pt-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-medium uppercase tracking-wide text-muted",
						children: "Your mitigation library"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted",
						children: "Available on every project. Toggle selects it for this job only."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 space-y-2",
						children: custom.map((c) => {
							const on = customIds.includes(c.id);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								disabled,
								className: cn("flex min-h-11 w-full items-start justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs", on ? "bg-go/20 text-go-soft shadow-[0_0_0_1px_rgba(63,125,92,0.65)]" : "bg-surface-2 text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"),
								onClick: () => onToggleCustom(c.id),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block font-medium",
									children: c.label
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mt-0.5 block text-muted",
									children: c.summary
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "shrink-0 font-mono text-muted",
									children: on ? "on this job" : "library"
								})]
							}) }, c.id);
						})
					})
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 flex flex-wrap gap-2 border-t border-border pt-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					variant: "secondary",
					size: "sm",
					disabled,
					onClick: () => setLogOpen((v) => !v),
					children: [logOpen ? "Hide" : "Log", " a field result"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					variant: "outline",
					size: "sm",
					disabled,
					onClick: () => setAddOpen((v) => !v),
					children: [addOpen ? "Hide" : "Add", " a field mitigation"]
				})]
			}),
			logOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-4 space-y-3",
				onSubmit: (e) => {
					e.preventDefault();
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
					setLogOpen(false);
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-muted",
						children: [
							"Predicted today: ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-fg",
								children: predicted
							}),
							". Tell this project’s model what actually happened."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						className: "flex h-11 w-full rounded-md bg-surface-2 px-3 text-sm text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
						value: actual,
						onChange: (e) => setActual(e.target.value),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "correct",
								children: "Model was right"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "false_nogo",
								children: "Model said no-go, we coated"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "false_go",
								children: "Model said go, we held"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "Measured air °F",
								value: measuredAir,
								onChange: (e) => setMeasuredAir(e.target.value)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "Measured steel °F",
								value: measuredSteel,
								onChange: (e) => setMeasuredSteel(e.target.value)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "Measured RH %",
								value: measuredRh,
								onChange: (e) => setMeasuredRh(e.target.value)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "Measured dew °F",
								value: measuredDew,
								onChange: (e) => setMeasuredDew(e.target.value)
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						placeholder: "Notes",
						value: logNotes,
						onChange: (e) => setLogNotes(e.target.value)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						size: "sm",
						children: "Save to this project"
					})
				]
			}) : null,
			addOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-4 space-y-3",
				onSubmit: (e) => {
					e.preventDefault();
					if (!newLabel.trim()) return;
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
					setNewNotes("");
					setAddOpen(false);
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: "Saved to your library — usable on every project. Turns on for this job."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						placeholder: "Name (e.g. south-wall poly fly)",
						value: newLabel,
						onChange: (e) => setNewLabel(e.target.value)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						placeholder: "What it does",
						value: newSummary,
						onChange: (e) => setNewSummary(e.target.value)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-1.5",
						children: catalogHelps().map((h) => {
							const on = helps.includes(h);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: cn("rounded-md px-2 py-1 text-xs", on ? "bg-go/20 text-go-soft" : "bg-surface-2 text-muted"),
								onClick: () => setHelps(on ? helps.filter((x) => x !== h) : [...helps, h]),
								children: h
							}, h);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: "Before → after (optional numbers). The model learns the delta."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "Before air",
								value: before.air,
								onChange: (e) => setBefore({
									...before,
									air: e.target.value
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "After air",
								value: after.air,
								onChange: (e) => setAfter({
									...after,
									air: e.target.value
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "Before steel",
								value: before.steel,
								onChange: (e) => setBefore({
									...before,
									steel: e.target.value
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "After steel",
								value: after.steel,
								onChange: (e) => setAfter({
									...after,
									steel: e.target.value
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "Before RH",
								value: before.rh,
								onChange: (e) => setBefore({
									...before,
									rh: e.target.value
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "After RH",
								value: after.rh,
								onChange: (e) => setAfter({
									...after,
									rh: e.target.value
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "Before dew",
								value: before.dew,
								onChange: (e) => setBefore({
									...before,
									dew: e.target.value
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "After dew",
								value: after.dew,
								onChange: (e) => setAfter({
									...after,
									dew: e.target.value
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "Before wind",
								value: before.wind,
								onChange: (e) => setBefore({
									...before,
									wind: e.target.value
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "After wind",
								value: after.wind,
								onChange: (e) => setAfter({
									...after,
									wind: e.target.value
								})
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						placeholder: "Notes",
						value: newNotes,
						onChange: (e) => setNewNotes(e.target.value)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						size: "sm",
						children: "Save to library"
					})
				]
			}) : null
		]
	});
}
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
function ProjectHome({ projects, creating, error, guest, onCreate, onOpen, onArchive, onDelete }) {
	const [name, setName] = (0, import_react.useState)("");
	const [zip, setZip] = (0, import_react.useState)("");
	const [confirmId, setConfirmId] = (0, import_react.useState)(null);
	const active = projects.filter((p) => !p.archived);
	const archived = projects.filter((p) => p.archived);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rise-in",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-3xl font-bold tracking-tight",
					children: "Projects"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base",
					children: "Each project is one job site — name, ZIP, card, and its own nudged model. Field results on Houston do not move Arlington. Custom mitigations you learn stay in your library for every job."
				})]
			}),
			guest ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,183,3,0.28)] sm:flex-row sm:items-center sm:justify-between sm:p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "max-w-xl text-sm leading-relaxed text-muted",
					children: "Working on this device. Create an account if you want these jobs to follow you after a cache clear."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					size: "sm",
					className: "shrink-0",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/login",
						search: { mode: "up" },
						children: "Create account"
					})
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-medium uppercase tracking-wide text-muted",
						children: "New project"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						className: "mt-3 flex flex-col gap-3 sm:flex-row sm:items-end",
						onSubmit: (e) => {
							e.preventDefault();
							onCreate(name, zip);
						},
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "proj-name",
									children: "Project name"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "proj-name",
									className: "mt-1.5",
									placeholder: "Tank farm — Houston",
									value: name,
									onChange: (e) => setName(e.target.value),
									required: true
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "sm:w-32",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "proj-zip",
									children: "ZIP"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "proj-zip",
									inputMode: "numeric",
									maxLength: 5,
									className: "mt-1.5 font-mono tracking-widest",
									placeholder: "77002",
									value: zip,
									onChange: (e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5)),
									required: true
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								type: "submit",
								disabled: creating || name.trim() === "" || zip.length !== 5,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {}), "Create"]
							})
						]
					}),
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm text-nogo",
						children: error
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-medium uppercase tracking-wide text-muted",
				children: "Active"
			}), active.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted",
				children: "No active projects. Create one to call a coating window."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 space-y-2",
				children: active.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProjectRow, {
					project: p,
					confirm: confirmId === p.id,
					onConfirm: (v) => setConfirmId(v ? p.id : null),
					onOpen: () => onOpen(p.id),
					onArchive: () => onArchive(p.id, true),
					onDelete: () => onDelete(p.id)
				}) }, p.id))
			})] }),
			archived.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-medium uppercase tracking-wide text-muted",
				children: "Archived"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 space-y-2",
				children: archived.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProjectRow, {
					project: p,
					confirm: confirmId === p.id,
					onConfirm: (v) => setConfirmId(v ? p.id : null),
					onOpen: () => onArchive(p.id, false),
					onArchive: () => onArchive(p.id, false),
					onDelete: () => onDelete(p.id)
				}) }, p.id))
			})] }) : null
		]
	});
}
function ProjectRow({ project, confirm, onConfirm, onOpen, onArchive, onDelete }) {
	const opened = project.lastOpenedAt ? new Date(project.lastOpenedAt) : null;
	const openedLabel = opened && !Number.isNaN(opened.getTime()) ? opened.toLocaleDateString(void 0, {
		month: "short",
		day: "numeric"
	}) : "—";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("article", {
		className: cn("rounded-lg bg-surface p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] sm:p-4", project.archived && "opacity-70"),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-start justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-medium text-fg",
					children: project.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-0.5 font-mono text-xs text-muted",
					children: [
						project.zip,
						project.hasCard ? " · card on stand" : " · no card yet",
						" · ",
						project.archived ? "archived" : `opened ${openedLabel}`
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [project.archived ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					variant: "secondary",
					size: "sm",
					onClick: onArchive,
					children: "Restore"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					size: "sm",
					onClick: onOpen,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, {}), "Open"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					variant: "outline",
					size: "sm",
					onClick: onArchive,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Archive, {}), "Archive"]
				})] }), confirm ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "button",
					variant: "rail",
					size: "sm",
					onClick: () => {
						onDelete();
						onConfirm(false);
					},
					children: "Delete forever"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					variant: "ghost",
					size: "sm",
					onClick: () => onConfirm(true),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {}), "Remove"]
				})]
			})]
		})
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
function MitPickGrid({ title, blurb, items, selectedIds, recommendedIds, locked, reasonFor, blockedFor, gainedFor, onToggle }) {
	if (!items.length) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-medium uppercase tracking-wide text-muted",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 text-xs leading-relaxed text-muted",
				children: blurb
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2",
				children: items.map((m) => {
					const selected = selectedIds.includes(m.id);
					const rec = recommendedIds.includes(m.id);
					const reason = reasonFor(m);
					const blocked = !selected && blockedFor(m);
					const gained = !selected && !blocked ? gainedFor(m.id) : null;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "min-w-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							disabled: locked || blocked,
							"aria-pressed": selected,
							title: m.summary,
							onClick: () => onToggle(m.id),
							className: cn("flex min-h-11 w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-[box-shadow] duration-150", selected ? "bg-go/20 shadow-[0_0_0_1px_rgba(63,125,92,0.65)]" : rec ? "bg-go/10 shadow-[0_0_0_1px_rgba(63,125,92,0.4)]" : "bg-surface-2 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.13)]", (locked || blocked) && "cursor-not-allowed opacity-45 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"),
							children: [selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "mt-0.5 size-3.5 shrink-0 text-go-soft" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mt-0.5 size-3.5 shrink-0 rounded-sm shadow-[0_0_0_1px_rgba(255,255,255,0.18)]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: cn("block text-xs font-medium leading-snug", selected || rec ? "text-go-soft" : "text-fg"),
									children: m.label
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "mt-0.5 block text-xs leading-snug text-muted",
									children: [
										m.owns,
										reason ? ` · ${reason}` : "",
										gained && gained > 0 ? ` · +${gained}h` : ""
									]
								})]
							})]
						})
					}, m.id);
				})
			})
		]
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
			if (isConflicted(m.id, site.mitigations)) return false;
			const next = selectMitigation(site.mitigations, m.id);
			const unlocks = forecast && environmentals ? unlockedGoHours(forecast, environmentals, {
				...site,
				mitigations: next
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
		onSite({
			...site,
			mitigations: selectMitigation(site.mitigations, id)
		});
	}
	function toggleMitigation(id) {
		if (site.mitigations.includes(id)) {
			onSite({
				...site,
				mitigations: site.mitigations.filter((x) => x !== id)
			});
			return;
		}
		addMitigation(id);
	}
	function hoursGained(id) {
		if (!forecast || !environmentals) return null;
		const next = selectMitigation(site.mitigations, id);
		if (next.length === site.mitigations.length && next.every((m, i) => m === site.mitigations[i])) return 0;
		const withIt = {
			...site,
			mitigations: next
		};
		return unlockedGoHours(forecast, environmentals, withIt) - unlockedGoHours(forecast, environmentals, site);
	}
	function pickReason(m) {
		if (site.mitigations.includes(m.id)) return "";
		const cover = coveringPackage(m.id, site.mitigations);
		if (cover) return `covered by ${cover.label}`;
		if (m.kind !== "package" && isConflicted(m.id, site.mitigations)) return "conflicts";
		if (m.kind === "package") {
			const other = site.mitigations.map((id) => mitigationById(id)).find((x) => x?.kind === "package" && x.id !== m.id && m.conflicts?.includes(x.id));
			if (other) return `replaces ${other.label}`;
		}
		return "";
	}
	function isBlocked(m) {
		if (site.mitigations.includes(m.id)) return false;
		if (m.kind === "package") return false;
		return isConflicted(m.id, site.mitigations);
	}
	const independent = available.filter((m) => m.kind === "independent");
	const packages = available.filter((m) => m.kind === "package");
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
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs font-medium uppercase tracking-wide text-muted",
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
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1.5 text-xs leading-relaxed text-muted",
							children: "Independent = one limiter. Package = enclosure that already covers those independents — you cannot stack both. Pick a package and it replaces the open kit it covers."
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
											className: "inline-flex min-h-11 items-center gap-1.5 rounded-md bg-go/20 px-2.5 py-1.5 text-xs font-medium text-go-soft shadow-[0_0_0_1px_rgba(63,125,92,0.65)]",
											onClick: () => addMitigation(id),
											children: [
												m?.label ?? id,
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-normal opacity-80",
													children: m?.owns
												}),
												gained && gained > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "font-mono opacity-80",
													children: [
														"+",
														gained,
														"h"
													]
												}) : null
											]
										}) }, id);
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-xs leading-relaxed text-muted",
									children: recommendedIds.map((id) => mitigationById(id)?.citation).filter(Boolean).slice(0, 2).join(" ")
								})
							]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MitPickGrid, {
							title: "Independent",
							blurb: "One limiter each. Canopy + rain tarp + wind block is a valid open kit — it is not a tent.",
							items: independent,
							selectedIds: site.mitigations,
							recommendedIds,
							locked: disabled,
							reasonFor: pickReason,
							blockedFor: isBlocked,
							gainedFor: hoursGained,
							onToggle: toggleMitigation
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MitPickGrid, {
							title: "Package",
							blurb: "Enclosure. Fulfills the independents it owns — those stay blocked while the package is on.",
							items: packages,
							selectedIds: site.mitigations,
							recommendedIds,
							locked: disabled,
							reasonFor: pickReason,
							blockedFor: isBlocked,
							gainedFor: hoursGained,
							onToggle: toggleMitigation
						}),
						site.mitigations.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 space-y-1",
							children: site.mitigations.map((id) => {
								const m = mitigationById(id);
								return m ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-xs text-muted",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-medium text-fg",
											children: [
												m.kind === "package" ? "Package" : "Independent",
												" · ",
												m.owns,
												"."
											]
										}),
										" ",
										m.summary,
										" ",
										m.citation
									]
								}, `${id}-note`) : null;
							})
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
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
/**
* Minimal signed-in identity chip + sign-out. Restyle freely (see the
* `design-ui` skill). Sign-out is only shown when auth is enabled (the
* disabled-auth dev user has nothing to sign out of).
*/
function UserButton() {
	const user = useCurrentUser();
	const [signingOut, setSigningOut] = (0, import_react.useState)(false);
	if (!user) return null;
	const label = user.displayName ?? user.primaryEmail ?? "Account";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [
			user.profileImageUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: user.profileImageUrl,
				alt: "",
				className: "h-8 w-8 rounded-full object-cover"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "grid h-8 w-8 place-items-center rounded-full bg-black/10 text-sm font-medium dark:bg-white/20",
				children: label.charAt(0).toUpperCase()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm font-medium",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: signingOut,
				onClick: () => {
					setSigningOut(true);
					signOut().catch(() => setSigningOut(false));
				},
				className: "cursor-pointer text-sm underline-offset-4 opacity-70 hover:underline disabled:cursor-wait disabled:no-underline",
				children: signingOut ? "Signing out…" : "Sign out"
			})
		]
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
function defaultSite() {
	return {
		substrate: "bare_steel",
		mitigations: [],
		customMitigationIds: []
	};
}
var loadWorkspace = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("4001ac0e3fa599c3b6c16c48953b32dac17e23933b616d2cea3c469261cd5f49"));
var createProject = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => {
	const name = input.name.trim();
	const zip = input.zip.replace(/\D/g, "").slice(0, 5);
	if (!name) throw new Error("Project name is required.");
	if (zip.length !== 5) throw new Error("Enter a 5-digit US ZIP.");
	return {
		name,
		zip,
		seed: input.seed
	};
}).handler(createSsrRpc("db3e85134a404be42369235757524fccdce0e01215ffef27e9590cec13abc0cf"));
var openProject = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => id).handler(createSsrRpc("fbc1b91a1fda83a921c988a17311cd4f481a048a5f131b4f426adeb0e4d3a274"));
var saveProject = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("e63f4109eba5f70c326f3399b4ccb7ad4f3be4c1f66ea9b7fa8fc6d09af684cf"));
var archiveProject = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("73a1e3c2816431146f1b7b790b1ace9f8c5cbec6445b879d7c2f87998b278d29"));
var deleteProject = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => id).handler(createSsrRpc("da134c65dd91b188214ccc07961ee0b663b094462ec1770a33c47c7739e45f95"));
var saveCustomMitigation = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("72bfc25ca4f03357ce5a466c4c096b74d0695e4dc106a7fb1554274cfb388e91"));
/** Lift device-local jobs into an empty account. No-op if the account already has projects or a library. */
var importGuestWorkspace = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => {
	return {
		projects: Array.isArray(input.projects) ? input.projects.slice(0, 50) : [],
		custom: Array.isArray(input.custom) ? input.custom.slice(0, 40) : [],
		lastProjectId: input.lastProjectId ?? null
	};
}).handler(createSsrRpc("9462225899c15c0146fedd3d47a0e833584fad49706095c307688725a605cd01"));
var KEY$1 = "fieldcard.projects.v1";
function empty() {
	return {
		lastProjectId: null,
		projects: [],
		custom: []
	};
}
function read$1() {
	if (typeof window === "undefined") return empty();
	try {
		const raw = localStorage.getItem(KEY$1);
		if (!raw) return empty();
		const parsed = JSON.parse(raw);
		return {
			lastProjectId: parsed.lastProjectId ?? null,
			projects: parsed.projects ?? [],
			custom: parsed.custom ?? []
		};
	} catch {
		return empty();
	}
}
function write(store) {
	localStorage.setItem(KEY$1, JSON.stringify(store));
}
function summaryOf(p) {
	return {
		id: p.id,
		name: p.name,
		zip: p.zip,
		archived: p.archived,
		lastOpenedAt: p.lastOpenedAt,
		updatedAt: p.updatedAt,
		hasCard: Boolean(p.card)
	};
}
function guestLoadWorkspace() {
	const s = read$1();
	return {
		lastProjectId: s.lastProjectId,
		projects: s.projects.map(summaryOf).sort((a, b) => Number(a.archived) - Number(b.archived)),
		custom: s.custom
	};
}
/** First sign-in with an empty account lifts this device’s jobs. Account jobs win if both exist. */
async function migrateGuestToAccount() {
	const dump = read$1();
	if (dump.projects.length === 0 && dump.custom.length === 0) return "empty";
	if ((await importGuestWorkspace({ data: {
		projects: dump.projects,
		custom: dump.custom,
		lastProjectId: dump.lastProjectId
	} })).skipped) return "skipped";
	write(empty());
	return "imported";
}
function guestCreateProject(name, zip, seed) {
	const trimmed = name.trim();
	const zipped = zip.replace(/\D/g, "").slice(0, 5);
	if (!trimmed) throw new Error("Project name is required.");
	if (zipped.length !== 5) throw new Error("Enter a 5-digit US ZIP.");
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const full = {
		id: crypto.randomUUID(),
		name: trimmed,
		zip: zipped,
		archived: false,
		lastOpenedAt: now,
		updatedAt: now,
		hasCard: Boolean(seed?.card),
		calibration: seed?.calibration ?? DEFAULT_CALIBRATION,
		site: seed?.site ?? defaultSite(),
		card: seed?.card ?? null,
		pdsText: seed?.pdsText ?? "",
		recents: seed?.recents ?? [],
		outcomes: seed?.outcomes ?? []
	};
	const s = read$1();
	s.projects = [full, ...s.projects];
	s.lastProjectId = full.id;
	write(s);
	return full;
}
function guestOpenProject(id) {
	const s = read$1();
	const found = s.projects.find((p) => p.id === id && !p.archived);
	if (!found) throw new Error("Project not found.");
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const next = {
		...found,
		lastOpenedAt: now
	};
	s.projects = s.projects.map((p) => p.id === id ? next : p);
	s.lastProjectId = id;
	write(s);
	return next;
}
function guestSaveProject(input) {
	const s = read$1();
	const found = s.projects.find((p) => p.id === input.id);
	if (!found) throw new Error("Project not found.");
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const next = {
		...found,
		name: input.name?.trim() || found.name,
		zip: input.zip != null ? input.zip.replace(/\D/g, "").slice(0, 5) : found.zip,
		calibration: input.calibration ?? found.calibration,
		site: input.site ?? found.site,
		card: input.card !== void 0 ? input.card : found.card,
		pdsText: input.pdsText ?? found.pdsText,
		recents: input.recents ?? found.recents,
		outcomes: input.outcomes ?? found.outcomes,
		updatedAt: now,
		hasCard: Boolean(input.card !== void 0 ? input.card : found.card)
	};
	s.projects = s.projects.map((p) => p.id === input.id ? next : p);
	write(s);
	return summaryOf(next);
}
function guestArchiveProject(id, archived) {
	const s = read$1();
	s.projects = s.projects.map((p) => p.id === id ? {
		...p,
		archived,
		updatedAt: (/* @__PURE__ */ new Date()).toISOString()
	} : p);
	if (archived && s.lastProjectId === id) s.lastProjectId = null;
	write(s);
}
function guestDeleteProject(id) {
	const s = read$1();
	s.projects = s.projects.filter((p) => p.id !== id);
	if (s.lastProjectId === id) s.lastProjectId = null;
	write(s);
}
function guestSaveCustom(input) {
	const s = read$1();
	const { list, saved } = mergeCustomMitigation(s.custom, input);
	s.custom = list;
	write(s);
	return saved;
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
function loadZip() {
	return read().zip;
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
		mitigations: sanitizeMitigations((prev?.substrate === substrate ? prev.mitigations : []).filter((id) => Boolean(mitigationById(id)))),
		customMitigationIds: prev?.customMitigationIds ?? [],
		moistureTolerant: isMoistureTolerant(notes),
		discipline: rules.discipline,
		bodies: rules.bodies
	};
}
function Home() {
	const { user, isPending } = useCurrentUserState();
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BootShell, { message: "Opening the stand…" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(App, { user }, user?.id ?? "guest");
}
function App({ user }) {
	const signedIn = Boolean(user);
	const api = (0, import_react.useMemo)(() => workspaceApi(signedIn), [signedIn]);
	const [mode, setMode] = (0, import_react.useState)("boot");
	const [projects, setProjects] = (0, import_react.useState)([]);
	const [projectId, setProjectId] = (0, import_react.useState)(null);
	const [projectName, setProjectName] = (0, import_react.useState)("");
	const [text, setText] = (0, import_react.useState)("");
	const [zip, setZip] = (0, import_react.useState)("");
	const [card, setCard] = (0, import_react.useState)(null);
	const [forecast, setForecast] = (0, import_react.useState)(null);
	const [extracting, setExtracting] = (0, import_react.useState)(false);
	const [wxLoading, setWxLoading] = (0, import_react.useState)(false);
	const [wxError, setWxError] = (0, import_react.useState)(null);
	const [recents, setRecents] = (0, import_react.useState)([]);
	const [downloading, setDownloading] = (0, import_react.useState)(false);
	const [creating, setCreating] = (0, import_react.useState)(false);
	const [homeError, setHomeError] = (0, import_react.useState)(null);
	const [site, setSite] = (0, import_react.useState)(defaultSite());
	const [calibration, setCalibration] = (0, import_react.useState)(DEFAULT_CALIBRATION);
	const [custom, setCustom] = (0, import_react.useState)([]);
	const [outcomes, setOutcomes] = (0, import_react.useState)([]);
	const hydrated = (0, import_react.useRef)(false);
	const persistTimer = (0, import_react.useRef)(void 0);
	const applyFull = (0, import_react.useCallback)((full) => {
		setProjectId(full.id);
		setProjectName(full.name);
		setZip(full.zip);
		setCard(full.card);
		setText(full.pdsText);
		setSite(full.site);
		setCalibration(full.calibration);
		setRecents(full.recents);
		setOutcomes(full.outcomes);
		setForecast(null);
		setWxError(null);
		setMode("job");
		setProjects((prev) => {
			const rest = prev.filter((p) => p.id !== full.id);
			return [toSummary(full), ...rest];
		});
	}, []);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		(async () => {
			try {
				if (signedIn) {
					const lifted = await migrateGuestToAccount();
					if (cancelled) return;
					if (lifted === "imported") toast.success("Moved this device’s jobs into your account.");
				}
				const ws = await api.load();
				if (cancelled) return;
				setProjects(ws.projects);
				setCustom(ws.custom);
				const last = ws.lastProjectId;
				if (last && ws.projects.some((p) => p.id === last && !p.archived) && last) {
					const full = await api.open(last);
					if (cancelled) return;
					applyFull(full);
				} else if (ws.projects.filter((p) => !p.archived).length === 0) {
					const legacy = loadLegacyLearning();
					const legacyZip = loadZip();
					if (legacy.outcomes.length > 0 || legacy.custom.length > 0 || legacyZip.length === 5 || legacy.calibration.master !== DEFAULT_CALIBRATION.master) {
						const seeded = await api.create({
							name: "Existing job",
							zip: legacyZip.length === 5 ? legacyZip : "22202",
							seed: {
								calibration: legacy.calibration,
								outcomes: legacy.outcomes,
								site: defaultSite()
							}
						});
						if (legacy.custom.length) {
							for (const c of legacy.custom) await api.saveCustom({
								label: c.label,
								summary: c.summary,
								helps: c.helps ?? [],
								before: {
									air: null,
									steel: null,
									rh: null,
									dew: null,
									wind: null
								},
								after: {
									air: c.dAirF,
									steel: c.dSubstrateF,
									rh: c.dRh,
									dew: c.dDewF,
									wind: c.dWindMph
								},
								notes: c.notes
							});
							const refreshed = await api.load();
							if (!cancelled) setCustom(refreshed.custom);
						}
						if (cancelled) return;
						applyFull(seeded);
						toast.success("Moved your previous local job into a project.");
					} else setMode("home");
				} else setMode("home");
			} catch (err) {
				if (cancelled) return;
				toast.error(err instanceof Error ? err.message : "Could not load projects.");
				setMode("home");
			} finally {
				hydrated.current = true;
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [
		api,
		applyFull,
		signedIn
	]);
	const persist = (0, import_react.useCallback)(() => {
		if (!projectId || !hydrated.current) return;
		api.save({
			id: projectId,
			name: projectName,
			zip,
			calibration,
			site,
			card,
			pdsText: text,
			recents,
			outcomes
		}).then((summary) => {
			setProjects((prev) => prev.map((p) => p.id === summary.id ? {
				...p,
				...summary
			} : p));
		}).catch((err) => {
			toast.error(err instanceof Error ? err.message : "Could not save project.");
		});
	}, [
		api,
		projectId,
		projectName,
		zip,
		calibration,
		site,
		card,
		text,
		recents,
		outcomes
	]);
	(0, import_react.useEffect)(() => {
		if (!projectId || !hydrated.current || mode !== "job") return;
		window.clearTimeout(persistTimer.current);
		persistTimer.current = window.setTimeout(() => persist(), 600);
		return () => window.clearTimeout(persistTimer.current);
	}, [
		projectId,
		projectName,
		zip,
		calibration,
		site,
		card,
		text,
		recents,
		outcomes,
		mode,
		persist
	]);
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
		const entry = {
			id: next.id,
			savedAt: (/* @__PURE__ */ new Date()).toISOString(),
			card: next,
			zip: nextZip
		};
		setRecents((prev) => [entry, ...prev.filter((r) => r.card.product.name !== next.product.name)].slice(0, 8));
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
	async function handleCreate(name, nextZip) {
		setCreating(true);
		setHomeError(null);
		try {
			if (projectId && hydrated.current) {
				window.clearTimeout(persistTimer.current);
				await api.save({
					id: projectId,
					name: projectName,
					zip,
					calibration,
					site,
					card,
					pdsText: text,
					recents,
					outcomes
				});
			}
			const full = await api.create({
				name,
				zip: nextZip
			});
			applyFull(full);
			toast.success(`${full.name} is on the stand — factory model, this ZIP only.`);
		} catch (err) {
			setHomeError(err instanceof Error ? err.message : "Could not create project.");
		} finally {
			setCreating(false);
		}
	}
	async function handleOpen(id) {
		try {
			if (projectId && hydrated.current) {
				window.clearTimeout(persistTimer.current);
				await api.save({
					id: projectId,
					name: projectName,
					zip,
					calibration,
					site,
					card,
					pdsText: text,
					recents,
					outcomes
				});
			}
			const full = await api.open(id);
			applyFull(full);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not open project.");
		}
	}
	async function handleArchive(id, archived) {
		try {
			await api.archive(id, archived);
			setProjects((prev) => prev.map((p) => p.id === id ? {
				...p,
				archived
			} : p));
			if (archived && projectId === id) {
				setProjectId(null);
				setMode("home");
				setForecast(null);
			}
			toast.success(archived ? "Archived. Memory kept." : "Restored.");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not update project.");
		}
	}
	async function handleDelete(id) {
		try {
			await api.remove(id);
			setProjects((prev) => prev.filter((p) => p.id !== id));
			if (projectId === id) {
				setProjectId(null);
				setMode("home");
				setForecast(null);
			}
			toast.success("Project removed.");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not remove project.");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "min-h-screen bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "no-print border-b border-border/80 bg-surface/90 backdrop-blur",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex min-w-0 items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: "/mascot.jpg",
							alt: "Coatings Conductor mascot — hard-hat conductor blowing a whistle",
							className: "size-12 rounded-md object-cover object-top shadow-[0_0_0_1px_rgba(255,183,3,0.45)] sm:size-14"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[10px] font-semibold uppercase tracking-[0.2em] text-accent",
									children: "Job-site conductor"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-base font-bold tracking-tight sm:text-lg",
									children: "Coatings Conductor"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "truncate text-xs text-muted",
									children: mode === "job" && projectName ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
										projectName,
										" · ",
										zip || "no ZIP"
									] }) : "PDS job card · NOAA windows · per-project models"
								})
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [
							mode === "job" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								type: "button",
								variant: "outline",
								size: "sm",
								onClick: () => setMode("home"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, {}), "Projects"]
							}) : null,
							mode === "job" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
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
							})] }) : null,
							user ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "max-w-[10.5rem] overflow-hidden rounded-md bg-surface-2 px-2 py-1 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] [&_span.text-sm]:block [&_span.text-sm]:truncate",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {})
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								asChild: true,
								variant: "ghost",
								size: "sm",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/login",
									search: { mode: "in" },
									children: "Sign in"
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								asChild: true,
								variant: "outline",
								size: "sm",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/login",
									search: { mode: "up" },
									children: "Create account"
								})
							})] })
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "caution-stripe h-1 w-full" })]
			}),
			mode === "boot" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mx-auto max-w-3xl px-4 py-10 text-sm text-muted",
				children: "Loading your projects…"
			}) : null,
			mode === "home" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProjectHome, {
				projects,
				creating,
				error: homeError,
				guest: !signedIn,
				onCreate: (n, z) => void handleCreate(n, z),
				onOpen: (id) => void handleOpen(id),
				onArchive: (id, archived) => void handleArchive(id, archived),
				onDelete: (id) => void handleDelete(id)
			}) : null,
			mode === "job" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
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
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base",
								children: [
									projectName,
									" at ",
									zip || "this ZIP",
									". Storage through safety in job order, then NOAA windows scored against the real substrate — this project’s model only."
								]
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
							onCalibration: setCalibration,
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
								api.saveCustom(input).then((created) => {
									setCustom((prev) => {
										return [created, ...prev.filter((c) => c.id !== created.id && c.label.toLowerCase() !== created.label.toLowerCase())];
									});
									const cur = site.customMitigationIds ?? [];
									setSite({
										...site,
										customMitigationIds: cur.includes(created.id) ? cur : [...cur, created.id]
									});
									toast.success(`${created.label} is in your library and on for this job.`);
								}).catch((err) => toast.error(err instanceof Error ? err.message : "Could not save mitigation."));
							},
							onLogOutcome: (input) => {
								const result = recordOutcome(input, calibration, outcomes);
								setCalibration(result.calibration);
								setOutcomes(result.outcomes);
								toast.success("Logged on this project. Tightness sliders moved with that result.");
							},
							outcomeCount: outcomes.length,
							product: card?.product.name ?? "",
							zip,
							substrateLabel: substrateById(site.substrate).label,
							mitigationsInPlay: [...site.mitigations, ...custom.filter((c) => (site.customMitigationIds ?? []).includes(c.id)).map((c) => c.label)],
							forecast: scored,
							disabled: !card
						})]
					})
				]
			}) : null
		]
	});
}
function toSummary(full) {
	return {
		id: full.id,
		name: full.name,
		zip: full.zip,
		archived: full.archived,
		lastOpenedAt: full.lastOpenedAt,
		updatedAt: full.updatedAt,
		hasCard: Boolean(full.card)
	};
}
function workspaceApi(signedIn) {
	return {
		load() {
			return signedIn ? loadWorkspace() : Promise.resolve(guestLoadWorkspace());
		},
		create(data) {
			return signedIn ? createProject({ data }) : Promise.resolve(guestCreateProject(data.name, data.zip, data.seed));
		},
		open(id) {
			return signedIn ? openProject({ data: id }) : Promise.resolve(guestOpenProject(id));
		},
		save(data) {
			return signedIn ? saveProject({ data }) : Promise.resolve(guestSaveProject(data));
		},
		archive(id, archived) {
			return signedIn ? archiveProject({ data: {
				id,
				archived
			} }) : Promise.resolve(guestArchiveProject(id, archived));
		},
		remove(id) {
			return signedIn ? deleteProject({ data: id }) : Promise.resolve(guestDeleteProject(id));
		},
		saveCustom(data) {
			return signedIn ? saveCustomMitigation({ data }) : Promise.resolve(guestSaveCustom(data));
		}
	};
}
//#endregion
export { Home as component };
